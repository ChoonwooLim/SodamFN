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
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                borderTop: '1px solid rgba(0,0,0,0.04)',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                padding: '2px 4px 4px',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.04)',
            }}>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className="touch-feedback"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '6px 8px 4px',
                                borderRadius: 12,
                                textDecoration: 'none',
                                minWidth: 52,
                                position: 'relative',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        >
                            {active && (
                                <div className="bnav-active-bg" style={{
                                    position: 'absolute',
                                    top: 2,
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.08))',
                                }} />
                            )}
                            <Icon
                                size={20}
                                strokeWidth={active ? 2.2 : 1.6}
                                style={{
                                    color: active ? '#3B82F6' : '#94A3B8',
                                    position: 'relative',
                                    zIndex: 1,
                                    transition: 'all 0.2s ease',
                                    ...(active ? { filter: 'drop-shadow(0 1px 3px rgba(59,130,246,0.3))' } : {}),
                                }}
                            />
                            <span style={{
                                fontSize: 9,
                                marginTop: 1,
                                fontWeight: active ? 700 : 500,
                                color: active ? '#3B82F6' : '#94A3B8',
                                letterSpacing: active ? -0.2 : -0.3,
                                transition: 'all 0.2s ease',
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
