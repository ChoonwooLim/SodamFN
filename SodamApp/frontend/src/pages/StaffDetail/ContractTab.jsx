import { FileText, MessageSquare, Trash2, CreditCard } from 'lucide-react';
import { formatNumber } from '../../utils/format';
import api from '../../api';

export default function ContractTab({
    formData,
    setFormData,
    handleChange,
    id,
    contracts,
    contractForm,
    setContractForm,
    isContractModalOpen,
    setIsContractModalOpen,
    handleOpenContractModal,
    handleCreateContract,
    handleSendContractAlimTalk,
    handleDeleteContract,
    handleEditContract,
    editingContractId,
}) {
    return (
        <>
            {/* Employment & Payment */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <div className="flex items-center gap-3 mb-6 border-b pb-4">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><CreditCard size={24} /></div>
                    <h2 className="text-lg font-bold text-slate-800">계약 및 급여</h2>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-500 mb-1">계약 형태</label>
                            <select
                                name="contract_type"
                                value={formData.contract_type || '아르바이트'}
                                onChange={handleChange}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="정규직">정규직</option>
                                <option value="아르바이트">아르바이트</option>
                                <option value="일용직">일용직</option>
                                <option value="사업소득자">사업소득자 (3.3%)</option>
                            </select>
                        </div>
                        <div className="flex items-end pb-1.5">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="insurance_4major"
                                    checked={formData.insurance_4major || false}
                                    onChange={handleChange}
                                    className="w-5 h-5 text-blue-600 rounded"
                                />
                                <span className="font-medium text-slate-700 text-sm">4대보험 가입</span>
                            </label>
                        </div>
                    </div>

                    {/* 보험/세금 옵션 체크박스들 */}
                    {(formData.insurance_4major || formData.contract_type === '정규직') && (
                        <div className="flex flex-wrap gap-x-5 gap-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="np_exempt" checked={formData.np_exempt || false} onChange={handleChange} className="w-4 h-4 text-orange-500 rounded" />
                                <span className="text-xs font-medium text-slate-600">국민연금 면제 <span className="text-slate-400">(60세+)</span></span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="durunnuri_support" checked={formData.durunnuri_support || false} onChange={handleChange} className="w-4 h-4 text-green-500 rounded" />
                                <span className="text-xs font-medium text-slate-600">두루누리 지원 <span className="text-slate-400">(NP·EI 80%감면)</span></span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="tax_support_enabled" checked={formData.tax_support_enabled || false} onChange={handleChange} className="w-4 h-4 text-purple-500 rounded" />
                                <span className="text-xs font-medium text-slate-600">세금 대납 <span className="text-slate-400">(사업주 부담)</span></span>
                            </label>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-500 mb-1">시급</label>
                            <input
                                type="text" name="hourly_wage"
                                value={formData.hourly_wage ? formatNumber(formData.hourly_wage) : ''}
                                onChange={handleChange}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-right pr-9 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            />
                            <span className="absolute right-3 top-[34px] text-slate-400 text-sm">원</span>
                        </div>
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-500 mb-1">월급</label>
                            <input
                                type="text" name="monthly_salary"
                                value={formData.monthly_salary ? formatNumber(formData.monthly_salary) : ''}
                                onChange={handleChange}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-right pr-9 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            />
                            <span className="absolute right-3 top-[34px] text-slate-400 text-sm">원</span>
                        </div>
                    </div>

                    {/* 보수월액 */}
                    {(formData.insurance_4major || formData.contract_type === '정규직') && (
                        <div>
                            <div className="flex items-end gap-2">
                                <div className="relative flex-1">
                                    <label className="block text-sm font-medium text-slate-500 mb-1">보수월액 <span className="text-xs text-slate-400">(4대보험 산정기준)</span></label>
                                    <input
                                        type="text" name="insurance_base_salary"
                                        value={formData.insurance_base_salary ? formatNumber(formData.insurance_base_salary) : ''}
                                        onChange={handleChange}
                                        className="w-full p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-right pr-9 focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                                        placeholder="0 (미입력시 총급여 기준)"
                                    />
                                    <span className="absolute right-3 top-[34px] text-slate-400 text-sm">원</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            const resp = await api.get(`/payroll/calc-insurance-base/${id}`);
                                            if (resp.data.status === 'success') {
                                                const { insurance_base_salary, method, breakdown } = resp.data.data;
                                                const details = Object.entries(breakdown)
                                                    .map(([k, v]) => `${k}: ${typeof v === 'number' ? formatNumber(v) : v}`)
                                                    .join('\n');
                                                if (window.confirm(
                                                    `[${method}]\n\n${details}\n\n산출 보수월액: ${formatNumber(insurance_base_salary)}원\n\n적용하시겠습니까?`
                                                )) {
                                                    setFormData(prev => ({ ...prev, insurance_base_salary }));
                                                }
                                            } else {
                                                alert(resp.data.message || '산출할 수 없습니다.');
                                            }
                                        } catch (err) {
                                            console.error(err);
                                            alert(err.response?.data?.detail || '보수월액 산출 중 오류');
                                        }
                                    }}
                                    className="px-3 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 shadow-sm transition-all whitespace-nowrap"
                                >
                                    자동산출
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const totalStr = window.prompt('전년도 보수총액을 입력해주세요 (원)\n(예: 13267800)');
                                        if (!totalStr) return;
                                        const monthsStr = window.prompt('근무월수를 입력해주세요 (개월)\n(예: 9)');
                                        if (!monthsStr) return;
                                        const total = parseInt(totalStr.replace(/,/g, ''));
                                        const months = parseInt(monthsStr);
                                        if (isNaN(total) || isNaN(months) || months <= 0) {
                                            alert('올바른 숫자를 입력해주세요.');
                                            return;
                                        }
                                        const baseSalary = Math.round(total / months / 1000) * 1000;
                                        if (window.confirm(
                                            `[통보서 기준]\n\n보수총액: ${formatNumber(total)}원\n근무월수: ${months}개월\n\n산출 보수월액: ${formatNumber(baseSalary)}원\n\n적용하시겠습니까?`
                                        )) {
                                            setFormData(prev => ({ ...prev, insurance_base_salary: baseSalary }));
                                        }
                                    }}
                                    className="px-3 py-2.5 bg-teal-500 text-white rounded-xl text-xs font-bold hover:bg-teal-600 shadow-sm transition-all whitespace-nowrap"
                                >
                                    통보서
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 부양가족/자녀 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-500 mb-1">부양가족 수 <span className="text-xs text-slate-400">(본인 포함)</span></label>
                            <input
                                type="number" name="dependents_count"
                                value={formData.dependents_count ?? 1}
                                onChange={handleChange} min="1"
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            />
                        </div>
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-500 mb-1">20세 이하 자녀 <span className="text-xs text-slate-400">(세액공제)</span></label>
                            <input
                                type="number" name="children_count"
                                value={formData.children_count ?? 0}
                                onChange={handleChange} min="0"
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            />
                        </div>
                    </div>

                    {/* 급여 계좌 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-500">급여 계좌</label>
                        <div className="grid grid-cols-3 gap-2">
                            <input type="text" name="bank_name" value={formData.bank_name || ''} onChange={handleChange} placeholder="은행명"
                                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                            <input type="text" name="account_number" value={formData.account_number || ''} onChange={handleChange} placeholder="계좌번호"
                                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                            <input type="text" name="account_holder" value={formData.account_holder || ''} onChange={handleChange} placeholder="예금주"
                                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Contract Info */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <div className="flex items-center gap-3 mb-6 border-b pb-4">
                    <div className="p-2 bg-pink-100 text-pink-600 rounded-lg"><FileText size={24} /></div>
                    <h2 className="text-lg font-bold text-slate-800">상세 근로계약 정보</h2>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">근로계약 시작일</label>
                                    <input
                                        type="date" name="contract_start_date"
                                        value={formData.contract_start_date || ''} onChange={handleChange}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">근로계약 종료일</label>
                                    <input
                                        type="date" name="contract_end_date"
                                        value={formData.contract_end_date || ''} onChange={handleChange}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">근무 시간 (시작 - 종료)</label>
                                <div className="flex items-center gap-2">
                                    <select name="work_start_time" value={formData.work_start_time || ''} onChange={handleChange}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">시작</option>
                                        {Array.from({ length: 48 }).map((_, i) => {
                                            const h = Math.floor(i / 2).toString().padStart(2, '0');
                                            const m = (i % 2) * 30 === 0 ? '00' : '30';
                                            const time = `${h}:${m}`;
                                            return <option key={time} value={time}>{time}</option>;
                                        })}
                                    </select>
                                    <span className="text-slate-400">~</span>
                                    <select name="work_end_time" value={formData.work_end_time || ''} onChange={handleChange}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">종료</option>
                                        {Array.from({ length: 48 }).map((_, i) => {
                                            const h = Math.floor(i / 2).toString().padStart(2, '0');
                                            const m = (i % 2) * 30 === 0 ? '00' : '30';
                                            const time = `${h}:${m}`;
                                            return <option key={time} value={time}>{time}</option>;
                                        })}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">휴게 시간 (시작 - 종료)</label>
                                <div className="flex items-center gap-2">
                                    <select name="rest_start_time" value={formData.rest_start_time || ''} onChange={handleChange}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">시작</option>
                                        {Array.from({ length: 48 }).map((_, i) => {
                                            const h = Math.floor(i / 2).toString().padStart(2, '0');
                                            const m = (i % 2) * 30 === 0 ? '00' : '30';
                                            const time = `${h}:${m}`;
                                            return <option key={time} value={time}>{time}</option>;
                                        })}
                                    </select>
                                    <span className="text-slate-400">~</span>
                                    <select name="rest_end_time" value={formData.rest_end_time || ''} onChange={handleChange}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">종료</option>
                                        {Array.from({ length: 48 }).map((_, i) => {
                                            const h = Math.floor(i / 2).toString().padStart(2, '0');
                                            const m = (i % 2) * 30 === 0 ? '00' : '30';
                                            const time = `${h}:${m}`;
                                            return <option key={time} value={time}>{time}</option>;
                                        })}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">근무 요일 및 휴일</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" name="working_days" value={formData.working_days || ''} onChange={handleChange}
                                        placeholder="예: 월~금" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                                    <input type="text" name="weekly_holiday" value={formData.weekly_holiday || ''} onChange={handleChange}
                                        placeholder="주휴일: 일요일" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">업무 내용</label>
                                <input type="text" name="job_description" value={formData.job_description || ''} onChange={handleChange}
                                    placeholder="주방 보조, 홀 서빙 등" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Electronic Contract Management */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><FileText size={24} /></div>
                        <h3 className="text-lg font-bold text-slate-800">전자계약 관리</h3>
                    </div>
                    <button
                        onClick={handleOpenContractModal}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm"
                    >
                        새 계약서
                    </button>
                </div>
                <div className="space-y-3">
                    {contracts.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs italic">진행 중인 계약이 없습니다.</div>
                    ) : (
                        contracts.map(contract => (
                            <div key={contract.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${contract.status === 'signed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                        <FileText size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-800 truncate">{contract.title}</div>
                                        <div className="text-[10px] text-slate-400">
                                            {contract.status === 'signed' ? '서명완료' : '대기중'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {contract.status !== 'signed' && (
                                        <button onClick={() => handleSendContractAlimTalk(contract.id)} className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg">
                                            <MessageSquare size={14} />
                                        </button>
                                    )}
                                    <button onClick={() => handleDeleteContract(contract.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg">
                                        <Trash2 size={14} />
                                    </button>
                                    {contract.status === 'signed' && (
                                        <button onClick={() => window.open(`/contracts/${contract.id}/sign`, '_blank')} className="text-xs font-bold text-blue-600 px-2 py-1">
                                            보기
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Contract Creation/Edit Modal */}
            {isContractModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900">전자계약서 작성</h3>
                                <button
                                    onClick={() => {
                                        let newContent = contractForm.content || "";
                                        newContent = newContent.replace(/{name}/g, formData.name || "");
                                        newContent = newContent.replace(/{start_date}/g, formData.start_date || "");
                                        newContent = newContent.replace(/{phone}/g, formData.phone || "");
                                        const wage = formData.contract_type === '정규직' ? formData.monthly_salary : formData.hourly_wage;
                                        newContent = newContent.replace(/{wage}/g, wage ? formatNumber(wage) : "");
                                        setContractForm(prev => ({ ...prev, content: newContent }));
                                    }}
                                    className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"
                                >
                                    변수 치환
                                </button>
                            </div>
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={contractForm.title}
                                    onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                    placeholder="계약서 제목 (예: [소담] 근로계약서_홍길동)"
                                />
                                <textarea
                                    value={contractForm.content}
                                    onChange={(e) => setContractForm({ ...contractForm, content: e.target.value })}
                                    className="w-full h-80 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium text-slate-700"
                                    placeholder="계약서 내용을 입력하세요. {name}, {start_date}, {wage} 등을 사용할 수 있습니다."
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-3">
                            <button onClick={() => setIsContractModalOpen(false)} className="px-6 p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600">취소</button>
                            <button onClick={handleCreateContract} className="flex-1 p-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">발송하기</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
