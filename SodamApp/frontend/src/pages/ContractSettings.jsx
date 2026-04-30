import { useState, useEffect } from 'react';
import api from '../api';
import { Save, RefreshCw, Info } from 'lucide-react';
import { getStandardContractTemplate, CONTRACT_VARIABLE_CATALOG } from '../utils/contractVars';

export default function ContractSettings() {
    const [contractTemplate, setContractTemplate] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [showVariableHelp, setShowVariableHelp] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await api.get('/settings/contract_template');
            if (res.data && res.data.value) {
                setContractTemplate(res.data.value);
            }
        } catch (error) {
            console.error("Failed to fetch settings", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await api.put('/settings/contract_template', { value: contractTemplate });
            setMsg("저장되었습니다.");
            setTimeout(() => setMsg(""), 3000);
        } catch (error) {
            console.error("Failed to save settings", error);
            alert("저장 실패");
        }
    };

    const handleReset = async () => {
        if (!window.confirm("고용노동부 표준근로계약서 양식으로 초기화하시겠습니까? (현재 내용은 사라집니다)")) return;

        try {
            const defaultText = getStandardContractTemplate();
            setContractTemplate(defaultText);
            await api.put('/settings/contract_template', { value: defaultText });
            setMsg("표준 양식으로 초기화되었습니다.");
            setTimeout(() => setMsg(""), 3000);
        } catch (error) {
            console.error("Failed to reset", error);
        }
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            {msg && (
                <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 text-center font-bold">
                    {msg}
                </div>
            )}

            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">전자계약서 기본 양식</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <RefreshCw size={16} /> 기본값 초기화
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Save size={18} /> 저장하기
                    </button>
                </div>
            </div>

            <p className="text-sm text-slate-500 mb-3">
                직원 계약서 작성 시 기본으로 입력될 내용을 수정합니다.
                아래 변수를 본문에 넣으면 직원 정보 / 사업주 정보 / 오늘 날짜가 자동으로 채워집니다.
                <button
                    type="button"
                    onClick={() => setShowVariableHelp(v => !v)}
                    className="ml-2 inline-flex items-center gap-1 text-blue-600 hover:underline font-bold"
                >
                    <Info size={14} /> {showVariableHelp ? '변수 목록 숨기기' : '사용 가능한 변수 보기'}
                </button>
            </p>

            {showVariableHelp && (
                <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    {CONTRACT_VARIABLE_CATALOG.map((g) => (
                        <div key={g.group}>
                            <div className="text-xs font-bold text-slate-700 mb-1.5">{g.group}</div>
                            <div className="flex flex-wrap gap-1.5">
                                {g.items.map((item) => (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => navigator.clipboard?.writeText(item.key)}
                                        title={`클릭하여 복사: ${item.key}`}
                                        className="group inline-flex items-center gap-1 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 px-2 py-1 rounded-md text-[11px] transition-colors"
                                    >
                                        <code className="text-red-500 font-mono">{item.key}</code>
                                        <span className="text-slate-500 group-hover:text-blue-600">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                    <p className="text-[11px] text-slate-400 mt-1">변수를 클릭하면 클립보드에 복사됩니다.</p>
                </div>
            )}

            <textarea
                value={contractTemplate}
                onChange={(e) => setContractTemplate(e.target.value)}
                className="w-full h-[600px] p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm leading-relaxed resize-none"
                placeholder="계약서 양식을 입력하세요..."
            />
        </div>
    );
}
