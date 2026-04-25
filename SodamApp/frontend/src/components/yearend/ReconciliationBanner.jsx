export default function ReconciliationBanner({ status, diff }) {
  const config = {
    pending:  { bg: 'bg-slate-50',    text: 'text-slate-700',  label: '대조 미실행', icon: '⚪' },
    ok:       { bg: 'bg-emerald-50',  text: 'text-emerald-800', label: '대조 OK',     icon: '✅' },
    warning:  { bg: 'bg-amber-50',    text: 'text-amber-800',   label: '주의',        icon: '⚠️' },
    mismatch: { bg: 'bg-rose-50',     text: 'text-rose-800',    label: '불일치',      icon: '❌' },
  };
  const c = config[status] || config.pending;
  return (
    <div className={`${c.bg} ${c.text} rounded-lg p-4 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{c.icon}</span>
        <div>
          <div className="font-semibold">{c.label}</div>
          <div className="text-sm opacity-80">
            차액: {diff === 0 ? '0원' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('ko-KR')}원`}
          </div>
        </div>
      </div>
    </div>
  );
}
