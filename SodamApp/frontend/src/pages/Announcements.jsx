import { useEffect, useState } from 'react';
import api from '../api';
import { Megaphone, Plus, Trash2, Save, Edit2, X, Pin } from 'lucide-react';

export default function AnnouncementsAdmin() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ title: '', content: '', pinned: false });

    const fetch_ = async () => {
        setLoading(true);
        try {
            const res = await api.get('/announcements');
            if (res.data.status === 'success') setItems(res.data.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetch_(); }, []);

    const resetForm = () => { setForm({ title: '', content: '', pinned: false }); setEditId(null); setShowForm(false); };

    const handleSave = async () => {
        if (!form.title) return alert('제목을 입력해주세요.');
        try {
            if (editId) await api.put(`/announcements/${editId}`, form);
            else await api.post('/announcements', form);
            resetForm(); fetch_();
        } catch (e) { alert('저장 실패'); }
    };

    const handleEdit = (a) => { setForm({ title: a.title, content: a.content, pinned: a.pinned }); setEditId(a.id); setShowForm(true); };
    const handleDelete = async (id) => { if (!window.confirm('삭제하시겠습니까?')) return; try { await api.delete(`/announcements/${id}`); fetch_(); } catch (e) { alert('삭제 실패'); } };

    return (
        <div className="min-h-screen bg-slate-50 p-6 pb-24">
            <div className="max-w-3xl mx-auto">
                <header className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Megaphone size={24} /></div>
                        <h1 className="text-2xl font-black text-slate-900">공지사항 관리</h1>
                    </div>
                    <button onClick={() => { resetForm(); setShowForm(!showForm); }}
                        className="flex items-center gap-1 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800">
                        {showForm ? <X size={16} /> : <Plus size={16} />}
                        {showForm ? '취소' : '추가'}
                    </button>
                </header>

                {showForm && (
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6">
                        <h3 className="font-bold text-sm mb-3 text-slate-700">{editId ? '공지 수정' : '새 공지 작성'}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">제목</label>
                                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    placeholder="공지 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">내용</label>
                                <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows={4}
                                    placeholder="공지 내용" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
                            </div>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
                                <Pin size={14} /> 상단 고정
                            </label>
                        </div>
                        <button onClick={handleSave}
                            className="mt-4 flex items-center gap-1 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">
                            <Save size={16} /> {editId ? '수정' : '저장'}
                        </button>
                    </div>
                )}

                {items.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                        <Megaphone size={48} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-400 text-sm">등록된 공지사항이 없습니다.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((a) => (
                            <div key={a.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {a.pinned && <Pin size={12} className="text-amber-500 flex-shrink-0" />}
                                            <span className="font-bold text-slate-800 text-sm">{a.title}</span>
                                        </div>
                                        {a.content && <p className="text-xs text-slate-500 whitespace-pre-wrap line-clamp-2">{a.content}</p>}
                                        <span className="text-[10px] text-slate-400 mt-1 block">
                                            {a.created_at ? new Date(a.created_at).toLocaleDateString('ko-KR') : ''}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEdit(a)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><Edit2 size={14} /></button>
                                        <button onClick={() => handleDelete(a.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
