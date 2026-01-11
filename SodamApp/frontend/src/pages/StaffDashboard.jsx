import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Clock,
    QrCode,
    FileSignature,
    User,
    Calendar,
    LogOut,
    Coffee,
    CheckCircle2,
    X,
    Camera
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function StaffDashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [staffId, setStaffId] = useState(null);
    const [attendanceStatus, setAttendanceStatus] = useState({ checked_in: false, checked_out: false });
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scanMessage, setScanMessage] = useState("");

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // 1. Get User Info
                const token = localStorage.getItem('token');
                if (!token) {
                    navigate('/login');
                    return;
                }

                const payload = JSON.parse(atob(token.split('.')[1]));
                setUser(payload);
                setStaffId(payload.staff_id);

                if (payload.staff_id) {
                    // 2. Get Attendance Status
                    const statusRes = await axios.get(`${API_URL}/hr/attendance/status/${payload.staff_id}`);
                    setAttendanceStatus(statusRes.data.data);

                    // 3. Get History
                    const historyRes = await axios.get(`${API_URL}/hr/attendance/history/${payload.staff_id}`);
                    setHistory(historyRes.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [navigate]);

    const handleAttendance = async (action) => {
        try {
            await axios.post(`${API_URL}/hr/attendance`, {
                staff_id: staffId,
                action: action
            });

            // Refresh Status
            const statusRes = await axios.get(`${API_URL}/hr/attendance/status/${staffId}`);
            setAttendanceStatus(statusRes.data.data);

            // Refresh History
            const historyRes = await axios.get(`${API_URL}/hr/attendance/history/${staffId}`);
            setHistory(historyRes.data.data);

            alert(action === 'checkin' ? "출근 처리가 완료되었습니다." : "퇴근 처리가 완료되었습니다.");
        } catch (error) {
            console.error("Attendance Action Failed", error);
            alert("처리 중 오류가 발생했습니다.");
        }
    };

    const handleCameraScan = () => {
        // Mock Camera Logic
        setCameraOpen(true);
        setScanMessage("카메라를 불러오는 중...");

        // Simulate scanning delay
        setTimeout(() => {
            setScanMessage("QR 코드를 스캔하세요.");
        }, 1000);
    };

    const handleSimulateSuccess = () => {
        // Simulate a successful check-in via QR
        if (!attendanceStatus.checked_in) {
            handleAttendance('checkin');
        } else {
            handleAttendance('checkout');
        }
        setCameraOpen(false);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

    const today = new Date().toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">안녕하세요, {user?.real_name || '직원'}님! 👋</h1>
                        <p className="text-slate-500 mt-1">{today} | 오늘도 좋은 하루 되세요.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleCameraScan}
                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all font-medium"
                        >
                            <QrCode size={18} />
                            <span>QR 스캔</span>
                        </button>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* 1. Attendance Card */}
                    <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                        <div className="relative z-10">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                                <Clock className="text-blue-600" size={20} />
                                근태 관리
                            </h2>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => handleAttendance('checkin')}
                                    disabled={attendanceStatus.checked_in}
                                    className={`group relative flex flex-col items-center justify-center p-8 rounded-xl border-2 transition-all ${attendanceStatus.checked_in
                                            ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                                            : 'border-blue-100 bg-blue-50/30 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10'
                                        }`}
                                >
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${attendanceStatus.checked_in ? 'bg-slate-200 text-slate-400' : 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                                        }`}>
                                        <Coffee size={24} />
                                    </div>
                                    <span className="text-lg font-bold text-slate-700">출근하기</span>
                                    {attendanceStatus.checked_in && (
                                        <div className="absolute top-4 right-4 text-green-600 flex items-center gap-1 text-xs font-bold bg-green-100 px-2 py-1 rounded-full">
                                            <CheckCircle2 size={12} />
                                            완료
                                        </div>
                                    )}
                                    <span className="text-sm text-slate-400 mt-1">
                                        {attendanceStatus.check_in_time ? `Last: ${attendanceStatus.check_in_time.substring(0, 5)}` : '오늘 기록 없음'}
                                    </span>
                                </button>

                                <button
                                    onClick={() => handleAttendance('checkout')}
                                    disabled={!attendanceStatus.checked_in || attendanceStatus.checked_out}
                                    className={`group relative flex flex-col items-center justify-center p-8 rounded-xl border-2 transition-all ${!attendanceStatus.checked_in || attendanceStatus.checked_out
                                            ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                                            : 'border-orange-100 bg-orange-50/30 hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/10'
                                        }`}
                                >
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${!attendanceStatus.checked_in || attendanceStatus.checked_out ? 'bg-slate-200 text-slate-400' : 'bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'
                                        }`}>
                                        <LogOut size={24} />
                                    </div>
                                    <span className="text-lg font-bold text-slate-700">퇴근하기</span>
                                    {attendanceStatus.checked_out && (
                                        <div className="absolute top-4 right-4 text-green-600 flex items-center gap-1 text-xs font-bold bg-green-100 px-2 py-1 rounded-full">
                                            <CheckCircle2 size={12} />
                                            완료
                                        </div>
                                    )}
                                    <span className="text-sm text-slate-400 mt-1">
                                        {attendanceStatus.check_out_time ? `Last: ${attendanceStatus.check_out_time.substring(0, 5)}` : '기록 없음'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 2. Profile Summary */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                            <User className="text-purple-600" size={20} />
                            내 정보
                        </h2>
                        <div className="flex flex-col items-center py-4">
                            <div className="w-24 h-24 rounded-full bg-slate-100 mb-4 overflow-hidden border-4 border-white shadow-lg">
                                {user?.profile_image ? (
                                    <img src={user.profile_image} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-300">
                                        {user?.real_name?.[0]}
                                    </div>
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">{user?.real_name}</h3>
                            <span className="text-sm font-medium text-slate-500 mt-1 bg-slate-100 px-3 py-1 rounded-full">
                                {user?.role === 'staff' ? '일반 직원' : '관리자'}
                            </span>
                        </div>
                        <div className="space-y-4 mt-4 pt-6 border-t border-slate-100">
                            <button onClick={() => navigate('/settings')} className="w-full py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors text-left flex items-center justify-between px-2">
                                정보 수정하기
                                <span className="text-slate-400">→</span>
                            </button>
                        </div>
                    </div>

                    {/* 3. Contract Widget */}
                    <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl p-6 shadow-lg shadow-blue-500/20 text-white">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
                                    <FileSignature size={20} />
                                    전자계약
                                </h2>
                                <p className="text-blue-100 text-sm">
                                    서명 필요한 계약서 확인 및<br />지난 계약서를 조회하세요.
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                <span className="font-bold">1</span>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/contracts/my')}
                            className="w-full mt-6 py-3 bg-white text-blue-600 rounded-xl font-bold shadow-sm hover:bg-blue-50 transition-colors"
                        >
                            계약서 관리 이동
                        </button>
                    </div>

                    {/* 4. History Widget */}
                    <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                            <Calendar className="text-orange-500" size={20} />
                            최근 근무 기록
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 text-left">
                                        <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider pl-4">날짜</th>
                                        <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">출근</th>
                                        <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">퇴근</th>
                                        <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right pr-4">상태</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {history.map((record) => (
                                        <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 pl-4 text-sm font-medium text-slate-700">
                                                {new Date(record.date).toLocaleDateString('ko-KR')}
                                            </td>
                                            <td className="py-4 text-sm text-slate-600">
                                                {record.check_in ? record.check_in.substring(0, 5) : '-'}
                                            </td>
                                            <td className="py-4 text-sm text-slate-600">
                                                {record.check_out ? record.check_out.substring(0, 5) : '-'}
                                            </td>
                                            <td className="py-4 text-right pr-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${record.status === 'Normal' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {record.status === 'Normal' ? '정상' : '지각'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {history.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="py-8 text-center text-slate-400 text-sm">
                                                최근 근무 기록이 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Camera Modal Overlay */}
            {cameraOpen && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
                    <button
                        onClick={() => setCameraOpen(false)}
                        className="absolute top-6 right-6 text-white/70 hover:text-white p-2 rounded-full bg-white/10"
                    >
                        <X size={24} />
                    </button>

                    <div className="w-full max-w-sm bg-black rounded-3xl overflow-hidden border border-slate-700 relative aspect-[3/4]">
                        {/* Camera Placeholder */}
                        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center">
                            <Camera size={48} className="text-slate-600 mb-4 animate-pulse" />
                            <p className="text-slate-400 text-sm font-medium px-8 text-center leading-relaxed">
                                {scanMessage}
                            </p>

                            {/* Simulation Button */}
                            <button
                                onClick={handleSimulateSuccess}
                                className="mt-8 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm font-bold transition-all"
                            >
                                [개발용] 스캔 성공 시뮬레이션
                            </button>
                        </div>

                        {/* Scan UI Overlay */}
                        <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none">
                            <div className="w-full h-full border-2 border-white/30 rounded-lg relative">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1"></div>
                            </div>
                        </div>
                    </div>
                    <p className="text-white/50 text-sm mt-6 font-medium">QR 코드를 사각형 안에 비춰주세요</p>
                </div>
            )}
        </div>
    );
}
