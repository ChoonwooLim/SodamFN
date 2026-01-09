import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, UserPlus, Clock } from 'lucide-react';
import api from '../api';

export default function StaffPage() {
    const navigate = useNavigate();
    const [staffs, setStaffs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        try {
            const response = await api.get('/hr/staff');
            if (response.data.status === 'success') {
                setStaffs(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching staff:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 pb-24">
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="p-2 bg-white rounded-full shadow-sm text-slate-600">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900">직원 관리</h1>
                </div>
                <button className="p-2 bg-blue-600 text-white rounded-full shadow-lg">
                    <UserPlus size={20} />
                </button>
            </header>

            {loading ? (
                <div className="text-center py-10">로딩 중...</div>
            ) : (
                <div className="space-y-4">
                    {staffs.length === 0 && (
                        <div className="bg-white p-8 rounded-2xl text-center text-slate-500 shadow-sm">
                            등록된 직원이 없습니다.<br />
                            우측 상단 + 버튼을 눌러 직원을 등록해주세요.
                        </div>
                    )}

                    {staffs.map((staff) => (
                        <div key={staff.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                            <div>
                                <div className="font-bold text-lg text-slate-900">{staff.name}</div>
                                <div className="text-sm text-slate-500">{staff.role} | 시급 {staff.hourly_wage.toLocaleString()}원</div>
                            </div>
                            <button className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-sm font-medium">
                                <Clock size={16} /> 근태 기록
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
