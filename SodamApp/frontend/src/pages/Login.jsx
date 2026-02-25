import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, User, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import './Login.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Handle social login callback token
        const token = searchParams.get('token');
        if (token) {
            handleLoginSuccess(token);
        }

        // Listen for messages from social login popup
        const handleMessage = (event) => {
            if (event.origin !== window.location.origin) return;
            if (event.data.type === 'socialLoginSuccess') {
                handleLoginSuccess(event.data.token);
            }
        };
        window.addEventListener('message', handleMessage);

        // Check for remembered username
        const savedUsername = localStorage.getItem('sodam_remembered_user');
        if (savedUsername) {
            setUsername(savedUsername);
            setRememberMe(true);
        }

        return () => window.removeEventListener('message', handleMessage);
    }, [searchParams]);

    const handleLoginSuccess = (token) => {
        try {
            // If this is the social login popup, notify parent and close
            if (window.opener && window.opener !== window) {
                window.opener.postMessage({ type: 'socialLoginSuccess', token }, window.location.origin);
                window.close();
                return;
            }

            localStorage.setItem('token', token);
            // ... (rest of logic)

            // Decode token
            const payload = JSON.parse(atob(token.split('.')[1]));
            localStorage.setItem('user_role', payload.role);
            localStorage.setItem('staff_id', payload.staff_id || "");
            localStorage.setItem('user_id', payload.user_id || "");

            if (rememberMe) {
                localStorage.setItem('sodam_remembered_user', payload.sub);
            } else {
                localStorage.removeItem('sodam_remembered_user');
            }

            setLoading(false); // Reset loading BEFORE navigate

            if (payload.role === 'admin') {
                navigate('/dashboard');
            } else {
                navigate('/contracts/my');
            }
        } catch (e) {
            console.error("Failed to process token", e);
            setError("로그인 처리 중 오류가 발생했습니다.");
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        try {
            const response = await axios.post(`${API_URL}/api/auth/login`, formData, { timeout: 10000 });
            handleLoginSuccess(response.data.access_token);
        } catch (err) {
            console.error("Login Error:", err);
            if (err.code === 'ECONNABORTED') {
                setError("서버 응답 시간이 초과되었습니다. 서버 상태를 확인해 주세요.");
            } else {
                setError(err.response?.data?.detail || "아이디 또는 비밀번호가 올바르지 않습니다.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = (provider) => {
        setError("");
        // Standard social login often uses popups for a "modal" feel
        const width = 500;
        const height = 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        window.open(
            `${API_URL}/api/auth/${provider}`,
            'socialLogin',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );

        // Since it's a popup, we don't necessarily want to block the main UI with a spinner
        // but we can show a small message
        setError("소셜 로그인 창이 열렸습니다. 인증을 완료해 주세요.");
    };

    return (
        <div className="login-container">
            <div className="login-card animate-fade-in">
                <div className="login-header">
                    <div className="login-logo-wrapper">
                        <Lock className="text-white" size={36} />
                    </div>
                    <h1 className="login-title">SODAM FN</h1>
                    <p className="login-subtitle">소담 관리 시스템에 오신 것을 환영합니다</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {error && (
                        <div className="error-message animate-fade-in">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">아이디</label>
                        <div className="input-wrapper">
                            <User className="input-icon" size={18} />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="login-input"
                                placeholder="아이디를 입력하세요"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">비밀번호</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="login-input"
                                placeholder="비밀번호를 입력하세요"
                                required
                            />
                        </div>
                    </div>

                    <div className="login-options">
                        <label className="remember-me">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            아이디 저장
                        </label>
                        <a href="#" className="forgot-password text-xs text-blue-400 hover:text-blue-300 transition-colors">비밀번호 찾기</a>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="login-button"
                        style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <><LogIn size={20} /> 로그인</>}
                    </button>

                    <div className="social-divider">
                        <span className="divider-text">또는 소셜 로그인</span>
                    </div>

                    <div className="social-login-grid">
                        <button type="button" onClick={() => handleSocialLogin('google')} className="social-btn">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                <span className="text-blue-600 font-bold text-sm">G</span>
                            </div>
                            <span>Google</span>
                        </button>
                        <button type="button" onClick={() => handleSocialLogin('naver')} className="social-btn">
                            <div className="w-8 h-8 rounded-full bg-[#03C75A] flex items-center justify-center">
                                <span className="text-white font-black text-sm">N</span>
                            </div>
                            <span>Naver</span>
                        </button>
                        <button type="button" onClick={() => handleSocialLogin('kakao')} className="social-btn">
                            <div className="w-8 h-8 rounded-full bg-[#FEE500] flex items-center justify-center">
                                <span className="text-black font-black text-sm">K</span>
                            </div>
                            <span>Kakao</span>
                        </button>
                    </div>

                    <div className="mt-8 text-center space-y-2">
                        <p className="text-sm text-slate-400">
                            계정이 없으신가요? <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-bold decoration-2 underline-offset-4 hover:underline transition-all">회원가입</Link>
                        </p>
                        <p className="text-xs text-slate-500">
                            또는 관리자에게 문의하세요.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
