import cv2
import numpy as np
from scipy import signal
import base64
import time
import dlib

class RPPGService:
    def __init__(self):
        # 使用Dlib的HOG+SVM人脸检测器
        self.detector = dlib.get_frontal_face_detector()
        self.buffer_size = 300  # ~10 seconds at 30fps
        
        # Buffers for POS
        self.raw_red_buffer = []
        self.raw_green_buffer = []
        self.raw_blue_buffer = []
        
        self.signal_buffer = []      # Processed rPPG signal
        self.lighting_buffer = []
        self.fps = 30.0 
        self._last_frame_ts = None
        self.bpm_history = [] 
        self.max_history_len = 5 
        
        # Kalman Filter State
        self.kalman_x = 0.0 # Estimate
        self.kalman_p = 1.0 # Error covariance
        self.kalman_q = 0.0001 # Process noise covariance
        self.kalman_r = 0.1 # Measurement noise covariance

    def skin_segmentation(self, roi):
        """
        Apply skin segmentation using YCrCb color space
        """
        try:
            ycrcb = cv2.cvtColor(roi, cv2.COLOR_BGR2YCrCb)
            # Define skin color range in YCrCb
            lower = np.array([0, 133, 77], dtype=np.uint8)
            upper = np.array([255, 173, 127], dtype=np.uint8)
            
            mask = cv2.inRange(ycrcb, lower, upper)
            
            # Morphological operations to remove noise
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            mask = cv2.erode(mask, kernel, iterations=1)
            mask = cv2.dilate(mask, kernel, iterations=1)
            
            return mask
        except Exception:
            return np.ones(roi.shape[:2], dtype=np.uint8) * 255
            
    def apply_kalman(self, measurement):
        """
        Simple 1D Kalman Filter
        """
        # Prediction
        x_pred = self.kalman_x
        p_pred = self.kalman_p + self.kalman_q
        
        # Update
        k = p_pred / (p_pred + self.kalman_r)
        self.kalman_x = x_pred + k * (measurement - x_pred)
        self.kalman_p = (1 - k) * p_pred
        
        return self.kalman_x

    def extract_roi_means(self, frame, x, y, w, h):
        """
        Extract mean RGB from a specific ROI, using skin segmentation
        """
        # Clamp to frame
        x = max(0, int(x))
        y = max(0, int(y))
        w = min(frame.shape[1] - x, int(w))
        h = min(frame.shape[0] - y, int(h))
        
        roi = frame[y:y+h, x:x+w]
        if roi.size == 0:
            return None
            
        mask = self.skin_segmentation(roi)
        
        skin_pixels = cv2.countNonZero(mask)
        total_pixels = mask.size
        
        if skin_pixels < total_pixels * 0.1:
             # Fallback to full ROI mean if segmentation fails (e.g. low light)
             b_mean = np.mean(roi[:, :, 0])
             g_mean = np.mean(roi[:, :, 1])
             r_mean = np.mean(roi[:, :, 2])
        else:
             b_mean = cv2.mean(roi[:, :, 0], mask=mask)[0]
             g_mean = cv2.mean(roi[:, :, 1], mask=mask)[0]
             r_mean = cv2.mean(roi[:, :, 2], mask=mask)[0]
             
        return (r_mean, g_mean, b_mean)
        
    def process_frame(self, frame_data: bytes):
        """
        Process a single frame: Detect face -> Multi-ROI Extraction -> POS Algorithm -> Filtering
        """
        # 1. Decode image
        nparr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return None

        h, w = frame.shape[:2]
        max_w = 640
        if w > max_w:
            scale = max_w / float(w)
            new_w = max_w
            new_h = max(1, int(h * scale))
            frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)

        now = time.time()
        if self._last_frame_ts is not None:
            dt = now - self._last_frame_ts
            if dt > 1e-6:
                inst_fps = 1.0 / dt
                inst_fps = float(min(60.0, max(5.0, inst_fps)))
                self.fps = float(0.9 * self.fps + 0.1 * inst_fps)
        self._last_frame_ts = now

        # 2. Face Detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # 使用Dlib的HOG+SVM检测器，参数1表示向上采样1次以检测更小的人脸
        faces = self.detector(gray, 1)
        
        if len(faces) == 0:
            return {
                "bpm": 0, "spo2": 0, "resp_rate": 0, "snr": 0, "lighting": 0, "quality": "No Face"
            }
            
        # 3. Multi-ROI Extraction
        # 将Dlib的rectangle对象转换为OpenCV的(x, y, w, h)格式
        face = faces[0]
        fx, fy, fw, fh = face.left(), face.top(), face.width(), face.height()
        
        # Define ROIs: Forehead, Left Cheek, Right Cheek
        rois_defs = [
            (fx + fw * 0.25, fy + fh * 0.1, fw * 0.5, fh * 0.2), # Forehead
            (fx + fw * 0.1, fy + fh * 0.55, fw * 0.2, fh * 0.2), # Left Cheek
            (fx + fw * 0.7, fy + fh * 0.55, fw * 0.2, fh * 0.2)  # Right Cheek
        ]
        
        r_sum, g_sum, b_sum = 0.0, 0.0, 0.0
        valid_rois = 0
        
        for (rx, ry, rw, rh) in rois_defs:
            means = self.extract_roi_means(frame, rx, ry, rw, rh)
            if means:
                r_sum += means[0]
                g_sum += means[1]
                b_sum += means[2]
                valid_rois += 1
        
        if valid_rois == 0:
             return {"bpm": 0, "spo2": 0, "resp_rate": 0, "snr": 0, "lighting": 0, "quality": "ROI Error"}
             
        # Average the means (Spatial Fusion)
        r_mean = r_sum / valid_rois
        g_mean = g_sum / valid_rois
        b_mean = b_sum / valid_rois
        
        # Lighting calculation (Gray mean)
        lighting_mean = (r_mean * 0.299 + g_mean * 0.587 + b_mean * 0.114)
        
        # 4. Update Raw Buffers
        self.raw_red_buffer.append(r_mean)
        self.raw_green_buffer.append(g_mean)
        self.raw_blue_buffer.append(b_mean)
        self.lighting_buffer.append(lighting_mean)
        
        if len(self.raw_red_buffer) > self.buffer_size:
            self.raw_red_buffer.pop(0)
            self.raw_green_buffer.pop(0)
            self.raw_blue_buffer.pop(0)
            self.lighting_buffer.pop(0)
            
        # 5. Calculate Vitals
        bpm = 0
        spo2 = 0
        resp_rate = 0
        snr = 0
        lighting = 0
        
        if len(self.raw_red_buffer) > self.fps * 6:
            # POS Algorithm & Filtering
            pos_signal = self.calculate_pos_signal()
            self.signal_buffer = pos_signal.tolist() # Update signal buffer for legacy access if needed
            
            raw_bpm, snr = self.calculate_bpm_snr(pos_signal)
            
            # Adaptive Smoothing based on SNR
            if snr > 8 and 40 < raw_bpm < 200:
                self.bpm_history.append(raw_bpm)
                if len(self.bpm_history) > self.max_history_len:
                    self.bpm_history.pop(0)
                weights = np.linspace(1, 2, len(self.bpm_history))
                weights /= weights.sum()
                bpm = np.sum(np.array(self.bpm_history) * weights)
                
                # Update Kalman with the smoothed BPM
                # bpm = self.apply_kalman(bpm) 
            else:
                bpm = self.bpm_history[-1] if self.bpm_history else 0
            
            spo2 = self.calculate_spo2()
            resp_rate = self.calculate_resp_rate()
            lighting = self.calculate_lighting()
            
        # Return Main ROI for visualization
        main_roi = [int(rois_defs[0][0]), int(rois_defs[0][1]), int(rois_defs[0][2]), int(rois_defs[0][3])]
            
        return {
            "bpm": round(bpm, 1),
            "spo2": round(spo2, 1),
            "resp_rate": round(resp_rate, 1),
            "snr": round(snr, 1), 
            "lighting": round(lighting, 1),
            "quality": "Good" if snr > 20 else "Fair" if snr > 8 else "Poor",
            "roi": main_roi
        }

    def calculate_pos_signal(self):
        """
        Plane-Orthogonal-to-Skin (POS) Algorithm
        """
        # Sliding window approach usually, but here we process the whole buffer for simplicity and stability
        r = np.array(self.raw_red_buffer)
        g = np.array(self.raw_green_buffer)
        b = np.array(self.raw_blue_buffer)
        
        # Temporal Normalization
        # Divide by mean to remove DC component scaling
        r_mean = np.mean(r)
        g_mean = np.mean(g)
        b_mean = np.mean(b)
        
        if r_mean == 0 or g_mean == 0 or b_mean == 0:
            return np.zeros(len(r))
            
        rn = r / r_mean
        gn = g / g_mean
        bn = b / b_mean
        
        # Projection
        # S1 = G - B
        # S2 = G + B - 2R
        s1 = gn - bn
        s2 = gn + bn - 2 * rn
        
        # Alpha Tuning (often done in sliding window, here global for buffer)
        # alpha = std(S1) / std(S2)
        std_s1 = np.std(s1)
        std_s2 = np.std(s2)
        
        if std_s2 == 0:
            alpha = 0
        else:
            alpha = std_s1 / std_s2
            
        h = s1 + alpha * s2
        
        return h

    def calculate_bpm_snr(self, signal_data):
        n = len(signal_data)
        if n < int(self.fps * 6):
            return 0.0, 0.0

        # Detrending
        detrended = signal.detrend(signal_data)
        
        # Bandpass Filter (0.7 - 4.0 Hz)
        # Adaptive: if lighting is poor (check last lighting val), maybe narrow the band?
        # For now, stick to standard
        b, a = signal.butter(2, [0.7, 4.0], btype='bandpass', fs=self.fps)
        filtered = signal.filtfilt(b, a, detrended)

        # Kalman Filter Step (applied to the time-domain signal)
        # We re-initialize Kalman for each batch or keep state? 
        # Keeping state across frames is better, but here we process a buffer.
        # Let's apply Kalman to smooth the filtered signal in this batch
        # filtered_kalman = []
        # for val in filtered:
        #    filtered_kalman.append(self.apply_kalman(val))
        # filtered = np.array(filtered_kalman)
        
        # FFT
        window = np.hanning(n)
        spectrum = np.fft.rfft(filtered * window)
        freqs = np.fft.rfftfreq(n, 1 / self.fps)
        power = (np.abs(spectrum) ** 2).astype(float)

        band_mask = (freqs >= 0.7) & (freqs <= 4.0)
        if not np.any(band_mask):
            return 0.0, 0.0

        band_freqs = freqs[band_mask]
        band_power = power[band_mask]
        peak_idx = int(np.argmax(band_power))
        peak_freq = float(band_freqs[peak_idx])
        bpm = peak_freq * 60.0

        # SNR Calculation
        bw = 0.2 # Increased bandwidth slightly
        signal_mask = np.abs(band_freqs - peak_freq) <= bw
        signal_power = float(np.sum(band_power[signal_mask]))
        noise_power = float(np.sum(band_power[~signal_mask]))

        eps = 1e-12
        snr_db = 10.0 * np.log10((signal_power + eps) / (noise_power + eps))
        
        # Map dB to 0-100 score (approximate)
        # > 6dB is usually decent
        snr = ((snr_db + 5.0) / 15.0) * 100.0
        snr = float(min(100.0, max(0.0, snr)))

        return bpm, snr

    def calculate_spo2(self):
        # Using raw buffers for SpO2 (Ratio of Ratios)
        if len(self.raw_red_buffer) < 30: return 98.0
        
        r_data = np.array(self.raw_red_buffer)
        b_data = np.array(self.raw_blue_buffer)
        
        r_dc = np.mean(r_data)
        b_dc = np.mean(b_data)
        r_ac = np.std(r_data)
        b_ac = np.std(b_data)
        
        if r_dc == 0 or b_dc == 0: return 0
        
        ratio = (r_ac / r_dc) / (b_ac / b_dc)
        
        if np.isnan(ratio) or np.isinf(ratio): return 98.0
            
        spo2 = 104 - 17 * ratio
        return min(100, max(85, spo2))

    def calculate_resp_rate(self):
        # Use the POS signal for respiration? Or just Green?
        # Respiration is usually stronger in Green or the raw intensity.
        # Let's use the Green channel raw buffer for Respiration as it's more sensitive to volume changes
        if len(self.raw_green_buffer) < int(self.fps * 10): return 16
        
        n = int(min(len(self.raw_green_buffer), max(1, self.fps * 20)))
        data = np.array(self.raw_green_buffer[-n:], dtype=float)
        detrended = signal.detrend(data)
        
        b, a = signal.butter(2, [0.1, 0.5], btype='bandpass', fs=self.fps)
        try:
            filtered = signal.filtfilt(b, a, detrended)
        except:
            return 16 
            
        n = len(filtered)
        freqs = np.fft.rfftfreq(n, 1/self.fps)
        fft_mag = np.abs(np.fft.rfft(filtered))
        
        freqs = freqs[1:]
        fft_mag = fft_mag[1:]
        
        if len(fft_mag) == 0: return 0
        
        peak_idx = np.argmax(fft_mag)
        return freqs[peak_idx] * 60

    def calculate_lighting(self):
        data = np.array(self.lighting_buffer, dtype=float)
        if data.size < int(self.fps): return 0
        mean = float(np.mean(data))
        std = float(np.std(data))
        if mean <= 1e-6: return 0
        cv = std / mean
        score = 100.0 - (cv * 300.0)
        return float(min(100.0, max(0.0, score)))
