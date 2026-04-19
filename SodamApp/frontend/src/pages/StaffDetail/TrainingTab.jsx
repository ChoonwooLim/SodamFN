import { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Award, Plus, Trash2, Edit3, Check, X, AlertTriangle, Clock, Shield, BookOpen } from 'lucide-react';
import api from '../../api';

const TRAINING_TYPES = [
    '산업안전보건교육', '성희롱예방교육', '장애인인식개선', '직장내괴롭힘예방',
    '개인정보보호', '식품위생교육', '소방안전교육', '기타',
];

const STATUS_STYLES = {
    '이수': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    '미이수': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    '만료': { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
    '유효': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    '갱신필요': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
};

const inputClass = "w-full p-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all";
const labelClass = "block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide";

export default function TrainingTab({ id }) {
    const [trainings, setTrainings] = useState([]);
    const [certs, setCerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showTrainingForm, setShowTrainingForm] = useState(false);
    const [showCertForm, setShowCertForm] = useState(false);
    const [editingTraining, setEditingTraining] = useState(null);
    const [editingCert, setEditingCert] = useState(null);

    const [trainingForm, setTrainingForm] = useState({
        training_type: '산업안전보건교육',
        training_name: '',
        completed_date: '',
        expiry_date: '',
        certificate_number: '',
        institution: '',
        hours: 0,
        status: '미이수',
        note: '',
    });

    const [certForm, setCertForm] = useState({
        cert_name: '',
        cert_number: '',
        issued_date: '',
        expiry_date: '',
        issuing_body: '',
        status: '유효',
        note: '',
    });

    const fetchData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await api.get(`/hr/training/${id}`);
            if (res.data.status === 'success') {
                setTrainings(res.data.trainings || []);
                setCerts(res.data.certifications || []);
            }
        } catch (err) {
            console.error('Training data fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const resetTrainingForm = () => {
        setTrainingForm({ training_type: '산업안전보건교육', training_name: '', completed_date: '', expiry_date: '', certificate_number: '', institution: '', hours: 0, status: '미이수', note: '' });
        setEditingTraining(null);
    };

    const resetCertForm = () => {
        setCertForm({ cert_name: '', cert_number: '', issued_date: '', expiry_date: '', issuing_body: '', status: '유효', note: '' });
        setEditingCert(null);
    };

    const handleSaveTraining = async () => {
        try {
            if (editingTraining) {
                await api.put(`/hr/training/${editingTraining}`, { staff_id: parseInt(id), ...trainingForm });
            } else {
                await api.post('/hr/training', { staff_id: parseInt(id), ...trainingForm });
            }
            setShowTrainingForm(false);
            resetTrainingForm();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.detail || '저장 실패');
        }
    };

    const handleDeleteTraining = async (tid) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await api.delete(`/hr/training/${tid}`);
            fetchData();
        } catch (err) { alert('삭제 실패'); }
    };

    const handleEditTraining = (t) => {
        setTrainingForm({
            training_type: t.training_type, training_name: t.training_name || '',
            completed_date: t.completed_date || '', expiry_date: t.expiry_date || '',
            certificate_number: t.certificate_number || '', institution: t.institution || '',
            hours: t.hours || 0, status: t.status, note: t.note || '',
        });
        setEditingTraining(t.id);
        setShowTrainingForm(true);
    };

    const handleSaveCert = async () => {
        try {
            if (editingCert) {
                await api.put(`/hr/certification/${editingCert}`, { staff_id: parseInt(id), ...certForm });
            } else {
                await api.post('/hr/certification', { staff_id: parseInt(id), ...certForm });
            }
            setShowCertForm(false);
            resetCertForm();
            fetchData();
        } catch (err) { alert(err.response?.data?.detail || '저장 실패'); }
    };

    const handleDeleteCert = async (cid) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await api.delete(`/hr/certification/${cid}`);
            fetchData();
        } catch (err) { alert('삭제 실패'); }
    };

    const handleEditCert = (c) => {
        setCertForm({
            cert_name: c.cert_name, cert_number: c.cert_number || '',
            issued_date: c.issued_date || '', expiry_date: c.expiry_date || '',
            issuing_body: c.issuing_body || '', status: c.status, note: c.note || '',
        });
        setEditingCert(c.id);
        setShowCertForm(true);
    };

    if (loading) {
        return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
    }

    // Required trainings compliance check
    const REQUIRED = ['산업안전보건교육', '성희롱예방교육', '장애인인식개선', '직장내괴롭힘예방', '개인정보보호'];
    const completedTypes = new Set(trainings.filter(t => t.status === '이수').map(t => t.training_type));
    const missingRequired = REQUIRED.filter(r => !completedTypes.has(r));

    return (
        <div className="space-y-6">
            {/* Compliance Summary */}
            {missingRequired.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-700">법정 의무교육 미이수 {missingRequired.length}건</p>
                        <p className="text-xs text-amber-600 mt-1">{missingRequired.join(', ')}</p>
                    </div>
                </div>
            )}

            {/* ═══ Training Section ═══ */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                            <GraduationCap size={16} className="text-white" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">교육 이수 관리</h3>
                        <span className="text-xs text-slate-400">{trainings.length}건</span>
                    </div>
                    <button
                        onClick={() => { resetTrainingForm(); setShowTrainingForm(!showTrainingForm); }}
                        className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={14} /> 교육 등록
                    </button>
                </div>

                {/* Training Form */}
                {showTrainingForm && (
                    <div className="p-5 border-b border-slate-100 bg-blue-50/30 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                                <label className={labelClass}>교육 유형</label>
                                <select value={trainingForm.training_type} onChange={e => setTrainingForm(p => ({ ...p, training_type: e.target.value }))} className={inputClass}>
                                    {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>교육명 (상세)</label>
                                <input type="text" value={trainingForm.training_name} onChange={e => setTrainingForm(p => ({ ...p, training_name: e.target.value }))} className={inputClass} placeholder="선택사항" />
                            </div>
                            <div>
                                <label className={labelClass}>교육기관</label>
                                <input type="text" value={trainingForm.institution} onChange={e => setTrainingForm(p => ({ ...p, institution: e.target.value }))} className={inputClass} placeholder="한국산업안전보건공단..." />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className={labelClass}>이수일</label>
                                <input type="date" value={trainingForm.completed_date} onChange={e => setTrainingForm(p => ({ ...p, completed_date: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>만료일</label>
                                <input type="date" value={trainingForm.expiry_date} onChange={e => setTrainingForm(p => ({ ...p, expiry_date: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>교육시간</label>
                                <input type="number" value={trainingForm.hours} onChange={e => setTrainingForm(p => ({ ...p, hours: parseFloat(e.target.value) || 0 }))} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>상태</label>
                                <select value={trainingForm.status} onChange={e => setTrainingForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                                    <option value="미이수">미이수</option>
                                    <option value="이수">이수</option>
                                    <option value="만료">만료</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setShowTrainingForm(false); resetTrainingForm(); }} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">취소</button>
                            <button onClick={handleSaveTraining} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold">{editingTraining ? '수정' : '등록'}</button>
                        </div>
                    </div>
                )}

                {/* Training List */}
                {trainings.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400">등록된 교육이 없습니다.</div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {trainings.map(t => {
                            const st = STATUS_STYLES[t.status] || STATUS_STYLES['미이수'];
                            const isExpiringSoon = t.expiry_date && ((new Date(t.expiry_date) - new Date()) / (1000*60*60*24)) <= 30 && ((new Date(t.expiry_date) - new Date()) / (1000*60*60*24)) >= 0;
                            return (
                                <div key={t.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                        <BookOpen size={16} className="text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-bold text-slate-800">{t.training_type}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${st.bg} ${st.color} border ${st.border}`}>{t.status}</span>
                                            {isExpiringSoon && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md animate-pulse">갱신 필요</span>}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                            {t.completed_date && <span>이수: {t.completed_date}</span>}
                                            {t.expiry_date && <span>만료: {t.expiry_date}</span>}
                                            {t.institution && <span>{t.institution}</span>}
                                            {t.hours > 0 && <span>{t.hours}시간</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        <button onClick={() => handleEditTraining(t)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={13} /></button>
                                        <button onClick={() => handleDeleteTraining(t.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={13} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ═══ Certification Section ═══ */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <Award size={16} className="text-white" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">자격증 관리</h3>
                        <span className="text-xs text-slate-400">{certs.length}건</span>
                    </div>
                    <button
                        onClick={() => { resetCertForm(); setShowCertForm(!showCertForm); }}
                        className="flex items-center gap-1 px-3 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors"
                    >
                        <Plus size={14} /> 자격증 등록
                    </button>
                </div>

                {/* Cert Form */}
                {showCertForm && (
                    <div className="p-5 border-b border-slate-100 bg-amber-50/30 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                                <label className={labelClass}>자격증명</label>
                                <input type="text" value={certForm.cert_name} onChange={e => setCertForm(p => ({ ...p, cert_name: e.target.value }))} className={inputClass} placeholder="조리기능사, 위생사..." />
                            </div>
                            <div>
                                <label className={labelClass}>자격증 번호</label>
                                <input type="text" value={certForm.cert_number} onChange={e => setCertForm(p => ({ ...p, cert_number: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>발급기관</label>
                                <input type="text" value={certForm.issuing_body} onChange={e => setCertForm(p => ({ ...p, issuing_body: e.target.value }))} className={inputClass} placeholder="한국산업인력공단..." />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className={labelClass}>취득일</label>
                                <input type="date" value={certForm.issued_date} onChange={e => setCertForm(p => ({ ...p, issued_date: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>만료일</label>
                                <input type="date" value={certForm.expiry_date} onChange={e => setCertForm(p => ({ ...p, expiry_date: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>상태</label>
                                <select value={certForm.status} onChange={e => setCertForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                                    <option value="유효">유효</option>
                                    <option value="만료">만료</option>
                                    <option value="갱신필요">갱신필요</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setShowCertForm(false); resetCertForm(); }} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">취소</button>
                            <button onClick={handleSaveCert} className="flex-1 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold">{editingCert ? '수정' : '등록'}</button>
                        </div>
                    </div>
                )}

                {/* Cert List */}
                {certs.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400">등록된 자격증이 없습니다.</div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {certs.map(c => {
                            const st = STATUS_STYLES[c.status] || STATUS_STYLES['유효'];
                            return (
                                <div key={c.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                                        <Award size={16} className="text-amber-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-bold text-slate-800">{c.cert_name}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${st.bg} ${st.color} border ${st.border}`}>{c.status}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                            {c.cert_number && <span>No. {c.cert_number}</span>}
                                            {c.issued_date && <span>취득: {c.issued_date}</span>}
                                            {c.expiry_date && <span>만료: {c.expiry_date}</span>}
                                            {c.issuing_body && <span>{c.issuing_body}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        <button onClick={() => handleEditCert(c)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit3 size={13} /></button>
                                        <button onClick={() => handleDeleteCert(c.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={13} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Legal Reference */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs text-blue-700 leading-relaxed flex items-start gap-2">
                    <Shield size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                        <span className="font-bold">법정 의무교육 5종:</span> 산업안전보건(분기별), 성희롱예방(연 1회),
                        장애인인식개선(연 1회), 직장내괴롭힘예방(연 1회), 개인정보보호(연 1회).
                        음식점업은 식품위생교육(2~3년마다 갱신)이 추가로 필요합니다.
                    </span>
                </p>
            </div>
        </div>
    );
}
