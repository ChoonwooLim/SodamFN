import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { ChevronLeft, Send, Loader2, MessageCircle } from 'lucide-react';

export default function StaffChat() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [myStaffId, setMyStaffId] = useState(null);
    const bottomRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setMyStaffId(payload.staff_id);
        }
        fetchMessages();
        const interval = setInterval(fetchMessages, 5000); // poll every 5s
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchMessages = async () => {
        try {
            const res = await api.get('/staff-chat?limit=100');
            if (res.data.status === 'success') setMessages(res.data.data);
        } catch { /* */ }
        finally { setLoading(false); }
    };

    const handleSend = async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        try {
            const res = await api.post('/staff-chat', { message: text.trim() });
            if (res.data.status === 'success') {
                setMessages(prev => [...prev, res.data.data]);
                setText('');
            }
        } catch { alert('전송 실패'); }
        finally { setSending(false); }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    };

    // Group messages by date
    let lastDate = '';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#e8edf3' }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
                background: 'white', borderBottom: '1px solid var(--border)', flexShrink: 0
            }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-primary)' }}>
                    <ChevronLeft size={22} />
                </button>
                <MessageCircle size={20} color="var(--primary)" />
                <h1 style={{ fontSize: '1.1rem', fontWeight: 800 }}>직원소통방</h1>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                        <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--primary)' }} />
                    </div>
                ) : messages.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, opacity: 0.5 }}>
                        <MessageCircle size={48} />
                        <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>아직 메시지가 없습니다</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMine = msg.staff_id === myStaffId;
                        const msgDate = formatDate(msg.created_at);
                        let showDate = false;
                        if (msgDate !== lastDate) {
                            showDate = true;
                            lastDate = msgDate;
                        }
                        return (
                            <div key={msg.id}>
                                {showDate && (
                                    <div style={{ textAlign: 'center', margin: '12px 0 8px', fontSize: '0.7rem', color: '#64748b' }}>
                                        <span style={{ background: '#cbd5e1', padding: '3px 12px', borderRadius: '12px', color: 'white', fontWeight: 600 }}>
                                            {msgDate}
                                        </span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom: '2px' }}>
                                    {!isMine && (
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '2px', marginLeft: '4px' }}>
                                            {msg.staff_name}
                                        </span>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', flexDirection: isMine ? 'row-reverse' : 'row' }}>
                                        <div style={{
                                            maxWidth: '75%',
                                            padding: '9px 14px',
                                            borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                            background: isMine ? 'var(--primary)' : 'white',
                                            color: isMine ? 'white' : 'var(--text-primary)',
                                            fontSize: '0.85rem',
                                            lineHeight: 1.5,
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word'
                                        }}>
                                            {msg.message}
                                        </div>
                                        <span style={{ fontSize: '0.6rem', color: '#94a3b8', flexShrink: 0 }}>
                                            {formatTime(msg.created_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                background: 'white', borderTop: '1px solid var(--border)',
                paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
                flexShrink: 0
            }}>
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="메시지를 입력하세요"
                    style={{
                        flex: 1, padding: '10px 16px', border: '1.5px solid var(--border)',
                        borderRadius: '24px', fontSize: '0.9rem', fontFamily: 'inherit',
                        background: '#f8fafc', outline: 'none'
                    }}
                />
                <button
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    style={{
                        width: '42px', height: '42px', borderRadius: '50%', border: 'none',
                        background: text.trim() ? 'var(--primary)' : '#e2e8f0',
                        color: 'white', cursor: text.trim() ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 200ms', flexShrink: 0
                    }}
                >
                    {sending ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={18} />}
                </button>
            </div>
        </div>
    );
}
