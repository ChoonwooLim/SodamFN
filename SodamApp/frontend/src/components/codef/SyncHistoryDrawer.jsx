import { useState, useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import api from '../../api';

/**
 * 최근 30일 CODEF 호출 이력 drawer.
 *
 * /api/codef/sync-cards/history?days=30
 */

const STATUS_COLOR = {
    success: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-red-50 text-red-700',
    rate_limited: 'bg-amber-50 text-amber-700',
    auth_expired: 'bg-amber-50 text-amber-700',
};

const TRIGGER_LABEL = {
    cron: '자동',
    user_button: '수동',
    registration: '등록',
    verify: '재인증',
};

const PATH_SHORT = {
    '/v1/kr/card/common/b/approval': '승인',
    '/v1/kr/card/common/b/billing': '청구',
    '/v1/kr/card/common/b/member-store': '가맹점',
};

function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}/${day} ${hh}:${mm}`;
}

export default function SyncHistoryDrawer({ isOpen, onClose }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        setErr('');
        api.get('/codef/sync-cards/history', { params: { days: 30 } })
            .then((res) => setLogs(res.data.history || []))
            .catch((e) => setErr(e.response?.data?.detail || '이력을 불러오지 못했습니다.'))
            .finally(() => setLoading(false));
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40">
            <div
                className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white flex items-center justify-between p-5 border-b border-slate-200 z-10">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-slate-800">최근 동기화 이력</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-2">
                    {loading && <p className="text-sm text-slate-500 text-center py-8">불러오는 중...</p>}
                    {err && <p className="text-sm text-red-600">{err}</p>}
                    {!loading && !err && logs.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-8">최근 30일 동기화 이력이 없습니다.</p>
                    )}
                    {logs.map((log) => {
                        const colorClass = STATUS_COLOR[log.status] || 'bg-slate-50 text-slate-600';
                        return (
                            <div key={log.id} className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${colorClass}`}>
                                        {log.status === 'success' ? '성공' : log.status}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {fmtTime(log.called_at)}
                                    </span>
                                </div>
                                <div className="text-slate-700">
                                    {PATH_SHORT[log.api_path] || log.api_path}
                                    {log.organization_code && (
                                        <span className="text-slate-500"> · {log.organization_code}</span>
                                    )}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                    <span>{TRIGGER_LABEL[log.triggered_by] || log.triggered_by}</span>
                                    {log.rows_returned !== null && log.rows_returned !== undefined && (
                                        <span>· {log.rows_returned}건 수신</span>
                                    )}
                                    {log.estimated_cost_krw > 0 && (
                                        <span>· {log.estimated_cost_krw}원</span>
                                    )}
                                    {log.result_code && log.result_code !== 'CF-00000' && (
                                        <span className="text-amber-700">· {log.result_code}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
