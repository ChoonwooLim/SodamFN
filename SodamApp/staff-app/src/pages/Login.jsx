import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Store, Eye, EyeOff } from 'lucide-react';
import { API_BASE } from '../api';

export default function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            setError('아이디와 비밀번호를 입력해주세요.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await axios.post(`${API_BASE}/api/auth/login`, formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            const { access_token } = response.data;
            localStorage.setItem('token', access_token);

            // Decode JWT payload
            const payload = JSON.parse(atob(access_token.split('.')[1]));
            localStorage.setItem('user_role', payload.role);
            localStorage.setItem('user_name', payload.real_name || payload.sub);
            localStorage.setItem('staff_id', payload.staff_id || '');

            navigate('/');
        } catch (err) {
            if (err.response?.status === 401) {
                setError('아이디 또는 비밀번호가 올바르지 않습니다.');
            } else if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
                setError(typeof detail === 'string' ? detail : '로그인에 실패했습니다.');
            } else {
                setError('서버와 연결할 수 없습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card animate-scale">
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <Store size={36} color="white" />
                    </div>
                    <h1>소담 Staff</h1>
                    <p>직원 전용 모바일 앱</p>
                </div>

                <form className="login-form" onSubmit={handleLogin}>
                    {error && <div className="login-error">{error}</div>}

                    <div className="input-group">
                        <label className="input-label">아이디</label>
                        <input
                            className="input"
                            type="text"
                            placeholder="아이디를 입력하세요"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            autoCapitalize="off"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">비밀번호</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="input"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="비밀번호를 입력하세요"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                style={{ paddingRight: '48px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.4)',
                                    padding: '4px',
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-block btn-lg"
                        disabled={loading}
                        style={{ marginTop: '8px' }}
                    >
                        {loading ? (
                            <div className="spinner" style={{ width: '22px', height: '22px', borderWidth: '2px' }} />
                        ) : (
                            '로그인'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
