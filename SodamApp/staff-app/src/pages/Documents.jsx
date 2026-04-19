import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE } from '../api';
import {
    FileText, Camera, Upload, CheckCircle, Clock, ImageIcon, AlertCircle, ArrowLeft
} from 'lucide-react';

const REQUIRED_DOCS = [
    { key: 'contract', label: '근로계약서', desc: '관리자가 전자계약으로 발송합니다', selfUpload: false },
    { key: 'id_copy', label: '신분증 사본', desc: '주민등록증 또는 외국인등록증', selfUpload: true },
    { key: 'health_cert', label: '건강진단서', desc: '식품위생 관련 건강진단서', selfUpload: true },
    { key: 'bank_copy', label: '통장 사본', desc: '급여 입금용 통장 앞면', selfUpload: true },
    { key: 'photo', label: '취업승인서', desc: '외국인 취업승인서', selfUpload: true },
];

export default function Documents() {
    const navigate = useNavigate();
    const [uploads, setUploads] = useState({});
    const [uploading, setUploading] = useState(null);
    const [message, setMessage] = useState('');
    const fileRef = useRef(null);
    const [activeDoc, setActiveDoc] = useState(null);

    // Fetch existing documents on mount
    useEffect(() => {
        const staffId = localStorage.getItem('staff_id');
        if (!staffId) return;
        api.get(`/hr/staff/${staffId}/documents`)
            .then(res => {
                if (res.data.status === 'success' && res.data.data) {
                    const existing = {};
                    res.data.data.forEach(doc => {
                        existing[doc.doc_type] = {
                            name: doc.original_filename,
                            time: doc.uploaded_at
                                ? new Date(doc.uploaded_at).toLocaleString('ko-KR')
                                : '제출 완료',
                        };
                    });
                    setUploads(existing);
                }
            })
            .catch(() => { });
    }, []);

    const handleUpload = async (docKey, file) => {
        if (!file) return;
        setUploading(docKey);
        setMessage('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('doc_type', docKey);

            const staffId = localStorage.getItem('staff_id');
            await api.post(`/hr/staff/${staffId}/document`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setUploads(prev => ({ ...prev, [docKey]: { name: file.name, time: new Date().toLocaleString('ko-KR') } }));
            setMessage(`✅ ${REQUIRED_DOCS.find(d => d.key === docKey)?.label} 제출 완료!`);
        } catch (err) {
            console.error(err);
            setMessage(`❌ 업로드 실패: ${err.response?.data?.detail || '서버 오류'}`);
        } finally {
            setUploading(null);
            setActiveDoc(null);
        }
    };

    const triggerUpload = (docKey) => {
        setActiveDoc(docKey);
        setTimeout(() => fileRef.current?.click(), 50);
    };

    return (
        <div className="page animate-fade">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <ArrowLeft size={22} color="#475569" />
                </button>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>서류 제출</h1>
            </div>

            {message && (
                <div className={`status-banner ${message.includes('✅') ? 'success' : 'error'}`} style={{ marginBottom: '16px' }}>
                    <div className="status-banner-icon">
                        {message.includes('✅') ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    </div>
                    <div className="status-banner-text">
                        <p style={{ fontWeight: 600 }}>{message}</p>
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={(e) => {
                    if (activeDoc && e.target.files?.[0]) {
                        handleUpload(activeDoc, e.target.files[0]);
                    }
                    e.target.value = '';
                }}
                style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {REQUIRED_DOCS.map(doc => {
                    const uploaded = uploads[doc.key];
                    const isUploading = uploading === doc.key;

                    return (
                        <div key={doc.key} className="doc-item">
                            <div className={`doc-item-check ${uploaded ? 'done' : 'pending'}`}>
                                {uploaded ? <CheckCircle size={18} /> : <Clock size={18} />}
                            </div>
                            <div className="doc-item-info">
                                <div className="doc-item-name">{doc.label}</div>
                                <div className="doc-item-status">
                                    {uploaded ? `제출: ${uploaded.time}` : doc.desc}
                                </div>
                            </div>
                            <div className="doc-item-action">
                                {doc.selfUpload ? (
                                    <button
                                        className="btn btn-outline"
                                        style={{ padding: '8px 14px', fontSize: '0.8rem', minHeight: 'auto' }}
                                        onClick={() => triggerUpload(doc.key)}
                                        disabled={isUploading}
                                    >
                                        {isUploading ? (
                                            <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                        ) : uploaded ? (
                                            <><Upload size={14} /> 재제출</>
                                        ) : (
                                            <><Camera size={14} /> 제출</>
                                        )}
                                    </button>
                                ) : (
                                    <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                                        자동
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="card mt-4" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                <p style={{ fontSize: '0.8rem', color: '#1e40af', lineHeight: '1.6' }}>
                    📋 <strong>안내:</strong> 카메라로 사진을 찍어 바로 제출하거나, 갤러리에서 이미지를 선택할 수 있습니다.
                    근로계약서는 관리자가 전자계약으로 별도 발송합니다.
                </p>
            </div>
        </div>
    );
}
