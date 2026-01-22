import React, { useState, useEffect } from 'react';
import { Waveform } from '../components/Waveform';
import { AppSettings } from '../types';
import { getTranslation } from '../utils/i18n';
import { api } from '../services/api';

interface DashboardProps {
  settings: AppSettings;
  token: string;
}

const Dashboard: React.FC<DashboardProps> = ({ settings, token }) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [bpm, setBpm] = useState(0);
  const [spo2, setSpo2] = useState(0);
  const [respRate, setRespRate] = useState(0);
  const [signalQuality, setSignalQuality] = useState('Unknown');
  const [snr, setSnr] = useState(0);
  const [lighting, setLighting] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const t = getTranslation(settings.language).dashboard;
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const sessionRef = React.useRef<{ startAt: Date | null; bpmSamples: number[] }>({
    startAt: null,
    bpmSamples: [],
  });

  const formatDate = (d: Date) => d.toISOString().slice(0, 10);
  const formatTime = (d: Date) => d.toTimeString().slice(0, 5);

  const calcAvgBpm = (samples: number[]) => {
    const valid = samples.filter((x) => Number.isFinite(x) && x > 0);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((a, b) => a + b, 0);
    return sum / valid.length;
  };

  const handleSave = async () => {
    if (isSaving) return;

    const startAt = sessionRef.current.startAt;
    if (!startAt) {
      window.alert('请先开始监测后再保存记录');
      return;
    }

    const endAt = new Date();
    const avg = calcAvgBpm(sessionRef.current.bpmSamples);

    setIsSaving(true);
    try {
      await api.saveRecord(token, {
        date: formatDate(startAt),
        startTime: formatTime(startAt),
        endTime: formatTime(endAt),
        avgBpm: Number.isFinite(avg) ? Math.round(avg * 10) / 10 : 0,
        signalQuality: signalQuality || 'Good',
      });
      window.alert('已保存到数据库');
    } catch (e) {
      console.error(e);
      if ((e as any)?.message === 'Unauthorized') {
        window.alert('登录已过期，请重新登录');
        window.location.reload();
        return;
      }
      window.alert('保存失败，请查看控制台/后端日志');
    } finally {
      setIsSaving(false);
    }
  };

  // Start/Stop Monitoring
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let isMounted = true; // Flag to track if effect is active

    if (isMonitoring) {
      sessionRef.current.startAt = new Date();
      sessionRef.current.bpmSamples = [];

      // 1. Start Camera
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (!isMounted) {
            // If component unmounted or monitoring stopped before promise resolved
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        })
        .catch(err => {
          if (isMounted) {
            console.error("Error accessing camera:", err);
            // alert("Error accessing camera: " + err.message); // Optional: notify user
            setIsMonitoring(false);
          }
        });

      // 2. Connect WebSocket
      try {
        wsRef.current = new WebSocket("ws://localhost:8000/ws/video");
        
        wsRef.current.onopen = () => {
          if (!isMounted) {
              wsRef.current?.close();
              return;
          }
          console.log("Connected to Backend");
          // Start sending frames
          interval = setInterval(() => {
              if (videoRef.current && canvasRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
                  const ctx = canvasRef.current.getContext('2d');
                  if (ctx) {
                      canvasRef.current.width = 640; // Resize for performance
                      canvasRef.current.height = 480;
                      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
                      canvasRef.current.toBlob(blob => {
                          if (blob && wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(blob);
                      }, 'image/jpeg', 0.8);
                  }
              }
          }, 100); // 10 FPS
        };

        wsRef.current.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.bpm !== undefined && data.bpm !== null) {
              const next = Number(data.bpm);
              setBpm(next);
              sessionRef.current.bpmSamples.push(next);
            }
            if (data.spo2 !== undefined && data.spo2 !== null) setSpo2(Number(data.spo2));
            if (data.resp_rate !== undefined && data.resp_rate !== null) setRespRate(Number(data.resp_rate));
            if (data.snr !== undefined && data.snr !== null) setSnr(Number(data.snr));
            if (data.lighting !== undefined && data.lighting !== null) setLighting(Number(data.lighting));
            if (data.quality !== undefined && data.quality !== null) setSignalQuality(String(data.quality));
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        wsRef.current.onclose = () => {
          console.log("WebSocket Closed");
          if (isMounted) {
            // 可以添加重连逻辑
          }
        };

        wsRef.current.onerror = (error) => {
          console.error("WebSocket Error:", error);
          if (isMounted) {
            // 可以添加错误处理逻辑
          }
        };
      } catch (error) {
        console.error("Error creating WebSocket connection:", error);
        if (isMounted) {
          setIsMonitoring(false);
          window.alert("无法连接到心率检测服务，请检查后端服务是否运行");
        }
      }

    } else {
      // Stop Camera
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (interval) clearInterval(interval);
    }

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
      if (videoRef.current?.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
         videoRef.current.srcObject = null;
      }
    };
  }, [isMonitoring]);

  const toggleFullScreen = () => {
    if (videoRef.current) {
      if (!document.fullscreenElement) {
        videoRef.current.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 pb-20">
      {/* Hidden Canvas for Frame Processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-[#121517] dark:text-white">{t.title}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-1 font-medium overflow-hidden whitespace-nowrap text-ellipsis">
            {t.patientId}: <span className="font-mono bg-gray-100 dark:bg-slate-800 px-1 rounded">#INF-99283</span> • {t.duration}: <span className="font-mono">00:00:00</span>
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button 
            className="flex items-center justify-center px-3 sm:px-4 h-9 sm:h-10 bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            onClick={handleSave}
            disabled={isSaving}
          >
            <span className="material-symbols-outlined mr-1 sm:mr-2 text-sm sm:text-lg">save</span>
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : t.saveData}</span>
          </button>
          <button 
            onClick={() => setIsMonitoring(!isMonitoring)}
            className={`flex items-center justify-center px-3 sm:px-4 h-9 sm:h-10 rounded-lg text-xs sm:text-sm font-bold text-white transition-colors ${isMonitoring ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
          >
            <span className="material-symbols-outlined mr-1 sm:mr-2 text-sm sm:text-lg">{isMonitoring ? 'stop_circle' : 'play_circle'}</span>
            <span className="hidden sm:inline">{isMonitoring ? t.stop : t.start}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-12">
        {/* Main Video & Chart Area */}
        <div className="col-span-1 sm:col-span-12 lg:col-span-8 flex flex-col gap-6">
          {/* Video Feed */}
          <div className="relative bg-black rounded-lg sm:rounded-xl overflow-hidden shadow-lg aspect-video group ring-1 ring-gray-200 dark:ring-gray-800">
             {/* Real Video Content */}
             <video 
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" 
                playsInline 
                muted
                style={{ 
                  filter: isMonitoring ? 'none' : 'grayscale(100%) brightness(50%)' 
                }}
             />
            
            {/* Overlays */}
            {isMonitoring && (
                <>
                {/* Face Detection Box (Simulated UI for now, logic is backend) */}
                <div className="absolute top-[20%] left-[30%] w-[30%] h-[45%] border-2 border-primary rounded-lg shadow-[0_0_20px_rgba(51,152,219,0.3)] transition-all duration-300 ease-out">
                    <div className="absolute -top-6 left-0 bg-primary text-white text-[10px] px-2 py-0.5 rounded-t font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                        <span className="material-symbols-outlined text-[12px]">face</span>
                        {t.identifying}
                    </div>
                    {/* Corners */}
                    <div className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-white"></div>
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-white"></div>
                    <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-white"></div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-white"></div>
                </div>

                {/* Status Badges */}
                <div className="absolute top-4 left-4 flex gap-2">
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10 shadow-lg">
                    <span className="material-symbols-outlined text-red-500 text-sm animate-pulse-fast filled">videocam</span>
                    <span className="text-white text-xs font-bold tracking-widest uppercase">LIVE</span>
                    </div>
                </div>

                {/* Technical Overlay */}
                <div className="absolute bottom-4 left-4 text-[10px] text-white/70 font-mono">
                    <p>SRC: {settings.cameraSource === 'local' ? 'USB_CAM_01' : 'ESP32_STREAM'}</p>
                    <p>RES: {settings.resolution} @ 30fps</p>
                </div>
                </>
            )}

             {!isMonitoring && (
                 <div className="absolute inset-0 flex items-center justify-center">
                     <div className="bg-black/50 backdrop-blur-md p-6 rounded-2xl border border-white/10 flex flex-col items-center">
                         <span className="material-symbols-outlined text-white/50 text-5xl mb-2">pause_circle</span>
                         <span className="text-white font-bold">{t.paused}</span>
                     </div>
                 </div>
             )}

            {/* Controls Overlay */}
            <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button onClick={toggleFullScreen} className="size-9 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center backdrop-blur-sm border border-white/10 transition-colors">
                    <span className="material-symbols-outlined text-lg">fullscreen</span>
                </button>
            </div>
          </div>

          {/* Waveform Chart */}
          <div className="bg-white dark:bg-card-dark border border-gray-200 dark:border-slate-800 rounded-lg sm:rounded-xl p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="p-1 sm:p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-500">
                    <span className="material-symbols-outlined text-sm sm:text-xl">cardiogram</span>
                </div>
                <div>
                    <h3 className="font-bold text-sm sm:text-base text-[#121517] dark:text-white leading-none">{t.waveform}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.realtimeSignal}</p>
                </div>
              </div>
              <span className="text-gray-500 dark:text-gray-400 text-xs font-mono bg-gray-100 dark:bg-slate-800 px-1 sm:px-2 py-0.5 sm:py-1 rounded">
                Rate: 30 Hz
              </span>
            </div>
            <div className="relative w-full h-32 sm:h-40 bg-gray-50 dark:bg-slate-900/50 rounded-lg overflow-hidden border border-gray-100 dark:border-slate-800">
                {settings.showGrid && (
                    <div className="absolute inset-0 grid grid-cols-12 grid-rows-4 pointer-events-none opacity-20">
                        {Array.from({length: 48}).map((_, i) => (
                            <div key={i} className="border-r border-b border-primary/30"></div>
                        ))}
                    </div>
                )}
              <Waveform isPlaying={isMonitoring} color="#ef4444" />
            </div>
          </div>
        </div>

        {/* Sidebar Stats */}
        <div className="col-span-1 sm:col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* Main HR Card */}
          <div className="bg-white dark:bg-card-dark border-2 border-primary/20 dark:border-primary/40 rounded-xl p-4 sm:p-6 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 size-24 sm:size-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>
            
            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 sm:mb-4 z-10">{t.currentHr}</p>
            
            <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 z-10">
              <span className={`material-symbols-outlined text-red-500 text-4xl sm:text-5xl ${isMonitoring ? 'animate-pulse-fast' : ''} filled`}>favorite</span>
              <span className="text-5xl sm:text-7xl font-black text-[#121517] dark:text-white tracking-tighter tabular-nums">
                {isMonitoring ? bpm : '--'}
              </span>
            </div>
            
            <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold z-10 transition-colors ${bpm > 100 && bpm < 160 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'}`}>
              <span className="material-symbols-outlined text-xs sm:text-base">
                  {bpm > 100 && bpm < 160 ? 'check_circle' : 'warning'}
              </span>
              <span>{bpm > 100 && bpm < 160 ? t.normalRange : t.abnormal}</span>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-card-dark border border-gray-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                 <span className="material-symbols-outlined text-blue-500 text-sm sm:text-lg">air</span>
                 <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase">{t.respRate}</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold dark:text-white tabular-nums">{isMonitoring ? respRate : '--'}</span>
                <span className="text-xs text-gray-400 font-medium">次/分</span>
              </div>
            </div>
            
            <div className="bg-white dark:bg-card-dark border border-gray-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm hover:border-primary/30 transition-colors">
               <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                 <span className="material-symbols-outlined text-cyan-500 text-sm sm:text-lg">water_drop</span>
                 <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase">{t.spo2}</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold dark:text-white tabular-nums">{isMonitoring ? spo2 : '--'}</span>
                <span className="text-xs text-gray-400 font-medium">%</span>
              </div>
            </div>
          </div>

          {/* Signal Analysis */}
          <div className="bg-white dark:bg-card-dark border border-gray-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-sm flex flex-col gap-4 sm:gap-5">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm sm:text-base text-[#121517] dark:text-white flex items-center gap-1 sm:gap-2">
                  <span className="material-symbols-outlined text-xs sm:text-sm text-gray-400">equalizer</span>
                  {t.signalAnalysis}
              </h3>
              <span className="text-green-600 dark:text-green-400 text-xs font-bold px-1 sm:px-2 py-0.5 bg-green-50 dark:bg-green-900/20 rounded border border-green-100 dark:border-green-900/30">
                  {t.goodStatus}
              </span>
            </div>
            
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="space-y-1 sm:space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">{t.snr}</span>
                  <span className="font-bold text-primary dark:text-primary">{isMonitoring ? `${Math.round(snr)}%` : '--'}</span>
                </div>
                <div className="h-1.5 sm:h-2 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${isMonitoring ? Math.min(100, Math.max(0, snr)) : 0}%` }}></div>
                </div>
              </div>
              
              <div className="space-y-1 sm:space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">{t.lighting}</span>
                  <span className="font-bold text-yellow-600 dark:text-yellow-400">{isMonitoring ? `${Math.round(lighting)}%` : '--'}</span>
                </div>
                <div className="h-1.5 sm:h-2 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full transition-all duration-1000" style={{ width: `${isMonitoring ? Math.min(100, Math.max(0, lighting)) : 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-2 sm:gap-3">
             <button className="w-full flex items-center justify-between p-3 sm:p-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all group">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="bg-white/20 p-1.5 sm:p-2 rounded-lg">
                    <span className="material-symbols-outlined text-sm sm:text-xl">analytics</span>
                  </span>
                  <div className="text-left">
                    <span className="block text-xs sm:text-sm">{t.genReport}</span>
                    <span className="block text-[9px] sm:text-[10px] opacity-80 font-normal">{t.includesAi}</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-sm sm:text-base group-hover:translate-x-1 transition-transform">chevron_right</span>
              </button>
              
              <button className="w-full flex items-center justify-between p-3 sm:p-4 bg-white dark:bg-card-dark border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-[#121517] dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800 transition-all group">
                <div className="flex items-center gap-2 sm:gap-3">
                   <span className="bg-gray-100 dark:bg-slate-800 p-1.5 sm:p-2 rounded-lg text-gray-500">
                      <span className="material-symbols-outlined text-sm sm:text-xl">notifications_active</span>
                   </span>
                   <div className="text-left">
                    <span className="block text-xs sm:text-sm">{t.thresholds}</span>
                    <span className="block text-[9px] sm:text-[10px] text-gray-500 font-normal">{t.current}: 60-220 BPM</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-sm sm:text-base text-gray-400 group-hover:text-primary transition-colors">settings</span>
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
