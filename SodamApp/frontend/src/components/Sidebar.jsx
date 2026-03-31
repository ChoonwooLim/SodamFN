import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import api from '../api';
import { LayoutDashboard, Receipt, Settings, Users, UserCircle, LogOut, ShoppingBag, FileSignature, CreditCard, BarChart3, BookOpen, Menu, X, Smartphone, Home, ClipboardList, Rocket, Monitor, ChevronDown, ChevronUp, Package, Shield, Building2, FileText, Bell, TrendingUp, Wallet, ArrowLeftRight, Truck, PieChart } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Sidebar() {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [boardOpen, setBoardOpen] = useState(false);
    const [hrOpen, setHrOpen] = useState(false);
    const [plOpen, setPlOpen] = useState(false);
    const [businessName, setBusinessName] = useState('셈하나');
    const [logoUrl, setLogoUrl] = useState(null);
    // SuperAdmin view-as state
    const [businesses, setBusinesses] = useState([]);
    const [viewAsBid, setViewAsBid] = useState(localStorage.getItem('view_as_business_id') || '');

    // Close drawer on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    // Auto-expand board/hr submenus
    useEffect(() => {
        const boardPaths = ['/board', '/open-checklist', '/inventory-check-admin'];
        if (boardPaths.some(p => location.pathname.startsWith(p))) {
            setBoardOpen(true);
        }
        const hrPaths = ['/staff', '/hr/retirement', '/retirement-calc', '/hr/payroll-ledger'];
        if (hrPaths.some(p => location.pathname.startsWith(p))) {
            setHrOpen(true);
        }
        const plPaths = ['/finance/profitloss', '/revenue', '/purchase', '/finance/card-sales'];
        if (plPaths.some(p => location.pathname.startsWith(p))) {
            setPlOpen(true);
        }
    }, [location.pathname]);

    // Get user info from localStorage
    const token = localStorage.getItem('token');
    let user = { role: 'admin', real_name: '관리자', grade: 'admin', profile_image: null };

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            user = {
                role: payload.role,
                real_name: payload.real_name || payload.sub,
                grade: payload.grade || 'normal',
                profile_image: payload.profile_image,
                business_id: payload.business_id
            };
        } catch (e) {
            console.error("Failed to decode token", e);
        }
    }

    // Fetch businesses for SuperAdmin dropdown
    useEffect(() => {
        if (user.role === 'superadmin') {
            api.get('/superadmin/businesses/dropdown')
                .then(res => {
                    if (res.data?.data) setBusinesses(res.data.data);
                })
                .catch(err => console.error('Failed to fetch businesses for dropdown', err));
        }
    }, [user.role]);

    // Fetch dynamic business name on mount
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

    // Handle business switch for SuperAdmin
    const handleViewAsChange = (newBid) => {
        if (newBid) {
            localStorage.setItem('view_as_business_id', newBid);
            localStorage.setItem('business_id', newBid);
        } else {
            localStorage.removeItem('view_as_business_id');
            localStorage.removeItem('business_id');
        }
        setViewAsBid(newBid);
        // Navigate to appropriate page based on selection
        window.location.href = newBid ? '/dashboard' : '/superadmin';
    };

    const isSuperAdmin = user.role === 'superadmin';
    const isViewingBusiness = isSuperAdmin && viewAsBid;

    // Admin menu items (shared between admin and superadmin-viewing-business)
    const adminMenuItems = [
        { icon: LayoutDashboard, label: '대시보드', path: '/dashboard' },
        { icon: BookOpen, label: '레시피 관리', path: '/recipes' },
    ];

    const plSubItems = [
        { icon: Receipt, label: '손익계산서', path: '/finance/profitloss', color: 'text-emerald-400' },
        { icon: BarChart3, label: '매출관리', path: '/revenue', color: 'text-blue-400' },
        { icon: ShoppingBag, label: '매입관리', path: '/purchase', color: 'text-orange-400' },
        { icon: Truck, label: '배달앱관리', path: '/revenue?view=delivery', color: 'text-amber-400' },
        { icon: CreditCard, label: '카드관리', path: '/finance/card-sales', color: 'text-violet-400' },
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
        { icon: UserCircle, label: '인사기록관리', path: '/staff', color: 'text-emerald-400' },
        { icon: Wallet, label: '급여대장', path: '/hr/payroll-ledger', color: 'text-amber-400' },
        { icon: Wallet, label: '퇴직금 지급관리', path: '/hr/retirement', color: 'text-blue-400' },
        { icon: FileText, label: '퇴직금 산출', path: '/retirement-calc', color: 'text-indigo-400' },
    ];

    const bottomMenuItems = isSuperAdmin
        ? [
            ...(isViewingBusiness ? [
                { icon: Settings, label: '거래처 관리', path: '/vendor-settings' },
                { icon: Settings, label: '설정', path: '/settings' },
            ] : []),
            { icon: Rocket, label: '셈하나 로드맵', path: '/roadmap' },
            { icon: Rocket, label: '앱 전송관리', path: '/deploy' },
        ]
        : user.role === 'admin'
        ? [
            { icon: Settings, label: '거래처 관리', path: '/vendor-settings' },
            { icon: BookOpen, label: '사용 매뉴얼', path: '/manual' },
            { icon: Settings, label: '설정', path: '/settings' },
            { icon: Rocket, label: '셈하나 로드맵', path: '/roadmap' },
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
    const isHrActive = ['/staff', '/hr/retirement', '/retirement-calc', '/hr/payroll-ledger'].some(p => location.pathname === p || (p !== '/staff' && location.pathname.startsWith(p)));
    const isPLActive = ['/finance/profitloss', '/revenue', '/purchase', '/finance/card-sales'].some(p => location.pathname.startsWith(p));

    const renderMenuItem = (item) => {
        const Icon = item.icon;
        const fullPath = item.path;
        const isActive = fullPath.includes('?')
            ? location.pathname + location.search === fullPath
            : location.pathname === fullPath;
        const activeColor = isSuperAdmin
            ? 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20'
            : 'bg-blue-600 text-white shadow-lg shadow-blue-900/20';
        return (
            <Link
                key={fullPath}
                to={fullPath}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                    ? activeColor
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
            >
                <Icon size={20} />
                <span className="font-medium text-sm">{item.label}</span>
            </Link>
        );
    };

    const sidebarContent = (
        <>
            <div className="p-6 border-b border-slate-800/50">
                <div className="flex items-center gap-3 mb-4">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Store Logo" className="w-16 h-16 rounded-full object-cover" />
                    ) : user.profile_image ? (
                        <img src={user.profile_image} alt="Profile" className="w-10 h-10 rounded-full border border-slate-700 object-cover" />
                    ) : (
                        <div className={`w-10 h-10 rounded-full ${isSuperAdmin ? 'bg-amber-500' : 'bg-blue-600'} flex items-center justify-center font-bold text-white shadow-lg ${isSuperAdmin ? 'shadow-amber-500/20' : 'shadow-blue-500/20'}`}>
                            {user.real_name?.[0] || 'U'}
                        </div>
                    )}
                    <div>
                        <h2 className="text-xl font-bold text-white leading-tight">{user.real_name}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded ${isSuperAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'} font-bold uppercase tracking-wider`}>
                                {isSuperAdmin ? 'SUPER' : user.grade}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                                {user.role === 'superadmin' ? '플랫폼 총괄' : user.role === 'admin' ? '관리자' : '직원'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* SuperAdmin 사업장 view-as 표시 (전환은 대시보드 매장관리에서) */}
                {isViewingBusiness && (
                    <div className="mt-3 mb-2">
                        <div className="flex items-center gap-1 text-[10px] text-amber-400">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            현재 {businesses.find(b => String(b.id) === String(viewAsBid))?.name || ''} 관리자 뷰
                        </div>
                    </div>
                )}

                <div className="mt-3 -mx-2 mb-2">
                    <div className={`${isViewingBusiness ? 'bg-[#1a2636] border-t border-[#2a3a4d] border-b-4 border-b-[#0f1923]' : 'bg-[#202c27] border-t border-[#33423b] border-b-4 border-b-[#141b18]'} rounded-xl shadow-lg shadow-black/40 overflow-hidden transform transition-all`}>
                        <h1 className="text-xl font-black tracking-tight flex flex-nowrap items-center justify-center py-2.5 px-3 whitespace-nowrap break-keep">
                            <span className={`${isViewingBusiness ? 'text-amber-400' : 'text-orange-500'} drop-shadow-sm whitespace-nowrap break-keep shrink-0`}>{businessName}</span>
                            <span className="text-slate-600 font-light mx-2 shrink-0">|</span>
                            <span className="text-white">셈</span><span className="text-blue-500">하나</span>
                        </h1>
                    </div>
                </div>
            </div>
            <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
                {/* SuperAdmin: show platform menu link when viewing a business */}
                {isViewingBusiness && (
                    <button
                        onClick={() => handleViewAsChange('')}
                        className="flex items-center gap-3 px-4 py-2 mb-2 rounded-xl text-amber-400 hover:bg-amber-500/10 transition-all text-xs font-medium w-full"
                    >
                        <Shield size={16} />
                        <span>← SuperAdmin 대시보드</span>
                    </button>
                )}
                {mainMenuItems.map(renderMenuItem)}

                {/* ═══ 손익관리 (접이식 서브메뉴) ═══ */}
                {(user.role === 'admin' || isViewingBusiness) && (
                    <div className="mb-0.5">
                        <button
                            onClick={() => setPlOpen(!plOpen)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isPLActive
                                ? 'bg-emerald-600/20 text-emerald-300'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <PieChart size={20} />
                            <span className="font-medium text-sm flex-1 text-left">손익관리</span>
                            {plOpen
                                ? <ChevronUp size={16} className="text-slate-500" />
                                : <ChevronDown size={16} className="text-slate-500" />
                            }
                        </button>
                        {plOpen && (
                            <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-700 pl-3">
                                {plSubItems.map(sub => {
                                    const SubIcon = sub.icon;
                                    const isSubActive = sub.path.includes('?')
                                        ? (location.pathname + location.search) === sub.path
                                        : location.pathname === sub.path || location.pathname.startsWith(sub.path);
                                    return (
                                        <Link
                                            key={sub.path}
                                            to={sub.path}
                                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-sm ${isSubActive
                                                ? 'bg-slate-800 text-white font-semibold'
                                                : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
                                                }`}
                                        >
                                            <SubIcon size={16} className={isSubActive ? 'text-white' : sub.color} />
                                            <span>{sub.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ 직원 관리 (접이식 서브메뉴) ═══ */}
                {(user.role === 'admin' || isViewingBusiness) && (
                    <div className="mb-0.5">
                        <button
                            onClick={() => setHrOpen(!hrOpen)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isHrActive
                                ? 'bg-indigo-600/20 text-indigo-300'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <Users size={20} />
                            <span className="font-medium text-sm flex-1 text-left">직원관리</span>
                            {hrOpen
                                ? <ChevronUp size={16} className="text-slate-500" />
                                : <ChevronDown size={16} className="text-slate-500" />
                            }
                        </button>
                        {hrOpen && (
                            <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-700 pl-3">
                                {hrSubItems.map(sub => {
                                    const SubIcon = sub.icon;
                                    const isSubActive = location.pathname.startsWith(sub.path);
                                    return (
                                        <Link
                                            key={sub.path}
                                            to={sub.path}
                                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-sm ${isSubActive
                                                ? 'bg-slate-800 text-white font-semibold'
                                                : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
                                                }`}
                                        >
                                            <SubIcon size={16} className={isSubActive ? 'text-white' : sub.color} />
                                            <span>{sub.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                
                {/* ═══ 통합게시판관리 (접이식 서브메뉴) ═══ */}
                {(user.role === 'admin' || isViewingBusiness) && (
                    <div>
                        <button
                            onClick={() => setBoardOpen(!boardOpen)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isBoardActive
                                ? 'bg-blue-600/20 text-blue-300'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <ClipboardList size={20} />
                            <span className="font-medium text-sm flex-1 text-left">통합게시판관리</span>
                            {boardOpen
                                ? <ChevronUp size={16} className="text-slate-500" />
                                : <ChevronDown size={16} className="text-slate-500" />
                            }
                        </button>
                        {boardOpen && (
                            <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-700 pl-3">
                                {boardSubItems.map(sub => {
                                    const SubIcon = sub.icon;
                                    const isSubActive = location.pathname === sub.path;
                                    return (
                                        <Link
                                            key={sub.path}
                                            to={sub.path}
                                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-sm ${isSubActive
                                                ? 'bg-slate-800 text-white font-semibold'
                                                : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
                                                }`}
                                        >
                                            <SubIcon size={16} className={isSubActive ? 'text-white' : sub.color} />
                                            <span>{sub.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {bottomMenuItems.map(renderMenuItem)}
            </nav>

            <div className="p-4 border-t border-slate-800">
                {/* SuperAdmin 전체보기 모드: 수퍼관리자앱만 표시 */}
                {isSuperAdmin && !isViewingBusiness && (
                    <Link
                        to="/admin-app-preview"
                        className={`flex items-center gap-3 w-full px-4 py-3 mb-2 rounded-xl transition-all ${location.pathname === '/admin-app-preview' ? 'bg-amber-500/20 text-amber-300' : 'text-amber-400 hover:bg-amber-500/10'}`}
                    >
                        <Shield size={20} />
                        <span className="font-medium text-sm">수퍼관리자앱</span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">SUPER</span>
                    </Link>
                )}
                {/* 사업장 선택 시 또는 일반 admin: 직원용/관리자 앱 표시 */}
                {(user.role === 'admin' || isViewingBusiness) && (
                    <>
                        <Link
                            to="/staff-app-preview"
                            className={`flex items-center gap-3 w-full px-4 py-3 mb-2 rounded-xl transition-all ${location.pathname === '/staff-app-preview' ? 'bg-emerald-500/20 text-emerald-300' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                        >
                            <Smartphone size={20} />
                            <span className="font-medium text-sm">직원용 앱</span>
                            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">PWA</span>
                        </Link>
                        <Link
                            to="/admin-app-preview"
                            className={`flex items-center gap-3 w-full px-4 py-3 mb-2 rounded-xl transition-all ${location.pathname === '/admin-app-preview' ? 'bg-violet-500/20 text-violet-300' : 'text-violet-400 hover:bg-violet-500/10'}`}
                        >
                            <Monitor size={20} />
                            <span className="font-medium text-sm">관리자 앱</span>
                            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-medium">모니터</span>
                        </Link>
                    </>
                )}
                <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 w-full px-4 py-3 mb-2 rounded-xl text-slate-400 hover:bg-slate-800 transition-all group"
                >
                    <Home size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                    <span className="font-bold text-base tracking-tight flex items-center">
                        <span className="text-white">셈</span><span className="text-blue-500">하나</span>
                        <span className="text-slate-600 font-light mx-1.5">|</span>
                        <span className="text-slate-300">SEM</span><span className="text-blue-500">HANA</span>
                    </span>
                </a>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-white transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium text-sm">로그아웃</span>
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Desktop Sidebar — always visible */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-900 min-h-screen text-white fixed left-0 top-0 z-50">
                {sidebarContent}
            </aside>

            {/* Mobile Hamburger Button */}
            <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden fixed top-3 left-3 z-[60] w-10 h-10 rounded-xl bg-slate-900/90 backdrop-blur-sm text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                aria-label="메뉴 열기"
            >
                <Menu size={20} />
            </button>

            {/* Mobile Drawer Overlay */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
                    onClick={() => setMobileOpen(false)}
                    style={{ animation: 'fadeIn 0.2s ease' }}
                />
            )}

            {/* Mobile Drawer */}
            <aside
                className={`md:hidden fixed top-0 left-0 z-[80] w-72 h-full bg-slate-900 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Close Button */}
                <button
                    onClick={() => setMobileOpen(false)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                    aria-label="메뉴 닫기"
                >
                    <X size={16} />
                </button>

                {sidebarContent}
            </aside>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </>
    );
}
