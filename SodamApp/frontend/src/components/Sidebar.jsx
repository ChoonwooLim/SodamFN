import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import api from '../api';
import { LayoutDashboard, Receipt, Settings, Users, UserCircle, LogOut, ShoppingBag, FileSignature, CreditCard, BarChart3, BookOpen, Menu, X, Smartphone, Home, ClipboardList, Rocket, Monitor, ChevronDown, ChevronUp, Package, Shield, Building2, FileText, FileCheck, Bell, TrendingUp, Wallet, ArrowLeftRight, Truck, PieChart, Palette, Store, Brain, Gauge, Briefcase, Send, MessageCircle, Sparkles, Lightbulb, Link2, Boxes, ShoppingCart, PackageSearch, Star } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Sidebar() {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [boardOpen, setBoardOpen] = useState(false);
    const [hrOpen, setHrOpen] = useState(false);
    const [plOpen, setPlOpen] = useState(false);
    const [matOpen, setMatOpen] = useState(false);
    const [productOpen, setProductOpen] = useState(false);
    const [salesGuideOpen, setSalesGuideOpen] = useState(false);
    const [salesGuideAlerts, setSalesGuideAlerts] = useState(0);
    const [extIntegrationAlerts, setExtIntegrationAlerts] = useState(0);
    const [businessName, setBusinessName] = useState('셈하나');
    const [logoUrl, setLogoUrl] = useState(null);
    const [businesses, setBusinesses] = useState([]);
    const [viewAsBid, setViewAsBid] = useState(localStorage.getItem('view_as_business_id') || '');

    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    useEffect(() => {
        const boardPaths = ['/board', '/open-checklist'];
        if (boardPaths.some(p => location.pathname.startsWith(p))) setBoardOpen(true);
        const hrPaths = ['/employees', '/hr/retirement', '/hr/dashboard', '/hr/job-posting', '/hr/fax', '/hr/notifications', '/yearend'];
        if (hrPaths.some(p => location.pathname.startsWith(p))) setHrOpen(true);
        const plPaths = ['/finance/profitloss', '/revenue', '/finance/card-sales', '/finance/delivery', '/finance/bank-sync', '/finance/tax-invoice', '/finance/statement', '/finance/hometax', '/finance/cashbill', '/external-integration', '/auto-collection'];
        if (plPaths.some(p => location.pathname.startsWith(p))) setPlOpen(true);
        const matPaths = ['/materials', '/purchase', '/purchase-requests', '/inventory-check-admin', '/vendor-settings'];
        if (matPaths.some(p => location.pathname.startsWith(p))) setMatOpen(true);
        const productPaths = ['/products/'];
        if (productPaths.some(p => location.pathname.startsWith(p))) setProductOpen(true);
        if (location.pathname.startsWith('/sales-guide')) setSalesGuideOpen(true);
    }, [location.pathname]);

    useEffect(() => {
        // superadmin 은 사업장 컨텍스트 없으면 /sales-guide/stats 가 401 반환 → api.js
        // 인터셉터가 강제 로그아웃(/login 리다이렉트) 시키므로 호출 자체를 스킵.
        // (view-as 매장 선택 후에는 X-View-As-Business 헤더로 정상 호출됨)
        const role = localStorage.getItem('user_role');
        const viewAs = localStorage.getItem('view_as_business_id');
        if (role === 'superadmin' && !viewAs) {
            setSalesGuideAlerts(0);
            return;
        }
        api.get('/sales-guide/stats').then((res) => {
            const overall = res.data.overall;
            const incomplete = overall.total - overall.completed;
            const expiring = res.data.categories.reduce(
                (sum, c) => sum + (c.alerts?.length ?? 0),
                0
            );
            setSalesGuideAlerts(incomplete + expiring);
        }).catch(() => setSalesGuideAlerts(0));
    }, [location.pathname, viewAsBid]);

    // 외부 연동 통합 상태 — 쿠팡이츠/배민 쿠키 만료/실패 카운트.
    // 60초마다 폴링 (탭 활성 시), 사장님이 어드민 열 때 항상 최신.
    useEffect(() => {
        const role = localStorage.getItem('user_role');
        const viewAs = localStorage.getItem('view_as_business_id');
        if (role === 'superadmin' && !viewAs) {
            setExtIntegrationAlerts(0);
            return;
        }
        const fetchAlerts = () => {
            api.get('/external-integration/status')
                .then(res => setExtIntegrationAlerts(res.data.alert_count || 0))
                .catch(() => setExtIntegrationAlerts(0));
        };
        fetchAlerts();
        const id = setInterval(fetchAlerts, 60_000);
        return () => clearInterval(id);
    }, [location.pathname, viewAsBid]);

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
        if (user.role === 'superadmin' || user.role === 'superadmin_viewer') {
            // 뷰어는 백엔드에서 소담 본점(id1) 제외된 목록을 받음
            api.get('/superadmin/businesses/dropdown')
                .then(res => { if (res.data?.data) setBusinesses(res.data.data); })
                .catch(err => console.error('Failed to fetch businesses for dropdown', err));
        }
    }, [user.role]);

    useEffect(() => {
        if (user.role === 'superadmin' || user.role === 'superadmin_viewer') {
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

    const isRealSuperAdmin = user.role === 'superadmin';
    const isViewer = user.role === 'superadmin_viewer';  // 읽기전용 SuperAdmin 뷰어
    const isSuperAdmin = isRealSuperAdmin || isViewer;   // SuperAdmin 화면 표시 여부
    const isViewingBusiness = (isRealSuperAdmin || isViewer) && viewAsBid;  // 뷰어도 매장 진입 가능

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
        { icon: Truck, label: '배달앱관리', path: '/finance/delivery', color: 'text-amber-400' },
        { icon: CreditCard, label: '카드관리', path: '/finance/card-sales', color: 'text-violet-400' },
        { icon: FileText, label: '전자세금계산서', path: '/finance/tax-invoice', color: 'text-rose-400' },
        { icon: FileText, label: '전자명세서', path: '/finance/statement', color: 'text-amber-400' },
        { icon: Wallet, label: '현금영수증', path: '/finance/cashbill', color: 'text-emerald-400' },
        { icon: BookOpen, label: '홈택스 수집', path: '/finance/hometax', color: 'text-violet-400' },
        { icon: Link2, label: '외부 연동', path: '/external-integration', color: 'text-blue-400',
          alerts: extIntegrationAlerts },
        { icon: Gauge, label: '자동수집 상태', path: '/auto-collection', color: 'text-teal-400' },
    ];

    const matSubItems = [
        { icon: ShoppingCart, label: '구매요청서 작성', path: '/materials/order-form', color: 'text-teal-400' },
        { icon: ClipboardList, label: '구매요청서 관리', path: '/materials/order-manage', color: 'text-teal-400' },
        { icon: Star, label: '주거래처', path: '/materials/primary-vendors', color: 'text-yellow-400' },
        { icon: Package, label: '주거래처·품목 관리', path: '/materials/items', color: 'text-cyan-400' },
        { icon: PackageSearch, label: '재고관리', path: '/materials/inventory', color: 'text-emerald-400' },
        { icon: Receipt, label: '영수증 보관함', path: '/materials/receipts', color: 'text-rose-400' },
        { icon: ShoppingBag, label: '매입·비용관리', path: '/purchase', color: 'text-orange-400' },
        { icon: FileCheck, label: '오픈 재고 체크', path: '/inventory-check-admin', color: 'text-blue-400' },
        { icon: Building2, label: '거래처 관리', path: '/vendor-settings', color: 'text-violet-400' },
    ];

    const superAdminMenuItems = [
        { icon: Shield, label: 'SuperAdmin 대시보드', path: '/superadmin' },
        { icon: Building2, label: '매장 관리', path: '/superadmin?tab=stores' },
        { icon: FileText, label: '사용신청 관리', path: '/superadmin?tab=applications' },
        // 사용자 관리 — 읽기전용 뷰어 차단
        ...(isViewer ? [] : [{ icon: Users, label: '사용자 관리', path: '/superadmin?tab=users' }]),
        { icon: TrendingUp, label: '실시간 모니터링', path: '/superadmin?tab=monitoring' },
        { icon: CreditCard, label: '요금 정산', path: '/superadmin?tab=billing' },
        { icon: Bell, label: '공지 배포', path: '/superadmin?tab=announcements' },
        { icon: BarChart3, label: '통계/벤치마크', path: '/superadmin?tab=analytics' },
        // 작업일지 — 내부 개발로그(소담 언급 포함)라 뷰어 차단
        ...(isViewer ? [] : [{ icon: FileText, label: '작업일지', path: '/superadmin/worklog' }]),
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
    ];

    const hrSubItems = [
        { icon: Gauge, label: 'HR 대시보드', path: '/hr/dashboard', color: 'text-indigo-400' },
        { icon: UserCircle, label: '인사기록관리', path: '/employees', color: 'text-emerald-400' },
        { icon: Briefcase, label: '구인등록', path: '/hr/job-posting', color: 'text-orange-400' },
        { icon: Wallet, label: '퇴직금 지급관리', path: '/hr/retirement', color: 'text-blue-400' },
        { icon: Send, label: '팩스 전송', path: '/hr/fax', color: 'text-violet-400' },
        { icon: MessageCircle, label: '알림톡 관리', path: '/hr/notifications', color: 'text-yellow-400' },
        { icon: FileCheck, label: '연말정산 지원', path: '/yearend', color: 'text-teal-400' },
    ];

    const salesGuideSubItems = [
        { icon: Sparkles, label: '랜딩 (전체)', path: '/sales-guide', color: 'text-purple-400' },
        { icon: FileCheck, label: '인허가·신고', path: '/sales-guide/permits', color: 'text-emerald-400' },
        { icon: Truck, label: '배달·온라인', path: '/sales-guide/delivery-apps', color: 'text-amber-400' },
        { icon: CreditCard, label: '결제·POS', path: '/sales-guide/payment', color: 'text-violet-400' },
        { icon: Receipt, label: '세무·회계', path: '/sales-guide/tax', color: 'text-rose-400' },
        { icon: Users, label: '인력·노무', path: '/sales-guide/hr', color: 'text-blue-400' },
        { icon: Lightbulb, label: '운영팁', path: '/sales-guide/operations', color: 'text-yellow-400' },
    ];

    const bottomMenuItems = isSuperAdmin
        ? [
            ...(isViewingBusiness ? [
                { icon: BookOpen, label: '사용 매뉴얼', path: '/manual' },
                { icon: Settings, label: '설정', path: '/settings' },
            ] : []),
            { icon: Rocket, label: '셈하나 로드맵', path: '/roadmap' },
            { icon: Palette, label: '디자인 계획서', path: '/design-plan' },
            { icon: Brain, label: 'AI 시스템 설계', path: '/ai-system-design' },
            { icon: Rocket, label: '앱 전송관리', path: '/deploy' },
        ]
        : user.role === 'admin'
        ? [
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

    const isBoardActive = ['/board', '/open-checklist'].some(p => location.pathname.startsWith(p));
    const isHrActive = ['/employees', '/hr/retirement', '/hr/dashboard', '/hr/job-posting', '/hr/fax', '/hr/notifications', '/yearend'].some(p => location.pathname === p || (p !== '/employees' && location.pathname.startsWith(p)));
    const isPLActive = ['/finance/profitloss', '/revenue', '/finance/card-sales', '/finance/delivery', '/finance/bank-sync', '/finance/tax-invoice', '/finance/statement', '/finance/hometax', '/finance/cashbill', '/external-integration'].some(p => location.pathname.startsWith(p));
    const isMatActive = ['/materials', '/purchase', '/purchase-requests', '/inventory-check-admin', '/vendor-settings'].some(p => location.pathname.startsWith(p));
    const isProductActive = productSubItems.some(item => location.pathname === item.path);
    const isSalesGuideActive = location.pathname.startsWith('/sales-guide');

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
                                : location.pathname === sub.path || location.pathname.startsWith(sub.path + '/');
                            return (
                                <Link
                                    key={sub.path}
                                    to={sub.path}
                                    className={`sidebar-sub-item ${isSubActive ? 'active' : ''} ${sub.nested ? 'ml-5 border-l border-slate-700/60 pl-3' : ''}`}
                                >
                                    <SubIcon size={14} className={isSubActive ? 'text-white' : sub.color} />
                                    <span className="flex-1">{sub.label}</span>
                                    {sub.alerts > 0 && (
                                        <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-semibold rounded-full bg-red-500 text-white">
                                            {sub.alerts}
                                        </span>
                                    )}
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

                {/* Section: Sales Guide (영업관리) */}
                {(user.role === 'admin' || isViewingBusiness) && (
                    <>
                        {renderSubmenu(
                            (
                                <span className="inline-flex items-center gap-2">
                                    영업관리
                                    {salesGuideAlerts > 0 && (
                                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-semibold rounded-full bg-red-500 text-white">
                                            {salesGuideAlerts}
                                        </span>
                                    )}
                                </span>
                            ),
                            Sparkles,
                            salesGuideOpen,
                            setSalesGuideOpen,
                            isSalesGuideActive,
                            salesGuideSubItems,
                            'text-purple-400'
                        )}
                    </>
                )}

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
                        {renderSubmenu(
                            (
                                <span className="inline-flex items-center gap-2">
                                    손익관리
                                    {extIntegrationAlerts > 0 && (
                                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-semibold rounded-full bg-red-500 text-white">
                                            {extIntegrationAlerts}
                                        </span>
                                    )}
                                </span>
                            ),
                            PieChart, plOpen, setPlOpen, isPLActive, plSubItems, 'emerald'
                        )}
                        {renderSubmenu('자재관리', Boxes, matOpen, setMatOpen, isMatActive, matSubItems, 'teal')}
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

                {/* 앱 미리보기 링크 — 폰 화면(모바일)에서는 무의미하므로 데스크톱에서만 표시 */}
                {isSuperAdmin && !isViewingBusiness && (
                    <div className="hidden md:block">
                        <Link
                            to="/admin-app-preview"
                            className={`sidebar-menu-item ${location.pathname === '/admin-app-preview' ? 'active-super' : ''}`}
                        >
                            <Shield size={16} />
                            <span>수퍼관리자앱</span>
                            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#FBBF24' }}>SUPER</span>
                        </Link>
                    </div>
                )}

                {(user.role === 'admin' || isViewingBusiness) && (
                    <div className="hidden md:block space-y-0.5">
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
                    </div>
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
