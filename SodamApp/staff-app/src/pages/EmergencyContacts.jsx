import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Phone, AlertCircle, ArrowLeft } from 'lucide-react';

export default function EmergencyContacts() {
    const navigate = useNavigate();
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/emergency-contacts');
                if (res.data.status === 'success') setContacts(res.data.data);
            } catch (e) { console.error(e); }
            setLoading(false);
        })();
    }, []);

    // Group by category
    const groups = contacts.reduce((acc, c) => {
        const cat = c.category || '기타';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(c);
        return acc;
    }, {});

    const categoryColors = {
        '배달앱': { bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe' },
        '장비AS': { bg: '#fef3c7', color: '#d97706', border: '#fde68a' },
        '기타': { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    };

    return (
        <div className="page animate-fade">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <ArrowLeft size={22} color="#475569" />
                </button>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>🚨 비상연락처</h1>
            </div>

            {loading ? (
                <div className="text-center" style={{ padding: '48px 0', color: 'var(--text-muted)' }}>로딩 중...</div>
            ) : contacts.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <AlertCircle size={40} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>등록된 비상연락처가 없습니다.</p>
                    <p style={{ color: '#cbd5e1', fontSize: '0.75rem', marginTop: '4px' }}>관리자가 연락처를 추가하면 여기에 표시됩니다.</p>
                </div>
            ) : (
                Object.entries(groups).map(([category, items]) => {
                    const style = categoryColors[category] || categoryColors['기타'];
                    return (
                        <div key={category} style={{ marginBottom: '16px' }}>
                            <div style={{
                                display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                                background: style.bg, color: style.color, marginBottom: '8px'
                            }}>
                                {category}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {items.map((c) => (
                                    <a
                                        key={c.id}
                                        href={`tel:${c.phone.replace(/-/g, '')}`}
                                        className="card"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '14px',
                                            padding: '14px 16px', textDecoration: 'none', color: 'inherit',
                                            borderLeft: `4px solid ${style.color}`, transition: 'transform 0.15s',
                                        }}
                                    >
                                        <div style={{
                                            width: '42px', height: '42px', borderRadius: '12px',
                                            background: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <Phone size={20} style={{ color: style.color }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{c.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{c.phone}</div>
                                            {(c.store_id || c.note) && (
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '3px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    {c.store_id && <span>🏪 {c.store_id}</span>}
                                                    {c.note && <span>📝 {c.note}</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{
                                            padding: '8px 14px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700,
                                            background: style.color, color: 'white', flexShrink: 0
                                        }}>
                                            전화
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
