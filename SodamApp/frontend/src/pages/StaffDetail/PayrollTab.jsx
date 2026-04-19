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

    // ─── Payroll Summary ───
    const payrollSummary = useMemo(() => {
        const filtered = payrolls.filter(p => p.month?.startsWith(yearFilter));
        const totalBase = filtered.reduce((s, p) => s + (p.base_pay || 0), 0);
        const totalBonus = filtered.reduce((s, p) => s + (p.bonus || 0), 0);
        const totalDeductions = filtered.reduce((s, p) => s + (p.deductions || 0), 0);
        const totalNet = filtered.reduce((s, p) => s + (p.total_pay || 0), 0);
        const count = filtered.length;
        const transferred = filtered.filter(p => p.transfer_status === '완료').length;
        return { totalBase, totalBonus, totalDeductions, totalNet, count, transferred };
    }, [payrolls, yearFilter]);

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
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                        <div className="text-[10px] font-bold text-white/70 mb-1">총 기본급</div>
                        <div className="text-lg font-black">{fmt(payrollSummary.totalBase)}</div>
                    </div>
                    <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
                        <div className="text-[10px] font-bold text-white/70 mb-1">총 수당</div>
                        <div className="text-lg font-black">{fmt(payrollSummary.totalBonus)}</div>
                    </div>
                    <div className="rounded-xl p-4 border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-400 mb-1">총 공제</div>
                        <div className="text-lg font-black text-red-500">-{fmt(payrollSummary.totalDeductions)}</div>
                    </div>
                    <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #134e4a, #1e3a3a)' }}>
                        <div className="text-[10px] font-bold text-white/70 mb-1">총 실수령</div>
                        <div className="text-lg font-black">{fmt(payrollSummary.totalNet)}</div>
                        <div className="text-[10px] mt-1 text-white/50">{payrollSummary.count}건 / 이체완료 {payrollSummary.transferred}건</div>
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
                    <button onClick={() => fetchStaffDetail()} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600" title="새로고침">
                        <RefreshCw size={14} />
                    </button>
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
                                        <th className="px-4 py-3 font-bold border-b border-slate-100 text-right">
                                            {formData.contract_type === '정규직' ? '추가수당' : '주휴수당'}
                                        </th>
                                        <th className="px-4 py-3 font-bold border-b border-slate-100 text-right text-red-400">공제액</th>
                                        <th className="px-4 py-3 font-bold border-b border-slate-100 text-right text-blue-600">실수령액</th>
                                        <th className="px-4 py-3 font-bold border-b border-slate-100 text-center">상태</th>
                                        <th className="px-4 py-3 font-bold border-b border-slate-100 text-center">관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payrolls.map((pay) => {
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
                                                <td className="px-4 py-3 text-sm text-right text-slate-600 font-mono border-b border-slate-50">{fmt(pay.bonus)}</td>
                                                <td className="px-4 py-3 text-sm text-right text-red-400 font-mono border-b border-slate-50">-{fmt(pay.deductions)}</td>
                                                <td className="px-4 py-3 text-sm text-right text-blue-600 font-bold font-mono border-b border-slate-50">{fmt(pay.total_pay)}</td>
                                                <td className="px-4 py-3 text-center border-b border-slate-50">
                                                    {pay.transfer_status === '완료' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold"><CheckCircle size={10} /> 이체완료</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold"><Clock size={10} /> 이체대기</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 border-b border-slate-50">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button onClick={() => setSelectedPayroll(pay)} className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors" title="명세서 출력"><Printer size={14} /></button>
                                                        <button onClick={() => handleSendPayrollStatement(pay)} className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors" title="명세서 카톡전송"><MessageSquare size={14} /></button>
                                                        {pay.transfer_status !== '완료' && (
                                                            <button onClick={() => handleExecuteTransfer(pay.id)} className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 shadow-sm transition-all">이체</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Expanded Detail Rows */}
                            {payrolls.map(pay => {
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

                                                {(pay.bonus_tax_support || 0) > 0 && (
                                                    <div className="mt-3 bg-purple-50 rounded-lg px-3 py-2 border border-purple-100 flex justify-between items-center">
                                                        <span className="text-xs font-bold text-purple-700">세금대납 (사업주)</span>
                                                        <span className="text-xs font-black text-purple-600 font-mono">+{fmt(pay.bonus_tax_support)}</span>
                                                    </div>
                                                )}

                                                <div className="mt-3 bg-slate-800 rounded-lg px-3 py-3 text-white">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-slate-400">지급총액</span>
                                                        <span className="font-bold font-mono">{fmt((pay.base_pay || 0) + (pay.bonus || 0))}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-slate-400">공제총액</span>
                                                        <span className="font-bold font-mono text-red-300">-{fmt(pay.deductions)}</span>
                                                    </div>
                                                    <div className="border-t border-slate-700 mt-2 pt-2 flex justify-between">
                                                        <span className="text-xs font-bold">실수령액</span>
                                                        <span className="text-base font-black text-yellow-300 font-mono">{fmt(pay.total_pay)}</span>
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
                            {payrolls.map((pay) => (
                                <div key={pay.id} className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-bold text-slate-800 text-sm">{pay.month}</span>
                                        {pay.transfer_status === '완료' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold"><CheckCircle size={10} /> 완료</span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold"><Clock size={10} /> 대기</span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                        <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2">
                                            <span className="text-slate-500">기본급</span>
                                            <span className="font-bold font-mono text-slate-700">{fmt(pay.base_pay)}</span>
                                        </div>
                                        <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2">
                                            <span className="text-slate-500">{formData.contract_type === '정규직' ? '수당' : '주휴'}</span>
                                            <span className="font-bold font-mono text-slate-700">{fmt(pay.bonus)}</span>
                                        </div>
                                        <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2">
                                            <span className="text-red-400">공제</span>
                                            <span className="font-bold font-mono text-red-400">-{fmt(pay.deductions)}</span>
                                        </div>
                                        <div className="flex justify-between bg-blue-50 rounded-lg px-3 py-2">
                                            <span className="text-blue-500">실수령</span>
                                            <span className="font-bold font-mono text-blue-600">{fmt(pay.total_pay)}</span>
                                        </div>
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
