import React, { useRef, useState } from 'react';
import { UploadCloud, RotateCcw, X, FileSpreadsheet, Camera } from 'lucide-react';
import api from '../../api';
import { formatNumber } from '../../utils/format';
import UploadHistoryList from '../../components/UploadHistoryList';
import { EXPENSE_CATEGORIES } from '../../utils/constants';

// Card company colors for upload display
const CARD_COLORS = {
    '롯데카드': { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
    '삼성카드': { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' },
    '신한카드': { bg: '#d1fae5', text: '#059669', border: '#6ee7b7' },
    '신한은행': { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' },
    '국민은행': { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
    '수협은행': { bg: '#cffafe', text: '#0e7490', border: '#67e8f9' },
    '현대카드': { bg: '#f3f4f6', text: '#1f2937', border: '#d1d5db' },
    '기타': { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
};

export function UploadPanel({ fetchData }) {
    const [uploadTab, setUploadTab] = useState('camera'); // camera | excel | history
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [uploadResult, setUploadResult] = useState(null);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const [ocrResult, setOcrResult] = useState(null);

    // Vendor Review Modal (2-step upload)
    const [showVendorReview, setShowVendorReview] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [vendorDecisions, setVendorDecisions] = useState({});
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [showNewCategoryFor, setShowNewCategoryFor] = useState(null);
    const [excludedVendors, setExcludedVendors] = useState(new Set());
    const [dismissedSimilars, setDismissedSimilars] = useState(new Set());

    // ─── Upload (2-step: preview → review → confirm) ───
    const handleUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadLoading(true);
        setUploadResult(null);

        try {
            const file = files[0];
            setUploadProgress(`${file.name} 분석 중...`);
            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post('/purchase/upload/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000,
            });

            if (response.data.status === 'error') {
                setUploadResult([{ file: file.name, status: 'error', message: response.data.message }]);
                return;
            }

            const preview = response.data;
            setPreviewData(preview);

            if (preview.vendor_review && preview.vendor_review.length > 0) {
                const initialDecisions = {};
                preview.vendor_review.forEach(vr => {
                    if (vr.is_new) {
                        initialDecisions[vr.vendor_name] = { action: 'new', category: null };
                    } else {
                        initialDecisions[vr.vendor_name] = { action: null, vendor_id: null, category: null };
                    }
                });
                setVendorDecisions(initialDecisions);
                setExcludedVendors(new Set());
                setShowVendorReview(true);
            } else {
                await confirmUpload(preview.records, {}, preview.original_filename);
            }

            if (files.length > 1) {
                let extraResults = [];
                for (let i = 1; i < files.length; i++) {
                    const extraFile = files[i];
                    setUploadProgress(`(${i + 1}/${files.length}) ${extraFile.name} 처리 중...`);
                    const extraForm = new FormData();
                    extraForm.append('file', extraFile);
                    try {
                        const extraRes = await api.post('/purchase/upload', extraForm, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        extraResults.push({ file: extraFile.name, ...extraRes.data });
                    } catch (error) {
                        extraResults.push({ file: extraFile.name, status: 'error', message: error.response?.data?.detail || '업로드 실패' });
                    }
                }
                if (extraResults.length > 0) {
                    setUploadResult(prev => [...(prev || []), ...extraResults]);
                }
            }
        } catch (error) {
            let msg = '업로드 실패';
            if (error.code === 'ECONNABORTED') {
                msg = 'PDF 파싱 시간 초과 (60초). 파일 크기를 확인하세요.';
            } else if (error.response?.data?.detail) {
                msg = typeof error.response.data.detail === 'string'
                    ? error.response.data.detail
                    : JSON.stringify(error.response.data.detail);
            } else if (error.message) {
                msg = error.message;
            }
            console.error('Upload error:', error);
            setUploadResult([{ file: files[0].name, status: 'error', message: msg }]);
        } finally {
            setUploadLoading(false);
            setUploadProgress('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const confirmUpload = async (records, decisions, originalFilename = null) => {
        setConfirmLoading(true);
        try {
            const response = await api.post('/purchase/upload/confirm', {
                records,
                vendor_decisions: decisions,
                original_filename: originalFilename || previewData?.original_filename,
            });
            setUploadResult(prev => [
                ...(prev || []),
                { file: previewData?.card_company || '업로드', ...response.data }
            ]);
            setShowVendorReview(false);
            setPreviewData(null);
            setVendorDecisions({});
            fetchData();
        } catch (error) {
            alert('업로드 확인 중 오류가 발생했습니다: ' + (error.response?.data?.detail || error.message));
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleVendorDecision = (vendorName, action, vendorId = null) => {
        setVendorDecisions(prev => ({
            ...prev,
            [vendorName]: {
                action,
                vendor_id: vendorId,
                category: action === 'merge' ? null : prev[vendorName]?.category,
            }
        }));
        if (action === 'new') {
            setShowNewCategoryFor(vendorName);
        }
    };

    const handleNewVendorCategory = (vendorName, category) => {
        setVendorDecisions(prev => ({
            ...prev,
            [vendorName]: {
                ...prev[vendorName],
                action: 'new',
                category,
            }
        }));
        setShowNewCategoryFor(null);
    };

    const toggleExcludeVendor = (vendorName) => {
        setExcludedVendors(prev => {
            const next = new Set(prev);
            if (next.has(vendorName)) next.delete(vendorName);
            else next.add(vendorName);
            return next;
        });
    };

    const canConfirmUpload = () => {
        if (!previewData?.vendor_review) return true;
        return previewData.vendor_review.every(vr => {
            if (excludedVendors.has(vr.vendor_name)) return true;
            const dec = vendorDecisions[vr.vendor_name];
            if (!dec) return false;
            if (dec.action === 'merge' && dec.vendor_id) return true;
            if (dec.action === 'new' && dec.category) return true;
            return false;
        });
    };

    return (
        <>
            <div className="space-y-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate">
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-4">
                        <button
                            className={`flex items-center gap-1.5 px-4 py-2 border-none text-xs font-semibold cursor-pointer rounded-lg transition-all ${uploadTab === 'camera' ? 'bg-gradient-to-r from-teal-700 to-teal-900 text-white shadow-md shadow-teal-700/20' : 'bg-transparent text-slate-500 hover:bg-slate-200'}`}
                            onClick={() => { setUploadTab('camera'); setOcrResult(null); }}
                        >
                            <Camera size={16} /> 촬영/이미지
                        </button>
                        <button
                            className={`flex items-center gap-1.5 px-4 py-2 border-none text-xs font-semibold cursor-pointer rounded-lg transition-all ${uploadTab === 'excel' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-transparent text-slate-500 hover:bg-slate-200'}`}
                            onClick={() => setUploadTab('excel')}
                        >
                            <FileSpreadsheet size={16} /> 문서 업로드
                        </button>
                        <button
                            className={`flex items-center gap-1.5 px-4 py-2 border-none text-xs font-semibold cursor-pointer rounded-lg transition-all ${uploadTab === 'history' ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md shadow-slate-700/20' : 'bg-transparent text-slate-500 hover:bg-slate-200'}`}
                            onClick={() => setUploadTab('history')}
                        >
                            <RotateCcw size={16} /> 취소/기록
                        </button>
                    </div>

                    {uploadTab === 'history' ? (
                        <div className="mt-2">
                            <UploadHistoryList type="purchase" onRollback={fetchData} />
                        </div>
                    ) : uploadTab === 'camera' ? (
                        <>
                            {!ocrResult ? (
                                <div
                                    className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-teal-700 hover:bg-teal-50/30 transition-all"
                                    onClick={() => !uploadLoading && imageInputRef.current?.click()}
                                >
                                    {uploadLoading ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-3 border-slate-200 border-t-teal-700 rounded-full animate-spin" />
                                            <p className="text-sm text-slate-500">🔍 영수증 분석 중...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-700 to-teal-900 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-700/20 text-white">
                                                <Camera size={32} />
                                            </div>
                                            <p className="text-base font-bold text-slate-700 mb-1">
                                                영수증 촬영 또는 이미지 선택
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                비용 영수증을 촬영하면 자동으로 거래처, 금액, 날짜를 분석합니다
                                            </p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600">
                                        <span className="text-xs font-bold text-white">📸 분석 완료</span>
                                        <span className="text-[11px] font-semibold text-emerald-100">정확도 {Math.round((ocrResult.confidence || 0.9) * 100)}%</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-400 font-semibold">🏪 거래처</span>
                                            <span className="text-sm font-bold text-slate-800">{ocrResult.vendor_name}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-400 font-semibold">💰 금액</span>
                                            <span className="text-sm font-extrabold text-blue-600">{formatNumber(ocrResult.total_amount || 0)}원</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-400 font-semibold">📅 날짜</span>
                                            <span className="text-sm font-bold text-slate-800">{ocrResult.date}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-400 font-semibold">📂 카테고리</span>
                                            <span className="text-sm font-bold text-slate-800">{ocrResult.category}</span>
                                        </div>
                                        {ocrResult.items && ocrResult.items.length > 0 && (
                                            <div className="pt-2 border-t border-slate-200">
                                                <span className="text-xs text-slate-400 font-semibold block mb-2">🛒 품목</span>
                                                <div className="space-y-1">
                                                    {ocrResult.items.map((item, i) => (
                                                        <div key={i} className="flex justify-between text-xs">
                                                            <span className="text-slate-600">{item.name}</span>
                                                            <span className="font-bold text-slate-700 tabular-nums">{formatNumber(item.amount)}원</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 px-4 pb-3">
                                        <button className="flex-1 py-2.5 rounded-xl bg-slate-200 text-slate-600 text-xs font-bold border-none cursor-pointer hover:bg-slate-300 transition-colors" onClick={() => setOcrResult(null)}>🔄 다시 촬영</button>
                                        <button className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold border-none cursor-pointer shadow-md shadow-emerald-500/20 hover:shadow-lg transition-all" onClick={() => { setOcrResult(null); fetchData(); }}>
                                            ✅ 저장 완료
                                        </button>
                                    </div>
                                    <p className="text-center text-[11px] text-emerald-500 font-medium pb-3">✅ 데이터가 이미 자동 저장되었습니다</p>
                                </div>
                            )}
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploadLoading(true);
                                    setOcrResult(null);
                                    try {
                                        const formData = new FormData();
                                        formData.append('file', file);
                                        const response = await api.post('/upload/image/purchase', formData, {
                                            headers: { 'Content-Type': 'multipart/form-data' },
                                            timeout: 30000,
                                        });
                                        if (response.data.status === 'success') {
                                            setOcrResult(response.data.data);
                                        } else {
                                            alert('분석 실패: ' + (response.data.message || '알 수 없는 오류'));
                                        }
                                    } catch (err) {
                                        console.error('Image upload error:', err);
                                        alert('업로드 중 오류: ' + (err.response?.data?.detail || err.message));
                                    } finally {
                                        setUploadLoading(false);
                                        if (imageInputRef.current) imageInputRef.current.value = '';
                                    }
                                }}
                            />
                        </>
                    ) : (
                        <>
                            <div
                                className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                                onClick={() => !uploadLoading && fileInputRef.current?.click()}
                            >
                                {uploadLoading ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                                        <p className="text-sm text-slate-500">{uploadProgress || '처리 중입니다...'}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20 text-white">
                                            <UploadCloud size={32} />
                                        </div>
                                        <p className="text-base font-bold text-slate-700 mb-1">
                                            클릭하여 문서 파일 선택
                                        </p>
                                        <p className="text-xs text-slate-400 mb-3">
                                            .xls, .xlsx, .pdf, .csv 파일 — 여러 파일 동시 가능
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 justify-center">
                                            {Object.entries(CARD_COLORS).filter(([k]) => k !== '기타').map(([card, colors]) => (
                                                <span key={card} className="text-[10px] font-bold px-2 py-1 rounded-md border" style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}>
                                                    {card}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xls,.xlsx,.pdf,.csv"
                                multiple
                                onChange={handleUpload}
                                style={{ display: 'none' }}
                            />

                            {/* Upload Results */}
                            {uploadResult && (
                                <div className="mt-4 space-y-2">
                                    {uploadResult.map((r, i) => (
                                        <div key={i} className={`rounded-xl p-3 border ${r.status === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                            <div className="text-xs font-bold text-slate-700 mb-1">{r.file}</div>
                                            {r.status === 'success' ? (
                                                <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                                                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{r.card_company}</span>
                                                    <span className="text-emerald-600">✅ {r.count}건 저장</span>
                                                    {r.skipped > 0 && <span className="text-amber-600">⏭️ {r.skipped}건 중복</span>}
                                                    {r.vendors_created > 0 && <span className="text-violet-600">🏪 {r.vendors_created}개 거래처 생성</span>}
                                                    {r.auto_classified > 0 && <span className="text-sky-600">🤖 {r.auto_classified}건 자동분류</span>}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-red-600 font-medium">❌ {r.message}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* VENDOR REVIEW MODAL (2-step upload) */}
            {showVendorReview && previewData && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                            <h3 className="text-base font-bold text-slate-800">🔍 거래처 확인 ({previewData.card_company})</h3>
                            <button className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center border-none cursor-pointer text-slate-400 transition-colors" onClick={() => { setShowVendorReview(false); setPreviewData(null); }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5">
                            {/* Summary */}
                            <div style={{ background: '#0f172a', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                                    <span style={{ color: '#94a3b8' }}>📋 총 파싱: <strong style={{ color: '#e2e8f0' }}>{previewData.total_parsed}건</strong></span>
                                    {previewData.auto_classified > 0 && (
                                        <span style={{ color: '#94a3b8' }}>🤖 자동분류: <strong style={{ color: '#38bdf8' }}>{previewData.auto_classified}건</strong></span>
                                    )}
                                    <span style={{ color: '#94a3b8' }}>🔍 확인 필요: <strong style={{ color: '#fb923c' }}>{previewData.vendor_review.length}건</strong></span>
                                    {excludedVendors.size > 0 && (
                                        <span style={{ color: '#ef4444' }}>🚫 제외: <strong>{excludedVendors.size}개 거래처</strong></span>
                                    )}
                                </div>
                            </div>

                            {/* Vendor Review List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {previewData.vendor_review.map((vr, idx) => {
                                    const dec = vendorDecisions[vr.vendor_name] || {};
                                    const isExcluded = excludedVendors.has(vr.vendor_name);
                                    const isDecided = isExcluded || (dec.action === 'merge' && dec.vendor_id) || (dec.action === 'new' && dec.category);

                                    return (
                                        <div key={idx} style={{
                                            background: isDecided ? '#0f291a' : '#1e293b',
                                            border: `1px solid ${isDecided ? '#16a34a' : '#334155'}`,
                                            borderRadius: 12,
                                            padding: '14px 16px',
                                            transition: 'all 0.2s',
                                        }}>
                                            {/* Vendor Name Header */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isExcluded ? 0 : 10 }}>
                                                <div>
                                                    <span style={{ fontWeight: 700, fontSize: 15, color: isExcluded ? '#64748b' : '#f1f5f9', textDecoration: isExcluded ? 'line-through' : 'none' }}>
                                                        {vr.vendor_name}
                                                    </span>
                                                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                                                        {vr.record_count}건 · {formatNumber(vr.total_amount)}원
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    {isExcluded ? (
                                                        <button onClick={() => toggleExcludeVendor(vr.vendor_name)}
                                                            style={{ fontSize: 11, background: '#334155', color: '#94a3b8', padding: '4px 10px', borderRadius: 6, fontWeight: 600, border: '1px solid #475569', cursor: 'pointer' }}>
                                                            ↩ 복원
                                                        </button>
                                                    ) : (
                                                        <>
                                                            {isDecided && (
                                                                <span style={{ fontSize: 11, background: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                                                                    ✓ 결정완료
                                                                </span>
                                                            )}
                                                            <button onClick={() => toggleExcludeVendor(vr.vendor_name)}
                                                                style={{ fontSize: 11, background: '#7f1d1d', color: '#fca5a5', padding: '4px 10px', borderRadius: 6, fontWeight: 600, border: '1px solid #991b1b', cursor: 'pointer' }}>
                                                                🚫 제외
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {!isExcluded && (<>
                                                {/* Similar Vendors */}
                                                {vr.similar_vendors.length > 0 && (
                                                    <div style={{ marginBottom: 10 }}>
                                                        <div style={{ fontSize: 12, color: '#fb923c', fontWeight: 600, marginBottom: 6 }}>
                                                            ⚠️ 유사한 기존 거래처가 있습니다:
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {vr.similar_vendors.map(sv => {
                                                                const dismissKey = `${vr.vendor_name}::${sv.id}`;
                                                                const isDismissed = dismissedSimilars.has(dismissKey);
                                                                const isMerged = dec.action === 'merge' && dec.vendor_id === sv.id;

                                                                if (isDismissed) {
                                                                    return (
                                                                        <div key={sv.id} style={{
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                            padding: '6px 12px', borderRadius: 8,
                                                                            background: '#0f172a', border: '1px solid #1e293b',
                                                                            opacity: 0.4,
                                                                        }}>
                                                                            <span style={{ textDecoration: 'line-through', color: '#64748b', fontSize: 13 }}>
                                                                                🏪 {sv.name} <span style={{ fontSize: 11 }}>({sv.category})</span>
                                                                            </span>
                                                                            <button
                                                                                onClick={() => setDismissedSimilars(prev => { const n = new Set(prev); n.delete(dismissKey); return n; })}
                                                                                style={{ fontSize: 10, background: '#334155', color: '#94a3b8', padding: '3px 8px', borderRadius: 5, border: '1px solid #475569', cursor: 'pointer', fontWeight: 600 }}
                                                                            >↩ 복원</button>
                                                                        </div>
                                                                    );
                                                                }

                                                                return (
                                                                    <div key={sv.id} style={{
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                        padding: '8px 12px', borderRadius: 8,
                                                                        background: isMerged ? '#1e3a5f' : '#0f172a',
                                                                        border: `1px solid ${isMerged ? '#3b82f6' : '#1e293b'}`,
                                                                        transition: 'all 0.15s',
                                                                    }}>
                                                                        <span style={{ color: '#e2e8f0', fontSize: 13 }}>
                                                                            🏪 <strong>{sv.name}</strong>
                                                                            <span style={{ color: '#64748b', marginLeft: 6, fontSize: 12 }}>({sv.category})</span>
                                                                        </span>
                                                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                                            <button
                                                                                onClick={() => handleVendorDecision(vr.vendor_name, 'merge', sv.id)}
                                                                                style={{
                                                                                    fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 6, padding: '4px 10px',
                                                                                    background: isMerged ? '#2563eb' : '#1e293b',
                                                                                    color: isMerged ? '#fff' : '#3b82f6',
                                                                                    border: `1px solid ${isMerged ? '#3b82f6' : '#334155'}`,
                                                                                    transition: 'all 0.15s',
                                                                                }}
                                                                            >{isMerged ? '✓ 병합' : '→ 병합'}</button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (isMerged) {
                                                                                        setVendorDecisions(prev => { const n = { ...prev }; delete n[vr.vendor_name]; return n; });
                                                                                    }
                                                                                    setDismissedSimilars(prev => { const n = new Set(prev); n.add(dismissKey); return n; });
                                                                                }}
                                                                                style={{
                                                                                    fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 6, padding: '4px 8px',
                                                                                    background: '#1e293b', color: '#ef4444', border: '1px solid #334155',
                                                                                    transition: 'all 0.15s',
                                                                                }}
                                                                                title="이 거래처 제외 (관련없음)"
                                                                            >✕</button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* New Vendor Button */}
                                                <button
                                                    onClick={() => handleVendorDecision(vr.vendor_name, 'new')}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 8,
                                                        padding: '8px 12px', borderRadius: 8,
                                                        background: dec.action === 'new' ? '#1a2e1a' : '#0f172a',
                                                        border: `1px solid ${dec.action === 'new' ? '#16a34a' : '#1e293b'}`,
                                                        color: dec.action === 'new' ? '#4ade80' : '#94a3b8',
                                                        cursor: 'pointer', fontSize: 13, width: '100%',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    ➕ 신규 거래처로 등록
                                                    {dec.action === 'new' && dec.category && (
                                                        <span style={{ marginLeft: 'auto', fontSize: 12, background: '#16a34a20', padding: '2px 8px', borderRadius: 6 }}>
                                                            {EXPENSE_CATEGORIES.find(c => c.id === dec.category)?.icon} {dec.category}
                                                        </span>
                                                    )}
                                                </button>

                                                {/* Category Selection for New Vendor */}
                                                {showNewCategoryFor === vr.vendor_name && (
                                                    <div style={{ marginTop: 10, background: '#0f172a', borderRadius: 10, padding: 12, border: '1px solid #334155' }}>
                                                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>📂 카테고리를 선택하세요:</div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                            {EXPENSE_CATEGORIES.map(cat => (
                                                                <button
                                                                    key={cat.id}
                                                                    onClick={() => handleNewVendorCategory(vr.vendor_name, cat.id)}
                                                                    style={{
                                                                        padding: '6px 10px', borderRadius: 8, fontSize: 12,
                                                                        background: dec.category === cat.id ? `${cat.color}30` : '#1e293b',
                                                                        border: `1px solid ${dec.category === cat.id ? cat.color : '#334155'}`,
                                                                        color: dec.category === cat.id ? cat.color : '#94a3b8',
                                                                        cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s',
                                                                    }}
                                                                >
                                                                    {cat.icon} {cat.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex justify-between items-center px-5 py-4 border-t border-slate-100 bg-slate-50/50 sticky bottom-0">
                            <button className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-600 text-sm font-bold border-none cursor-pointer hover:bg-slate-300 transition-colors" onClick={() => { setShowVendorReview(false); setPreviewData(null); }}>취소</button>
                            <button
                                className="btn-save"
                                disabled={!canConfirmUpload() || confirmLoading}
                                onClick={() => {
                                    const filtered = previewData.records.filter(r => !excludedVendors.has(r.vendor_name));
                                    confirmUpload(filtered, vendorDecisions, previewData?.original_filename);
                                }}
                                style={{
                                    opacity: canConfirmUpload() ? 1 : 0.5,
                                    background: canConfirmUpload() ? 'linear-gradient(135deg, #22c55e, #059669)' : '#334155',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '12px 28px',
                                    borderRadius: 12,
                                    fontSize: 15,
                                    fontWeight: 800,
                                    cursor: canConfirmUpload() ? 'pointer' : 'not-allowed',
                                    boxShadow: canConfirmUpload() ? '0 4px 20px rgba(34, 197, 94, 0.4)' : 'none',
                                    transition: 'all 0.3s ease',
                                    letterSpacing: '0.5px',
                                }}
                            >
                                {confirmLoading ? '⏳ 저장 중...' : `🚀 ${previewData.total_parsed - previewData.records.filter(r => excludedVendors.has(r.vendor_name)).length}건 업로드 확인`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
