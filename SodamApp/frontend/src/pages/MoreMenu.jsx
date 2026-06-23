import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart3, ShoppingBag, CreditCard, Receipt, Users, Wallet,
    BookOpen, Settings, ClipboardList, Package, LogOut, ChevronRight,
    Store, Bell, CheckSquare, FileText
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function parseToken() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return { name: '관리자', grade: 'admin', bid: null };
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
            name: payload.real_name || payload.sub || '관리자',
            grade: payload.grade || 'admin',
            bid: payload.business_id || localStorage.getItem('business_id'),
        };
    } catch { return { name: '관리자', grade: 'admin', bid: null }; }
}

export default function MoreMenu() {
    const tokenInfo = useMemo(() => parseToken(), []);
    const [businessName, setBusinessName] = useState('');

    useEffect(() => {
        if (tokenInfo.bid) {
            axios.get(`${API_URL}/api/auth/business-info?bid=${tokenInfo.bid}`)
                .then(res => {
                    if (res.data?.business_name) {
                        let n = res.data.business_name;
                        if (n.toLowerCase() === 'sodam gimbap') n = '소담김밥';
                        setBusinessName(n);
                    }
                }).catch(() => {});
        }
    }, [tokenInfo.bid]);

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/login';
    };

    const menuSections = [
        {
            title: '매출/재무',
            items: [
                { icon: BarChart3, label: '매출 관리', path: '/revenue', color: '#3b82f6', bg: '#eff6ff' },
                { icon: CreditCard, label: '카드 매출 분석', path: '/finance/card-sales', color: '#8b5cf6', bg: '#f5f3ff' },
                { icon: Receipt, label: '손익계산서', path: '/finance/profitloss', color: '#10b981', bg: '#ecfdf5' },
                { icon: ShoppingBag, label: '비용 관리', path: '/purchase', color: '#f59e0b', bg: '#fffbeb' },
            ]
        },
        {
            title: '인사/노무',
            items: [
                { icon: Users, label: '직원 관리', path: '/employees', color: '#6366f1', bg: '#eef2ff' },
                { icon: Wallet, label: '퇴직금 관리', path: '/hr/retirement', color: '#a855f7', bg: '#faf5ff' },
            ]
        },
        {
            title: '매장 운영',
            items: [
                { icon: BookOpen, label: '레시피 관리', path: '/products/recipes', color: '#14b8a6', bg: '#f0fdfa' },
                { icon: FileText, label: '메뉴판/가격표', path: '/products/menu-board', color: '#f97316', bg: '#fff7ed' },
                { icon: Package, label: '배달앱 이미지', path: '/products/delivery-images', color: '#8b5cf6', bg: '#f5f3ff' },
                { icon: Store, label: '매장 홍보물', path: '/products/store-materials', color: '#64748b', bg: '#f8fafc' },
                { icon: CheckSquare, label: '오픈 체크리스트', path: '/open-checklist', color: '#22c55e', bg: '#f0fdf4' },
                { icon: Store, label: '거래처 관리', path: '/vendor-settings', color: '#475569', bg: '#f1f5f9' },
                { icon: Package, label: '재고 점검', path: '/inventory-check-admin', color: '#06b6d4', bg: '#ecfeff' },
            ]
        },
        {
            title: '소통/관리',
            items: [
                { icon: Bell, label: '공지/건의/소통', path: '/board', color: '#f97316', bg: '#fff7ed' },
                { icon: ClipboardList, label: '발주 요청', path: '/purchase-requests', color: '#ef4444', bg: '#fef2f2' },
                { icon: FileText, label: '사용 매뉴얼', path: '/manual', color: '#78716c', bg: '#fafaf9' },
                { icon: Settings, label: '설정', path: '/settings', color: '#475569', bg: '#f1f5f9' },
            ]
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            {/* Profile Header */}
            <div className="bg-gradient-to-br from-slate-700 to-slate-800 px-6 pt-12 pb-7 rounded-b-[28px]">
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xl font-extrabold text-white shadow-lg shadow-slate-700/20 border border-white/10">
                        {tokenInfo.name?.[0] || 'A'}
                    </div>
                    <div>
                        <div className="text-white text-lg font-extrabold tracking-tight">
                            {tokenInfo.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/25 text-blue-300 uppercase tracking-wider">
                                {tokenInfo.grade}
                            </span>
                            {businessName && (
                                <span className="text-xs text-slate-400 font-medium">
                                    {businessName}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Menu Sections */}
            <div className="px-4 pt-4">
                {menuSections.map((section, si) => (
                    <div key={si} className="card-animate mb-5" style={{ animationDelay: `${si * 0.08}s` }}>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">
                            {section.title}
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            {section.items.map((item, ii) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={ii}
                                        to={item.path}
                                        className="list-item-press"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 14,
                                            padding: '14px 16px',
                                            textDecoration: 'none',
                                            borderBottom: ii < section.items.length - 1 ? '1px solid #f1f5f9' : 'none',
                                            transition: 'background 0.15s',
                                        }}
                                        onTouchStart={e => e.currentTarget.style.background = '#f8fafc'}
                                        onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 12,
                                            background: item.bg,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <Icon size={20} style={{ color: item.color }} />
                                        </div>
                                        <span style={{
                                            flex: 1, fontSize: 15, fontWeight: 600, color: '#1e293b',
                                        }}>
                                            {item.label}
                                        </span>
                                        <ChevronRight size={16} style={{ color: '#cbd5e1' }} />
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Logout */}
                <div className="card-animate" style={{ marginTop: 8, marginBottom: 24, animationDelay: '0.35s' }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '14px',
                            background: 'white',
                            border: '1px solid #fee2e2',
                            borderRadius: 16,
                            color: '#ef4444',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        <LogOut size={18} />
                        로그아웃
                    </button>
                </div>

                {/* Footer */}
                <div style={{ textAlign: 'center', padding: '0 0 16px' }}>
                    <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600 }}>
                        <span style={{ color: '#1e293b' }}>셈</span>
                        <span style={{ color: '#3b82f6' }}>하나</span>
                        <span style={{ color: '#e2e8f0', margin: '0 6px' }}>|</span>
                        SEMHANA v1.0
                    </span>
                </div>
            </div>
        </div>
    );
}
