import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle, CheckCircle2, Clock, ExternalLink,
    HelpCircle, Plus, XCircle,
} from 'lucide-react';
import api from '../../api';

/**
 * 외부 연동 채널 (쿠팡이츠/배민 등) 의 쿠키 만료/실패 상태를 시각화.
 *
 * 데이터 소스: GET /api/external-integration/status
 * 60초마다 자동 리프레시. 사장님이 어드민 열 때 즉시 임박/만료 상태 인지.
 *
 * 채널 페이지 매핑:
 *   coupang_eats → /external-integration/coupang-eats
 *   baemin → /외부연동/배민 (해당 페이지 미존재 시 폴백)
 */

const CHANNEL_DETAIL_PATH = {
    coupang_eats: '/external-integration/coupang-eats',
    baemin: '/external-integration',  // 배민 detail 페이지 추후 (임시 hub)
};

const STATUS_META = {
    healthy: {
        label: '정상',
        text: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        Icon: CheckCircle2,
        iconColor: 'text-emerald-600',
    },
    expiring_soon: {
        label: '곧 만료',
        text: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        Icon: Clock,
        iconColor: 'text-amber-600',
    },
    expired: {
        label: '만료됨',
        text: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-300',
        Icon: XCircle,
        iconColor: 'text-red-600',
    },
    failed: {
        label: '연결 실패',
        text: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-300',
        Icon: AlertTriangle,
        iconColor: 'text-red-600',
    },
    unknown: {
        label: '만료 시간 미상',
        text: 'text-slate-600',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        Icon: HelpCircle,
        iconColor: 'text-slate-500',
    },
    not_configured: {
        label: '미등록',
        text: 'text-slate-500',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        Icon: Plus,
        iconColor: 'text-slate-400',
    },
};


function formatHoursLeft(hours) {
    if (hours === null || hours === undefined) return null;
    if (hours < 0) {
        const abs = Math.abs(hours);
        if (abs < 1) return `${Math.round(abs * 60)}분 전 만료`;
        if (abs < 24) return `${abs.toFixed(1)}시간 전 만료`;
        return `${Math.floor(abs / 24)}일 전 만료`;
    }
    if (hours < 1) return `${Math.round(hours * 60)}분 남음`;
    if (hours < 24) return `${hours.toFixed(1)}시간 남음`;
    return `${Math.floor(hours / 24)}일 남음`;
}


export default function ChannelStatusCards() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let cancelled = false;
        const fetchStatus = () => {
            api.get('/external-integration/status')
                .then(res => { if (!cancelled) { setData(res.data); setErr(''); } })
                .catch(e => { if (!cancelled) setErr(e.response?.data?.detail || '상태 조회 실패'); })
                .finally(() => { if (!cancelled) setLoading(false); });
        };
        fetchStatus();
        const id = setInterval(fetchStatus, 60_000);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    if (loading && !data) {
        return (
            <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
                연결 상태 확인 중…
            </div>
        );
    }
    if (err) {
        return (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {err}
            </div>
        );
    }
    if (!data || !data.channels?.length) return null;

    return (
        <div className="mb-6">
            <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700">
                    자동수집 채널 상태
                    {data.alert_count > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-semibold rounded-full bg-red-500 text-white">
                            {data.alert_count}
                        </span>
                    )}
                </h2>
                <span className="text-[11px] text-slate-400">60초마다 자동 갱신</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.channels.map(ch => {
                    const meta = STATUS_META[ch.status] || STATUS_META.unknown;
                    const { Icon } = meta;
                    const detailPath = CHANNEL_DETAIL_PATH[ch.channel_key];
                    const hoursLabel = formatHoursLeft(ch.expires_in_hours);
                    return (
                        <div
                            key={ch.channel_key}
                            className={`p-4 rounded-xl border-2 ${meta.bg} ${meta.border}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Icon className={`w-5 h-5 shrink-0 ${meta.iconColor}`} />
                                    <div className="min-w-0">
                                        <div className="font-bold text-slate-800 truncate">{ch.channel}</div>
                                        <div className={`text-xs font-medium ${meta.text}`}>
                                            {meta.label}
                                            {hoursLabel ? ` · ${hoursLabel}` : ''}
                                        </div>
                                    </div>
                                </div>
                                {detailPath && (
                                    <Link
                                        to={detailPath}
                                        className="shrink-0 text-xs px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 inline-flex items-center gap-1"
                                    >
                                        {ch.status === 'not_configured' ? '연결하기' : '갱신'}
                                        <ExternalLink className="w-3 h-3" />
                                    </Link>
                                )}
                            </div>

                            {ch.status !== 'healthy' && ch.refresh_guide && (
                                <p className="mt-2.5 text-[12px] leading-relaxed text-slate-600">
                                    {ch.refresh_guide}
                                </p>
                            )}

                            {ch.last_error_message && (
                                <div className="mt-2 p-2 rounded-md bg-white border border-red-200 text-[11px] text-red-700 break-words">
                                    {ch.last_error_message}
                                </div>
                            )}

                            <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                                {ch.last_verified_at && (
                                    <span>마지막 검증: {new Date(ch.last_verified_at).toLocaleString('ko-KR')}</span>
                                )}
                                {ch.consecutive_failures > 0 && (
                                    <span className="text-red-500">연속실패 {ch.consecutive_failures}회</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
