import { useState, useEffect } from 'react';
import api from '../api';
import {
    Megaphone, MessageSquarePlus, ShoppingCart, Phone, MessageCircle,
    Plus, Trash2, Save, Edit2, X, Pin, Clock, CheckCircle, XCircle,
    RefreshCw, Send, Loader2, ClipboardList
} from 'lucide-react';

// ─── Tab definitions ─────────────────────────────
const TABS = [
    { key: 'announcements', label: '공지사항', icon: Megaphone, color: '#f59e0b' },
    { key: 'suggestions', label: '건의사항', icon: MessageSquarePlus, color: '#8b5cf6' },
    { key: 'purchases', label: '구매요청', icon: ShoppingCart, color: '#10b981' },
    { key: 'emergency', label: '비상연락처', icon: Phone, color: '#ef4444' },
    { key: 'chat', label: '직원소통방', icon: MessageCircle, color: '#6366f1' },
];

// ═══════════════════════════════════════════════════
//  공지사항 Tab
// ═══════════════════════════════════════════════════
function AnnouncementsTab() {
    const [items, setItems] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ title: '', content: '', pinned: false });

    const fetch_ = async () => {
        try { const r = await api.get('/announcements'); if (r.data.status === 'success') setItems(r.data.data); } catch { }
    };
    useEffect(() => { fetch_(); }, []);

    const resetForm = () => { setForm({ title: '', content: '', pinned: false }); setEditId(null); setShowForm(false); };
    const handleSave = async () => {
        if (!form.title) return alert('제목을 입력해주세요.');
        try { if (editId) await api.put(`/announcements/${editId}`, form); else await api.post('/announcements', form); resetForm(); fetch_(); } catch { alert('저장 실패'); }
    };
    const handleEdit = (a) => { setForm({ title: a.title, content: a.content, pinned: a.pinned }); setEditId(a.id); setShowForm(true); };
    const handleDelete = async (id) => { if (!window.confirm('삭제하시겠습니까?')) return; try { await api.delete(`/announcements/${id}`); fetch_(); } catch { alert('삭제 실패'); } };

    return (
        <>
            <div className="flex justify-end mb-4">
                <button onClick={() => { resetForm(); setShowForm(!showForm); }}
                    className="flex items-center gap-1 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800">
                    {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? '취소' : '새 공지'}
                </button>
            </div>
            {showForm && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6">
                    <div className="space-y-3">
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">제목</label>
                            <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="공지 제목" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">내용</label>
                            <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows={4} placeholder="공지 내용" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} /><Pin size={14} /> 상단 고정</label>
                    </div>
                    <button onClick={handleSave} className="mt-4 flex items-center gap-1 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">
                        <Save size={16} /> {editId ? '수정' : '저장'}
                    </button>
                </div>
            )}
            {items.length === 0 ? (
                <EmptyState icon={Megaphone} text="등록된 공지사항이 없습니다." />
            ) : (
                <div className="space-y-3">
                    {items.map(a => (
                        <div key={a.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        {a.pinned && <Pin size={12} className="text-amber-500 flex-shrink-0" />}
                                        <span className="font-bold text-slate-800 text-sm">{a.title}</span>
                                    </div>
                                    {a.content && <p className="text-xs text-slate-500 whitespace-pre-wrap line-clamp-2">{a.content}</p>}
                                    <span className="text-[10px] text-slate-400 mt-1 block">{a.created_at ? new Date(a.created_at).toLocaleDateString('ko-KR') : ''}</span>
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
        </>
    );
}

// ═══════════════════════════════════════════════════
//  건의사항 Tab
// ═══════════════════════════════════════════════════
function SuggestionsTab() {
    const [items, setItems] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [replyId, setReplyId] = useState(null);
    const [replyText, setReplyText] = useState('');

    const fetch_ = async () => {
        try { const r = await api.get('/suggestions'); if (r.data.status === 'success') setItems(r.data.data); } catch { }
    };
    useEffect(() => { fetch_(); }, []);

    const statusBadge = (s) => {
        const map = { pending: ['대기', 'bg-amber-50 text-amber-600'], reviewed: ['확인', 'bg-blue-50 text-blue-600'], resolved: ['완료', 'bg-emerald-50 text-emerald-600'] };
        const [label, cls] = map[s] || map.pending;
        return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{label}</span>;
    };

    const updateStatus = async (id, status) => { try { await api.put(`/suggestions/${id}`, { status }); fetch_(); } catch { alert('실패'); } };
    const sendReply = async (id) => {
        if (!replyText.trim()) return;
        try { await api.put(`/suggestions/${id}`, { admin_reply: replyText.trim(), status: 'reviewed' }); setReplyId(null); setReplyText(''); fetch_(); } catch { alert('실패'); }
    };
    const handleDelete = async (id) => { if (!window.confirm('삭제하시겠습니까?')) return; try { await api.delete(`/suggestions/${id}`); fetch_(); } catch { alert('삭제 실패'); } };

    return items.length === 0 ? <EmptyState icon={MessageSquarePlus} text="건의사항이 없습니다." /> : (
        <div className="space-y-3">
            {items.map(s => (
                <div key={s.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm cursor-pointer" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-700">{s.staff_name}</span>
                            {statusBadge(s.status)}
                        </div>
                        <span className="text-[10px] text-slate-400">{s.created_at ? new Date(s.created_at).toLocaleString('ko-KR') : ''}</span>
                    </div>
                    <p className="font-bold text-slate-800 text-sm mt-2">{s.title}</p>
                    {expandedId === s.id && (
                        <div className="mt-3 pt-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                            {s.content && <p className="text-sm text-slate-600 whitespace-pre-wrap mb-3">{s.content}</p>}
                            {s.admin_reply && (
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 mb-3">
                                    <span className="text-[10px] font-bold text-emerald-700">관리자 답변:</span>
                                    <p className="text-sm text-emerald-800 whitespace-pre-wrap">{s.admin_reply}</p>
                                </div>
                            )}
                            <div className="flex gap-2 flex-wrap">
                                {s.status === 'pending' && <button onClick={() => updateStatus(s.id, 'reviewed')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">확인</button>}
                                {s.status !== 'resolved' && <button onClick={() => updateStatus(s.id, 'resolved')} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">완료</button>}
                                <button onClick={() => setReplyId(replyId === s.id ? null : s.id)} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-200">답변</button>
                                <button onClick={() => handleDelete(s.id)} className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100"><Trash2 size={12} /></button>
                            </div>
                            {replyId === s.id && (
                                <div className="mt-3 flex gap-2">
                                    <input className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="답변 입력..." value={replyText} onChange={e => setReplyText(e.target.value)} />
                                    <button onClick={() => sendReply(s.id)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"><Send size={14} /></button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════
//  구매요청 Tab
// ═══════════════════════════════════════════════════
function PurchasesTab() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchReqs = async () => { setLoading(true); try { const r = await api.get('/purchase-requests'); if (r.data.status === 'success') setRequests(r.data.data); } catch { } setLoading(false); };
    useEffect(() => { fetchReqs(); }, []);

    const updateStatus = async (id, status) => { try { await api.put(`/purchase-requests/${id}/status`, { status }); fetchReqs(); } catch { alert('상태 변경 실패'); } };
    const statusBadge = (status) => {
        if (status === 'completed') return <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">완료</span>;
        if (status === 'rejected') return <span className="px-2 py-1 bg-red-50 text-red-500 rounded-full text-[10px] font-bold">반려</span>;
        return <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold animate-pulse">대기</span>;
    };

    return (
        <>
            <div className="flex justify-end mb-4">
                <button onClick={fetchReqs} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
            {requests.length === 0 ? <EmptyState icon={ShoppingCart} text="구매 요청이 없습니다." /> : (
                <div className="space-y-4">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800">{req.staff_name}</span>
                                    {statusBadge(req.status)}
                                </div>
                                <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12} />{new Date(req.created_at).toLocaleString('ko-KR')}</span>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 mb-3">
                                {req.items.map((item, i) => (
                                    <div key={i} className="flex items-center gap-2 py-1 text-sm">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></span>
                                        <span className="font-bold text-slate-700">{item.name}</span>
                                        {item.quantity && <span className="text-slate-500">({item.quantity})</span>}
                                        {item.note && <span className="text-slate-400 text-xs">— {item.note}</span>}
                                    </div>
                                ))}
                            </div>
                            {req.status === 'pending' && (
                                <div className="flex gap-2">
                                    <button onClick={() => updateStatus(req.id, 'completed')} className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"><CheckCircle size={14} /> 구매 완료</button>
                                    <button onClick={() => updateStatus(req.id, 'rejected')} className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-50 text-red-500 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100"><XCircle size={14} /> 반려</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

// ═══════════════════════════════════════════════════
//  비상연락처 Tab
// ═══════════════════════════════════════════════════
const CATEGORIES = ['배달앱', '장비AS', '기타'];
const formatPhone = (p) => {
    if (!p) return '';
    const d = p.replace(/[^0-9]/g, '');
    if (d.startsWith('1') && d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    if (d.startsWith('1') && d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
    if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return p;
};
const categoryColor = { '배달앱': 'bg-indigo-50 text-indigo-600', '장비AS': 'bg-amber-50 text-amber-600', '기타': 'bg-green-50 text-green-600' };

function EmergencyTab() {
    const [contacts, setContacts] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ name: '', phone: '', category: '배달앱', store_id: '', note: '', display_order: 0 });

    const fetch_ = async () => { try { const r = await api.get('/emergency-contacts'); if (r.data.status === 'success') setContacts(r.data.data); } catch { } };
    useEffect(() => { fetch_(); }, []);

    const resetForm = () => { setForm({ name: '', phone: '', category: '배달앱', store_id: '', note: '', display_order: 0 }); setEditId(null); setShowForm(false); };
    const handleSave = async () => {
        if (!form.name || !form.phone) return alert('이름과 전화번호를 입력해주세요.');
        try { if (editId) await api.put(`/emergency-contacts/${editId}`, form); else await api.post('/emergency-contacts', form); resetForm(); fetch_(); } catch { alert('저장 실패'); }
    };
    const handleEdit = (c) => { setForm({ name: c.name, phone: c.phone, category: c.category, store_id: c.store_id || '', note: c.note || '', display_order: c.display_order }); setEditId(c.id); setShowForm(true); };
    const handleDelete = async (id) => { if (!window.confirm('삭제하시겠습니까?')) return; try { await api.delete(`/emergency-contacts/${id}`); fetch_(); } catch { alert('삭제 실패'); } };

    return (
        <>
            <div className="flex justify-end mb-4">
                <button onClick={() => { resetForm(); setShowForm(!showForm); }}
                    className="flex items-center gap-1 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800">
                    {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? '취소' : '추가'}
                </button>
            </div>
            {showForm && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">업체/서비스명</label>
                            <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="예: 쿠팡이츠 AS센터" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">전화번호</label>
                            <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="예: 1600-9827" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">분류</label>
                            <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">매장 아이디</label>
                            <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="예: sodam_gangnam" value={form.store_id} onChange={e => setForm({ ...form, store_id: e.target.value })} /></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">비고</label>
                            <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="메모" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">정렬순서</label>
                            <input type="number" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" value={form.display_order} onChange={e => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} /></div>
                    </div>
                    <button onClick={handleSave} className="mt-4 flex items-center gap-1 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700"><Save size={16} /> {editId ? '수정' : '저장'}</button>
                </div>
            )}
            {contacts.length === 0 ? <EmptyState icon={Phone} text="등록된 비상연락처가 없습니다." /> : (
                <div className="space-y-3">
                    {contacts.map(c => (
                        <div key={c.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-black text-lg text-slate-900">{c.name}</span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${categoryColor[c.category] || categoryColor['기타']}`}>{c.category || '기타'}</span>
                                </div>
                                <div className="flex items-center gap-4 flex-wrap">
                                    <span className="text-base font-semibold text-slate-600 tracking-wide">📞 {formatPhone(c.phone)}</span>
                                    {c.store_id && <span className="text-sm font-semibold text-indigo-500">매장ID: {c.store_id}</span>}
                                </div>
                                {c.note && <p className="text-sm text-slate-400 mt-1">📝 {c.note}</p>}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(c)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><Edit2 size={18} /></button>
                                <button onClick={() => handleDelete(c.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

// ═══════════════════════════════════════════════════
//  직원소통방 Tab
// ═══════════════════════════════════════════════════
function ChatTab() {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    const fetch_ = async () => { try { const r = await api.get('/staff-chat?limit=100'); if (r.data.status === 'success') setMessages(r.data.data); } catch { } setLoading(false); };
    useEffect(() => { fetch_(); const i = setInterval(fetch_, 5000); return () => clearInterval(i); }, []);

    const handleSend = async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        try { await api.post('/staff-chat', { message: text.trim() }); setText(''); fetch_(); } catch { alert('전송 실패'); }
        finally { setSending(false); }
    };

    const handleDelete = async (id) => { if (!window.confirm('메시지를 삭제하시겠습니까?')) return; try { await api.delete(`/staff-chat/${id}`); fetch_(); } catch { alert('삭제 실패'); } };

    const formatTime = (iso) => iso ? new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    return (
        <>
            {/* Message Input */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mb-4 flex gap-3 items-center">
                <input
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                    placeholder="메시지를 입력하세요..."
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                />
                <button
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 전송
                </button>
            </div>

            {/* Messages List */}
            {messages.length === 0 ? <EmptyState icon={MessageCircle} text="메시지가 없습니다." /> : (
                <div className="space-y-2">
                    {messages.map(m => (
                        <div key={m.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                {(m.staff_name || '?')[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-sm text-slate-800">{m.staff_name}</span>
                                    <span className="text-[10px] text-slate-400">{formatTime(m.created_at)}</span>
                                </div>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap">{m.message}</p>
                            </div>
                            <button onClick={() => handleDelete(m.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-400 flex-shrink-0"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

// ─── Shared Empty State ──────────────────────────
function EmptyState({ icon: Icon, text }) {
    return (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <Icon size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 text-sm">{text}</p>
        </div>
    );
}

// ═══════════════════════════════════════════════════
//  Main Board Management Page
// ═══════════════════════════════════════════════════
export default function BoardManagement() {
    const [activeTab, setActiveTab] = useState('announcements');

    const renderTab = () => {
        switch (activeTab) {
            case 'announcements': return <AnnouncementsTab />;
            case 'suggestions': return <SuggestionsTab />;
            case 'purchases': return <PurchasesTab />;
            case 'emergency': return <EmergencyTab />;
            case 'chat': return <ChatTab />;
            default: return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 pb-24">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <header className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                        <ClipboardList size={24} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">통합 게시판 관리</h1>
                </header>

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all"
                                style={{
                                    background: isActive ? tab.color : 'white',
                                    color: isActive ? 'white' : '#475569',
                                    border: isActive ? 'none' : '1px solid #e2e8f0',
                                    boxShadow: isActive ? `0 4px 14px ${tab.color}40` : 'none',
                                }}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                {renderTab()}
            </div>
        </div>
    );
}
