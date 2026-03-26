import { Link, useLocation } from 'react-router-dom';
import { Receipt, BarChart3, ShoppingBag, CreditCard, Truck, MoreHorizontal } from 'lucide-react';

export default function BottomNav() {
    const location = useLocation();
    const fullPath = location.pathname + location.search;
    const isActive = (path) => {
        if (path.includes('?')) return fullPath === path;
        return location.pathname === path;
    };

    const navItems = [
        { icon: Receipt, path: '/finance/profitloss', label: '손익' },
        { icon: BarChart3, path: '/revenue', label: '매출' },
        { icon: ShoppingBag, path: '/purchase', label: '매입' },
        { icon: CreditCard, path: '/finance/card-sales', label: '카드' },
        { icon: Truck, path: '/revenue?view=delivery', label: '배달앱' },
        { icon: MoreHorizontal, path: '/more', label: '더보기' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div style={{
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(0,0,0,0.06)',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                padding: '4px 2px 6px',
            }}>
                {navItems.map((item) => {
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
                                padding: '4px 4px',
                                borderRadius: 10,
                                textDecoration: 'none',
                                minWidth: 48,
                                transition: 'all 0.2s',
                                position: 'relative',
                            }}
                        >
                            {active && (
                                <div className="bnav-active-bg" style={{
                                    position: 'absolute',
                                    top: 0,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: 'rgba(59,130,246,0.1)',
                                }} />
                            )}
                            <Icon
                                size={20}
                                strokeWidth={active ? 2.5 : 1.8}
                                style={{
                                    color: active ? '#3b82f6' : '#94a3b8',
                                    position: 'relative',
                                    zIndex: 1,
                                }}
                            />
                            <span style={{
                                fontSize: 9,
                                marginTop: 2,
                                fontWeight: active ? 700 : 500,
                                color: active ? '#3b82f6' : '#94a3b8',
                                letterSpacing: -0.3,
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
