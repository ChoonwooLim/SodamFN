import { useState, useEffect } from 'react';
import { Smartphone, Download, Share2, Plus, ArrowDown, CheckCircle2, ExternalLink } from 'lucide-react';

export default function InstallGuide() {
    const [platform, setPlatform] = useState('unknown');
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent;
        if (/iPad|iPhone|iPod/.test(ua)) setPlatform('ios');
        else if (/Android/.test(ua)) setPlatform('android');
        else setPlatform('desktop');

        // Listen for the beforeinstallprompt (Android/Chrome)
        const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
        window.addEventListener('beforeinstallprompt', handler);

        // Detect if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setInstalled(true);
        setDeferredPrompt(null);
    };

    if (installed) {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <div style={{ ...styles.iconWrap, background: '#059669' }}>
                        <CheckCircle2 size={40} color="white" />
                    </div>
                    <h1 style={styles.title}>설치 완료! 🎉</h1>
                    <p style={styles.desc}>소담 Staff 앱이 설치되었습니다.<br />홈 화면에서 앱을 실행하세요.</p>
                    <a href="/" style={styles.primaryBtn}>앱 열기</a>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            {/* Hero */}
            <div style={styles.hero}>
                <img src="/icons/icon-192.png" alt="소담 Staff" style={styles.appIcon} />
                <h1 style={styles.heroTitle}>소담 Staff</h1>
                <p style={styles.heroSub}>직원 전용 모바일 앱</p>
                <div style={styles.badges}>
                    <span style={styles.badge}>📱 출퇴근 관리</span>
                    <span style={styles.badge}>📋 전자계약</span>
                    <span style={styles.badge}>💬 소통방</span>
                </div>
            </div>

            {/* Install Card */}
            <div style={styles.card}>
                {/* Android - Direct Install Button */}
                {(platform === 'android' || platform === 'desktop') && deferredPrompt && (
                    <div style={styles.section}>
                        <button onClick={handleInstall} style={styles.primaryBtn}>
                            <Download size={20} /> 앱 설치하기
                        </button>
                        <p style={styles.hint}>플레이 스토어 없이 바로 설치됩니다</p>
                    </div>
                )}

                {/* Android Manual */}
                {platform === 'android' && !deferredPrompt && (
                    <div style={styles.section}>
                        <h2 style={styles.stepTitle}>
                            <Smartphone size={20} color="#3b82f6" /> Android 설치 방법
                        </h2>
                        <div style={styles.steps}>
                            <Step num={1} text="Chrome 브라우저에서 이 페이지를 엽니다" />
                            <Step num={2} text='오른쪽 위 ⋮ 메뉴를 누릅니다' />
                            <Step num={3} text={<><strong>"홈 화면에 추가"</strong> 또는 <strong>"앱 설치"</strong>를 선택합니다</>} />
                            <Step num={4} text='"추가" 또는 "설치"를 눌러 완료합니다' />
                        </div>
                        <div style={styles.imageGuide}>
                            <div style={styles.mockStep}>
                                <span style={styles.mockIcon}>⋮</span>
                                <ArrowDown size={16} color="#94a3b8" />
                                <span style={styles.mockLabel}>홈 화면에 추가</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* iOS */}
                {platform === 'ios' && (
                    <div style={styles.section}>
                        <h2 style={styles.stepTitle}>
                            <Smartphone size={20} color="#3b82f6" /> iPhone 설치 방법
                        </h2>
                        <div style={styles.steps}>
                            <Step num={1} text={<><strong>Safari</strong> 브라우저에서 이 페이지를 엽니다</>} />
                            <Step num={2} text={<>하단의 <strong>공유 버튼</strong> <Share2 size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 을 누릅니다</>} />
                            <Step num={3} text={<><strong>"홈 화면에 추가"</strong> <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 를 선택합니다</>} />
                            <Step num={4} text='오른쪽 위 "추가"를 눌러 완료합니다' />
                        </div>
                        <div style={styles.important}>
                            ⚠️ <strong>반드시 Safari</strong>에서 열어야 합니다!<br />
                            카카오톡 내 브라우저에서는 설치가 안 됩니다.
                        </div>
                        <button
                            onClick={() => { navigator.clipboard?.writeText(window.location.origin); alert('링크가 복사되었습니다! Safari에 붙여넣기 하세요.'); }}
                            style={styles.secondaryBtn}
                        >
                            <ExternalLink size={16} /> Safari에서 열기 위해 링크 복사
                        </button>
                    </div>
                )}

                {/* Desktop */}
                {platform === 'desktop' && !deferredPrompt && (
                    <div style={styles.section}>
                        <h2 style={styles.stepTitle}>
                            <Smartphone size={20} color="#3b82f6" /> 📱 휴대폰으로 설치하세요
                        </h2>
                        <p style={styles.desc}>아래 링크를 카카오톡이나 이메일로 직원에게 전송하세요.</p>
                        <div style={styles.urlBox}>
                            <code style={styles.urlText}>{window.location.origin}/install</code>
                            <button
                                onClick={() => { navigator.clipboard?.writeText(window.location.origin + '/install'); alert('링크가 복사되었습니다!'); }}
                                style={styles.copyBtn}
                            >복사</button>
                        </div>
                        <p style={styles.hint}>직원들이 이 링크를 휴대폰에서 열면 앱을 설치할 수 있습니다.</p>
                    </div>
                )}
            </div>

            {/* Share Section */}
            <div style={styles.card}>
                <h2 style={styles.stepTitle}>📨 직원에게 공유하기</h2>
                <p style={styles.desc}>아래 버튼으로 설치 링크를 공유하세요</p>
                <div style={styles.shareButtons}>
                    <button
                        onClick={() => {
                            const url = window.location.origin + '/install';
                            const text = `[소담김밥] 직원 앱을 설치해주세요!\n\n아래 링크를 눌러서 앱을 설치할 수 있습니다:\n${url}\n\n📌 iPhone: Safari에서 열기 → 공유 → 홈 화면에 추가\n📌 Android: Chrome에서 열기 → 메뉴 → 앱 설치`;
                            if (navigator.share) {
                                navigator.share({ title: '소담 Staff 앱 설치', text, url });
                            } else {
                                navigator.clipboard?.writeText(text);
                                alert('메시지가 복사되었습니다!\n카카오톡이나 이메일에 붙여넣기 하세요.');
                            }
                        }}
                        style={{ ...styles.primaryBtn, background: '#FEE500', color: '#3C1E1E' }}
                    >
                        💬 카카오톡으로 공유
                    </button>
                    <button
                        onClick={() => {
                            const url = window.location.origin + '/install';
                            const subject = '[소담김밥] 직원 앱 설치 안내';
                            const body = `안녕하세요,\n\n소담김밥 직원 앱을 아래 링크에서 설치해주세요:\n${url}\n\n설치 방법:\n- iPhone: Safari에서 링크 열기 → 하단 공유 버튼 → "홈 화면에 추가"\n- Android: Chrome에서 링크 열기 → 상단 메뉴(⋮) → "앱 설치"\n\n감사합니다.`;
                            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                        }}
                        style={styles.secondaryBtn}
                    >
                        ✉️ 이메일로 공유
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <p>© 소담김밥 · 플레이 스토어/앱 스토어 없이 설치 가능</p>
            </div>
        </div>
    );
}

function Step({ num, text }) {
    return (
        <div style={styles.step}>
            <div style={styles.stepNum}>{num}</div>
            <p style={styles.stepText}>{text}</p>
        </div>
    );
}

const styles = {
    page: {
        minHeight: '100dvh', background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 40%, #f8fafc 40%)',
        padding: '0', fontFamily: "'Inter', -apple-system, sans-serif"
    },
    hero: {
        textAlign: 'center', padding: '48px 24px 40px', color: 'white'
    },
    appIcon: {
        width: '88px', height: '88px', borderRadius: '22px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        marginBottom: '16px', border: '3px solid rgba(255,255,255,0.15)'
    },
    heroTitle: { fontSize: '1.8rem', fontWeight: 900, margin: '0 0 4px' },
    heroSub: { fontSize: '0.95rem', opacity: 0.7, margin: 0 },
    badges: { display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' },
    badge: {
        padding: '6px 14px', background: 'rgba(255,255,255,0.1)', borderRadius: '20px',
        fontSize: '0.75rem', fontWeight: 600, backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255,255,255,0.1)'
    },
    card: {
        maxWidth: '460px', margin: '0 auto 16px', background: 'white',
        borderRadius: '20px', padding: '24px', boxShadow: '0 2px 20px rgba(0,0,0,0.06)'
    },
    section: { marginBottom: '8px' },
    stepTitle: {
        fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 16px',
        display: 'flex', alignItems: 'center', gap: '8px'
    },
    steps: { display: 'flex', flexDirection: 'column', gap: '12px' },
    step: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
    stepNum: {
        width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f6', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.8rem', fontWeight: 800, flexShrink: 0
    },
    stepText: { fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, margin: 0, paddingTop: '3px' },
    primaryBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        width: '100%', padding: '14px 24px', background: '#3b82f6', color: 'white',
        border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 800,
        cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
        textDecoration: 'none', marginTop: '8px'
    },
    secondaryBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        width: '100%', padding: '12px 24px', background: '#f1f5f9', color: '#334155',
        border: '1px solid #e2e8f0', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 700,
        cursor: 'pointer', marginTop: '10px', textDecoration: 'none'
    },
    hint: { textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginTop: '10px' },
    desc: { fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, margin: '0 0 16px' },
    important: {
        margin: '16px 0', padding: '12px 16px', background: '#fef3c7', borderRadius: '12px',
        fontSize: '0.8rem', color: '#92400e', lineHeight: 1.6, border: '1px solid #fde68a'
    },
    urlBox: {
        display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9',
        borderRadius: '12px', padding: '12px 16px', border: '1px solid #e2e8f0'
    },
    urlText: { flex: 1, fontSize: '0.8rem', color: '#3b82f6', wordBreak: 'break-all', fontWeight: 600 },
    copyBtn: {
        padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none',
        borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0
    },
    shareButtons: { display: 'flex', flexDirection: 'column', gap: '8px' },
    imageGuide: { marginTop: '16px', textAlign: 'center' },
    mockStep: {
        display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
        background: '#f1f5f9', borderRadius: '12px', fontSize: '0.9rem', color: '#475569', fontWeight: 600
    },
    mockIcon: { fontSize: '1.2rem', fontWeight: 800 },
    mockLabel: { fontWeight: 700, color: '#3b82f6' },
    footer: {
        textAlign: 'center', padding: '24px', fontSize: '0.7rem', color: '#94a3b8'
    },
    title: { fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: '16px 0 8px', textAlign: 'center' },
};
