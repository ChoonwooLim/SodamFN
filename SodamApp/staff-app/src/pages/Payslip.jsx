import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Wallet, Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export default function Payslip() {
    const navigate = useNavigate();
    const [staffId, setStaffId] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const payload = JSON.parse(atob(token.split('.')[1]));
        setStaffId(payload.staff_id);
    }, [navigate]);

    useEffect(() => {
        if (!staffId || !month) return;
        setLoading(true);
        api.get(`/hr/attendance/monthly-summary/${staffId}/${month}`)
            .then(res => {
                if (res.data.status === 'success') {
                    setSummary(res.data.data);
                } else {
                    setSummary(null);
                }
            })
            .catch(() => setSummary(null))
            .finally(() => setLoading(false));
    }, [staffId, month]);

    const changeMonth = (delta) => {
        const [y, m] = month.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    const formatMonth = (m) => {
        const [y, mo] = m.split('-');
        return `${y}년 ${parseInt(mo)}월`;
    };

    return (
        <div className="page animate-fade">
            <div className="page-header">
                <h1 className="page-title">급여명세서</h1>
            </div>

            {/* Month Selector */}
            <div className="card mb-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button className="btn-ghost" onClick={() => changeMonth(-1)} style={{ padding: '8px' }}>
                    <ChevronLeft size={20} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} color="var(--primary)" />
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatMonth(month)}</span>
                </div>
                <button className="btn-ghost" onClick={() => changeMonth(1)} style={{ padding: '8px' }}>
                    <ChevronRight size={20} />
                </button>
            </div>

            {loading ? (
                <div className="page-loading" style={{ minHeight: '200px' }}>
                    <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--primary)' }} />
                </div>
            ) : !summary ? (
                <div className="empty-state">
                    <Wallet size={48} className="empty-state-icon" />
                    <span className="empty-state-text">해당 월의 급여 정보가 없습니다</span>
                </div>
            ) : (
                <>
                    {/* Summary Card */}
                    <div className="card card-gradient-accent mb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Wallet size={20} />
                            <span style={{ fontWeight: 700, fontSize: '1rem' }}>예상 지급액</span>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800 }}>
                            {summary.estimated_base_pay?.toLocaleString()}원
                        </div>
                    </div>

                    {/* Details */}
                    <div className="card">
                        <div className="section-title mb-2">📊 상세 내역</div>

                        <div className="payslip-row">
                            <span className="payslip-label">총 근무일</span>
                            <span className="payslip-value">{summary.total_work_days}일</span>
                        </div>
                        <div className="payslip-row">
                            <span className="payslip-label">총 근무시간</span>
                            <span className="payslip-value">{summary.total_hours}시간</span>
                        </div>
                        <div className="payslip-row">
                            <span className="payslip-label">GPS 인증율</span>
                            <span className="payslip-value" style={{ color: summary.verified_ratio >= 80 ? '#059669' : '#f59e0b' }}>
                                {summary.verified_ratio}%
                            </span>
                        </div>

                        <div style={{ borderTop: '2px solid var(--border)', marginTop: '12px', paddingTop: '12px' }}>
                            <div className="payslip-row">
                                <span className="payslip-label" style={{ fontWeight: 700 }}>예상 기본급</span>
                                <span className="payslip-total">
                                    {summary.estimated_base_pay?.toLocaleString()}원
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="card mt-4" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                        <p style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: '1.6' }}>
                            ⚠️ 실제 급여는 주휴수당, 야간근무, 공제 항목 등에 따라 달라질 수 있습니다.
                            정확한 급여명세서는 급여 지급일에 별도로 발송됩니다.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
