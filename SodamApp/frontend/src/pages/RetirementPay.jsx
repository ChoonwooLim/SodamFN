import { useState, useEffect } from 'react';
import { Wallet, UserMinus, Calendar, AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { formatNumber, formatCurrency } from '../utils/format';

export default function RetirementPay() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(null); // staff data for modal
    const [form, setForm] = useState({
        end_date: '', paid_amount: '', payment_date: '', note: ''
    });
    const [msg, setMsg] = useState('');
    const navigate = useNavigate();

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/hr/retirement');
            setData(res.data.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const openModal = (item) => {
        setShowModal(item);
        setForm({
            end_date: item.end_date || '',
            paid_amount: item.paid_amount || '',
            payment_date: item.payment_date || '',
            note: item.note || '',
        });
    };

    const handleSave = async () => {
        try {
            if (showModal.payment_id) {
                // Update
                await api.put(`/hr/retirement/${showModal.payment_id}`, {
                    paid_amount: parseInt(form.paid_amount) || 0,
                    payment_date: form.payment_date || null,
                    note: form.note || null,
                    status: form.payment_date ? '지급완료' : '대기',
                });
            } else {
                // Create
                await api.post('/hr/retirement', {
                    staff_id: showModal.staff_id,
                    end_date: form.end_date,
                    paid_amount: parseInt(form.paid_amount) || 0,
                    payment_date: form.payment_date || null,
                    note: form.note || null,
                });
            }
            setMsg('저장 완료!');
            setShowModal(null);
            fetchData();
            setTimeout(() => setMsg(''), 3000);
        } catch (e) {
            alert(e.response?.data?.detail || '저장 실패');
        }
    };

    const fmtTenure = (days) => days >= 365
        ? `${Math.floor(days / 365)}년 ${Math.floor((days % 365) / 30)}개월`
        : `${days}일`;

    const statusBadge = (status) => {
        const colors = {
            '지급완료': { bg: '#dcfce7', color: '#16a34a' },
            '환입완료': { bg: '#dbeafe', color: '#2563eb' },
            '대기': { bg: '#fef3c7', color: '#d97706' },
            '미등록': { bg: '#fee2e2', color: '#dc2626' },
        };
        const c = colors[status] || colors['미등록'];
        return (
            <span style={{
                display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                background: c.bg, color: c.color, fontWeight: 800, fontSize: 11,
            }}>
                {status === '지급완료' && <CheckCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />}
                {status === '대기' && <Clock size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />}
                {status === '미등록' && <AlertCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />}
                {status}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-32 space-y-6">
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Wallet size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">퇴직금 관리</h1>
                        <p className="text-xs text-slate-400 mt-0.5">퇴사자 퇴직금 적립 현황 및 지급 기록</p>
                    </div>
                </div>
            </header>

            {msg && (
                <div className="bg-green-100 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-bold">
                    <CheckCircle size={16} /> {msg}
                </div>
            )}

            {loading ? (
                <div className="text-center py-16 text-slate-400">로딩중...</div>
            ) : data.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <UserMinus size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold">퇴사자가 없습니다</p>
                </div>
            ) : (
                <>
                {/* 모바일: 카드 리스트 (테이블 압축 깨짐 방지) */}
                <div className="sm:hidden space-y-3">
                    {data.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 card-animate" style={{ animationDelay: `${idx * 0.05}s` }}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="text-base font-extrabold text-slate-900">
                                    {item.staff_name}
                                    {item.under_one_year && (
                                        <span className="ml-2 text-[11px] text-amber-600 font-semibold">⚠️ 1년 미만</span>
                                    )}
                                </div>
                                {statusBadge(item.status)}
                            </div>
                            <div className="text-xs text-slate-500 mb-3">
                                {item.start_date} ~ {item.end_date || '퇴사일 미등록'} · 근속 {fmtTenure(item.work_days)}
                            </div>
                            <div className="grid grid-cols-3 gap-1 bg-slate-50 rounded-xl py-2.5 px-2 mb-3 text-center">
                                <div>
                                    <div className="text-[11px] text-slate-400 font-semibold mb-0.5">적립액</div>
                                    <div className="text-[13px] font-bold text-slate-700 tabular-nums">
                                        {item.under_one_year
                                            ? <span className="text-amber-600">환입 대상</span>
                                            : item.accrued_amount > 0 ? formatCurrency(item.accrued_amount) : '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-slate-400 font-semibold mb-0.5">지급액</div>
                                    <div className={`text-[13px] font-bold tabular-nums ${item.paid_amount > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                        {item.paid_amount > 0 ? formatCurrency(item.paid_amount) : '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-slate-400 font-semibold mb-0.5">차액</div>
                                    <div className={`text-[13px] font-bold tabular-nums ${item.difference > 0 ? 'text-red-600' : item.difference < 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                        {item.difference !== 0 ? `${item.difference > 0 ? '+' : ''}${formatNumber(item.difference)}원` : '-'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate(`/retirement-calc/${item.staff_id}`)}
                                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-bold bg-slate-100 text-slate-600 border border-slate-200 active:scale-95 transition-transform"
                                >
                                    <FileText size={15} /> 명세서
                                </button>
                                <button
                                    onClick={() => openModal(item)}
                                    className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white active:scale-95 transition-transform ${item.status === '미등록' ? 'bg-violet-600' : 'bg-blue-500'}`}
                                >
                                    {item.status === '미등록' ? '퇴직금 등록' : '수정'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {/* 모바일 합계 카드 */}
                    <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-300">적립 합계</span>
                        <span className="text-base font-extrabold tabular-nums">
                            {formatCurrency(data.reduce((a, c) => a + c.accrued_amount, 0))}
                        </span>
                    </div>
                </div>

                {/* 데스크톱: 테이블 */}
                <div className="hidden sm:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden card-animate">
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                    <th style={{ textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 700 }}>직원명</th>
                                    <th style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontWeight: 700 }}>입사일</th>
                                    <th style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontWeight: 700 }}>퇴사일</th>
                                    <th style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontWeight: 700 }}>근속일수</th>
                                    <th style={{ textAlign: 'right', padding: '12px', color: '#64748b', fontWeight: 700 }}>적립액</th>
                                    <th style={{ textAlign: 'right', padding: '12px', color: '#64748b', fontWeight: 700 }}>지급액</th>
                                    <th style={{ textAlign: 'right', padding: '12px', color: '#64748b', fontWeight: 700 }}>차액</th>
                                    <th style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontWeight: 700 }}>상태</th>
                                    <th style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontWeight: 700 }}>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '12px', fontWeight: 700, color: '#1e293b' }}>
                                            {item.staff_name}
                                            {item.under_one_year && (
                                                <span style={{ display: 'block', fontSize: 10, color: '#d97706', fontWeight: 600 }}>⚠️ 1년 미만</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>{item.start_date}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>{item.end_date || '-'}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: '#334155' }}>
                                            {fmtTenure(item.work_days)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: '#334155', fontWeight: 600 }}>
                                            {item.under_one_year ? (
                                                <span style={{ color: '#d97706' }}>환입 대상<br/><span style={{fontSize:11}}>({formatCurrency(item.pl_accrued||0)})</span></span>
                                            ) : item.accrued_amount > 0 ? formatCurrency(item.accrued_amount) : '-'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: item.paid_amount > 0 ? '#16a34a' : '#94a3b8', fontWeight: 700 }}>
                                            {item.paid_amount > 0 ? formatCurrency(item.paid_amount) : '-'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: item.difference > 0 ? '#dc2626' : item.difference < 0 ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                                            {item.difference !== 0 ? `${item.difference > 0 ? '+' : ''}${formatNumber(item.difference)}원` : '-'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>{statusBadge(item.status)}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => navigate(`/retirement-calc/${item.staff_id}`)}
                                                    title="퇴직금 산정 명세서 (PDF)"
                                                    style={{
                                                        padding: '4px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                                                        background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                >
                                                    <FileText size={14} />
                                                </button>
                                                <button
                                                    onClick={() => openModal(item)}
                                                    style={{
                                                        padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                                                        background: item.status === '미등록' ? '#7c3aed' : '#3b82f6',
                                                        color: 'white', border: 'none', cursor: 'pointer',
                                                    }}
                                                >
                                                    {item.status === '미등록' ? '등록' : '수정'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                    <td colSpan={4} style={{ padding: '12px', fontWeight: 800, color: '#1e293b' }}>합계</td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>
                                        {formatCurrency(data.reduce((a, c) => a + c.accrued_amount, 0))}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                                        {formatCurrency(data.reduce((a, c) => a + c.paid_amount, 0))}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800 }}>
                                        {formatCurrency(data.reduce((a, c) => a + c.difference, 0))}
                                    </td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                </>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
                }}
                    onClick={() => setShowModal(null)}>
                    <div style={{
                        background: 'white', borderRadius: 20, padding: 'clamp(20px, 5vw, 32px)', width: '92%', maxWidth: 480,
                        maxHeight: '90vh', overflowY: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                    }}
                        onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Wallet size={20} style={{ color: '#7c3aed' }} />
                            {showModal.staff_name} 퇴직금 {showModal.status === '미등록' ? '등록' : '수정'}
                        </h3>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 12px', background: '#f1f5f9', borderRadius: 12, marginBottom: 16, fontSize: 13 }}>
                            <span style={{ color: '#64748b' }}>입사일: <b style={{ color: '#1e293b' }}>{showModal.start_date}</b></span>
                            <span style={{ color: '#64748b' }}>|</span>
                            <span style={{ color: '#64748b' }}>근속: <b style={{ color: '#1e293b' }}>{fmtTenure(showModal.work_days)}</b></span>
                        </div>

                        {showModal.under_one_year ? (
                            <div style={{ padding: '10px 12px', background: '#fef3c7', borderRadius: 12, marginBottom: 16, fontSize: 13 }}>
                                <span style={{ color: '#d97706', fontWeight: 700 }}>⚠️ 1년 미만 근무 → 법적 퇴직금 없음</span>
                                {showModal.pl_accrued > 0 && (
                                    <div style={{ color: '#1e293b', fontSize: 12, marginTop: 4 }}>
                                        P/L 적립액: <b>{formatCurrency(showModal.pl_accrued)}</b> → 등록 시 <b style={{color:'#2563eb'}}>자동 환입</b> 처리
                                    </div>
                                )}
                                <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>실제 지급하는 경우 아래에 금액을 입력하세요 (선택)</div>
                            </div>
                        ) : showModal.accrued_amount > 0 && (
                            <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 16 }}>
                                <div style={{ color: '#16a34a', fontWeight: 800, fontSize: 14, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                                    <span>💰 법적 퇴직금</span>
                                    <span>{formatCurrency(showModal.accrued_amount)}</span>
                                </div>
                                {showModal.breakdown && (
                                    <div style={{ fontSize: 11, color: '#475569', background: '#fff', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span>최근 3개월 급여총액:</span>
                                            <b>{formatNumber(showModal.breakdown.total_gross_3m)} 원</b>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span>정산 기준 일수 (3개월):</span>
                                            <b>{showModal.breakdown.exact_days_3m}일</b>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span>1일 평균임금:</span>
                                            <b style={{color: '#7c3aed'}}>{formatNumber(showModal.breakdown.daily_wage)} 원</b>
                                        </div>
                                        <div style={{ borderTop: '1px dashed #cbd5e1', margin: '6px 0' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>산정식:</span>
                                            <span>{formatNumber(showModal.breakdown.daily_wage)} × 30일 × ({showModal.work_days}일 / 365)</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'grid', gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>퇴사일</label>
                                <input type="date" value={form.end_date}
                                    onChange={e => setForm({ ...form, end_date: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, marginTop: 4 }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>실제 지급액 (원)</label>
                                <input type="number" value={form.paid_amount}
                                    onChange={e => setForm({ ...form, paid_amount: e.target.value })}
                                    placeholder="0"
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, marginTop: 4 }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>지급일</label>
                                <input type="date" value={form.payment_date}
                                    onChange={e => setForm({ ...form, payment_date: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, marginTop: 4 }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>비고</label>
                                <input type="text" value={form.note}
                                    onChange={e => setForm({ ...form, note: e.target.value })}
                                    placeholder="메모"
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, marginTop: 4 }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                            <button onClick={() => setShowModal(null)}
                                style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                                취소
                            </button>
                            <button onClick={handleSave}
                                style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: '#7c3aed', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </div>
    );
}
