import React, { useEffect, useState } from 'react';
import { HistoryRecord, AppSettings } from '../types';
import { getTranslation } from '../utils/i18n';
import { api } from '../services/api';

interface HistoryProps {
    settings?: AppSettings;
    token: string;
}

const History: React.FC<HistoryProps> = ({ settings, token }) => {
  const t = getTranslation(settings?.language || 'zh-CN').history;
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [qualityFilter, setQualityFilter] = useState<'all' | 'Excellent' | 'Good' | 'Fair' | 'Poor'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);

  const stats = React.useMemo(() => {
    const list = records
      .map((r) => ({ ...r, avgBpm: Number(r.avgBpm) }))
      .filter((r) => Number.isFinite(r.avgBpm) && r.avgBpm > 0);

    const overallAvg = list.length ? list.reduce((sum, r) => sum + r.avgBpm, 0) / list.length : null;
    const maxAvg = list.length ? Math.max(...list.map((r) => r.avgBpm)) : null;
    const minAvg = list.length ? Math.min(...list.map((r) => r.avgBpm)) : null;

    const toTime = (r: HistoryRecord) => {
      const raw = `${r.date}T${r.startTime || '00:00'}:00`;
      const d = new Date(raw);
      const t = d.getTime();
      return Number.isFinite(t) ? t : 0;
    };

    const sorted = [...list].sort((a, b) => toTime(b) - toTime(a));
    const latest = sorted[0]?.avgBpm;
    const prev = sorted[1]?.avgBpm;

    let trend: { text: string; type: 'good' | 'bad' } | null = null;
    if (latest && prev && prev > 0) {
      const pct = ((latest - prev) / prev) * 100;
      const abs = Math.abs(pct);
      if (Number.isFinite(abs) && abs >= 0.1) {
        trend = {
          text: `${pct >= 0 ? t.trendUp : t.trendDown} ${abs.toFixed(1)}%`,
          type: pct >= 0 ? 'bad' : 'good',
        };
      }
    }

    const fmt = (n: number | null) => (n === null ? '--' : String(Math.round(n)));

    return {
      overallAvg: fmt(overallAvg),
      maxAvg: fmt(maxAvg),
      minAvg: fmt(minAvg),
      trend,
    };
  }, [records, t.trendDown, t.trendUp]);

  const filteredRecords = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (qualityFilter !== 'all' && r.signalQuality !== qualityFilter) return false;
      if (!q) return true;
      const hay = [
        r.date,
        r.startTime,
        r.endTime,
        r.signalQuality,
        String(r.avgBpm),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [records, searchQuery, qualityFilter]);

  const exportRecords = React.useCallback(() => {
    const lang = settings?.language || 'zh-CN';
    const headers =
      lang === 'zh-CN'
        ? ['日期', '开始时间', '结束时间', '平均心率(BPM)', '信号质量']
        : ['Date', 'Start Time', 'End Time', 'Avg BPM', 'Signal Quality'];

    const list = filteredRecords;
    if (!list.length) {
      window.alert(lang === 'zh-CN' ? '暂无可导出的记录' : 'No records to export');
      return;
    }

    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      headers.map(esc).join(','),
      ...list.map((r) =>
        [r.date, r.startTime, r.endTime, r.avgBpm, r.signalQuality].map(esc).join(','),
      ),
    ];
    const csv = '\ufeff' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `history_${stamp}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [filteredRecords, settings?.language]);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const data = await api.getHistory(token);
            const normalized: HistoryRecord[] = (data ?? []).map((r: any) => ({
              id: String(r.id),
              date: r.date,
              startTime: r.start_time ?? r.startTime ?? '',
              endTime: r.end_time ?? r.endTime ?? '',
              avgBpm: r.avg_bpm ?? r.avgBpm ?? 0,
              signalQuality: r.signal_quality ?? r.signalQuality ?? 'Good',
            }));
            setRecords(normalized);
        } catch (error) {
            console.error("Failed to fetch history:", error);
            if ((error as any)?.message === 'Unauthorized') {
              setError('登录已过期，请重新登录');
              window.location.reload();
              return;
            }
            setError('加载失败，请稍后重试');
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [token]);

  return (
    <div className="p-4 md:p-8 md:px-20 lg:px-40 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-[#121517] dark:text-white">{t.title}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
            <button
              className="flex items-center gap-2 px-4 h-10 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition-all shadow-sm disabled:opacity-60"
              onClick={exportRecords}
              disabled={loading}
              type="button"
            >
              <span className="material-symbols-outlined text-xl">download</span>
              <span className="text-sm">{t.export}</span>
            </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard title={t.avgHr} value={stats.overallAvg} unit="BPM" trend={stats.trend?.text} trendType={stats.trend?.type} icon="favorite" color="primary" />
        <StatCard title={t.maxHr} value={stats.maxAvg} unit="BPM" subtext={t.recordSubtextActivity} icon="bolt" color="orange" />
        <StatCard title={t.minHr} value={stats.minAvg} unit="BPM" subtext={t.recordSubtextSleep} icon="bedtime" color="blue" />
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-card-dark border border-[#dce1e5] dark:border-slate-800 rounded-xl shadow-sm">
        <div className="p-4 border-b border-[#dce1e5] dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <h3 className="font-bold text-lg dark:text-white">{t.log}</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
              <input 
                className="pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary w-64 dark:text-white placeholder-gray-400" 
                placeholder={t.search}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
              />
            </div>
            <div className="relative">
              <button
                className="p-2 bg-gray-50 dark:bg-slate-800 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors dark:text-gray-300"
                onClick={() => setFilterOpen((v) => !v)}
                type="button"
              >
              <span className="material-symbols-outlined text-xl align-middle">filter_list</span>
              </button>
              {filterOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-card-dark border border-[#dce1e5] dark:border-slate-800 rounded-xl shadow-lg overflow-hidden z-20">
                  <div className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-[#dce1e5] dark:border-slate-800">
                    {t.signalQuality}
                  </div>
                  <div className="max-h-64 overflow-auto">
                    {(['all', 'Excellent', 'Good', 'Fair', 'Poor'] as const).map((q) => (
                      <button
                        key={q}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 ${
                          qualityFilter === q ? 'text-primary font-bold' : 'text-gray-700 dark:text-gray-200'
                        }`}
                        onClick={() => {
                          setQualityFilter(q);
                          setFilterOpen(false);
                        }}
                        type="button"
                      >
                        <span>{q === 'all' ? 'All' : q}</span>
                        {qualityFilter === q && <span className="material-symbols-outlined text-[18px]">check</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}
        <div className="overflow-hidden rounded-b-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">{t.date}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">{t.time}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300 text-center">{t.avgHr}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">{t.signalQuality}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300 text-right">{t.action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dce1e5] dark:divide-slate-800">
              {loading ? (
                  <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
              ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-sm text-gray-500 dark:text-gray-400">
                      {(settings?.language || 'zh-CN') === 'zh-CN' ? '暂无匹配记录' : 'No matching records'}
                    </td>
                  </tr>
              ) : filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                      <span className="material-symbols-outlined text-primary text-base">calendar_today</span>
                      <span className="text-sm font-medium">{record.date}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{record.startTime} - {record.endTime}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5 font-bold text-gray-800 dark:text-white bg-primary/10 dark:bg-primary/20 px-3 py-1 rounded-full text-sm">
                       <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                       {record.avgBpm} BPM
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     <SignalQualityBadge quality={record.signalQuality} />
                  </td>
                  <td className="px-6 py-4 text-right">
                     <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-primary hover:text-primary-dark font-bold text-sm bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-md"
                          onClick={() => setSelectedRecord(record)}
                          type="button"
                        >
                          {t.details}
                        </button>
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedRecord(null)}
            type="button"
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-card-dark border border-[#dce1e5] dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#dce1e5] dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">info</span>
                <h3 className="font-black text-[#121517] dark:text-white">{t.details}</h3>
              </div>
              <button
                className="px-3 h-9 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors text-sm font-bold"
                onClick={() => setSelectedRecord(null)}
                type="button"
              >
                {t.close}
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-slate-900/40 border border-[#dce1e5] dark:border-slate-800 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t.date}</p>
                  <p className="text-sm font-black text-[#121517] dark:text-white">{selectedRecord.date}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-900/40 border border-[#dce1e5] dark:border-slate-800 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t.time}</p>
                  <p className="text-sm font-black text-[#121517] dark:text-white">{selectedRecord.startTime} - {selectedRecord.endTime}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-900/40 border border-[#dce1e5] dark:border-slate-800 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t.avgHr}</p>
                  <p className="text-sm font-black text-[#121517] dark:text-white">{selectedRecord.avgBpm} BPM</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-900/40 border border-[#dce1e5] dark:border-slate-800 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t.signalQuality}</p>
                  <div className="mt-1">
                    <SignalQualityBadge quality={selectedRecord.signalQuality} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  className="px-4 h-10 rounded-lg bg-primary text-white font-black hover:bg-primary-dark transition-colors shadow-sm"
                  onClick={() => setSelectedRecord(null)}
                  type="button"
                >
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; unit: string; trend?: string; trendType?: 'good' | 'bad'; subtext?: string; icon: string; color: string }> = ({ 
    title, value, unit, trend, trendType, subtext, icon, color 
}) => {
    const colorClasses = {
        primary: 'bg-primary/10 text-primary',
        orange: 'bg-orange-500/10 text-orange-500',
        blue: 'bg-blue-500/10 text-blue-500'
    };

    return (
        <div className="bg-white dark:bg-card-dark border border-[#dce1e5] dark:border-slate-800 rounded-xl p-6 flex items-start justify-between shadow-sm">
            <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">{title}</p>
            <p className="text-2xl font-bold text-[#121517] dark:text-white tracking-tight">{value} <span className="text-sm font-normal text-gray-400">{unit}</span></p>
            {trend && (
                <p className={`text-xs mt-2 flex items-center gap-1 ${trendType === 'good' ? 'text-green-500' : 'text-red-500'}`}>
                <span className="material-symbols-outlined text-xs">{trendType === 'good' ? 'trending_down' : 'trending_up'}</span>
                {trend}
                </p>
            )}
            {subtext && <p className="text-xs text-gray-400 mt-2">{subtext}</p>}
            </div>
            <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses] || colorClasses.primary}`}>
               <span className="material-symbols-outlined text-2xl">{icon}</span>
            </div>
        </div>
    );
}

const SignalQualityBadge: React.FC<{ quality: string }> = ({ quality }) => {
    let bars = 4;
    let color = 'bg-primary';
    
    if (quality === 'Excellent') { bars = 4; color = 'bg-primary'; }
    if (quality === 'Good') { bars = 3; color = 'bg-primary/80'; }
    if (quality === 'Fair') { bars = 2; color = 'bg-yellow-500'; }
    if (quality === 'Poor') { bars = 1; color = 'bg-red-500'; }

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-end gap-0.5 h-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`w-1 rounded-sm ${i <= bars ? color : 'bg-gray-200 dark:bg-slate-700'}`} style={{ height: `${i * 25}%` }}></div>
                ))}
            </div>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded tracking-wider uppercase">{quality}</span>
        </div>
    )
}

export default History;
