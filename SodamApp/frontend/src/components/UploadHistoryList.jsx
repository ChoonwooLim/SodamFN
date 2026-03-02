import { useState, useEffect } from 'react';
import { RotateCcw, FileText, CheckCircle2, Trash2, Calendar } from 'lucide-react';
import api from '../api';
import './UploadHistoryList.css';

export default function UploadHistoryList({ type, onRollback }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rollbacking, setRollbacking] = useState(null);

    useEffect(() => {
        fetchHistory();
    }, [type]);

    const fetchHistory = async () => {
        try {
            const response = await api.get(`/uploads/history?type=${type}`);
            if (Array.isArray(response.data)) {
                setHistory(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch history:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRollback = async (upload) => {
        if (!window.confirm(`"${upload.filename}" 업로드를 취소하시겠습니까?\n이 파일로 생성된 ${upload.record_count}건의 데이터가 삭제됩니다.`)) return;

        setRollbacking(upload.id);
        try {
            const response = await api.delete(`/uploads/${upload.id}`);
            if (response.data.status === 'success') {
                alert(`✅ ${response.data.message}`);
                fetchHistory();
                onRollback?.();
            } else {
                alert('취소 실패: ' + response.data.message);
            }
        } catch (error) {
            console.error("Rollback error:", error);
            alert('취소 중 오류: ' + (error.response?.data?.detail || error.message));
        } finally {
            setRollbacking(null);
        }
    };

    if (loading) {
        return (
            <div className="history-loading">
                <div className="spinner-small" style={{ width: 16, height: 16, border: '2px solid #e2e8f0', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                불러오는 중...
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="history-empty">
                <FileText size={48} />
                <p>업로드 기록이 없습니다</p>
            </div>
        );
    }

    return (
        <div className="upload-history-list">
            {history.map(item => {
                const isActive = item.status === 'active';
                const isRolling = rollbacking === item.id;
                return (
                    <div key={item.id} className={`history-item ${!isActive ? 'rolled-back' : ''}`}>
                        <div className={`history-icon ${isActive ? 'active' : 'cancelled'}`}>
                            {isActive
                                ? <CheckCircle2 size={20} />
                                : <Trash2 size={18} />
                            }
                        </div>
                        <div className="history-info">
                            <div className="history-filename" title={item.filename}>
                                {item.filename}
                            </div>
                            <div className="history-meta">
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Calendar size={12} />
                                    {new Date(item.created_at).toLocaleString('ko-KR', {
                                        year: 'numeric', month: '2-digit', day: '2-digit',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                                <span className="history-count">{item.record_count}건</span>
                            </div>
                        </div>
                        <div className="history-actions">
                            {isActive ? (
                                <button
                                    className="rollback-btn"
                                    onClick={() => handleRollback(item)}
                                    disabled={isRolling}
                                    title="업로드 취소 (데이터 삭제)"
                                >
                                    {isRolling ? (
                                        <>
                                            <span className="spinner-small" />
                                            취소 중
                                        </>
                                    ) : (
                                        <>
                                            <RotateCcw size={14} />
                                            취소
                                        </>
                                    )}
                                </button>
                            ) : (
                                <span className="history-status-badge cancelled">
                                    <Trash2 size={12} /> 취소됨
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
