import { useState, useEffect } from 'react';
import { MapPin, X, AlertTriangle, CheckCircle2, Settings } from 'lucide-react';

/**
 * LocationPermission — Shows a modal on first login to request location permission.
 * Required for attendance (출퇴근) tracking.
 * Stores grant status in localStorage so it only shows once.
 */
export default function LocationPermission() {
    const [show, setShow] = useState(false);
    const [status, setStatus] = useState('prompt'); // prompt | requesting | granted | denied

    useEffect(() => {
        const alreadyHandled = localStorage.getItem('location_permission_handled');
        if (alreadyHandled) return;

        // Check current permission state
        if ('permissions' in navigator) {
            navigator.permissions.query({ name: 'geolocation' }).then(result => {
                if (result.state === 'granted') {
                    localStorage.setItem('location_permission_handled', 'true');
                } else if (result.state === 'denied') {
                    setStatus('denied');
                    setShow(true);
                } else {
                    // 'prompt' — show our modal
                    setShow(true);
                }
            }).catch(() => {
                setShow(true);
            });
        } else {
            setShow(true);
        }
    }, []);

    const requestPermission = () => {
        setStatus('requesting');
        navigator.geolocation.getCurrentPosition(
            () => {
                setStatus('granted');
                localStorage.setItem('location_permission_handled', 'true');
                setTimeout(() => setShow(false), 1500);
            },
            (err) => {
                if (err.code === 1) {
                    setStatus('denied');
                } else {
                    // Timeout or unavailable, but permission might have been granted
                    setStatus('denied');
                }
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSkip = () => {
        localStorage.setItem('location_permission_handled', 'true');
        setShow(false);
    };

    if (!show) return null;

    return (
        <div style={overlay}>
            <div style={modal}>
                {status === 'granted' ? (
                    <>
                        <div style={{ ...iconCircle, background: '#059669' }}>
                            <CheckCircle2 size={36} color="white" />
                        </div>
                        <h2 style={title}>위치 권한 허용 완료! ✅</h2>
                        <p style={desc}>출퇴근 기능을 사용할 수 있습니다.</p>
                    </>
                ) : status === 'denied' ? (
                    <>
                        <div style={{ ...iconCircle, background: '#dc2626' }}>
                            <AlertTriangle size={36} color="white" />
                        </div>
                        <h2 style={title}>위치 권한이 거부되었습니다</h2>
                        <p style={desc}>
                            출퇴근 기록을 위해 위치 권한이 필요합니다.<br />
                            설정에서 위치 권한을 직접 허용해주세요.
                        </p>
                        <div style={stepsBox}>
                            <p style={stepText}><Settings size={14} style={{ verticalAlign: 'middle' }} /> <strong>설정 → 앱 → Chrome → 권한 → 위치</strong></p>
                            <p style={stepText}>또는 주소창 왼쪽 🔒 아이콘 클릭 → 위치 허용</p>
                        </div>
                        <button onClick={handleSkip} style={btnSecondary}>닫기</button>
                    </>
                ) : (
                    <>
                        <div style={{ ...iconCircle, background: '#3b82f6' }}>
                            <MapPin size={36} color="white" />
                        </div>
                        <h2 style={title}>위치 권한 요청</h2>
                        <p style={desc}>
                            출퇴근 기록을 위해 현재 위치 정보가 필요합니다.<br />
                            <strong>위치 권한을 허용</strong>해주세요.
                        </p>
                        <div style={featureList}>
                            <div style={featureItem}>📍 출퇴근 위치 기록</div>
                            <div style={featureItem}>🏪 매장 위치 확인</div>
                            <div style={featureItem}>🔒 개인정보 보호 (근무시간만 사용)</div>
                        </div>
                        <button
                            onClick={requestPermission}
                            style={btnPrimary}
                            disabled={status === 'requesting'}
                        >
                            {status === 'requesting' ? '권한 확인 중...' : '📍 위치 권한 허용하기'}
                        </button>
                        <button onClick={handleSkip} style={btnSkip}>나중에</button>
                    </>
                )}
                {status !== 'granted' && (
                    <button onClick={handleSkip} style={closeBtn}><X size={18} /></button>
                )}
            </div>
        </div>
    );
}

/* ─── Styles ─── */
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' };
const modal = { position: 'relative', background: 'white', borderRadius: '24px', padding: '32px 24px', maxWidth: '380px', width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', animation: 'slideUp 0.3s ease' };
const iconCircle = { width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(59,130,246,0.3)' };
const title = { fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' };
const desc = { fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, margin: '0 0 16px' };
const featureList = { display: 'flex', flexDirection: 'column', gap: '8px', margin: '0 0 20px', textAlign: 'left' };
const featureItem = { padding: '10px 16px', background: '#f1f5f9', borderRadius: '12px', fontSize: '0.85rem', color: '#334155', fontWeight: 600 };
const btnPrimary = { width: '100%', padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,0.35)', marginBottom: '8px' };
const btnSecondary = { width: '100%', padding: '12px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' };
const btnSkip = { background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer', padding: '8px', marginTop: '4px' };
const closeBtn = { position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' };
const stepsBox = { background: '#fef3c7', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', textAlign: 'left', border: '1px solid #fde68a' };
const stepText = { fontSize: '0.8rem', color: '#92400e', margin: '4px 0', lineHeight: 1.5 };
