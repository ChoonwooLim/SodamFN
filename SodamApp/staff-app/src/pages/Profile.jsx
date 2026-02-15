import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, LogOut, FileText, Wallet, Clock, ChevronRight, Shield, Lock
} from 'lucide-react';

export default function Profile() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
    }, [navigate]);

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/login';
    };

    if (!user) return null;

    const initial = (user.real_name || user.sub || '?')[0];

    const menuItems = [
        { icon: Clock, label: '근무 기록', color: '#3b82f6', bg: '#dbeafe', path: '/attendance' },
        { icon: FileText, label: '전자계약', color: '#6366f1', bg: '#eef2ff', path: '/contracts' },
        { icon: Wallet, label: '급여명세서', color: '#059669', bg: '#d1fae5', path: '/payslip' },
        { icon: FileText, label: '서류 제출', color: '#d97706', bg: '#fef3c7', path: '/documents' },
    ];

    return (
        <div className="page animate-fade">
            <div className="page-header">
                <h1 className="page-title">내 정보</h1>
            </div>

            {/* Profile Card */}
            <div className="card mb-4" style={{ paddingTop: '32px', paddingBottom: '24px' }}>
                <div className="profile-avatar">{initial}</div>
                <div className="profile-name">{user.real_name || user.sub}</div>
                <div className="profile-role">
                    {user.role === 'staff' ? '일반 직원' : user.role === 'admin' ? '관리자' : user.role}
                </div>

                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '24px',
                    marginTop: '20px',
                    padding: '16px',
                    borderTop: '1px solid var(--border-light)',
                }}>
                    <div className="text-center">
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>아이디</div>
                        <div style={{ fontWeight: 600, marginTop: '4px' }}>{user.sub}</div>
                    </div>
                    <div style={{ width: '1px', background: 'var(--border)' }} />
                    <div className="text-center">
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>등급</div>
                        <div style={{ fontWeight: 600, marginTop: '4px' }}>
                            <span className="badge badge-info">{user.grade || 'normal'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <div className="menu-list">
                {menuItems.map(item => {
                    const Icon = item.icon;
                    return (
                        <button key={item.label} className="menu-item" onClick={() => navigate(item.path)}>
                            <div className="menu-item-icon" style={{ background: item.bg, color: item.color }}>
                                <Icon size={20} />
                            </div>
                            <span>{item.label}</span>
                            <ChevronRight size={18} className="menu-item-arrow" />
                        </button>
                    );
                })}
            </div>

            {/* Logout */}
            <button
                className="btn btn-outline btn-block mt-6"
                onClick={handleLogout}
                style={{ color: '#ef4444', borderColor: '#fecaca' }}
            >
                <LogOut size={18} /> 로그아웃
            </button>

            <p className="text-xs text-muted text-center mt-4" style={{ opacity: 0.5 }}>
                소담 Staff v1.0.0
            </p>
        </div>
    );
}
