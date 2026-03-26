import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart3, Camera, Wallet, Menu } from 'lucide-react';

export default function BottomNav() {
    const location = useLocation();
    const isActive = (path) => location.pathname === path;

    const navItems = [
        { icon: Home, path: '/dashboard', label: '홈' },
        { icon: BarChart3, path: '/revenue', label: '매출' },
        null, // Center button placeholder
        { icon: Wallet, path: '/finance/profitloss', label: '재무' },
        { icon: Menu, path: '/more', label: '더보기' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(0,0,0,0.06)',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'flex-end',
                padding: '4px 8px 8px',
            }}>
                {navItems.map((item) => {
                    if (!item) {
                        // Center floating action button
                        return (
                            <Link key="input" to="/camera" style={{
                                position: 'relative',
                                top: -18,
                                margin: '0 4px',
                                textDecoration: 'none',
                            }}>
                                <div style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 28,
                                    background: isActive('/camera')
                                        ? 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)'
                                        : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
                                    border: '4px solid white',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                }}>
                                    <Camera size={24} />
                                </div>
                                <span style={{
                                    display: 'block',
                                    textAlign: 'center',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: isActive('/camera') ? '#3b82f6' : '#94a3b8',
                                    marginTop: 2,
                                }}>입력</span>
                            </Link>
                        );
                    }

                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '6px 12px',
                                borderRadius: 12,
                                textDecoration: 'none',
                                minWidth: 52,
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                {active && (
                                    <div style={{
                                        position: 'absolute',
                                        width: 36,
                                        height: 36,
                                        borderRadius: 12,
                                        background: 'rgba(59,130,246,0.1)',
                                    }} />
                                )}
                                <Icon
                                    size={22}
                                    strokeWidth={active ? 2.5 : 1.8}
                                    style={{ color: active ? '#3b82f6' : '#94a3b8', position: 'relative', zIndex: 1 }}
                                />
                            </div>
                            <span style={{
                                fontSize: 10,
                                marginTop: 2,
                                fontWeight: active ? 700 : 500,
                                color: active ? '#3b82f6' : '#94a3b8',
                            }}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
