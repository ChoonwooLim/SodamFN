import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Wallet, Calendar, ChevronLeft, ChevronRight, Loader2, Download, Briefcase, TrendingDown, CreditCard, Award } from 'lucide-react';

export default function Payslip() {
    const navigate = useNavigate();
    const [staffId, setStaffId] = useState(null);
    const [summary, setSummary] = useState(null);
    const [payroll, setPayroll] = useState(null);
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
        Promise.all([
            api.get(`/hr/attendance/monthly-summary/${staffId}/${month}`).catch(() => null),
            api.get(`/payroll/staff/${staffId}/${month}`).catch(() => null),
        ]).then(([sumRes, payRes]) => {
            setSummary(sumRes?.data?.status === 'success' ? sumRes.data.data : null);
            setPayroll(payRes?.data?.status === 'success' ? payRes.data.data : null);
        }).finally(() => setLoading(false));
    }, [staffId, month]);

    const changeMonth = (delta) => {
        const [y, m] = month.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    const formatMonth = (m) => { const [y, mo] = m.split('-'); return `${y}년 ${parseInt(mo)}월`; };
    const fmt = (n) => (n || 0).toLocaleString();

    const handleDownload = () => {
        const data = payroll || summary;
        if (!data) return;
        const lines = [];
        lines.push(`${formatMonth(month)} 급여명세서`);
        lines.push('');
        if (payroll) {
            lines.push(`[지급 항목]`);
            (payroll.work_breakdown || []).forEach(w => {
                lines.push(`  ${w.label}: ${fmt(w.amount)}원 (${w.dates})`);
            });
            lines.push(`  기본급 합계: ${fmt(payroll.base_pay)}원`);
            lines.push('');
            lines.push(`[주휴수당]`);
            [payroll.holiday_w1, payroll.holiday_w2, payroll.holiday_w3, payroll.holiday_w4, payroll.holiday_w5].forEach((w, i) => {
                if (w) lines.push(`  ${i + 1}주차: ${fmt(w)}원`);
            });
            lines.push(`  주휴수당 합계: ${fmt(payroll.holiday_pay)}원`);
            lines.push('');
            lines.push(`[공제 항목]`);
            if (payroll.deduction_np) lines.push(`  국민연금: ${fmt(payroll.deduction_np)}원`);
            if (payroll.deduction_hi) lines.push(`  건강보험: ${fmt(payroll.deduction_hi)}원`);
            if (payroll.deduction_ei) lines.push(`  고용보험: ${fmt(payroll.deduction_ei)}원`);
            if (payroll.deduction_lti) lines.push(`  장기요양보험: ${fmt(payroll.deduction_lti)}원`);
            if (payroll.deduction_it) lines.push(`  소득세: ${fmt(payroll.deduction_it)}원`);
            if (payroll.deduction_lit) lines.push(`  지방소득세: ${fmt(payroll.deduction_lit)}원`);
            lines.push(`  공제 합계: ${fmt(payroll.total_deductions)}원`);
            lines.push('');
            lines.push(`지급총액: ${fmt(payroll.gross_pay)}원`);
            lines.push(`공제총액: ${fmt(payroll.total_deductions)}원`);
            lines.push(`실 수령액: ${fmt(payroll.net_pay)}원`);
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `급여명세서_${month}.txt`; a.click();
        URL.revokeObjectURL(url);
    };

    const hasPayroll = !!payroll;
    const displayPay = hasPayroll ? payroll.net_pay : summary?.estimated_base_pay;

    return (
        <div className="page animate-fade" style={{ paddingBottom: '100px' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="page-title">급여명세서</h1>
                {(hasPayroll || summary) && (
                    <button onClick={handleDownload} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Download size={14} /> 다운로드
                    </button>
                )}
            </div>

            {/* Month Selector */}
            <div className="card mb-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button className="btn-ghost" onClick={() => changeMonth(-1)} style={{ padding: '8px' }}><ChevronLeft size={20} /></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} color="var(--primary)" />
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatMonth(month)}</span>
                </div>
                <button className="btn-ghost" onClick={() => changeMonth(1)} style={{ padding: '8px' }}><ChevronRight size={20} /></button>
            </div>

            {loading ? (
                <div className="page-loading" style={{ minHeight: '200px' }}>
                    <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--primary)' }} />
                </div>
            ) : !summary && !payroll ? (
                <div className="empty-state">
                    <Wallet size={48} className="empty-state-icon" />
                    <span className="empty-state-text">해당 월의 급여 정보가 없습니다</span>
                </div>
            ) : (
                <>
                    {/* Total Pay Card */}
                    <div className="card card-gradient-accent mb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Wallet size={20} />
                            <span style={{ fontWeight: 700, fontSize: '1rem' }}>{hasPayroll ? '실 수령액' : '예상 지급액'}</span>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800 }}>
                            {fmt(displayPay)}원
                        </div>
                        {hasPayroll && (
                            <div style={{ fontSize: '0.75rem', marginTop: '8px', opacity: 0.8 }}>
                                지급총액 {fmt(payroll.gross_pay)}원 - 공제 {fmt(payroll.total_deductions)}원
                            </div>
                        )}
                    </div>

                    {/* DETAILED PAYROLL */}
                    {hasPayroll ? (
                        <>
                            {/* Earnings Breakdown */}
                            <div className="card mb-4">
                                <div className="section-title mb-3" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Briefcase size={16} color="#059669" /> 지급 항목
                                </div>
                                {(payroll.work_breakdown || []).map((w, i) => (
                                    <div key={i}>
                                        <div className="payslip-row">
                                            <div>
                                                <span className="payslip-label" style={{ fontWeight: 600 }}>
                                                    근무시간 : {w.hours}시간
                                                </span>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                                                    ({fmt(w.rate)}원 × {w.hours}H × {w.days}D)
                                                </div>
                                            </div>
                                            <span className="payslip-value">{fmt(w.amount)}원</span>
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: '#cbd5e1', padding: '0 0 8px', borderBottom: '1px solid #f1f5f9' }}>
                                            {w.dates}
                                        </div>
                                    </div>
                                ))}
                                <div className="payslip-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '2px solid var(--border)' }}>
                                    <span className="payslip-label" style={{ fontWeight: 700 }}>기본급 합계</span>
                                    <span className="payslip-total">{fmt(payroll.base_pay)}원</span>
                                </div>
                            </div>

                            {/* Holiday Pay */}
                            {(payroll.holiday_pay || 0) > 0 && (
                                <div className="card mb-4">
                                    <div className="section-title mb-3" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Award size={16} color="#4f46e5" /> 주휴수당
                                    </div>
                                    {[payroll.holiday_w1, payroll.holiday_w2, payroll.holiday_w3, payroll.holiday_w4, payroll.holiday_w5].map((w, i) => (
                                        w ? (
                                            <div key={i} className="payslip-row">
                                                <span className="payslip-label">{i + 1}주차
                                                    {payroll.holiday_details?.[String(i + 1)] && (
                                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '6px' }}>
                                                            ({payroll.holiday_details[String(i + 1)]})
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="payslip-value">{fmt(w)}원</span>
                                            </div>
                                        ) : null
                                    ))}
                                    <div className="payslip-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '2px solid var(--border)' }}>
                                        <span className="payslip-label" style={{ fontWeight: 700 }}>주휴수당 합계</span>
                                        <span className="payslip-total">{fmt(payroll.holiday_pay)}원</span>
                                    </div>
                                </div>
                            )}

                            {/* Deductions */}
                            {(payroll.total_deductions || 0) > 0 && (
                                <div className="card mb-4">
                                    <div className="section-title mb-3" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <TrendingDown size={16} color="#ef4444" /> 공제 항목
                                    </div>
                                    {[
                                        { label: '국민연금', value: payroll.deduction_np },
                                        { label: '건강보험', value: payroll.deduction_hi },
                                        { label: '고용보험', value: payroll.deduction_ei },
                                        { label: '장기요양보험', value: payroll.deduction_lti },
                                        { label: '소득세', value: payroll.deduction_it },
                                        { label: '지방소득세', value: payroll.deduction_lit },
                                    ].filter(d => d.value).map((d, i) => (
                                        <div key={i} className="payslip-row">
                                            <span className="payslip-label">{d.label}</span>
                                            <span className="payslip-value" style={{ color: '#ef4444' }}>-{fmt(d.value)}원</span>
                                        </div>
                                    ))}
                                    <div className="payslip-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '2px solid var(--border)' }}>
                                        <span className="payslip-label" style={{ fontWeight: 700 }}>공제 합계</span>
                                        <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '1rem' }}>-{fmt(payroll.total_deductions)}원</span>
                                    </div>
                                </div>
                            )}

                            {/* Summary */}
                            <div className="card mb-4" style={{ background: '#f8fafc', border: '2px solid #e2e8f0' }}>
                                <div className="payslip-row">
                                    <span className="payslip-label">지급총액 (A)</span>
                                    <span className="payslip-value" style={{ fontWeight: 700 }}>{fmt(payroll.gross_pay)}원</span>
                                </div>
                                <div className="payslip-row">
                                    <span className="payslip-label">공제총액 (B)</span>
                                    <span className="payslip-value" style={{ fontWeight: 700, color: '#ef4444' }}>-{fmt(payroll.total_deductions)}원</span>
                                </div>
                                <div style={{ borderTop: '2px solid #334155', marginTop: '10px', paddingTop: '10px' }}>
                                    <div className="payslip-row">
                                        <span style={{ fontWeight: 800, fontSize: '1rem' }}>실 수령액 (A-B)</span>
                                        <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#059669' }}>₩ {fmt(payroll.net_pay)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Bank Info */}
                            {payroll.bank_name && (
                                <div className="card mb-4">
                                    <div className="section-title mb-2" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <CreditCard size={16} color="#6366f1" /> 급여 수령 계좌
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                                        {payroll.bank_name} {payroll.account_number} {payroll.account_holder}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* BASIC SUMMARY (when no payroll calculated yet) */
                        <>
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
                                        <span className="payslip-total">{fmt(summary.estimated_base_pay)}원</span>
                                    </div>
                                </div>
                            </div>
                            <div className="card mt-4" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                                <p style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: '1.6' }}>
                                    ⚠️ 정확한 급여명세서는 관리자가 급여를 산정한 후에 표시됩니다.
                                </p>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
