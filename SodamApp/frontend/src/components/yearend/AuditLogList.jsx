const ACTION_LABELS = {
  upload: '업로드',
  download: '다운로드',
  view: '조회',
  regenerate: 'PDF 생성',
  distribute: '배포 활성',
  revoke: '배포 해제',
  reparse: '재파싱',
  delete: '삭제',
};

export default function AuditLogList({ logs }) {
  if (!logs?.length) return <div className="text-slate-400 text-sm">감사 로그 없음</div>;
  return (
    <ul className="space-y-1 text-xs">
      {logs.map((l, i) => (
        <li key={i} className="flex gap-2 text-slate-600">
          <span className="text-slate-400">{new Date(l.occurred_at).toLocaleString('ko-KR')}</span>
          <span className="font-medium">{l.actor_role === 'admin' ? '👤 관리자' : '🙋 본인'}</span>
          <span>{ACTION_LABELS[l.action] || l.action}</span>
          {l.actor_ip && <span className="text-slate-400">({l.actor_ip})</span>}
        </li>
      ))}
    </ul>
  );
}
