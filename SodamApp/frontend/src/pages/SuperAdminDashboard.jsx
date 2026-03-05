import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Building2, Users, CreditCard, Bell, BarChart3,
    Plus, Edit2, Trash2, Eye, TrendingUp, TrendingDown,
    Globe, Shield, Settings, RefreshCw, Search, Filter,
    FileText, CheckCircle2, XCircle, Clock3, UserPlus
} from 'lucide-react';
import api from '../api';

const TABS = [
    { key: 'stores', label: '매장 관리', icon: Building2 },
    { key: 'applications', label: '사용신청', icon: FileText },
    { key: 'monitoring', label: '실시간 모니터링', icon: TrendingUp },
    { key: 'billing', label: '요금 정산', icon: CreditCard },
    { key: 'users', label: '사용자 관리', icon: Users },
    { key: 'announcements', label: '공지 배포', icon: Bell },
    { key: 'analytics', label: '통계/벤치마크', icon: BarChart3 },
];

const BUSINESS_TYPES = ['음식점', '카페', '소매', '서비스업', '기타'];
const REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

export default function SuperAdminDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('stores');
    const [loading, setLoading] = useState(false);

    // Stores
    const [businesses, setBusinesses] = useState([]);
    const [showStoreModal, setShowStoreModal] = useState(false);
    const [storeForm, setStoreForm] = useState({ name: '', business_type: '음식점', owner_name: '', phone: '', address: '', region: '', business_number: '' });

    // Monitoring
    const [monitoringData, setMonitoringData] = useState(null);

    // Billing
    const [billingData, setBillingData] = useState(null);

    // Users
    const [users, setUsers] = useState([]);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({ username: '', real_name: '', email: '' });
    const [newPassword, setNewPassword] = useState('');

    // Announcements
    const [announcements, setAnnouncements] = useState([]);
    const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', pinned: false });

    // Analytics
    const [analyticsData, setAnalyticsData] = useState(null);

    // Plans
    const [plans, setPlans] = useState([]);

    // Applications (사용신청)
    const [applications, setApplications] = useState([]);
    const [approvalModal, setApprovalModal] = useState(null);
    const [approvalForm, setApprovalForm] = useState({ admin_username: '', admin_password: '', admin_note: '' });
    const [rejectionModal, setRejectionModal] = useState(null);
    const [rejectionNote, setRejectionNote] = useState('');

    const fetchData = useCallback(async (tab) => {
        setLoading(true);
        try {
            switch (tab) {
                case 'stores': {
                    const [bizRes, planRes] = await Promise.all([
                        api.get('/superadmin/businesses'),
                        api.get('/superadmin/plans'),
                    ]);
                    setBusinesses(bizRes.data.data || []);
                    setPlans(planRes.data.data || []);
                    break;
                }
                case 'monitoring': {
                    const res = await api.get('/superadmin/monitoring');
                    setMonitoringData(res.data.data);
                    break;
                }
                case 'billing': {
                    const res = await api.get('/superadmin/billing');
                    setBillingData(res.data.data);
                    break;
                }
                case 'users': {
                    const res = await api.get('/superadmin/users');
                    setUsers(res.data.data || []);
                    break;
                }
                case 'announcements': {
                    const res = await api.get('/superadmin/announcements');
                    setAnnouncements(res.data.data || []);
                    break;
                }
                case 'analytics': {
                    const res = await api.get('/superadmin/analytics');
                    setAnalyticsData(res.data.data);
                    break;
                }
                case 'applications': {
                    const res = await api.get('/superadmin/store-applications');
                    setApplications(res.data.data || []);
                    break;
                }
            }
        } catch (err) {
            console.error('SuperAdmin fetch error:', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(activeTab); }, [activeTab, fetchData]);

    const handleCreateBusiness = async () => {
        try {
            await api.post('/superadmin/businesses', storeForm);
            setShowStoreModal(false);
            setStoreForm({ name: '', business_type: '음식점', owner_name: '', phone: '', address: '', region: '', business_number: '' });
            fetchData('stores');
        } catch (err) {
            alert(err.response?.data?.detail || '매장 등록 오류');
        }
    };

    const handleDeactivateBusiness = async (id, name) => {
        if (!window.confirm(`'${name}' 매장을 해지하시겠습니까?`)) return;
        try {
            await api.delete(`/superadmin/businesses/${id}`);
            fetchData('stores');
        } catch (err) {
            alert('해지 오류');
        }
    };

    const handleCreateAnnouncement = async () => {
        try {
            await api.post('/superadmin/announcements/global', announcementForm);
            setAnnouncementForm({ title: '', content: '', pinned: false });
            fetchData('announcements');
        } catch (err) {
            alert('공지 생성 오류');
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            await api.put(`/superadmin/users/${userId}/role`, { role: newRole });
            fetchData('users');
        } catch (err) {
            alert(err.response?.data?.detail || '권한 변경 오류');
        }
    };

    const handleEditUser = (u) => {
        setEditingUser(u);
        setEditForm({ username: u.username, real_name: u.real_name || '', email: u.email || '' });
        setNewPassword('');
    };

    const handleSaveUser = async () => {
        try {
            await api.put(`/superadmin/users/${editingUser.id}`, editForm);
            if (newPassword.trim()) {
                await api.put(`/superadmin/users/${editingUser.id}/password`, { new_password: newPassword });
            }
            setEditingUser(null);
            fetchData('users');
            alert('저장되었습니다.');
        } catch (err) {
            alert(err.response?.data?.detail || '저장 오류');
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(`'${username}' 계정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;
        try {
            await api.delete(`/superadmin/users/${userId}`);
            fetchData('users');
        } catch (err) {
            alert(err.response?.data?.detail || '삭제 오류');
        }
    };

    const fmt = (n) => (n || 0).toLocaleString();

    const handleApproveApplication = async () => {
        if (!approvalForm.admin_username || !approvalForm.admin_password) {
            alert('Admin 아이디와 비밀번호를 입력해 주세요.');
            return;
        }
        try {
            await api.post(`/superadmin/store-applications/${approvalModal.id}/approve`, approvalForm);
            setApprovalModal(null);
            setApprovalForm({ admin_username: '', admin_password: '', admin_note: '' });
            fetchData('applications');
            alert('사용신청이 승인되었습니다.');
        } catch (err) {
            alert(err.response?.data?.detail || '승인 오류');
        }
    };

    const handleRejectApplication = async () => {
        try {
            await api.post(`/superadmin/store-applications/${rejectionModal.id}/reject`, { admin_note: rejectionNote });
            setRejectionModal(null);
            setRejectionNote('');
            fetchData('applications');
            alert('사용신청이 거절되었습니다.');
        } catch (err) {
            alert(err.response?.data?.detail || '거절 오류');
        }
    };

    const pendingCount = applications.filter(a => a.status === 'pending').length;

    // ==========================================
    // RENDER
    // ==========================================
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-6 pb-24">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                            <ChevronLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
                                <Shield className="text-amber-400" size={28} />
                                SuperAdmin Dashboard
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">멀티테넌트 플랫폼 관리 센터</p>
                        </div>
                    </div>
                    <button onClick={() => fetchData(activeTab)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20" title="새로고침">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </header>

                {/* Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const showBadge = tab.key === 'applications' && pendingCount > 0;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all relative ${activeTab === tab.key
                                    ? 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/30'
                                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                                {showBadge && (
                                    <span className={`absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full ${activeTab === tab.key ? 'bg-red-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {pendingCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw size={32} className="animate-spin text-amber-400" />
                    </div>
                ) : (
                    <>
                        {/* =========== 1. STORES =========== */}
                        {activeTab === 'stores' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold">전체 매장 ({businesses.length})</h2>
                                    <button onClick={() => setShowStoreModal(true)} className="flex items-center gap-2 bg-amber-500 text-slate-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-400 shadow-lg">
                                        <Plus size={16} /> 매장 등록
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {businesses.map(biz => (
                                        <div key={biz.id} className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-amber-500/30 transition-all">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h3 className="font-bold text-lg">{biz.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{biz.business_type}</span>
                                                        {biz.region && <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{biz.region}</span>}
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${biz.subscription_status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {biz.subscription_status === 'active' ? '활성' : '해지'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                                                <div className="bg-white/5 rounded-lg px-3 py-2">
                                                    <span className="text-slate-400">대표</span>
                                                    <div className="font-bold">{biz.owner_name || '-'}</div>
                                                </div>
                                                <div className="bg-white/5 rounded-lg px-3 py-2">
                                                    <span className="text-slate-400">직원</span>
                                                    <div className="font-bold">{biz.staff_count}명</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button className="flex-1 py-1.5 bg-white/10 rounded-lg text-xs font-bold hover:bg-white/20"><Eye size={12} className="inline mr-1" />상세</button>
                                                {biz.subscription_status === 'active' && (
                                                    <button onClick={() => handleDeactivateBusiness(biz.id, biz.name)} className="py-1.5 px-3 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30"><Trash2 size={12} /></button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Store Create Modal */}
                                {showStoreModal && (
                                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                        <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
                                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Building2 size={20} className="text-amber-400" /> 신규 매장 등록</h3>
                                            <div className="space-y-3">
                                                <input value={storeForm.name} onChange={e => setStoreForm(p => ({ ...p, name: e.target.value }))} placeholder="매장명" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500" />
                                                <div className="grid grid-cols-2 gap-3">
                                                    <select value={storeForm.business_type} onChange={e => setStoreForm(p => ({ ...p, business_type: e.target.value }))} className="p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none">
                                                        {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                    <select value={storeForm.region} onChange={e => setStoreForm(p => ({ ...p, region: e.target.value }))} className="p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none">
                                                        <option value="">지역 선택</option>
                                                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                </div>
                                                <input value={storeForm.owner_name} onChange={e => setStoreForm(p => ({ ...p, owner_name: e.target.value }))} placeholder="대표자명" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none" />
                                                <input value={storeForm.phone} onChange={e => setStoreForm(p => ({ ...p, phone: e.target.value }))} placeholder="연락처" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none" />
                                                <input value={storeForm.business_number} onChange={e => setStoreForm(p => ({ ...p, business_number: e.target.value }))} placeholder="사업자등록번호" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none" />
                                            </div>
                                            <div className="flex gap-3 mt-6">
                                                <button onClick={() => setShowStoreModal(false)} className="flex-1 py-2.5 bg-white/10 rounded-xl font-bold hover:bg-white/20">취소</button>
                                                <button onClick={handleCreateBusiness} className="flex-1 py-2.5 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400 shadow-lg">등록</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* =========== 2. MONITORING =========== */}
                        {activeTab === 'monitoring' && monitoringData && (
                            <div className="space-y-6">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: '등록 매장', value: monitoringData.summary.total_businesses, icon: Building2, color: 'amber' },
                                        { label: '총 매출', value: `${fmt(monitoringData.summary.total_revenue)}원`, icon: TrendingUp, color: 'emerald' },
                                        { label: '총 인건비', value: `${fmt(monitoringData.summary.total_labor_cost)}원`, icon: Users, color: 'rose' },
                                        { label: '총 이익', value: `${fmt(monitoringData.summary.total_profit)}원`, icon: BarChart3, color: 'blue' },
                                    ].map((card, i) => {
                                        const Icon = card.icon;
                                        return (
                                            <div key={i} className={`bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10`}>
                                                <Icon size={20} className={`text-${card.color}-400 mb-2`} />
                                                <div className="text-xs text-slate-400">{card.label}</div>
                                                <div className="text-xl font-black mt-1">{card.value}</div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Business List */}
                                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                                    <div className="p-4 border-b border-white/10">
                                        <h3 className="font-bold">매장별 현황 ({monitoringData.summary.total_businesses}개)</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-slate-400 border-b border-white/5">
                                                    <th className="text-left p-3">매장</th>
                                                    <th className="text-left p-3">업종</th>
                                                    <th className="text-right p-3">직원</th>
                                                    <th className="text-right p-3">매출</th>
                                                    <th className="text-right p-3">인건비</th>
                                                    <th className="text-right p-3">이익</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(monitoringData.businesses || []).map(biz => (
                                                    <tr key={biz.business_id} className="border-b border-white/5 hover:bg-white/5">
                                                        <td className="p-3 font-bold">{biz.name}</td>
                                                        <td className="p-3 text-slate-400">{biz.business_type}</td>
                                                        <td className="p-3 text-right">{biz.staff_count}</td>
                                                        <td className="p-3 text-right text-emerald-400 font-mono">{fmt(biz.revenue)}</td>
                                                        <td className="p-3 text-right text-rose-400 font-mono">{fmt(biz.labor_cost)}</td>
                                                        <td className={`p-3 text-right font-bold font-mono ${biz.profit >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(biz.profit)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* =========== 3. BILLING =========== */}
                        {activeTab === 'billing' && billingData && (
                            <div className="space-y-6">
                                <div className="bg-gradient-to-r from-amber-500/20 to-amber-600/10 rounded-2xl p-6 border border-amber-500/20">
                                    <div className="text-sm text-amber-300">이번 달 총 이용료</div>
                                    <div className="text-3xl font-black text-amber-400 mt-1">{fmt(billingData.total_billing)}원</div>
                                </div>
                                <div className="space-y-3">
                                    {(billingData.businesses || []).map(biz => (
                                        <div key={biz.business_id} className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between">
                                            <div>
                                                <div className="font-bold">{biz.name}</div>
                                                <div className="text-xs text-slate-400">{biz.plan_name} • {biz.subscription_status === 'active' ? '활성' : '해지'}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-amber-400">{fmt(biz.monthly_fee)}원</div>
                                                <div className="text-[10px] text-slate-500">월 이용료</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <div className="space-y-4">
                                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                                    <div className="p-4 border-b border-white/10">
                                        <h3 className="font-bold">전체 사용자 ({users.length})</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-slate-400 border-b border-white/5">
                                                    <th className="text-left p-3">ID</th>
                                                    <th className="text-left p-3">아이디</th>
                                                    <th className="text-left p-3">이름</th>
                                                    <th className="text-center p-3">권한</th>
                                                    <th className="text-center p-3">매장</th>
                                                    <th className="text-center p-3">관리</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {users.map(u => (
                                                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                                                        <td className="p-3 text-slate-400">{u.id}</td>
                                                        <td className="p-3 font-bold">{u.username}</td>
                                                        <td className="p-3">{u.real_name || '-'}</td>
                                                        <td className="p-3 text-center">
                                                            <select
                                                                value={u.role}
                                                                onChange={e => handleRoleChange(u.id, e.target.value)}
                                                                className={`text-xs font-bold px-2 py-1 rounded-lg bg-transparent border outline-none cursor-pointer ${u.role === 'superadmin' ? 'border-amber-500 text-amber-400' :
                                                                    u.role === 'admin' ? 'border-blue-500 text-blue-400' :
                                                                        'border-slate-500 text-slate-400'
                                                                    }`}
                                                            >
                                                                <option value="superadmin">SuperAdmin</option>
                                                                <option value="admin">Admin</option>
                                                                <option value="staff">Staff</option>
                                                                <option value="guest">Guest</option>
                                                            </select>
                                                        </td>
                                                        <td className="p-3 text-center text-slate-400">{u.business_id || '-'}</td>
                                                        <td className="p-3 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button onClick={() => handleEditUser(u)} className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30" title="수정">
                                                                    <Edit2 size={13} />
                                                                </button>
                                                                <button onClick={() => handleDeleteUser(u.id, u.username)} className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30" title="삭제">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* User Edit Modal */}
                                {editingUser && (
                                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                        <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
                                            <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
                                                <Edit2 size={18} className="text-amber-400" />
                                                사용자 수정 <span className="text-slate-400 text-sm font-normal">#{editingUser.id}</span>
                                            </h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-1">아이디</label>
                                                    <input value={editForm.username} onChange={e => setEditForm(p => ({ ...p, username: e.target.value }))} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-amber-500" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-1">이름</label>
                                                    <input value={editForm.real_name} onChange={e => setEditForm(p => ({ ...p, real_name: e.target.value }))} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-amber-500" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-1">이메일</label>
                                                    <input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} placeholder="(선택)" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500" />
                                                </div>
                                                <div className="border-t border-white/10 pt-3 mt-2">
                                                    <label className="text-xs text-slate-400 block mb-1">새 비밀번호 <span className="text-slate-600">(변경 시에만 입력)</span></label>
                                                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="변경하지 않으면 비워두세요" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500" />
                                                </div>
                                            </div>
                                            <div className="flex gap-3 mt-6">
                                                <button onClick={() => setEditingUser(null)} className="flex-1 py-2.5 bg-white/10 rounded-xl font-bold hover:bg-white/20">취소</button>
                                                <button onClick={handleSaveUser} className="flex-1 py-2.5 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400 shadow-lg">저장</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* =========== 5. ANNOUNCEMENTS =========== */}
                        {activeTab === 'announcements' && (
                            <div className="space-y-6">
                                <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                                    <h3 className="font-bold mb-3 flex items-center gap-2"><Bell size={16} className="text-amber-400" /> 전체 매장 공지 배포</h3>
                                    <input value={announcementForm.title} onChange={e => setAnnouncementForm(p => ({ ...p, title: e.target.value }))} placeholder="제목" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl mb-3 text-white placeholder:text-slate-500 outline-none" />
                                    <textarea value={announcementForm.content} onChange={e => setAnnouncementForm(p => ({ ...p, content: e.target.value }))} placeholder="내용" rows={3} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl mb-3 text-white placeholder:text-slate-500 outline-none resize-none" />
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input type="checkbox" checked={announcementForm.pinned} onChange={e => setAnnouncementForm(p => ({ ...p, pinned: e.target.checked }))} className="w-4 h-4 rounded" />
                                            상단 고정
                                        </label>
                                        <button onClick={handleCreateAnnouncement} className="px-4 py-2 bg-amber-500 text-slate-900 rounded-xl text-sm font-bold hover:bg-amber-400">전체 배포</button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {announcements.map(a => (
                                        <div key={a.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="font-bold flex items-center gap-2">
                                                    {a.pinned && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">고정</span>}
                                                    {a.title}
                                                </div>
                                                <div className="text-[10px] text-slate-500">{a.created_at?.split('T')[0]}</div>
                                            </div>
                                            <p className="text-sm text-slate-400">{a.content}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* =========== 6. ANALYTICS =========== */}
                        {activeTab === 'analytics' && analyticsData && (
                            <div className="space-y-6">
                                <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                                    <h3 className="font-bold mb-4">업종별 벤치마크</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries(analyticsData.by_business_type || {}).map(([type, stats]) => (
                                            <div key={type} className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                <div className="text-sm font-bold text-amber-400 mb-2">{type}</div>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between"><span className="text-slate-400">매장 수</span><span>{stats.count}</span></div>
                                                    <div className="flex justify-between"><span className="text-slate-400">총 매출</span><span className="font-mono">{fmt(stats.total_revenue)}</span></div>
                                                    <div className="flex justify-between"><span className="text-slate-400">평균 매출</span><span className="font-mono text-emerald-400">{fmt(stats.avg_revenue)}</span></div>
                                                    <div className="flex justify-between"><span className="text-slate-400">평균 직원</span><span>{stats.avg_staff}</span></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                                    <h3 className="font-bold mb-4">지역별 현황</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {Object.entries(analyticsData.by_region || {}).map(([region, stats]) => (
                                            <div key={region} className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
                                                <div className="text-sm font-bold">{region}</div>
                                                <div className="text-xs text-slate-400 mt-1">{stats.count}개 매장</div>
                                                <div className="text-sm font-bold text-emerald-400 mt-1">{fmt(stats.avg_revenue)}원</div>
                                                <div className="text-[10px] text-slate-500">평균 매출</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* =========== 7. APPLICATIONS (사용신청 관리) =========== */}
                        {activeTab === 'applications' && (
                            <div className="space-y-4">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <FileText size={20} className="text-amber-400" />
                                    사용신청 관리 ({applications.length})
                                    {pendingCount > 0 && (
                                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                                            대기 {pendingCount}건
                                        </span>
                                    )}
                                </h2>

                                {applications.length === 0 ? (
                                    <div className="text-center py-16 text-slate-400">
                                        <FileText size={40} className="mx-auto mb-3 opacity-30" />
                                        <p>아직 사용신청이 없습니다.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {applications.map(app => {
                                            const isPending = app.status === 'pending';
                                            const isApproved = app.status === 'approved';
                                            return (
                                                <div key={app.id} className={`bg-white/5 rounded-2xl p-5 border transition-all ${isPending ? 'border-amber-500/30 hover:border-amber-500/50' :
                                                    isApproved ? 'border-emerald-500/20' : 'border-red-500/20'
                                                    }`}>
                                                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                                                <span className="font-bold text-lg">{app.business_name}</span>
                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isPending ? 'bg-amber-500/20 text-amber-400' :
                                                                    isApproved ? 'bg-emerald-500/20 text-emerald-400' :
                                                                        'bg-red-500/20 text-red-400'
                                                                    }`}>
                                                                    {isPending ? '검토 대기' : isApproved ? '승인 완료' : '거절'}
                                                                </span>
                                                                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">
                                                                    {app.plan_type === 'free' ? '무료' : app.plan_type === 'basic' ? 'Basic' : 'Premium'}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-400">
                                                                <div>대표: <span className="text-white">{app.owner_name}</span></div>
                                                                <div>연락처: <span className="text-white">{app.phone}</span></div>
                                                                <div>업종: <span className="text-white">{app.business_type}</span></div>
                                                                <div>지역: <span className="text-white">{app.region || '-'}</span></div>
                                                                <div>예상 직원: <span className="text-white">{app.staff_count}명</span></div>
                                                                <div>사업자번호: <span className="text-white">{app.business_number || '-'}</span></div>
                                                            </div>
                                                            {app.message && (
                                                                <div className="mt-2 text-sm bg-white/5 rounded-lg px-3 py-2 text-slate-300">
                                                                    💬 {app.message}
                                                                </div>
                                                            )}
                                                            <div className="mt-2 text-xs text-slate-500">
                                                                신청자: {app.applicant_name || app.applicant_username} {app.applicant_email ? `(${app.applicant_email})` : ''} · {app.created_at ? new Date(app.created_at).toLocaleString('ko-KR') : ''}
                                                            </div>
                                                            {isApproved && app.assigned_username && (
                                                                <div className="mt-2 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
                                                                    ✅ Admin ID: <strong>{app.assigned_username}</strong>
                                                                </div>
                                                            )}
                                                            {app.admin_note && (
                                                                <div className="mt-2 text-sm text-slate-300 bg-white/5 rounded-lg px-3 py-2">
                                                                    📝 관리자 메모: {app.admin_note}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {isPending && (
                                                            <div className="flex gap-2 sm:flex-col">
                                                                <button
                                                                    onClick={() => {
                                                                        setApprovalModal(app);
                                                                        setApprovalForm({ admin_username: '', admin_password: '', admin_note: '' });
                                                                    }}
                                                                    className="flex items-center gap-1 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all"
                                                                >
                                                                    <CheckCircle2 size={14} /> 승인
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setRejectionModal(app);
                                                                        setRejectionNote('');
                                                                    }}
                                                                    className="flex items-center gap-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm font-bold hover:bg-red-500/30 transition-all"
                                                                >
                                                                    <XCircle size={14} /> 거절
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Approval Modal */}
                                {approvalModal && (
                                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                        <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
                                            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                                                <CheckCircle2 size={20} className="text-emerald-400" /> 사용신청 승인
                                            </h3>
                                            <p className="text-sm text-slate-400 mb-5">{approvalModal.business_name} · {approvalModal.owner_name}</p>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-1">Admin 아이디 *</label>
                                                    <input
                                                        value={approvalForm.admin_username}
                                                        onChange={e => setApprovalForm(p => ({ ...p, admin_username: e.target.value }))}
                                                        className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-emerald-500"
                                                        placeholder="매장 관리자 아이디 (예: sodam005)"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-1">Admin 비밀번호 *</label>
                                                    <input
                                                        type="password"
                                                        value={approvalForm.admin_password}
                                                        onChange={e => setApprovalForm(p => ({ ...p, admin_password: e.target.value }))}
                                                        className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-emerald-500"
                                                        placeholder="초기 비밀번호"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-1">관리자 메모 (선택)</label>
                                                    <textarea
                                                        value={approvalForm.admin_note}
                                                        onChange={e => setApprovalForm(p => ({ ...p, admin_note: e.target.value }))}
                                                        rows={2}
                                                        className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none resize-none focus:ring-2 focus:ring-emerald-500"
                                                        placeholder="승인 시 참고 메모"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-3 mt-6">
                                                <button onClick={() => setApprovalModal(null)} className="flex-1 py-2.5 bg-white/10 rounded-xl font-bold hover:bg-white/20">취소</button>
                                                <button onClick={handleApproveApplication} className="flex-1 py-2.5 bg-emerald-500 text-slate-900 rounded-xl font-bold hover:bg-emerald-400 shadow-lg flex items-center justify-center gap-2">
                                                    <UserPlus size={16} /> 승인 및 계정 생성
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Rejection Modal */}
                                {rejectionModal && (
                                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                        <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
                                            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                                                <XCircle size={20} className="text-red-400" /> 사용신청 거절
                                            </h3>
                                            <p className="text-sm text-slate-400 mb-5">{rejectionModal.business_name} · {rejectionModal.owner_name}</p>
                                            <div>
                                                <label className="text-xs text-slate-400 block mb-1">거절 사유</label>
                                                <textarea
                                                    value={rejectionNote}
                                                    onChange={e => setRejectionNote(e.target.value)}
                                                    rows={3}
                                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none resize-none focus:ring-2 focus:ring-red-500"
                                                    placeholder="거절 사유를 입력해 주세요"
                                                />
                                            </div>
                                            <div className="flex gap-3 mt-6">
                                                <button onClick={() => setRejectionModal(null)} className="flex-1 py-2.5 bg-white/10 rounded-xl font-bold hover:bg-white/20">취소</button>
                                                <button onClick={handleRejectApplication} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-400 shadow-lg">거절</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
