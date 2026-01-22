import React, { useState, useEffect } from 'react';
import { ViewState, ThemeMode, AppSettings } from './types';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Report from './pages/Report';
import { getTranslation } from './utils/i18n';
import { api } from './services/api';
import { ReportData } from './types';

// Default Settings
const DEFAULT_SETTINGS: AppSettings = {
  theme: ThemeMode.SYSTEM,
  cameraSource: 'local',
  esp32Address: 'http://192.168.3.15/stream',
  rPPGSensitivity: 75,
  motionRejection: 40,
  minHR: 60,
  maxHR: 220,
  showGrid: true,
  language: 'zh-CN',
  resolution: '1080p'
};

const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string | null>(api.getStoredToken());
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string; full_name?: string | null } | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>(accessToken ? 'dashboard' : 'login');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const t = getTranslation(settings.language).nav;

  // Apply Theme and Listen for System Changes
  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = 
        settings.theme === ThemeMode.DARK || 
        (settings.theme === ThemeMode.SYSTEM && mediaQuery.matches);

      if (isDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    };

    applyTheme(); // Initial application

    // Listener for system theme changes if mode is SYSTEM
    const handleChange = () => {
      if (settings.theme === ThemeMode.SYSTEM) {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.theme]);

  useEffect(() => {
    let isMounted = true;

    const checkBackend = async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 1500);
      try {
        const res = await fetch('http://localhost:8000/', { signal: controller.signal });
        if (isMounted) setBackendAvailable(res.ok);
      } catch {
        if (isMounted) setBackendAvailable(false);
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    checkBackend();
    const intervalId = window.setInterval(checkBackend, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!accessToken) {
        setCurrentUser(null);
        setCurrentView('login');
        return;
      }
      try {
        const me = await api.me(accessToken);
        if (!cancelled) setCurrentUser(me);
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
          setAccessToken(null);
          setCurrentView('login');
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const renderView = () => {
    switch (currentView) {
      case 'login':
        return (
          <Login
            settings={settings}
            onAuthenticated={(token) => {
              setAccessToken(token);
              setCurrentView('dashboard');
            }}
          />
        );
      case 'dashboard':
        return accessToken ? (
          <Dashboard
            settings={settings}
            token={accessToken}
            onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
            onOpenReport={(data) => {
              setReportData(data);
              setCurrentView('report');
            }}
          />
        ) : null;
      case 'history':
        return accessToken ? <History settings={settings} token={accessToken} /> : null;
      case 'settings':
        return <Settings settings={settings} onSave={setSettings} />;
      case 'report':
        return reportData ? <Report settings={settings} report={reportData} onBack={() => setCurrentView('dashboard')} /> : null;
      default:
        return accessToken ? (
          <Dashboard
            settings={settings}
            token={accessToken}
            onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
            onOpenReport={(data) => {
              setReportData(data);
              setCurrentView('report');
            }}
          />
        ) : null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-[#dce1e5] dark:border-slate-800 bg-white dark:bg-card-dark px-4 md:px-10 py-3 transition-colors duration-200">
        <div className="flex items-center justify-between max-w-[1440px] mx-auto w-full">
          <div className="flex items-center gap-3 text-[#121517] dark:text-white cursor-pointer" onClick={() => setCurrentView(accessToken ? 'dashboard' : 'login')}>
            <div className="size-8 flex items-center justify-center bg-primary rounded-lg text-white shadow-sm">
              <span className="material-symbols-outlined">child_care</span>
            </div>
            <div>
              <h2 className="text-lg font-bold leading-none tracking-tight">InfantMonitor</h2>
              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">rPPG System v1.0</span>
            </div>
          </div>
          
          <div className="flex flex-1 justify-end gap-2 md:gap-8 items-center">
            {/* Mobile Navigation */}
            {accessToken && (
            <nav className="flex md:hidden items-center gap-1 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-lg shadow-sm">
              <NavButton 
                active={currentView === 'dashboard'} 
                onClick={() => setCurrentView('dashboard')} 
                icon="dashboard" 
                label="" 
              />
              <NavButton 
                active={currentView === 'history'} 
                onClick={() => setCurrentView('history')} 
                icon="history" 
                label="" 
              />
              <NavButton 
                active={currentView === 'settings'} 
                onClick={() => setCurrentView('settings')} 
                icon="settings" 
                label="" 
              />
            </nav>
            )}
            {/* Desktop Navigation */}
            {accessToken && (
            <nav className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-lg shadow-sm">
              <NavButton 
                active={currentView === 'dashboard'} 
                onClick={() => setCurrentView('dashboard')} 
                icon="dashboard" 
                label={t.dashboard} 
              />
              <NavButton 
                active={currentView === 'history'} 
                onClick={() => setCurrentView('history')} 
                icon="history" 
                label={t.history} 
              />
              <NavButton 
                active={currentView === 'settings'} 
                onClick={() => setCurrentView('settings')} 
                icon="settings" 
                label={t.settings} 
              />
            </nav>
            )}

            <div className="flex items-center gap-2 md:gap-3">
               <div className="hidden sm:flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-200 dark:border-green-800">
                <div className="size-2 rounded-full bg-green-500 animate-pulse-fast"></div>
                <span className="text-green-700 dark:text-green-400 text-xs font-bold whitespace-nowrap">{backendAvailable ? t.systemActive : '服务不可用'}</span>
              </div>
              <div className="sm:hidden flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-200 dark:border-green-800">
                <div className="size-2 rounded-full bg-green-500 animate-pulse-fast"></div>
              </div>
              
              {accessToken && (
                <button
                  className="px-3 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-bold"
                  onClick={async () => {
                    await api.logout();
                    setAccessToken(null);
                    setCurrentView('login');
                  }}
                >
                  退出
                </button>
              )}

              <div className="flex items-center gap-2">
                {currentUser?.username && (
                  <span className="hidden md:inline text-xs font-bold text-gray-600 dark:text-gray-300">
                    {currentUser.username}
                  </span>
                )}
                <div 
                  className="size-9 rounded-full bg-cover bg-center border-2 border-gray-200 dark:border-gray-700 cursor-pointer"
                  style={{ backgroundImage: 'url(\"https://picsum.photos/100/100\")' }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full mx-auto max-w-[1440px]">
        {renderView()}
      </main>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
      ${active 
        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' 
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
      }
    `}
  >
    <span className={`material-symbols-outlined text-[16px] md:text-[18px] ${active ? 'filled' : ''}`}>{icon}</span>
    <span className="hidden md:inline">{label}</span>
  </button>
);

export default App;
