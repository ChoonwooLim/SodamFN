import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Truck, TrendingUp, TrendingDown,
  BarChart3, PieChart, Upload, Trash2, RefreshCw, AlertCircle,
  CheckCircle, ArrowUpRight, ArrowDownRight, FileSpreadsheet
} from 'lucide-react';
import api from '../api';

const fmt = (v) => (v || 0).toLocaleString('ko-KR');
const pct = (v) => (v || 0).toFixed(1);

const CHANNELS = [
  { id: '쿠팡', label: '쿠팡이츠', icon: '🛒', color: '#f59e0b', bg: 'from-amber-500 to-orange-500', light: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: '배민', label: '배달의민족', icon: '🏍️', color: '#06b6d4', bg: 'from-cyan-500 to-teal-500', light: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { id: '요기요', label: '요기요', icon: '🍜', color: '#8b5cf6', bg: 'from-violet-500 to-purple-500', light: 'bg-violet-50 text-violet-700 border-violet-200' },
  { id: '땡겨요', label: '땡겨요', icon: '📱', color: '#10b981', bg: 'from-emerald-500 to-green-500', light: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
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

  // ── Computed ──
  const channelTotals = useMemo(() => data.channel_totals || {}, [data.channel_totals]);
  const monthlyData = useMemo(() => {
    const sorted = [...(data.monthly || [])].sort((a, b) => a.month - b.month);
    return sorted;
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

  // ── Channel bar data (for visual comparison) ──
  const maxChannelSales = useMemo(() => {
    return Math.max(...Object.values(channelTotals).map(c => c.total_sales || 0), 1);
  }, [channelTotals]);

  // ── Upload handler ──
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

  // ── Delete month ──
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


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 pb-24">
      {/* ═══ HEADER ═══ */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                  <Truck className="text-amber-400" size={24} />
                  배달앱 관리
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Delivery App Dashboard — 정산 분석</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Year Navigation */}
              <div className="flex items-center gap-1 bg-white/10 rounded-xl px-1">
                <button onClick={() => setYear(y => y - 1)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-bold px-2 min-w-[60px] text-center">{year}년</span>
                <button onClick={() => setYear(y => y + 1)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                  <ChevronRight size={16} />
                </button>
              </div>
              {/* Upload */}
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadLoading}
                className="hidden sm:flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-amber-500/30 transition-all disabled:opacity-50"
              >
                <Upload size={14} /> {uploadLoading ? '처리중...' : '정산파일 업로드'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-4 space-y-5">
        {/* ═══ KPI CARDS ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-amber-200/40">
            <div className="text-[10px] sm:text-xs font-bold text-white/70 mb-1 flex items-center gap-1">
              <Truck size={12} /> 총 주문매출
            </div>
            <div className="text-lg sm:text-2xl font-black">{fmt(grandTotals.sales)}</div>
            <div className="text-[10px] text-white/50 mt-0.5">{year}년 합계</div>
          </div>
          <div className="bg-gradient-to-br from-red-400 to-rose-500 rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-red-200/40">
            <div className="text-[10px] sm:text-xs font-bold text-white/70 mb-1 flex items-center gap-1">
              <TrendingDown size={12} /> 총 수수료
            </div>
            <div className="text-lg sm:text-2xl font-black">-{fmt(grandTotals.fees)}</div>
            <div className="text-[10px] text-white/50 mt-0.5">수수료율 {pct(grandTotals.avgFeeRate)}%</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-emerald-200/40">
            <div className="text-[10px] sm:text-xs font-bold text-white/70 mb-1 flex items-center gap-1">
              <CheckCircle size={12} /> 실 정산금
            </div>
            <div className="text-lg sm:text-2xl font-black">{fmt(grandTotals.settlement)}</div>
            <div className="text-[10px] text-white/50 mt-0.5">입금 예정액</div>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-indigo-200/40">
            <div className="text-[10px] sm:text-xs font-bold text-white/70 mb-1 flex items-center gap-1">
              <BarChart3 size={12} /> 총 주문수
            </div>
            <div className="text-lg sm:text-2xl font-black">{fmt(grandTotals.orders)}</div>
            <div className="text-[10px] text-white/50 mt-0.5">건</div>
          </div>
          <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-slate-200/40 col-span-2 sm:col-span-1">
            <div className="text-[10px] sm:text-xs font-bold text-white/70 mb-1 flex items-center gap-1">
              <PieChart size={12} /> 평균 수수료율
            </div>
            <div className="text-lg sm:text-2xl font-black text-yellow-300">{pct(grandTotals.avgFeeRate)}%</div>
            <div className="text-[10px] text-white/50 mt-0.5">전체 채널 평균</div>
          </div>
        </div>

        {/* ═══ CHANNEL CARDS ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CHANNELS.map(ch => {
            const ct = channelTotals[ch.id] || {};
            const hasFeeData = (ct.total_fees || 0) > 0;
            const feeRate = ct.fee_rate || 0;
            const salesPct = grandTotals.sales > 0 ? ((ct.total_sales || 0) / grandTotals.sales * 100) : 0;

            return (
              <div key={ch.id} className="bg-white rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-100 overflow-hidden hover:shadow-xl transition-shadow">
                <div className={`bg-gradient-to-r ${ch.bg} px-4 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2 text-white">
                    <span className="text-lg">{ch.icon}</span>
                    <span className="font-bold text-sm">{ch.label}</span>
                  </div>
                  {hasFeeData && (
                    <span className="text-[10px] px-2 py-0.5 bg-white/20 rounded-full text-white font-bold">
                      {pct(feeRate)}%
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  {/* Sales Bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">정산금</span>
                      <span className="font-bold text-slate-800">{fmt(ct.settlement_amount)}원</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${ch.bg} rounded-full transition-all duration-700`}
                        style={{ width: `${Math.min((ct.total_sales || 0) / maxChannelSales * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <div className="text-[9px] text-slate-400 font-bold">매출</div>
                      <div className="text-xs font-black text-slate-700">{fmt(ct.total_sales)}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                      <div className="text-[9px] text-red-400 font-bold">수수료</div>
                      <div className="text-xs font-black text-red-500">-{fmt(ct.total_fees)}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <div className="text-[9px] text-slate-400 font-bold">주문수</div>
                      <div className="text-xs font-black text-slate-700">{fmt(ct.order_count)}건</div>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-2 border border-indigo-100">
                      <div className="text-[9px] text-indigo-400 font-bold">매출 비중</div>
                      <div className="text-xs font-black text-indigo-600">{pct(salesPct)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ MONTHLY TABLE ═══ */}
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-amber-500" />
              <span className="text-sm font-bold text-slate-700">월별 정산 내역</span>
              <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-bold">{monthlyData.length}건</span>
            </div>
            <button onClick={fetchData} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors" title="새로고침">
              <RefreshCw size={14} />
            </button>
          </div>

          {loading ? (
            <div className="p-16 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
              <p className="text-slate-400 text-xs mt-3">로딩 중...</p>
            </div>
          ) : monthlyData.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <Truck size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium">배달앱 정산 데이터가 없습니다.</p>
              <p className="text-xs text-slate-300 mt-1">정산파일을 업로드해주세요.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 font-bold border-b border-slate-100">월</th>
                      {CHANNELS.map(ch => (
                        <th key={ch.id} colSpan={3} className="px-2 py-3 font-bold border-b border-slate-100 text-center border-l border-slate-100">
                          <span className="flex items-center justify-center gap-1">
                            <span className="text-sm">{ch.icon}</span> {ch.label.slice(0, 2)}
                          </span>
                        </th>
                      ))}
                      <th colSpan={3} className="px-2 py-3 font-bold border-b border-slate-100 text-center border-l-2 border-slate-200 bg-slate-100">
                        합계
                      </th>
                    </tr>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-2 border-b border-slate-100"></th>
                      {CHANNELS.map(ch => (
                        <th key={ch.id} className="contents">
                          <th className="px-2 py-2 text-center border-b border-slate-100 border-l border-slate-100 font-bold">매출</th>
                          <th className="px-2 py-2 text-center border-b border-slate-100 font-bold">정산</th>
                          <th className="px-2 py-2 text-center border-b border-slate-100 font-bold text-red-400">수수료율</th>
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center border-b border-slate-100 border-l-2 border-slate-200 font-bold bg-slate-100/50">매출</th>
                      <th className="px-2 py-2 text-center border-b border-slate-100 font-bold bg-slate-100/50">정산</th>
                      <th className="px-2 py-2 text-center border-b border-slate-100 font-bold text-red-400 bg-slate-100/50">수수료율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m, idx) => {
                      const isEven = idx % 2 === 0;
                      return (
                        <tr key={m.month} className={`group hover:bg-amber-50/30 ${isEven ? 'bg-white' : 'bg-slate-50/30'}`}>
                          <td className="px-4 py-3 font-bold text-slate-800 border-b border-slate-50">
                            <div className="flex items-center gap-2">
                              <span>{m.month}월</span>
                              <button
                                onClick={() => handleDeleteMonth(m.month)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 rounded transition-all"
                                title="이 월 데이터 삭제"
                              >
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
                              <td key={ch.id} className="contents">
                                <td className="px-2 py-3 text-right font-mono text-slate-600 border-b border-slate-50 border-l border-slate-100 text-xs">
                                  {sales > 0 ? fmt(sales) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-2 py-3 text-right font-mono text-slate-600 border-b border-slate-50 text-xs">
                                  {settle > 0 ? fmt(settle) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className={`px-2 py-3 text-right font-mono border-b border-slate-50 text-xs font-bold ${rate > 50 ? 'text-red-500' : rate > 0 ? 'text-amber-500' : 'text-slate-300'}`}>
                                  {rate > 0 ? `${pct(rate)}%` : '-'}
                                </td>
                              </td>
                            );
                          })}
                          {/* Totals */}
                          <td className="px-2 py-3 text-right font-mono font-bold text-slate-800 border-b border-slate-50 border-l-2 border-slate-200 bg-slate-50/50 text-xs">
                            {fmt(m.total_sales)}
                          </td>
                          <td className="px-2 py-3 text-right font-mono font-bold text-emerald-600 border-b border-slate-50 bg-slate-50/50 text-xs">
                            {fmt(m.total_settlement)}
                          </td>
                          <td className={`px-2 py-3 text-right font-mono font-bold border-b border-slate-50 bg-slate-50/50 text-xs ${m.overall_fee_rate > 50 ? 'text-red-500' : 'text-amber-500'}`}>
                            {m.overall_fee_rate > 0 ? `${pct(m.overall_fee_rate)}%` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Grand Total Row */}
                    <tr className="bg-slate-800 text-white font-bold">
                      <td className="px-4 py-3 text-sm">합계</td>
                      {CHANNELS.map(ch => {
                        const ct = channelTotals[ch.id] || {};
                        return (
                          <td key={ch.id} className="contents">
                            <td className="px-2 py-3 text-right font-mono text-xs border-l border-slate-700">{fmt(ct.total_sales)}</td>
                            <td className="px-2 py-3 text-right font-mono text-xs">{fmt(ct.settlement_amount)}</td>
                            <td className="px-2 py-3 text-right font-mono text-xs text-yellow-300">{ct.fee_rate > 0 ? `${pct(ct.fee_rate)}%` : '-'}</td>
                          </td>
                        );
                      })}
                      <td className="px-2 py-3 text-right font-mono text-sm border-l-2 border-slate-600">{fmt(grandTotals.sales)}</td>
                      <td className="px-2 py-3 text-right font-mono text-sm text-emerald-300">{fmt(grandTotals.settlement)}</td>
                      <td className="px-2 py-3 text-right font-mono text-sm text-yellow-300">{pct(grandTotals.avgFeeRate)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="sm:hidden divide-y divide-slate-50">
                {monthlyData.map(m => (
                  <div key={m.month} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-800 text-sm">{m.month}월</span>
                      <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-bold">
                        수수료율 {pct(m.overall_fee_rate)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                      <div className="bg-slate-50 rounded-lg px-3 py-2 text-center">
                        <div className="text-slate-400 text-[10px]">매출</div>
                        <div className="font-bold font-mono text-slate-700">{fmt(m.total_sales)}</div>
                      </div>
                      <div className="bg-emerald-50 rounded-lg px-3 py-2 text-center">
                        <div className="text-emerald-400 text-[10px]">정산</div>
                        <div className="font-bold font-mono text-emerald-600">{fmt(m.total_settlement)}</div>
                      </div>
                      <div className="bg-red-50 rounded-lg px-3 py-2 text-center">
                        <div className="text-red-400 text-[10px]">수수료</div>
                        <div className="font-bold font-mono text-red-500">-{fmt(m.total_fees)}</div>
                      </div>
                    </div>
                    {/* Channel breakdown */}
                    <div className="space-y-1.5">
                      {CHANNELS.map(ch => {
                        const cd = m.channels?.[ch.id] || {};
                        if (!cd.total_sales) return null;
                        return (
                          <div key={ch.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5">
                            <span className="text-xs font-medium text-slate-600">{ch.icon} {ch.label.slice(0, 2)}</span>
                            <div className="flex items-center gap-3 text-xs font-mono">
                              <span className="text-slate-600">{fmt(cd.settlement_amount)}</span>
                              <span className={`font-bold ${cd.fee_rate > 50 ? 'text-red-500' : 'text-amber-500'}`}>
                                {pct(cd.fee_rate)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ═══ FEE BREAKDOWN DETAIL ═══ */}
        {Object.keys(channelTotals).length > 0 && (() => {
          // Aggregate fee_breakdown across all months per channel
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
                channelFeeDetails[ch.id].byMonth.push({ month: m.month, items: monthItems, totalFees: cd.total_fees, totalSales: cd.total_sales });
              }
            });
          });

          return (
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-400" />
                  <span className="text-sm font-bold text-slate-700">채널별 수수료 세부 내역</span>
                  <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-500 rounded-full font-bold">상세분석</span>
                </div>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                    <div key={ch.id} className={`rounded-2xl border overflow-hidden ${ch.light}`}>
                      {/* Channel Header */}
                      <div className={`bg-gradient-to-r ${ch.bg} px-5 py-3 text-white`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{ch.icon}</span>
                            <div>
                              <span className="font-bold text-sm">{ch.label} 수수료 분석</span>
                              <div className="text-[10px] text-white/60 mt-0.5">
                                총매출 {fmt(ct.total_sales)}원 기준
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-black">{pct(feeRate)}%</div>
                            <div className="text-[10px] text-white/60">수수료율</div>
                          </div>
                        </div>
                      </div>

                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-px bg-current/5 border-b border-current/10">
                        <div className="bg-white/80 p-3 text-center">
                          <div className="text-[10px] opacity-60 font-bold">총 수수료</div>
                          <div className="text-sm font-black text-red-500">-{fmt(ct.total_fees)}</div>
                        </div>
                        <div className="bg-white/80 p-3 text-center">
                          <div className="text-[10px] opacity-60 font-bold">정산금</div>
                          <div className="text-sm font-black text-emerald-600">{fmt(ct.settlement_amount)}</div>
                        </div>
                        <div className="bg-white/80 p-3 text-center">
                          <div className="text-[10px] opacity-60 font-bold">주문수</div>
                          <div className="text-sm font-black">{fmt(ct.order_count)}건</div>
                        </div>
                      </div>

                      {/* Fee Breakdown Detail (Aggregated) */}
                      <div className="p-4">
                        {aggEntries.length > 0 ? (
                          <>
                            <div className="text-[11px] font-bold opacity-70 mb-2 flex items-center gap-1">
                              📋 수수료 구성 내역 <span className="font-normal opacity-60">(연간합계)</span>
                            </div>
                            <div className="space-y-1.5">
                              {aggEntries.map(([name, amount]) => {
                                const ratio = totalAggFees > 0 ? (amount / totalAggFees * 100) : 0;
                                return (
                                  <div key={name} className="group">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-medium truncate flex-1">{name}</span>
                                      <div className="flex items-center gap-2 ml-2 shrink-0">
                                        <span className="text-[10px] px-1.5 py-0.5 bg-current/5 rounded font-bold opacity-70">{pct(ratio)}%</span>
                                        <span className="font-bold text-red-500 font-mono w-24 text-right">-{fmt(amount)}원</span>
                                      </div>
                                    </div>
                                    <div className="h-1 bg-current/5 rounded-full mt-1 overflow-hidden">
                                      <div className="h-full bg-red-400/60 rounded-full transition-all duration-500" style={{ width: `${ratio}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Monthly Detail Rows */}
                            {byMonth.length > 1 && (
                              <details className="mt-3 pt-3 border-t border-current/10">
                                <summary className="text-[11px] font-bold opacity-60 cursor-pointer hover:opacity-100 transition-opacity">
                                  📅 월별 세부 내역 보기 ({byMonth.length}개월)
                                </summary>
                                <div className="mt-2 space-y-2">
                                  {byMonth.map(mb => (
                                    <div key={mb.month} className="bg-white/60 rounded-lg p-2.5 border border-current/5">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-bold">{mb.month}월</span>
                                        <span className="text-[10px] text-red-500 font-bold font-mono">수수료 -{fmt(mb.totalFees)}원</span>
                                      </div>
                                      <div className="space-y-0.5">
                                        {Object.entries(mb.items).sort(([,a],[,b]) => b - a).map(([name, val]) => (
                                          <div key={name} className="flex justify-between text-[11px]">
                                            <span className="opacity-70 truncate">{name}</span>
                                            <span className="font-mono font-medium text-red-500 ml-2 shrink-0">-{fmt(val)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-4 text-xs opacity-40">
                            <div className="text-lg mb-1">📊</div>
                            수수료 세부 내역이 없습니다.<br/>
                            <span className="text-[10px]">정산파일 업로드 시 자동으로 표시됩니다.</span>
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

        {/* ═══ MOBILE UPLOAD ═══ */}
        <div className="sm:hidden">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadLoading}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-amber-200/50 transition-all disabled:opacity-50"
          >
            <Upload size={16} /> {uploadLoading ? '처리중...' : '정산파일 업로드'}
          </button>
        </div>
      </div>
    </div>
  );
}
