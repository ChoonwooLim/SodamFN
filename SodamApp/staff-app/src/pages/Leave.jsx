import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Calendar, Loader2, Trash2, AlertCircle } from 'lucide-react';
import api from '../api';

const LEAVE_TYPES = ['연차', '반차(오전)', '반차(오후)', '병가', '경조사', '특별휴가'];

const STATUS_BADGE = {
    '대기': { label: '대기', className: 'badge badge-warning' },
    '승인': { label: '승인', className: 'badge badge-success' },
    '반려': { label: '반려', className: 'badge badge-danger' },
    '취소': { label: '취소', className: 'badge badge-neutral' },
};

function calcDays(leaveType, startDate, endDate) {
    if (leaveType.startsWith('반차')) return 0.5;
    if (!startDate || !endDate) return 1;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
}

export default function Leave() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [scaleBlocked, setScaleBlocked] = useState(false);
    const [balance, setBalance] = useState(null);
    const [requests, setRequests] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        leave_type: '연차',
        start_date: '',
        end_date: '',
        days: 1,
        reason: '',
    });

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/hr/leave/my');
            setBalance(res.data.balance);
            setRequests(res.data.requests || []);
            setScaleBlocked(false);
        } catch (err) {
            if (err?.response?.status === 403) setScaleBlocked(true);
            else console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate(`/login${window.location.search}`); return; }
        fetchData();
    }, [navigate, fetchData]);

    // 휴가유형/기간 변경 시 일수 자동 갱신
    useEffect(() => {
        setForm((prev) => ({ ...prev, days: calcDays(prev.leave_type, prev.start_date, prev.end_date) }));
    }, [form.leave_type, form.start_date, form.end_date]);

    const remaining = useMemo(() => {
        if (!balance) return 0;
        return Math.max(0, (balance.total_annual || 0) - (balance.used_annual || 0));
    }, [balance]);

    const progressPct = useMemo(() => {
        if (!balance || !balance.total_annual) return 0;
        return Math.min(100, Math.round(((balance.used_annual || 0) / balance.total_annual) * 100));
    }, [balance]);

    const handleSubmit = async () => {
        if (!form.start_date || !form.end_date) {
            alert('시작일과 종료일을 입력해주세요.');
            return;
        }
        setSubmitting(true);
        try {
            await api.post('/hr/leave/my/request', form);
            setShowForm(false);
            setForm({ leave_type: '연차', start_date: '', end_date: '', days: 1, reason: '' });
            await fetchData();
        } catch (err) {
            alert(err?.response?.data?.detail || '신청 실패');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async (reqId) => {
        if (!window.confirm('이 신청을 취소하시겠습니까?')) return;
        try {
            await api.delete(`/hr/leave/my/request/${reqId}`);
            await fetchData();
        } catch (err) {
            alert(err?.response?.data?.detail || '취소 실패');
        }
    };

    if (loading) {
        return (
            <div className="page animate-fade" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <Loader2 className="animate-spin" size={28} style={{ color: 'var(--primary)' }} />
            </div>
        );
    }

    if (scaleBlocked) {
        return (
            <div className="page animate-fade">
                <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => navigate(-1)} className="btn-ghost btn-circle" style={{ padding: '8px' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="page-title">연차/휴가</h1>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
                    <AlertCircle size={40} style={{ color: 'var(--warning)', margin: '0 auto 12px' }} />
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>5인 미만 사업장</div>
                    <div className="text-sm text-muted">연차 기능은 5인 이상 사업장에서 제공됩니다.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page animate-fade">
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => navigate(-1)} className="btn-ghost btn-circle" style={{ padding: '8px' }}>
                    <ArrowLeft size={20} />
                </button>
                <h1 className="page-title">연차/휴가</h1>
            </div>

            {/* 잔여 연차 카드 */}
            <div className="card card-gradient-dark mb-4" style={{ padding: '24px', color: 'white' }}>
                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '4px' }}>올해 잔여 연차</div>
                <div style={{ fontSize: '2.4rem', fontWeight: 700, lineHeight: 1.1 }}>
                    {remaining.toFixed(1)}<span style={{ fontSize: '1rem', fontWeight: 500, marginLeft: '4px', opacity: 0.85 }}>일</span>
                </div>
                <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--radius-full)', height: '8px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${progressPct}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--accent), var(--primary-light))',
                        transition: 'width 300ms ease',
                    }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', opacity: 0.9, marginTop: '8px' }}>
                    <span>사용 {(balance?.used_annual || 0).toFixed(1)}일</span>
                    <span>총 {(balance?.total_annual || 0).toFixed(1)}일</span>
                </div>
            </div>

            {/* 신청 버튼 */}
            <button
                className="btn btn-primary btn-block mb-4"
                onClick={() => setShowForm(true)}
                style={{ gap: '6px' }}
            >
                <Plus size={18} /> 휴가 신청
            </button>

            {/* 신청 이력 */}
            <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', paddingLeft: '4px', color: 'var(--text-secondary)' }}>
                신청 이력
            </div>
            {requests.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    <Calendar size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    <div className="text-sm">아직 신청 내역이 없습니다.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {requests.map((r) => {
                        const badge = STATUS_BADGE[r.status] || STATUS_BADGE['대기'];
                        return (
                            <div key={r.id} className="card" style={{ padding: '14px 16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <div style={{ fontWeight: 600 }}>{r.leave_type}</div>
                                    <span className={badge.className}>{badge.label}</span>
                                </div>
                                <div className="text-sm text-muted" style={{ marginBottom: '4px' }}>
                                    {r.start_date} ~ {r.end_date} · {r.days}일
                                </div>
                                {r.reason && (
                                    <div className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                        {r.reason}
                                    </div>
                                )}
                                {r.status === '반려' && r.reject_reason && (
                                    <div className="text-sm" style={{ color: 'var(--danger)', marginTop: '4px' }}>
                                        반려 사유: {r.reject_reason}
                                    </div>
                                )}
                                {r.status === '대기' && (
                                    <button
                                        className="btn btn-ghost"
                                        style={{ padding: '6px 10px', fontSize: '0.85rem', color: 'var(--danger)', marginTop: '8px' }}
                                        onClick={() => handleCancel(r.id)}
                                    >
                                        <Trash2 size={14} /> 취소
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 신청 모달 */}
            {showForm && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50,
                    }}
                    onClick={() => !submitting && setShowForm(false)}
                >
                    <div
                        className="card"
                        style={{
                            width: '100%', maxWidth: '480px', padding: '20px',
                            borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)',
                            borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                            animation: 'slideUp 250ms cubic-bezier(0.34,1.56,0.64,1)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>휴가 신청</div>
                            <button className="btn-ghost btn-circle" style={{ padding: '6px' }} onClick={() => setShowForm(false)} disabled={submitting}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: '4px' }}>휴가 유형</label>
                                <select
                                    value={form.leave_type}
                                    onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                                    style={inputStyle}
                                >
                                    {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label className="text-xs text-muted" style={{ display: 'block', marginBottom: '4px' }}>시작일</label>
                                    <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} style={inputStyle} />
                                </div>
                                <div>
                                    <label className="text-xs text-muted" style={{ display: 'block', marginBottom: '4px' }}>종료일</label>
                                    <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} style={inputStyle} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: '4px' }}>사용 일수 (자동)</label>
                                <input
                                    type="number" step="0.5" min="0.5"
                                    value={form.days}
                                    onChange={(e) => setForm({ ...form, days: parseFloat(e.target.value) || 0 })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: '4px' }}>사유 (선택)</label>
                                <textarea
                                    rows={2}
                                    value={form.reason}
                                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                    placeholder="휴가 사유를 입력해주세요"
                                    style={{ ...inputStyle, resize: 'none' }}
                                />
                            </div>
                        </div>

                        <button
                            className="btn btn-primary btn-block mt-4"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? <Loader2 className="animate-spin" size={16} /> : null} 신청하기
                        </button>
                        <div className="text-xs text-muted text-center mt-2">
                            신청 후 관리자 승인이 필요합니다.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.95rem',
    background: 'white',
    outline: 'none',
};
