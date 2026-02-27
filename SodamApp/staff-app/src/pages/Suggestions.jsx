import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { MessageSquarePlus, ChevronLeft, Loader2, Send, CheckCircle2, Clock, MessageCircle } from 'lucide-react';

export default function Suggestions() {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const res = await api.get('/suggestions');
            if (res.data.status === 'success') setItems(res.data.data);
        } catch { /* */ }
        finally { setLoading(false); }
    };

    const handleSubmit = async () => {
        if (!title.trim()) return;
        setSending(true);
        try {
            await api.post('/suggestions', { title: title.trim(), content: content.trim() });
            setTitle('');
            setContent('');
            setShowForm(false);
            fetchItems();
        } catch { alert('전송 실패'); }
        finally { setSending(false); }
    };

    const statusBadge = (s) => {
        const map = {
            pending: { label: '대기', cls: 'badge-warning' },
            reviewed: { label: '확인', cls: 'badge-info' },
            resolved: { label: '완료', cls: 'badge-success' },
        };
        const m = map[s] || map.pending;
        return <span className={`badge ${m.cls}`} style={{ fontSize: '0.65rem' }}>{m.label}</span>;
    };

    return (
        <div className="page animate-fade">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => navigate('/')} className="btn-ghost" style={{ padding: '4px' }}>
                        <ChevronLeft size={22} />
                    </button>
                    <h1 className="page-title">건의사항</h1>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.8rem', minHeight: 'auto' }}
                >
                    <MessageSquarePlus size={16} /> 작성
                </button>
            </div>

            {/* New Suggestion Form */}
            {showForm && (
                <div className="card mb-4" style={{ border: '2px solid var(--primary)', background: '#f0f9ff' }}>
                    <input
                        className="input"
                        placeholder="제목을 입력하세요"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{ marginBottom: '10px', fontSize: '0.9rem' }}
                    />
                    <textarea
                        className="input"
                        placeholder="내용을 입력하세요"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={4}
                        style={{ resize: 'none', fontSize: '0.85rem' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowForm(false)} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.8rem', minHeight: 'auto' }}>
                            취소
                        </button>
                        <button onClick={handleSubmit} disabled={!title.trim() || sending} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem', minHeight: 'auto' }}>
                            {sending ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={16} />}
                            전송
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="page-loading" style={{ minHeight: '200px' }}>
                    <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--primary)' }} />
                </div>
            ) : items.length === 0 ? (
                <div className="empty-state">
                    <MessageCircle size={48} className="empty-state-icon" />
                    <span className="empty-state-text">아직 건의사항이 없습니다</span>
                </div>
            ) : (
                <div>
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="card"
                            style={{ marginBottom: '10px', cursor: 'pointer' }}
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                        {statusBadge(item.status)}
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{item.title}</span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {item.staff_name} · {item.created_at ? new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                    </div>
                                </div>
                            </div>

                            {expandedId === item.id && (
                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                                    {item.content && (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                            {item.content}
                                        </p>
                                    )}
                                    {item.admin_reply && (
                                        <div style={{ marginTop: '10px', padding: '10px 12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', marginBottom: '4px' }}>
                                                <CheckCircle2 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                                                관리자 답변
                                            </div>
                                            <p style={{ fontSize: '0.8rem', color: '#065f46', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                                {item.admin_reply}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
