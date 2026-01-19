import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, Settings, Users, LogOut, TrendingUp, ShoppingBag, FileSignature, CreditCard } from 'lucide-react';

export default function Sidebar() {
    const location = useLocation();

    // Get user info from localStorage
    const token = localStorage.getItem('token');
    let user = { role: 'admin', real_name: '관리자', grade: 'admin', profile_image: null };

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            user = {
                role: payload.role,
                real_name: payload.real_name || payload.sub,
                grade: payload.grade || 'normal',
                profile_image: payload.profile_image
            };
        } catch (e) {
            console.error("Failed to decode token", e);
        }
    }

    const menuItems = user.role === 'admin'
        ? [
            { icon: LayoutDashboard, label: '대시보드', path: '/' },
            { icon: TrendingUp, label: '매출 입력', path: '/input/revenue' },
            { icon: ShoppingBag, label: '매입 입력', path: '/input/expense' },
            { icon: CreditCard, label: '카드 매출 분석', path: '/finance/card-sales' },
            { icon: Receipt, label: '지출 내역', path: '/confirm' },
            { icon: Users, label: '직원 관리', path: '/staff' },
            { icon: Settings, label: '설정', path: '/settings' },
        ]
        : [
            { icon: LayoutDashboard, label: '대시보드', path: '/staff-dashboard' },
            { icon: FileSignature, label: '내 전자계약', path: '/contracts/my' },
            { icon: Settings, label: '설정', path: '/settings' }, // Assuming settings page is shared or safe
        ];

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/login';
    };

    return (
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 min-h-screen text-white fixed left-0 top-0 z-50">
            <div className="p-6 border-b border-slate-800/50">
                <div className="flex items-center gap-3 mb-4">
                    {user.profile_image ? (
                        <img src={user.profile_image} alt="Profile" className="w-10 h-10 rounded-full border border-slate-700 object-cover" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
                            {user.real_name?.[0] || 'U'}
                        </div>
                    )}
                    <div>
                        <h2 className="text-sm font-bold text-white leading-tight">{user.real_name}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium uppercase tracking-wider">
                                {user.grade}
                            </span>
                            <span className="text-[10px] text-slate-500">
                                {user.role === 'admin' ? '관리자' : '직원'}
                            </span>
                        </div>
                    </div>
                </div>
                <h1 className="text-lg font-black tracking-tighter bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                    SODAM<span className="text-blue-500">FN</span>
                </h1>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <Icon size={20} />
                            <span className="font-medium text-sm">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-white transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium text-sm">로그아웃</span>
                </button>
            </div>
        </aside>
    );
}
