import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ChevronRight, Clock, CheckCircle, LogOut } from 'lucide-react';
import api from '../api';

export default function ContractMyPage() {
    const navigate = useNavigate();
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMyContracts();
    }, []);

    const fetchMyContracts = async () => {
        try {
            const response = await api.get('/contracts/my');
            if (response.data.status === 'success') {
                setContracts(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching my contracts:", error);
            if (error.response?.status === 401) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-md mx-auto">
                <header className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">내 전자계약</h1>
                    <button
                        onClick={handleLogout}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="로그아웃"
                    >
                        <LogOut size={20} />
                    </button>
                </header>

                {loading ? (
                    <div className="text-center py-20 text-slate-400 font-medium">로딩 중...</div>
                ) : (
                    <div className="space-y-4">
                        {contracts.length === 0 ? (
                            <div className="bg-white p-12 rounded-3xl text-center shadow-sm border border-slate-100">
                                <FileText className="mx-auto text-slate-200 mb-4" size={48} />
                                <p className="text-slate-500 font-medium text-lg">대기 중인 계약서가 없습니다.</p>
                            </div>
                        ) : (
                            contracts.map(contract => (
                                <div
                                    key={contract.id}
                                    onClick={() => navigate(`/contracts/${contract.id}/sign`)}
                                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group cursor-pointer hover:shadow-md hover:border-blue-100 transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${contract.status === 'signed' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>
                                            <FileText size={24} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 mb-1">{contract.title}</div>
                                            <div className="flex items-center gap-1.5 text-xs">
                                                {contract.status === 'signed' ? (
                                                    <span className="text-emerald-600 flex items-center gap-1 font-bold">
                                                        <CheckCircle size={12} /> 서명 완료
                                                    </span>
                                                ) : (
                                                    <span className="text-blue-600 flex items-center gap-1 font-bold">
                                                        <Clock size={12} /> 서명 대기
                                                    </span>
                                                )}
                                                <span className="text-slate-300">|</span>
                                                <span className="text-slate-400">{new Date(contract.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-slate-300 group-hover:text-blue-500 transition-colors" size={20} />
                                </div>
                            ))
                        )}
                    </div>
                )}

                <div className="mt-8 bg-blue-50 p-6 rounded-3xl border border-blue-100">
                    <p className="text-blue-800 text-sm font-medium leading-relaxed">
                        전자서명은 법적 효력이 있으며, 관련 법령에 따라 서명 완료 후 계약서 파일을 다운로드하거나 확인할 수 있습니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
