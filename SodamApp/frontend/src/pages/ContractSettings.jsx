import { useState, useEffect } from 'react';
import api from '../api';
import { Save, RefreshCw } from 'lucide-react';

export default function ContractSettings() {
    const [contractTemplate, setContractTemplate] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

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
        if (!window.confirm("기본 PDF 양식으로 초기화하시겠습니까? (현재 내용은 사라집니다)")) return;

        try {
            const defaultText = `표준근로계약서

임춘우(이하 "사업주"라 함)와 {name}(이하 "근로자"라 함)은(는) 다음과 같이
근로계약을 체결한다.

1. 근로계약기간 : {start_date}부터        년    월      일까지
2. 근 무 장 소 : 소담김밥 건대본점 매장
3. 업무의 내용 : 주방업무( )/ 카운터업무( ) / 마감 청소업무(   )
4. 소정근로시간 :         시   분부터     시   분까지 (휴게시간 : 시 분 ~     시   분)
5. 근무일/휴일 : 매주 일 근무, 주휴일 매주 요일
6. 임 금
- 월(일, 시)급 : {wage} 원
- 상여금 : 있음(     ), 없음(     )
- 기타 급여(제 수당 등) : 있음( 주휴수당),  없음(        )
- 지급일 : 매월(매주 또는 매일) 말일(휴일의 경우는 전일 지급)
- 지급 방법 : 근로자에게 직접 지급(      ), 예금통장에 입금 (       )
7. 연차유급휴가
- 연차유급휴가는 근로기준법에서 정하는 바에 따라 부여함
8. 근로계약서 교뷰
- 사업주는 근로계약을 체결함과 동시에 본 계약서를 사본하여 근로자의
교부요구와 관계없이 근로자에게 교부함(근로기준법 제17조 이행)
9. 수습 기간
- 입사 개시 후 3개월은 당사의 업무 수습 근로자의 자격으로 근무한다.
10. 기타
- 이 계약에 정함이 없는 사항은 근로기준법령에 의함.

2026년       월    일
(사업주) 사업체명 : 소담김밥       전 화 : 02- 452-6570
주 소 : 서울시 광진구 능동로 110 스타시티 영존빌딩 B208호
                                  대 표 자 :   임  춘 우  (서명)

(근로자) 주 소 :                                                                                연 락 처 : {phone}
                                       성  명 : {name}                    (서명)`;

            setContractTemplate(defaultText);
            await api.put('/settings/contract_template', { value: defaultText });
            setMsg("기본값으로 초기화되었습니다.");
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

            <p className="text-sm text-slate-500 mb-4">
                직원 계약서 작성 시 기본으로 입력될 내용을 수정합니다.<br />
                <code className="bg-slate-100 px-1 rounded text-red-500">{'{name}'}</code>,
                <code className="bg-slate-100 px-1 rounded text-red-500">{'{start_date}'}</code>,
                <code className="bg-slate-100 px-1 rounded text-red-500">{'{wage}'}</code>,
                <code className="bg-slate-100 px-1 rounded text-red-500">{'{phone}'}</code>
                등의 변수를 사용하면 계약서 작성 시 자동으로 정보가 채워집니다.
            </p>

            <textarea
                value={contractTemplate}
                onChange={(e) => setContractTemplate(e.target.value)}
                className="w-full h-[600px] p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm leading-relaxed resize-none"
                placeholder="계약서 양식을 입력하세요..."
            />
        </div>
    );
}
