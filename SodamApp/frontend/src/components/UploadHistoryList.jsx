import { useState, useEffect } from 'react';
import { RotateCcw, FileText, CheckCircle, AlertTriangle, Trash2, Calendar } from 'lucide-react';
import api from '../api';
import './UploadHistoryList.css';

export default function UploadHistoryList({ type }) {
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
        if (!window.confirm(`"${upload.filename}" 업로드를 취소하시겠습니까?\n이 파일로 생성된 모든 데이터가 삭제됩니다.`)) return;

        setRollbacking(upload.id);
        try {
            const response = await api.delete(`/uploads/${upload.id}`);
            if (response.data.status === 'success') {
                alert(response.data.message);
                fetchHistory(); // Refresh list
            } else {
                alert('취소 실패: ' + response.data.message);
            }
        } catch (error) {
            console.error("Rollback error:", error);
            alert('취소 중 오류가 발생했습니다: ' + (error.response?.data?.detail || error.message));
        } finally {
            setRollbacking(null);
        }
    };

    if (loading) return <div className="p-4 text-center text-slate-400">불러오는 중...</div>;

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-slate-500">
                <FileText size={48} className="mb-2 opacity-20" />
                <p>업로드 기록이 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="upload-history-list w-full max-w-md mx-auto">
            {history.map(item => (
                <div key={item.id} className={`history-item ${item.status === 'rolled_back' ? 'opacity-50' : ''}`}>
                    <div className="history-icon">
                        {item.status === 'active' ? <CheckCircle size={20} className="text-emerald-500" /> : <Trash2 size={20} className="text-slate-500" />}
                    </div>
                    <div className="history-info">
                        <div className="history-filename" title={item.filename}>{item.filename}</div>
                        <div className="history-meta">
                            <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {new Date(item.created_at).toLocaleString()}
                            </span>
                            <span className="history-count">
                                {item.record_count}건
                            </span>
                        </div>
                    </div>
                    <div className="history-actions">
                        {item.status === 'active' && (
                            <button
                                onClick={() => handleRollback(item)}
                                disabled={rollbacking === item.id}
                                className="rollback-btn"
                                title="업로드 취소 (데이터 삭제)"
                            >
                                {rollbacking === item.id ? '...' : <RotateCcw size={16} />}
                            </button>
                        )}
                        {item.status === 'rolled_back' && (
                            <span className="text-xs text-rose-400 font-medium px-2 py-1 bg-rose-900/20 rounded">취소됨</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
