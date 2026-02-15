import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Clock, FileSignature, User } from 'lucide-react';

const tabs = [
    { path: '/', icon: Home, label: '홈' },
    { path: '/attendance', icon: Clock, label: '출퇴근' },
    { path: '/contracts', icon: FileSignature, label: '계약' },
    { path: '/profile', icon: User, label: '내정보' },
];

export default function BottomTab() {
    const location = useLocation();
    const navigate = useNavigate();

    // Don't show on login or contract signing pages
    const hiddenPaths = ['/login', '/contracts/'];
    if (hiddenPaths.some(p => location.pathname === p ||
        (p === '/contracts/' && location.pathname.includes('/sign')))) {
        return null;
    }

    return (
        <nav className="bottom-nav">
            {tabs.map((tab) => {
                const isActive = location.pathname === tab.path ||
                    (tab.path !== '/' && location.pathname.startsWith(tab.path));
                const Icon = tab.icon;

                return (
                    <button
                        key={tab.path}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => navigate(tab.path)}
                    >
                        <span className="nav-item-icon">
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="nav-item-dot" />
                        </span>
                        <span>{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
