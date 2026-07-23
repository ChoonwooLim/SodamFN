import { useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Receipt, BarChart3, ShoppingCart, Camera, MoreHorizontal, RefreshCw } from 'lucide-react';
import api from '../api';

export default function BottomNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(0);
    const [toast, setToast] = useState(null);   // { text, ok, busy }

    const fullPath = location.pathname + location.search;
    const isActive = (path) => {
        if (path.includes('?')) return fullPath === path;
        return location.pathname === path;
    };

    // 어디서든 영수증 촬영 → 자동 업로드 · AI 분류 · 매입 반영
    const handleFiles = async (files) => {
        const list = Array.from(files || []).filter(f => f.type.startsWith('image/'));
        if (list.length === 0) return;
        setUploading(list.length);
        setToast({ text: `영수증 ${list.length}장 AI 분류 중...`, ok: true, busy: true });
        let ok = 0, classified = 0, lastInfo = '';
        for (const f of list) {
            try {
                const fd = new FormData();
                fd.append('file', f);
                const res = await api.post('/materials/receipts', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                if (res.data.status === 'success') {
                    ok += 1;
                    const d = res.data.data;
                    if (d.status === 'classified') {
                        classified += 1;
                        lastInfo = `${d.vendor_name || ''} ${d.amount ? d.amount.toLocaleString('ko-KR') + '원' : ''}`.trim();
                    }
                }
            } catch (e) { console.error(e); }
            setUploading(prev => prev - 1);
        }
        if (ok === 0) {
            setToast({ text: '업로드 실패 — 다시 시도해 주세요', ok: false });
        } else if (classified === ok) {
            setToast({ text: `✓ ${lastInfo || `${ok}장`} 매입 반영 — 탭하면 보관함`, ok: true });
        } else {
            setToast({ text: `${ok}장 보관 (반영 ${classified}·확인필요 ${ok - classified}) — 탭하면 보관함`, ok: true });
        }
        setTimeout(() => setToast(null), 6000);
    };

    const navItems = [
        { icon: Receipt, path: '/finance/profitloss', label: '손익' },
        { icon: BarChart3, path: '/revenue', label: '매출' },
        null, // 중앙 영수증 촬영 버튼
        { icon: ShoppingCart, path: '/materials/order-form', label: '자재' },
        { icon: MoreHorizontal, path: '/more', label: '더보기' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {/* 촬영 업로드 결과 토스트 */}
            {toast && (
                <button
                    onClick={() => { setToast(null); if (toast.ok && !toast.busy) navigate('/materials/receipts'); }}
                    style={{
                        position: 'absolute', top: -52, left: '50%', transform: 'translateX(-50%)',
                        maxWidth: '92vw', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        padding: '10px 16px', borderRadius: 16, border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 700, color: '#fff',
                        background: toast.ok ? 'rgba(15,23,42,0.95)' : '#dc2626',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                    }}>
                    {toast.busy && <RefreshCw size={13} className="animate-spin" style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />}
                    {toast.text}
                </button>
            )}

            <div style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                borderTop: '1px solid rgba(0,0,0,0.04)',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                padding: '2px 4px 4px',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.04)',
            }}>
                {navItems.map((item) => {
                    if (item === null) {
                        return (
                            <button key="capture" onClick={() => fileRef.current?.click()} disabled={uploading > 0}
                                aria-label="영수증 촬영"
                                className="touch-feedback"
                                style={{
                                    width: 54, height: 54, borderRadius: '50%', border: 'none',
                                    marginTop: -20, cursor: 'pointer', flexShrink: 0,
                                    background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                                    boxShadow: '0 6px 18px rgba(225,29,72,0.38), 0 0 0 4px rgba(255,255,255,0.9)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff',
                                }}>
                                {uploading > 0
                                    ? <RefreshCw size={23} className="animate-spin" />
                                    : <Camera size={25} />}
                            </button>
                        );
                    }
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className="touch-feedback"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '6px 8px 4px',
                                borderRadius: 12,
                                textDecoration: 'none',
                                minWidth: 52,
                                position: 'relative',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        >
                            {active && (
                                <div className="bnav-active-bg" style={{
                                    position: 'absolute',
                                    top: 2,
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.08))',
                                }} />
                            )}
                            <Icon
                                size={20}
                                strokeWidth={active ? 2.2 : 1.6}
                                style={{
                                    color: active ? '#3B82F6' : '#94A3B8',
                                    position: 'relative',
                                    zIndex: 1,
                                    transition: 'all 0.2s ease',
                                    ...(active ? { filter: 'drop-shadow(0 1px 3px rgba(59,130,246,0.3))' } : {}),
                                }}
                            />
                            <span style={{
                                fontSize: 9,
                                marginTop: 1,
                                fontWeight: active ? 700 : 500,
                                color: active ? '#3B82F6' : '#94A3B8',
                                position: 'relative',
                                zIndex: 1,
                            }}>{item.label}</span>
                        </Link>
                    );
                })}
            </div>

            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden
                onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
        </div>
    );
}
