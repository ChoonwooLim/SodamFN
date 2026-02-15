import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, Settings, Users, LogOut, ShoppingBag, FileSignature, CreditCard, BarChart3, BookOpen, Menu, X, Smartphone } from 'lucide-react';

export default function Sidebar() {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Close drawer on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

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
            { icon: BarChart3, label: '매출 관리', path: '/revenue' },
            { icon: ShoppingBag, label: '매입 관리', path: '/purchase' },
            { icon: CreditCard, label: '카드 매출 분석', path: '/finance/card-sales' },
            { icon: Receipt, label: '손익계산서', path: '/finance/profitloss' },

            { icon: Users, label: '직원 관리', path: '/staff' },
            { icon: BookOpen, label: '소담 레시피', path: '/recipes' },
            { icon: Settings, label: '거래처 관리', path: '/vendor-settings' },
            { icon: Settings, label: '설정', path: '/settings' },
        ]
        : [
            { icon: LayoutDashboard, label: '대시보드', path: '/staff-dashboard' },
            { icon: FileSignature, label: '내 전자계약', path: '/contracts/my' },
            { icon: Settings, label: '설정', path: '/settings' },
        ];

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/';
    };

    const sidebarContent = (
        <>
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

            <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
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
                {user.role === 'admin' && (
                    <a
                        href={`${window.location.protocol}//${window.location.hostname}:5174`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 w-full px-4 py-3 mb-2 rounded-xl text-emerald-400 hover:bg-emerald-500/10 transition-all"
                    >
                        <Smartphone size={20} />
                        <span className="font-medium text-sm">직원용 앱</span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">PWA</span>
                    </a>
                )}
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-white transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium text-sm">로그아웃</span>
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Desktop Sidebar — always visible */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-900 min-h-screen text-white fixed left-0 top-0 z-50">
                {sidebarContent}
            </aside>

            {/* Mobile Hamburger Button */}
            <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden fixed top-3 left-3 z-[60] w-10 h-10 rounded-xl bg-slate-900/90 backdrop-blur-sm text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                aria-label="메뉴 열기"
            >
                <Menu size={20} />
            </button>

            {/* Mobile Drawer Overlay */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
                    onClick={() => setMobileOpen(false)}
                    style={{ animation: 'fadeIn 0.2s ease' }}
                />
            )}

            {/* Mobile Drawer */}
            <aside
                className={`md:hidden fixed top-0 left-0 z-[80] w-72 h-full bg-slate-900 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Close Button */}
                <button
                    onClick={() => setMobileOpen(false)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                    aria-label="메뉴 닫기"
                >
                    <X size={16} />
                </button>

                {sidebarContent}
            </aside>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </>
    );
}
