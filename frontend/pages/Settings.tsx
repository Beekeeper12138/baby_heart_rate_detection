import React, { useEffect, useState } from 'react';
import { AppSettings, ThemeMode } from '../types';
import { getTranslation } from '../utils/i18n';

interface SettingsProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSave }) => {
  const [localSettings, setLocalSettings] = React.useState<AppSettings>(settings);
  const [hasChanges, setHasChanges] = React.useState(false);
  const t = getTranslation(localSettings.language).settings;

  // Sync local state when external settings change (e.g. after save)
  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  // Preview Theme Changes immediately
  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyPreview = () => {
      const isDark = 
        localSettings.theme === ThemeMode.DARK || 
        (localSettings.theme === ThemeMode.SYSTEM && mediaQuery.matches);

      if (isDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    };

    applyPreview();
    
    return () => {
       const globalIsDark = 
          settings.theme === ThemeMode.DARK || 
          (settings.theme === ThemeMode.SYSTEM && mediaQuery.matches);
       
       if (globalIsDark) {
          root.classList.add('dark');
          root.classList.remove('light');
       } else {
          root.classList.add('light');
          root.classList.remove('dark');
       }
    };
  }, [localSettings.theme, settings.theme]);

  const handleChange = (key: keyof AppSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(localSettings);
  };

  const [activeSection, setActiveSection] = useState('camera');

  const handleReset = () => {
      setLocalSettings(settings);
      setHasChanges(false);
  }

  const handleSectionClick = (section: string) => {
    setActiveSection(section);
    // 滚动到对应的部分
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-8 p-4 md:p-8 md:px-10 lg:px-20 max-w-[1440px] mx-auto pb-32">
       {/* Sidebar Navigation */}
       <aside className="w-full md:w-64 flex-shrink-0">
        <div className="flex flex-col gap-6 sticky top-24">
            <div className="px-2">
                <h1 className="text-xl font-bold dark:text-white">{t.title}</h1>
                <div className="flex items-center gap-2 mt-1">
                    <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">{t.lastCalibrated}</p>
                </div>
            </div>
            
            <nav className="flex flex-col gap-2">
                {['camera', 'signal', 'appearance', 'security'].map(section => (
                    <button 
                        key={section}
                        onClick={() => handleSectionClick(section)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSection === section ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                         <span className="material-symbols-outlined text-[24px]">
                            {section === 'camera' ? 'videocam' : section === 'signal' ? 'monitoring' : section === 'appearance' ? 'palette' : 'security'}
                         </span>
                         <span className="text-sm font-semibold capitalize">
                             {section === 'camera' ? t.camera : section === 'signal' ? t.signal : section === 'appearance' ? t.appearance : t.security}
                         </span>
                    </button>
                ))}
            </nav>

            {/* Mini Monitor Preview */}
            <div className="mt-4 p-4 bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm hidden md:block">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{t.preview}</p>
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black mb-3">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2 z-10">
                        <span className="text-[10px] text-white font-mono uppercase">{t.online} | 30FPS</span>
                    </div>
                     <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                         <span className="material-symbols-outlined text-gray-600 text-4xl">videocam</span>
                    </div>
                </div>
                 <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-gray-500">{t.signalStrength}</span>
                        <span className="text-green-500">92%</span>
                    </div>
                    <div className="w-full h-1 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: '92%' }}></div>
                    </div>
                </div>
            </div>
        </div>
       </aside>

       {/* Main Form Area */}
       <div className="flex-1 flex flex-col gap-8">
            <header className="mb-2">
                <h2 className="text-3xl font-black text-[#121517] dark:text-white">{t.wizard}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">{t.wizardDesc}</p>
            </header>

            {/* Camera Section */}
            <section id="camera" className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">videocam</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.camera}</h3>
                </div>
                <div className="p-6 flex flex-col gap-8">
                    <div className="flex flex-col gap-4">
                        <label className="text-sm font-semibold text-gray-900 dark:text-white">{t.sourceType}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <SourceCard 
                                active={localSettings.cameraSource === 'local'} 
                                onClick={() => handleChange('cameraSource', 'local')}
                                icon="laptop_chromebook" 
                                title={t.localCam} 
                                desc={t.localCamDesc} 
                            />
                            <SourceCard 
                                active={localSettings.cameraSource === 'esp32'} 
                                onClick={() => handleChange('cameraSource', 'esp32')}
                                icon="memory" 
                                title={t.espCam} 
                                desc={t.espCamDesc} 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                             <label className="text-sm font-semibold text-gray-900 dark:text-white">{t.streamAddr}</label>
                             <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input 
                                        type="text" 
                                        value={localSettings.esp32Address}
                                        onChange={(e) => handleChange('esp32Address', e.target.value)}
                                        className="w-full rounded-xl border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white h-12 px-4 focus:ring-2 focus:ring-primary focus:border-transparent transition-all pr-24"
                                    />
                                    {localSettings.cameraSource === 'esp32' && (
                                        <div className="absolute right-3 top-3.5 flex items-center gap-1.5 pointer-events-none">
                                            <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
                                            <span className="text-[10px] font-bold text-green-500 uppercase">ACTIVE</span>
                                        </div>
                                    )}
                                </div>
                                <button className="h-12 px-4 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
                                    {t.test}
                                </button>
                             </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                             <label className="text-sm font-semibold text-gray-900 dark:text-white">{t.resolution}</label>
                             <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl h-12">
                                 {['1080p', '720p', '480p'].map(res => (
                                     <button 
                                        key={res} 
                                        onClick={() => handleChange('resolution', res)}
                                        className={`flex-1 rounded-lg text-sm font-bold transition-all ${localSettings.resolution === res ? 'bg-white dark:bg-slate-600 shadow-sm text-primary' : 'text-gray-500 dark:text-gray-400'}`}
                                     >
                                         {res}
                                     </button>
                                 ))}
                             </div>
                        </div>
                    </div>
                </div>
            </section>

             {/* Signal Section */}
             <section id="signal" className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">analytics</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.signal}</h3>
                </div>
                <div className="p-6 flex flex-col gap-8">
                     <RangeControl 
                        label={t.sensitivity} 
                        desc={t.sensitivityDesc}
                        value={localSettings.rPPGSensitivity}
                        onChange={(v) => handleChange('rPPGSensitivity', v)}
                        badge="中等偏高"
                     />
                     <RangeControl 
                        label={t.motion}
                        desc={t.motionDesc}
                        value={localSettings.motionRejection}
                        onChange={(v) => handleChange('motionRejection', v)}
                        badge="标准"
                     />
                     <div className="grid grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                             <label className="text-sm font-semibold text-gray-900 dark:text-white">{t.minHr}</label>
                             <input 
                                type="number" 
                                value={localSettings.minHR}
                                onChange={(e) => handleChange('minHR', parseInt(e.target.value))}
                                className="rounded-xl border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white h-12"
                             />
                        </div>
                        <div className="flex flex-col gap-2">
                             <label className="text-sm font-semibold text-gray-900 dark:text-white">{t.maxHr}</label>
                             <input 
                                type="number" 
                                value={localSettings.maxHR}
                                onChange={(e) => handleChange('maxHR', parseInt(e.target.value))}
                                className="rounded-xl border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white h-12"
                             />
                        </div>
                     </div>
                </div>
            </section>

            {/* Appearance Section */}
            <section id="appearance" className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">palette</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.appearance}</h3>
                </div>
                <div className="p-6 flex flex-col gap-6">
                     <label className="text-sm font-semibold text-gray-900 dark:text-white">{t.theme}</label>
                     <div className="grid grid-cols-3 gap-4">
                        <ThemeCard 
                            active={localSettings.theme === ThemeMode.LIGHT} 
                            onClick={() => handleChange('theme', ThemeMode.LIGHT)}
                            mode="light" 
                            label={t.light}
                        />
                        <ThemeCard 
                            active={localSettings.theme === ThemeMode.DARK} 
                            onClick={() => handleChange('theme', ThemeMode.DARK)}
                            mode="dark" 
                            label={t.dark}
                        />
                         <ThemeCard 
                            active={localSettings.theme === ThemeMode.SYSTEM} 
                            onClick={() => handleChange('theme', ThemeMode.SYSTEM)}
                            mode="system" 
                            label={t.system}
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-6 mt-2">
                         <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-gray-900 dark:text-white">{t.language}</label>
                            <select 
                                value={localSettings.language}
                                onChange={(e) => handleChange('language', e.target.value)}
                                className="rounded-xl border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white h-12"
                            >
                                <option value="zh-CN">简体中文 (Chinese)</option>
                                <option value="en-US">English (US)</option>
                            </select>
                         </div>
                     </div>
                </div>
            </section>
       </div>

       {/* Floating Footer */}
       {hasChanges && (
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-card-dark border-t border-gray-200 dark:border-slate-800 px-6 py-4 z-40 animate-slideUp">
                <div className="max-w-[1440px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-yellow-700 dark:text-yellow-400 text-xs font-bold">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        {t.unsaved}
                    </div>
                    <div className="flex gap-4">
                        <button onClick={handleReset} className="px-6 py-2.5 rounded-xl border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-white text-sm font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                            {t.restore}
                        </button>
                        <button onClick={handleSave} className="px-8 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">save</span>
                            {t.save}
                        </button>
                    </div>
                </div>
            </div>
       )}
    </div>
  );
};

// Sub-components for cleaner code
const SourceCard: React.FC<{ active: boolean; onClick: () => void; icon: string; title: string; desc: string }> = ({ active, onClick, icon, title, desc }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${active ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-primary/50'}`}
    >
        <div className={`size-10 flex items-center justify-center rounded-lg transition-colors ${active ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
            <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
        </div>
    </button>
);

const RangeControl: React.FC<{ label: string; desc: string; value: number; onChange: (val: number) => void; badge: string }> = ({ label, desc, value, onChange, badge }) => (
    <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
            <div className="flex flex-col">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
            </div>
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg uppercase">{badge}</span>
        </div>
        <input 
            type="range" 
            min="0" 
            max="100" 
            value={value} 
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary" 
        />
    </div>
);

const ThemeCard: React.FC<{ active: boolean; onClick: () => void; mode: string; label: string }> = ({ active, onClick, mode, label }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-all ${active ? 'border-primary bg-background-light dark:bg-slate-800' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-primary/50'}`}
    >
        <div className={`w-full h-16 rounded-lg shadow-sm flex flex-col p-2 gap-1 overflow-hidden ${mode === 'light' ? 'bg-white' : mode === 'dark' ? 'bg-gray-800' : 'bg-gradient-to-br from-white to-gray-900'}`}>
            <div className={`w-8 h-2 rounded-full ${active ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
            <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full"></div>
            <div className="w-3/4 h-1 bg-gray-100 dark:bg-gray-700 rounded-full"></div>
        </div>
        <p className={`text-xs font-bold uppercase text-center ${active ? 'text-primary' : 'text-gray-400'}`}>{label}</p>
    </button>
);

export default Settings;