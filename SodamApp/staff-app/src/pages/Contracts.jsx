import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { FileText, CheckCircle, Clock, ChevronRight, FileSignature } from 'lucide-react';

export default function Contracts() {
    const navigate = useNavigate();
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('pending'); // pending | signed

    useEffect(() => {
        const fetchContracts = async () => {
            try {
                const res = await api.get('/contracts/my');
                if (res.data.status === 'success') {
                    setContracts(res.data.data);
                }
            } catch (err) {
                console.error('Error fetching contracts:', err);
                if (err.response?.status === 401) navigate('/login');
            } finally {
                setLoading(false);
            }
        };
        fetchContracts();
    }, [navigate]);

    const pending = contracts.filter(c => c.status !== 'signed');
    const signed = contracts.filter(c => c.status === 'signed');
    const shown = tab === 'pending' ? pending : signed;

    if (loading) return <div className="page-loading"><div className="spinner" /><span className="text-muted text-sm">로딩 중...</span></div>;

    return (
        <div className="page animate-fade">
            <div className="page-header">
                <h1 className="page-title">전자계약</h1>
                {pending.length > 0 && (
                    <span className="badge badge-danger">{pending.length}건 대기</span>
                )}
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
                    서명 대기 ({pending.length})
                </button>
                <button className={`tab ${tab === 'signed' ? 'active' : ''}`} onClick={() => setTab('signed')}>
                    완료 ({signed.length})
                </button>
            </div>

            {/* Contract List */}
            {shown.length === 0 ? (
                <div className="empty-state">
                    <FileSignature size={48} className="empty-state-icon" />
                    <span className="empty-state-text">
                        {tab === 'pending' ? '대기 중인 계약서가 없습니다' : '완료된 계약서가 없습니다'}
                    </span>
                </div>
            ) : (
                shown.map(contract => (
                    <div
                        key={contract.id}
                        className="contract-card"
                        onClick={() => navigate(`/contracts/${contract.id}/sign`)}
                    >
                        <div
                            className="contract-icon"
                            style={{
                                background: contract.status === 'signed' ? '#d1fae5' : '#dbeafe',
                                color: contract.status === 'signed' ? '#059669' : '#3b82f6',
                            }}
                        >
                            <FileText size={24} />
                        </div>
                        <div className="contract-info">
                            <div className="contract-title">{contract.title}</div>
                            <div className="contract-meta">
                                {contract.status === 'signed' ? (
                                    <span style={{ color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <CheckCircle size={12} /> 서명 완료
                                    </span>
                                ) : (
                                    <span style={{ color: '#3b82f6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} /> 서명 대기
                                    </span>
                                )}
                                <span>|</span>
                                <span>{new Date(contract.created_at).toLocaleDateString('ko-KR')}</span>
                            </div>
                        </div>
                        <ChevronRight size={18} color="var(--text-muted)" />
                    </div>
                ))
            )}
        </div>
    );
}
