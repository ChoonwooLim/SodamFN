import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera as CameraIcon, X, UploadCloud, ChevronLeft } from 'lucide-react';
import api from '../api';

export default function CameraPage() {
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Simulate delay for effect
            await new Promise(r => setTimeout(r, 1000));

            const response = await api.post('/ocr/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.status === 'success') {
                navigate('/confirm', { state: { ...response.data.data } });
            } else {
                alert('OCR Failed: ' + response.data.message);
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("업로드 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 opacity-50 z-0"></div>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
                <button onClick={() => navigate(-1)} className="absolute top-6 left-6 p-2 bg-white/10 rounded-full backdrop-blur-md">
                    <ChevronLeft size={24} />
                </button>

                <div className="flex flex-col items-center mb-12 animate-fade-in-up">
                    <h2 className="text-3xl font-bold mb-3 tracking-tight">영수증 촬영</h2>
                    <p className="text-slate-300 text-center leading-relaxed">
                        매입 영수증을 촬영하면<br />
                        <span className="text-blue-400 font-semibold">AI가 자동으로 분석</span>하여 장부에 기록합니다.
                    </p>
                </div>

                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group cursor-pointer"
                >
                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                    <div className="relative w-64 h-64 bg-slate-800/50 backdrop-blur-xl border-2 border-dashed border-slate-600 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all duration-300 group-hover:scale-105 group-hover:border-blue-500/50 group-active:scale-95">
                        {loading ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm font-medium text-blue-400 animate-pulse">분석 중입니다...</p>
                            </div>
                        ) : (
                            <>
                                <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg transform group-hover:-translate-y-2 transition-transform duration-300">
                                    <CameraIcon size={32} className="text-white" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-lg mb-1">터치하여 촬영</p>
                                    <p className="text-xs text-slate-400">또는 갤러리에서 선택</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />
        </div>
    );
}
