import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
    Clock, MapPin, ShieldCheck, Shield, Coffee, LogOut as LogOutIcon,
    Loader2, ShieldX, AlertTriangle, Timer, Wallet, Calendar
} from 'lucide-react';

export default function Attendance() {
    const navigate = useNavigate();
    const [staffId, setStaffId] = useState(null);
    const [status, setStatus] = useState({ checked_in: false, checked_out: false });
    const [history, setHistory] = useState([]);
    const [monthlySummary, setMonthlySummary] = useState(null);
    const [loading, setLoading] = useState(true);

    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsError, setGpsError] = useState(null);
    const [gpsResult, setGpsResult] = useState(null);

    const fetchData = useCallback(async (sid) => {
        try {
            const now = new Date();
            const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const [sRes, hRes, mRes] = await Promise.allSettled([
                api.get(`/hr/attendance/status/${sid}`),
                api.get(`/hr/attendance/history/${sid}`),
                api.get(`/hr/attendance/monthly-summary/${sid}/${m}`),
            ]);
            if (sRes.status === 'fulfilled') setStatus(sRes.value.data.data);
            if (hRes.status === 'fulfilled') setHistory(hRes.value.data.data);
            if (mRes.status === 'fulfilled' && mRes.value.data.status === 'success')
                setMonthlySummary(mRes.value.data.data);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const payload = JSON.parse(atob(token.split('.')[1]));
        setStaffId(payload.staff_id);
        if (payload.staff_id) {
            fetchData(payload.staff_id).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [navigate, fetchData]);

    const getPosition = useCallback(() => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) { reject(new Error('GPS 미지원')); return; }
            navigator.geolocation.getCurrentPosition(
                (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
                (err) => {
                    const m = { 1: '위치 권한 거부', 2: '위치 사용 불가', 3: '시간 초과' };
                    reject(new Error(m[err.code] || '위치 오류'));
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    }, []);

    const handleAttendance = async (action) => {
        setGpsLoading(true);
        setGpsError(null);
        setGpsResult(null);
        try {
            const coords = await getPosition();
            const res = await api.post('/hr/attendance', {
                staff_id: staffId, action, latitude: coords.lat, longitude: coords.lng,
            });
            if (res.data.status === 'error') {
                setGpsError(res.data.message);
                setGpsResult(res.data.gps || null);
                return;
            }
            setGpsResult(res.data.gps);
            await fetchData(staffId);
        } catch (e) {
            setGpsError(e.message || '처리 중 오류');
        } finally {
            setGpsLoading(false);
        }
    };

    if (loading) return <div className="page-loading"><div className="spinner" /><span className="text-muted text-sm">로딩 중...</span></div>;

    const canCheckin = !status.checked_in;
    const canCheckout = status.checked_in && !status.checked_out;
    const allDone = status.checked_in && status.checked_out;

    return (
        <div className="page animate-fade">
            <div className="page-header">
                <h1 className="page-title">출퇴근</h1>
                <span className="badge badge-info">
                    <MapPin size={12} /> GPS 인증
                </span>
            </div>

            {/* GPS Banner */}
            {(gpsLoading || gpsError || gpsResult) && (
                <div className={`status-banner ${gpsLoading ? 'loading' : gpsError ? 'error' : gpsResult?.verified ? 'success' : 'warning'}`}>
                    <div className="status-banner-icon">
                        {gpsLoading ? <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} /> :
                            gpsError ? <ShieldX size={20} /> :
                                gpsResult?.verified ? <ShieldCheck size={20} /> :
                                    <AlertTriangle size={20} />}
                    </div>
                    <div className="status-banner-text">
                        <h4>{gpsLoading ? '위치 확인 중...' : gpsError ? '인증 실패' : gpsResult?.verified ? 'GPS 인증 완료' : '범위 밖'}</h4>
                        <p>{gpsLoading ? '' : gpsError || (gpsResult?.verified ? `${gpsResult.location_name} (${gpsResult.distance}m)` : gpsResult?.message)}</p>
                    </div>
                </div>
            )}

            {/* Attendance Buttons */}
            <div className="flex gap-3 mb-6">
                <button
                    className="btn btn-primary btn-block btn-lg"
                    onClick={() => handleAttendance('checkin')}
                    disabled={!canCheckin || gpsLoading}
                    style={{ flex: 1 }}
                >
                    {gpsLoading && canCheckin ? <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Coffee size={20} />}
                    출근
                    {status.check_in_time && <span className="text-xs" style={{ opacity: 0.7 }}>{status.check_in_time.substring(0, 5)}</span>}
                </button>
                <button
                    className="btn btn-block btn-lg"
                    onClick={() => handleAttendance('checkout')}
                    disabled={!canCheckout || gpsLoading}
                    style={{ flex: 1, background: canCheckout ? '#f97316' : '#d1d5db', color: 'white', boxShadow: canCheckout ? '0 4px 14px rgba(249,115,22,0.3)' : 'none' }}
                >
                    {gpsLoading && canCheckout ? <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} /> : <LogOutIcon size={20} />}
                    퇴근
                    {status.check_out_time && <span className="text-xs" style={{ opacity: 0.7 }}>{status.check_out_time.substring(0, 5)}</span>}
                </button>
            </div>

            {/* Monthly Stats */}
            {monthlySummary && (
                <div className="card card-gradient-dark mb-4">
                    <div className="section-title" style={{ color: 'white', marginBottom: '12px' }}>
                        <Timer size={16} /> 이번 달 통계
                    </div>
                    <div className="stat-row stat-row-glass">
                        <span className="stat-label">근무일</span>
                        <span className="stat-value">{monthlySummary.total_work_days}일</span>
                    </div>
                    <div className="stat-row stat-row-glass" style={{ marginTop: '6px' }}>
                        <span className="stat-label">근무시간</span>
                        <span className="stat-value">{monthlySummary.total_hours}시간</span>
                    </div>
                    <div className="stat-row stat-row-glass" style={{ marginTop: '6px' }}>
                        <span className="stat-label">GPS 인증율</span>
                        <span className="stat-value" style={{ color: monthlySummary.verified_ratio >= 80 ? '#6ee7b7' : '#fbbf24' }}>
                            {monthlySummary.verified_ratio}%
                        </span>
                    </div>
                    <div className="stat-row stat-highlight" style={{ marginTop: '6px' }}>
                        <span className="stat-label"><Wallet size={14} /> 예상 급여</span>
                        <span className="stat-value" style={{ color: '#6ee7b7' }}>{monthlySummary.estimated_base_pay?.toLocaleString()}원</span>
                    </div>
                </div>
            )}

            {/* History */}
            <div className="section-header">
                <span className="section-title"><Calendar size={16} /> 최근 근무 기록</span>
            </div>
            <div className="card" style={{ padding: '8px 16px' }}>
                {history.length === 0 ? (
                    <div className="empty-state" style={{ padding: '32px 0' }}>
                        <Clock size={32} className="empty-state-icon" />
                        <span className="empty-state-text">근무 기록이 없습니다</span>
                    </div>
                ) : (
                    history.map((r) => (
                        <div key={r.id} className="timeline-item">
                            <div className="timeline-dot" style={{ background: r.status === 'Normal' ? '#059669' : '#ef4444' }} />
                            <div className="timeline-content">
                                <div className="timeline-date">{new Date(r.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}</div>
                                <div className="timeline-detail">
                                    출근 {r.check_in?.substring(0, 5) || '-'} → 퇴근 {r.check_out?.substring(0, 5) || '-'}
                                    {r.total_hours > 0 && ` | ${r.total_hours}h`}
                                </div>
                            </div>
                            <div className="timeline-badge">
                                {r.check_in_verified ? (
                                    <span className="badge badge-success"><ShieldCheck size={12} /> 인증</span>
                                ) : (
                                    <span className="badge badge-neutral"><Shield size={12} /> 미인증</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
