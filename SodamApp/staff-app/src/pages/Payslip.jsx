import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Wallet, Calendar, ChevronLeft, ChevronRight, Loader2, Download, Briefcase, TrendingDown, CreditCard, Award } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export default function Payslip() {
    const navigate = useNavigate();
    const [staffId, setStaffId] = useState(null);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState('');
    const [summary, setSummary] = useState(null);
    const [payroll, setPayroll] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [month, setMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const payload = JSON.parse(atob(token.split('.')[1]));
        setStaffId(payload.staff_id);
        setUserName(payload.real_name || '');
        setUserRole(payload.role || '');
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

    const handleDownload = async () => {
        if (!payroll || downloading) return;
        setDownloading(true);

        try {
            const fmtMonth = formatMonth(month);
            const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

            // Build earnings rows
            const earningsRows = (payroll.work_breakdown || []).map(w =>
                `<tr style="height:36px;border-bottom:1px solid #cbd5e1">
                    <td style="padding:4px 10px;border-right:2px solid #1e293b;font-weight:700;font-size:11px">기본급</td>
                    <td style="padding:4px 10px;text-align:right;font-weight:700;font-size:13px">${fmt(w.amount)}</td>
                </tr>`
            ).join('');

            const fallbackEarnings = earningsRows || `<tr style="height:36px;border-bottom:2px solid #1e293b">
                <td style="padding:4px 10px;border-right:2px solid #1e293b;font-weight:700">기본급</td>
                <td style="padding:4px 10px;text-align:right;font-weight:700">${fmt(payroll.base_pay)}</td>
            </tr>`;

            // Holiday pay rows
            let holidaySection = '';
            const holidayPay = payroll.holiday_pay || payroll.bonus_holiday || 0;
            if (holidayPay > 0) {
                let weekRows = '';
                [1, 2, 3, 4, 5].forEach(w => {
                    const amt = payroll[`holiday_w${w}`];
                    if (amt > 0) {
                        weekRows += `<tr style="height:32px;border-bottom:1px solid #cbd5e1">
                            <td style="padding:4px 10px;border-right:2px solid #1e293b;font-weight:600;color:#475569;font-size:11px">${w}주차</td>
                            <td style="padding:4px 10px;text-align:right;font-weight:700;font-size:12px">${fmt(amt)}</td>
                        </tr>`;
                    }
                });
                holidaySection = `
                    <tr style="height:28px;border-bottom:2px solid #1e293b;background:#eef2ff">
                        <td colspan="2" style="padding:4px 10px;font-weight:900;font-size:10px;color:#312e81">주휴수당 (Holiday Pay)</td>
                    </tr>
                    ${weekRows}
                    <tr style="height:32px;border-bottom:2px solid #1e293b;background:#f1f5f9">
                        <td style="padding:4px 10px;border-right:2px solid #1e293b;font-weight:900;text-align:right;padding-right:16px;font-style:italic;font-size:11px">주휴수당 합계</td>
                        <td style="padding:4px 10px;text-align:right;font-weight:900;font-size:12px">${fmt(holidayPay)}</td>
                    </tr>`;
            }

            // Deduction rows
            const deductions = [
                { label: '국민연금', val: payroll.deduction_np },
                { label: '건강보험', val: payroll.deduction_hi },
                { label: '고용보험', val: payroll.deduction_ei },
                { label: '장기요양보험', val: payroll.deduction_lti },
                { label: '소득세', val: payroll.deduction_it },
                { label: '지방소득세', val: payroll.deduction_lit },
            ];
            const deductionRows = deductions.map(d =>
                `<tr style="height:36px;border-bottom:2px solid #1e293b">
                    <td style="padding:4px 10px;border-right:2px solid #1e293b;font-weight:700;font-size:11px">${d.label}</td>
                    <td style="padding:4px 10px;text-align:right;font-weight:700;color:#475569">${d.val > 0 ? fmt(d.val) : '-'}</td>
                </tr>`
            ).join('');

            const grossPay = payroll.gross_pay || ((payroll.base_pay || 0) + (payroll.bonus || 0));
            const totalDeductions = payroll.total_deductions || payroll.deductions || 0;
            const netPay = payroll.net_pay || payroll.total_pay || 0;
            const bankInfo = payroll.bank_name
                ? `${payroll.bank_name} ${payroll.account_number || ''} ${payroll.account_holder || ''}`
                : (payroll.bank_account || '기록 없음');

            // Build the A4 HTML document
            const html = `
            <div id="payslip-pdf-root" style="width:794px;height:1123px;padding:45px;background:white;font-family:'Malgun Gothic','맑은 고딕',sans-serif;color:#0f172a;box-sizing:border-box;position:relative">
                <!-- Title -->
                <div style="text-align:center;margin-bottom:20px;padding-top:4px">
                    <h1 style="font-size:22px;font-weight:900;letter-spacing:-0.5px;border-bottom:3px double #1e293b;padding-bottom:2px;display:inline-block;padding-left:32px;padding-right:32px;margin:0">
                        ${fmtMonth} 급여 지급 명세서
                    </h1>
                </div>

                <!-- Staff Info -->
                <table style="width:100%;border:2px solid #1e293b;border-collapse:collapse;margin-bottom:16px;font-size:12px">
                    <tr style="height:40px">
                        <td style="width:100px;background:#f1f5f9;font-weight:700;text-align:center;border:1px solid #1e293b;font-size:12px">성 명</td>
                        <td style="padding:4px 20px;border:1px solid #1e293b;font-size:17px;font-weight:900;letter-spacing:4px">${userName}</td>
                        <td style="width:100px;background:#f1f5f9;font-weight:700;text-align:center;border:1px solid #1e293b;font-size:12px">직 위</td>
                        <td style="padding:4px 20px;border:1px solid #1e293b;font-size:17px;font-weight:700">${userRole}</td>
                    </tr>
                </table>

                <!-- Main Content: Earnings / Deductions -->
                <div style="display:flex;border-left:2px solid #1e293b;border-right:2px solid #1e293b;border-bottom:2px solid #1e293b;margin-bottom:24px">
                    <!-- Earnings (60%) -->
                    <div style="width:60%;border-right:2px solid #1e293b">
                        <div style="background:#1e293b;color:white;font-weight:700;text-align:center;padding:6px 0;font-size:11px;letter-spacing:2px">지급 항목 (EARNINGS)</div>
                        <table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed">
                            <thead>
                                <tr style="background:#f1f5f9;height:32px;border-bottom:1px solid #1e293b">
                                    <th style="border-right:2px solid #1e293b;padding:4px 10px;font-weight:700;width:70%;text-align:center">항 목</th>
                                    <th style="padding:4px 10px;font-weight:700;text-align:center">금 액 (원)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${fallbackEarnings}
                                ${holidaySection}
                            </tbody>
                        </table>
                    </div>
                    <!-- Deductions (40%) -->
                    <div style="width:40%">
                        <div style="background:#1e293b;color:white;font-weight:700;text-align:center;padding:6px 0;font-size:11px;letter-spacing:2px">공제 항목 (DEDUCTIONS)</div>
                        <table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed">
                            <thead>
                                <tr style="background:#f1f5f9;height:32px;border-bottom:1px solid #1e293b">
                                    <th style="border-right:2px solid #1e293b;padding:4px 10px;font-weight:700;width:60%;text-align:center">항 목</th>
                                    <th style="padding:4px 10px;font-weight:700;text-align:center">금 액 (원)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${deductionRows}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Summary Footer -->
                <table style="width:100%;border:4px solid #1e293b;border-collapse:collapse;margin-bottom:16px">
                    <tr style="height:36px;font-size:12px">
                        <td style="width:25%;background:#f1f5f9;font-weight:900;border:2px solid #1e293b;text-align:center">지급총액 (A)</td>
                        <td style="width:25%;border:2px solid #1e293b;text-align:center;font-weight:900;font-size:15px">${fmt(grossPay)}</td>
                        <td style="width:25%;background:#f1f5f9;font-weight:900;border:2px solid #1e293b;text-align:center">공제총액 (B)</td>
                        <td style="width:25%;border:2px solid #1e293b;text-align:center;font-weight:900;font-size:15px;color:#dc2626">${fmt(totalDeductions)}</td>
                    </tr>
                    <tr style="height:56px;background:#0f172a;color:white">
                        <td style="width:25%;font-weight:900;border:2px solid #1e293b;text-align:center;font-size:11px;line-height:1.3">실 수령액<br/>(NET PAY)</td>
                        <td colspan="3" style="border:2px solid #1e293b;text-align:center">
                            <div style="font-size:22px;font-weight:900;letter-spacing:3px;margin-bottom:2px">₩ ${fmt(netPay)}</div>
                            <div style="font-size:9px;font-weight:500;opacity:0.6;letter-spacing:2px">(A - B = 차감 지급액)</div>
                        </td>
                    </tr>
                    <tr style="height:36px;font-size:12px">
                        <td style="width:25%;background:#f1f5f9;font-weight:700;border:2px solid #1e293b;text-align:center">급여 수령 계좌</td>
                        <td colspan="3" style="padding:4px 32px;border:2px solid #1e293b;font-size:15px;font-weight:900;color:#1e293b;letter-spacing:1px">${bankInfo}</td>
                    </tr>
                </table>

                <!-- Signature -->
                <div style="text-align:center;border-top:2px solid #e2e8f0;padding-top:16px;padding-bottom:8px;position:absolute;bottom:45px;left:45px;right:45px">
                    <p style="font-size:19px;font-weight:700;color:#1e293b;margin:0 0 8px">위와 같이 급여를 지급합니다.</p>
                    <p style="font-size:13px;color:#64748b;margin:0 0 16px;font-style:italic">${todayStr}</p>
                    <div style="display:flex;justify-content:center;align-items:center;gap:40px">
                        <span style="font-size:17px;font-weight:900;letter-spacing:6px;color:#1e293b">소담김밥 대표</span>
                        <div style="position:relative;display:inline-block">
                            <span style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:4px">HONG JI YEON</span>
                            <div style="position:absolute;top:-16px;right:-48px;width:40px;height:40px;border:3px solid #ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#dc2626;font-weight:900;font-size:12px;transform:rotate(12deg);background:rgba(255,255,255,0.1)">
                                (인)
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

            // Create a hidden container and render the HTML
            const container = document.createElement('div');
            container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
            container.innerHTML = html;
            document.body.appendChild(container);

            const el = container.querySelector('#payslip-pdf-root');

            // Capture to canvas
            const canvas = await html2canvas(el, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: 794,
                height: 1123,
            });

            // Generate PDF
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
            pdf.save(`급여명세서_${month}.pdf`);

            // Cleanup
            document.body.removeChild(container);
        } catch (err) {
            console.error('PDF generation failed:', err);
            alert('PDF 생성에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setDownloading(false);
        }
    };

    const hasPayroll = !!payroll;
    const displayPay = hasPayroll ? payroll.net_pay : summary?.estimated_base_pay;

    return (
        <div className="page animate-fade" style={{ paddingBottom: '100px' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="page-title">급여명세서</h1>
                {hasPayroll && (
                    <button onClick={handleDownload} disabled={downloading} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.75rem', minHeight: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {downloading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Download size={14} />}
                        {downloading ? '생성 중...' : 'PDF'}
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
