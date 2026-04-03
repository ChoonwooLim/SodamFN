import React from 'react';
import { Camera, FileSpreadsheet, RotateCcw, UploadCloud } from 'lucide-react';
import UploadHistoryList from '../../components/UploadHistoryList';

export function UploadView({
    isMobile, uploadTab, setUploadTab,
    uploadLoading, uploadProgress,
    fileInputRef, excelInputRef,
    handleUploadFileChange, fetchData,
}) {
    if (isMobile) {
        return (
            <div style={{ padding: '0 16px 80px', marginTop: 16 }}>
                {/* Upload sub-tabs */}
                <div className="card-animate" style={{
                    display: 'flex', gap: 6, marginBottom: 14,
                }}>
                    {[
                        { id: 'camera', label: '📷 촬영/이미지', bg: 'linear-gradient(135deg, #1e2d3b, #2d4a5e)' },
                        { id: 'excel', label: '📄 문서 업로드', bg: 'linear-gradient(135deg, #1e3a2d, #2d5e4a)' },
                        { id: 'history', label: '🔄 취소/기록', bg: 'linear-gradient(135deg, #1e293b, #334155)' },
                    ].map(t => (
                        <button key={t.id} onClick={() => setUploadTab(t.id)} style={{
                            flex: 1, padding: '10px 6px', borderRadius: 10, border: 'none',
                            fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: uploadTab === t.id ? t.bg : '#f1f5f9',
                            color: uploadTab === t.id ? '#f1f5f9' : '#64748b',
                            transition: 'all 0.2s',
                        }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {uploadTab === 'history' ? (
                    <div className="card-animate" style={{
                        background: 'white', borderRadius: 16, padding: 16,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)', animationDelay: '0.05s',
                    }}>
                        <div style={{
                            padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                            background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                        }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>🔄 업로드 기록</span>
                        </div>
                        <UploadHistoryList type="revenue" onRollback={fetchData} />
                    </div>
                ) : (
                    <div className="card-animate" style={{
                        background: 'white', borderRadius: 16,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        overflow: 'hidden', animationDelay: '0.05s',
                    }}>
                        <div style={{
                            padding: '8px 12px', margin: 16, marginBottom: 0,
                            borderRadius: 10, background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                        }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>
                                {uploadTab === 'camera' ? '📷 이미지 업로드' : '📄 문서 업로드'}
                            </span>
                        </div>
                        <div
                            onClick={() => uploadTab === 'camera' ? fileInputRef.current?.click() : excelInputRef.current?.click()}
                            style={{
                                margin: 16, padding: '40px 20px', borderRadius: 14,
                                border: '2px dashed #cbd5e1', textAlign: 'center', cursor: 'pointer',
                                background: '#f8fafc', transition: 'border-color 0.2s',
                            }}
                        >
                            {uploadLoading ? (
                                <div>
                                    <div className="spinner" />
                                    <p style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>{uploadProgress || '처리 중입니다...'}</p>
                                </div>
                            ) : (
                                <>
                                    <div style={{
                                        width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
                                        background: uploadTab === 'camera'
                                            ? 'linear-gradient(135deg, #1e2d3b, #2d4a5e)'
                                            : 'linear-gradient(135deg, #1e3a2d, #2d5e4a)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {uploadTab === 'camera' ? <Camera size={24} color="#f1f5f9" /> : <UploadCloud size={24} color="#f1f5f9" />}
                                    </div>
                                    <p style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                                        {uploadTab === 'camera' ? '클릭하여 이미지 선택' : '클릭하여 문서 파일 선택'}
                                    </p>
                                    <p style={{ fontSize: 11, color: '#94a3b8' }}>
                                        {uploadTab === 'camera'
                                            ? '영수증 또는 매출 내역 이미지를 업로드하세요'
                                            : '엑셀, PDF, CSV 파일 지원 — 여러 파일 선택 가능'}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Hidden file inputs */}
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} ref={fileInputRef} onChange={handleUploadFileChange} />
                <input type="file" accept=".xlsx,.xls,.pdf,.csv" multiple style={{ display: 'none' }} ref={excelInputRef} onChange={handleUploadFileChange} />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate">
                <div className="flex gap-2 mb-4">
                    {[
                        { id: 'camera', label: '촬영/이미지', icon: <Camera size={16} />, gradient: 'from-cyan-600 to-cyan-700' },
                        { id: 'excel', label: '문서 업로드', icon: <FileSpreadsheet size={16} />, gradient: 'from-emerald-600 to-emerald-700' },
                        { id: 'history', label: '취소/기록', icon: <RotateCcw size={16} />, gradient: 'from-slate-600 to-slate-700' },
                    ].map(t => (
                        <button key={t.id}
                            className={`flex items-center gap-1.5 px-4 py-2 border-none text-sm font-semibold cursor-pointer rounded-xl transition-all ${
                                uploadTab === t.id
                                    ? `bg-gradient-to-r ${t.gradient} text-white shadow-sm`
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            onClick={() => setUploadTab(t.id)}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {uploadTab === 'history' ? (
                    <div className="bg-slate-50 rounded-xl p-4">
                        <UploadHistoryList type="revenue" onRollback={fetchData} />
                    </div>
                ) : (
                    <div
                        className="border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center cursor-pointer hover:border-blue-300 transition-colors"
                        onClick={() => uploadTab === 'camera' ? fileInputRef.current?.click() : excelInputRef.current?.click()}
                    >
                        {uploadLoading ? (
                            <div className="flex flex-col items-center">
                                <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-3" />
                                <p className="text-sm text-slate-500">{uploadProgress || '처리 중입니다...'}</p>
                            </div>
                        ) : (
                            <>
                                <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gradient-to-br ${
                                    uploadTab === 'camera' ? 'from-cyan-600 to-cyan-700' : 'from-emerald-600 to-emerald-700'
                                } shadow-lg`}>
                                    {uploadTab === 'camera' ? <Camera size={32} className="text-white" /> : <UploadCloud size={32} className="text-white" />}
                                </div>
                                <p className="text-base font-bold text-slate-700 mb-1">
                                    {uploadTab === 'camera' ? '클릭하여 이미지 선택' : '클릭하여 문서 파일 선택'}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {uploadTab === 'camera'
                                        ? '영수증 또는 매출 내역 이미지를 업로드하세요'
                                        : '엑셀, PDF, CSV 파일 지원 — 여러 파일 선택 가능'}
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Hidden file inputs */}
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} ref={fileInputRef} onChange={handleUploadFileChange} />
            <input type="file" accept=".xlsx,.xls,.pdf,.csv" multiple style={{ display: 'none' }} ref={excelInputRef} onChange={handleUploadFileChange} />
        </div>
    );
}
