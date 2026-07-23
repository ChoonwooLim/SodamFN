import { useState, useEffect, useRef } from 'react';
import { Download, Share2, Plus, CheckCircle2, ExternalLink, AlertTriangle, Chrome } from 'lucide-react';

/* ─── Platform & Browser Detection ─── */
function detectEnv() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|Chrome|FxiOS/.test(ua);
    const isChrome = /Chrome/.test(ua) && !/Edg|OPR|SamsungBrowser/.test(ua);
    const isSamsung = /SamsungBrowser/.test(ua);

    // In-app browser detection (KakaoTalk, Line, Facebook, Instagram, etc.)
    const isInApp = /KAKAOTALK|NAVER|Line|FBAN|FBAV|Instagram|Daum|Whale/.test(ua);

    const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;

    return { platform, isIOS, isAndroid, isSafari, isChrome, isSamsung, isInApp, isStandalone };
}

export default function InstallGuide() {
    const env = useRef(detectEnv()).current;
    const [deferredPrompt, setDeferredPrompt] = useState(() => window.__deferredA2HS || null);
    const [installed, setInstalled] = useState(env.isStandalone);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setInstalled(true);
        setDeferredPrompt(null);
    };

    const siteUrl = window.location.origin;
    const installUrl = `${siteUrl}/install`;

    const openInChrome = () => {
        // Android intent:// URL to force open in Chrome
        window.location.href = `intent://${window.location.host}/install#Intent;scheme=https;package=com.android.chrome;end`;
    };

    const openInDefaultBrowser = () => {
        // Generic approach: try to open in external browser
        window.open(installUrl, '_system');
    };

    const openInSafari = () => {
        // iOS: copy URL and guide user to paste in Safari
        navigator.clipboard?.writeText(installUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
    };

    const shareInstallLink = () => {
        const text = `[소담김밥] 직원 앱을 설치해주세요!\n\n아래 링크를 눌러서 앱을 설치할 수 있습니다:\n${installUrl}\n\n📌 iPhone: Safari에서 열기 → 공유 → 홈 화면에 추가\n📌 Android: Chrome에서 열기 → 메뉴 → 앱 설치`;
        if (navigator.share) {
            navigator.share({ title: '소담 Staff 앱 설치', text, url: installUrl });
        } else {
            navigator.clipboard?.writeText(text);
            alert('메시지가 복사되었습니다!\n카카오톡이나 이메일에 붙여넣기 하세요.');
        }
    };

    /* ─── Already Installed ─── */
    if (installed) {
        return (
            <div style={S.page}>
                <div style={S.card}>
                    <div style={{ ...S.iconCircle, background: '#059669' }}>
                        <CheckCircle2 size={40} color="white" />
                    </div>
                    <h1 style={S.title}>설치 완료! 🎉</h1>
                    <p style={S.desc}>소담 Staff 앱이 설치되었습니다.<br />홈 화면에서 앱을 실행하세요.</p>
                    <a href="/" style={S.btnPrimary}>앱 열기</a>
                </div>
            </div>
        );
    }

    return (
        <div style={S.page}>
            {/* Hero */}
            <div style={S.hero}>
                <img src="/icons/icon-192.png" alt="소담 Staff" style={S.appIcon} />
                <h1 style={S.heroTitle}>소담 Staff</h1>
                <p style={S.heroSub}>직원 전용 모바일 앱</p>
                <div style={S.badges}>
                    <span style={S.badge}>📱 출퇴근 관리</span>
                    <span style={S.badge}>📋 전자계약</span>
                    <span style={S.badge}>💬 소통방</span>
                </div>
            </div>

            {/* ─── IN-APP BROWSER WARNING (KakaoTalk, etc.) ─── */}
            {env.isInApp && (
                <div style={S.card}>
                    <div style={S.warningBox}>
                        <AlertTriangle size={20} color="#f59e0b" />
                        <strong style={{ color: '#f59e0b' }}>카카오톡 내 브라우저에서는 설치할 수 없습니다!</strong>
                    </div>

                    {env.isAndroid && (
                        <>
                            <p style={S.desc}>아래 버튼을 누르면 Chrome에서 바로 열립니다.</p>
                            <button onClick={openInChrome} style={{ ...S.btnPrimary, background: '#4285F4' }}>
                                <Chrome size={20} /> Chrome에서 열기
                            </button>
                            <button onClick={openInDefaultBrowser} style={S.btnSecondary}>
                                <ExternalLink size={16} /> 다른 브라우저에서 열기
                            </button>
                        </>
                    )}

                    {env.isIOS && (
                        <>
                            <p style={S.desc}>링크를 복사한 후 <strong>Safari</strong>에 붙여넣기 해주세요.</p>
                            <button onClick={openInSafari} style={{ ...S.btnPrimary, background: '#007AFF' }}>
                                {copied ? '✅ 복사됨! Safari에 붙여넣기 하세요' : '📋 링크 복사 → Safari에서 열기'}
                            </button>
                        </>
                    )}

                    <div style={S.urlBox}>
                        <code style={S.urlText}>{installUrl}</code>
                        <button onClick={() => { navigator.clipboard?.writeText(installUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={S.copyBtn}>
                            {copied ? '✅' : '복사'}
                        </button>
                    </div>
                </div>
            )}

            {/* ─── NORMAL BROWSER: DIRECT INSTALL ─── */}
            {!env.isInApp && (
                <>
                    {/* Android with Chrome install prompt available */}
                    {deferredPrompt && (
                        <div style={S.card}>
                            <button onClick={handleInstall} style={{ ...S.btnPrimary, fontSize: '1.1rem', padding: '16px' }}>
                                <Download size={22} /> 앱 설치하기
                            </button>
                            <p style={S.hint}>플레이 스토어 없이 바로 설치됩니다</p>
                        </div>
                    )}

                    {/* Android without prompt (Samsung, other browsers) */}
                    {env.isAndroid && !deferredPrompt && (
                        <div style={S.card}>
                            {env.isChrome ? (
                                <>
                                    <h2 style={S.stepTitle}>📱 Android 설치 방법</h2>
                                    <div style={S.steps}>
                                        <Step num={1} text="오른쪽 위 ⋮ 메뉴를 누릅니다" />
                                        <Step num={2} text={<><strong>"홈 화면에 추가"</strong> 또는 <strong>"앱 설치"</strong>를 선택합니다</>} />
                                        <Step num={3} text='"추가" 또는 "설치"를 눌러 완료합니다' />
                                    </div>
                                    <p style={S.hint}>💡 잠시 후 상단에 설치 배너가 나타날 수도 있습니다</p>
                                </>
                            ) : (
                                <>
                                    <p style={S.desc}>Chrome에서 열면 바로 설치할 수 있습니다.</p>
                                    <button onClick={openInChrome} style={{ ...S.btnPrimary, background: '#4285F4' }}>
                                        <Chrome size={20} /> Chrome에서 열기
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* iOS */}
                    {env.isIOS && (
                        <div style={S.card}>
                            {env.isSafari ? (
                                <>
                                    <h2 style={S.stepTitle}>📱 iPhone 설치 방법</h2>
                                    <div style={S.steps}>
                                        <Step num={1} text={<>하단의 <strong>공유 버튼</strong> <Share2 size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 을 누릅니다</>} />
                                        <Step num={2} text={<><strong>"홈 화면에 추가"</strong> <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 를 선택합니다</>} />
                                        <Step num={3} text='오른쪽 위 "추가"를 눌러 완료합니다' />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={S.warningBox}>
                                        <AlertTriangle size={18} color="#f59e0b" />
                                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>Safari에서 열어야 설치할 수 있습니다!</span>
                                    </div>
                                    <button onClick={openInSafari} style={{ ...S.btnPrimary, background: '#007AFF' }}>
                                        {copied ? '✅ 복사됨! Safari에 붙여넣기 하세요' : '📋 링크 복사 후 Safari에서 열기'}
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Desktop */}
                    {env.platform === 'desktop' && !deferredPrompt && (
                        <div style={S.card}>
                            <h2 style={S.stepTitle}>📱 휴대폰으로 설치하세요</h2>
                            <p style={S.desc}>아래 링크를 카카오톡이나 이메일로 직원에게 전송하세요.</p>
                            <div style={S.urlBox}>
                                <code style={S.urlText}>{installUrl}</code>
                                <button onClick={() => { navigator.clipboard?.writeText(installUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={S.copyBtn}>
                                    {copied ? '✅' : '복사'}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ─── SHARE SECTION ─── */}
            <div style={S.card}>
                <h2 style={S.stepTitle}>📨 직원에게 공유하기</h2>
                <div style={S.shareButtons}>
                    <button
                        onClick={shareInstallLink}
                        style={{ ...S.btnPrimary, background: '#FEE500', color: '#3C1E1E' }}
                    >
                        💬 카카오톡으로 공유
                    </button>
                    <button
                        onClick={() => {
                            const subject = '[소담김밥] 직원 앱 설치 안내';
                            const body = `안녕하세요,\n\n소담김밥 직원 앱을 아래 링크에서 설치해주세요:\n${installUrl}\n\n설치 방법:\n- iPhone: Safari에서 링크 열기 → 하단 공유 버튼 → "홈 화면에 추가"\n- Android: Chrome에서 링크 열기 → 상단 메뉴(⋮) → "앱 설치"\n\n감사합니다.`;
                            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                        }}
                        style={S.btnSecondary}
                    >
                        ✉️ 이메일로 공유
                    </button>
                </div>
            </div>

            <div style={S.footer}>
                <p>© 소담김밥 · 플레이 스토어/앱 스토어 없이 설치 가능</p>
            </div>
        </div>
    );
}

function Step({ num, text }) {
    return (
        <div style={S.step}>
            <div style={S.stepNum}>{num}</div>
            <p style={S.stepText}>{text}</p>
        </div>
    );
}

/* ─── Styles ─── */
const S = {
    page: { minHeight: '100dvh', background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 40%, #f1f5f9 40%)', padding: 0, fontFamily: "'Inter', -apple-system, sans-serif" },
    hero: { textAlign: 'center', padding: '48px 24px 40px', color: 'white' },
    appIcon: { width: '88px', height: '88px', borderRadius: '22px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', marginBottom: '16px', border: '3px solid rgba(255,255,255,0.15)' },
    heroTitle: { fontSize: '1.8rem', fontWeight: 900, margin: '0 0 4px' },
    heroSub: { fontSize: '0.95rem', opacity: 0.7, margin: 0 },
    badges: { display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' },
    badge: { padding: '6px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)' },
    card: { maxWidth: '460px', margin: '0 auto 16px', background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 20px rgba(0,0,0,0.06)' },
    stepTitle: { fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' },
    steps: { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' },
    step: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
    stepNum: { width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0 },
    stepText: { fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, margin: 0, paddingTop: '3px' },
    btnPrimary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,0.35)', textDecoration: 'none', marginBottom: '8px' },
    btnSecondary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px 24px', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'none' },
    hint: { textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px' },
    desc: { fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, margin: '0 0 12px' },
    warningBox: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: '#fef3c7', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '16px', border: '1px solid #fde68a' },
    urlBox: { display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', borderRadius: '12px', padding: '12px 16px', border: '1px solid #e2e8f0', marginTop: '12px' },
    urlText: { flex: 1, fontSize: '0.75rem', color: '#3b82f6', wordBreak: 'break-all', fontWeight: 600 },
    copyBtn: { padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0, minWidth: '52px' },
    shareButtons: { display: 'flex', flexDirection: 'column', gap: '8px' },
    footer: { textAlign: 'center', padding: '24px', fontSize: '0.7rem', color: '#94a3b8' },
    title: { fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: '16px 0 8px', textAlign: 'center' },
    iconCircle: { width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' },
};
