import { useState, useMemo } from 'react';
import {
    CreditCard, Printer, MessageSquare, Calculator,
    ChevronDown, CheckCircle, Clock, Building2, AlertCircle,
    BarChart3, TrendingUp, RefreshCw, Calendar
} from 'lucide-react';
import { formatNumber } from '../../utils/format';
import api from '../../api';
import PayrollStatement from '../../components/PayrollStatement';
import AttendanceInput from '../../components/AttendanceInput';

const fmt = (v) => formatNumber(v || 0);

export default function PayrollTab({
    id,
    formData,
    payrolls,
    selectedPayroll,
    setSelectedPayroll,
    handleSendPayrollStatement,
    handleExecuteTransfer,
    fetchStaffDetail,
}) {
    const [expandedPayrollId, setExpandedPayrollId] = useState(null);
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
    const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
    const [sortOrder, setSortOrder] = useState('desc');

    const showTaxSupport = !!formData.tax_support_enabled;

    // ─── Sorted Payrolls ───
    const sortedPayrolls = useMemo(() => {
        return [...payrolls].sort((a, b) => {
            const cmp = (a.month || '').localeCompare(b.month || '');
            return sortOrder === 'desc' ? -cmp : cmp;
        });
    }, [payrolls, sortOrder]);

    // ─── Payroll Summary ───
    const payrollSummary = useMemo(() => {
        const filtered = payrolls.filter(p => p.month?.startsWith(yearFilter));
        const totalBase = filtered.reduce((s, p) => s + (p.base_pay || 0), 0);
        const totalSpecial = filtered.reduce((s, p) => s + (p.bonus_special || 0), 0);
        const totalDeductions = filtered.reduce((s, p) => s + (p.deductions || 0), 0);
        const totalTaxSupport = filtered.reduce((s, p) => s + (p.bonus_tax_support || 0), 0);
        const totalNet = filtered.reduce((s, p) => s + (p.total_pay || 0), 0);
        const count = filtered.length;
        const transferred = filtered.filter(p => p.transfer_status === '완료').length;
        return { totalBase, totalSpecial, totalDeductions, totalTaxSupport, totalNet, count, transferred };
    }, [payrolls, yearFilter]);

    // ─── Previous Month Payroll ───
    const prevMonthPayroll = useMemo(() => {
        const [y, m] = currentMonth.split('-').map(Number);
        const prevDate = new Date(y, m - 2, 1);
        const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        const pay = payrolls.find(p => p.month === prevMonth);
        return pay ? { ...pay, monthLabel: prevMonth } : null;
    }, [payrolls, currentMonth]);

    const availableYears = useMemo(() => {
        const years = new Set();
        payrolls.forEach(p => { if (p.month) years.add(p.month.split('-')[0]); });
        if (years.size === 0) years.add(new Date().getFullYear().toString());
        return [...years].sort().reverse();
    }, [payrolls]);

    const getPayrollDetails = (pay) => {
        try {
            if (pay.details_json) {
                return typeof pay.details_json === 'string' ? JSON.parse(pay.details_json) : pay.details_json;
            }
        } catch { /* ignore */ }
        return { work_breakdown: [], holiday_details: {} };
    };

    const handleSendAttendanceRequest = async () => {
        try {
            const resp = await api.post('/payroll/send-attendance-request', { staff_id: id, month: currentMonth });
            if (resp.data.status === 'success') alert(`${currentMonth} 근무시간 확인 요청을 카카오톡으로 보냈습니다.`);
        } catch (err) {
            alert(err.response?.data?.detail || '카카오톡 전송 실패');
        }
    };

    const handleTogglePaymentStatus = async (payrollId, currentStatus) => {
        const newStatus = currentStatus === '완료' ? '대기' : '완료';
        try {
            await api.put(`/payroll/${payrollId}/status`, { transfer_status: newStatus });
            fetchStaffDetail();
        } catch (err) {
            alert(err.response?.data?.detail || '상태 변경 실패');
        }
    };

    return (
        <>
            {/* ═══ Action Bar ═══ */}
            <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-5">
                <input
                    type="month"
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                    onClick={() => setIsAttendanceOpen(true)}
                    className="flex items-center gap-1.5 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
                >
                    <Calculator size={14} /> 출퇴근/정산
                </button>
                <button
                    onClick={handleSendAttendanceRequest}
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/30 transition-all"
                >
                    <MessageSquare size={14} /> 시급입력 요청
                </button>
            </div>

            {/* ═══ Previous Month Summary ═══ */}
            {prevMonthPayroll ? (
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 mb-5">
                    <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-indigo-500" />
                            <span className="text-sm font-bold text-slate-700">{prevMonthPayroll.monthLabel} 급여 내역</span>
                        </div>
                        <button
                            onClick={() => handleTogglePaymentStatus(prevMonthPayroll.id, prevMonthPayroll.transfer_status)}
                            className="transition-all hover:scale-105 active:scale-95"
                        >
                            {prevMonthPayroll.transfer_status === '완료' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold border border-emerald-200"><CheckCircle size={10} /> 지급완료</span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold border border-amber-200"><Clock size={10} /> 지급대기</span>
                            )}
                        </button>
                    </div>
                    <div className="p-5">
                        {/* Top Row: main amounts */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div className="bg-slate-50 rounded-xl p-4">
                                <div className="text-xs font-bold text-slate-400 mb-1">기본급</div>
                                <div className="text-xl font-black text-slate-800 font-mono">{fmt(prevMonthPayroll.base_pay)}</div>
                            </div>
                            {(prevMonthPayroll.bonus_special || 0) > 0 && (
                                <div className="bg-violet-50 rounded-xl p-4">
                                    <div className="text-xs font-bold text-violet-400 mb-1">특별수당</div>
                                    <div className="text-xl font-black text-violet-600 font-mono">+{fmt(prevMonthPayroll.bonus_special)}</div>
                                </div>
                            )}
                            <div className="bg-red-50/60 rounded-xl p-4">
                                <div className="text-xs font-bold text-red-300 mb-1">공제액</div>
                                <div className="text-xl font-black text-red-500 font-mono">-{fmt(prevMonthPayroll.deductions)}</div>
                            </div>
                            {showTaxSupport && (prevMonthPayroll.bonus_tax_support || 0) > 0 && (
                                <div className="bg-emerald-50 rounded-xl p-4">
                                    <div className="text-xs font-bold text-emerald-400 mb-1">세금대납</div>
                                    <div className="text-xl font-black text-emerald-600 font-mono">+{fmt(prevMonthPayroll.bonus_tax_support)}</div>
                                </div>
                            )}
                        </div>

                        {/* Deduction Breakdown (inline chips) */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {[
                                { label: '국민연금', val: prevMonthPayroll.deduction_np },
                                { label: '건강보험', val: prevMonthPayroll.deduction_hi },
                                { label: '장기요양', val: prevMonthPayroll.deduction_lti },
                                { label: '고용보험', val: prevMonthPayroll.deduction_ei },
                                { label: '소득세', val: prevMonthPayroll.deduction_it },
                                { label: '지방소득세', val: prevMonthPayroll.deduction_lit },
                            ].filter(d => (d.val || 0) > 0).map((d, i) => (
                                <span key={i} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 rounded-lg px-3 py-1.5 text-xs font-semibold">
                                    <span className="text-slate-400">{d.label}</span>
                                    <span className="font-mono font-bold text-red-400">-{fmt(d.val)}</span>
                                </span>
                            ))}
                        </div>

                        {/* Bottom: Net Pay + Actions */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl px-5 py-4">
                            <div className="flex items-center gap-6">
                                {showTaxSupport && (
                                    <div>
                                        <div className="text-[10px] font-bold text-indigo-300">총 보상액</div>
                                        <div className="text-lg font-black text-indigo-300 font-mono">{fmt(prevMonthPayroll.total_pay)}원</div>
                                    </div>
                                )}
                                <div>
                                    <div className="text-xs font-bold text-slate-400">실수령액</div>
                                    <div className="text-2xl font-black text-yellow-300 font-mono tracking-tight">
                                        {fmt(showTaxSupport
                                            ? (prevMonthPayroll.base_pay || 0) + (prevMonthPayroll.bonus_special || 0) + (prevMonthPayroll.bonus_holiday || 0)
                                            : prevMonthPayroll.total_pay
                                        )}원
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setSelectedPayroll(prevMonthPayroll)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors" title="명세서 출력"><Printer size={15} /></button>
                                <button onClick={() => handleSendPayrollStatement(prevMonthPayroll)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors" title="명세서 카톡전송"><MessageSquare size={15} /></button>
                                {prevMonthPayroll.transfer_status !== '완료' && (
                                    <button onClick={() => handleExecuteTransfer(prevMonthPayroll.id)} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-lg transition-all">이체</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-5 px-5 py-8 text-center">
                    <Calendar size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium text-slate-400">전월 급여 내역이 없습니다.</p>
                    <p className="text-[11px] text-slate-300 mt-1">출퇴근/정산에서 급여를 산출해 주세요.</p>
                </div>
            )}

            {/* ═══ Annual Summary ═══ */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 mb-5">
                <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={16} className="text-blue-500" />
                        <span className="text-sm font-bold text-slate-700">연간 급여 요약</span>
                    </div>
                    <select
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-600"
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y}년</option>)}
                    </select>
                </div>
                <div className={`p-4 grid grid-cols-2 ${showTaxSupport ? 'sm:grid-cols-6' : 'sm:grid-cols-4'} gap-3`}>
                    <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #0f766e, #0d5c56)' }}>
                        <div className="text-[10px] font-bold text-white/70 mb-1">총 기본급</div>
                        <div className="text-lg font-black">{fmt(payrollSummary.totalBase)}</div>
                    </div>
                    <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #0e7490, #0c5f75)' }}>
                        <div className="text-[10px] font-bold text-white/70 mb-1">총 특별수당</div>
                        <div className="text-lg font-black">{fmt(payrollSummary.totalSpecial)}</div>
                    </div>
                    <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #1e3a5f, #162d4a)' }}>
                        <div className="text-[10px] font-bold text-rose-300 mb-1">총 공제</div>
                        <div className="text-lg font-black text-rose-300">-{fmt(payrollSummary.totalDeductions)}</div>
                    </div>
                    {showTaxSupport && (
                        <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #115e59, #0d4f4a)' }}>
                            <div className="text-[10px] font-bold text-white/70 mb-1">총 세금대납</div>
                            <div className="text-lg font-black">{fmt(payrollSummary.totalTaxSupport)}</div>
                        </div>
                    )}
                    {showTaxSupport && (
                        <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #164e63, #0e3d4f)' }}>
                            <div className="text-[10px] font-bold text-white/70 mb-1">총 보상</div>
                            <div className="text-lg font-black">{fmt(payrollSummary.totalNet)}</div>
                        </div>
                    )}
                    <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #134e4a, #0a2e2b)' }}>
                        <div className="text-[10px] font-bold text-emerald-300 mb-1">총 실수령</div>
                        <div className="text-lg font-black">{fmt(showTaxSupport ? payrollSummary.totalNet - payrollSummary.totalTaxSupport : payrollSummary.totalNet)}</div>
                        <div className="text-[10px] mt-1 text-white/50">{payrollSummary.count}건 / 지급완료 {payrollSummary.transferred}건</div>
                    </div>
                </div>
            </div>

            {/* ═══ Payroll History Table ═══ */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 mb-5">
                <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-blue-500" />
                        <span className="text-sm font-bold text-slate-700">월별 급여 지급 내역</span>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-bold">{payrolls.length}건</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="text-[11px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-600"
                        >
                            <option value="desc">최신순</option>
                            <option value="asc">오래된순</option>
                        </select>
                        <button onClick={() => fetchStaffDetail()} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600" title="새로고침">
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                {payrolls.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Calendar size={36} className="mx-auto mb-3 text-slate-300" />
                        <p className="text-sm font-medium">급여 지급 내역이 없습니다.</p>
                        <p className="text-xs text-slate-300 mt-1">출퇴근/정산 버튼으로 급여를 산출하세요.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                                        <th className="px-4 py-3 font-bold border-b border-slate-100">귀속월</th>
                                        <th className="px-4 py-3 font-bold border-b border-slate-100 text-right">기본급</th>
                                        <th className="px-4 py-3 font-bold border-b border-slate-100 text-right text-violet-500">특별수당</th>
                                        <th className="px-4 py-3 font-bold border-b border-slate-100 text-right text-red-400">공제액</th>
                                        {showTaxSupport && (
                                            <th className="px-4 py-3 font-bold border-b border-slate-100 text-right text-emerald-600">세금대납</th>
                                        )}
                                        {showTaxSupport && (
                                            <th className="px-4 py-3 font-bold border-b border-slate-100 text-right text-indigo-600">총 보상액</th>
                                        )}
                                        <th className="px-4 py-3 font-bold border-b border-slate-100 text-right text-blue-600">실수령액</th>
                                        <th className="px-4 py-3 font-bold border-b border-slate-100 text-center">상태</th>
                                        <th className="px-4 py-3 font-bold border-b border-slate-100 text-center">관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedPayrolls.map((pay) => {
                                        const isExpanded = expandedPayrollId === pay.id;
                                        return (
                                            <tr key={pay.id} className="group">
                                                <td className="px-4 py-3 text-sm font-bold text-slate-800 border-b border-slate-50">
                                                    <button onClick={() => setExpandedPayrollId(isExpanded ? null : pay.id)}
                                                        className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                                                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                        {pay.month}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right text-slate-600 font-mono border-b border-slate-50">{fmt(pay.base_pay)}</td>
                                                <td className="px-4 py-3 text-sm text-right text-violet-500 font-mono border-b border-slate-50">{fmt(pay.bonus_special)}</td>
                                                <td className="px-4 py-3 text-sm text-right text-red-400 font-mono border-b border-slate-50">-{fmt(pay.deductions)}</td>
                                                {showTaxSupport && (
                                                    <td className="px-4 py-3 text-sm text-right text-emerald-600 font-mono border-b border-slate-50">{fmt(pay.bonus_tax_support)}</td>
                                                )}
                                                {showTaxSupport && (
                                                    <td className="px-4 py-3 text-sm text-right text-indigo-600 font-mono border-b border-slate-50">{fmt(pay.total_pay)}</td>
                                                )}
                                                <td className="px-4 py-3 text-sm text-right text-blue-600 font-bold font-mono border-b border-slate-50">
                                                    {fmt(showTaxSupport
                                                        ? (pay.base_pay || 0) + (pay.bonus_special || 0) + (pay.bonus_holiday || 0)
                                                        : pay.total_pay
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center border-b border-slate-50">
                                                    <button
                                                        onClick={() => handleTogglePaymentStatus(pay.id, pay.transfer_status)}
                                                        className="cursor-pointer transition-all hover:scale-105 active:scale-95"
                                                        title="클릭하여 상태 변경"
                                                    >
                                                        {pay.transfer_status === '완료' ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold border border-emerald-200"><CheckCircle size={10} /> 지급완료</span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold border border-amber-200"><Clock size={10} /> 지급대기</span>
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 border-b border-slate-50">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button onClick={() => setSelectedPayroll(pay)} className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors" title="명세서 출력"><Printer size={14} /></button>
                                                        <button onClick={() => handleSendPayrollStatement(pay)} className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors" title="명세서 카톡전송"><MessageSquare size={14} /></button>
                                                        {pay.transfer_status !== '완료' && (
                                                            <button onClick={() => handleExecuteTransfer(pay.id)} className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 shadow-sm transition-all" title="급여 계좌이체">이체</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Expanded Detail Rows */}
                            {sortedPayrolls.map(pay => {
                                if (expandedPayrollId !== pay.id) return null;
                                const details = getPayrollDetails(pay);
                                return (
                                    <div key={`detail-${pay.id}`} className="border-t border-blue-100 bg-blue-50/30 px-6 py-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Earnings */}
                                            <div>
                                                <h4 className="text-[11px] font-black text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                    <TrendingUp size={12} /> 지급 항목 상세
                                                </h4>
                                                <div className="space-y-1.5">
                                                    {details.work_breakdown?.map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                                                            <div>
                                                                <span className="text-xs font-bold text-slate-700">{item.label}</span>
                                                                {item.dates && <span className="text-[9px] text-slate-400 ml-2">({item.dates})</span>}
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-800 font-mono">{fmt(item.amount)}</span>
                                                        </div>
                                                    ))}
                                                    {(pay.bonus_special || 0) > 0 && (
                                                        <div className="flex items-center justify-between bg-violet-50 rounded-lg px-3 py-2 border border-violet-200">
                                                            <span className="text-xs font-bold text-violet-700">특별수당</span>
                                                            <span className="text-xs font-black text-violet-600 font-mono">+{fmt(pay.bonus_special)}</span>
                                                        </div>
                                                    )}
                                                    {(pay.bonus_holiday || 0) > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-blue-100">
                                                            <div className="text-[10px] font-bold text-blue-700 mb-1">주휴수당 주차별</div>
                                                            {[1, 2, 3, 4, 5, 6].map(w => {
                                                                const amt = pay[`holiday_w${w}`];
                                                                const desc = details.holiday_details?.[w.toString()];
                                                                if (!amt && !desc) return null;
                                                                const isDeferred = desc?.includes('익월정산');
                                                                const isDisq = desc?.includes('자격미달');
                                                                return (
                                                                    <div key={w} className={`flex justify-between items-center px-3 py-1.5 rounded-lg text-xs ${isDeferred ? 'bg-amber-50 text-amber-700' : isDisq ? 'bg-red-50 text-red-600' : 'bg-white text-slate-700'} border border-slate-100 mb-1`}>
                                                                        <div>
                                                                            <span className="font-bold">{w}주차</span>
                                                                            {desc && <span className="text-[9px] ml-1.5 text-slate-400">{desc}</span>}
                                                                        </div>
                                                                        <span className="font-bold font-mono">{isDeferred ? '익월' : isDisq ? '-' : fmt(amt)}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Deductions */}
                                            <div>
                                                <h4 className="text-[11px] font-black text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                    <AlertCircle size={12} /> 공제 항목 상세
                                                </h4>
                                                <div className="space-y-1.5">
                                                    {[
                                                        { label: '국민연금', val: pay.deduction_np },
                                                        { label: '건강보험', val: pay.deduction_hi },
                                                        { label: '장기요양보험', val: pay.deduction_lti },
                                                        { label: '고용보험', val: pay.deduction_ei },
                                                        { label: '소득세', val: pay.deduction_it },
                                                        { label: '지방소득세', val: pay.deduction_lit },
                                                    ].map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                                                            <span className="text-xs font-bold text-slate-700">{item.label}</span>
                                                            <span className={`text-xs font-bold font-mono ${(item.val || 0) > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                                                {(item.val || 0) > 0 ? `-${fmt(item.val)}` : '-'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {showTaxSupport && (pay.bonus_tax_support || 0) > 0 && (
                                                    <div className="mt-3 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200 flex justify-between items-center">
                                                        <span className="text-xs font-bold text-emerald-700">세금대납 (사업주 별도납부)</span>
                                                        <span className="text-xs font-black text-emerald-600 font-mono">+{fmt(pay.bonus_tax_support)}</span>
                                                    </div>
                                                )}

                                                <div className="mt-3 bg-slate-800 rounded-lg px-3 py-3 text-white">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-slate-400">기본급</span>
                                                        <span className="font-bold font-mono">{fmt(pay.base_pay)}</span>
                                                    </div>
                                                    {(pay.bonus_special || 0) > 0 && (
                                                        <div className="flex justify-between text-xs mb-1">
                                                            <span className="text-slate-400">특별수당</span>
                                                            <span className="font-bold font-mono text-violet-300">+{fmt(pay.bonus_special)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-slate-400">공제액</span>
                                                        <span className="font-bold font-mono text-red-300">-{fmt(pay.deductions)}</span>
                                                    </div>
                                                    {showTaxSupport && (pay.bonus_tax_support || 0) > 0 && (
                                                        <div className="flex justify-between text-xs mb-1">
                                                            <span className="text-slate-400">세금대납</span>
                                                            <span className="font-bold font-mono text-emerald-300">+{fmt(pay.bonus_tax_support)}</span>
                                                        </div>
                                                    )}
                                                    <div className="border-t border-slate-700 mt-2 pt-2">
                                                        {showTaxSupport && (
                                                            <div className="flex justify-between mb-1">
                                                                <span className="text-xs font-bold text-indigo-300">총 보상액</span>
                                                                <span className="text-sm font-black text-indigo-300 font-mono">{fmt(pay.total_pay)}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between">
                                                            <span className="text-xs font-bold">실수령액</span>
                                                            <span className="text-base font-black text-yellow-300 font-mono">
                                                                {fmt(showTaxSupport
                                                                    ? (pay.base_pay || 0) + (pay.bonus_special || 0) + (pay.bonus_holiday || 0)
                                                                    : pay.total_pay
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 flex items-center gap-2">
                                                    <Building2 size={12} className="text-slate-400" />
                                                    <span className="text-[10px] text-slate-500 font-bold">
                                                        {formData.bank_name || ''} {formData.account_number || ''} {formData.account_holder || ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Mobile Card List */}
                        <div className="sm:hidden divide-y divide-slate-50">
                            {sortedPayrolls.map((pay) => (
                                <div key={pay.id} className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-bold text-slate-800 text-sm">{pay.month}</span>
                                        <button
                                            onClick={() => handleTogglePaymentStatus(pay.id, pay.transfer_status)}
                                            className="transition-all active:scale-95"
                                        >
                                            {pay.transfer_status === '완료' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold border border-emerald-200"><CheckCircle size={10} /> 지급완료</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold border border-amber-200"><Clock size={10} /> 지급대기</span>
                                            )}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                        <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2">
                                            <span className="text-slate-500">기본급</span>
                                            <span className="font-bold font-mono text-slate-700">{fmt(pay.base_pay)}</span>
                                        </div>
                                        <div className="flex justify-between bg-violet-50 rounded-lg px-3 py-2">
                                            <span className="text-violet-500">특별수당</span>
                                            <span className="font-bold font-mono text-violet-600">{fmt(pay.bonus_special)}</span>
                                        </div>
                                        <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2">
                                            <span className="text-red-400">공제</span>
                                            <span className="font-bold font-mono text-red-400">-{fmt(pay.deductions)}</span>
                                        </div>
                                        {showTaxSupport ? (
                                            <div className="flex justify-between bg-emerald-50 rounded-lg px-3 py-2">
                                                <span className="text-emerald-600">세금대납</span>
                                                <span className="font-bold font-mono text-emerald-600">{fmt(pay.bonus_tax_support)}</span>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between bg-blue-50 rounded-lg px-3 py-2">
                                                <span className="text-blue-500">실수령</span>
                                                <span className="font-bold font-mono text-blue-600">{fmt(pay.total_pay)}</span>
                                            </div>
                                        )}
                                        {showTaxSupport && (
                                            <>
                                                <div className="flex justify-between bg-indigo-50 rounded-lg px-3 py-2">
                                                    <span className="text-indigo-500">총 보상</span>
                                                    <span className="font-bold font-mono text-indigo-600">{fmt(pay.total_pay)}</span>
                                                </div>
                                                <div className="flex justify-between bg-blue-50 rounded-lg px-3 py-2">
                                                    <span className="text-blue-500 font-bold">실수령</span>
                                                    <span className="font-bold font-mono text-blue-600">{fmt((pay.base_pay || 0) + (pay.bonus_special || 0) + (pay.bonus_holiday || 0))}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                        <button onClick={() => setSelectedPayroll(pay)} className="flex-1 flex items-center justify-center gap-1 p-2 bg-white text-blue-600 rounded-lg text-xs font-bold border border-slate-200 hover:bg-blue-50">
                                            <Printer size={13} /> 명세서
                                        </button>
                                        <button onClick={() => handleSendPayrollStatement(pay)} className="flex-1 flex items-center justify-center gap-1 p-2 bg-white text-emerald-600 rounded-lg text-xs font-bold border border-slate-200 hover:bg-emerald-50">
                                            <MessageSquare size={13} /> 카톡
                                        </button>
                                        {pay.transfer_status !== '완료' && (
                                            <button onClick={() => handleExecuteTransfer(pay.id)} className="flex-1 p-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm">이체</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ═══ Modals ═══ */}
            {selectedPayroll && (
                <PayrollStatement staff={formData} payroll={selectedPayroll} onClose={() => setSelectedPayroll(null)} />
            )}

            {isAttendanceOpen && (
                <AttendanceInput
                    isOpen={isAttendanceOpen}
                    onClose={() => setIsAttendanceOpen(false)}
                    staffId={id}
                    staffName={formData?.name || ''}
                    month={currentMonth}
                    onCalculateSuccess={() => fetchStaffDetail(currentMonth)}
                />
            )}
        </>
    );
}
