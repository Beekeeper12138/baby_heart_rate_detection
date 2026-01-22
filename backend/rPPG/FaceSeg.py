
import torch
import cv2
from torch.autograd import Variable
import numpy as np
torch.backends.cudnn.benchmark = True
torch.backends.cudnn.enabled = True
from models import UNet16, UNet11
class FaceSegGPU:
    def __init__(self, bs, size=256, use_compression=True):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.size = size
        self.use_compression = use_compression
        
        # Initialize model
        self.net = UNet11(pretrained=True).to(self.device)
        self.net.eval()
        
        # Create sample input for tracing
        sample = Variable(torch.rand(bs,3,size,size).to(self.device))
        
        # Apply model compression if enabled
        if self.use_compression:
            try:
                # JIT trace the model for faster inference
                self.net = torch.jit.trace(self.net, sample)
                print('Model JIT traced successfully')
                
                # Quantize model if running on CPU
                if self.device.type == 'cpu':
                    self.net = torch.quantization.quantize_dynamic(
                        self.net,
                        {torch.nn.Linear, torch.nn.Conv2d},
                        dtype=torch.qint8
                    )
                    print('Model quantized successfully')
            except Exception as e:
                print(f"Model compression error: {e}")
        else:
            # Run forward pass to initialize
            self.net(sample)
        
        print('___init___')
    
    def get_mask(self, images, shape, adaptive_threshold=True):
        # images = Variable(torch.tensor(images, dtype=torch.float,requires_grad=False).to(device=self.device))
        pred = self.net(images)
        pred= torch.nn.functional.interpolate(pred, size=[shape[1], shape[2]])
        pred = pred.squeeze()
        
        # Use adaptive threshold based on prediction statistics
        if adaptive_threshold:
            # Calculate mean and std of predictions
            pred_np = pred.detach().cpu().numpy()
            mean_pred = np.mean(pred_np)
            std_pred = np.std(pred_np)
            # Adjust threshold based on prediction distribution
            threshold = max(0.5, min(0.9, mean_pred + 0.5 * std_pred))
        else:
            threshold = 0.8
        
        mask = (pred > threshold)
        segmentation = mask.detach().cpu().numpy()
        return segmentation.astype('float')

    def apply_masks(self, frames_transformed, frames):
        masks = self.get_mask(frames_transformed, frames.shape)
        frames[masks==0] = 0.0
        return frames
    
    def enhance_contrast(self, frame):
        """
        Enhance contrast of the frame to improve skin segmentation in varying lighting conditions
        
        Args:
            frame: numpy array representing the image frame
            
        Returns:
            numpy array: Contrast-enhanced frame
        """
        # Convert to float32 for processing
        frame_float = frame.astype(np.float32)
        
        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        if len(frame_float.shape) == 3:
            # For color images, apply CLAHE to each channel
            channels = []
            for i in range(3):
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                channel = clahe.apply(frame_float[:, :, i].astype(np.uint8))
                channels.append(channel)
            enhanced_frame = cv2.merge(channels)
        else:
            # For grayscale images
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced_frame = clahe.apply(frame_float.astype(np.uint8))
        
        return enhanced_frame.astype(np.uint8)
    
    def normalize_illumination(self, frame):
        """
        Normalize illumination across the frame to reduce lighting variations
        
        Args:
            frame: numpy array representing the image frame
            
        Returns:
            numpy array: Illumination-normalized frame
        """
        # Convert to LAB color space
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply Gaussian blur to L channel to get illumination component
        l_blur = cv2.GaussianBlur(l, (9, 9), 0)
        
        # Subtract illumination component from L channel
        l_norm = cv2.subtract(l, l_blur)
        
        # Merge channels back
        lab_norm = cv2.merge((l_norm, a, b))
        
        # Convert back to BGR
        frame_norm = cv2.cvtColor(lab_norm, cv2.COLOR_LAB2BGR)
        
        return frame_norm
