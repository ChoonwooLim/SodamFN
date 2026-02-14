import { Link, useLocation } from 'react-router-dom';
import { Home, Camera, Settings, BarChart3, ShoppingBag } from 'lucide-react';

export default function BottomNav() {
    const location = useLocation();
    const isActive = (path) => location.pathname === path;

    const navItems = [
        { icon: Home, path: '/', label: '홈' },
        { icon: BarChart3, path: '/revenue', label: '매출' },
        null, // Center camera button placeholder
        { icon: ShoppingBag, path: '/purchase', label: '매입' },
        { icon: Settings, path: '/settings', label: '설정' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-2 pt-1 pb-2 flex justify-around items-end">
                {navItems.map((item, idx) => {
                    if (!item) {
                        // Center Camera Button
                        return (
                            <Link key="camera" to="/camera" className="relative -top-5 mx-1">
                                <div className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white border-4 border-white transition-all active:scale-95 ${isActive('/camera')
                                        ? 'bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-blue-500/40'
                                        : 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/30'
                                    }`}>
                                    <Camera size={24} />
                                </div>
                            </Link>
                        );
                    }

                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-200 min-w-[52px] ${active
                                    ? 'text-blue-600'
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                            <span className={`text-[10px] mt-0.5 font-medium ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

