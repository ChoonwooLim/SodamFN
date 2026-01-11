import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, Eraser, Download, FileText } from 'lucide-react';
import api from '../api';

export default function ContractSignPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [contract, setContract] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSigned, setIsSigned] = useState(false);

    // Canvas Refs
    const canvasRef = useRef(null);
    const isDrawing = useRef(false);

    useEffect(() => {
        fetchContract();
    }, [id]);

    const fetchContract = async () => {
        try {
            const response = await api.get(`/contracts/${id}`);
            if (response.data.status === 'success') {
                setContract(response.data.data);
                if (response.data.data.status === 'signed') {
                    setIsSigned(true);
                }
            }
        } catch (error) {
            console.error("Error fetching contract:", error);
        } finally {
            setLoading(false);
        }
    };

    // Drawing Logic
    const startDrawing = (e) => {
        isDrawing.current = true;
        draw(e);
    };

    const stopDrawing = () => {
        isDrawing.current = false;
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath(); // Reset path
    };

    const draw = (e) => {
        if (!isDrawing.current || isSigned) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();

        // Handle touch or mouse
        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

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
        if (isSigned) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSubmit = async () => {
        if (isSigned) return;

        const signatureData = canvasRef.current.toDataURL('image/png');

        try {
            const response = await api.post(`/contracts/${id}/sign`, { signature_data: signatureData });
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
        <div className="min-h-screen bg-slate-50 p-4 pb-20">
            <div className="max-w-2xl mx-auto">
                <header className="flex items-center gap-4 mb-6">
                    <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm text-slate-600">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900">{contract.title}</h1>
                </header>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 space-y-6 overflow-hidden">
                    <div className="border-b border-slate-100 pb-4 flex items-center gap-3">
                        <FileText className="text-blue-500" size={24} />
                        <h2 className="text-lg font-bold text-slate-900">계약 내용</h2>
                    </div>

                    <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-700 leading-relaxed font-medium">
                        {contract.content}
                    </div>

                    {!isSigned ? (
                        <div className="space-y-4 pt-6 mt-6 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-700">서명란 (Handwriting)</label>
                                <button
                                    onClick={clearCanvas}
                                    className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <Eraser size={14} /> 다시 그리기
                                </button>
                            </div>
                            <canvas
                                ref={canvasRef}
                                width={500}
                                height={200}
                                className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-crosshair touch-none"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseOut={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                            <p className="text-xs text-slate-400 text-center">
                                * 위 캔버스에 직접 서명해 주세요. 서명은 법적 효력이 발생합니다.
                            </p>

                            <button
                                onClick={handleSubmit}
                                className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                            >
                                <Check size={20} /> 서명 완료 및 제출
                            </button>
                        </div>
                    ) : (
                        <div className="pt-6 mt-6 border-t border-slate-100 space-y-4">
                            <div className="bg-emerald-50 p-4 rounded-2xl flex items-center gap-3 text-emerald-700 font-bold">
                                <Check className="bg-emerald-500 text-white rounded-full p-0.5" size={20} />
                                이미 서명된 계약서입니다.
                            </div>
                            <div className="p-4 border border-slate-100 rounded-2xl flex items-center justify-center">
                                <img src={contract.signature_data} alt="Signature" className="max-h-24" />
                            </div>
                            <div className="text-center text-xs text-slate-400">
                                서명 일시: {new Date(contract.signed_at).toLocaleString()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
