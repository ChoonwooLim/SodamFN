import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

/*
 * 로그인 후 홈 화면 설치(A2HS) 유도 배너.
 * - Android/Chrome: beforeinstallprompt(전역 조기 캡처: main.jsx) → 원탭 네이티브 설치
 * - iOS/기타 브라우저: /install 가이드 페이지로 이동
 * - 이미 설치(standalone) 시 미표시, 닫으면 3일 스누즈
 */
const DISMISS_KEY = 'a2hs_dismissed_at';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

export default function InstallBanner() {
    const navigate = useNavigate();
    const [deferredPrompt, setDeferredPrompt] = useState(() => window.__deferredA2HS || null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent || '';
        const isMobileUA = /iPad|iPhone|iPod|Android/.test(ua);
        if (!isMobileUA || isStandalone()) return;
        const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
        if (Date.now() - dismissedAt < SNOOZE_MS) return;
        setVisible(true);

        const onReady = () => setDeferredPrompt(window.__deferredA2HS);
        const onInstalled = () => setVisible(false);
        window.addEventListener('a2hs-ready', onReady);
        window.addEventListener('a2hs-installed', onInstalled);
        return () => {
            window.removeEventListener('a2hs-ready', onReady);
            window.removeEventListener('a2hs-installed', onInstalled);
        };
    }, []);

    if (!visible) return null;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '');

    const dismiss = () => {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setVisible(false);
    };

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') setVisible(false);
            window.__deferredA2HS = null;
            setDeferredPrompt(null);
        } else {
            navigate('/install');
        }
    };

    return (
        <div style={S.wrap}>
            <div style={S.card}>
                <img src="/icons/icon-192.png" alt="" style={S.icon} />
                <div style={S.textBox}>
                    <div style={S.title}>홈 화면에 앱 추가</div>
                    <div style={S.sub}>
                        {deferredPrompt
                            ? '설치하면 바탕화면 아이콘으로 바로 열 수 있어요'
                            : isIOS
                                ? 'Safari 공유 버튼 → "홈 화면에 추가"'
                                : '설치 방법을 확인해 보세요'}
                    </div>
                </div>
                <button onClick={handleInstall} style={S.installBtn}>
                    {deferredPrompt ? '설치' : '방법 보기'}
                </button>
                <button onClick={dismiss} style={S.closeBtn} aria-label="닫기">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}

const S = {
    wrap: {
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 12px)',
        zIndex: 40,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
    },
    card: {
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        maxWidth: 460,
        background: 'white',
        borderRadius: 16,
        padding: '10px 12px',
        boxShadow: '0 8px 30px rgba(15, 23, 42, 0.18)',
        border: '1px solid #e2e8f0',
    },
    icon: { width: 40, height: 40, borderRadius: 10, flexShrink: 0 },
    textBox: { flex: 1, minWidth: 0 },
    title: { fontSize: 14, fontWeight: 800, color: '#0f172a' },
    sub: { fontSize: 11.5, color: '#64748b', marginTop: 1, lineHeight: 1.4, wordBreak: 'keep-all' },
    installBtn: {
        flexShrink: 0,
        padding: '10px 16px',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: 'white',
        border: 'none',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 800,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    closeBtn: {
        flexShrink: 0,
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f1f5f9',
        color: '#94a3b8',
        border: 'none',
        borderRadius: 10,
        cursor: 'pointer',
    },
};
