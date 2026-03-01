import { useState, useEffect } from 'react';
import { Package, Plus, Pencil, Trash2, Save, ChevronDown, ChevronUp, Send, CheckCircle, Settings, History } from 'lucide-react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

export default function InventoryCheckAdmin() {
    const [inventoryItems, setInventoryItems] = useState([]);
    const [inventoryValues, setInventoryValues] = useState({});
    const [todayRecords, setTodayRecords] = useState([]);
    const [historyData, setHistoryData] = useState({});
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Item management
    const [editingItem, setEditingItem] = useState(null);
    const [newItem, setNewItem] = useState({ name: '', emoji: '📦', unit: '개', category: '기타', display_order: 0 });
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        fetchItems();
        fetchTodayRecords();
    }, []);

    const fetchItems = async () => {
        try {
            let res = await axios.get(`${API}/api/inventory-items`);
            if (res.data.status === 'success') {
                let items = res.data.data;
                if (items.length === 0) {
                    await axios.post(`${API}/api/inventory-items/seed`);
                    res = await axios.get(`${API}/api/inventory-items`);
                    items = res.data.data || [];
                }
                setInventoryItems(items);
                const vals = {};
                items.filter(i => i.is_active).forEach(i => { vals[String(i.id)] = 0; });
                setInventoryValues(vals);
            }
        } catch { /* ignore */ }
    };

    const fetchTodayRecords = async () => {
        try {
            const res = await axios.get(`${API}/api/inventory-check/today`);
            if (res.data.status === 'success') setTodayRecords(res.data.data);
        } catch { /* ignore */ }
    };

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${API}/api/inventory-check/history?days=7`);
            if (res.data.status === 'success') setHistoryData(res.data.data);
        } catch { /* ignore */ }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await axios.post(`${API}/api/inventory-check?staff_id=0&staff_name=${encodeURIComponent('관리자')}`, {
                items: inventoryValues,
                note: note || null
            });
            setSubmitted(true);
            fetchTodayRecords();
            setTimeout(() => setSubmitted(false), 3000);
        } catch (err) {
            alert('저장 실패: ' + (err.response?.data?.detail || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddItem = async () => {
        if (!newItem.name.trim()) return;
        try {
            await axios.post(`${API}/api/inventory-items`, { ...newItem, display_order: inventoryItems.length + 1 });
            setNewItem({ name: '', emoji: '📦', unit: '개', category: '기타', display_order: 0 });
            setShowAddForm(false);
            fetchItems();
        } catch (err) { alert('추가 실패: ' + (err.response?.data?.detail || err.message)); }
    };

    const handleUpdateItem = async (item) => {
        try {
            await axios.put(`${API}/api/inventory-items/${item.id}`, item);
            setEditingItem(null);
            fetchItems();
        } catch (err) { alert('수정 실패: ' + (err.response?.data?.detail || err.message)); }
    };

    const handleDeleteItem = async (id) => {
        if (!confirm('이 항목을 삭제하시겠습니까?')) return;
        try {
            await axios.delete(`${API}/api/inventory-items/${id}`);
            fetchItems();
        } catch (err) { alert('삭제 실패: ' + (err.response?.data?.detail || err.message)); }
    };

    const activeItems = inventoryItems.filter(i => i.is_active);
    const categorized = {};
    activeItems.forEach(item => {
        if (!categorized[item.category]) categorized[item.category] = [];
        categorized[item.category].push(item);
    });

    const itemNameMap = {};
    inventoryItems.forEach(i => { itemNameMap[String(i.id)] = i; });

    const formatDate = (d) => {
        const date = new Date(d + 'T00:00:00');
        return `${date.getMonth() + 1}/${date.getDate()} (${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})`;
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-cyan-100 rounded-xl">
                            <Package size={24} className="text-cyan-700" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">오픈 재고 체크</h1>
                            <p className="text-sm text-slate-500">매일 재고 수량을 기록하고 관리합니다</p>
                        </div>
                    </div>
                    <button onClick={() => setShowSettings(!showSettings)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${showSettings ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                        <Settings size={16} />
                        항목 관리
                    </button>
                </div>

                {/* ══════ Settings Panel ══════ */}
                {showSettings && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Settings size={16} className="text-slate-500" /> 재고 항목 설정
                        </h3>
                        <div className="space-y-2">
                            {inventoryItems.map(item => (
                                editingItem?.id === item.id ? (
                                    <div key={item.id} className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                        <div className="grid grid-cols-5 gap-2 mb-2">
                                            <input value={editingItem.emoji}
                                                onChange={e => setEditingItem({ ...editingItem, emoji: e.target.value })}
                                                className="p-2 rounded-lg border text-center text-lg" placeholder="이모지" />
                                            <input value={editingItem.name}
                                                onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                                className="col-span-2 p-2 rounded-lg border text-sm" placeholder="항목 이름" />
                                            <input value={editingItem.unit}
                                                onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}
                                                className="p-2 rounded-lg border text-sm text-center" placeholder="단위" />
                                            <select value={editingItem.category}
                                                onChange={e => setEditingItem({ ...editingItem, category: e.target.value })}
                                                className="p-2 rounded-lg border text-sm">
                                                <option value="기본">기본</option>
                                                <option value="주먹밥">주먹밥</option>
                                                <option value="기타">기타</option>
                                            </select>
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => handleUpdateItem(editingItem)}
                                                className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold">
                                                <Save size={14} /> 저장
                                            </button>
                                            <button onClick={() => setEditingItem(null)}
                                                className="px-4 py-1.5 rounded-lg bg-slate-200 text-slate-600 text-sm">취소</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border ${item.is_active ? 'bg-white border-slate-100' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                                        <span className="text-xl">{item.emoji}</span>
                                        <span className="flex-1 font-semibold text-sm text-slate-700">{item.name}</span>
                                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{item.category}</span>
                                        <span className="text-xs text-slate-400">{item.unit}</span>
                                        <button onClick={() => setEditingItem({ ...item })}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                                            <Pencil size={14} />
                                        </button>
                                        <button onClick={() => handleDeleteItem(item.id)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )
                            ))}

                            {showAddForm ? (
                                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                                    <div className="grid grid-cols-5 gap-2 mb-2">
                                        <input value={newItem.emoji}
                                            onChange={e => setNewItem({ ...newItem, emoji: e.target.value })}
                                            className="p-2 rounded-lg border text-center text-lg" placeholder="📦" />
                                        <input value={newItem.name}
                                            onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                            className="col-span-2 p-2 rounded-lg border text-sm" placeholder="항목 이름" />
                                        <input value={newItem.unit}
                                            onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                                            className="p-2 rounded-lg border text-sm text-center" placeholder="개" />
                                        <select value={newItem.category}
                                            onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                            className="p-2 rounded-lg border text-sm">
                                            <option value="기본">기본</option>
                                            <option value="주먹밥">주먹밥</option>
                                            <option value="기타">기타</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={handleAddItem}
                                            className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold">
                                            <Plus size={14} /> 추가
                                        </button>
                                        <button onClick={() => setShowAddForm(false)}
                                            className="px-4 py-1.5 rounded-lg bg-slate-200 text-slate-600 text-sm">취소</button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => setShowAddForm(true)}
                                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 text-sm font-medium transition-colors">
                                    <Plus size={16} /> 새 항목 추가
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════ Input Form ══════ */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                    <div className="bg-gradient-to-r from-cyan-600 to-teal-600 px-6 py-4 flex items-center gap-3">
                        <Package size={20} className="text-white" />
                        <span className="text-white font-bold text-lg">재고 수량 입력</span>
                        {submitted && (
                            <span className="ml-auto flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-lg text-sm text-white font-semibold">
                                <CheckCircle size={14} /> 저장됨
                            </span>
                        )}
                    </div>
                    <div className="p-6 space-y-4">
                        {Object.entries(categorized).map(([cat, items]) => (
                            <div key={cat} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <div className="text-sm font-bold text-slate-700 mb-3">
                                    {cat === '기본' ? '📋 기본' : cat === '주먹밥' ? '🍙 주먹밥' : `📦 ${cat}`}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {items.map(item => (
                                        <div key={item.id} className="bg-white rounded-lg p-3 border border-slate-100">
                                            <label className="text-xs font-bold text-slate-600 block mb-1.5">{item.emoji} {item.name}</label>
                                            <div className="flex items-center gap-2">
                                                <input type="number" min="0" value={inventoryValues[String(item.id)] || 0}
                                                    onChange={e => setInventoryValues(prev => ({ ...prev, [String(item.id)]: parseInt(e.target.value) || 0 }))}
                                                    className="w-full p-2 rounded-lg border border-cyan-200 text-center font-bold text-lg bg-cyan-50 outline-none focus:border-cyan-400 transition-colors" />
                                                <span className="text-xs text-slate-500">{item.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <textarea placeholder="메모 (선택사항)" value={note}
                            onChange={e => setNote(e.target.value)}
                            className="w-full p-3 rounded-xl border border-slate-200 text-sm resize-none bg-white outline-none focus:border-cyan-400 transition-colors" rows={2} />
                        <button onClick={handleSubmit} disabled={submitting}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all ${submitted ? 'bg-emerald-500' : 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700'} ${submitting ? 'opacity-60 cursor-not-allowed' : ''}`}>
                            {submitting ? '저장 중...' : submitted ? (<><CheckCircle size={18} /> 저장 완료!</>) : (<><Send size={18} /> 재고 체크 저장</>)}
                        </button>
                    </div>
                </div>

                {/* ══════ Today's Records ══════ */}
                {todayRecords.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800">📊 오늘의 재고 기록</h3>
                        </div>
                        <div className="p-4 space-y-2">
                            {todayRecords.map((r, idx) => (
                                <div key={idx} className="bg-slate-50 rounded-xl p-3">
                                    <div className="flex justify-between mb-2">
                                        <span className="font-bold text-sm text-slate-700">👤 {r.staff_name || '직원'}</span>
                                        <span className="text-xs text-slate-400">
                                            {r.created_at ? new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {r.items && Object.entries(r.items).map(([itemId, count]) => {
                                            const def = itemNameMap[itemId];
                                            if (!def) return null;
                                            return (
                                                <span key={itemId} className="bg-cyan-50 px-2 py-0.5 rounded-lg text-xs font-medium text-cyan-800">
                                                    {def.emoji} {def.name} {count}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    {r.note && <div className="text-xs text-slate-500 mt-1.5">💬 {r.note}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ══════ History ══════ */}
                <button onClick={() => { if (!showHistory) fetchHistory(); setShowHistory(!showHistory); }}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                    <History size={16} /> {showHistory ? '최근 기록 닫기' : '📅 최근 7일 기록 보기'}
                </button>

                {showHistory && Object.keys(historyData).length > 0 && (
                    <div className="mt-4 space-y-4">
                        {Object.entries(historyData).map(([date, records]) => (
                            <div key={date} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-5 py-3 border-b border-slate-100 bg-cyan-50">
                                    <span className="font-bold text-sm text-cyan-800">📅 {formatDate(date)}</span>
                                </div>
                                <div className="p-3 space-y-2">
                                    {records.map((r, idx) => (
                                        <div key={idx} className="bg-slate-50 rounded-lg p-2.5 text-xs">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-semibold text-slate-700">👤 {r.staff_name || '직원'}</span>
                                                <span className="text-slate-400">
                                                    {r.created_at ? new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {r.items && Object.entries(r.items).map(([itemId, count]) => {
                                                    const def = itemNameMap[itemId];
                                                    if (!def) return <span key={itemId} className="bg-slate-100 px-1.5 rounded">#{itemId}: {count}</span>;
                                                    return (
                                                        <span key={itemId} className="bg-cyan-50 px-1.5 rounded text-cyan-800">
                                                            {def.emoji}{def.name} {count}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            {r.note && <div className="text-slate-500 mt-1">💬 {r.note}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
