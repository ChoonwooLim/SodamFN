import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Send, Printer, FileText, Upload, Loader2, RefreshCw, Trash2, CheckCircle2,
    XCircle, Clock, AlertCircle, Users, File as FileIcon,
} from 'lucide-react';
import api from '../api';

const API_URL = import.meta.env.VITE_API_URL || '';

const CERT_TYPES = [
    { key: 'employment', label: '재직증명서', desc: '현 재직 상태 증명' },
    { key: 'career', label: '경력증명서', desc: '경력/근무 기간 증명' },
    { key: 'salary', label: '급여확인서', desc: '최근 3개월 급여 확인' },
    { key: 'retirement', label: '퇴직증명서', desc: '퇴직 사실 증명' },
];

const STATUS_META = {
    pending: { label: '대기', icon: Clock, color: 'text-slate-500 bg-slate-100' },
    sending: { label: '전송중', icon: Loader2, color: 'text-blue-600 bg-blue-50' },
    success: { label: '전송완료', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    failed: { label: '실패', icon: XCircle, color: 'text-red-600 bg-red-50' },
};

function fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function buildFileUrl(path) {
    if (!path) return '';
    const p = String(path).replace(/\\/g, '/');
    if (p.startsWith('http')) return p;
    return p.startsWith('/') ? `${API_URL}${p}` : `${API_URL}/${p}`;
}

export default function FaxTransmission() {
    const [targetNumber, setTargetNumber] = useState('');
    const [targetName, setTargetName] = useState('');
    const [subject, setSubject] = useState('');

    const [source, setSource] = useState('certificate'); // certificate | upload | business_doc
    const [selectedCertType, setSelectedCertType] = useState('employment');
    const [staffList, setStaffList] = useState([]);
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [uploadFiles, setUploadFiles] = useState([]); // 다중 파일 — 한 통의 팩스로 묶어 발송
    const [bizDocs, setBizDocs] = useState([]);
    const [selectedBizDocId, setSelectedBizDocId] = useState('');

    const [sending, setSending] = useState(false);
    const [msg, setMsg] = useState(null);

    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [attachmentModalTx, setAttachmentModalTx] = useState(null); // 다중 첨부 미리보기 모달용

    const [providerInfo, setProviderInfo] = useState(null);

    const certFrameRef = useRef(null);

    const [searchParams] = useSearchParams();

    useEffect(() => {
        loadHistory();
        loadProvider();
        loadStaff();
        loadBizDocs();
    }, []);

    useEffect(() => {
        const sid = searchParams.get('staff_id');
        const cert = searchParams.get('cert');
        if (sid) {
            setSource('certificate');
            setSelectedStaffId(sid);
        }
        if (cert) {
            setSelectedCertType(cert);
        }
    }, [searchParams]);

    const loadProvider = async () => {
        try {
            const res = await api.get('/fax/providers');
            setProviderInfo(res.data);
        } catch (e) { console.error(e); }
    };

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await api.get('/fax');
            setHistory(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingHistory(false);
        }
    };

    const loadStaff = async () => {
        try {
            const res = await api.get('/hr/staff');
            const rows = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
            setStaffList(rows);
        } catch (e) { console.error(e); }
    };

    const loadBizDocs = async () => {
        try {
            const res = await api.get('/business-docs');
            setBizDocs(Array.isArray(res.data) ? res.data : []);
        } catch (e) { console.error(e); }
    };

    const activeStaff = useMemo(
        () => staffList.find((s) => String(s.id) === String(selectedStaffId)),
        [staffList, selectedStaffId]
    );

    const buildCertificatePdf = async () => {
        if (!selectedStaffId) throw new Error('직원을 선택하세요.');
        // 서버사이드 WeasyPrint 렌더링 (html2pdf.js는 복잡한 한글 CSS에서
        // 빈 페이지 생성 버그가 있어 백엔드 PDF 엔드포인트 사용)
        const res = await api.get(
            `/hr/certificate/pdf/${selectedCertType}/${selectedStaffId}`,
            { responseType: 'blob' }
        );
        if (!res.data) throw new Error('증명서 PDF를 가져오지 못했습니다.');
        const blob = res.data;
        const label = CERT_TYPES.find((c) => c.key === selectedCertType)?.label || '문서';
        const filename = `${label}_${activeStaff?.name || selectedStaffId}.pdf`;
        return { blob, filename, sourceRef: `${selectedCertType}:${selectedStaffId}` };
    };

    const getFileFromSource = async () => {
        if (source === 'certificate') {
            return await buildCertificatePdf();
        }
        if (source === 'upload') {
            if (!uploadFiles || uploadFiles.length === 0) throw new Error('파일을 선택하세요.');
            // 단일/다중 공통: 첫 파일을 대표값으로 반환 (handleSend 에서 다중 분기)
            return { blob: uploadFiles[0], filename: uploadFiles[0].name, sourceRef: null };
        }
        if (source === 'business_doc') {
            const doc = bizDocs.find((d) => String(d.id) === String(selectedBizDocId));
            if (!doc) throw new Error('보관함에서 문서를 선택하세요.');
            const fileUrl = buildFileUrl(doc.file_path);
            const res = await fetch(fileUrl);
            if (!res.ok) throw new Error('보관함 문서를 가져오지 못했습니다.');
            const blob = await res.blob();
            return { blob, filename: doc.original_filename || `doc_${doc.id}`, sourceRef: `business_doc:${doc.id}` };
        }
        throw new Error('전송 소스를 선택하세요.');
    };

    const handleSend = async () => {
        setMsg(null);
        if (!targetNumber.trim()) {
            setMsg({ type: 'error', text: '팩스번호를 입력하세요.' });
            return;
        }
        setSending(true);
        try {
            // 직접 업로드 + 2개 이상 → 한 통으로 묶어 /fax/send-multi 호출
            const isMultiUpload = source === 'upload' && uploadFiles && uploadFiles.length > 1;

            const fd = new FormData();
            fd.append('target_number', targetNumber);
            if (targetName) fd.append('target_name', targetName);
            if (subject) fd.append('subject', subject);
            fd.append('source_type', source);

            let endpoint;
            if (isMultiUpload) {
                endpoint = '/fax/send-multi';
                uploadFiles.forEach((f) => fd.append('files', f, f.name));
            } else {
                endpoint = '/fax/send';
                const { blob, filename, sourceRef } = await getFileFromSource();
                fd.append('file', blob, filename);
                if (sourceRef) fd.append('source_ref', sourceRef);
            }

            const res = await api.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            const status = res.data?.status;
            if (status === 'success') {
                setMsg({ type: 'success', text: `전송 완료 (Tx: ${res.data.provider_tx_id || '-'})` });
            } else if (status === 'failed') {
                setMsg({ type: 'error', text: `전송 실패: ${res.data.error_message || '알 수 없음'}` });
            } else {
                setMsg({ type: 'info', text: `접수됨 (상태: ${status})` });
            }
            await loadHistory();
        } catch (err) {
            console.error(err);
            setMsg({ type: 'error', text: err?.response?.data?.detail || err.message || '전송 중 오류가 발생했습니다.' });
        } finally {
            setSending(false);
        }
    };

    const handleRetry = async (id) => {
        try {
            await api.post(`/fax/${id}/retry`);
            await loadHistory();
        } catch (err) {
            alert(err?.response?.data?.detail || '재전송 실패');
        }
    };

    const handleRefresh = async (id) => {
        try {
            await api.post(`/fax/${id}/refresh`);
            await loadHistory();
        } catch (err) {
            alert(err?.response?.data?.detail || '상태 확인 실패');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('이 전송 이력을 삭제할까요?')) return;
        try {
            await api.delete(`/fax/${id}`);
            await loadHistory();
        } catch {
            alert('삭제 실패');
        }
    };

    const previewCert = async () => {
        if (!selectedStaffId) return;
        try {
            const res = await api.get(`/hr/certificate/${selectedCertType}/${selectedStaffId}`);
            if (res.data?.html) {
                const w = window.open('', '_blank', 'width=800,height=1100');
                w.document.write(res.data.html);
                w.document.close();
            }
        } catch (e) {
            alert(e?.response?.data?.detail || '미리보기 실패');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-6 py-8 pb-32">
                <header className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Send size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">팩스 전송</h1>
                            <p className="text-xs text-slate-400 mt-0.5">증명서·보관함 문서·직접 업로드한 파일을 팩스로 전송합니다.</p>
                        </div>
                    </div>
                </header>

                {providerInfo && (
                    <div className={`mb-6 p-4 rounded-xl text-sm ${
                        providerInfo.is_stub
                            ? 'bg-amber-50 border border-amber-200 text-amber-800'
                            : providerInfo.is_popbill_test
                                ? 'bg-red-50 border-2 border-red-300 text-red-800'
                                : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    }`}>
                        <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                            <div>
                                <strong>
                                    {providerInfo.is_popbill_test
                                        ? '⚠️ 팝빌 TEST 모드 — 실제 팩스 미발송'
                                        : `프로바이더: ${providerInfo.active}`}
                                </strong>
                                <div className="text-xs mt-1 leading-relaxed">{providerInfo.note}</div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
                    {/* Left: Send form */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 card-animate">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-3">전송 정보</h2>

                        {/* Recipient */}
                        <div className="space-y-4 mb-5">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                    받는 팩스번호 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={targetNumber}
                                    onChange={(e) => setTargetNumber(e.target.value)}
                                    placeholder="예: 02-452-6510 또는 +82-2-452-6510"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">수신자 (선택)</label>
                                    <input
                                        type="text"
                                        value={targetName}
                                        onChange={(e) => setTargetName(e.target.value)}
                                        placeholder="예: 광진세무서"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">제목 (선택)</label>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        placeholder="예: 재직증명서 송부"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Source selection */}
                        <div className="mb-5">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">전송할 서류</label>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {[
                                    { key: 'certificate', label: '증명서 자동생성', icon: FileText },
                                    { key: 'business_doc', label: '회사 보관함', icon: FileIcon },
                                    { key: 'upload', label: '직접 업로드', icon: Upload },
                                ].map((opt) => {
                                    const Icon = opt.icon;
                                    const active = source === opt.key;
                                    return (
                                        <button
                                            key={opt.key}
                                            onClick={() => setSource(opt.key)}
                                            className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-semibold transition-all ${
                                                active
                                                    ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white border-transparent shadow'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Icon size={18} />
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {source === 'certificate' && (
                                <div className="space-y-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">증명서 종류</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {CERT_TYPES.map((c) => (
                                                <button
                                                    key={c.key}
                                                    onClick={() => setSelectedCertType(c.key)}
                                                    className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                                                        selectedCertType === c.key
                                                            ? 'bg-white border-indigo-400 text-indigo-700 font-bold shadow-sm'
                                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <FileText size={12} />
                                                        {c.label}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{c.desc}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block flex items-center gap-1">
                                            <Users size={12} /> 대상 직원
                                        </label>
                                        <div className="flex gap-2">
                                            <select
                                                value={selectedStaffId}
                                                onChange={(e) => setSelectedStaffId(e.target.value)}
                                                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                            >
                                                <option value="">— 직원 선택 —</option>
                                                {staffList.map((s) => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={previewCert}
                                                disabled={!selectedStaffId}
                                                className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
                                            >
                                                <Printer size={14} /> 미리보기
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {source === 'upload' && (
                                <div className="p-5 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                    <label className="cursor-pointer flex flex-col items-center gap-2 text-center">
                                        <Upload size={24} className="text-slate-400" />
                                        <span className="text-xs font-semibold text-slate-600">
                                            {uploadFiles.length === 0
                                                ? 'PDF / 이미지 파일 선택 (여러 파일 선택 시 한 통의 팩스로 묶여 발송, 합계 최대 10MB)'
                                                : `선택된 파일 ${uploadFiles.length}개${uploadFiles.length > 1 ? ' — 한 통으로 묶어 발송' : ''}`}
                                        </span>
                                        <input
                                            type="file"
                                            multiple
                                            className="hidden"
                                            accept=".pdf,image/*"
                                            onChange={(e) => {
                                                const newFiles = Array.from(e.target.files || []);
                                                setUploadFiles((prev) => [...prev, ...newFiles]);
                                                e.target.value = ''; // 같은 파일 재선택 가능
                                            }}
                                        />
                                        <span className="mt-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
                                            파일 추가
                                        </span>
                                    </label>

                                    {uploadFiles.length > 0 && (
                                        <ul className="mt-4 space-y-1.5 text-left">
                                            {uploadFiles.map((f, idx) => (
                                                <li
                                                    key={`${f.name}-${idx}-${f.lastModified}`}
                                                    className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                                                >
                                                    <span className="flex-1 truncate text-slate-700">
                                                        {idx + 1}. {f.name}
                                                        <span className="text-slate-400 ml-2">
                                                            {(f.size / 1024).toFixed(0)} KB
                                                        </span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setUploadFiles((prev) =>
                                                                prev.filter((_, i) => i !== idx)
                                                            )
                                                        }
                                                        className="px-2 py-0.5 text-red-500 hover:bg-red-50 rounded"
                                                    >
                                                        제거
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {source === 'business_doc' && (
                                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                                    {bizDocs.length === 0 ? (
                                        <p className="text-xs text-slate-500 text-center py-2">
                                            회사 보관함에 업로드된 문서가 없습니다. (환경설정 → 회사정보 관리)
                                        </p>
                                    ) : (
                                        <select
                                            value={selectedBizDocId}
                                            onChange={(e) => setSelectedBizDocId(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                        >
                                            <option value="">— 보관함 문서 선택 —</option>
                                            {bizDocs.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    [{d.doc_type}] {d.original_filename}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}
                        </div>

                        {msg && (
                            <div className={`mb-4 text-sm font-medium p-3 rounded-xl ${
                                msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-600'
                                : msg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : 'bg-blue-50 border border-blue-200 text-blue-700'
                            }`}>
                                {msg.text}
                            </div>
                        )}

                        <button
                            onClick={handleSend}
                            disabled={sending}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-sm disabled:opacity-50"
                        >
                            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            {sending ? '전송 중...' : '팩스 전송'}
                        </button>

                        <div ref={certFrameRef} style={{ display: 'none' }} />
                    </div>

                    {/* Right: History */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 card-animate">
                        <div className="flex items-center justify-between mb-4 border-b pb-3">
                            <h2 className="text-lg font-bold text-slate-800">전송 이력</h2>
                            <button
                                onClick={loadHistory}
                                disabled={loadingHistory}
                                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
                            >
                                <RefreshCw size={13} className={loadingHistory ? 'animate-spin' : ''} />
                                새로고침
                            </button>
                        </div>

                        {loadingHistory && history.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-sm">불러오는 중...</div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-sm">아직 전송 이력이 없습니다.</div>
                        ) : (
                            <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
                                {history.map((tx) => {
                                    const meta = STATUS_META[tx.status] || STATUS_META.pending;
                                    const Icon = meta.icon;
                                    const isSending = tx.status === 'sending';
                                    return (
                                        <div key={tx.id} className="p-3 border border-slate-100 rounded-xl hover:bg-slate-50/50">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.color}`}>
                                                            <Icon size={10} className={isSending ? 'animate-spin' : ''} />
                                                            {meta.label}
                                                        </span>
                                                        <span className="text-xs font-mono text-slate-700">{tx.target_number}</span>
                                                        {tx.target_name && (
                                                            <span className="text-xs text-slate-500 truncate">({tx.target_name})</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-600 truncate">
                                                        {tx.subject || tx.original_filename}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                                                        <span>{fmtDateTime(tx.created_at)}</span>
                                                        {tx.page_count && <span>· {tx.page_count}페이지</span>}
                                                        {tx.provider && <span>· {tx.provider}</span>}
                                                        {tx.provider_tx_id && <span className="font-mono">#{tx.provider_tx_id.slice(-8)}</span>}
                                                    </div>
                                                    {tx.status === 'failed' && tx.error_message && (
                                                        <div className="mt-1.5 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1">
                                                            {tx.error_message}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1 flex-shrink-0">
                                                    {tx.attachment_files && tx.attachment_files.length > 1 ? (
                                                        <button
                                                            onClick={() => setAttachmentModalTx(tx)}
                                                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 relative"
                                                            title={`첨부 ${tx.attachment_files.length}건 보기`}
                                                        >
                                                            <FileText size={13} />
                                                            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                                                                {tx.attachment_files.length}
                                                            </span>
                                                        </button>
                                                    ) : tx.file_path && (
                                                        <a
                                                            href={buildFileUrl(tx.file_path)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                                                            title="원본 보기"
                                                        >
                                                            <FileText size={13} />
                                                        </a>
                                                    )}
                                                    {tx.status === 'failed' && (
                                                        <button
                                                            onClick={() => handleRetry(tx.id)}
                                                            className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100"
                                                            title="재전송"
                                                        >
                                                            <RefreshCw size={13} />
                                                        </button>
                                                    )}
                                                    {(tx.status === 'success' || tx.status === 'sending') && tx.provider_tx_id && (
                                                        <button
                                                            onClick={() => handleRefresh(tx.id)}
                                                            className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100"
                                                            title="실제 수신 상태 확인"
                                                        >
                                                            <RefreshCw size={13} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(tx.id)}
                                                        className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"
                                                        title="삭제"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 다중 첨부 미리보기 모달 — 한 통의 팩스에 묶여 발송된 N개 파일 개별 보기/다운로드 */}
            {attachmentModalTx && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setAttachmentModalTx(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">첨부 파일 ({attachmentModalTx.attachment_files?.length || 0}건)</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {attachmentModalTx.target_number} {attachmentModalTx.target_name && `(${attachmentModalTx.target_name})`} — 한 통의 팩스로 묶여 발송
                                </p>
                            </div>
                            <button
                                onClick={() => setAttachmentModalTx(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-2">
                            {(attachmentModalTx.attachment_files || []).map((f, idx) => (
                                <div
                                    key={`${f.url}-${idx}`}
                                    className="flex items-center justify-between gap-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-slate-700 truncate">
                                            {idx + 1}. {f.name}
                                        </div>
                                        {f.size && (
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {(f.size / 1024).toFixed(0)} KB
                                            </div>
                                        )}
                                    </div>
                                    <a
                                        href={buildFileUrl(f.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 flex-shrink-0"
                                    >
                                        미리보기
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
