import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera as CameraIcon, X, UploadCloud, ChevronLeft, FileSpreadsheet, FileText, TrendingUp, ShoppingBag } from 'lucide-react';
import api from '../api';

export default function DataInputPage({ mode }) { // mode: 'revenue' | 'expense'
    const isRevenue = mode === 'revenue';

    // UI Config based on mode
    const config = {
        title: isRevenue ? "매출 입력" : "매입 입력",
        desc: isRevenue ? "매출 내역을 이미지나 엑셀로 등록하세요." : "지출 영수증이나 엑셀을 등록하세요.",
        themeColor: isRevenue ? "blue" : "indigo", // Revenue: Blue, Expense: Indigo
        icon: isRevenue ? TrendingUp : ShoppingBag,
        endpoints: {
            image: isRevenue ? '/upload/image/revenue' : '/upload/image/expense',
            excel: isRevenue ? '/upload/excel/revenue' : '/upload/excel/expense'
        },
        excelMessage: isRevenue ? "필수 컬럼: 날짜, 금액, 채널(옵션)" : "여러 파일 선택 가능 (필수: 날짜, 항목, 금액)"
    };

    const [activeTab, setActiveTab] = useState('camera'); // 'camera' or 'excel'
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const fileInputRef = useRef(null);
    const excelInputRef = useRef(null);
    const navigate = useNavigate();

    const handleFileChange = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setLoading(true);

        // For camera/image upload, just handle single file
        if (activeTab === 'camera') {
            const file = files[0];
            const formData = new FormData();
            formData.append('file', file);

            try {
                await new Promise(r => setTimeout(r, 800));
                const response = await api.post(config.endpoints.image, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (response.data.status === 'success') {
                    if (isRevenue) {
                        alert("이미지가 성공적으로 분석되었습니다. (Mock)");
                        navigate('/');
                    } else {
                        navigate('/confirm', { state: { ...response.data.data } });
                    }
                } else {
                    alert('처리 실패: ' + response.data.message);
                }
            } catch (error) {
                console.error("Upload error:", error);
                alert("업로드 중 오류가 발생했습니다.");
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
            return;
        }

        // For Excel upload, handle multiple files
        let totalCount = 0;
        let successCount = 0;
        let errorFiles = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setUploadProgress(`(${i + 1}/${files.length}) ${file.name} 처리 중...`);

                const formData = new FormData();
                formData.append('file', file);

                try {
                    const response = await api.post(config.endpoints.excel, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });

                    if (response.data.status === 'success') {
                        totalCount += response.data.count || 0;
                        successCount++;
                    } else {
                        errorFiles.push(`${file.name}: ${response.data.message}`);
                    }
                } catch (error) {
                    console.error(`Upload error for ${file.name}:`, error);
                    errorFiles.push(`${file.name}: 업로드 실패`);
                }
            }

            // Show result summary
            let message = `${successCount}개 파일 처리 완료, 총 ${totalCount}건 저장됨`;
            if (errorFiles.length > 0) {
                message += `\n\n실패한 파일:\n${errorFiles.join('\n')}`;
            }
            alert(message);
            navigate('/');

        } catch (error) {
            console.error("Upload error:", error);
            alert("업로드 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
            setUploadProgress('');
            if (excelInputRef.current) excelInputRef.current.value = '';
        }
    };

    const ThemeIcon = config.icon;
    const themeClass = isRevenue ? "text-blue-500" : "text-indigo-500";
    const bgThemeClass = isRevenue ? "bg-blue-600" : "bg-indigo-600";
    const borderThemeClass = isRevenue ? "border-blue-500" : "border-indigo-500";

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 ${isRevenue ? 'to-blue-900' : 'to-indigo-900'} opacity-50 z-0`}></div>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
                <button onClick={() => navigate(-1)} className="absolute top-6 left-6 p-2 bg-white/10 rounded-full backdrop-blur-md hover:bg-white/20 transition-colors">
                    <ChevronLeft size={24} />
                </button>

                <div className="flex flex-col items-center mb-8 animate-fade-in-up">
                    <div className={`p-3 rounded-2xl mb-4 bg-white/10 backdrop-blur-sm`}>
                        <ThemeIcon size={32} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-bold mb-3 tracking-tight">{config.title}</h2>
                    <p className="text-slate-300 text-center leading-relaxed text-sm">
                        {config.desc}<br />
                        <span className={`${themeClass} font-semibold`}>AI 자동 분석</span>이 지원됩니다.
                    </p>
                </div>

                <div className="flex bg-slate-800/50 p-1 rounded-full mb-8 backdrop-blur-md border border-slate-700">
                    <button
                        onClick={() => setActiveTab('camera')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${activeTab === 'camera' ? `${bgThemeClass} text-white shadow-lg` : 'text-slate-400 hover:text-white'}`}
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

                <div
                    onClick={() => activeTab === 'camera' ? fileInputRef.current?.click() : excelInputRef.current?.click()}
                    className="relative group cursor-pointer w-full max-w-sm"
                >
                    <div className={`absolute inset-0 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 ${activeTab === 'camera' ? themeClass.replace('text', 'bg') : 'bg-emerald-500'}`}></div>
                    <div className={`relative w-full aspect-square bg-slate-800/50 backdrop-blur-xl border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all duration-300 group-hover:scale-105 group-active:scale-95 ${activeTab === 'camera' ? `border-slate-600 group-hover:${borderThemeClass}/50` : 'border-slate-600 group-hover:border-emerald-500/50'}`}>
                        {loading ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className={`w-16 h-16 border-4 border-t-transparent rounded-full animate-spin ${activeTab === 'camera' ? borderThemeClass : 'border-emerald-500'}`}></div>
                                <p className={`text-sm font-medium animate-pulse ${activeTab === 'camera' ? themeClass : 'text-emerald-400'}`}>
                                    {uploadProgress || '처리 중입니다...'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg transform group-hover:-translate-y-2 transition-transform duration-300 ${activeTab === 'camera' ? `bg-gradient-to-tr ${isRevenue ? 'from-blue-500 to-cyan-600' : 'from-indigo-500 to-purple-600'}` : 'bg-gradient-to-tr from-emerald-500 to-teal-600'}`}>
                                    {activeTab === 'camera' ? <CameraIcon size={32} className="text-white" /> : <FileSpreadsheet size={32} className="text-white" />}
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-lg mb-1">
                                        {activeTab === 'camera' ? '터치하여 촬영' : '엑셀 파일 선택'}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {activeTab === 'camera' ? '또는 갤러리에서 선택' : config.excelMessage}
                                    </p>
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
            <input
                type="file"
                accept=".xlsx, .xls"
                multiple
                className="hidden"
                ref={excelInputRef}
                onChange={handleFileChange}
            />
        </div>
    );
}

