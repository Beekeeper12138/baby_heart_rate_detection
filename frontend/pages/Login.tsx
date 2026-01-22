import React, { useMemo, useState } from 'react';
import { AppSettings } from '../types';
import { getTranslation } from '../utils/i18n';
import { api } from '../services/api';

type LoginProps = {
  settings: AppSettings;
  onAuthenticated: (accessToken: string) => void;
};

const Login: React.FC<LoginProps> = ({ settings, onAuthenticated }) => {
  const t = useMemo(() => getTranslation(settings.language).auth, [settings.language]);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const effectivePassword = passwordRef.current?.value ?? password;
      if (mode === 'register') {
        await api.register(username.trim(), effectivePassword, fullName.trim() || undefined);
      }
      const token = await api.login(username.trim(), effectivePassword);
      onAuthenticated(token.access_token);
    } catch (e: any) {
      setError(e?.message || t.unknownError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white dark:bg-card-dark border-2 border-[#cfd7de] dark:border-slate-700 rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-[#dce1e5] dark:border-slate-800 bg-gradient-to-b from-gray-50 to-white dark:from-slate-900/40 dark:to-card-dark">
          <div className="flex items-center gap-3">
            <div className="size-10 flex items-center justify-center bg-primary rounded-xl text-white shadow-sm">
              <span className="material-symbols-outlined">lock</span>
            </div>
            <div className="space-y-0.5">
              <h1 className="text-xl font-black tracking-tight text-[#121517] dark:text-white">{t.title}</h1>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-2 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-lg shadow-sm ring-1 ring-gray-200/60 dark:ring-slate-700/60">
            <button
              className={`flex-1 h-9 rounded-md text-sm font-bold transition-all ${mode === 'login' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'}`}
              onClick={() => setMode('login')}
              type="button"
            >
              {t.login}
            </button>
            <button
              className={`flex-1 h-9 rounded-md text-sm font-bold transition-all ${mode === 'register' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'}`}
              onClick={() => setMode('register')}
              type="button"
            >
              {t.register}
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300">{t.username}</label>
              <input
                className="w-full px-4 h-11 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-gray-400"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
              {mode === 'register' && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/15 border border-blue-200/70 dark:border-blue-900/40 px-3 py-2">
                  <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px] leading-none">info</span>
                  <p className="text-[12px] text-blue-700 dark:text-blue-300 leading-snug">{(t as any).usernameHint}</p>
                </div>
              )}
            </div>

            {mode === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 dark:text-gray-300">{t.fullName}</label>
                <input
                  className="w-full px-4 h-11 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-gray-400"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300">{t.password}</label>
              <input
                className="w-full px-4 h-11 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-gray-400"
                ref={passwordRef}
                onChange={(e) => setPassword(e.currentTarget.value)}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/15 border border-blue-200/70 dark:border-blue-900/40 px-3 py-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px] leading-none">info</span>
                <p className="text-[12px] text-blue-700 dark:text-blue-300 leading-snug">{t.passwordHint}</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2 shadow-sm">
              <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-[18px] leading-none">error</span>
              {error}
            </div>
          )}

          <button
            className="w-full h-11 bg-primary text-white font-black rounded-lg hover:bg-primary-dark transition-all shadow-md disabled:opacity-60 disabled:shadow-sm"
            onClick={submit}
            disabled={submitting || !username.trim() || !password}
            type="button"
          >
            {submitting ? t.submitting : mode === 'login' ? t.login : t.createAccount}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
