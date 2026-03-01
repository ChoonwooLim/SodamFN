import { useState, useEffect } from 'react';
import {
    X, ClipboardList, ChevronDown, ChevronUp,
    Clock, AlertTriangle, CheckCircle2, Send, CheckCircle, Package,
    Plus, Pencil, Trash2, Save, Settings
} from 'lucide-react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

const CHECKLIST_SECTIONS = [
    {
        id: 1, emoji: '🍳', title: '1. 집기 세팅',
        items: [
            { text: '집기류 꺼내서 제자리에 두기', type: 'check' },
            { text: '순대밥통 / 어묵통 코드 꽂고 전원 확인', type: 'check' },
            { text: '순대밥통 → 전원 ON', type: 'sub' },
            { text: '어묵통 → 전원 OFF', type: 'sub' },
            { text: '순대밥통에 뜨거운 물 붓기', type: 'check' },
            { text: '떡볶이 국자 통에 찬물 담고 국자 2개 넣어두기', type: 'check' },
            { text: '행주 정리', type: 'check' },
            { text: '2개 → 물받침용', type: 'sub' },
            { text: '2개 → 쟁반 닦이 / 홀 테이블 닦기용', type: 'sub' },
        ]
    },
    {
        id: 2, emoji: '🐟', title: '2. 어묵 준비',
        items: [
            { text: '어묵 국물 만들기', type: 'highlight' },
            { text: '눈금선까지 물 채우기', type: 'check' },
            { text: '참치액 3스푼', type: 'check' },
            { text: '가루 1봉지', type: 'check' },
            { text: '평일 → 2통', type: 'sub' },
            { text: '토요일 → 주방장님과 상의 후 수량 결정', type: 'sub' },
            { text: '물이 끓으면 → 새 어묵부터 삶기', type: 'info' },
            { text: '어묵 삶는 기준', type: 'highlight' },
            { text: '평일 35개 기준', type: 'sub' },
            { text: '토요일 30개 넘지 않기', type: 'sub' },
            { text: '전날 남은 어묵 개수 참고', type: 'sub' },
            { text: '남은 어묵 처리', type: 'info' },
            { text: '5개 이하 → 새 어묵 종료 1분 30초 전 같이 넣기', type: 'sub' },
            { text: '6개 이상 → 따로 1분 30초~2분 데우기', type: 'sub' },
            { text: '⚠️ 너무 오래 데우면 어묵이 불어요', type: 'warning' },
            { text: '보관', type: 'highlight' },
            { text: '15개 이상 → 큰 봉지', type: 'sub' },
            { text: '15개 미만 → 중간 봉지', type: 'sub' },
            { text: '새 어묵 20개는 따로 보관', type: 'sub' },
            { text: '바로 판매할 어묵은 어묵통 앞에 두기', type: 'sub' },
        ]
    },
    { id: 3, emoji: '🥓', title: '3. 스팸 굽기', items: [{ text: '약한 불에 굽기', type: 'check' }] },
    {
        id: 4, emoji: '🍙', title: '4. 전날 재고 확인',
        items: [
            { text: '순대', type: 'check' }, { text: '계란', type: 'check' }, { text: '어묵', type: 'check' },
            { text: '→ 남은 재고는 아래 재고 체크에서 기록', type: 'info' },
        ]
    },
    { id: 5, emoji: '🐟', title: '5. 꼬치어묵', items: [{ text: '끝이 빠지지 않도록 단단히 꽂기', type: 'check' }] },
    {
        id: 6, emoji: '🔥', title: '6. 순대 데우기',
        items: [
            { text: '새 순대', type: 'highlight' }, { text: '위 5분', type: 'sub' }, { text: '아래 5분', type: 'sub' },
            { text: '남은 순대', type: 'highlight' }, { text: '위 2~3분', type: 'sub' }, { text: '아래 2~3분 (양 보고 조절)', type: 'sub' },
            { text: '⚠️ 너무 데우면 껍질이 터집니다', type: 'warning' },
            { text: '⚠️ 약간 덜 데운 느낌이어도 OK', type: 'warning' },
            { text: '→ 6시 영업 전까지 1시간 30분 동안 밥통에서 충분히 쪄집니다', type: 'info' },
        ]
    },
    {
        id: 7, emoji: '🧅', title: '7. 파 종이컵 준비',
        items: [{ text: '종이컵에 파 2~3조각씩 넣기', type: 'check' }, { text: '20개 준비', type: 'check' }, { text: '여유 종이컵 부족 시 꺼내기', type: 'check' }]
    },
    {
        id: 8, emoji: '🥚', title: '8. 설거지 후 계란 삶기',
        items: [
            { text: '소금 + 식초 꼭 넣기', type: 'check' }, { text: '평일 38개', type: 'sub' }, { text: '주말 28개', type: 'sub' },
            { text: '약한 불에서 삶기 → 끓기 시작하면 15분', type: 'info' },
            { text: '⚠️ 계란 만진 후 반드시 손 씻기', type: 'warning' },
            { text: '⚠️ 식힐 때 살살 다루기 (쉽게 깨짐)', type: 'warning' },
        ]
    },
    {
        id: 9, emoji: '🍙', title: '9. 주먹밥 타임라인',
        items: [
            { text: '🕐 4:45 — 주먹밥 6종 준비 시작', type: 'timeline' },
            { text: '🕐 5:10 — 주먹밥 만들기 시작', type: 'timeline' },
            { text: '🕐 6:10까지 (화/목/토 중요!)', type: 'timeline' },
            { text: '스팸 주먹밥', type: 'check' }, { text: '불고기 주먹밥', type: 'check' },
            { text: '🕐 6:40까지', type: 'timeline' },
            { text: '멸치 5개 이상', type: 'check' }, { text: '순한 5개 이상', type: 'check' }, { text: '매콤 5개 이상', type: 'check' },
            { text: '※ 햄치즈 제외 모든 맛 쇼케이스에 준비', type: 'info' },
            { text: '(각 맛마다 단골이 있습니다)', type: 'info' },
        ]
    },
    {
        id: 10, emoji: '🐟', title: '10. 어묵',
        items: [
            { text: '🕐 7:30 — 어묵 시작', type: 'timeline' }, { text: '🕐 7:45 — 불 켜기', type: 'timeline' }, { text: '🕐 8:40까지', type: 'timeline' },
            { text: '어묵 담기 완료 (중간 바트 3개)', type: 'check' }, { text: '뚜껑에 오늘 날짜 명확히 작성', type: 'check' }, { text: '설거지 완료', type: 'check' },
        ]
    },
];

const NOTICE = {
    title: '😊 안내사항',
    items: [
        '※ 위 시간은 홀 없음 / 배달 없음 / 업무가 익숙해질 때까지 기준',
        '추후 홀 / 배달 / 맛살 손질 추가 시 → 시간 재조정 예정',
        '처음에는 느릴 수 있습니다. 손에 익으면 빨라집니다.',
        '속도보다 정확성과 안전이 우선입니다.',
    ]
};

export default function OpenChecklist({ isOpen, onClose }) {
    const [expandedSections, setExpandedSections] = useState(new Set([1, 2, 9, 10]));
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [showInventory, setShowInventory] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Dynamic inventory items from DB
    const [inventoryItems, setInventoryItems] = useState([]);
    const [inventoryValues, setInventoryValues] = useState({});
    const [todayRecords, setTodayRecords] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [note, setNote] = useState('');

    // Item management
    const [editingItem, setEditingItem] = useState(null);
    const [newItem, setNewItem] = useState({ name: '', emoji: '📦', unit: '개', category: '기타', display_order: 0 });
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchItems();
            fetchTodayRecords();
        }
    }, [isOpen]);

    const fetchItems = async () => {
        try {
            const res = await axios.get(`${API}/api/inventory-items`);
            if (res.data.status === 'success') {
                const items = res.data.data.filter(i => i.is_active);
                setInventoryItems(items);
                // Init values
                const vals = {};
                items.forEach(i => { vals[String(i.id)] = 0; });
                setInventoryValues(vals);
            }
            // If no items exist, seed defaults
            if (res.data.data.length === 0) {
                await axios.post(`${API}/api/inventory-items/seed`);
                const res2 = await axios.get(`${API}/api/inventory-items`);
                if (res2.data.status === 'success') {
                    const items = res2.data.data.filter(i => i.is_active);
                    setInventoryItems(items);
                    const vals = {};
                    items.forEach(i => { vals[String(i.id)] = 0; });
                    setInventoryValues(vals);
                }
            }
        } catch { /* ignore */ }
    };

    const fetchAllItems = async () => {
        try {
            const res = await axios.get(`${API}/api/inventory-items`);
            if (res.data.status === 'success') return res.data.data;
        } catch { /* ignore */ }
        return [];
    };

    const fetchTodayRecords = async () => {
        try {
            const res = await axios.get(`${API}/api/inventory-check/today`);
            if (res.data.status === 'success') setTodayRecords(res.data.data);
        } catch { /* ignore */ }
    };

    const handleSubmitInventory = async () => {
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
            await axios.post(`${API}/api/inventory-items`, {
                ...newItem,
                display_order: inventoryItems.length + 1
            });
            setNewItem({ name: '', emoji: '📦', unit: '개', category: '기타', display_order: 0 });
            setShowAddForm(false);
            fetchItems();
        } catch (err) {
            alert('추가 실패: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleUpdateItem = async (item) => {
        try {
            await axios.put(`${API}/api/inventory-items/${item.id}`, item);
            setEditingItem(null);
            fetchItems();
        } catch (err) {
            alert('수정 실패: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleDeleteItem = async (id) => {
        if (!confirm('이 항목을 삭제하시겠습니까?')) return;
        try {
            await axios.delete(`${API}/api/inventory-items/${id}`);
            fetchItems();
        } catch (err) {
            alert('삭제 실패: ' + (err.response?.data?.detail || err.message));
        }
    };

    if (!isOpen) return null;

    const toggleSection = (id) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleCheck = (key) => {
        setCheckedItems(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const totalCheckItems = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.filter(i => i.type === 'check').length, 0);
    const checkedCount = [...checkedItems].filter(k => {
        const [secId, itemIdx] = k.split('-').map(Number);
        const sec = CHECKLIST_SECTIONS.find(s => s.id === secId);
        return sec && sec.items[itemIdx]?.type === 'check';
    }).length;

    const renderItem = (item, secId, idx) => {
        const key = `${secId}-${idx}`;
        const isChecked = checkedItems.has(key);
        if (item.type === 'check') {
            return (
                <label key={key} className="flex items-start gap-2.5 py-1 cursor-pointer group">
                    <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(key)}
                        className="mt-0.5 w-4 h-4 accent-emerald-500 flex-shrink-0" />
                    <span className={`text-sm ${isChecked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.text}</span>
                </label>
            );
        }
        if (item.type === 'sub') return <div key={key} className="flex gap-1.5 pl-8 text-xs text-slate-500"><span className="text-slate-300">•</span><span>{item.text}</span></div>;
        if (item.type === 'highlight') return <div key={key} className="flex items-center gap-1.5 mt-2 font-bold text-sm text-slate-800"><CheckCircle2 size={14} className="text-emerald-500" />{item.text}</div>;
        if (item.type === 'warning') return <div key={key} className="flex items-start gap-1.5 ml-4 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-0.5"><AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /><span>{item.text}</span></div>;
        if (item.type === 'timeline') return <div key={key} className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-2.5 py-1.5 mt-1 font-semibold text-xs text-blue-800"><Clock size={12} /><span>{item.text}</span></div>;
        if (item.type === 'info') return <div key={key} className="flex items-start gap-1.5 ml-4 text-xs text-slate-500 italic"><span className="text-blue-400">→</span><span>{item.text}</span></div>;
        return null;
    };

    const progress = totalCheckItems > 0 ? Math.round(checkedCount / totalCheckItems * 100) : 0;

    // Group items by category
    const categorized = {};
    inventoryItems.forEach(item => {
        if (!categorized[item.category]) categorized[item.category] = [];
        categorized[item.category].push(item);
    });

    // Get item name by id for displaying records
    const itemNameMap = {};
    inventoryItems.forEach(i => { itemNameMap[String(i.id)] = i; });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-xl">
                            <ClipboardList size={20} className="text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-slate-800">오픈 체크리스트</h2>
                            <p className="text-xs text-slate-500">매일 오픈 준비 10단계</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3 px-6 py-3 bg-slate-50">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-500">{checkedCount}/{totalCheckItems}</span>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                    {CHECKLIST_SECTIONS.map(section => {
                        const isExpanded = expandedSections.has(section.id);
                        const sectionCheckCount = section.items.filter(i => i.type === 'check').length;
                        const sectionChecked = section.items.filter((item, idx) =>
                            item.type === 'check' && checkedItems.has(`${section.id}-${idx}`)
                        ).length;
                        return (
                            <div key={section.id} className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                                <button onClick={() => toggleSection(section.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{section.emoji}</span>
                                        <span className="font-bold text-sm text-slate-800">{section.title}</span>
                                        {sectionCheckCount > 0 && (
                                            <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-semibold ${sectionChecked === sectionCheckCount ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {sectionChecked}/{sectionCheckCount}
                                            </span>
                                        )}
                                    </div>
                                    {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                </button>
                                {isExpanded && (
                                    <div className="px-4 pb-3 space-y-0.5 border-t border-slate-50">
                                        {section.items.map((item, idx) => renderItem(item, section.id, idx))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Notice */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4">
                        <h3 className="font-bold text-blue-900 text-sm mb-2">{NOTICE.title}</h3>
                        <ul className="space-y-1">
                            {NOTICE.items.map((item, idx) => (
                                <li key={idx} className="text-xs text-blue-700 leading-relaxed">{item}</li>
                            ))}
                        </ul>
                    </div>

                    {/* ═══ 📦 재고 체크 폼 (토글) ═══ */}
                    {showInventory && (
                        <div className="border-2 border-cyan-400 rounded-xl overflow-hidden mt-4">
                            <div className="bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-3 flex items-center gap-2">
                                <Package size={18} className="text-white" />
                                <span className="text-white font-bold text-sm">재고 수량 입력</span>
                                {submitted && (
                                    <span className="ml-auto flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded text-xs text-white font-semibold">
                                        <CheckCircle size={12} /> 저장됨
                                    </span>
                                )}
                                <button onClick={() => setShowSettings(!showSettings)}
                                    className="ml-auto p-1 rounded hover:bg-white/20 text-white" title="항목 관리">
                                    <Settings size={16} />
                                </button>
                            </div>

                            {/* ── 항목 관리 모드 ── */}
                            {showSettings ? (
                                <div className="p-4 bg-slate-50 space-y-2">
                                    <h4 className="text-xs font-bold text-slate-700 mb-2">⚙️ 재고 항목 관리</h4>
                                    {inventoryItems.map(item => (
                                        editingItem?.id === item.id ? (
                                            <div key={item.id} className="bg-white rounded-lg p-2.5 border border-blue-200 space-y-2">
                                                <div className="grid grid-cols-4 gap-1.5">
                                                    <input value={editingItem.emoji}
                                                        onChange={e => setEditingItem({ ...editingItem, emoji: e.target.value })}
                                                        className="p-1.5 rounded border text-center text-lg" placeholder="이모지" />
                                                    <input value={editingItem.name}
                                                        onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                                        className="col-span-2 p-1.5 rounded border text-sm" placeholder="이름" />
                                                    <input value={editingItem.unit}
                                                        onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}
                                                        className="p-1.5 rounded border text-sm text-center" placeholder="단위" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <select value={editingItem.category}
                                                        onChange={e => setEditingItem({ ...editingItem, category: e.target.value })}
                                                        className="p-1.5 rounded border text-xs">
                                                        <option value="기본">기본</option>
                                                        <option value="주먹밥">주먹밥</option>
                                                        <option value="기타">기타</option>
                                                    </select>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleUpdateItem(editingItem)}
                                                            className="flex-1 flex items-center justify-center gap-1 p-1.5 rounded bg-blue-500 text-white text-xs font-semibold">
                                                            <Save size={12} /> 저장
                                                        </button>
                                                        <button onClick={() => setEditingItem(null)}
                                                            className="px-2 p-1.5 rounded bg-slate-200 text-slate-600 text-xs">취소</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div key={item.id} className="bg-white rounded-lg p-2 border border-slate-100 flex items-center gap-2">
                                                <span className="text-lg">{item.emoji}</span>
                                                <span className="flex-1 text-sm font-semibold text-slate-700">{item.name}</span>
                                                <span className="text-[0.65rem] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{item.category}</span>
                                                <span className="text-[0.65rem] text-slate-400">{item.unit}</span>
                                                <button onClick={() => setEditingItem({ ...item })}
                                                    className="p-1 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50">
                                                    <Pencil size={13} />
                                                </button>
                                                <button onClick={() => handleDeleteItem(item.id)}
                                                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        )
                                    ))}

                                    {/* Add New */}
                                    {showAddForm ? (
                                        <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200 space-y-2">
                                            <div className="grid grid-cols-4 gap-1.5">
                                                <input value={newItem.emoji}
                                                    onChange={e => setNewItem({ ...newItem, emoji: e.target.value })}
                                                    className="p-1.5 rounded border text-center text-lg" placeholder="📦" />
                                                <input value={newItem.name}
                                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                                    className="col-span-2 p-1.5 rounded border text-sm" placeholder="항목 이름" />
                                                <input value={newItem.unit}
                                                    onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                                                    className="p-1.5 rounded border text-sm text-center" placeholder="개" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <select value={newItem.category}
                                                    onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                                    className="p-1.5 rounded border text-xs">
                                                    <option value="기본">기본</option>
                                                    <option value="주먹밥">주먹밥</option>
                                                    <option value="기타">기타</option>
                                                </select>
                                                <div className="flex gap-1">
                                                    <button onClick={handleAddItem}
                                                        className="flex-1 flex items-center justify-center gap-1 p-1.5 rounded bg-emerald-500 text-white text-xs font-semibold">
                                                        <Plus size={12} /> 추가
                                                    </button>
                                                    <button onClick={() => setShowAddForm(false)}
                                                        className="px-2 p-1.5 rounded bg-slate-200 text-slate-600 text-xs">취소</button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowAddForm(true)}
                                            className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:text-emerald-500 hover:border-emerald-300 text-xs font-semibold transition-colors">
                                            <Plus size={14} /> 새 항목 추가
                                        </button>
                                    )}
                                </div>
                            ) : (
                                /* ── 재고 입력 모드 ── */
                                <div className="p-4 bg-cyan-50/30 space-y-3">
                                    {Object.entries(categorized).map(([cat, items]) => (
                                        <div key={cat} className="bg-white rounded-lg p-3 border border-cyan-100">
                                            <div className="text-xs font-bold text-cyan-900 mb-2">
                                                {cat === '기본' ? '📋 기본' : cat === '주먹밥' ? '🍙 주먹밥' : `📦 ${cat}`}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {items.map(item => (
                                                    <div key={item.id} className="flex items-center gap-1.5">
                                                        <span className="text-xs font-semibold text-slate-600 min-w-[52px]">{item.emoji} {item.name}</span>
                                                        <input type="number" min="0" value={inventoryValues[String(item.id)] || 0}
                                                            onChange={e => setInventoryValues(prev => ({ ...prev, [String(item.id)]: parseInt(e.target.value) || 0 }))}
                                                            className="w-14 p-1 rounded border border-cyan-200 text-center font-bold bg-cyan-50 outline-none text-sm" />
                                                        <span className="text-[0.65rem] text-slate-400">{item.unit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {/* 메모 */}
                                    <textarea placeholder="메모 (선택사항)" value={note}
                                        onChange={e => setNote(e.target.value)}
                                        className="w-full p-2 rounded-lg border border-cyan-200 text-sm resize-none bg-white outline-none" rows={2} />
                                    {/* Submit */}
                                    <button onClick={handleSubmitInventory} disabled={submitting}
                                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm text-white transition-all ${submitted ? 'bg-emerald-500' : 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700'} ${submitting ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                        {submitting ? '저장 중...' : submitted ? (<><CheckCircle size={16} /> 저장 완료!</>) : (<><Send size={16} /> 재고 체크 저장</>)}
                                    </button>
                                </div>
                            )}

                            {/* Today's Records */}
                            {todayRecords.length > 0 && !showSettings && (
                                <div className="px-4 pb-3 border-t border-cyan-100">
                                    <h4 className="text-xs font-bold text-slate-700 mt-3 mb-2">📊 오늘 기록</h4>
                                    {todayRecords.map((r, idx) => (
                                        <div key={idx} className="bg-slate-50 rounded-lg p-2 mb-1 text-xs">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-semibold">👤 {r.staff_name || '직원'}</span>
                                                <span className="text-slate-400">{r.created_at ? new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {r.items && Object.entries(r.items).map(([itemId, count]) => {
                                                    const itemDef = itemNameMap[itemId];
                                                    if (!itemDef) return null;
                                                    return (
                                                        <span key={itemId} className="bg-cyan-50 px-1.5 rounded text-cyan-800">
                                                            {itemDef.emoji}{itemDef.name} {count}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            {r.note && <div className="text-slate-500 mt-1">💬 {r.note}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-slate-100 rounded-b-2xl px-6 py-4">
                    <button
                        onClick={() => { setShowInventory(!showInventory); setShowSettings(false); }}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold shadow-lg transition-all ${showInventory ? 'bg-slate-200 text-slate-600 shadow-none' : 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-cyan-500/20 hover:from-cyan-700 hover:to-teal-700'}`}
                    >
                        <Package size={18} />
                        {showInventory ? '재고 체크 닫기' : '📦 오픈재고 체크하기'}
                    </button>
                </div>
            </div>
        </div>
    );
}
