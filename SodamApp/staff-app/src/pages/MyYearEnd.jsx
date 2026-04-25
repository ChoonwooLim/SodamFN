import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
    ChevronLeft, Calendar, Loader2, Download, FileText, Receipt, Shield,
    Wallet, Coins, Paperclip, FileDown,
} from 'lucide-react';

export default function MyYearEnd() {
    const navigate = useNavigate();
    const [years, setYears] = useState([]);
    const [year, setYear] = useState(null);
    const [data, setData] = useState(null);
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listLoaded, setListLoaded] = useState(false);
    const [downloadingDraft, setDownloadingDraft] = useState(false);
    const [downloadingDocId, setDownloadingDocId] = useState(null);

    // 1) Load available years on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate(`/login${window.location.search}`); return; }

        (async () => {
            try {
                const r = await api.get('/staff/yearend/years');
                const ys = Array.isArray(r.data) ? r.data : [];
                setYears(ys);
                if (ys.length > 0) setYear(ys[0].year);
                else setLoading(false);
            } catch (e) {
                console.error('연말정산 연도 조회 실패:', e);
                setLoading(false);
            } finally {
                setListLoaded(true);
            }
        })();
    }, [navigate]);

    // 2) Load selected year's report + documents
    useEffect(() => {
        if (!year) return;
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const [d, dd] = await Promise.all([
                    api.get(`/staff/yearend/${year}`),
                    api.get(`/staff/yearend/${year}/documents`),
                ]);
                if (cancelled) return;
                setData(d.data);
                setDocs(Array.isArray(dd.data) ? dd.data : []);
            } catch (e) {
                console.error('연말정산 상세 조회 실패:', e);
                if (!cancelled) { setData(null); setDocs([]); }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [year]);

    const downloadDraft = async () => {
        if (!data || downloadingDraft) return;
        setDownloadingDraft(true);
        try {
            const res = await api.get(`/staff/yearend/${year}/draft-receipt.pdf`, {
                responseType: 'blob',
            });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            const label = data.income_type === 'earned' ? '근로소득' : '사업소득';
            const staffName = data?.staff?.name || '직원';
            a.download = `${label}원천징수영수증_${year}_${staffName}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('PDF 발급 실패:', e);
            alert('PDF 발급에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setDownloadingDraft(false);
        }
    };

    const downloadDoc = async (id, filename) => {
        if (downloadingDocId) return;
        setDownloadingDocId(id);
        try {
            const res = await api.get(`/staff/yearend/${year}/documents/${id}/download`, {
                responseType: 'blob',
            });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `document_${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('문서 다운로드 실패:', e);
            alert('다운로드에 실패했습니다.');
        } finally {
            setDownloadingDocId(null);
        }
    };

    const fmt = (n) => (n == null ? '-' : `${Number(n).toLocaleString('ko-KR')}원`);

    // Empty state — no distributed yearend reports for this staff
    if (listLoaded && years.length === 0) {
        return (
            <div className="page animate-fade" style={{ paddingBottom: '100px' }}>
                <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => navigate('/')} className="btn-ghost" style={{ padding: '6px', borderRadius: '10px' }}>
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="page-title" style={{ margin: 0 }}>연말정산</h1>
                </div>
                <div className="empty-state" style={{ marginTop: '24px' }}>
                    <Receipt size={48} className="empty-state-icon" />
                    <span className="empty-state-text">아직 발행된 연말정산 자료가 없습니다</span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', lineHeight: 1.6 }}>
                        관리자가 자료를 등록하면 여기에 표시됩니다.
                    </p>
                </div>
            </div>
        );
    }

    const incomeLabel = data?.income_type === 'earned' ? '근로소득원천징수영수증' : '사업소득원천징수영수증';

    return (
        <div className="page animate-fade" style={{ paddingBottom: '120px' }}>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => navigate('/')} className="btn-ghost" style={{ padding: '6px', borderRadius: '10px' }}>
                    <ChevronLeft size={20} />
                </button>
                <h1 className="page-title" style={{ margin: 0 }}>연말정산</h1>
            </div>

            {/* Year Selector */}
            {years.length > 1 && (
                <div className="card mb-4" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Calendar size={18} color="var(--primary)" />
                    <select
                        value={year || ''}
                        onChange={(e) => setYear(parseInt(e.target.value, 10))}
                        style={{
                            flex: 1,
                            border: 'none',
                            background: 'transparent',
                            fontSize: '1rem',
                            fontWeight: 700,
                            outline: 'none',
                            cursor: 'pointer',
                            color: 'var(--text)',
                        }}
                    >
                        {years.map((y) => (
                            <option key={y.year} value={y.year}>{y.year}년</option>
                        ))}
                    </select>
                </div>
            )}

            {loading || !data ? (
                <div className="page-loading" style={{ minHeight: '200px' }}>
                    <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--primary)' }} />
                </div>
            ) : (
                <>
                    {/* Title Card */}
                    <div className="card card-gradient-dark mb-4">
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, color: 'white' }}>
                            {incomeLabel}
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: 'white' }}>
                            {data.year}년 귀속
                        </div>
                        <div style={{
                            marginTop: '12px', paddingTop: '12px',
                            borderTop: '1px solid rgba(255,255,255,0.2)',
                        }}>
                            <div style={{ fontSize: '0.9rem', color: 'white', fontWeight: 600 }}>
                                {data?.staff?.name}{' '}
                                {data?.staff?.resident_number_masked && (
                                    <span style={{ opacity: 0.85, fontWeight: 400, fontSize: '0.8rem' }}>
                                        ({data.staff.resident_number_masked})
                                    </span>
                                )}
                            </div>
                            {data?.business?.name && (
                                <div style={{ fontSize: '0.75rem', color: 'white', opacity: 0.8, marginTop: '2px' }}>
                                    {data.business.name}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary Card */}
                    <div className="card mb-4">
                        <div className="section-title mb-3" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Receipt size={16} color="var(--primary)" /> 요약
                        </div>

                        <div className="payslip-row">
                            <span className="payslip-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Wallet size={14} color="#059669" /> 총급여
                            </span>
                            <span className="payslip-value">{fmt(data.summary?.total_pay_year)}</span>
                        </div>
                        <div className="payslip-row">
                            <span className="payslip-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Coins size={14} color="#dc2626" /> 결정세액
                            </span>
                            <span className="payslip-value">{fmt(data.summary?.decided_tax)}</span>
                        </div>
                        <div className="payslip-row">
                            <span className="payslip-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Coins size={14} color="#f59e0b" /> 기납부세액
                            </span>
                            <span className="payslip-value">{fmt(data.summary?.taxes_paid)}</span>
                        </div>
                        <div className="payslip-row">
                            <span className="payslip-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Shield size={14} color="#4f46e5" /> 4대보험 합계
                            </span>
                            <span className="payslip-value">{fmt(data.summary?.insurance_4major_total)}</span>
                        </div>

                        {data.summary?.refund_amount != null && (
                            <div style={{
                                borderTop: '2px solid var(--border)',
                                marginTop: '12px', paddingTop: '12px',
                            }}>
                                <div style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '4px',
                                }}>
                                    {data.summary.refund_amount < 0 ? '✅ 환급 예상액' : '⚠️ 추가 납부 예상액'}
                                </div>
                                <div style={{
                                    fontSize: '1.6rem',
                                    fontWeight: 800,
                                    color: data.summary.refund_amount < 0 ? '#059669' : '#dc2626',
                                }}>
                                    ₩ {Math.abs(data.summary.refund_amount).toLocaleString('ko-KR')}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                                    * 실제 금액은 국세청 연말정산 결과에 따라 달라질 수 있습니다
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Attached Documents */}
                    {docs.length > 0 && (
                        <div className="card mb-4">
                            <div className="section-title mb-3" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Paperclip size={16} color="#6366f1" /> 첨부 문서
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {docs.map((d) => {
                                    const isDownloading = downloadingDocId === d.id;
                                    return (
                                        <button
                                            key={d.id}
                                            onClick={() => downloadDoc(d.id, d.filename)}
                                            disabled={isDownloading}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '8px',
                                                padding: '12px 14px',
                                                background: '#f8fafc',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '10px',
                                                cursor: isDownloading ? 'wait' : 'pointer',
                                                textAlign: 'left',
                                                width: '100%',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                                <FileText size={18} color="#6366f1" style={{ flexShrink: 0 }} />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{
                                                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {d.filename}
                                                    </div>
                                                    {d.uploaded_at && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                            {new Date(d.uploaded_at).toLocaleDateString('ko-KR')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {isDownloading
                                                ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite', color: '#6366f1' }} />
                                                : <Download size={16} color="#6366f1" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Draft PDF download */}
                    <button
                        onClick={downloadDraft}
                        disabled={downloadingDraft}
                        className="btn btn-primary"
                        style={{
                            width: '100%',
                            padding: '14px 16px',
                            fontSize: '1rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                        }}
                    >
                        {downloadingDraft
                            ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
                            : <FileDown size={18} />}
                        {downloadingDraft ? '생성 중...' : '초안 PDF 다운로드'}
                    </button>

                    <p style={{
                        fontSize: '0.7rem', color: 'var(--text-muted)',
                        marginTop: '10px', textAlign: 'center', lineHeight: 1.5,
                    }}>
                        * 이 PDF는 참고용 초안입니다. 공식 원천징수영수증은 첨부 문서를 확인해주세요.
                    </p>
                </>
            )}
        </div>
    );
}
