import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Truck, TrendingDown,
  BarChart3, Upload, Trash2, RefreshCw, AlertCircle,
  CheckCircle, FileSpreadsheet
} from 'lucide-react';
import api from '../api';
import { formatNumber } from '../utils/format';

const fmt = (v) => formatNumber(v || 0);
const pct = (v) => (v || 0).toFixed(1);

const CHANNELS = [
  { id: '쿠팡', label: '쿠팡이츠', icon: '🛒' },
  { id: '배민', label: '배달의민족', icon: '🏍️' },
  { id: '요기요', label: '요기요', icon: '🍜' },
  { id: '땡겨요', label: '땡겨요', icon: '📱' },
];

export default function DeliveryAppDashboard() {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState({ monthly: [], channel_totals: {} });
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/revenue/delivery-summary?year=${year}`);
      setData(res.data || { monthly: [], channel_totals: {} });
    } catch (err) {
      console.error('Delivery data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const channelTotals = useMemo(() => data.channel_totals || {}, [data.channel_totals]);
  const monthlyData = useMemo(() => {
    return [...(data.monthly || [])].sort((a, b) => a.month - b.month);
  }, [data.monthly]);

  const grandTotals = useMemo(() => {
    let sales = 0, fees = 0, settlement = 0, orders = 0;
    Object.values(channelTotals).forEach(ct => {
      sales += ct.total_sales || 0;
      fees += ct.total_fees || 0;
      settlement += ct.settlement_amount || 0;
      orders += ct.order_count || 0;
    });
    const avgFeeRate = sales > 0 ? (fees / sales * 100) : 0;
    return { sales, fees, settlement, orders, avgFeeRate };
  }, [channelTotals]);

  const maxChannelSales = useMemo(() => {
    return Math.max(...Object.values(channelTotals).map(c => c.total_sales || 0), 1);
  }, [channelTotals]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/upload/excel/revenue', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.status === 'password_required') {
        const pwd = prompt(`🔒 ${file.name}\n\n${res.data.message}`);
        if (pwd) {
          const retry = new FormData();
          retry.append('file', file);
          retry.append('password', pwd);
          const r2 = await api.post('/upload/excel/revenue', retry, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          alert(r2.data.status === 'success'
            ? `✅ ${file.name}: ${r2.data.count || 0}건 저장 완료`
            : `❌ ${file.name}: ${r2.data.message}`);
        }
      } else if (res.data.status === 'success') {
        let msg = `✅ ${file.name}`;
        if (res.data.file_type_label) msg += ` (${res.data.file_type_label})`;
        msg += `: ${res.data.count || 0}건 저장`;
        alert(msg);
      } else {
        alert(`❌ ${file.name}: ${res.data.message}`);
      }
      fetchData();
    } catch {
      alert('업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDeleteMonth = async (m) => {
    if (!window.confirm(`${year}년 ${m}월 배달앱 데이터를 모두 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/revenue/delivery-summary/${year}/${m}`);
      alert(`${year}년 ${m}월 배달앱 데이터 삭제 완료`);
      fetchData();
    } catch {
      alert('삭제 실패');
    }
  };

  /* ═══════════════════════════════════════════════
     STYLES — Revenue/Purchase 동일 색상 체계
     ═══════════════════════════════════════════════ */
  const S = {
    page: { minHeight: '100vh', background: '#f8fafc', paddingBottom: 80 },
    header: { padding: '2rem 1.5rem 0', maxWidth: '72rem', margin: '0 auto' },
    headerTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: '2rem', flexWrap: 'wrap' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
    headerIcon: { width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(to bottom right, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(245, 158, 11, 0.2)', color: 'white', flexShrink: 0 },
    title: { fontSize: 20, fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-0.025em' },
    subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    navGroup: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    navBtn: { background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    navLabel: { fontSize: 16, fontWeight: 700, minWidth: 80, textAlign: 'center', color: '#0f172a' },
    uploadBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' },
    // Summary cards
    summaryRow: { display: 'grid', gap: 12, padding: '0 1.5rem', maxWidth: '72rem', margin: '0 auto', position: 'relative', zIndex: 5 },
    card: { background: 'white', borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
    cardTotal: { background: 'linear-gradient(135deg, #134e4a 0%, #1e3a3a 100%)', borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
    cardLabel: { fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 },
    cardLabelLight: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 },
    cardValue: { fontSize: 'clamp(17px, 4.8vw, 22px)', fontWeight: 800, color: '#0f172a' },
    cardValueLight: { fontSize: 'clamp(17px, 4.8vw, 22px)', fontWeight: 800, color: 'white' },
    cardSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    // Content
    content: { margin: '16px auto 0', maxWidth: '72rem', padding: '0 1.5rem', background: 'white', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)' },
    sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' },
    sectionTitle: { fontSize: 15, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 },
    // Channel cards within content
    channelGrid: { display: 'grid', gap: 12, padding: '16px 20px' },
    chCard: { background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' },
    chName: { fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 8 },
    chSettlement: { fontSize: 'clamp(18px, 4.8vw, 22px)', fontWeight: 800, color: '#0f172a', margin: '8px 0' },
    chMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
    chMetaSub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
    // Table
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    thRow: { background: '#f8fafc' },
    th: { padding: '14px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#64748b', borderBottom: '2px solid #e2e8f0' },
    thGroup: { padding: '12px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', borderBottom: '1px solid #e2e8f0' },
    tdOdd: { background: '#ffffff' },
    tdEven: { background: '#f8fafc' },
    td: { padding: '14px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#334155', fontSize: 14 },
    tdMonth: { padding: '14px 12px', textAlign: 'center', fontWeight: 700, color: '#0f172a', fontSize: 14 },
    totalRow: { background: 'linear-gradient(135deg, #1e293b, #334155)' },
    totalTd: { padding: '14px 12px', textAlign: 'right', fontWeight: 700, color: 'white', fontSize: 14 },
    totalTdLabel: { padding: '14px 12px', textAlign: 'center', fontWeight: 800, color: 'white', fontSize: 14 },
    // Fee detail
    feeSection: { margin: '16px auto 0', maxWidth: '72rem', padding: '0 1.5rem', background: 'white', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)' },
    feeCard: { background: 'white', borderRadius: 12, padding: 0, border: '1px solid #e2e8f0', overflow: 'hidden' },
    feeCardHeader: { background: 'linear-gradient(135deg, #134e4a, #1e3a3a)', padding: '14px 16px', color: 'white' },
    feeCardBody: { padding: 16 },
    feeItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 },
    feeBar: { height: 4, background: '#f1f5f9', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
    feeFill: { height: '100%', background: '#3b82f6', borderRadius: 2, transition: 'width 0.5s' },
  };

  return (
    <div style={S.page}>
      {/* ═══ HEADER ═══ */}
      <div style={S.header}>
        <div style={S.headerTop}>
          <div style={S.headerLeft}>
            <div style={S.headerIcon}>
              <Truck size={20} />
            </div>
            <div>
              <h1 style={S.title}>배달앱관리</h1>
              <div style={S.subtitle}>Delivery App Settlement Dashboard</div>
            </div>
          </div>
          <div style={S.navGroup}>
            <button style={S.navBtn} onClick={() => setYear(y => y - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span style={S.navLabel}>{year}년</span>
            <button style={S.navBtn} onClick={() => setYear(y => y + 1)}>
              <ChevronRight size={16} />
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} style={{ display: 'none' }} />
            <button style={{ ...S.uploadBtn, opacity: uploadLoading ? 0.6 : 1 }} onClick={() => fileRef.current?.click()} disabled={uploadLoading}>
              <Upload size={14} /> {uploadLoading ? '처리중...' : '정산파일 업로드'}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ SUMMARY CARDS ═══ */}
      <div className="dld-summary" style={S.summaryRow}>
        <div style={S.card}>
          <div style={S.cardLabel}><Truck size={14} /> 총 주문매출</div>
          <div style={S.cardValue}>{fmt(grandTotals.sales)}<span style={{ fontSize: 16, fontWeight: 600, marginLeft: 2 }}>원</span></div>
        </div>
        <div style={S.card}>
          <div style={S.cardLabel}><TrendingDown size={14} /> 총 수수료</div>
          <div style={{ ...S.cardValue, color: '#ef4444' }}>-{fmt(grandTotals.fees)}<span style={{ fontSize: 16, fontWeight: 600, marginLeft: 2 }}>원</span></div>
          <div style={S.cardSub}>수수료율 {pct(grandTotals.avgFeeRate)}%</div>
        </div>
        <div style={S.card}>
          <div style={S.cardLabel}><CheckCircle size={14} /> 실 정산금</div>
          <div style={{ ...S.cardValue, color: '#059669' }}>{fmt(grandTotals.settlement)}<span style={{ fontSize: 16, fontWeight: 600, marginLeft: 2 }}>원</span></div>
        </div>
        <div style={S.cardTotal}>
          <div style={S.cardLabelLight}><BarChart3 size={14} /> 총 주문수</div>
          <div style={S.cardValueLight}>{fmt(grandTotals.orders)}<span style={{ fontSize: 16, fontWeight: 600, marginLeft: 2 }}>건</span></div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>평균 수수료율 {pct(grandTotals.avgFeeRate)}%</div>
        </div>
      </div>

      {/* ═══ CHANNEL SUMMARY ═══ */}
      <div style={S.content}>
        <div style={S.sectionHeader}>
          <div style={S.sectionTitle}>🛵 채널별 정산 현황</div>
          <button onClick={fetchData} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }} title="새로고침">
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="dld-channels" style={S.channelGrid}>
          {CHANNELS.map(ch => {
            const ct = channelTotals[ch.id] || {};
            const salesPct = grandTotals.sales > 0 ? ((ct.total_sales || 0) / grandTotals.sales * 100) : 0;
            return (
              <div key={ch.id} style={S.chCard}>
                <div style={S.chName}>{ch.icon} {ch.label}</div>
                <div style={S.chSettlement}>{fmt(ct.settlement_amount)}<span style={{ fontSize: 14, fontWeight: 600, marginLeft: 2 }}>원</span></div>
                <div style={S.chMeta}>
                  매출 {fmt(ct.total_sales)}원 · 수수료 <span style={{ color: '#ef4444', fontWeight: 700 }}>{ct.fee_rate || 0}%</span>
                </div>
                <div style={S.chMetaSub}>
                  {formatNumber(ct.order_count || 0)}건 · 비중 {pct(salesPct)}%
                </div>
                {/* Sales bar */}
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min((ct.total_sales || 0) / maxChannelSales * 100, 100)}%`, background: '#1e3a3a', borderRadius: 3, transition: 'width 0.7s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ MONTHLY TABLE ═══ */}
      <div style={S.content}>
        <div style={S.sectionHeader}>
          <div style={S.sectionTitle}>
            <FileSpreadsheet size={16} /> 월별 정산 내역
            <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginLeft: 4 }}>{monthlyData.length}건</span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ color: '#94a3b8', fontSize: 13 }}>로딩 중...</div>
          </div>
        ) : monthlyData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🛵</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#64748b' }}>정산 데이터가 없습니다</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>정산파일을 업로드해주세요</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr style={S.thRow}>
                  <th style={{ ...S.th, textAlign: 'center', borderRight: '2px solid #e2e8f0', minWidth: 60 }}>월</th>
                  {CHANNELS.map(ch => (
                    <th key={ch.id} colSpan={3} style={{ ...S.th, borderLeft: '1px solid #e2e8f0' }}>
                      {ch.icon} {ch.label}
                    </th>
                  ))}
                  <th colSpan={3} style={{ ...S.th, borderLeft: '2px solid #cbd5e1', background: '#eef2f7' }}>합계</th>
                </tr>
                <tr>
                  <th style={{ ...S.thGroup, borderRight: '2px solid #e2e8f0' }}></th>
                  {CHANNELS.map(ch => (
                    <th key={ch.id} style={{ display: 'contents' }}>
                      <th style={{ ...S.thGroup, borderLeft: '1px solid #e2e8f0' }}>매출</th>
                      <th style={S.thGroup}>정산</th>
                      <th style={{ ...S.thGroup, color: '#ef4444' }}>수수료율</th>
                    </th>
                  ))}
                  <th style={{ ...S.thGroup, borderLeft: '2px solid #cbd5e1', background: '#eef2f7' }}>매출</th>
                  <th style={{ ...S.thGroup, background: '#eef2f7' }}>정산</th>
                  <th style={{ ...S.thGroup, color: '#ef4444', background: '#eef2f7' }}>수수료율</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m, idx) => (
                  <tr key={m.month} style={idx % 2 === 0 ? S.tdOdd : S.tdEven}>
                    <td style={{ ...S.tdMonth, borderRight: '2px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        {m.month}월
                        <button onClick={() => handleDeleteMonth(m.month)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 2, opacity: 0 }} className="del-month-btn" title="삭제">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                    {CHANNELS.map(ch => {
                      const cd = m.channels?.[ch.id] || {};
                      const sales = cd.total_sales || 0;
                      const settle = cd.settlement_amount || 0;
                      const rate = cd.fee_rate || 0;
                      return (
                        <td key={ch.id} style={{ display: 'contents' }}>
                          <td style={{ ...S.td, borderLeft: '1px solid #e2e8f0', color: sales > 0 ? '#3b82f6' : '#cbd5e1', fontWeight: 600 }}>
                            {sales > 0 ? fmt(sales) : '-'}
                          </td>
                          <td style={{ ...S.td, color: settle > 0 ? '#16a34a' : '#cbd5e1', fontWeight: 600 }}>
                            {settle > 0 ? fmt(settle) : '-'}
                          </td>
                          <td style={{ ...S.td, color: rate > 0 ? '#64748b' : '#cbd5e1' }}>
                            {rate > 0 ? `${pct(rate)}%` : '-'}
                          </td>
                        </td>
                      );
                    })}
                    {/* Row totals */}
                    <td style={{ ...S.td, borderLeft: '2px solid #cbd5e1', background: '#f1f5f9', color: '#2563eb', fontWeight: 800 }}>
                      {fmt(m.total_sales)}
                    </td>
                    <td style={{ ...S.td, background: '#f1f5f9', color: '#16a34a', fontWeight: 800 }}>
                      {fmt(m.total_settlement)}
                    </td>
                    <td style={{ ...S.td, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                      {m.overall_fee_rate > 0 ? `${pct(m.overall_fee_rate)}%` : '-'}
                    </td>
                  </tr>
                ))}
                {/* Grand total row */}
                <tr style={S.totalRow}>
                  <td style={{ ...S.totalTdLabel, borderRight: '2px solid rgba(255,255,255,0.15)' }}>합계</td>
                  {CHANNELS.map(ch => {
                    const ct = channelTotals[ch.id] || {};
                    return (
                      <td key={ch.id} style={{ display: 'contents' }}>
                        <td style={{ ...S.totalTd, borderLeft: '1px solid rgba(255,255,255,0.1)', color: '#60a5fa' }}>{fmt(ct.total_sales)}</td>
                        <td style={{ ...S.totalTd, color: '#22c55e' }}>{fmt(ct.settlement_amount)}</td>
                        <td style={{ ...S.totalTd, color: '#94a3b8' }}>{ct.fee_rate > 0 ? `${pct(ct.fee_rate)}%` : '-'}</td>
                      </td>
                    );
                  })}
                  <td style={{ ...S.totalTd, borderLeft: '2px solid rgba(255,255,255,0.15)', color: '#60a5fa' }}>{fmt(grandTotals.sales)}</td>
                  <td style={{ ...S.totalTd, color: '#22c55e' }}>{fmt(grandTotals.settlement)}</td>
                  <td style={{ ...S.totalTd, color: '#94a3b8' }}>{pct(grandTotals.avgFeeRate)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ FEE BREAKDOWN ═══ */}
      {Object.keys(channelTotals).length > 0 && (() => {
        const channelFeeDetails = {};
        monthlyData.forEach(m => {
          CHANNELS.forEach(ch => {
            const cd = m.channels?.[ch.id];
            if (!cd || !cd.fee_breakdown) return;
            if (!channelFeeDetails[ch.id]) channelFeeDetails[ch.id] = { aggregated: {}, byMonth: [] };
            const fb = cd.fee_breakdown;
            const monthItems = {};
            Object.entries(fb).forEach(([k, v]) => {
              if (v > 0) {
                channelFeeDetails[ch.id].aggregated[k] = (channelFeeDetails[ch.id].aggregated[k] || 0) + v;
                monthItems[k] = v;
              }
            });
            if (Object.keys(monthItems).length > 0) {
              channelFeeDetails[ch.id].byMonth.push({ month: m.month, items: monthItems, totalFees: cd.total_fees });
            }
          });
        });

        return (
          <div style={S.feeSection}>
            <div style={S.sectionHeader}>
              <div style={S.sectionTitle}>
                <AlertCircle size={16} style={{ color: '#ef4444' }} /> 채널별 수수료 세부 내역
              </div>
            </div>
            <div className="dld-fees" style={{ display: 'grid', gap: 12, padding: '16px 20px' }}>
              {CHANNELS.map(ch => {
                const ct = channelTotals[ch.id] || {};
                if (!ct.total_sales) return null;
                const feeRate = ct.fee_rate || 0;
                const detail = channelFeeDetails[ch.id];
                const aggregated = detail?.aggregated || {};
                const byMonth = detail?.byMonth || [];
                const aggEntries = Object.entries(aggregated).sort(([,a], [,b]) => b - a);
                const totalAggFees = aggEntries.reduce((s, [,v]) => s + v, 0);

                return (
                  <div key={ch.id} style={S.feeCard}>
                    <div style={S.feeCardHeader}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15 }}>{ch.icon} {ch.label} 수수료 분석</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>총매출 {fmt(ct.total_sales)}원 기준</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 24, fontWeight: 800 }}>{pct(feeRate)}%</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>수수료율</div>
                        </div>
                      </div>
                    </div>
                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ padding: 12, textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>총 수수료</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444' }}>-{fmt(ct.total_fees)}</div>
                      </div>
                      <div style={{ padding: 12, textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>정산금</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>{fmt(ct.settlement_amount)}</div>
                      </div>
                      <div style={{ padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>주문수</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{fmt(ct.order_count)}건</div>
                      </div>
                    </div>
                    {/* Breakdown */}
                    <div style={S.feeCardBody}>
                      {aggEntries.length > 0 ? (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>📋 수수료 구성 내역 <span style={{ fontWeight: 500, color: '#94a3b8' }}>(연간합계)</span></div>
                          {aggEntries.map(([name, amount]) => {
                            const ratio = totalAggFees > 0 ? (amount / totalAggFees * 100) : 0;
                            return (
                              <div key={name}>
                                <div style={S.feeItem}>
                                  <span style={{ color: '#334155', fontWeight: 500 }}>{name}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{pct(ratio)}%</span>
                                    <span style={{ color: '#ef4444', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>-{fmt(amount)}원</span>
                                  </div>
                                </div>
                                <div style={S.feeBar}>
                                  <div style={{ ...S.feeFill, width: `${ratio}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {byMonth.length > 1 && (
                            <details style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                              <summary style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', cursor: 'pointer' }}>
                                📅 월별 세부 내역 보기 ({byMonth.length}개월)
                              </summary>
                              <div style={{ marginTop: 8 }}>
                                {byMonth.map(mb => (
                                  <div key={mb.month} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', marginBottom: 6, border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{mb.month}월</span>
                                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>수수료 -{fmt(mb.totalFees)}원</span>
                                    </div>
                                    {Object.entries(mb.items).sort(([,a],[,b]) => b - a).map(([name, val]) => (
                                      <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', padding: '2px 0' }}>
                                        <span>{name}</span>
                                        <span style={{ color: '#ef4444', fontWeight: 500 }}>-{fmt(val)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
                          수수료 세부 내역이 없습니다
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <style>{`
        tr:hover .del-month-btn { opacity: 1 !important; }
        .del-month-btn:hover { color: #ef4444 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .dld-summary { grid-template-columns: repeat(4, 1fr); }
        .dld-channels { grid-template-columns: repeat(4, 1fr); }
        .dld-fees { grid-template-columns: repeat(2, 1fr); }
        @media (max-width: 1023px) {
          .dld-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .dld-channels { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 767px) {
          .dld-fees { grid-template-columns: 1fr; }
        }
        @media (max-width: 639px) {
          .dld-channels { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
