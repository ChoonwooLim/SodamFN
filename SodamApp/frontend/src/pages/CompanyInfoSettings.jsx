import { useEffect, useState } from 'react';
import {
    Building2, Save, Loader2, FileText, Upload, Trash2, Eye, X, CheckSquare,
    File as FileIcon, ChevronLeft, ChevronRight, Stamp,
} from 'lucide-react';
import api from '../api';

const API_URL = import.meta.env.VITE_API_URL || '';

const DOC_TYPES = [
    { key: 'biz_registration', label: '사업자등록증' },
    { key: 'biz_license', label: '영업신고증' },
    { key: 'corp_registry', label: '법인등기부등본' },
    { key: 'lease', label: '임대차계약서' },
    { key: 'bank_copy', label: '통장사본' },
    { key: 'tax_cert', label: '납세증명서' },
    { key: 'seal_cert', label: '인감증명서' },
    { key: 'vat_return', label: '부가세 신고서' },
    { key: 'insurance', label: '4대보험 가입증명서' },
    { key: 'permit', label: '인허가증' },
    { key: 'foodsafety', label: '식품위생교육증' },
    { key: 'other', label: '기타 서류' },
];

const IMG_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
const PDF_EXTS = ['.pdf'];
const MAX_FILE_MB = 15;

const getExt = (n) => {
    const i = (n || '').lastIndexOf('.');
    return i >= 0 ? n.substring(i).toLowerCase() : '';
};
const isImg = (n) => IMG_EXTS.includes(getExt(n));
const isPdf = (n) => PDF_EXTS.includes(getExt(n));

const buildFileUrl = (path) => {
    if (!path) return '';
    const p = String(path).replace(/\\/g, '/');
    if (p.startsWith('http')) return p;
    return p.startsWith('/') ? `${API_URL}${p}` : `${API_URL}/${p}`;
};

const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime())
        ? ''
        : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

function PreviewModal({ docs, initialIndex, onClose }) {
    const [idx, setIdx] = useState(initialIndex);
    const doc = docs[idx];
    const url = buildFileUrl(doc.file_path);
    const name = doc.original_filename || '';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-slate-800 truncate">{name}</span>
                        {docs.length > 1 && (
                            <span className="text-xs text-slate-400 whitespace-nowrap">({idx + 1} / {docs.length})</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold">
                            새 탭에서 열기
                        </a>
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
                            <X size={18} className="text-slate-500" />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-[300px] bg-slate-50">
                    {isImg(name) ? (
                        <img src={url} alt={name} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow" />
                    ) : isPdf(name) ? (
                        <iframe src={url} className="w-full h-[70vh] rounded-lg border" title={name} />
                    ) : (
                        <div className="text-center text-slate-500">
                            <FileIcon size={48} className="mx-auto mb-3 text-slate-300" />
                            <p className="text-sm font-bold mb-1">미리보기를 지원하지 않는 형식입니다</p>
                            <p className="text-xs text-slate-400 mb-3">{name}</p>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600">
                                파일 열기 / 다운로드
                            </a>
                        </div>
                    )}
                </div>
                {docs.length > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border disabled:opacity-30 hover:bg-slate-50">
                            <ChevronLeft size={16} /> 이전
                        </button>
                        <button onClick={() => setIdx((i) => Math.min(docs.length - 1, i + 1))} disabled={idx === docs.length - 1} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border disabled:opacity-30 hover:bg-slate-50">
                            다음 <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function Field({ label, value, onChange, placeholder, type = 'text', className = '' }) {
    return (
        <div className={className}>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">{label}</label>
            <input
                type={type}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
        </div>
    );
}

export default function CompanyInfoSettings() {
    const [form, setForm] = useState({
        name: '', business_number: '', business_type: '음식점', owner_name: '',
        phone: '', address: '', region: '', email: '', fax: '', website: '',
        opening_date: '', owner_title: '대표', representative_eng: '',
        tax_office: '', industry_code: '',
        work_location: '',  // 근무장소 (계약서 자동채움. 단일매장 기준)
    });
    const [savingInfo, setSavingInfo] = useState(false);
    const [infoMsg, setInfoMsg] = useState(null);

    const [docs, setDocs] = useState([]);
    const [uploadingKey, setUploadingKey] = useState(null);
    const [preview, setPreview] = useState(null); // { docs, index }

    const [sealImageUrl, setSealImageUrl] = useState('');
    const [sealUploading, setSealUploading] = useState(false);
    const [sealMsg, setSealMsg] = useState(null);

    useEffect(() => {
        loadBusinessInfo();
        loadDocs();
    }, []);

    const getBid = () => {
        // SuperAdmin View-As 모드 우선 — Sidebar 활성화 시 'view_as_business_id' 키에 저장.
        const viewAs = localStorage.getItem('view_as_business_id');
        if (viewAs) return viewAs;
        const token = localStorage.getItem('token');
        if (!token) {
            const ls = localStorage.getItem('business_id');
            return ls && ls !== '' ? ls : null;
        }
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const fromToken = payload.business_id;
            if (fromToken) return fromToken;
        } catch {
            /* fall through */
        }
        const ls = localStorage.getItem('business_id');
        return ls && ls !== '' ? ls : null;
    };

    const loadBusinessInfo = async () => {
        try {
            const bid = getBid();
            // bid 가 없어도 backend 가 X-View-As-Business 헤더로 결정 가능 — 호출 시도.
            const url = bid ? `/auth/business-info?bid=${bid}` : `/auth/business-info`;
            const res = await api.get(url);
            const d = res.data || {};
            setForm((prev) => ({
                ...prev,
                name: d.business_name || '',
                business_number: d.business_number || '',
                business_type: d.business_type || '음식점',
                owner_name: d.owner_name || '',
                phone: d.phone || '',
                address: d.address || '',
                region: d.region || '',
                email: d.email || '',
                fax: d.fax || '',
                website: d.website || '',
                opening_date: d.opening_date || '',
                owner_title: d.owner_title || '대표',
                representative_eng: d.representative_eng || '',
                tax_office: d.tax_office || '',
                industry_code: d.industry_code || '',
                work_location: d.work_location || '',
            }));
            if (d.seal_image_url) setSealImageUrl(d.seal_image_url);
        } catch (e) {
            console.error('loadBusinessInfo error:', e);
        }
    };

    const loadDocs = async () => {
        try {
            const res = await api.get('/business-docs');
            setDocs(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error('loadDocs error:', e);
        }
    };

    const saveInfo = async () => {
        setSavingInfo(true);
        setInfoMsg(null);
        try {
            await api.put('/auth/business-settings', form);
            setInfoMsg({ type: 'success', text: '회사 정보가 저장되었습니다.' });
        } catch (e) {
            console.error(e);
            setInfoMsg({ type: 'error', text: e.response?.data?.detail || '저장 중 오류가 발생했습니다.' });
        } finally {
            setSavingInfo(false);
        }
    };

    const uploadDoc = async (e, docKey) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
            alert(`파일 크기가 ${MAX_FILE_MB}MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
            e.target.value = null;
            return;
        }
        setUploadingKey(docKey);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('doc_type', docKey);
            await api.post('/business-docs', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            await loadDocs();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || '업로드 실패');
        } finally {
            setUploadingKey(null);
            e.target.value = null;
        }
    };

    const deleteDoc = async (id) => {
        if (!window.confirm('이 문서를 삭제할까요?')) return;
        try {
            await api.delete(`/business-docs/${id}`);
            await loadDocs();
        } catch (err) {
            console.error(err);
            alert('삭제 실패');
        }
    };

    const handleSealImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('직인 이미지는 5MB 이하여야 합니다.');
            e.target.value = null;
            return;
        }
        setSealUploading(true);
        setSealMsg(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await api.post('/business-docs/seal-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setSealImageUrl(res.data?.seal_image_url || '');
            setSealMsg({ type: 'success', text: '직인 이미지가 업로드되었습니다. 증명서에 자동 반영됩니다.' });
        } catch (err) {
            console.error(err);
            setSealMsg({ type: 'error', text: err.response?.data?.detail || '업로드 실패' });
        } finally {
            setSealUploading(false);
            e.target.value = null;
        }
    };

    const handleSealImageClear = async () => {
        if (!window.confirm('업로드된 직인 이미지를 제거하고 SVG 기본 직인으로 돌아갈까요?')) return;
        try {
            await api.delete('/business-docs/seal-image');
            setSealImageUrl('');
            setSealMsg({ type: 'success', text: '직인 이미지가 제거되었습니다. SVG 직인으로 표시됩니다.' });
        } catch (err) {
            console.error(err);
            setSealMsg({ type: 'error', text: '제거 실패' });
        }
    };

    const openPreview = (typeDocs, index) => setPreview({ docs: typeDocs, index });

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Company Info Form */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6 card-animate">
                <div className="flex items-center gap-3 mb-6 border-b pb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Building2 size={18} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">회사 기본정보</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            증명서·계약서·명세서에 자동으로 반영되는 회사 공식 정보입니다.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="사업장명" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="예: 소담김밥" />
                    <Field label="사업자등록번호" value={form.business_number} onChange={(v) => setForm({ ...form, business_number: v })} placeholder="000-00-00000" />
                    <Field label="대표자명 (한글)" value={form.owner_name} onChange={(v) => setForm({ ...form, owner_name: v })} placeholder="예: 홍지연" />
                    <Field label="대표자명 (영문)" value={form.representative_eng} onChange={(v) => setForm({ ...form, representative_eng: v })} placeholder="예: HONG JI YEON" />
                    <Field label="대표 직함" value={form.owner_title} onChange={(v) => setForm({ ...form, owner_title: v })} placeholder="대표 / 대표이사 / CEO" />
                    <Field label="업종" value={form.business_type} onChange={(v) => setForm({ ...form, business_type: v })} placeholder="예: 음식점" />
                    <Field label="업태/업종코드" value={form.industry_code} onChange={(v) => setForm({ ...form, industry_code: v })} placeholder="예: 한식 일반음식점" />
                    <Field label="개업일" value={form.opening_date} onChange={(v) => setForm({ ...form, opening_date: v })} placeholder="YYYY-MM-DD" type="date" />
                    <Field label="전화번호" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="02-000-0000" />
                    <Field label="팩스" value={form.fax} onChange={(v) => setForm({ ...form, fax: v })} placeholder="02-000-0000" />
                    <Field label="이메일" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="contact@example.com" type="email" />
                    <Field label="홈페이지" value={form.website} onChange={(v) => setForm({ ...form, website: v })} placeholder="https://" />
                    <Field label="지역" value={form.region} onChange={(v) => setForm({ ...form, region: v })} placeholder="예: 서울" />
                    <Field label="관할세무서" value={form.tax_office} onChange={(v) => setForm({ ...form, tax_office: v })} placeholder="예: 광진세무서" />
                    <Field
                        label="주소"
                        value={form.address}
                        onChange={(v) => setForm({ ...form, address: v })}
                        placeholder="예: 서울시 광진구 능동로 110 스타시티 영촌빌딩 B208호"
                        className="md:col-span-2"
                    />
                    <Field
                        label="근무장소 (계약서 자동입력)"
                        value={form.work_location}
                        onChange={(v) => setForm({ ...form, work_location: v })}
                        placeholder="예: 소담김밥 건대본점 매장"
                        className="md:col-span-2"
                    />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                    근무장소는 전자계약서의 <code className="bg-slate-100 px-1 rounded">{'{work_location}'}</code> 변수에 자동 치환됩니다.
                    다중 매장 보유 시는 추후 매장별 선택 기능이 추가될 예정입니다.
                </p>

                {infoMsg && (
                    <div className={`mt-4 text-sm font-medium p-4 rounded-xl ${
                        infoMsg.type === 'error'
                            ? 'bg-red-50 border border-red-200 text-red-600'
                            : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                    }`}>
                        {infoMsg.text}
                    </div>
                )}

                <button
                    onClick={saveInfo}
                    disabled={savingInfo}
                    className="mt-5 w-full md:w-auto px-6 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl text-sm font-semibold hover:from-slate-700 hover:to-slate-800 transition-all shadow-sm disabled:opacity-50"
                >
                    {savingInfo ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {savingInfo ? '저장 중...' : '회사 정보 저장'}
                </button>
            </div>

            {/* Seal Image Upload */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6 card-animate">
                <div className="flex items-center gap-3 mb-5 border-b pb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20">
                        <Stamp size={18} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">직인 이미지 직접 업로드</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            실제 도장을 스캔한 이미지를 업로드하면 증명서에 해당 이미지가 표시됩니다. (없으면 회사직인 관리 탭의 SVG 스타일 사용)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-5 flex-wrap">
                    <div className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                        {sealImageUrl ? (
                            <img
                                src={buildFileUrl(sealImageUrl)}
                                alt="직인"
                                className="w-full h-full object-contain p-2"
                            />
                        ) : (
                            <span className="text-xs text-slate-400">이미지 없음</span>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
                            {sealUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            {sealUploading ? '업로드 중...' : sealImageUrl ? '직인 이미지 변경' : '직인 이미지 업로드'}
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={handleSealImageUpload}
                                disabled={sealUploading}
                                className="hidden"
                            />
                        </label>
                        {sealImageUrl && (
                            <button
                                onClick={handleSealImageClear}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100"
                            >
                                <Trash2 size={16} /> 업로드 이미지 제거
                            </button>
                        )}
                        <p className="text-xs text-slate-400 leading-relaxed">
                            PNG 배경 투명 권장. 5MB 이하. <br />
                            이미지 업로드 시 SVG 직인보다 우선 적용됩니다.
                        </p>
                    </div>
                </div>

                {sealMsg && (
                    <div className={`mt-4 text-sm font-medium p-4 rounded-xl ${
                        sealMsg.type === 'error'
                            ? 'bg-red-50 border border-red-200 text-red-600'
                            : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                    }`}>
                        {sealMsg.text}
                    </div>
                )}
            </div>

            {/* Document Uploads */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6 card-animate">
                <div className="flex items-center gap-3 mb-5 border-b pb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <FileText size={18} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">회사 공식 문서 보관함</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            사업자등록증·영업신고증·임대차계약서 등 회사 운영 서류를 업로드해 보관합니다. 같은 유형에 여러 파일을 올릴 수 있습니다.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {DOC_TYPES.map((doc) => {
                        const typeDocs = docs
                            .filter((d) => d.doc_type === doc.key)
                            .sort((a, b) => (a.uploaded_at || '').localeCompare(b.uploaded_at || ''));
                        const isUploading = uploadingKey === doc.key;
                        const count = typeDocs.length;

                        return (
                            <div key={doc.key} className="border border-slate-100 rounded-xl overflow-hidden">
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
                                                <span className="ml-2 text-xs text-slate-400">미등록</span>
                                            )}
                                        </div>
                                    </div>
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
                                            accept="image/*,.pdf,.doc,.docx,.hwp,.xls,.xlsx,.txt"
                                            onChange={(e) => uploadDoc(e, doc.key)}
                                        />
                                    </label>
                                </div>

                                {count > 0 && (
                                    <div className="divide-y divide-slate-50">
                                        {typeDocs.map((d, idx) => (
                                            <div key={d.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    {isImg(d.original_filename) ? (
                                                        <div
                                                            className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 cursor-pointer border border-slate-200 hover:border-blue-300"
                                                            onClick={() => openPreview(typeDocs, idx)}
                                                        >
                                                            <img
                                                                src={buildFileUrl(d.file_path)}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 cursor-pointer border border-slate-200 hover:border-blue-300"
                                                            onClick={() => openPreview(typeDocs, idx)}
                                                        >
                                                            {isPdf(d.original_filename) ? <FileText size={18} className="text-slate-400" /> : <FileIcon size={18} className="text-slate-400" />}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold text-slate-700 truncate max-w-[260px]">
                                                            {d.original_filename}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono">
                                                                {getExt(d.original_filename).replace('.', '').toUpperCase()}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {fmtDate(d.uploaded_at)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button
                                                        onClick={() => openPreview(typeDocs, idx)}
                                                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                                                        title="미리보기"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteDoc(d.id)}
                                                        className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"
                                                        title="삭제"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {preview && (
                <PreviewModal
                    docs={preview.docs}
                    initialIndex={preview.index}
                    onClose={() => setPreview(null)}
                />
            )}
        </div>
    );
}
