import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import api from '../api';
import { LayoutDashboard, Receipt, Settings, Users, UserCircle, LogOut, ShoppingBag, FileSignature, CreditCard, BarChart3, BookOpen, Menu, X, Smartphone, Home, ClipboardList, Rocket, Monitor, ChevronDown, ChevronUp, Package, Shield, Building2, FileText, Bell, TrendingUp, Wallet, ArrowLeftRight, Truck, PieChart, Palette, Store, Brain, Globe, Gauge, Briefcase, Send, Landmark, MessageCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Sidebar() {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [boardOpen, setBoardOpen] = useState(false);
    const [hrOpen, setHrOpen] = useState(false);
    const [plOpen, setPlOpen] = useState(false);
    const [productOpen, setProductOpen] = useState(false);
    const [businessName, setBusinessName] = useState('셈하나');
    const [logoUrl, setLogoUrl] = useState(null);
    const [businesses, setBusinesses] = useState([]);
    const [viewAsBid, setViewAsBid] = useState(localStorage.getItem('view_as_business_id') || '');

    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    useEffect(() => {
        const boardPaths = ['/board', '/open-checklist', '/inventory-check-admin'];
        if (boardPaths.some(p => location.pathname.startsWith(p))) setBoardOpen(true);
        const hrPaths = ['/employees', '/hr/retirement', '/hr/foreign-worker-guide', '/hr/dashboard', '/hr/job-posting', '/hr/fax'];
        if (hrPaths.some(p => location.pathname.startsWith(p))) setHrOpen(true);
        const plPaths = ['/finance/profitloss', '/revenue', '/purchase', '/finance/card-sales', '/finance/delivery', '/finance/bank-sync', '/finance/tax-invoice', '/finance/hometax', '/finance/cashbill'];
        if (plPaths.some(p => location.pathname.startsWith(p))) setPlOpen(true);
        const productPaths = ['/products/'];
        if (productPaths.some(p => location.pathname.startsWith(p))) setProductOpen(true);
    }, [location.pathname]);

    const token = localStorage.getItem('token');
    let user = { role: 'admin', real_name: '관리자', grade: 'admin', profile_image: null };

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            user = {
                role: payload.role,
                real_name: payload.real_name || payload.sub,
                grade: payload.grade || '정직원',
                profile_image: payload.profile_image,
                business_id: payload.business_id
            };
        } catch (e) {
            console.error("Failed to decode token", e);
        }
    }

    useEffect(() => {
        if (user.role === 'superadmin') {
            api.get('/superadmin/businesses/dropdown')
                .then(res => { if (res.data?.data) setBusinesses(res.data.data); })
                .catch(err => console.error('Failed to fetch businesses for dropdown', err));
        }
    }, [user.role]);

    useEffect(() => {
        if (user.role === 'superadmin') {
            if (viewAsBid) {
                const biz = businesses.find(b => String(b.id) === String(viewAsBid));
                setBusinessName(biz ? biz.name : '사업장 선택');
            } else {
                setBusinessName('소담FN');
            }
            return;
        }
        const bid = user.business_id || localStorage.getItem('business_id');
        if (bid) {
            axios.get(`${API_URL}/api/auth/business-info?bid=${bid}`)
                .then(res => {
                    if (res.data && res.data.business_name) {
                        let bName = res.data.business_name;
                        if (bName.toLowerCase() === 'sodam gimbap') bName = '소담김밥';
                        setBusinessName(bName);
                    }
                    if (res.data && res.data.logo_url) {
                        setLogoUrl(`${API_URL}${res.data.logo_url}`);
                    }
                })
                .catch(err => console.error('Failed to fetch business info for sidebar', err));
        }
    }, [user.business_id, viewAsBid, businesses]);

    const handleViewAsChange = (newBid) => {
        if (newBid) {
            localStorage.setItem('view_as_business_id', newBid);
            localStorage.setItem('business_id', newBid);
        } else {
            localStorage.removeItem('view_as_business_id');
            localStorage.removeItem('business_id');
        }
        setViewAsBid(newBid);
        window.location.href = newBid ? '/dashboard' : '/superadmin';
    };

    const isSuperAdmin = user.role === 'superadmin';
    const isViewingBusiness = isSuperAdmin && viewAsBid;

    const adminMenuItems = [
        { icon: LayoutDashboard, label: '대시보드', path: '/dashboard' },
    ];

    const productSubItems = [
        { icon: BookOpen, label: '레시피 관리', path: '/products/recipes' },
        { icon: FileText, label: '메뉴판/가격표', path: '/products/menu-board' },
        { icon: Truck, label: '배달앱 이미지', path: '/products/delivery-images' },
        { icon: Store, label: '매장 홍보물', path: '/products/store-materials' },
    ];

    const plSubItems = [
        { icon: Receipt, label: '손익계산서', path: '/finance/profitloss', color: 'text-emerald-400' },
        { icon: BarChart3, label: '매출관리', path: '/revenue', color: 'text-blue-400' },
        { icon: ShoppingBag, label: '매입관리', path: '/purchase', color: 'text-orange-400' },
        { icon: Truck, label: '배달앱관리', path: '/finance/delivery', color: 'text-amber-400' },
        { icon: CreditCard, label: '카드관리', path: '/finance/card-sales', color: 'text-violet-400' },
        { icon: Landmark, label: '은행계좌 연동', path: '/finance/bank-sync', color: 'text-indigo-400' },
        { icon: FileText, label: '전자세금계산서', path: '/finance/tax-invoice', color: 'text-rose-400' },
        { icon: Wallet, label: '현금영수증', path: '/finance/cashbill', color: 'text-emerald-400' },
        { icon: BookOpen, label: '홈택스 수집', path: '/finance/hometax', color: 'text-violet-400' },
    ];

    const superAdminMenuItems = [
        { icon: Shield, label: 'SuperAdmin 대시보드', path: '/superadmin' },
        { icon: Building2, label: '매장 관리', path: '/superadmin?tab=stores' },
        { icon: FileText, label: '사용신청 관리', path: '/superadmin?tab=applications' },
        { icon: Users, label: '사용자 관리', path: '/superadmin?tab=users' },
        { icon: TrendingUp, label: '실시간 모니터링', path: '/superadmin?tab=monitoring' },
        { icon: CreditCard, label: '요금 정산', path: '/superadmin?tab=billing' },
        { icon: Bell, label: '공지 배포', path: '/superadmin?tab=announcements' },
        { icon: BarChart3, label: '통계/벤치마크', path: '/superadmin?tab=analytics' },
        { icon: FileText, label: '작업일지', path: '/superadmin/worklog' },
    ];

    const mainMenuItems = isSuperAdmin
        ? (isViewingBusiness ? adminMenuItems : superAdminMenuItems)
        : user.role === 'admin'
        ? adminMenuItems
        : [
            { icon: LayoutDashboard, label: '대시보드', path: '/dashboard' },
            { icon: FileSignature, label: '내 전자계약', path: '/contracts/my' },
        ];

    const boardSubItems = [
        { icon: ClipboardList, label: '공지/건의/소통', path: '/board', color: 'text-amber-400' },
        { icon: ClipboardList, label: '오픈 체크리스트', path: '/open-checklist', color: 'text-emerald-400' },
        { icon: Package, label: '오픈 재고 체크', path: '/inventory-check-admin', color: 'text-cyan-400' },
    ];

    const hrSubItems = [
        { icon: Gauge, label: 'HR 대시보드', path: '/hr/dashboard', color: 'text-indigo-400' },
        { icon: UserCircle, label: '인사기록관리', path: '/employees', color: 'text-emerald-400' },
        { icon: Briefcase, label: '구인등록', path: '/hr/job-posting', color: 'text-orange-400' },
        { icon: Wallet, label: '퇴직금 지급관리', path: '/hr/retirement', color: 'text-blue-400' },
        { icon: Send, label: '팩스 전송', path: '/hr/fax', color: 'text-violet-400' },
        { icon: MessageCircle, label: '알림톡 관리', path: '/hr/notifications', color: 'text-yellow-400' },
        { icon: Globe, label: '외국인 고용안내', path: '/hr/foreign-worker-guide', color: 'text-cyan-400' },
    ];

    const bottomMenuItems = isSuperAdmin
        ? [
            ...(isViewingBusiness ? [
                { icon: Settings, label: '거래처 관리', path: '/vendor-settings' },
                { icon: Settings, label: '설정', path: '/settings' },
            ] : []),
            { icon: Rocket, label: '셈하나 로드맵', path: '/roadmap' },
            { icon: Palette, label: '디자인 계획서', path: '/design-plan' },
            { icon: Brain, label: 'AI 시스템 설계', path: '/ai-system-design' },
            { icon: Rocket, label: '앱 전송관리', path: '/deploy' },
        ]
        : user.role === 'admin'
        ? [
            { icon: Settings, label: '거래처 관리', path: '/vendor-settings' },
            { icon: BookOpen, label: '사용 매뉴얼', path: '/manual' },
            { icon: Settings, label: '설정', path: '/settings' },
            { icon: Rocket, label: '셈하나 로드맵', path: '/roadmap' },
            { icon: Palette, label: '디자인 계획서', path: '/design-plan' },
            { icon: Brain, label: 'AI 시스템 설계', path: '/ai-system-design' },
            { icon: Rocket, label: '앱 전송관리', path: '/deploy' },
        ]
        : [
            { icon: Settings, label: '설정', path: '/settings' },
        ];

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/';
    };

    const isBoardActive = ['/board', '/open-checklist', '/inventory-check-admin'].some(p => location.pathname.startsWith(p));
    const isHrActive = ['/employees', '/hr/retirement', '/hr/foreign-worker-guide', '/hr/dashboard', '/hr/job-posting', '/hr/fax'].some(p => location.pathname === p || (p !== '/employees' && location.pathname.startsWith(p)));
    const isPLActive = ['/finance/profitloss', '/revenue', '/purchase', '/finance/card-sales', '/finance/delivery', '/finance/bank-sync', '/finance/tax-invoice', '/finance/hometax', '/finance/cashbill'].some(p => location.pathname.startsWith(p));
    const isProductActive = productSubItems.some(item => location.pathname === item.path);

    // ── Premium menu item renderer ──
    const renderMenuItem = (item) => {
        const Icon = item.icon;
        const fullPath = item.path;
        const isActive = fullPath.includes('?')
            ? location.pathname + location.search === fullPath
            : location.pathname === fullPath;

        return (
            <Link
                key={fullPath}
                to={fullPath}
                className={`sidebar-menu-item ${isActive ? (isSuperAdmin ? 'active-super' : 'active') : ''}`}
            >
                <Icon size={18} className="icon-glow" />
                <span>{item.label}</span>
            </Link>
        );
    };

    // ── Submenu section renderer ──
    const renderSubmenu = (label, icon, isOpen, setOpen, isGroupActive, items, accentColor) => {
        const Icon = icon;
        return (
            <div className="mb-0.5">
                <button
                    onClick={() => setOpen(!isOpen)}
                    className={`sidebar-menu-item w-full ${isGroupActive ? 'active' : ''}`}
                    style={{ justifyContent: 'flex-start' }}
                >
                    <Icon size={18} className="icon-glow" />
                    <span className="flex-1 text-left">{label}</span>
                    <ChevronDown
                        size={14}
                        className={`text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>
                <div className={`sidebar-submenu ${isOpen ? 'expanded' : 'collapsed'}`}>
                    <div className="mt-1 space-y-0.5">
                        {items.map(sub => {
                            const SubIcon = sub.icon;
                            const isSubActive = sub.path.includes('?')
                                ? (location.pathname + location.search) === sub.path
                                : location.pathname === sub.path || location.pathname.startsWith(sub.path);
                            return (
                                <Link
                                    key={sub.path}
                                    to={sub.path}
                                    className={`sidebar-sub-item ${isSubActive ? 'active' : ''}`}
                                >
                                    <SubIcon size={14} className={isSubActive ? 'text-white' : sub.color} />
                                    <span>{sub.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const sidebarContent = (
        <>
            {/* ── Header / Profile ── */}
            <div className="p-5 pb-4">
                <div className="flex items-center gap-3 mb-4">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Store Logo" className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/10" />
                    ) : user.profile_image ? (
                        <img src={user.profile_image} alt="Profile" className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/10" />
                    ) : (
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
                            style={{
                                background: isSuperAdmin
                                    ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                                    : 'linear-gradient(135deg, #3B82F6, #2563EB)',
                                boxShadow: isSuperAdmin
                                    ? '0 4px 12px rgba(245,158,11,0.3)'
                                    : '0 4px 12px rgba(59,130,246,0.3)',
                            }}
                        >
                            {user.real_name?.[0] || 'U'}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-white leading-tight truncate">{user.real_name}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                                className="text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider"
                                style={{
                                    background: isSuperAdmin ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                                    color: isSuperAdmin ? '#FCD34D' : '#93C5FD',
                                }}
                            >
                                {isSuperAdmin ? 'SUPER' : user.grade}
                            </span>
                            <span className="text-[11px] text-slate-500">
                                {user.role === 'superadmin' ? '플랫폼 총괄' : user.role === 'admin' ? '관리자' : '직원'}
                            </span>
                        </div>
                    </div>
                </div>

                {isViewingBusiness && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-400 mb-3 pl-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        현재 {businesses.find(b => String(b.id) === String(viewAsBid))?.name || ''} 관리자 뷰
                    </div>
                )}

                {/* Business Name Card */}
                <div className="relative overflow-hidden rounded-xl" style={{
                    background: isViewingBusiness
                        ? 'linear-gradient(135deg, #1a2636, #1e2d42)'
                        : 'linear-gradient(135deg, #162218, #1a2c20)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}>
                    <div className="absolute inset-0 opacity-20" style={{
                        backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(59,130,246,0.15) 0%, transparent 60%)',
                    }} />
                    <h1 className="relative text-lg font-black tracking-tight flex items-center justify-center py-3 px-4">
                        <span className={`${isViewingBusiness ? 'text-amber-400' : 'text-emerald-400'} drop-shadow-sm`}>{businessName}</span>
                        <span className="text-slate-600 font-light mx-2">|</span>
                        <span className="text-white">셈</span><span className="text-blue-400">하나</span>
                    </h1>
                </div>
            </div>

            {/* ── Divider ── */}
            <div className="mx-5 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }} />

            {/* ── Navigation ── */}
            <nav className="flex-1 px-3 space-y-0.5 mt-3 overflow-y-auto hide-scrollbar">
                {isViewingBusiness && (
                    <button
                        onClick={() => handleViewAsChange('')}
                        className="sidebar-menu-item w-full mb-1"
                        style={{ color: '#FBBF24', fontSize: '12px' }}
                    >
                        <Shield size={15} />
                        <span>← SuperAdmin 대시보드</span>
                    </button>
                )}

                {/* Section: Main */}
                <div className="px-3 pt-2 pb-1.5">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">메인</span>
                </div>
                {mainMenuItems.map(renderMenuItem)}

                {/* Section: Product Management */}
                {(user.role === 'admin' || isViewingBusiness) && (
                    <>
                        {renderSubmenu('상품관리', ShoppingBag, productOpen, setProductOpen,
                            isProductActive,
                            productSubItems, 'text-orange-400')}
                    </>
                )}

                {/* Section: Finance */}
                {(user.role === 'admin' || isViewingBusiness) && (
                    <>
                        <div className="px-3 pt-4 pb-1.5">
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">경영관리</span>
                        </div>
                        {renderSubmenu('손익관리', PieChart, plOpen, setPlOpen, isPLActive, plSubItems, 'emerald')}
                        {renderSubmenu('직원관리', Users, hrOpen, setHrOpen, isHrActive, hrSubItems, 'indigo')}
                        {renderSubmenu('통합게시판', ClipboardList, boardOpen, setBoardOpen, isBoardActive, boardSubItems, 'blue')}
                    </>
                )}

                {/* Section: Tools */}
                {bottomMenuItems.length > 0 && (
                    <>
                        <div className="px-3 pt-4 pb-1.5">
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">도구</span>
                        </div>
                        {bottomMenuItems.map(renderMenuItem)}
                    </>
                )}
            </nav>

            {/* ── Footer ── */}
            <div className="p-3 space-y-0.5">
                <div className="mx-2 mb-2 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }} />

                {isSuperAdmin && !isViewingBusiness && (
                    <Link
                        to="/admin-app-preview"
                        className={`sidebar-menu-item ${location.pathname === '/admin-app-preview' ? 'active-super' : ''}`}
                    >
                        <Shield size={16} />
                        <span>수퍼관리자앱</span>
                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#FBBF24' }}>SUPER</span>
                    </Link>
                )}

                {(user.role === 'admin' || isViewingBusiness) && (
                    <>
                        <Link
                            to="/staff-app-preview"
                            className={`sidebar-menu-item ${location.pathname === '/staff-app-preview' ? 'active' : ''}`}
                        >
                            <Smartphone size={16} />
                            <span>직원용 앱</span>
                            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#6EE7B7' }}>PWA</span>
                        </Link>
                        <Link
                            to="/admin-app-preview"
                            className={`sidebar-menu-item ${location.pathname === '/admin-app-preview' ? 'active' : ''}`}
                        >
                            <Monitor size={16} />
                            <span>관리자 앱</span>
                            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: 'rgba(139,92,246,0.15)', color: '#C4B5FD' }}>WEB</span>
                        </Link>
                    </>
                )}

                {/* Brand Footer */}
                <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-300 transition-all group"
                >
                    <Home size={16} className="group-hover:text-white transition-colors" />
                    <span className="font-bold text-sm tracking-tight flex items-center">
                        <span className="text-white">셈</span><span className="text-blue-400">하나</span>
                        <span className="text-slate-700 font-light mx-1.5">|</span>
                        <span className="text-slate-400 text-xs">SEMHANA</span>
                    </span>
                </a>

                <button
                    onClick={handleLogout}
                    className="sidebar-menu-item w-full"
                    style={{ color: '#94A3B8' }}
                >
                    <LogOut size={16} />
                    <span>로그아웃</span>
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <aside
                className="hidden md:flex flex-col min-h-screen text-white fixed left-0 top-0 z-50"
                style={{
                    width: 'var(--sidebar-width, 272px)',
                    background: 'var(--sidebar-bg, linear-gradient(180deg, #0F172A 0%, #1E293B 100%))',
                }}
            >
                {sidebarContent}
            </aside>

            {/* Mobile Hamburger */}
            <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden fixed top-3 left-3 z-[60] w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                }}
                aria-label="메뉴 열기"
            >
                <Menu size={18} />
            </button>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 z-[70] fade-overlay"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Mobile Drawer */}
            <aside
                className={`md:hidden fixed top-0 left-0 z-[80] w-[280px] h-full text-white flex flex-col transition-transform duration-300 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={{
                    background: 'var(--sidebar-bg, linear-gradient(180deg, #0F172A 0%, #1E293B 100%))',
                    boxShadow: mobileOpen ? '16px 0 48px rgba(0,0,0,0.5)' : 'none',
                }}
            >
                <button
                    onClick={() => setMobileOpen(false)}
                    className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                    aria-label="메뉴 닫기"
                >
                    <X size={14} className="text-slate-400" />
                </button>
                {sidebarContent}
            </aside>
        </>
    );
}
