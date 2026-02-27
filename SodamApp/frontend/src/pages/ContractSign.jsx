import { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
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

                // Pre-fill fields if available in linked staff
                if (data.staff) {
                    setInfo(prev => ({
                        ...prev,
                        address: data.staff.address || prev.address,
                        phone: data.staff.phone || prev.phone,
                        resident_number: data.staff.resident_number || prev.resident_number
                    }));
                }
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

    // --- Contract Text Formatter ---
    const formatContractText = (text, isA4 = false) => {
        if (!text) return null;
        let content = text.replace(/^표\s*준\s*근\s*로\s*계\s*약\s*서\s*\n*/, '');

        // Extract the signature block (starts near the bottom with a year or (사업주))
        const signMatch = content.match(/(\d{4}년\s*\d*월\s*\d*일\s*\n)?\(사업주\)/);
        let bodyText = content;
        let signText = "";

        if (signMatch) {
            bodyText = content.substring(0, signMatch.index);
            signText = content.substring(signMatch.index);
        }

        const renderBody = (textBody) => {
            return textBody.split('\n').map((line, idx) => {
                const trimmed = line.trim();
                if (/^\d+\.\s/.test(trimmed)) {
                    return <div key={idx} className={`font-bold text-slate-900 mt-3 mb-1 ${isA4 ? 'text-[14px]' : 'text-[15px]'}`}>{line}</div>;
                }
                if (trimmed.startsWith('-')) {
                    return <div key={idx} className={`pl-4 text-slate-700 leading-relaxed mb-0.5 ${isA4 ? 'text-[13px]' : 'text-[14px]'}`}>{line}</div>;
                }
                return <div key={idx} className={`text-slate-800 leading-[1.6] min-h-[1.2em] ${isA4 ? 'text-[13px]' : 'text-[14px]'}`}>{line}</div>;
            });
        };

        const renderSignatures = (textSign) => {
            if (!textSign) return null;
            // Use monospace to perfectly preserve space-based manual alignments
            return (
                <div className={`mt-4 p-4 border-2 border-slate-200 rounded-xl bg-slate-50 relative ${isA4 ? 'font-mono text-[11px] leading-[1.8]' : 'font-mono text-[13px] leading-[2]'}`}>
                    <div className="whitespace-pre text-slate-800 overflow-x-auto print:overflow-hidden print:whitespace-pre-wrap">
                        {textSign}
                    </div>
                    {/* Stamp Overlay */}
                    {isSigned && contract?.signature_data && (
                        <div className="absolute opacity-90" style={{ bottom: '12px', right: '35%' }}>
                            <img src={contract.signature_data} alt="서명" className="w-16 h-16 object-contain mix-blend-multiply" />
                        </div>
                    )}
                </div>
            );
        };

        return (
            <div className="text-left w-full w-full">
                {renderBody(bodyText)}
                {renderSignatures(signText)}
            </div>
        );
    };

    // --- A4 Viewer Scale (hooks must be before early returns) ---
    const containerRef = useRef(null);
    const [viewScale, setViewScale] = useState(0.5);

    useEffect(() => {
        if (!isSigned || !containerRef.current) return;
        const calcScale = () => {
            if (!containerRef.current) return;
            const cw = containerRef.current.clientWidth;
            const a4WidthPx = 210 * 3.78;
            setViewScale(Math.min((cw - 32) / a4WidthPx, 1));
        };
        calcScale();
        const ro = new ResizeObserver(calcScale);
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [isSigned]);

    if (loading) return <div className="p-10 text-center">로딩 중...</div>;
    if (!contract) return <div className="p-10 text-center">계약서를 찾을 수 없습니다.</div>;

    // --- A4 Contract Paper Component ---
    const ContractA4 = ({ isPrint = false, scale = 1 }) => {
        const paperStyle = isPrint ? {
            width: '210mm', height: '297mm', margin: 0, padding: '20mm 18mm',
            backgroundColor: 'white', transform: 'none', boxShadow: 'none', position: 'relative',
        } : {
            width: '210mm', height: '297mm', transform: `scale(${scale})`, transformOrigin: 'top center',
            backgroundColor: 'white', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '20mm 18mm', position: 'relative',
        };
        return (
            <div style={paperStyle} className="text-slate-900 font-serif">
                {/* Title */}
                <h1 className="text-center text-2xl font-black tracking-[0.3em] mb-6 pb-3 border-b-[3px] border-double border-slate-800">
                    표 준 근 로 계 약 서
                </h1>

                {/* Contract Body formatted */}
                <div className="relative">
                    {formatContractText(contract.content, true)}
                </div>

                {/* Footer */}
                <div className="absolute bottom-[18mm] left-[18mm] right-[18mm] border-t-2 border-slate-300 pt-3">
                    <div className="flex justify-between items-center text-[11px] text-slate-500">
                        <div className="space-y-0.5">
                            <p><span className="font-bold text-slate-700">서명일:</span> {new Date(contract.signed_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p><span className="font-bold text-slate-700">서명인:</span> {contract.staff?.name || '(이름)'}</p>
                        </div>
                        <div className="text-right text-[10px] text-slate-400 italic">
                            본 계약서는 전자서명법에 의한<br />전자서명으로 체결되었습니다.
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 pb-32 print:p-0 print:bg-white print:pb-0">
            {/* Print Portal Styles */}
            <style>{`
                @page { size: A4; margin: 0; }
                @media print {
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    body > * { display: none !important; }
                    body > .contract-print-portal { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; overflow: visible !important; }
                    html, body { background: white !important; height: 100% !important; margin: 0 !important; padding: 0 !important; }
                    .no-print { display: none !important; }
                }
                @media screen { .contract-print-portal { display: none; } }
            `}</style>

            <header className="flex items-center gap-4 mb-6 no-print">
                <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)} className="p-2 bg-white rounded-full shadow-sm text-slate-600">
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-xl font-bold text-slate-900">
                    {isSigned ? "전자 근로계약서" : step === 0 ? "1. 계약서 확인" : step === 1 ? "2. 정보 입력" : step === 2 ? "3. 전자도장 만들기" : "4. 서명 및 날인"}
                </h1>
            </header>

            {isSigned ? (
                <div className="w-full">
                    {/* Status Banner */}
                    <div className="max-w-3xl mx-auto mb-4 no-print">
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                            <Check size={20} />
                            <span className="font-bold text-sm">이미 서명된 계약서입니다. ({new Date(contract.signed_at).toLocaleString()})</span>
                        </div>
                    </div>

                    {/* A4 Paper Viewer */}
                    <div ref={containerRef} className="w-full flex justify-center bg-slate-200/50 rounded-2xl py-8 px-4 no-print" style={{ minHeight: '60vh' }}>
                        <div style={{ transformOrigin: 'top center', height: `${297 * 3.78 * viewScale}px` }}>
                            <ContractA4 scale={viewScale} isPrint={false} />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="max-w-3xl mx-auto mt-4 no-print">
                        <button onClick={() => window.print()} className="w-full bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg">
                            <Download size={20} /> PDF 저장 / 인쇄
                        </button>
                    </div>

                    {/* Print Portal (hidden on screen, shown on print) */}
                    {typeof document !== 'undefined' && ReactDOM.createPortal(
                        <div className="contract-print-portal"><ContractA4 isPrint={true} scale={1} /></div>,
                        document.body
                    )}
                </div>
            ) : (
                <div className="max-w-xl mx-auto space-y-6">
                    {/* Step 0: Read */}
                    {step === 0 && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="h-[60vh] overflow-y-auto p-4 border rounded-xl bg-white mb-4">
                                {formatContractText(contract.content, false)}
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
                </div>
            )}
        </div>
    );
}
