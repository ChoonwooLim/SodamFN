import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Shield, BarChart3, Users, CreditCard, Store, Clock, FileText,
    Smartphone, Calculator, PieChart, Receipt, LogOut, ArrowRight,
    CheckCircle2, Clock3, XCircle, Zap, Crown, Sparkles, Star
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const FEATURES_PREVIEW = [
    { icon: Calculator, title: '급여 자동계산', desc: '4대보험·소득세·주휴수당까지 자동 계산', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: BarChart3, title: '매출 통합 분석', desc: '현금·카드·배달앱 매출을 하나로', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: PieChart, title: '손익계산서', desc: '매출에서 비용까지 자동 집계', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { icon: Clock, title: 'GPS 출퇴근', desc: 'GPS 기반 출퇴근 + QR 스캔', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { icon: FileText, title: '전자 근로계약', desc: '모바일 전자서명 계약 체결', color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { icon: Smartphone, title: '직원 전용 앱', desc: '직원 출퇴근·급여·계약서 관리', color: 'text-orange-400', bg: 'bg-orange-500/10' },
];

const STATUS_MAP = {
    pending: { label: '검토 중', icon: Clock3, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    approved: { label: '승인 완료', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    rejected: { label: '거절', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

export default function GuestDashboard() {
    const navigate = useNavigate();
    const [applications, setApplications] = useState([]);

    const fetchMyApplications = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/store-applications/my`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setApplications(res.data);
        } catch (err) {
            console.error('Failed to fetch applications:', err);
        }
    };

    useEffect(() => {
        fetchMyApplications();
    }, []);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const userName = localStorage.getItem('user_role') === 'guest'
        ? (JSON.parse(atob(localStorage.getItem('token')?.split('.')[1] || 'e30='))?.real_name || '게스트')
        : '게스트';

    const hasPendingApp = applications.some(a => a.status === 'pending');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="font-black text-lg">
                        셈<span className="text-amber-400">하나</span>
                        <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Guest</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-400 hidden sm:block">{userName}님</span>
                        <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors">
                            <LogOut size={14} /> 로그아웃
                        </button>
                    </div>
                </div>
            </header>

            <main className="pt-24 pb-16 px-4 max-w-6xl mx-auto">
                {/* Welcome Section */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 px-4 py-2 rounded-full text-sm font-bold mb-6 border border-amber-500/20">
                        <Sparkles size={16} /> 셈하나에 오신 것을 환영합니다
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black mb-4">
                        매장을 등록하고 <span className="text-amber-400">바로 시작</span>하세요
                    </h1>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                        무료 또는 유료 사용을 신청하시면 관리자 검토 후 매장 관리 시스템이 활성화됩니다.
                        아래 기능들을 모두 사용할 수 있습니다.
                    </p>
                </div>

                {/* Application Status (if exists) */}
                {applications.length > 0 && (
                    <div className="mb-10">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <FileText size={18} className="text-amber-400" /> 내 사용신청 현황
                        </h2>
                        <div className="space-y-3">
                            {applications.map(app => {
                                const st = STATUS_MAP[app.status] || STATUS_MAP.pending;
                                const Icon = st.icon;
                                return (
                                    <div key={app.id} className={`bg-white/5 border ${st.border} rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4`}>
                                        <div className={`p-2.5 rounded-xl ${st.bg} self-start`}>
                                            <Icon size={20} className={st.color} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold">{app.business_name}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${st.bg} ${st.color} font-bold`}>{st.label}</span>
                                                <span className="text-xs text-slate-500">
                                                    {app.plan_type === 'free' ? '무료' : app.plan_type === 'basic' ? 'Basic' : 'Premium'}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-400 mt-1">
                                                {app.owner_name} · {app.phone}
                                            </div>
                                            {app.admin_note && (
                                                <div className="text-sm mt-2 text-slate-300 bg-white/5 rounded-lg px-3 py-2">
                                                    💬 관리자: {app.admin_note}
                                                </div>
                                            )}
                                            {app.status === 'approved' && app.assigned_username && (
                                                <div className="mt-2 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
                                                    ✅ 아이디 <strong>{app.assigned_username}</strong>가 발급되었습니다. 새 아이디로 다시 로그인해 주세요.
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 text-right whitespace-nowrap">
                                            {app.created_at ? new Date(app.created_at).toLocaleDateString('ko-KR') : ''}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* CTA Buttons */}
                {!hasPendingApp && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                        <button
                            onClick={() => navigate('/apply?plan=free')}
                            className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 rounded-2xl p-6 text-left transition-all"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2.5 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                                    <Store size={22} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">무료 사용 신청</h3>
                                    <p className="text-xs text-slate-500">직원 3명까지 · 기본 기능</p>
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 mb-3">소규모 매장의 첫 시작에 적합합니다. 급여계산, GPS 출퇴근, 직원앱을 무료로 이용하세요.</p>
                            <div className="flex items-center gap-1 text-emerald-400 text-sm font-bold group-hover:gap-2 transition-all">
                                무료 신청하기 <ArrowRight size={14} />
                            </div>
                        </button>

                        <button
                            onClick={() => navigate('/apply?plan=basic')}
                            className="group bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 hover:border-amber-500/40 rounded-2xl p-6 text-left transition-all relative overflow-hidden"
                        >
                            <div className="absolute top-3 right-3">
                                <span className="text-[10px] bg-amber-500 text-slate-900 px-2 py-0.5 rounded-full font-bold">추천</span>
                            </div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2.5 bg-amber-500/10 rounded-xl group-hover:bg-amber-500/20 transition-colors">
                                    <Crown size={22} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">유료 사용 신청</h3>
                                    <p className="text-xs text-slate-500">Basic 29,900원/월 · Premium 59,900원/월</p>
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 mb-3">매출분석, 손익계산서, 카드매출 자동분석, 다점포 관리까지 모든 기능을 이용하세요.</p>
                            <div className="flex items-center gap-1 text-amber-400 text-sm font-bold group-hover:gap-2 transition-all">
                                유료 신청하기 <ArrowRight size={14} />
                            </div>
                        </button>
                    </div>
                )}

                {/* Features Preview */}
                <div className="mb-12">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Zap size={18} className="text-amber-400" /> 셈하나 주요 기능
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {FEATURES_PREVIEW.map(f => {
                            const Icon = f.icon;
                            return (
                                <div key={f.title} className="bg-white/5 rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`p-2 rounded-xl ${f.bg}`}>
                                            <Icon size={18} className={f.color} />
                                        </div>
                                        <h3 className="font-bold">{f.title}</h3>
                                    </div>
                                    <p className="text-sm text-slate-400">{f.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Pricing Summary */}
                <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center">
                    <h2 className="text-xl font-bold mb-2">요금제 비교</h2>
                    <p className="text-sm text-slate-400 mb-6">매장 규모에 맞는 요금제를 선택하세요</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                        {[
                            { name: 'Free', price: '0원', desc: '직원 3명', features: '급여계산 · GPS출퇴근 · 직원앱' },
                            { name: 'Basic', price: '29,900원', desc: '직원 10명', features: '+ 매출분석 · 손익계산서 · 전자계약', popular: true },
                            { name: 'Premium', price: '59,900원', desc: '직원 50명', features: '+ 다점포관리 · API연동 · 전담지원' },
                        ].map(p => (
                            <div key={p.name} className={`bg-white/5 rounded-xl p-5 border ${p.popular ? 'border-amber-500/40' : 'border-white/10'}`}>
                                {p.popular && <div className="text-[10px] text-amber-400 font-bold mb-1">⭐ 가장 인기</div>}
                                <div className="font-bold text-lg">{p.name}</div>
                                <div className="text-2xl font-black text-amber-400 my-1">{p.price}</div>
                                <div className="text-xs text-slate-500 mb-2">{p.desc}</div>
                                <div className="text-xs text-slate-400">{p.features}</div>
                            </div>
                        ))}
                    </div>
                    <Link to="/" className="inline-flex items-center gap-1 text-amber-400 text-sm font-bold mt-6 hover:text-amber-300 transition-colors">
                        자세한 요금제 보기 <ArrowRight size={14} />
                    </Link>
                </div>
            </main>
        </div>
    );
}
