import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
    ShoppingCart, Send, CheckCircle, Clock, AlertCircle, ChevronDown,
    Plus, Trash2, ArrowLeft, Minus, Check, Star,
} from 'lucide-react';

const STATUS_LABEL = {
    draft: { text: '접수됨', cls: 'badge-warning' },
    sent: { text: '주문됨', cls: 'badge-info' },
    completed: { text: '구매완료', cls: 'badge-success' },
    canceled: { text: '취소', cls: 'badge-danger' },
};

const ORDER_UNITS = ['개', 'box', 'kg', 'g'];
const qtyLabel = (it) => `${it.quantity}${it.unit === 'box' ? ' box' : (it.unit || '')}`;
// 품목 규격 텍스트로 기본 주문 단위 추정 (예: "20kg" → kg, "1box" → box)
const defaultUnitFromSpec = (spec) => {
    const s = (spec || '').toLowerCase();
    if (/box|박스/.test(s)) return 'box';
    if (/\d\s*kg/.test(s)) return 'kg';
    if (/\d\s*g(?!\w)/.test(s)) return 'g';
    return '개';
};

export default function PurchaseRequest() {
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState([]);
    const [cart, setCart] = useState({});                 // { productId: qty }
    const [openVendors, setOpenVendors] = useState(new Set());
    const [extraItems, setExtraItems] = useState([{ name: '', quantity: '' }]);  // 직접 입력
    const [history, setHistory] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const staffName = (() => {
        try {
            const token = localStorage.getItem('token');
            return JSON.parse(atob(token.split('.')[1])).real_name || '직원';
        } catch (e) { return '직원'; }
    })();

    const fetchCatalog = async () => {
        try {
            const res = await api.get('/materials/staff/catalog');
            if (res.data.status === 'success') {
                setCatalog(res.data.data);
                setOpenVendors(new Set(res.data.data.slice(0, 2).map(g => g.vendor.id)));
            }
        } catch (e) { console.error(e); }
    };

    const fetchHistory = async () => {
        try {
            const res = await api.get(`/materials/staff/orders?requester=${encodeURIComponent(staffName)}`);
            if (res.data.status === 'success') setHistory(res.data.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchCatalog(); fetchHistory(); }, []);

    const productIndex = useMemo(() => {
        const idx = {};
        catalog.forEach(g => g.products.forEach(p => { idx[p.id] = { ...p, vendorId: g.vendor.id }; }));
        return idx;
    }, [catalog]);

    const setQty = (pid, qty) => {
        setCart(prev => {
            const next = { ...prev };
            if (qty > 0) next[pid] = { qty, unit: prev[pid]?.unit || defaultUnitFromSpec(productIndex[pid]?.spec) };
            else delete next[pid];
            return next;
        });
    };
    const setUnit = (pid, unit) => {
        setCart(prev => ({ ...prev, [pid]: { qty: prev[pid]?.qty || 1, unit } }));
    };

    const selectedCount = Object.keys(cart).length
        + extraItems.filter(i => i.name.trim()).length;

    const handleSubmit = async () => {
        if (selectedCount === 0) {
            setMessage('❌ 품목을 선택하거나 직접 입력해주세요.');
            return;
        }
        setSubmitting(true);
        setMessage('');
        try {
            // 거래처별 묶음 + 직접 입력 묶음
            const byVendor = {};
            Object.entries(cart).forEach(([pid, entry]) => {
                const p = productIndex[pid];
                if (!p) return;
                (byVendor[p.vendorId] = byVendor[p.vendorId] || []).push({
                    product_id: p.id, name: p.name, spec: p.spec || null,
                    quantity: entry.qty, unit: entry.unit || '개',
                });
            });
            const orders = Object.entries(byVendor).map(([vid, items]) => ({
                vendor_id: Number(vid), items,
            }));
            const extras = extraItems
                .filter(i => i.name.trim())
                .map(i => ({ name: i.name.trim(), spec: i.quantity.trim() || null, quantity: 1 }));
            if (extras.length > 0) orders.push({ vendor_id: null, items: extras });

            await api.post('/materials/staff/orders', { staff_name: staffName, orders });
            setMessage('✅ 구매 요청이 사장님께 전송되었습니다!');
            setCart({});
            setExtraItems([{ name: '', quantity: '' }]);
            fetchHistory();
            window.scrollTo({ top: 0 });
        } catch (e) {
            setMessage('❌ 전송 실패: ' + (e.response?.data?.detail || '서버 오류'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page animate-fade">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <ArrowLeft size={22} color="#475569" />
                </button>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>재료 구매 요청</h1>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 14px 42px' }}>
                작성자: <b style={{ color: '#0f766e' }}>{staffName}</b> — 필요한 품목에 수량을 입력하세요
            </p>

            {message && (
                <div className={`status-banner ${message.includes('✅') ? 'success' : 'error'}`} style={{ marginBottom: '16px' }}>
                    <div className="status-banner-icon">
                        {message.includes('✅') ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    </div>
                    <div className="status-banner-text">
                        <p style={{ fontWeight: 600 }}>{message}</p>
                    </div>
                </div>
            )}

            {/* 거래처별 품목 선택 */}
            {catalog.map(({ vendor, products }) => {
                const isOpen = openVendors.has(vendor.id);
                const selCount = products.filter(p => cart[p.id]).length;
                return (
                    <div key={vendor.id} className="card" style={{ marginBottom: '10px', padding: 0, overflow: 'hidden' }}>
                        <button
                            onClick={() => setOpenVendors(prev => {
                                const next = new Set(prev);
                                next.has(vendor.id) ? next.delete(vendor.id) : next.add(vendor.id);
                                return next;
                            })}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                                padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer',
                            }}>
                            {vendor.is_primary && <Star size={13} color="#f59e0b" fill="#fbbf24" style={{ flexShrink: 0 }} />}
                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{vendor.name}</span>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{products.length}개 품목</span>
                            {selCount > 0 && (
                                <span style={{
                                    fontSize: '0.7rem', fontWeight: 700, color: '#0f766e',
                                    background: '#ccfbf1', padding: '2px 8px', borderRadius: 999,
                                }}>✓ {selCount}</span>
                            )}
                            <ChevronDown size={16} color="#94a3b8"
                                style={{ marginLeft: 'auto', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                        </button>
                        {isOpen && products.map(p => {
                            const entry = cart[p.id];
                            const qty = entry?.qty || 0;
                            const unit = entry?.unit || defaultUnitFromSpec(p.spec);
                            const checked = qty > 0;
                            return (
                                <div key={p.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 14px', borderTop: '1px solid #f1f5f9',
                                    background: checked ? '#f0fdfa' : 'transparent',
                                }}>
                                    <button onClick={() => setQty(p.id, checked ? 0 : 1)} style={{
                                        width: 24, height: 24, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
                                        border: checked ? 'none' : '2px solid #cbd5e1',
                                        background: checked ? '#14b8a6' : '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {checked && <Check size={15} color="#fff" strokeWidth={3} />}
                                    </button>
                                    <button onClick={() => setQty(p.id, checked ? 0 : 1)}
                                        style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{p.name}</span>
                                        {p.spec && <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: 6 }}>{p.spec}</span>}
                                    </button>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                        <button onClick={() => setQty(p.id, Math.max(0, qty - 1))} style={{
                                            width: 32, height: 32, borderRadius: 10, border: 'none',
                                            background: '#f1f5f9', color: '#475569', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}><Minus size={14} /></button>
                                        <span style={{ width: 28, textAlign: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                                            {qty || '-'}
                                        </span>
                                        <button onClick={() => setQty(p.id, qty + 1)} style={{
                                            width: 32, height: 32, borderRadius: 10, border: 'none',
                                            background: '#14b8a6', color: '#fff', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}><Plus size={14} /></button>
                                        {/* 주문 단위: 개 / box */}
                                        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', marginLeft: 4 }}>
                                            {ORDER_UNITS.map(u => (
                                                <button key={u} onClick={() => setUnit(p.id, u)} style={{
                                                    padding: '0 5px', height: 32, border: 'none', cursor: 'pointer',
                                                    fontSize: '0.65rem', fontWeight: 700,
                                                    background: unit === u ? (checked ? '#1e293b' : '#e2e8f0') : '#fff',
                                                    color: unit === u ? (checked ? '#fff' : '#475569') : '#94a3b8',
                                                }}>{u}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })}

            {/* 직접 입력 (목록에 없는 품목) */}
            <div className="card" style={{ marginBottom: '16px' }}>
                <div className="section-header" style={{ marginBottom: '10px' }}>
                    <span className="section-title"><Plus size={15} /> 목록에 없는 품목 직접 입력</span>
                    <button onClick={() => setExtraItems(prev => [...prev, { name: '', quantity: '' }])}
                        className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.75rem', minHeight: 'auto' }}>
                        <Plus size={13} /> 추가
                    </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {extraItems.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="text" placeholder="품목명 (예: 단무지)" value={item.name}
                                onChange={e => setExtraItems(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                                style={{ flex: 2, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 600, outline: 'none' }} />
                            <input type="text" placeholder="수량 (예: 3박스)" value={item.quantity}
                                onChange={e => setExtraItems(prev => prev.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                                style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none' }} />
                            {extraItems.length > 1 && (
                                <button onClick={() => setExtraItems(prev => prev.filter((_, i) => i !== idx))}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}>
                                    <Trash2 size={15} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 전송 */}
            <button onClick={handleSubmit} disabled={submitting || selectedCount === 0}
                className="btn btn-primary"
                style={{
                    width: '100%', marginBottom: 20, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8, opacity: selectedCount === 0 ? 0.5 : 1,
                }}>
                {submitting
                    ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    : <Send size={18} />}
                {submitting ? '전송 중...' : `구매 요청 보내기${selectedCount > 0 ? ` (${selectedCount}개 품목)` : ''}`}
            </button>

            {/* 내 요청 내역 */}
            {history.length > 0 && (
                <div>
                    <div className="section-header" style={{ marginBottom: '10px' }}>
                        <span className="section-title"><Clock size={16} /> 내 요청 내역</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {history.map(o => {
                            const st = STATUS_LABEL[o.status] || STATUS_LABEL.draft;
                            return (
                                <div key={o.id} className="card" style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                                            <ShoppingCart size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                                            {o.vendor_name}
                                        </span>
                                        <span className={`badge ${st.cls}`} style={{ fontSize: '0.7rem' }}>{st.text}</span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 4 }}>
                                        {o.items.map(i => `${i.name} ×${qtyLabel(i)}`).join(', ')}
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                        {o.order_date}{o.completed_at ? ` · 구매완료 ${o.completed_at.slice(0, 10)}` : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
