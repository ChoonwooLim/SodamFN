import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, Settings, Users, LogOut, TrendingUp, ShoppingBag } from 'lucide-react';

export default function Sidebar() {
    const location = useLocation();

    const menuItems = [
        { icon: LayoutDashboard, label: '대시보드', path: '/' },
        { icon: TrendingUp, label: '매출 입력', path: '/input/revenue' },
        { icon: ShoppingBag, label: '매입 입력', path: '/input/expense' },
        { icon: Receipt, label: '지출 내역', path: '/confirm' },
        { icon: Users, label: '직원 관리', path: '/staff' },
        { icon: Settings, label: '설정', path: '/settings' },
    ];

    return (
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 min-h-screen text-white fixed left-0 top-0 z-50">
            <div className="p-6">
                <h1 className="text-xl font-bold tracking-tight">
                    Sodam<span className="text-blue-400">FN</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">소담김밥 관리자</p>
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
                <button className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-white transition-colors">
                    <LogOut size={20} />
                    <span className="font-medium text-sm">로그아웃</span>
                </button>
            </div>
        </aside>
    );
}
