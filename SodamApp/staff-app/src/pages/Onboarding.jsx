import { useState } from 'react';
import { MapPin, Shield, Bell, ChevronRight, Check, Smartphone, FileText, Eye } from 'lucide-react';

const STEPS = ['welcome', 'terms', 'permissions', 'ready'];

export default function Onboarding({ onComplete }) {
    const [step, setStep] = useState(0);
    const [termsAgreed, setTermsAgreed] = useState(false);
    const [privacyAgreed, setPrivacyAgreed] = useState(false);
    const [locationGranted, setLocationGranted] = useState(null); // null | true | false
    const [notificationGranted, setNotificationGranted] = useState(null);
    const [locationRequesting, setLocationRequesting] = useState(false);

    const currentStep = STEPS[step];
    const canProceedTerms = termsAgreed && privacyAgreed;

    const requestLocation = () => {
        setLocationRequesting(true);
        navigator.geolocation.getCurrentPosition(
            () => { setLocationGranted(true); setLocationRequesting(false); },
            () => { setLocationGranted(false); setLocationRequesting(false); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const requestNotification = async () => {
        if ('Notification' in window) {
            const perm = await Notification.requestPermission();
            setNotificationGranted(perm === 'granted');
        } else {
            setNotificationGranted(false);
        }
    };

    const handleComplete = () => {
        // Clear any stale auth tokens so user always sees login screen
        localStorage.removeItem('token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_name');
        localStorage.removeItem('staff_id');

        localStorage.setItem('onboarding_completed', 'true');
        localStorage.setItem('location_permission_handled', 'true');
        localStorage.setItem('terms_agreed', new Date().toISOString());
        onComplete();
    };

    const nextStep = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
    const progress = ((step + 1) / STEPS.length) * 100;

    return (
        <div style={styles.container}>
            {/* Progress Bar */}
            <div style={styles.progressTrack}>
                <div style={{ ...styles.progressBar, width: `${progress}%` }} />
            </div>

            {/* Step Indicators */}
            <div style={styles.stepIndicators}>
                {STEPS.map((s, i) => (
                    <div key={s} style={{
                        ...styles.stepDot,
                        background: i <= step ? '#3b82f6' : '#334155',
                        width: i === step ? '24px' : '8px',
                        borderRadius: i === step ? '4px' : '50%',
                    }} />
                ))}
            </div>

            {/* ── Step: Welcome ── */}
            {currentStep === 'welcome' && (
                <div style={styles.stepContent}>
                    <div style={styles.logoCircle}>
                        <img src="/sodam-logo-white.png" alt="소담" style={{ width: 56, height: 56, objectFit: 'contain' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    </div>
                    <h1 style={styles.title}>소담 Staff</h1>
                    <p style={styles.subtitle}>소담김밥 직원 전용 앱</p>
                    <div style={styles.featureGrid}>
                        {[
                            { icon: '⏰', label: '출퇴근 관리', desc: '위치 기반 출퇴근 기록' },
                            { icon: '📄', label: '전자계약', desc: '근로계약 전자서명' },
                            { icon: '💰', label: '급여명세서', desc: '급여 내역 확인' },
                            { icon: '📋', label: '서류관리', desc: '필요 서류 제출' },
                        ].map(f => (
                            <div key={f.label} style={styles.featureCard}>
                                <span style={{ fontSize: '1.5rem' }}>{f.icon}</span>
                                <strong style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>{f.label}</strong>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{f.desc}</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={nextStep} style={styles.btnPrimary}>
                        시작하기 <ChevronRight size={18} style={{ verticalAlign: 'middle' }} />
                    </button>
                </div>
            )}

            {/* ── Step: Terms & Privacy ── */}
            {currentStep === 'terms' && (
                <div style={styles.stepContent}>
                    <div style={{ ...styles.iconBubble, background: '#1e3a5f' }}>
                        <Shield size={32} color="#60a5fa" />
                    </div>
                    <h2 style={styles.title2}>이용약관 및 개인정보 동의</h2>
                    <p style={styles.desc}>서비스 이용을 위해 아래 항목에 동의해주세요.</p>

                    {/* Terms of Service */}
                    <div style={styles.agreementBox}>
                        <div style={styles.agreementHeader} onClick={() => {/* could expand */ }}>
                            <FileText size={16} color="#60a5fa" />
                            <span style={styles.agreementTitle}>서비스 이용약관</span>
                            <span style={styles.required}>[필수]</span>
                        </div>
                        <div style={styles.agreementPreview}>
                            <p>제1조 (목적) 이 약관은 소담김밥 직원용 모바일 앱 서비스의 이용에 관한 사항을 규정합니다.</p>
                            <p>제2조 (정의) "서비스"란 출퇴근 관리, 전자계약, 급여명세서, 서류관리 등 직원 업무 지원 기능을 말합니다.</p>
                            <p>제3조 (이용) 서비스는 소담김밥 소속 직원에게만 제공됩니다.</p>
                        </div>
                        <label style={styles.checkLabel}>
                            <div style={{ ...styles.checkbox, ...(termsAgreed ? styles.checkboxOn : {}) }}
                                onClick={() => setTermsAgreed(!termsAgreed)}>
                                {termsAgreed && <Check size={14} color="white" />}
                            </div>
                            <span onClick={() => setTermsAgreed(!termsAgreed)}>이용약관에 동의합니다</span>
                        </label>
                    </div>

                    {/* Privacy Policy */}
                    <div style={styles.agreementBox}>
                        <div style={styles.agreementHeader}>
                            <Eye size={16} color="#60a5fa" />
                            <span style={styles.agreementTitle}>개인정보 처리방침</span>
                            <span style={styles.required}>[필수]</span>
                        </div>
                        <div style={styles.agreementPreview}>
                            <p><strong>수집 항목:</strong> 이름, 연락처, 위치정보(출퇴근 시), 서명 데이터</p>
                            <p><strong>이용 목적:</strong> 출퇴근 기록, 근로계약 체결, 급여 관리</p>
                            <p><strong>보관 기간:</strong> 근로관계 종료 후 3년 (근로기준법)</p>
                            <p><strong>위치정보:</strong> 출퇴근 기록 시에만 수집되며, 실시간 추적하지 않습니다.</p>
                        </div>
                        <label style={styles.checkLabel}>
                            <div style={{ ...styles.checkbox, ...(privacyAgreed ? styles.checkboxOn : {}) }}
                                onClick={() => setPrivacyAgreed(!privacyAgreed)}>
                                {privacyAgreed && <Check size={14} color="white" />}
                            </div>
                            <span onClick={() => setPrivacyAgreed(!privacyAgreed)}>개인정보 처리방침에 동의합니다</span>
                        </label>
                    </div>

                    <button
                        onClick={nextStep}
                        style={{ ...styles.btnPrimary, opacity: canProceedTerms ? 1 : 0.4 }}
                        disabled={!canProceedTerms}
                    >
                        동의하고 계속 <ChevronRight size={18} style={{ verticalAlign: 'middle' }} />
                    </button>
                </div>
            )}

            {/* ── Step: Permissions ── */}
            {currentStep === 'permissions' && (
                <div style={styles.stepContent}>
                    <div style={{ ...styles.iconBubble, background: '#1e3a5f' }}>
                        <Smartphone size={32} color="#60a5fa" />
                    </div>
                    <h2 style={styles.title2}>앱 권한 설정</h2>
                    <p style={styles.desc}>원활한 서비스를 위해 다음 권한을 허용해주세요.</p>

                    {/* Location Permission */}
                    <div style={styles.permCard}>
                        <div style={styles.permHeader}>
                            <div style={{ ...styles.permIcon, background: locationGranted ? '#059669' : '#3b82f6' }}>
                                <MapPin size={20} color="white" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <strong style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>📍 위치 정보</strong>
                                <span style={styles.permRequired}>[필수]</span>
                                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '2px 0 0' }}>출퇴근 기록에 사용됩니다</p>
                            </div>
                            {locationGranted === true ? (
                                <span style={styles.permBadge}>✅ 허용됨</span>
                            ) : locationGranted === false ? (
                                <button onClick={requestLocation} style={styles.permBtn}>재시도</button>
                            ) : (
                                <button onClick={requestLocation} style={styles.permBtn} disabled={locationRequesting}>
                                    {locationRequesting ? '확인중...' : '허용'}
                                </button>
                            )}
                        </div>
                        {locationGranted === false && (
                            <p style={styles.permWarning}>⚠️ 위치 권한이 거부되었습니다. 출퇴근 기능 사용 시 다시 요청됩니다.</p>
                        )}
                    </div>

                    {/* Notification Permission */}
                    <div style={styles.permCard}>
                        <div style={styles.permHeader}>
                            <div style={{ ...styles.permIcon, background: notificationGranted ? '#059669' : '#8b5cf6' }}>
                                <Bell size={20} color="white" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <strong style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>🔔 알림</strong>
                                <span style={styles.permOptional}>[선택]</span>
                                <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '2px 0 0' }}>공지사항, 일정 알림</p>
                            </div>
                            {notificationGranted === true ? (
                                <span style={styles.permBadge}>✅ 허용됨</span>
                            ) : notificationGranted === false ? (
                                <span style={{ ...styles.permBadge, color: '#94a3b8' }}>건너뜀</span>
                            ) : (
                                <button onClick={requestNotification} style={{ ...styles.permBtn, background: '#8b5cf6' }}>허용</button>
                            )}
                        </div>
                    </div>

                    <button onClick={nextStep} style={styles.btnPrimary}>
                        {locationGranted ? '완료' : '다음'} <ChevronRight size={18} style={{ verticalAlign: 'middle' }} />
                    </button>
                    {!locationGranted && locationGranted !== false && (
                        <button onClick={nextStep} style={styles.btnSkip}>나중에 설정하기</button>
                    )}
                </div>
            )}

            {/* ── Step: Ready ── */}
            {currentStep === 'ready' && (
                <div style={styles.stepContent}>
                    <div style={styles.readyEmoji}>🎉</div>
                    <h2 style={styles.title2}>설정 완료!</h2>
                    <p style={styles.desc}>소담 Staff 앱을 사용할 준비가 되었습니다.</p>

                    <div style={styles.summaryBox}>
                        <div style={styles.summaryRow}>
                            <span>이용약관</span>
                            <span style={{ color: '#34d399' }}>✅ 동의</span>
                        </div>
                        <div style={styles.summaryRow}>
                            <span>개인정보 처리방침</span>
                            <span style={{ color: '#34d399' }}>✅ 동의</span>
                        </div>
                        <div style={styles.summaryRow}>
                            <span>위치 권한</span>
                            <span style={{ color: locationGranted ? '#34d399' : '#f59e0b' }}>
                                {locationGranted ? '✅ 허용' : '⏭️ 나중에'}
                            </span>
                        </div>
                        <div style={styles.summaryRow}>
                            <span>알림 권한</span>
                            <span style={{ color: notificationGranted ? '#34d399' : '#94a3b8' }}>
                                {notificationGranted ? '✅ 허용' : '⏭️ 건너뜀'}
                            </span>
                        </div>
                    </div>

                    <button onClick={handleComplete} style={{ ...styles.btnPrimary, background: '#059669' }}>
                        로그인하러 가기 <ChevronRight size={18} style={{ verticalAlign: 'middle' }} />
                    </button>
                </div>
            )}
        </div>
    );
}

/* ─── Styles ─── */
const styles = {
    container: { minHeight: '100vh', background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', fontFamily: "'Inter', sans-serif", overflow: 'auto' },
    progressTrack: { width: '100%', maxWidth: '380px', height: '3px', background: '#1e293b', borderRadius: '2px', marginBottom: '16px' },
    progressBar: { height: '100%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '2px', transition: 'width 0.5s ease' },
    stepIndicators: { display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '24px' },
    stepDot: { height: '8px', transition: 'all 0.3s ease' },
    stepContent: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '380px', animation: 'fadeIn 0.4s ease' },
    logoCircle: { width: '88px', height: '88px', borderRadius: '24px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 8px 32px rgba(59,130,246,0.4)' },
    title: { fontSize: '1.8rem', fontWeight: 900, color: 'white', margin: '0 0 4px', letterSpacing: '-0.5px' },
    title2: { fontSize: '1.3rem', fontWeight: 800, color: 'white', margin: '0 0 6px' },
    subtitle: { fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 24px' },
    desc: { fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.6 },
    featureGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', marginBottom: '24px' },
    featureCard: { background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', border: '1px solid rgba(255,255,255,0.08)' },
    iconBubble: { width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' },
    agreementBox: { width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '14px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.08)' },
    agreementHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
    agreementTitle: { color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 700, flex: 1 },
    agreementPreview: { background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '10px 12px', maxHeight: '80px', overflow: 'auto', marginBottom: '10px', fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.5 },
    required: { color: '#f87171', fontSize: '0.7rem', fontWeight: 700 },
    checkLabel: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' },
    checkbox: { width: '22px', height: '22px', borderRadius: '6px', border: '2px solid #475569', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.2s' },
    checkboxOn: { background: '#3b82f6', borderColor: '#3b82f6' },
    permCard: { width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '14px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.08)' },
    permHeader: { display: 'flex', alignItems: 'center', gap: '10px' },
    permIcon: { width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    permRequired: { color: '#f87171', fontSize: '0.65rem', fontWeight: 700, marginLeft: '4px' },
    permOptional: { color: '#94a3b8', fontSize: '0.65rem', fontWeight: 600, marginLeft: '4px' },
    permBtn: { padding: '6px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 },
    permBadge: { fontSize: '0.8rem', color: '#34d399', fontWeight: 600, flexShrink: 0 },
    permWarning: { fontSize: '0.7rem', color: '#fbbf24', marginTop: '8px', lineHeight: 1.4 },
    readyEmoji: { fontSize: '3rem', marginBottom: '12px' },
    summaryBox: { width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.08)' },
    summaryRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#cbd5e1', fontSize: '0.85rem' },
    btnPrimary: { width: '100%', padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,0.35)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
    btnSkip: { background: 'none', border: 'none', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer', padding: '8px' },
};
