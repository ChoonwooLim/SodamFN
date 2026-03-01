import { useState, useEffect } from 'react';
import {
    X, ClipboardList, ChevronDown, ChevronUp,
    Clock, AlertTriangle, CheckCircle2, Send, CheckCircle, Package
} from 'lucide-react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

const CHECKLIST_SECTIONS = [
    {
        id: 1,
        emoji: '?뜵',
        title: '1. 吏묎린 ?명똿',
        items: [
            { text: '吏묎린瑜?爰쇰궡???쒖옄由ъ뿉 ?먭린', type: 'check' },
            { text: '?쒕?諛ν넻 / ?대У??肄붾뱶 苑귢퀬 ?꾩썝 ?뺤씤', type: 'check' },
            { text: '?쒕?諛ν넻 ???꾩썝 ON', type: 'sub' },
            { text: '?대У?????꾩썝 OFF', type: 'sub' },
            { text: '?쒕?諛ν넻???④굅??臾?遺볤린', type: 'check' },
            { text: '?〓낭??援?옄 ?듭뿉 李щЪ ?닿퀬 援?옄 2媛??ｌ뼱?먭린', type: 'check' },
            { text: '?됱＜ ?뺣━', type: 'check' },
            { text: '2媛???臾쇰컺移⑥슜', type: 'sub' },
            { text: '2媛????곷컲 ??씠 / ? ?뚯씠釉???린??, type: 'sub' },
        ]
    },
    {
        id: 2,
        emoji: '?맅',
        title: '2. ?대У 以鍮?,
        items: [
            { text: '?대У 援?Ъ 留뚮뱾湲?, type: 'highlight' },
            { text: '?덇툑?좉퉴吏 臾?梨꾩슦湲?, type: 'check' },
            { text: '李몄튂??3?ㅽ뫜', type: 'check' },
            { text: '媛猷?1遊됱?', type: 'check' },
            { text: '?됱씪 ??2??, type: 'sub' },
            { text: '?좎슂????二쇰갑?λ떂怨??곸쓽 ???섎웾 寃곗젙', type: 'sub' },
            { text: '臾쇱씠 ?볦쑝硫??????대У遺???띔린', type: 'info' },
            { text: '?대У ?띕뒗 湲곗?', type: 'highlight' },
            { text: '?됱씪 35媛?湲곗?', type: 'sub' },
            { text: '?좎슂??30媛??섏? ?딄린', type: 'sub' },
            { text: '?꾨궇 ?⑥? ?대У 媛쒖닔 李멸퀬', type: 'sub' },
            { text: '?⑥? ?대У 泥섎━', type: 'info' },
            { text: '5媛??댄븯 ?????대У 醫낅즺 1遺?30珥???媛숈씠 ?ｊ린', type: 'sub' },
            { text: '6媛??댁긽 ???곕줈 1遺?30珥?2遺??곗슦湲?, type: 'sub' },
            { text: '?좑툘 ?덈Т ?ㅻ옒 ?곗슦硫??대У??遺덉뼱??, type: 'warning' },
            { text: '蹂닿?', type: 'highlight' },
            { text: '15媛??댁긽 ????遊됱?', type: 'sub' },
            { text: '15媛?誘몃쭔 ??以묎컙 遊됱?', type: 'sub' },
            { text: '???대У 20媛쒕뒗 ?곕줈 蹂닿?', type: 'sub' },
            { text: '諛붾줈 ?먮ℓ???대У? ?대У???욎뿉 ?먭린', type: 'sub' },
        ]
    },
    {
        id: 3, emoji: '?쪚', title: '3. ?ㅽ뙵 援쎄린',
        items: [{ text: '?쏀븳 遺덉뿉 援쎄린', type: 'check' }]
    },
    {
        id: 4, emoji: '?뜖', title: '4. ?꾨궇 ?ш퀬 ?뺤씤',
        items: [
            { text: '?쒕?', type: 'check' },
            { text: '怨꾨?', type: 'check' },
            { text: '?대У', type: 'check' },
            { text: '???⑥? ?ш퀬???꾨옒 ?ш퀬 泥댄겕?먯꽌 湲곕줉', type: 'info' },
        ]
    },
    {
        id: 5, emoji: '?맅', title: '5. 瑗ъ튂?대У',
        items: [{ text: '?앹씠 鍮좎?吏 ?딅룄濡??⑤떒??苑귢린', type: 'check' }]
    },
    {
        id: 6, emoji: '?뵦', title: '6. ?쒕? ?곗슦湲?,
        items: [
            { text: '???쒕?', type: 'highlight' },
            { text: '??5遺?, type: 'sub' },
            { text: '?꾨옒 5遺?, type: 'sub' },
            { text: '?⑥? ?쒕?', type: 'highlight' },
            { text: '??2~3遺?, type: 'sub' },
            { text: '?꾨옒 2~3遺?(??蹂닿퀬 議곗젅)', type: 'sub' },
            { text: '?좑툘 ?덈Т ?곗슦硫?猿띿쭏???곗쭛?덈떎', type: 'warning' },
            { text: '?좑툘 ?쎄컙 ???곗슫 ?먮굦?댁뼱??OK', type: 'warning' },
            { text: '??6???곸뾽 ?꾧퉴吏 1?쒓컙 30遺??숈븞 諛ν넻?먯꽌 異⑸텇??履꾩쭛?덈떎', type: 'info' },
        ]
    },
    {
        id: 7, emoji: '?쭋', title: '7. ??醫낆씠而?以鍮?,
        items: [
            { text: '醫낆씠而듭뿉 ??2~3議곌컖???ｊ린', type: 'check' },
            { text: '20媛?以鍮?, type: 'check' },
            { text: '?ъ쑀 醫낆씠而?遺議???爰쇰궡湲?, type: 'check' },
        ]
    },
    {
        id: 8, emoji: '?쪡', title: '8. ?ㅺ굅吏 ??怨꾨? ?띔린',
        items: [
            { text: '?뚭툑 + ?앹큹 瑗??ｊ린', type: 'check' },
            { text: '?됱씪 38媛?, type: 'sub' },
            { text: '二쇰쭚 28媛?, type: 'sub' },
            { text: '?쏀븳 遺덉뿉???띔린 ???볤린 ?쒖옉?섎㈃ 15遺?, type: 'info' },
            { text: '?좑툘 怨꾨? 留뚯쭊 ??諛섎뱶?????산린', type: 'warning' },
            { text: '?좑툘 ?앺옄 ???댁궡 ?ㅻ（湲?(?쎄쾶 源⑥쭚)', type: 'warning' },
        ]
    },
    {
        id: 9, emoji: '?뜖', title: '9. 二쇰㉨諛???꾨씪??,
        items: [
            { text: '?븧 4:45 ??二쇰㉨諛?6醫?以鍮??쒖옉', type: 'timeline' },
            { text: '?븧 5:10 ??二쇰㉨諛?留뚮뱾湲??쒖옉', type: 'timeline' },
            { text: '?븧 6:10源뚯? (??紐???以묒슂!)', type: 'timeline' },
            { text: '?ㅽ뙵 二쇰㉨諛?, type: 'check' },
            { text: '遺덇퀬湲?二쇰㉨諛?, type: 'check' },
            { text: '?븧 6:40源뚯?', type: 'timeline' },
            { text: '硫몄튂 5媛??댁긽', type: 'check' },
            { text: '?쒗븳 5媛??댁긽', type: 'check' },
            { text: '留ㅼ숴 5媛??댁긽', type: 'check' },
            { text: '???꾩튂利??쒖쇅 紐⑤뱺 留??쇱??댁뒪??以鍮?, type: 'info' },
            { text: '(媛?留쏅쭏???④낏???덉뒿?덈떎)', type: 'info' },
        ]
    },
    {
        id: 10, emoji: '?맅', title: '10. ?대У',
        items: [
            { text: '?븧 7:30 ???대У ?쒖옉', type: 'timeline' },
            { text: '?븧 7:45 ??遺?耳쒓린', type: 'timeline' },
            { text: '?븧 8:40源뚯?', type: 'timeline' },
            { text: '?대У ?닿린 ?꾨즺 (以묎컙 諛뷀듃 3媛?', type: 'check' },
            { text: '?쒓퍚???ㅻ뒛 ?좎쭨 紐낇솗???묒꽦', type: 'check' },
            { text: '?ㅺ굅吏 ?꾨즺', type: 'check' },
        ]
    },
];

const NOTICE = {
    title: '?삃 ?덈궡?ы빆',
    items: [
        '?????쒓컙? ? ?놁쓬 / 諛곕떖 ?놁쓬 / ?낅Т媛 ?듭닕?댁쭏 ?뚭퉴吏 湲곗?',
        '異뷀썑 ? / 諛곕떖 / 留쏆궡 ?먯쭏 異붽? ?????쒓컙 ?ъ“???덉젙',
        '泥섏쓬?먮뒗 ?먮┫ ???덉뒿?덈떎. ?먯뿉 ?듭쑝硫?鍮⑤씪吏묐땲??',
        '?띾룄蹂대떎 ?뺥솗?깃낵 ?덉쟾???곗꽑?낅땲??',
    ]
};

const INVENTORY_FIELDS = [
    { key: 'fish_cake', label: '?대У', emoji: '?맅', unit: '媛? },
    { key: 'egg', label: '怨꾨?', emoji: '?쪡', unit: '媛? },
    { key: 'riceball_spam', label: '?ㅽ뙵', emoji: '?륅툘', unit: '媛? },
    { key: 'riceball_mild_tuna', label: '?쒗븳李몄튂', emoji: '?맅', unit: '媛? },
    { key: 'riceball_spicy_tuna', label: '留ㅼ숴李몄튂', emoji: '?뙳截?, unit: '媛? },
    { key: 'riceball_bulgogi', label: '遺덇퀬湲?, emoji: '?ⅸ', unit: '媛? },
    { key: 'riceball_anchovy', label: '硫몄튂', emoji: '?맅', unit: '媛? },
    { key: 'riceball_ham_cheese', label: '?꾩튂利?, emoji: '??', unit: '媛? },
];

export default function OpenChecklist({ isOpen, onClose }) {
    const [expandedSections, setExpandedSections] = useState(new Set([1, 2, 9, 10]));
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [showInventory, setShowInventory] = useState(false);
    const [inventory, setInventory] = useState({
        fish_cake: 0, egg: 0,
        riceball_spam: 0, riceball_mild_tuna: 0, riceball_spicy_tuna: 0,
        riceball_bulgogi: 0, riceball_anchovy: 0, riceball_ham_cheese: 0,
        note: ''
    });
    const [todayRecords, setTodayRecords] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (isOpen) fetchTodayRecords();
    }, [isOpen]);

    const fetchTodayRecords = async () => {
        try {
            const res = await axios.get(`${API}/api/inventory-check/today`);
            if (res.data.status === 'success') setTodayRecords(res.data.data);
        } catch { /* ignore */ }
    };

    const handleSubmitInventory = async () => {
        setSubmitting(true);
        try {
            await axios.post(`${API}/api/inventory-check?staff_id=0&staff_name=${encodeURIComponent('愿由ъ옄')}`, inventory);
            setSubmitted(true);
            fetchTodayRecords();
            setTimeout(() => setSubmitted(false), 3000);
        } catch (err) {
            alert('????ㅽ뙣: ' + (err.response?.data?.detail || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const toggleSection = (id) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleCheck = (key) => {
        setCheckedItems(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
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
        if (item.type === 'sub') return <div key={key} className="flex gap-1.5 pl-8 text-xs text-slate-500"><span className="text-slate-300">??/span><span>{item.text}</span></div>;
        if (item.type === 'highlight') return <div key={key} className="flex items-center gap-1.5 mt-2 font-bold text-sm text-slate-800"><CheckCircle2 size={14} className="text-emerald-500" />{item.text}</div>;
        if (item.type === 'warning') return <div key={key} className="flex items-start gap-1.5 ml-4 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-0.5"><AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /><span>{item.text}</span></div>;
        if (item.type === 'timeline') return <div key={key} className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-2.5 py-1.5 mt-1 font-semibold text-xs text-blue-800"><Clock size={12} /><span>{item.text}</span></div>;
        if (item.type === 'info') return <div key={key} className="flex items-start gap-1.5 ml-4 text-xs text-slate-500 italic"><span className="text-blue-400">??/span><span>{item.text}</span></div>;
        return null;
    };

    const progress = totalCheckItems > 0 ? Math.round(checkedCount / totalCheckItems * 100) : 0;

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
                            <h2 className="font-bold text-lg text-slate-800">?ㅽ뵂 泥댄겕由ъ뒪??/h2>
                            <p className="text-xs text-slate-500">留ㅼ씪 ?ㅽ뵂 以鍮?10?④퀎</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={20} />
                    </button>
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
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{section.emoji}</span>
                                        <span className="font-bold text-sm text-slate-800">{section.title}</span>
                                        {sectionCheckCount > 0 && (
                                            <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-semibold ${sectionChecked === sectionCheckCount ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {sectionChecked}/{sectionCheckCount}
                                            </span>
                                        )}
                                    </div>
                                    {isExpanded
                                        ? <ChevronUp size={16} className="text-slate-400" />
                                        : <ChevronDown size={16} className="text-slate-400" />
                                    }
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

                    {/* ?먥븧???벀 ?ш퀬 泥댄겕 ??(?좉?) ?먥븧??*/}
                    {showInventory && (
                        <div className="border-2 border-cyan-400 rounded-xl overflow-hidden mt-4">
                            <div className="bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-3 flex items-center gap-2">
                                <Package size={18} className="text-white" />
                                <span className="text-white font-bold text-sm">?ш퀬 ?섎웾 ?낅젰</span>
                                {submitted && (
                                    <span className="ml-auto flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded text-xs text-white font-semibold">
                                        <CheckCircle size={12} /> ??λ맖
                                    </span>
                                )}
                            </div>
                            <div className="p-4 bg-cyan-50/30 space-y-3">
                                {/* ?대У + 怨꾨? */}
                                <div className="grid grid-cols-2 gap-2">
                                    {INVENTORY_FIELDS.slice(0, 2).map(f => (
                                        <div key={f.key} className="bg-white rounded-lg p-2.5 border border-cyan-100">
                                            <label className="text-xs font-bold text-cyan-900 block mb-1">{f.emoji} {f.label}</label>
                                            <div className="flex items-center gap-1">
                                                <input type="number" min="0" value={inventory[f.key]}
                                                    onChange={e => setInventory(prev => ({ ...prev, [f.key]: parseInt(e.target.value) || 0 }))}
                                                    className="w-full p-1.5 rounded border border-cyan-200 text-center font-bold text-lg bg-cyan-50 outline-none focus:border-cyan-400" />
                                                <span className="text-xs text-slate-500">{f.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* 二쇰㉨諛?*/}
                                <div className="bg-white rounded-lg p-3 border border-cyan-100">
                                    <div className="text-xs font-bold text-cyan-900 mb-2">?뜖 二쇰㉨諛?/div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {INVENTORY_FIELDS.slice(2).map(f => (
                                            <div key={f.key} className="flex items-center gap-1.5">
                                                <span className="text-xs font-semibold text-slate-600 min-w-[52px]">{f.emoji} {f.label}</span>
                                                <input type="number" min="0" value={inventory[f.key]}
                                                    onChange={e => setInventory(prev => ({ ...prev, [f.key]: parseInt(e.target.value) || 0 }))}
                                                    className="w-14 p-1 rounded border border-cyan-200 text-center font-bold bg-cyan-50 outline-none text-sm" />
                                                <span className="text-[0.65rem] text-slate-400">{f.unit}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* 硫붾え */}
                                <textarea placeholder="硫붾え (?좏깮?ы빆)" value={inventory.note}
                                    onChange={e => setInventory(prev => ({ ...prev, note: e.target.value }))}
                                    className="w-full p-2 rounded-lg border border-cyan-200 text-sm resize-none bg-white outline-none" rows={2} />
                                {/* Submit */}
                                <button onClick={handleSubmitInventory} disabled={submitting}
                                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm text-white transition-all ${submitted ? 'bg-emerald-500' : 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700'} ${submitting ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                    {submitting ? '???以?..' : submitted ? (<><CheckCircle size={16} /> ????꾨즺!</>) : (<><Send size={16} /> ?ш퀬 泥댄겕 ???/>)}
                                </button>
                            </div>

                            {/* Today's Records */}
                            {todayRecords.length > 0 && (
                                <div className="px-4 pb-3 border-t border-cyan-100">
                                    <h4 className="text-xs font-bold text-slate-700 mt-3 mb-2">?뱤 ?ㅻ뒛 湲곕줉</h4>
                                    {todayRecords.map((r, idx) => (
                                        <div key={idx} className="bg-slate-50 rounded-lg p-2 mb-1 text-xs">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-semibold">?뫀 {r.staff_name || '吏곸썝'}</span>
                                                <span className="text-slate-400">{r.created_at ? new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                <span className="bg-emerald-50 px-1.5 rounded text-emerald-800">?대У{r.fish_cake}</span>
                                                <span className="bg-amber-50 px-1.5 rounded text-amber-800">怨꾨?{r.egg}</span>
                                                <span className="bg-blue-50 px-1.5 rounded text-blue-800">
                                                    ??r.riceball_spam} ??r.riceball_mild_tuna} 留?r.riceball_spicy_tuna} 遺?r.riceball_bulgogi} 硫?r.riceball_anchovy} ??r.riceball_ham_cheese}
                                                </span>
                                            </div>
                                            {r.note && <div className="text-slate-500 mt-1">?뮠 {r.note}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer: Toggle Inventory */}
                <div className="sticky bottom-0 bg-white border-t border-slate-100 rounded-b-2xl px-6 py-4">
                    <button
                        onClick={() => setShowInventory(!showInventory)}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold shadow-lg transition-all ${showInventory ? 'bg-slate-200 text-slate-600 shadow-none' : 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-cyan-500/20 hover:from-cyan-700 hover:to-teal-700'}`}
                    >
                        <Package size={18} />
                        {showInventory ? '?ш퀬 泥댄겕 ?リ린' : '?벀 ?ㅽ뵂?ш퀬 泥댄겕?섍린'}
                    </button>
                </div>
            </div>
        </div>
    );
}

