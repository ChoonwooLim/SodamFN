import { useState } from 'react';
import { Upload, CheckSquare, Eye, Trash2, Loader2, X, ChevronLeft, ChevronRight, FileText, Image, File, Printer, Award } from 'lucide-react';
import api from '../../api';

const DOC_TYPES = [
    { key: 'contract', label: '근로계약서' },
    { key: 'health_cert', label: '건강진단서' },
    { key: 'id_copy', label: '신분증 사본' },
    { key: 'bank_copy', label: '통장 사본' },
    { key: 'photo', label: '취업승인서' },
];

const MAX_FILE_SIZE_MB = 10;

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
const PDF_EXTS = ['.pdf'];

function getFileExt(filename) {
    if (!filename) return '';
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.substring(dot).toLowerCase() : '';
}

function isImage(filename) {
    return IMAGE_EXTS.includes(getFileExt(filename));
}

function isPdf(filename) {
    return PDF_EXTS.includes(getFileExt(filename));
}

function getFileIcon(filename) {
    if (isImage(filename)) return Image;
    if (isPdf(filename)) return FileText;
    return File;
}

function buildFileUrl(doc) {
    const fp = doc.file_path.replace(/\\/g, '/');
    if (fp.startsWith('http')) return fp;
    const base = import.meta.env.VITE_API_URL || '';
    return fp.startsWith('/') ? `${base}${fp}` : `${base}/${fp}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ── File Preview Modal ────────────────────────────
function PreviewModal({ docs, initialIndex, onClose }) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const doc = docs[currentIndex];
    const url = buildFileUrl(doc);
    const filename = doc.original_filename || '';
    const canPreview = isImage(filename) || isPdf(filename);

    const goPrev = () => setCurrentIndex(i => Math.max(0, i - 1));
    const goNext = () => setCurrentIndex(i => Math.min(docs.length - 1, i + 1));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-slate-800 truncate">{filename}</span>
                        {docs.length > 1 && (
                            <span className="text-xs text-slate-400 whitespace-nowrap">
                                ({currentIndex + 1} / {docs.length})
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold"
                        >
                            새 탭에서 열기
                        </a>
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
                            <X size={18} className="text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-[300px] bg-slate-50">
                    {isImage(filename) ? (
                        <img src={url} alt={filename} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow" />
                    ) : isPdf(filename) ? (
                        <iframe src={url} className="w-full h-[70vh] rounded-lg border" title={filename} />
                    ) : (
                        <div className="text-center text-slate-500">
                            <File size={48} className="mx-auto mb-3 text-slate-300" />
                            <p className="text-sm font-bold mb-1">미리보기를 지원하지 않는 파일 형식입니다</p>
                            <p className="text-xs text-slate-400 mb-3">{filename}</p>
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                            >
                                파일 열기 / 다운로드
                            </a>
                        </div>
                    )}
                </div>

                {/* Navigation arrows */}
                {docs.length > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                        <button
                            onClick={goPrev}
                            disabled={currentIndex === 0}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50"
                        >
                            <ChevronLeft size={16} /> 이전
                        </button>
                        <div className="flex gap-1">
                            {docs.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentIndex(i)}
                                    className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? 'bg-blue-500' : 'bg-slate-300'}`}
                                />
                            ))}
                        </div>
                        <button
                            onClick={goNext}
                            disabled={currentIndex === docs.length - 1}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50"
                        >
                            다음 <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Certificate Types ────────────────────────────
const CERT_TYPES = [
    { key: 'employment', label: '재직증명서', icon: FileText, desc: '현 재직 상태 증명', color: 'from-emerald-600 to-teal-600' },
    { key: 'career', label: '경력증명서', icon: Award, desc: '경력/근무 기간 증명', color: 'from-blue-600 to-indigo-600' },
    { key: 'salary', label: '급여확인서', icon: FileText, desc: '최근 3개월 급여 확인', color: 'from-violet-600 to-purple-600' },
    { key: 'retirement', label: '퇴직증명서', icon: FileText, desc: '퇴직 사실 증명', color: 'from-slate-600 to-slate-700' },
];

// ── Main Component ────────────────────────────────
export default function DocumentTab({
    documents,
    handleFileUpload,
    handleDeleteDocument,
    staffId,
}) {
    const [uploadingType, setUploadingType] = useState(null);
    const [preview, setPreview] = useState(null); // { docs, index }
    const [certLoading, setCertLoading] = useState(null);

    const handleGenerateCert = async (type) => {
        if (!staffId) return;
        setCertLoading(type);
        try {
            const res = await api.get(`/hr/certificate/${type}/${staffId}`);
            if (res.data.status === 'success' && res.data.html) {
                const printWin = window.open('', '_blank', 'width=800,height=1100');
                printWin.document.write(res.data.html);
                printWin.document.close();
                setTimeout(() => printWin.print(), 500);
            }
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || '증명서 생성 실패');
        } finally {
            setCertLoading(null);
        }
    };

    const onFileChange = async (e, docKey) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            alert(`파일 크기가 ${MAX_FILE_SIZE_MB}MB를 초과합니다.\n선택한 파일: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
            e.target.value = null;
            return;
        }

        setUploadingType(docKey);
        try {
            await handleFileUpload(e, docKey);
        } finally {
            setUploadingType(null);
        }
    };

    const openPreview = (docs, index) => {
        setPreview({ docs, index });
    };

    return (
        <>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Upload size={24} /></div>
                <h2 className="text-lg font-bold text-slate-800">서류 제출 관리</h2>
            </div>

            <div className="space-y-4">
                {DOC_TYPES.map((doc) => {
                    // Get ALL documents for this type, sorted by upload date
                    const typeDocs = documents
                        .filter(d => d.doc_type === doc.key)
                        .sort((a, b) => {
                            const da = a.uploaded_at || a.upload_date || '';
                            const db = b.uploaded_at || b.upload_date || '';
                            return da.localeCompare(db);
                        });
                    const isUploading = uploadingType === doc.key;
                    const count = typeDocs.length;

                    return (
                        <div key={doc.key} className="border border-slate-100 rounded-xl overflow-hidden">
                            {/* Doc type header */}
                            <div className="flex items-center justify-between p-3 bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${count > 0 ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                                        <CheckSquare size={16} />
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-slate-800">{doc.label}</span>
                                        {count > 0 ? (
                                            <span className="ml-2 text-xs text-blue-500 font-semibold">{count}건</span>
                                        ) : (
                                            <span className="ml-2 text-xs text-red-400">미제출</span>
                                        )}
                                    </div>
                                </div>
                                {/* Upload button */}
                                <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${isUploading ? 'opacity-50 pointer-events-none bg-amber-50 text-amber-600 border-amber-200' : 'cursor-pointer bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'}`}>
                                    {isUploading ? (
                                        <><Loader2 size={14} className="animate-spin" /> 업로드 중...</>
                                    ) : (
                                        <><Upload size={14} /> 파일 추가</>
                                    )}
                                    <input
                                        type="file"
                                        className="hidden"
                                        disabled={isUploading}
                                        accept="image/*,.pdf,.doc,.docx,.hwp,.xlsx,.xls,.pptx,.ppt,.txt"
                                        onChange={(e) => onFileChange(e, doc.key)}
                                    />
                                </label>
                            </div>

                            {/* Uploaded files list */}
                            {count > 0 && (
                                <div className="divide-y divide-slate-50">
                                    {typeDocs.map((uploadedDoc, idx) => {
                                        const FileIcon = getFileIcon(uploadedDoc.original_filename);
                                        const ext = getFileExt(uploadedDoc.original_filename).replace('.', '').toUpperCase();
                                        return (
                                            <div key={uploadedDoc.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    {/* Thumbnail for images */}
                                                    {isImage(uploadedDoc.original_filename) ? (
                                                        <div
                                                            className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 cursor-pointer border border-slate-200 hover:border-blue-300 transition-colors"
                                                            onClick={() => openPreview(typeDocs, idx)}
                                                        >
                                                            <img
                                                                src={buildFileUrl(uploadedDoc)}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 cursor-pointer border border-slate-200 hover:border-blue-300 transition-colors"
                                                            onClick={() => openPreview(typeDocs, idx)}
                                                        >
                                                            <FileIcon size={18} className="text-slate-400" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">
                                                            {uploadedDoc.original_filename}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            {ext && (
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono">
                                                                    {ext}
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-slate-400">
                                                                {formatDate(uploadedDoc.uploaded_at || uploadedDoc.upload_date)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button
                                                        onClick={() => openPreview(typeDocs, idx)}
                                                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                        title="미리보기"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteDocument(uploadedDoc.id, doc.key)}
                                                        className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                                                        title="삭제"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Preview Modal */}
            {preview && (
                <PreviewModal
                    docs={preview.docs}
                    initialIndex={preview.index}
                    onClose={() => setPreview(null)}
                />
            )}
        </div>

            {/* ═══ Certificate Generation ═══ */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-5 border-b pb-4">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Printer size={24} /></div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">증명서 발급</h2>
                        <p className="text-xs text-slate-400">클릭하면 인쇄용 증명서가 새 창에서 열립니다.</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CERT_TYPES.map(cert => {
                        const Icon = cert.icon;
                        const isLoading = certLoading === cert.key;
                        return (
                            <button
                                key={cert.key}
                                onClick={() => handleGenerateCert(cert.key)}
                                disabled={isLoading}
                                className="text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all disabled:opacity-50"
                            >
                                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cert.color} flex items-center justify-center mb-2.5`}>
                                    {isLoading ? <Loader2 size={14} className="text-white animate-spin" /> : <Icon size={14} className="text-white" />}
                                </div>
                                <p className="text-sm font-bold text-slate-800">{cert.label}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{cert.desc}</p>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
