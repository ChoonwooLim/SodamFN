import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, Eraser, Download, FileText, User, PenTool, Type } from 'lucide-react';
import api from '../api';

export default function ContractSignPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [contract, setContract] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSigned, setIsSigned] = useState(false);

    // Wizard Steps: 0=Read, 1=Info, 2=Seal, 3=Sign
    const [step, setStep] = useState(0);

    // Personal Info State
    const [info, setInfo] = useState({
        address: '',
        phone: '',
        resident_number: ''
    });

    // Seal State
    const [sealMode, setSealMode] = useState('auto'); // auto, draw
    const [sealName, setSealName] = useState('');
    const [generatedSeal, setGeneratedSeal] = useState(null);
    const sealCanvasRef = useRef(null);

    // Signature Canvas (Final Sign)
    const signatureCanvasRef = useRef(null);
    const isDrawing = useRef(false);

    useEffect(() => {
        fetchContract();
    }, [id]);

    const fetchContract = async () => {
        try {
            const response = await api.get(`/contracts/${id}`);
            if (response.data.status === 'success') {
                const data = response.data.data;
                setContract(data);
                if (data.status === 'signed') {
                    setIsSigned(true);
                }

                // Pre-fill fields if available in linked staff (requires backend to send this, 
                // but currently contract detail might not have it. We could fetch /auth/me or similar)
            }
        } catch (error) {
            console.error("Error fetching contract:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Seal Generation Logic ---
    const generateSeal = () => {
        if (!sealName) return;
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');

        // Draw Circle
        ctx.beginPath();
        ctx.arc(60, 60, 56, 0, 2 * Math.PI);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#d00'; // Red
        ctx.stroke();

        // Draw Text
        ctx.fillStyle = '#d00';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Simple logic to stack text
        ctx.font = 'bold 32px serif';

        if (sealName.length === 3) {
            // Stack: 1 top, 2 bottom ?? Or just vertical?
            // Standard Dojang often 2x2. Let's do simple vertical for now or single line if short.
            // Actually, vertical 3 chars is common.
            const chars = sealName.split('');
            ctx.fillText(chars[0], 60, 30);
            ctx.fillText(chars[1], 60, 60);
            ctx.fillText(chars[2], 60, 90);
        } else if (sealName.length === 2) {
            ctx.fillText(sealName[0], 60, 45);
            ctx.fillText(sealName[1], 60, 85);
        } else {
            // 4 chars: 2x2
            // Fallback single line
            ctx.font = 'bold 24px serif';
            ctx.fillText(sealName, 60, 60);
        }

        setGeneratedSeal(canvas.toDataURL('image/png'));
    };

    // --- Signature Drawing Logic ---
    const startDrawing = (e) => { isDrawing.current = true; draw(e); };
    const stopDrawing = () => { isDrawing.current = false; signatureCanvasRef.current?.getContext('2d').beginPath(); };
    const draw = (e) => {
        if (!isDrawing.current || isSigned) return;
        const canvas = signatureCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };
    const clearCanvas = () => {
        const canvas = signatureCanvasRef.current;
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    };


    const handleSubmit = async () => {
        if (!isSigned && step < 3) {
            setStep(prev => prev + 1);
            return;
        }

        // Final Submit
        // We use the Generated Seal or the Hand Signature?
        // User request says: "Make seal instead of signature then sign".
        // Let's assume we use the seal IMAGE as the signature data if generated, OR hand signature if drawn.

        // Actually, Step 3 is "Create Seal". Step 4 is "Sign/Seal".
        // If they made a seal, we can stamp it. If they want to sign by hand, they can.
        // Let's enforce generating a seal OR signing.

        let finalImage = null;
        if (generatedSeal) {
            finalImage = generatedSeal;
        } else if (signatureCanvasRef.current) {
            finalImage = signatureCanvasRef.current.toDataURL('image/png');
        }

        if (!finalImage) {
            alert("서명 또는 도장이 필요합니다.");
            return;
        }

        try {
            const payload = {
                signature_data: finalImage,
                address: info.address,
                phone: info.phone,
                resident_number: info.resident_number
            };

            const response = await api.post(`/contracts/${id}/sign`, payload);
            if (response.data.status === 'success') {
                alert("서명이 완료되었습니다.");
                navigate('/contracts/my');
            }
        } catch (error) {
            console.error("Error signing contract:", error);
            alert("서명 제출에 실패했습니다.");
        }
    };

    if (loading) return <div className="p-10 text-center">로딩 중...</div>;
    if (!contract) return <div className="p-10 text-center">계약서를 찾을 수 없습니다.</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-4 pb-32">
            <header className="flex items-center gap-4 mb-6">
                <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)} className="p-2 bg-white rounded-full shadow-sm text-slate-600">
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-xl font-bold text-slate-900">
                    {step === 0 && "1. 계약서 확인"}
                    {step === 1 && "2. 정보 입력"}
                    {step === 2 && "3. 전자도장 만들기"}
                    {step === 3 && "4. 서명 및 날인"}
                </h1>
            </header>

            <div className="max-w-xl mx-auto space-y-6">

                <div className="max-w-xl mx-auto space-y-6">

                    {/* SIGNED View Mode */}
                    {isSigned ? (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:shadow-none print:border-none">
                            <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 print:hidden">
                                <Check size={20} />
                                <span className="font-bold text-sm">이미 서명된 계약서입니다. ({new Date(contract.signed_at).toLocaleString()})</span>
                            </div>

                            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-900 leading-relaxed p-4 border rounded-xl bg-white mb-8 font-serif">
                                {contract.content}
                            </div>

                            <div className="mt-8 border-t pt-8">
                                <div className="flex justify-between items-end">
                                    <div className="text-sm space-y-1">
                                        <p><strong>날짜:</strong> {new Date(contract.signed_at).toLocaleDateString()}</p>
                                        <p><strong>서명인:</strong> {contract.staff?.name || '(이름)'}</p>
                                    </div>
                                    <div className="relative w-32 h-32 flex items-center justify-center">
                                        {contract.signature_data ? (
                                            <img src={contract.signature_data} alt="서명" className="w-24 h-24 object-contain mix-blend-multiply" />
                                        ) : (
                                            <span className="text-xs text-slate-400 border px-2 py-1">서명 데이터 없음</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 text-center print:hidden">
                                <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 w-full">
                                    <Download size={20} /> PDF 저장 / 인쇄
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Step 0: Read */}
                            {step === 0 && (
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-700 leading-relaxed h-[60vh] overflow-y-auto p-2 border rounded-xl bg-slate-50">
                                        {contract.content}
                                    </div>
                                    <div className="mt-4 text-center">
                                        <p className="text-sm text-slate-500 mb-4">내용을 모두 확인하셨습니까?</p>
                                        <button onClick={() => setStep(1)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">네, 확인했습니다</button>
                                    </div>
                                </div>
                            )}

                            {/* Step 1: Info Input */}
                            {step === 1 && (
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                                    <h2 className="font-bold text-lg">필수 정보 입력</h2>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">주소 (Address)</label>
                                        <input
                                            value={info.address}
                                            onChange={e => setInfo({ ...info, address: e.target.value })}
                                            placeholder="서울시 광진구..."
                                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">연락처 (Phone)</label>
                                        <input
                                            value={info.phone}
                                            onChange={e => setInfo({ ...info, phone: e.target.value })}
                                            placeholder="010-1234-5678"
                                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">주민등록번호 (RRN)</label>
                                        <input
                                            value={info.resident_number}
                                            onChange={e => setInfo({ ...info, resident_number: e.target.value })}
                                            placeholder="000000-0000000"
                                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (!info.address || !info.phone || !info.resident_number) return alert("모든 정보를 입력해주세요.");
                                            setStep(2);
                                        }}
                                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mt-4"
                                    >
                                        다음 단계로
                                    </button>
                                </div>
                            )}

                            {/* Step 2: Seal Generation */}
                            {step === 2 && (
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                                    <h2 className="font-bold text-lg">전자도장 만들기</h2>

                                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                                        <button
                                            onClick={() => setSealMode('auto')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${sealMode === 'auto' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                                        >
                                            자동 생성
                                        </button>
                                        <button
                                            onClick={() => setSealMode('manual')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${sealMode === 'manual' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                                        >
                                            직접 서명
                                        </button>
                                    </div>

                                    {sealMode === 'auto' ? (
                                        <div className="space-y-4">
                                            <div className="flex gap-2">
                                                <input
                                                    value={sealName}
                                                    onChange={e => setSealName(e.target.value)}
                                                    placeholder="이름 입력 (예: 홍길동)"
                                                    className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200"
                                                    maxLength={4}
                                                />
                                                <button onClick={generateSeal} className="px-4 bg-slate-900 text-white rounded-xl font-bold text-sm">만들기</button>
                                            </div>
                                            <div className="h-40 bg-slate-50 rounded-xl flex items-center justify-center border border-dashed border-slate-300">
                                                {generatedSeal ? (
                                                    <img src={generatedSeal} alt="Seal" className="w-24 h-24 object-contain" />
                                                ) : (
                                                    <span className="text-slate-400 text-sm">이름을 입력하고 만들기를 누르세요</span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="h-40 bg-slate-50 rounded-xl border border-dashed border-slate-300 overflow-hidden relative">
                                                <canvas
                                                    ref={signatureCanvasRef}
                                                    width={500}
                                                    height={200}
                                                    className="w-full h-full cursor-crosshair touch-none"
                                                    onMouseDown={startDrawing}
                                                    onMouseMove={draw}
                                                    onMouseUp={stopDrawing}
                                                    onMouseOut={stopDrawing}
                                                    onTouchStart={startDrawing}
                                                    onTouchMove={draw}
                                                    onTouchEnd={stopDrawing}
                                                />
                                                <button onClick={clearCanvas} className="absolute top-2 right-2 p-1 bg-white rounded shadow text-slate-500"><Eraser size={14} /></button>
                                            </div>
                                            <p className="text-xs text-center text-slate-400 mt-2">화면에 직접 서명하세요.</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            if (sealMode === 'auto' && !generatedSeal) return alert("도장을 만들어주세요.");
                                            // For manual mode, we just check at submit time or check canvas valid here (harder).
                                            setStep(3);
                                        }}
                                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mt-4"
                                    >
                                        도장 사용하기
                                    </button>
                                </div>
                            )}

                            {/* Step 3: Finalize */}
                            {step === 3 && (
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                                    <h2 className="font-bold text-lg">최종 확인 및 날인</h2>

                                    <div className="space-y-2 text-sm text-slate-600 bg-slate-50 p-4 rounded-xl">
                                        <p><span className="font-bold mr-2">이름:</span> {info.address ? '입력됨' : '-'}</p>
                                        <p><span className="font-bold mr-2">주소:</span> {info.address}</p>
                                        <p><span className="font-bold mr-2">연락처:</span> {info.phone}</p>
                                        <p><span className="font-bold mr-2">주민번호:</span> {info.resident_number}</p>
                                    </div>

                                    <div className="flex items-center justify-center p-6 border rounded-xl relative">
                                        <div className="text-slate-300 text-4xl font-serif font-bold opacity-20 absolute z-0 select-none">서명란</div>
                                        <div className="relative z-10">
                                            {generatedSeal ? (
                                                <img src={generatedSeal} alt="Seal" className="w-24 h-24 mix-blend-multiply" />
                                            ) : (
                                                <div className="w-full h-24 flex items-center justify-center text-slate-500 font-bold border-2 border-slate-300 border-dashed rounded-lg p-4">
                                                    (직접 서명됨)
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-xs text-slate-500 text-center">
                                        위 도장(또는 서명)으로 계약서에 날인하며,<br />입력하신 정보가 계약서에 포함됨을 동의합니다.
                                    </p>

                                    <button
                                        onClick={handleSubmit}
                                        className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-200 text-lg flex items-center justify-center gap-2"
                                    >
                                        <Check size={20} /> 계약 완료하기
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

            </div>
        </div>
    );
}
