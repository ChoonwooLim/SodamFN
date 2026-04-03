import { CreditCard, Printer, MessageSquare, Wallet } from 'lucide-react';
import { formatNumber } from '../../utils/format';
import PayrollStatement from '../../components/PayrollStatement';

export default function PayrollTab({
    formData,
    payrolls,
    selectedPayroll,
    setSelectedPayroll,
    handleSendPayrollStatement,
    handleExecuteTransfer,
    isBizAccountModalOpen,
    setIsBizAccountModalOpen,
    bizAccountForm,
    setBizAccountForm,
    fetchBizAccount,
    handleUpdateBizAccount,
}) {
    return (
        <>
            {/* Payroll History */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><CreditCard size={24} /></div>
                        <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">월별 급여 지급 내역</h2>
                    </div>
                </div>

                {payrolls.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm italic">급여 지급 내역이 없습니다.</div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 text-sm">
                                        <th className="p-4 font-bold border-b border-slate-100">귀속월</th>
                                        <th className="p-4 font-bold border-b border-slate-100 text-right">기본급</th>
                                        <th className="p-4 font-bold border-b border-slate-100 text-right">{formData.contract_type === '정규직' ? '추가수당' : '주휴수당'}</th>
                                        <th className="p-4 font-bold border-b border-slate-100 text-right text-red-500">공제액</th>
                                        <th className="p-4 font-bold border-b border-slate-100 text-right text-blue-600">실수령액</th>
                                        <th className="p-4 font-bold border-b border-slate-100 text-center">상태</th>
                                        <th className="p-4 font-bold border-b border-slate-100 text-center">관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payrolls.map((pay) => (
                                        <tr key={pay.id} className="hover:bg-slate-50 border-b border-slate-50 transition-colors">
                                            <td className="p-4 text-sm font-bold text-slate-800">{pay.month}</td>
                                            <td className="p-4 text-sm text-right text-slate-600 font-mono">{formatNumber(pay.base_pay || 0)}</td>
                                            <td className="p-4 text-sm text-right text-slate-600 font-mono">{formatNumber(pay.bonus || 0)}</td>
                                            <td className="p-4 text-sm text-right text-red-400 font-mono">-{formatNumber(pay.deductions || 0)}</td>
                                            <td className="p-4 text-sm text-right text-indigo-600 font-bold font-mono">{formatNumber(pay.total_pay || 0)}</td>
                                            <td className="p-4 text-center">
                                                {pay.transfer_status === '완료' ? (
                                                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">이체완료</span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">이체대기</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => setSelectedPayroll(pay)} className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors" title="명세서 출력"><Printer size={16} /></button>
                                                    <button onClick={() => handleSendPayrollStatement(pay)} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors" title="명세서 카톡전송"><MessageSquare size={16} /></button>
                                                    {pay.transfer_status !== '완료' && (
                                                        <button onClick={() => handleExecuteTransfer(pay.id)} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm">이체</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card List */}
                        <div className="sm:hidden space-y-3">
                            {payrolls.map((pay) => (
                                <div key={pay.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-bold text-slate-800 text-sm">{pay.month}</span>
                                        {pay.transfer_status === '완료' ? (
                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">이체완료</span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">이체대기</span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                        <div className="flex justify-between bg-white rounded-lg px-3 py-2">
                                            <span className="text-slate-500">기본급</span>
                                            <span className="font-bold font-mono text-slate-700">{formatNumber(pay.base_pay || 0)}</span>
                                        </div>
                                        <div className="flex justify-between bg-white rounded-lg px-3 py-2">
                                            <span className="text-slate-500">{formData.contract_type === '정규직' ? '추가수당' : '주휴수당'}</span>
                                            <span className="font-bold font-mono text-slate-700">{formatNumber(pay.bonus || 0)}</span>
                                        </div>
                                        <div className="flex justify-between bg-white rounded-lg px-3 py-2">
                                            <span className="text-red-400">공제액</span>
                                            <span className="font-bold font-mono text-red-400">-{formatNumber(pay.deductions || 0)}</span>
                                        </div>
                                        <div className="flex justify-between bg-white rounded-lg px-3 py-2">
                                            <span className="text-indigo-500">실수령</span>
                                            <span className="font-bold font-mono text-indigo-600">{formatNumber(pay.total_pay || 0)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                                        <button onClick={() => setSelectedPayroll(pay)} className="flex-1 flex items-center justify-center gap-1 p-2 bg-white text-indigo-600 rounded-lg text-xs font-bold border border-slate-200 hover:bg-indigo-50">
                                            <Printer size={14} /> 명세서
                                        </button>
                                        <button onClick={() => handleSendPayrollStatement(pay)} className="flex-1 flex items-center justify-center gap-1 p-2 bg-white text-emerald-600 rounded-lg text-xs font-bold border border-slate-200 hover:bg-emerald-50">
                                            <MessageSquare size={14} /> 카톡전송
                                        </button>
                                        {pay.transfer_status !== '완료' && (
                                            <button onClick={() => handleExecuteTransfer(pay.id)} className="flex-1 p-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm">
                                                이체
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Payroll Statement Modal */}
            {selectedPayroll && (
                <PayrollStatement staff={formData} payroll={selectedPayroll} onClose={() => setSelectedPayroll(null)} />
            )}

            {/* Biz Account Modal */}
            {isBizAccountModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Wallet className="text-blue-600" /> 출금 계좌 설정</h3>
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={bizAccountForm.bank}
                                    onChange={(e) => setBizAccountForm({ ...bizAccountForm, bank: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none"
                                    placeholder="은행명"
                                />
                                <input
                                    type="text"
                                    value={bizAccountForm.number}
                                    onChange={(e) => setBizAccountForm({ ...bizAccountForm, number: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none"
                                    placeholder="계좌번호"
                                />
                                <input
                                    type="text"
                                    value={bizAccountForm.holder}
                                    onChange={(e) => setBizAccountForm({ ...bizAccountForm, holder: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none"
                                    placeholder="예금주"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-2">
                            <button onClick={() => setIsBizAccountModalOpen(false)} className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600">취소</button>
                            <button onClick={handleUpdateBizAccount} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold">저장</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
