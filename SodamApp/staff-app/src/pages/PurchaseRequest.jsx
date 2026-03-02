import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
    ShoppingCart, Send, CheckCircle, Clock, AlertCircle, ChevronLeft, Plus, Trash2, ArrowLeft
} from 'lucide-react';

export default function PurchaseRequest() {
    const navigate = useNavigate();
    const [items, setItems] = useState([{ name: '', quantity: '', note: '' }]);
    const [history, setHistory] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const staffId = localStorage.getItem('staff_id');
            const res = await api.get(`/purchase-requests?staff_id=${staffId}`);
            if (res.data.status === 'success') {
                setHistory(res.data.data);
            }
        } catch (e) { console.error(e); }
    };

    const addItem = () => setItems(prev => [...prev, { name: '', quantity: '', note: '' }]);
    const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
    const updateItem = (idx, field, value) => {
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };

    const handleSubmit = async () => {
        const validItems = items.filter(item => item.name.trim());
        if (validItems.length === 0) {
            setMessage('❌ 최소 1개 이상의 재료를 입력해주세요.');
            return;
        }
        setSubmitting(true);
        setMessage('');
        try {
            const staffId = localStorage.getItem('staff_id');
            const token = localStorage.getItem('token');
            const payload = JSON.parse(atob(token.split('.')[1]));

            await api.post('/purchase-requests', {
                staff_id: parseInt(staffId),
                staff_name: payload.real_name || '직원',
                items: validItems,
            });
            setMessage('✅ 구매 요청이 전송되었습니다!');
            setItems([{ name: '', quantity: '', note: '' }]);
            fetchHistory();
        } catch (e) {
            setMessage('❌ 전송 실패: ' + (e.response?.data?.detail || '서버 오류'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page animate-fade">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <ArrowLeft size={22} color="#475569" />
                </button>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>재료 구매 요청</h1>
            </div>

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

            {/* Input Form */}
            <div className="card" style={{ marginBottom: '16px' }}>
                <div className="section-header" style={{ marginBottom: '12px' }}>
                    <span className="section-title">
                        <ShoppingCart size={16} /> 필요한 재료
                    </span>
                    <button onClick={addItem} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.75rem', minHeight: 'auto' }}>
                        <Plus size={14} /> 추가
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {items.map((item, idx) => (
                        <div key={idx} style={{
                            display: 'flex', gap: '8px', alignItems: 'center',
                            padding: '10px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0'
                        }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <input
                                    type="text"
                                    placeholder="재료명 (예: 단무지)"
                                    value={item.name}
                                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                                    style={{
                                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                                        border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600, outline: 'none'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input
                                        type="text"
                                        placeholder="수량 (예: 3박스)"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                        style={{
                                            flex: 1, padding: '6px 10px', borderRadius: '8px',
                                            border: '1px solid #e2e8f0', fontSize: '0.8rem', outline: 'none'
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="비고"
                                        value={item.note}
                                        onChange={(e) => updateItem(idx, 'note', e.target.value)}
                                        style={{
                                            flex: 1, padding: '6px 10px', borderRadius: '8px',
                                            border: '1px solid #e2e8f0', fontSize: '0.8rem', outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                            {items.length > 1 && (
                                <button onClick={() => removeItem(idx)} style={{
                                    background: 'none', border: 'none', color: '#ef4444',
                                    cursor: 'pointer', padding: '4px', flexShrink: 0
                                }}>
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                    {submitting ? <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : <Send size={18} />}
                    {submitting ? '전송 중...' : '구매 요청 보내기'}
                </button>
            </div>

            {/* History */}
            {history.length > 0 && (
                <div>
                    <div className="section-header" style={{ marginBottom: '10px' }}>
                        <span className="section-title">
                            <Clock size={16} /> 최근 요청 내역
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {history.map((req) => (
                            <div key={req.id} className="card" style={{ padding: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {new Date(req.created_at).toLocaleString('ko-KR')}
                                    </span>
                                    <span className={`badge ${req.status === 'completed' ? 'badge-success' : req.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}
                                        style={{ fontSize: '0.7rem' }}>
                                        {req.status === 'pending' ? '대기' : req.status === 'completed' ? '완료' : '반려'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {req.items.map((item, i) => (
                                        <div key={i} style={{ fontSize: '0.85rem', color: '#334155' }}>
                                            • <strong>{item.name}</strong> {item.quantity && `(${item.quantity})`} {item.note && <span style={{ color: '#94a3b8' }}>- {item.note}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
