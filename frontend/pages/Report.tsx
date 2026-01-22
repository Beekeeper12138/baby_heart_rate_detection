import React, { useMemo, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AppSettings, ReportData } from '../types';
import { getTranslation } from '../utils/i18n';

type ReportProps = {
  settings: AppSettings;
  report: ReportData;
  onBack: () => void;
};

const formatDateTime = (ts: number, lang: string) => {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '--';
  const yyyyMmDd = d.toISOString().slice(0, 10);
  const hhMm = d.toTimeString().slice(0, 5);
  return lang === 'zh-CN' ? `${yyyyMmDd} ${hhMm}` : `${yyyyMmDd} ${hhMm}`;
};

const fmtNum = (v: number, digits = 1) => {
  if (!Number.isFinite(v) || v <= 0) return '--';
  const p = Math.pow(10, digits);
  return String(Math.round(v * p) / p);
};

const Report: React.FC<ReportProps> = ({ settings, report, onBack }) => {
  const lang = settings.language;
  const t = useMemo(() => getTranslation(lang).report, [lang]);
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const startText = report.startAt ? formatDateTime(report.startAt, lang) : '--';
  const endText = formatDateTime(report.endAt, lang);

  const exportPdf = async () => {
    if (exporting) return;
    const node = reportRef.current;
    if (!node) return;

    setExporting(true);
    try {
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: 'a4' });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const ratio = pageWidth / canvas.width;
      const imgHeight = canvas.height * ratio;

      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);

      let heightLeft = imgHeight - pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const stamp = new Date(report.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-');
      pdf.save(`report_${stamp}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 md:px-20 lg:px-40 pb-20">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 no-print">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-[#121517] dark:text-white">{t.title}</h1>
          {!!t.subtitle && <p className="text-gray-500 dark:text-gray-400">{t.subtitle}</p>}
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 px-4 h-10 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
            onClick={onBack}
            type="button"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            <span className="text-sm">{t.back}</span>
          </button>
          <button
            className="flex items-center gap-2 px-4 h-10 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition-all shadow-sm disabled:opacity-60"
            onClick={exportPdf}
            disabled={exporting}
            type="button"
          >
            <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
            <span className="text-sm">{exporting ? (lang === 'zh-CN' ? '导出中...' : 'Exporting...') : t.exportPdf}</span>
          </button>
        </div>
      </div>

      <div ref={reportRef} className="bg-white dark:bg-card-dark border border-[#dce1e5] dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#dce1e5] dark:border-slate-800 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-black text-[#121517] dark:text-white">{t.title}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t.generatedAt}: {formatDateTime(report.createdAt, lang)}
            </p>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary">InfantMonitor</div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard label={t.startTime} value={startText} />
          <InfoCard label={t.endTime} value={endText} />
          <InfoCard label={t.avgBpm} value={`${fmtNum(report.avgBpm, 1)} BPM`} />
          <InfoCard label={t.minMaxBpm} value={report.minBpm > 0 ? `${Math.round(report.minBpm)} / ${Math.round(report.maxBpm)} BPM` : '--'} />
          <InfoCard label={t.signalQuality} value={report.snapshot.signalQuality || '--'} />
          <InfoCard label={t.thresholds} value={`${report.thresholdMin}-${report.thresholdMax} BPM`} />
          <InfoCard label={t.sampleCount} value={String(report.sampleCount)} />
        </div>

        <div className="px-6 pb-6">
          <div className="bg-gray-50 dark:bg-slate-900/40 border border-[#dce1e5] dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#dce1e5] dark:border-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">monitoring</span>
              <h3 className="font-black text-[#121517] dark:text-white">{t.snapshot}</h3>
            </div>
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400">
                    <th className="py-2 pr-4 font-bold">{t.metric}</th>
                    <th className="py-2 font-bold">{t.value}</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-t border-[#dce1e5] dark:border-slate-800">
                    <td className="py-3 pr-4">{t.currentBpm}</td>
                    <td className="py-3 font-bold">{fmtNum(report.snapshot.currentBpm, 1)} BPM</td>
                  </tr>
                  <tr className="border-t border-[#dce1e5] dark:border-slate-800">
                    <td className="py-3 pr-4">{t.spo2}</td>
                    <td className="py-3 font-bold">{report.snapshot.spo2 > 0 ? `${Math.round(report.snapshot.spo2)}%` : '--'}</td>
                  </tr>
                  <tr className="border-t border-[#dce1e5] dark:border-slate-800">
                    <td className="py-3 pr-4">{t.respRate}</td>
                    <td className="py-3 font-bold">{report.snapshot.respRate > 0 ? String(Math.round(report.snapshot.respRate)) : '--'}</td>
                  </tr>
                  <tr className="border-t border-[#dce1e5] dark:border-slate-800">
                    <td className="py-3 pr-4">SNR</td>
                    <td className="py-3 font-bold">{report.snapshot.snr > 0 ? `${Math.round(report.snapshot.snr)}%` : '--'}</td>
                  </tr>
                  <tr className="border-t border-[#dce1e5] dark:border-slate-800">
                    <td className="py-3 pr-4">{t.lighting}</td>
                    <td className="py-3 font-bold">{report.snapshot.lighting > 0 ? `${Math.round(report.snapshot.lighting)}%` : '--'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoCard: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  return (
    <div className="bg-gray-50 dark:bg-slate-900/40 border border-[#dce1e5] dark:border-slate-800 rounded-2xl p-4">
      <div className="text-xs font-bold text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-sm font-black text-[#121517] dark:text-white">{value}</div>
    </div>
  );
};

export default Report;
