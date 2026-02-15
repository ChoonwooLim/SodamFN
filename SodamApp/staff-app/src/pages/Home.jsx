import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
    Clock, FileSignature, FileText, Wallet, MapPin,
    Coffee, LogOut as LogOutIcon, Loader2, ShieldCheck, ShieldX, AlertTriangle, Timer
} from 'lucide-react';

export default function Home() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [staffId, setStaffId] = useState(null);
    const [status, setStatus] = useState({ checked_in: false, checked_out: false });
    const [monthlySummary, setMonthlySummary] = useState(null);
    const [pendingContracts, setPendingContracts] = useState(0);
    const [loading, setLoading] = useState(true);

    // GPS
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsError, setGpsError] = useState(null);
    const [gpsResult, setGpsResult] = useState(null);

    useEffect(() => {
        const init = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) { navigate('/login'); return; }

                const payload = JSON.parse(atob(token.split('.')[1]));
                setUser(payload);
                setStaffId(payload.staff_id);

                if (payload.staff_id) {
                    const [statusRes, summaryRes, contractsRes] = await Promise.allSettled([
                        api.get(`/hr/attendance/status/${payload.staff_id}`),
                        (() => {
                            const now = new Date();
                            const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                            return api.get(`/hr/attendance/monthly-summary/${payload.staff_id}/${m}`);
                        })(),
                        api.get('/contracts/my'),
                    ]);

                    if (statusRes.status === 'fulfilled') setStatus(statusRes.value.data.data);
                    if (summaryRes.status === 'fulfilled' && summaryRes.value.data.status === 'success')
                        setMonthlySummary(summaryRes.value.data.data);
                    if (contractsRes.status === 'fulfilled') {
                        const pending = contractsRes.value.data.data.filter(c => c.status !== 'signed').length;
                        setPendingContracts(pending);
                    }
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        init();
    }, [navigate]);

    const getPosition = useCallback(() => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) { reject(new Error('GPS가 지원되지 않습니다.')); return; }
            navigator.geolocation.getCurrentPosition(
                (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
                (err) => {
                    const msgs = { 1: '위치 권한이 거부되었습니다.', 2: '위치 정보를 사용할 수 없습니다.', 3: '위치 요청 시간 초과' };
                    reject(new Error(msgs[err.code] || '위치 정보를 가져올 수 없습니다.'));
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
            // Refresh status
            const sRes = await api.get(`/hr/attendance/status/${staffId}`);
            setStatus(sRes.data.data);
        } catch (e) {
            setGpsError(e.message || '처리 중 오류가 발생했습니다.');
        } finally {
            setGpsLoading(false);
        }
    };

    if (loading) return <div className="page-loading"><div className="spinner" /><span className="text-muted text-sm">로딩 중...</span></div>;

    const today = new Date().toLocaleDateString('ko-KR', { weekday: 'long', month: 'long', day: 'numeric' });
    const canCheckin = !status.checked_in;
    const canCheckout = status.checked_in && !status.checked_out;
    const allDone = status.checked_in && status.checked_out;

    return (
        <div className="page animate-fade">
            {/* Header */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        안녕하세요, {user?.real_name || '직원'}님 👋
                    </h1>
                    <p className="text-sm text-muted" style={{ marginTop: '4px' }}>{today}</p>
                </div>
                <button
                    onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
                    style={{
                        padding: '8px 12px', color: 'var(--text-muted)', marginTop: '4px',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                        fontSize: '0.75rem'
                    }}
                >
                    <LogOutIcon size={16} />
                </button>
            </div>

            {/* GPS Status Banner */}
            {(gpsLoading || gpsError || gpsResult) && (
                <div className={`status-banner ${gpsLoading ? 'loading' : gpsError ? 'error' : gpsResult?.verified ? 'success' : 'warning'}`}>
                    <div className="status-banner-icon">
                        {gpsLoading ? <Loader2 size={20} className="spinner" style={{ border: 'none', borderTop: 'none' }} /> :
                            gpsError ? <ShieldX size={20} /> :
                                gpsResult?.verified ? <ShieldCheck size={20} /> :
                                    <AlertTriangle size={20} />}
                    </div>
                    <div className="status-banner-text">
                        <h4>{gpsLoading ? '📍 위치 확인 중...' : gpsError ? '❌ 위치 인증 실패' : gpsResult?.verified ? '✅ GPS 인증 완료' : '⚠️ 위치 범위 밖'}</h4>
                        <p>{gpsLoading ? 'GPS 좌표 획득 중' : gpsError || (gpsResult?.verified ? `${gpsResult.location_name} (${gpsResult.distance}m)` : gpsResult?.message)}</p>
                    </div>
                </div>
            )}

            {/* Attendance Button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '32px 0' }}>
                <button
                    className={`attendance-btn ${allDone ? 'done' : canCheckin ? 'checkin' : 'checkout'}`}
                    onClick={() => handleAttendance(canCheckin ? 'checkin' : 'checkout')}
                    disabled={allDone || gpsLoading}
                >
                    {gpsLoading ? (
                        <Loader2 size={32} style={{ animation: 'spin 0.8s linear infinite' }} />
                    ) : allDone ? (
                        <>
                            <ShieldCheck size={32} />
                            <span>근무 완료</span>
                        </>
                    ) : canCheckin ? (
                        <>
                            <Coffee size={32} />
                            <span>출근하기</span>
                        </>
                    ) : (
                        <>
                            <LogOutIcon size={32} />
                            <span>퇴근하기</span>
                        </>
                    )}
                </button>

                {/* Today status */}
                <div className="flex gap-4 mt-3" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {status.check_in_time && (
                        <span className="flex items-center gap-1">
                            <Coffee size={14} /> 출근 {status.check_in_time.substring(0, 5)}
                            {status.check_in_verified && <ShieldCheck size={12} color="#059669" />}
                        </span>
                    )}
                    {status.check_out_time && (
                        <span className="flex items-center gap-1">
                            <LogOutIcon size={14} /> 퇴근 {status.check_out_time.substring(0, 5)}
                            {status.check_out_verified && <ShieldCheck size={12} color="#059669" />}
                        </span>
                    )}
                </div>
            </div>

            {/* Monthly Summary Card */}
            <div className="card card-gradient-dark mb-4">
                <div className="section-header" style={{ marginBottom: '12px' }}>
                    <span className="section-title" style={{ color: 'white' }}>
                        <Timer size={18} /> 이번 달 현황
                    </span>
                </div>
                {monthlySummary ? (
                    <div>
                        <div className="stat-row stat-row-glass">
                            <span className="stat-label">총 근무일</span>
                            <span className="stat-value">{monthlySummary.total_work_days}일</span>
                        </div>
                        <div className="stat-row stat-row-glass" style={{ marginTop: '8px' }}>
                            <span className="stat-label">총 근무시간</span>
                            <span className="stat-value">{monthlySummary.total_hours}시간</span>
                        </div>
                        <div className="stat-row stat-highlight" style={{ marginTop: '8px' }}>
                            <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Wallet size={14} /> 예상 급여
                            </span>
                            <span className="stat-value" style={{ color: '#6ee7b7' }}>
                                {monthlySummary.estimated_base_pay?.toLocaleString()}원
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center" style={{ padding: '24px 0', opacity: 0.5, color: 'white' }}>
                        <Timer size={28} />
                        <p className="text-sm mt-2">근무 기록이 없습니다</p>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="section-header">
                <span className="section-title">
                    <MapPin size={16} /> 바로가기
                </span>
            </div>
            <div className="action-grid">
                <div className="action-card" onClick={() => navigate('/contracts')}>
                    <div className="action-card-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}>
                        <FileSignature size={24} />
                    </div>
                    <span className="action-card-label">전자계약</span>
                    {pendingContracts > 0 && (
                        <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                            {pendingContracts}건 대기
                        </span>
                    )}
                </div>
                <div className="action-card" onClick={() => navigate('/documents')}>
                    <div className="action-card-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                        <FileText size={24} />
                    </div>
                    <span className="action-card-label">서류 제출</span>
                </div>
                <div className="action-card" onClick={() => navigate('/payslip')}>
                    <div className="action-card-icon" style={{ background: '#d1fae5', color: '#059669' }}>
                        <Wallet size={24} />
                    </div>
                    <span className="action-card-label">급여명세서</span>
                </div>
                <div className="action-card" onClick={() => navigate('/attendance')}>
                    <div className="action-card-icon" style={{ background: '#ffe4e6', color: '#e11d48' }}>
                        <Clock size={24} />
                    </div>
                    <span className="action-card-label">근무 기록</span>
                </div>
            </div>
        </div>
    );
}
