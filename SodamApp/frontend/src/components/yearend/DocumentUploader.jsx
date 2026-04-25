import { useRef, useState } from 'react';
import api from '../../api';

export default function DocumentUploader({ year, staffId, kind, label, onUploaded }) {
  const inputRef = useRef();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      const res = await api.post(
        `/yearend/${year}/employees/${staffId}/documents`,
        fd
      );
      onUploaded?.(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || '업로드 실패');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="inline-block">
      <input ref={inputRef} type="file" accept="application/pdf"
             onChange={handleFile} className="hidden" />
      <button onClick={() => inputRef.current?.click()} disabled={busy}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded">
        {busy ? '업로드 중...' : `+ ${label}`}
      </button>
      {error && <div className="text-rose-600 text-xs mt-1">{error}</div>}
    </div>
  );
}
