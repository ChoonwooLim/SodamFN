import { useState } from 'react';
import { CheckCircle2, AlertTriangle, Trash2, RefreshCw, ShieldAlert } from 'lucide-react';
import api from '../../api';

/**
 * 등록된 카드사 connection 리스트.
 *
 * props:
 *   connections: GET /api/codef/connections?type=card 의 .connections
 *   onChanged: () => void  (변경 후 부모가 refetch)
 */

const STATUS_INFO = {
    active: {
        label: '정상',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        Icon: CheckCircle2,
    },
    expired: {
        label: '만료',
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        Icon: AlertTriangle,
    },
    failed_2fa: {
        label: '추가인증 필요',
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        Icon: ShieldAlert,
    },
    paused: {
        label: '일시정지',
        color: 'text-slate-600',
        bg: 'bg-slate-100',
        Icon: AlertTriangle,
    },
};

function timeAgo(iso) {
    if (!iso) return '없음';
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 1) return '방금 전';
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    return `${day}일 전`;
}

export default function CardConnectionList({ connections, onChanged, onReverify }) {
    const [busy, setBusy] = useState({});

    if (!connections || connections.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                등록된 카드사가 없습니다. 위 [+ 카드사 등록] 버튼으로 시작하세요.
            </div>
        );
    }

    const handleDeactivate = async (conn) => {
        if (!confirm(`${conn.organization_label} 연동을 해제하시겠습니까?`)) return;
        setBusy((b) => ({ ...b, [conn.id]: 'delete' }));
        try {
            await api.delete(`/codef/connections/${conn.id}`);
            onChanged?.();
        } catch (e) {
            alert(e.response?.data?.detail || '해제 실패');
        } finally {
            setBusy((b) => ({ ...b, [conn.id]: null }));
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {connections.map((c) => {
                const info = STATUS_INFO[c.status] || STATUS_INFO.paused;
                const Icon = info.Icon;
                const isFailing = c.status !== 'active';

                return (
                    <div key={c.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-slate-800">
                                        {c.organization_label}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${info.bg} ${info.color}`}>
                                        <Icon className="w-3 h-3" />
                                        {info.label}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-500 space-x-3">
                                    <span>인증: {c.auth_method === 'simple_auth' ? '간편인증' : c.auth_method === 'id_pw' ? 'ID/PW' : c.auth_method}</span>
                                    <span>마지막 검증: {timeAgo(c.last_verified_at)}</span>
                                </div>
                                {isFailing && c.last_error_message && (
                                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                                        {c.last_error_message}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                                {isFailing && (
                                    <button
                                        onClick={() => onReverify?.(c)}
                                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        재인증
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDeactivate(c)}
                                    disabled={busy[c.id] === 'delete'}
                                    title="해제"
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
