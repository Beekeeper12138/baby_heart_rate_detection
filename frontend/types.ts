export type ViewState = 'login' | 'dashboard' | 'history' | 'settings';

export interface VitalSign {
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

export interface MonitoringSession {
  id: string;
  patientId: string;
  startTime: number;
  duration: string; // formatted HH:MM:SS
  heartRate: VitalSign;
  respirationRate: VitalSign;
  spo2: VitalSign;
  signalQuality: number; // 0-100
  ambientLight: 'ideal' | 'poor' | 'too-bright';
}

export interface HistoryRecord {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  avgBpm: number;
  signalQuality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

export interface AppSettings {
  theme: ThemeMode;
  cameraSource: 'local' | 'esp32';
  esp32Address: string;
  rPPGSensitivity: number;
  motionRejection: number;
  minHR: number;
  maxHR: number;
  showGrid: boolean;
  language: 'zh-CN' | 'en-US';
  resolution: '1080p' | '720p' | '480p';
}
