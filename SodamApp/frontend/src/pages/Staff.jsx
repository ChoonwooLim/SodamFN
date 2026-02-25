import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, UserPlus, ChevronRight, UserMinus, UserCheck, SortAsc, Filter, Trash2 } from 'lucide-react';
import api from '../api';
import StaffAddModal from '../components/StaffAddModal';

export default function StaffPage() {
    const navigate = useNavigate();
    const [staffs, setStaffs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("재직"); // '재직', '퇴사', 'all'
    const [sortBy, setBySort] = useState("name"); // 'name', 'start_date', 'wage'
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    useEffect(() => {
        fetchStaff();
    }, [statusFilter]); // Refetch when filter changes

    const fetchStaff = async (query = "") => {
        try {
            setLoading(true);
            let url = '/hr/staff';
            const params = new URLSearchParams();

            if (query) params.append('q', query);
            if (statusFilter !== 'all') params.append('status', statusFilter);

            if (params.toString()) url += `?${params.toString()}`;

            const response = await api.get(url);
            if (response.data.status === 'success') {
                setStaffs(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching staff:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchStaff(searchTerm);
    };

    const handleStatusUpdate = async (e, staffId, currentStatus) => {
        e.stopPropagation(); // Prevent navigation to detail page

        const newStatus = currentStatus === '재직' ? '퇴사' : '재직';
        const confirmMsg = newStatus === '퇴사'
            ? "해당 직원을 퇴직 처리하시겠습니까?"
            : "해당 직원을 다시 재직 상태로 변경하시겠습니까?";

        if (!window.confirm(confirmMsg)) return;

        try {
            const response = await api.put(`/hr/staff/${staffId}`, { status: newStatus });
            if (response.data.status === 'success') {
                // Refresh list
                fetchStaff(searchTerm);
            }
        } catch (error) {
            console.error("Error updating status:", error);
            alert("상태 변경에 실패했습니다.");
        }
    };

    const handleDeleteStaff = async (e, staffId, staffName) => {
        e.stopPropagation();

        if (!window.confirm(`${staffName} 직원의 모든 데이터(급여, 근태, 서류)가 영구 삭제됩니다. 정말 삭제하시겠습니까?`)) return;
        if (!window.confirm("정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;

        try {
            const response = await api.delete(`/hr/staff/${staffId}`);
            if (response.data.status === 'success') {
                alert("삭제되었습니다.");
                fetchStaff(searchTerm);
            }
        } catch (error) {
            console.error("Error deleting staff:", error);
            alert("삭제에 실패했습니다.");
        }
    };

    const getSortedStaffs = () => {
        return [...staffs].sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name, 'ko');
            } else if (sortBy === 'start_date') {
                return new Date(b.start_date) - new Date(a.start_date); // Newest first
            } else if (sortBy === 'wage') {
                return b.hourly_wage - a.hourly_wage; // Highest first
            }
            return 0;
        });
    };

    const sortedStaffs = getSortedStaffs();

    return (
        <div className="min-h-screen bg-slate-50 p-6 pb-24">
            <div className="max-w-5xl mx-auto">
                <header className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/dashboard')} className="p-2 bg-white rounded-full shadow-sm text-slate-600">
                            <ChevronLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-slate-900">직원 관리</h1>
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95"
                    >
                        <UserPlus size={18} /> 신규 직원 추가
                    </button>
                </header>

                <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-start md:items-center">
                    {/* Status Tabs & Sort */}
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <div className="bg-slate-200 p-1 rounded-xl inline-flex self-start">
                            <button
                                onClick={() => setStatusFilter("재직")}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === '재직' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                재직 직원
                            </button>
                            <button
                                onClick={() => setStatusFilter("퇴사")}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === '퇴사' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                퇴사 직원
                            </button>
                        </div>

                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <Filter size={16} className="text-slate-400" />
                            <select
                                value={sortBy}
                                onChange={(e) => setBySort(e.target.value)}
                                className="text-sm font-medium text-slate-600 outline-none bg-transparent"
                            >
                                <option value="name">이름순</option>
                                <option value="start_date">입사일순</option>
                                <option value="wage">시급 높은순</option>
                            </select>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <form onSubmit={handleSearch} className="flex gap-2 w-full md:max-w-xs lg:max-w-md">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="이름 검색..."
                            className="flex-1 p-2 px-4 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button type="submit" className="bg-slate-900 text-white px-5 rounded-xl font-medium">검색</button>
                    </form>
                </div>

                {loading ? (
                    <div className="text-center py-10">로딩 중...</div>
                ) : (
                    <div className="space-y-4">
                        {sortedStaffs.length === 0 && (
                            <div className="bg-white p-8 rounded-2xl text-center text-slate-500 shadow-sm">
                                {searchTerm ? "검색 결과가 없습니다." : "등록된 직원이 없습니다."}
                            </div>
                        )}

                        {sortedStaffs.map((staff) => (
                            <div
                                key={staff.id}
                                onClick={() => navigate(`/staff/${staff.id}`)}
                                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow group"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">{staff.name}</div>
                                        {staff.status === '퇴사' ? (
                                            <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-bold">퇴사</span>
                                        ) : (
                                            <span className="bg-emerald-100 text-emerald-600 text-xs px-2 py-0.5 rounded-full font-bold">재직</span>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-500 mt-1">{staff.role} | 시급 {staff.hourly_wage.toLocaleString()}원</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {staff.status === '재직' ? (
                                        <button
                                            onClick={(e) => handleStatusUpdate(e, staff.id, staff.status)}
                                            className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors border border-red-100"
                                        >
                                            <UserMinus size={14} /> 퇴직 처리
                                        </button>
                                    ) : (
                                        <button
                                            onClick={(e) => handleStatusUpdate(e, staff.id, staff.status)}
                                            className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-100"
                                        >
                                            <UserCheck size={14} /> 재직 처리
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => handleDeleteStaff(e, staff.id, staff.name)}
                                        className="flex items-center gap-1 bg-white text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors border border-red-100"
                                        title="직원 정보 삭제"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <button className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-sm font-medium">
                                        <ChevronRight size={20} className="text-slate-400" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <StaffAddModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={fetchStaff}
            />
        </div>
    );
}
