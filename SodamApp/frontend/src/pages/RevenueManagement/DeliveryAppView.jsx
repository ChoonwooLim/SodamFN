import React from 'react';
import { formatNumber } from '../../utils/format';

const CHANNEL_ICONS = { '쿠팡': '🟡', '배민': '🔵', '요기요': '🔴', '땡겨요': '🟢' };
const CHANNEL_ORDER = ['쿠팡', '배민', '요기요', '땡겨요'];

export function DeliveryAppView({ isMobile, plYear, deliveryAppData }) {
    if (isMobile) {
        return (
            <div className="max-w-6xl mx-auto px-6">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                    <div className="text-5xl mb-4">🖥️</div>
                    <h3 className="text-lg font-bold text-slate-700 mb-2">배달앱 상세 내역은 PC에서 확인해주세요</h3>
                    <p className="text-sm text-slate-400">배달앱 비교 분석 테이블은 넓은 화면에서 최적화되어 있습니다.</p>
                </div>
            </div>
        );
    }

    const monthly = deliveryAppData?.monthly || [];
    const channelTotals = deliveryAppData?.channel_totals || {};
    const sortedChannels = CHANNEL_ORDER.filter(c => channelTotals[c]);

    const grandSales = Object.values(channelTotals).reduce((s, c) => s + c.total_sales, 0);
    const grandFees = Object.values(channelTotals).reduce((s, c) => s + c.total_fees, 0);
    const grandSettle = Object.values(channelTotals).reduce((s, c) => s + c.settlement_amount, 0);
    const grandOrders = Object.values(channelTotals).reduce((s, c) => s + c.order_count, 0);
    const grandFeeRate = grandSales > 0 ? (grandFees / grandSales * 100).toFixed(1) : 0;

    return (
        <div className="max-w-6xl mx-auto px-6">
            <h3 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-xs text-white">🛵</span>
                배달앱 정산 분석 — {plYear}년
            </h3>

            {/* Grand Total Summary */}
            <div className="grid grid-cols-5 gap-3 mb-5">
                {[
                    { label: '📊 총 주문매출', value: formatNumber(grandSales), unit: '원', color: 'text-slate-800', bg: 'bg-white border-slate-100' },
                    { label: '🧾 총 수수료', value: '-' + formatNumber(grandFees), unit: '원', color: 'text-rose-500', bg: 'bg-white border-slate-100' },
                    { label: '💰 실 정산금', value: formatNumber(grandSettle), unit: '원', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
                    { label: '📦 총 주문수', value: formatNumber(grandOrders), unit: '건', color: 'text-slate-800', bg: 'bg-white border-slate-100' },
                    { label: '📈 평균 수수료율', value: grandFeeRate, unit: '%', color: 'text-slate-800', bg: 'bg-white border-slate-100' },
                ].map((card, i) => (
                    <div key={i} className={`rounded-2xl p-5 shadow-sm border card-animate ${card.bg}`} style={{ animationDelay: `${i * 0.05}s` }}>
                        <div className="text-sm text-slate-500 font-semibold mb-2">{card.label}</div>
                        <div className={`text-2xl font-extrabold ${card.color}`}>{card.value}<span className="text-base font-semibold ml-0.5">{card.unit}</span></div>
                    </div>
                ))}
            </div>

            {/* Channel Summary Cards */}
            <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: `repeat(${Math.min(sortedChannels.length, 4)}, 1fr)` }}>
                {sortedChannels.map((ch, i) => {
                    const ct = channelTotals[ch];
                    return (
                        <div key={ch} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate" style={{ animationDelay: `${(i + 5) * 0.05}s` }}>
                            <div className="text-[15px] text-slate-500 font-semibold">{CHANNEL_ICONS[ch]} {ch}</div>
                            <div className="text-2xl font-extrabold text-slate-800 my-2">{formatNumber(ct.settlement_amount)}원</div>
                            <div className="text-[13px] text-slate-500 mt-1">
                                매출 {formatNumber(ct.total_sales)}원 · 수수료 {ct.fee_rate}%
                            </div>
                            <div className="text-[13px] text-slate-400 mt-1">
                                {formatNumber(ct.order_count)}건
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Monthly Breakdown Table */}
            <div className="del-grid-container" style={{ marginBottom: 20 }}>
                <table className="del-grid-table">
                    <thead>
                        <tr>
                            <th style={{ minWidth: 80, padding: '16px 8px', textAlign: 'center' }}>월</th>
                            {sortedChannels.map((ch, idx) => (
                                <th key={ch} colSpan={4} style={{
                                    padding: '16px 8px', textAlign: 'center',
                                    borderLeft: '1px solid rgba(255,255,255,0.2)',
                                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent'
                                }}>
                                    {CHANNEL_ICONS[ch]} {ch}
                                </th>
                            ))}
                            <th colSpan={3} style={{ padding: '16px 8px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.3)' }}>합계</th>
                        </tr>
                        <tr>
                            <th></th>
                            {sortedChannels.map((ch, idx) => {
                                const darkBg = idx % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
                                return (
                                <React.Fragment key={ch}>
                                    <th style={{ padding: '12px 6px', color: '#bfdbfe', borderLeft: '1px solid rgba(255,255,255,0.15)', background: darkBg }}>매출</th>
                                    <th style={{ padding: '12px 6px', color: '#bbf7d0', background: darkBg }}>정산</th>
                                    <th style={{ padding: '12px 6px', color: '#fecaca', background: darkBg }}>수수료</th>
                                    <th style={{ padding: '12px 6px', color: '#e2e8f0', background: darkBg }}>수수료율</th>
                                </React.Fragment>
                            )})}
                            <th style={{ padding: '12px 6px', color: '#bfdbfe', borderLeft: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)' }}>매출</th>
                            <th style={{ padding: '12px 6px', color: '#bbf7d0', background: 'rgba(255,255,255,0.06)' }}>정산</th>
                            <th style={{ padding: '12px 6px', color: '#e2e8f0', background: 'rgba(255,255,255,0.06)' }}>수수료율</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monthly.map(m => {
                            const rowSales = sortedChannels.reduce((s, ch) => s + (m.channels[ch]?.total_sales || 0), 0);
                            const rowSettle = m.total_settlement || 0;
                            const rowFeeRate = rowSales > 0 ? ((rowSales - rowSettle) / rowSales * 100).toFixed(1) : 0;
                            return (
                            <tr key={`${m.year}-${m.month}`}>
                                <td style={{ textAlign: 'center', fontWeight: 600, padding: '12px 8px' }}>{m.month}월</td>
                                {sortedChannels.map((ch, idx) => {
                                    const chData = m.channels[ch];
                                    const groupBg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
                                    if (!chData) return (
                                        <React.Fragment key={ch}>
                                            <td style={{ color: '#94a3b8', textAlign: 'right', padding: '14px 8px', borderLeft: '1px solid #e2e8f0', background: groupBg }}>-</td>
                                            <td style={{ color: '#94a3b8', textAlign: 'right', padding: '14px 8px', background: groupBg }}>-</td>
                                            <td style={{ color: '#94a3b8', textAlign: 'right', padding: '14px 8px', background: groupBg }}>-</td>
                                            <td style={{ color: '#94a3b8', textAlign: 'right', padding: '14px 8px', background: groupBg }}>-</td>
                                        </React.Fragment>
                                    );
                                    return (
                                        <React.Fragment key={ch}>
                                            <td style={{ textAlign: 'right', color: '#3b82f6', fontWeight: 600, padding: '14px 8px', borderLeft: '1px solid #e2e8f0', background: groupBg }}>
                                                {formatNumber(chData.total_sales)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600, padding: '14px 8px', background: groupBg }}>
                                                {formatNumber(chData.settlement_amount)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#dc2626', padding: '14px 8px', background: groupBg }}>
                                                -{formatNumber(chData.total_fees)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#64748b', padding: '14px 8px', background: groupBg }}>
                                                {chData.fee_rate}%
                                            </td>
                                        </React.Fragment>
                                    );
                                })}
                                <td style={{ textAlign: 'right', color: '#2563eb', fontWeight: 800, padding: '14px 8px', borderLeft: '2px solid #cbd5e1', background: '#f1f5f9' }}>
                                    {formatNumber(rowSales)}
                                </td>
                                <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 800, padding: '14px 8px', background: '#f1f5f9' }}>
                                    {formatNumber(rowSettle)}
                                </td>
                                <td style={{ textAlign: 'right', color: '#475569', fontWeight: 600, padding: '14px 8px', background: '#f1f5f9' }}>
                                    {rowFeeRate}%
                                </td>
                            </tr>
                            );
                        })}
                        {/* Totals Row */}
                        <tr className="del-totals-row">
                            <td style={{ textAlign: 'center' }}><strong>합계</strong></td>
                            {sortedChannels.map((ch, idx) => {
                                const ct = channelTotals[ch];
                                const groupBg = idx % 2 === 0 ? '#f0fdf4' : '#f8fafc';
                                return (
                                    <React.Fragment key={ch}>
                                        <td style={{ textAlign: 'right', color: '#60a5fa', fontWeight: 700, borderLeft: '1px solid #059669', background: groupBg }}>
                                            {formatNumber(ct.total_sales)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 700, background: groupBg }}>
                                            {formatNumber(ct.settlement_amount)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#ef4444', background: groupBg }}>
                                            -{formatNumber(ct.total_fees)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#94a3b8', background: groupBg }}>
                                            {ct.fee_rate}%
                                        </td>
                                    </React.Fragment>
                                );
                            })}
                            <td style={{ textAlign: 'right', color: '#60a5fa', fontWeight: 700, borderLeft: '2px solid rgba(255,255,255,0.15)' }}>
                                {formatNumber(grandSales)}
                            </td>
                            <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>
                                {formatNumber(grandSettle)}
                            </td>
                            <td style={{ textAlign: 'right', color: '#94a3b8' }}>
                                {grandFeeRate}%
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Channel Fee Breakdown Cards */}
            <h3 className="text-[15px] font-bold text-slate-800 mt-6 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-xs text-white">📊</span>
                채널별 수수료 상세
            </h3>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(sortedChannels.length, 4)}, 1fr)` }}>
                {sortedChannels.map(ch => {
                    const ct = channelTotals[ch];
                    const latestMonth = monthly.find(m => m.channels[ch]);
                    const feeBreakdown = latestMonth?.channels[ch]?.fee_breakdown || {};
                    return (
                        <div key={ch} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                            <div className="text-lg font-extrabold text-slate-800 mb-3">{CHANNEL_ICONS[ch]} {ch} 수수료 분석</div>
                            <div className="text-sm text-slate-500 mb-1.5">
                                총매출 대비 수수료율: <span className="text-rose-500 font-bold">{ct.fee_rate}%</span>
                            </div>
                            <div className="text-sm text-slate-500 mb-3">
                                총 수수료: <span className="text-rose-500 font-semibold">{formatNumber(ct.total_fees)}원</span> / 총매출: {formatNumber(ct.total_sales)}원
                            </div>
                            {Object.keys(feeBreakdown).length > 0 && (
                                <div className="border-t-2 border-dashed border-slate-200 pt-3 mt-3">
                                    <div className="text-[13px] text-slate-600 font-semibold mb-2">최근 세부 수수료 내역:</div>
                                    {Object.entries(feeBreakdown).filter(([, v]) => v > 0).map(([k, v]) => (
                                        <div key={k} className="flex justify-between text-sm text-slate-500 py-1 border-b border-slate-50">
                                            <span>{k}</span>
                                            <span className="text-rose-500 font-medium">{formatNumber(v)}원</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
