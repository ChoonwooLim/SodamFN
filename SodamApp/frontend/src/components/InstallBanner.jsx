import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/*
 * 관리자 앱 홈 화면 설치(A2HS) 유도 배너 — 모바일 하단 내비 위에 표시.
 * - Android/Chrome: beforeinstallprompt(index.html 조기 캡처) → 원탭 네이티브 설치
 * - iOS Safari / 기타 브라우저: 인라인 설치 안내 문구
 * - 이미 설치(standalone) 시 미표시, 닫으면 3일 스누즈
 * 렌더 위치가 Layout의 md:hidden 블록이라 데스크톱에는 나타나지 않음.
 */
const DISMISS_KEY = 'a2hs_dismissed_at';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

export default function InstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState(() => window.__deferredA2HS || null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isStandalone()) return;
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

    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua);

    const dismiss = () => {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setVisible(false);
    };

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setVisible(false);
        window.__deferredA2HS = null;
        setDeferredPrompt(null);
    };

    const subText = deferredPrompt
        ? '설치하면 바탕화면 아이콘으로 바로 열 수 있어요'
        : isIOS
            ? 'Safari 공유 버튼 → "홈 화면에 추가"를 누르세요'
            : 'Chrome 메뉴(⋮) → "앱 설치"를 누르세요';

    return (
        <div style={S.wrap}>
            <div style={S.card}>
                <img src="/icons/icon-192x192.png" alt="" style={S.icon} />
                <div style={S.textBox}>
                    <div style={S.title}>홈 화면에 앱 추가</div>
                    <div style={S.sub}>{subText}</div>
                </div>
                {deferredPrompt && (
                    <button onClick={handleInstall} style={S.installBtn}>설치</button>
                )}
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
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
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
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
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
