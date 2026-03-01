import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle, History } from 'lucide-react';
import api from '../api';

export default function InventoryCheck() {
    const navigate = useNavigate();
    const [inventoryItems, setInventoryItems] = useState([]);
    const [inventoryValues, setInventoryValues] = useState({});
    const [note, setNote] = useState('');
    const [todayRecords, setTodayRecords] = useState([]);
    const [historyData, setHistoryData] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        fetchItems();
        fetchTodayRecords();
    }, []);

    const fetchItems = async () => {
        try {
            let res = await api.get('/inventory-items');
            if (res.data.status === 'success') {
                let items = res.data.data.filter(i => i.is_active);
                if (items.length === 0) {
                    await api.post('/inventory-items/seed');
                    res = await api.get('/inventory-items');
                    if (res.data.status === 'success') items = res.data.data.filter(i => i.is_active);
                }
                setInventoryItems(items);
                const vals = {};
                items.forEach(i => { vals[String(i.id)] = 0; });
                setInventoryValues(vals);
            }
        } catch { /* ignore */ }
    };

    const fetchTodayRecords = async () => {
        try {
            const res = await api.get('/inventory-check/today');
            if (res.data.status === 'success') setTodayRecords(res.data.data);
        } catch { /* ignore */ }
    };

    const fetchHistory = async () => {
        try {
            const res = await api.get('/inventory-check/history?days=7');
            if (res.data.status === 'success') setHistoryData(res.data.data);
        } catch { /* ignore */ }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            let staffId = 0, staffName = '';
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                staffId = payload.staff_id || 0;
                staffName = payload.real_name || '';
            }
            await api.post(`/inventory-check?staff_id=${staffId}&staff_name=${encodeURIComponent(staffName)}`, {
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

    const toggleHistory = () => {
        if (!showHistory) fetchHistory();
        setShowHistory(!showHistory);
    };

    const formatDate = (d) => {
        const date = new Date(d + 'T00:00:00');
        return `${date.getMonth() + 1}/${date.getDate()} (${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})`;
    };

    // Group items by category
    const categorized = {};
    inventoryItems.forEach(item => {
        if (!categorized[item.category]) categorized[item.category] = [];
        categorized[item.category].push(item);
    });

    // Item name map for records
    const itemNameMap = {};
    inventoryItems.forEach(i => { itemNameMap[String(i.id)] = i; });

    return (
        <div className="page animate-fade" style={{ paddingBottom: 80 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <ArrowLeft size={22} color="#475569" />
                </button>
                <div>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>📦 오픈 재고 체크</h1>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>매일 남은 재고 수량을 기록하세요</p>
                </div>
            </div>

            {/* Input Form */}
            <div style={{ border: '2px solid #0891b2', borderRadius: 16, background: 'linear-gradient(135deg, #ecfeff, #f0fdfa)', overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg, #0891b2, #0e7490)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>📦</span>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>재고 수량 입력</span>
                    {submitted && (
                        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 8, fontSize: '0.75rem', color: '#fff', fontWeight: 600 }}>
                            <CheckCircle size={14} /> 저장완료
                        </span>
                    )}
                </div>
                <div style={{ padding: '16px' }}>
                    {/* Dynamic categories */}
                    {Object.entries(categorized).map(([cat, items]) => (
                        <div key={cat} style={{ background: '#fff', borderRadius: 10, padding: '12px', border: '1px solid #a5f3fc', marginBottom: 14 }}>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#164e63', marginBottom: 10 }}>
                                {cat === '기본' ? '📋 기본' : cat === '주먹밥' ? '🍙 주먹밥' : `📦 ${cat}`}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                                {items.map(item => (
                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', minWidth: 90 }}><span style={{ fontSize: '0.9rem' }}>{item.emoji}</span> {item.name}</span>
                                        <input type="number" min="0" value={inventoryValues[String(item.id)] || 0}
                                            onChange={e => setInventoryValues(prev => ({ ...prev, [String(item.id)]: parseInt(e.target.value) || 0 }))}
                                            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #a5f3fc', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', background: '#ecfeff', outline: 'none', maxWidth: 80 }} />
                                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{item.unit}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {/* 메모 */}
                    <textarea placeholder="메모 (선택사항)" value={note}
                        onChange={e => setNote(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #a5f3fc', fontSize: '0.82rem', resize: 'vertical', minHeight: 48, maxHeight: 100, background: '#fff', outline: 'none', marginBottom: 12 }} />
                    {/* Submit */}
                    <button onClick={handleSubmit} disabled={submitting}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', background: submitted ? 'linear-gradient(135deg, #0d9488, #059669)' : 'linear-gradient(135deg, #0891b2, #0e7490)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, transition: 'all 0.3s' }}>
                        {submitting ? '저장 중...' : submitted ? (<><CheckCircle size={18} /> 저장 완료!</>) : (<><Send size={18} /> 재고 체크 저장</>)}
                    </button>
                </div>
            </div>

            {/* Today's Records */}
            {todayRecords.length > 0 && (
                <div style={{ marginTop: 16 }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>📊 오늘의 재고 기록</h3>
                    {todayRecords.map((r, idx) => (
                        <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b' }}>👤 {r.staff_name || '직원'}</span>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                    {r.created_at ? new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '0.75rem' }}>
                                {r.items && Object.entries(r.items).map(([itemId, count]) => {
                                    const itemDef = itemNameMap[itemId];
                                    if (!itemDef) return null;
                                    return (
                                        <span key={itemId} style={{ background: '#ecfeff', padding: '2px 8px', borderRadius: 6, color: '#164e63' }}>
                                            {itemDef.emoji} {itemDef.name} {count}
                                        </span>
                                    );
                                })}
                            </div>
                            {r.note && <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>💬 {r.note}</div>}
                        </div>
                    ))}
                </div>
            )}

            {/* History Toggle */}
            <button onClick={toggleHistory} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 0', marginTop: 16,
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                fontWeight: 600, fontSize: '0.82rem', color: '#475569', cursor: 'pointer'
            }}>
                <History size={16} /> {showHistory ? '최근 기록 닫기' : '📅 최근 7일 기록 보기'}
            </button>

            {showHistory && Object.keys(historyData).length > 0 && (
                <div style={{ marginTop: 10 }}>
                    {Object.entries(historyData).map(([date, records]) => (
                        <div key={date} style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0e7490', marginBottom: 6, padding: '4px 8px', background: '#ecfeff', borderRadius: 6, display: 'inline-block' }}>
                                📅 {formatDate(date)}
                            </div>
                            {records.map((r, idx) => (
                                <div key={idx} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 8, padding: '8px 10px', marginBottom: 4, fontSize: '0.73rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, color: '#334155' }}>👤 {r.staff_name || '직원'}</span>
                                        <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                                            {r.created_at ? new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {r.items && Object.entries(r.items).map(([itemId, count]) => {
                                            const itemDef = itemNameMap[itemId];
                                            if (!itemDef) return <span key={itemId} className="bg-slate-100 px-1 rounded">#{itemId}: {count}</span>;
                                            return (
                                                <span key={itemId} style={{ background: '#ecfeff', padding: '1px 6px', borderRadius: 4, color: '#164e63' }}>
                                                    {itemDef.emoji}{itemDef.name} {count}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    {r.note && <div style={{ color: '#64748b', marginTop: 2 }}>💬 {r.note}</div>}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
