import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, UserPlus, ChevronRight } from 'lucide-react';
import api from '../api';

export default function StaffPage() {
    const navigate = useNavigate();
    const [staffs, setStaffs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("재직"); // '재직', '퇴사', 'all'

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

    return (
        <div className="min-h-screen bg-slate-50 p-6 pb-24">
            <div className="max-w-5xl mx-auto">
                <header className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/')} className="p-2 bg-white rounded-full shadow-sm text-slate-600">
                            <ChevronLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-slate-900">직원 관리</h1>
                    </div>
                </header>

                <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between">
                    {/* Status Tabs */}
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

                    {/* Search Bar */}
                    <form onSubmit={handleSearch} className="flex gap-2 flex-1 md:max-w-md">
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
                        {staffs.length === 0 && (
                            <div className="bg-white p-8 rounded-2xl text-center text-slate-500 shadow-sm">
                                {searchTerm ? "검색 결과가 없습니다." : "등록된 직원이 없습니다."}
                            </div>
                        )}

                        {staffs.map((staff) => (
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
                                <button className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-sm font-medium">
                                    <ChevronRight size={20} className="text-slate-400" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
