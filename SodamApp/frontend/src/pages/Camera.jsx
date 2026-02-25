import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera as CameraIcon, X, UploadCloud, ChevronLeft, FileSpreadsheet, FileText } from 'lucide-react';
import api from '../api';

export default function CameraPage() {
    const [activeTab, setActiveTab] = useState('camera'); // 'camera' or 'excel'
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);
    const excelInputRef = useRef(null);
    const navigate = useNavigate();

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Determine endpoint based on tab
            const endpoint = activeTab === 'camera' ? '/upload/image' : '/upload/excel';

            // Simulate delay for effect
            await new Promise(r => setTimeout(r, 800));

            const response = await api.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.status === 'success') {
                if (activeTab === 'camera') {
                    // Navigate to confirmation page for receipt
                    navigate('/confirm', { state: { ...response.data.data } });
                } else {
                    // For Excel, show success and go to Dashboard or Expense List
                    alert(`${response.data.count}건의 내역이 성공적으로 저장되었습니다.`);
                    navigate('/dashboard');
                }
            } else {
                alert('처리 실패: ' + response.data.message);
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("업로드 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
            // Reset inputs
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (excelInputRef.current) excelInputRef.current.value = '';
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 opacity-50 z-0"></div>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
                <button onClick={() => navigate(-1)} className="absolute top-6 left-6 p-2 bg-white/10 rounded-full backdrop-blur-md hover:bg-white/20 transition-colors">
                    <ChevronLeft size={24} />
                </button>

                <div className="flex flex-col items-center mb-8 animate-fade-in-up">
                    <h2 className="text-3xl font-bold mb-3 tracking-tight">영수증 입력</h2>
                    <p className="text-slate-300 text-center leading-relaxed text-sm">
                        영수증 사진 또는 엑셀 파일을 업로드하세요.<br />
                        <span className="text-blue-400 font-semibold">AI가 자동으로 분석</span>하여 장부에 기록합니다.
                    </p>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-slate-800/50 p-1 rounded-full mb-8 backdrop-blur-md border border-slate-700">
                    <button
                        onClick={() => setActiveTab('camera')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${activeTab === 'camera' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <CameraIcon size={16} />
                        촬영/이미지
                    </button>
                    <button
                        onClick={() => setActiveTab('excel')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${activeTab === 'excel' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <FileSpreadsheet size={16} />
                        엑셀 업로드
                    </button>
                </div>

                {/* Upload Area */}
                <div
                    onClick={() => activeTab === 'camera' ? fileInputRef.current?.click() : excelInputRef.current?.click()}
                    className="relative group cursor-pointer w-full max-w-sm"
                >
                    <div className={`absolute inset-0 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 ${activeTab === 'camera' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                    <div className={`relative w-full aspect-square bg-slate-800/50 backdrop-blur-xl border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all duration-300 group-hover:scale-105 group-active:scale-95 ${activeTab === 'camera' ? 'border-slate-600 group-hover:border-blue-500/50' : 'border-slate-600 group-hover:border-emerald-500/50'}`}>
                        {loading ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className={`w-16 h-16 border-4 border-t-transparent rounded-full animate-spin ${activeTab === 'camera' ? 'border-blue-500' : 'border-emerald-500'}`}></div>
                                <p className={`text-sm font-medium animate-pulse ${activeTab === 'camera' ? 'text-blue-400' : 'text-emerald-400'}`}>
                                    {activeTab === 'camera' ? '이미지 분석 중...' : '엑셀 데이터 처리 중...'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg transform group-hover:-translate-y-2 transition-transform duration-300 ${activeTab === 'camera' ? 'bg-gradient-to-tr from-blue-500 to-indigo-600' : 'bg-gradient-to-tr from-emerald-500 to-teal-600'}`}>
                                    {activeTab === 'camera' ? <CameraIcon size={32} className="text-white" /> : <FileSpreadsheet size={32} className="text-white" />}
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-lg mb-1">
                                        {activeTab === 'camera' ? '터치하여 촬영' : '엑셀 파일 선택'}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {activeTab === 'camera' ? '또는 갤러리에서 선택' : '.xlsx, .xls 파일 지원'}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Hidden Inputs */}
            <input
                type="file"
                accept="image/*"
                capture="environment" // Optional: prefer camera on mobile
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />
            <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                ref={excelInputRef}
                onChange={handleFileChange}
            />
        </div>
    );
}
