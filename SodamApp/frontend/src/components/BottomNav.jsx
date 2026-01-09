import { Link, useLocation } from 'react-router-dom';
import { Home, Camera, Settings } from 'lucide-react';

export default function BottomNav() {
    const location = useLocation();
    const isActive = (path) => location.pathname === path;

    return (
        <div className="fixed bottom-6 left-4 right-4 z-50">
            <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-nav border border-white/20 p-2 flex justify-around items-center h-16">
                <Link to="/" className={`flex-1 flex flex-col items-center justify-center h-full rounded-xl transition-all duration-300 ${isActive('/') ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Home size={22} strokeWidth={isActive('/') ? 2.5 : 2} />
                    {/* <span className="text-[10px] mt-1 font-medium">홈</span> */}
                </Link>

                <Link to="/camera" className="relative -top-8">
                    <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center text-white border-4 border-slate-50 transition-transform active:scale-95">
                        <Camera size={26} />
                    </div>
                </Link>

                <Link to="/settings" className={`flex-1 flex flex-col items-center justify-center h-full rounded-xl transition-all duration-300 ${isActive('/settings') ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Settings size={22} strokeWidth={isActive('/settings') ? 2.5 : 2} />
                    {/* <span className="text-[10px] mt-1 font-medium">설정</span> */}
                </Link>
            </div>
        </div>
    );
}
