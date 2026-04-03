import { Upload, CheckSquare, Eye, Trash2 } from 'lucide-react';

const DOC_TYPES = [
    { key: 'contract', label: '근로계약서' },
    { key: 'health_cert', label: '보건증' },
    { key: 'id_copy', label: '신분증 사본' },
    { key: 'bank_copy', label: '통장 사본' },
    { key: 'photo', label: '취업승인서' },
];

export default function DocumentTab({
    documents,
    handleFileUpload,
    handleDeleteDocument,
}) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Upload size={24} /></div>
                <h2 className="text-lg font-bold text-slate-800">서류 제출 관리</h2>
            </div>
            <div className="space-y-3">
                {DOC_TYPES.map((doc) => {
                    const uploadedDoc = documents.find(d => d.doc_type === doc.key);
                    // Build URL: supports R2 URLs, API paths, and legacy local paths
                    let fileUrl = '#';
                    if (uploadedDoc) {
                        const fp = uploadedDoc.file_path.replace(/\\/g, '/');
                        if (fp.startsWith('http')) {
                            // R2 public URL - use directly
                            fileUrl = fp;
                        } else {
                            // Local/API path - prepend server URL
                            const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
                            if (fp.startsWith('/')) {
                                fileUrl = `${base}${fp}`;
                            } else {
                                fileUrl = `${base}/${fp}`;
                            }
                        }
                    }
                    return (
                        <div key={doc.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`p-2 rounded-lg ${uploadedDoc ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                                    <CheckSquare size={16} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-bold text-slate-800">{doc.label}</span>
                                    {uploadedDoc ? (
                                        <span className="text-[10px] text-blue-500 truncate max-w-[120px]">{uploadedDoc.original_filename}</span>
                                    ) : (
                                        <span className="text-[10px] text-red-400">미제출</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <label className="p-1.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                                    <Upload size={14} className="text-slate-600" />
                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, doc.key)} />
                                </label>
                                {uploadedDoc && (
                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                                        <Eye size={14} />
                                    </a>
                                )}
                                {uploadedDoc && (
                                    <button
                                        onClick={() => handleDeleteDocument(uploadedDoc.id, doc.key)}
                                        className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"
                                        title="서류 삭제"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
