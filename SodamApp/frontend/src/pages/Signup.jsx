import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import './Login.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function SignupPage() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        real_name: "",
        password: "",
        confirmPassword: ""
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError("");

        if (formData.password !== formData.confirmPassword) {
            setError("비밀번호가 일치하지 않습니다.");
            return;
        }

        setLoading(true);
        try {
            // In a real app, this would be a signup endpoint
            // For now, we'll hit an endpoint if it exists or simulate
            await axios.post(`${API_URL}/api/auth/signup`, {
                username: formData.username,
                email: formData.email,
                real_name: formData.real_name,
                password: formData.password
            });

            alert("회원가입이 완료되었습니다. 로그인해 주세요.");
            navigate('/login');
        } catch (err) {
            console.error("Signup Error:", err);
            setError(err.response?.data?.detail || "회원가입에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card animate-fade-in shadow-2xl">
                <div className="login-header">
                    <div className="login-logo-wrapper">
                        <UserPlus className="text-white" size={36} />
                    </div>
                    <h1 className="login-title">SODAM FN</h1>
                    <p className="login-subtitle">새로운 계정을 생성하세요</p>
                </div>

                <form onSubmit={handleSignup} className="login-form space-y-4">
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
                                name="username"
                                type="text"
                                value={formData.username}
                                onChange={handleChange}
                                className="login-input"
                                placeholder="아이디를 입력하세요"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">이메일</label>
                        <div className="input-wrapper">
                            <Mail className="input-icon" size={18} />
                            <input
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="login-input"
                                placeholder="이메일을 입력하세요"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">이름 (실명)</label>
                        <div className="input-wrapper">
                            <User className="input-icon" size={18} />
                            <input
                                name="real_name"
                                type="text"
                                value={formData.real_name}
                                onChange={handleChange}
                                className="login-input"
                                placeholder="실명을 입력하세요"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                            <label className="form-label">비밀번호</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" size={18} />
                                <input
                                    name="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="login-input"
                                    placeholder="비밀번호"
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">확인</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" size={18} />
                                <input
                                    name="confirmPassword"
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="login-input"
                                    placeholder="비밀번호 확인"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="login-button mt-4"
                        style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : "가입하기"}
                    </button>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-slate-400">
                            이미 계정이 있으신가요? <Link to="/login" className="text-blue-400 hover:text-blue-300 font-bold underline underline-offset-4">로그인</Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
