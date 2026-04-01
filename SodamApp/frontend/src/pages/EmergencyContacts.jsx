import { useEffect, useState } from 'react';
import api from '../api';
import { Phone, Plus, Trash2, Save, ChevronLeft, Edit2, X } from 'lucide-react';

const CATEGORIES = ['배달앱', '장비AS', '기타'];

const formatPhone = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.startsWith('1') && digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.startsWith('1') && digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return phone;
};

export default function EmergencyContactsAdmin() {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ name: '', phone: '', category: '배달앱', store_id: '', note: '', display_order: 0 });

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const res = await api.get('/emergency-contacts');
            if (res.data.status === 'success') setContacts(res.data.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchContacts(); }, []);

    const resetForm = () => { setForm({ name: '', phone: '', category: '배달앱', store_id: '', note: '', display_order: 0 }); setEditId(null); setShowForm(false); };

    const handleSave = async () => {
        if (!form.name || !form.phone) return alert('이름과 전화번호를 입력해주세요.');
        try {
            if (editId) {
                await api.put(`/emergency-contacts/${editId}`, form);
            } else {
                await api.post('/emergency-contacts', form);
            }
            resetForm();
            fetchContacts();
        } catch (e) {
            alert('저장 실패');
        }
    };

    const handleEdit = (c) => {
        setForm({ name: c.name, phone: c.phone, category: c.category, store_id: c.store_id || '', note: c.note || '', display_order: c.display_order });
        setEditId(c.id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        try {
            await api.delete(`/emergency-contacts/${id}`);
            fetchContacts();
        } catch (e) { alert('삭제 실패'); }
    };

    const categoryColor = {
        '배달앱': 'bg-indigo-50 text-indigo-600',
        '장비AS': 'bg-amber-50 text-amber-600',
        '기타': 'bg-green-50 text-green-600',
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-6 py-8 pb-32">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                            <Phone size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">비상연락처 관리</h1>
                            <p className="text-xs text-slate-400 mt-0.5">긴급 상황 시 필요한 연락처를 관리합니다</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowForm(!showForm); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl text-sm font-semibold hover:from-slate-700 hover:to-slate-800 transition-all shadow-sm"
                    >
                        {showForm ? <X size={16} /> : <Plus size={16} />}
                        {showForm ? '취소' : '추가'}
                    </button>
                </header>

                {/* Form */}
                {showForm && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-5 mb-6 card-animate">
                        <h3 className="font-bold text-sm mb-3 text-slate-700">{editId ? '연락처 수정' : '새 연락처 추가'}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">업체/서비스명</label>
                                <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    placeholder="예: 쿠팡이츠 AS센터"
                                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">전화번호</label>
                                <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    placeholder="예: 1600-9827"
                                    value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">분류</label>
                                <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">매장 아이디</label>
                                <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    placeholder="예: sodam_gangnam"
                                    value={form.store_id} onChange={(e) => setForm({ ...form, store_id: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">비고</label>
                                <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    placeholder="메모"
                                    value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">정렬순서</label>
                                <input type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                    value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <button onClick={handleSave}
                            className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl text-sm font-semibold hover:from-slate-700 hover:to-slate-800 transition-all shadow-sm">
                            <Save size={16} /> {editId ? '수정' : '저장'}
                        </button>
                    </div>
                )}

                {/* List */}
                {contacts.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center card-animate">
                        <Phone size={48} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-sm font-semibold text-slate-500">등록된 비상연락처가 없습니다.</p>
                        <p className="text-xs text-slate-400 mt-1">새 연락처를 추가해보세요</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {contacts.map((c, idx) => (
                            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-5 flex items-center gap-4 card-animate" style={{ animationDelay: `${idx * 0.05}s` }}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="font-bold text-lg text-slate-900">{c.name}</span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${categoryColor[c.category] || categoryColor['기타']}`}>
                                            {c.category || '기타'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <span className="text-base font-semibold text-slate-600 tracking-wide">{formatPhone(c.phone)}</span>
                                        {c.store_id && <span className="text-sm font-semibold text-indigo-500">매장ID: {c.store_id}</span>}
                                    </div>
                                    {c.note && <p className="text-sm text-slate-400 mt-1">{c.note}</p>}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEdit(c)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"><Edit2 size={18} /></button>
                                    <button onClick={() => handleDelete(c.id)} className="p-2 hover:bg-red-50 rounded-xl text-red-400 transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
