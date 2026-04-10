import React from 'react';
import { formatNumber } from '../../utils/format';

const fmtShort = (v) => {
    if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
    if (v >= 10000) return `${formatNumber(Math.round(v / 10000))}만`;
    return formatNumber(v);
};

export function MobileDashboard({ summary }) {
    const totalAmt = summary.total || 0;
    const cashAmt = summary.by_category?.cash || 0;
    const cardAmt = summary.by_category?.card || 0;
    const deliveryAmt = summary.by_category?.delivery || 0;
    const byDay = summary.by_day || [];
    const byVendor = (summary.by_vendor || []).slice(0, 10);
    const maxDayTotal = Math.max(...byDay.map(d => d.total || 0), 1);

    const CHANNELS = [
        { key: 'cash', label: '현금매출', icon: '💵', amount: cashAmt },
        { key: 'card', label: '카드매출', icon: '💳', amount: cardAmt },
        { key: 'delivery', label: '배달앱매출', icon: '🛵', amount: deliveryAmt },
    ];

    return (
        <div style={{ padding: '0 16px 80px', marginTop: 16 }}>
            {/* ── Hero: 총 매출 ── */}
            <div className="card-animate" style={{
                background: 'linear-gradient(135deg, #134e4a, #1e3a3a)',
                borderRadius: 20, padding: '24px 20px', textAlign: 'center',
                marginBottom: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>총 매출</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#f1f5f9', letterSpacing: -1 }}>
                    {fmtShort(totalAmt)}<span style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>원</span>
                </div>
            </div>

            {/* ── 3-col: 현금/카드/배달앱 ── */}
            <div className="card-animate" style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
                marginBottom: 14, animationDelay: '0.05s',
            }}>
                {CHANNELS.map((ch) => {
                    const pct = totalAmt > 0 ? (ch.amount / totalAmt * 100).toFixed(1) : '0';
                    return (
                        <div key={ch.key} style={{
                            background: 'white', borderRadius: 14, padding: '14px 8px',
                            textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        }}>
                            <div style={{ fontSize: 16, marginBottom: 4 }}>{ch.icon}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{ch.label}</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginTop: 2 }}>{fmtShort(ch.amount)}</div>
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{pct}%</div>
                        </div>
                    );
                })}
            </div>

            {/* ── 채널별 비중 프로그레스 ── */}
            <div className="card-animate" style={{
                background: 'white', borderRadius: 16, padding: 16,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 14,
                animationDelay: '0.1s',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                    background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>📊 채널별 매출 비중</span>
                </div>
                {CHANNELS.map(ch => {
                    const pct = totalAmt > 0 ? (ch.amount / totalAmt * 100) : 0;
                    return (
                        <div key={ch.key} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{ch.icon} {ch.label}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                                    {formatNumber(ch.amount)} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pct.toFixed(1)}%)</span>
                                </span>
                            </div>
                            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', borderRadius: 3,
                                    background: ch.key === 'cash' ? '#1e3a3a' : ch.key === 'card' ? '#3d7b7b' : '#7fb5b5',
                                    width: `${pct}%`, transition: 'width 0.5s',
                                }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── 일별 매출 추이 ── */}
            <div className="card-animate" style={{
                background: 'white', borderRadius: 16, padding: 16,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 14,
                animationDelay: '0.15s',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                    background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>📈 일별 매출 추이</span>
                </div>
                {byDay.length > 0 ? (
                    <div className="rev-daily-chart">
                        {byDay.map(d => {
                            const dayNum = d.date.split('-')[2];
                            return (
                                <div className="rev-daily-bar" key={d.date}>
                                    <div className="daily-bar-stack">
                                        {d.delivery > 0 && (
                                            <div className="daily-bar-seg delivery" style={{ height: `${(d.delivery / maxDayTotal) * 100}%` }} />
                                        )}
                                        {d.card > 0 && (
                                            <div className="daily-bar-seg card" style={{ height: `${(d.card / maxDayTotal) * 100}%` }} />
                                        )}
                                        {d.cash > 0 && (
                                            <div className="daily-bar-seg cash" style={{ height: `${(d.cash / maxDayTotal) * 100}%` }} />
                                        )}
                                    </div>
                                    <span className="daily-bar-label">{dayNum}</span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ color: '#94a3b8', padding: 24, textAlign: 'center', fontSize: 12 }}>데이터가 없습니다</div>
                )}
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 10, fontSize: 11, color: '#64748b' }}>
                    <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#1e3a3a', marginRight: 4 }} />현금</span>
                    <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#3d7b7b', marginRight: 4 }} />카드</span>
                    <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#7fb5b5', marginRight: 4 }} />배달앱</span>
                </div>
            </div>

            {/* ── TOP 거래처 ── */}
            <div className="card-animate" style={{
                background: 'white', borderRadius: 16, padding: 16,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                animationDelay: '0.2s',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                    background: 'linear-gradient(135deg, #1e293b, #334155)',
                }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>🏆 TOP {byVendor.length} 거래처</span>
                </div>
                {byVendor.length > 0 ? byVendor.map((v, i) => (
                    <div key={v.name} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 0',
                        borderBottom: i < byVendor.length - 1 ? '1px solid #f1f5f9' : 'none',
                    }}>
                        <span style={{
                            width: 22, height: 22, borderRadius: 6, display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                            background: i < 3 ? 'linear-gradient(135deg, #1e293b, #334155)' : '#f1f5f9',
                            color: i < 3 ? '#f1f5f9' : '#64748b',
                        }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#334155' }}>{v.name}</span>
                        <span style={{ fontSize: 10 }}>
                            {v.category === 'cash' ? '💵' : v.category === 'card' ? '💳' : '🛵'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{formatNumber(v.total)}원</span>
                    </div>
                )) : (
                    <div style={{ color: '#94a3b8', padding: 24, textAlign: 'center', fontSize: 12 }}>거래처 데이터가 없습니다</div>
                )}
            </div>
        </div>
    );
}

export function DesktopDashboard({ summary }) {
    const totalAmt = summary.total || 0;
    const cashAmt = summary.by_category?.cash || 0;
    const cardAmt = summary.by_category?.card || 0;
    const deliveryAmt = summary.by_category?.delivery || 0;
    const byDay = summary.by_day || [];
    const byVendor = (summary.by_vendor || []).slice(0, 10);
    const maxDayTotal = Math.max(...byDay.map(d => d.total || 0), 1);

    const CHANNELS = [
        { key: 'cash', label: '현금매출', icon: '💵', color: '#1e3a3a', amount: cashAmt },
        { key: 'card', label: '카드매출', icon: '💳', color: '#3d7b7b', amount: cardAmt },
        { key: 'delivery', label: '배달앱매출', icon: '🛵', color: '#7fb5b5', amount: deliveryAmt },
    ];

    return (
        <div className="max-w-6xl mx-auto px-6">
            {/* Channel Breakdown */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4 card-animate">
                <h3 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center text-xs text-white">📊</span>
                    채널별 매출 비중
                </h3>
                <div className="flex flex-col gap-3">
                    {CHANNELS.map(ch => {
                        const pct = totalAmt > 0 ? (ch.amount / totalAmt * 100) : 0;
                        return (
                            <div key={ch.key}>
                                <div className="flex justify-between text-[13px] text-slate-600 mb-1">
                                    <span className="font-medium">{ch.icon} {ch.label}</span>
                                    <span className="text-xs text-slate-400 font-semibold">{formatNumber(ch.amount)}원 ({pct.toFixed(1)}%)</span>
                                </div>
                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: ch.color }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Daily Revenue Chart */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4 card-animate" style={{ animationDelay: '0.1s' }}>
                <h3 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-xs text-white">📈</span>
                    일별 매출 추이
                </h3>
                {byDay.length > 0 ? (
                    <div className="flex gap-0.5 items-end h-[160px] px-1">
                        {byDay.map(d => {
                            const dayNum = d.date.split('-')[2];
                            return (
                                <div className="flex-1 flex flex-col items-center gap-1" key={d.date}>
                                    <div className="flex-1 w-full flex flex-col justify-end min-h-[100px]">
                                        {d.delivery > 0 && (
                                            <div className="w-full rounded-t-sm transition-all duration-300" style={{ height: `${(d.delivery / maxDayTotal) * 100}%`, background: '#7fb5b5' }} title={`배달 ${formatNumber(d.delivery)}`} />
                                        )}
                                        {d.card > 0 && (
                                            <div className="w-full transition-all duration-300" style={{ height: `${(d.card / maxDayTotal) * 100}%`, background: '#3d7b7b' }} title={`카드 ${formatNumber(d.card)}`} />
                                        )}
                                        {d.cash > 0 && (
                                            <div className="w-full rounded-b-sm transition-all duration-300" style={{ height: `${(d.cash / maxDayTotal) * 100}%`, background: '#1e3a3a' }} title={`현금 ${formatNumber(d.cash)}`} />
                                        )}
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-semibold">{dayNum}</span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-slate-400 text-center py-6 text-sm">데이터가 없습니다</div>
                )}
                <div className="flex justify-center gap-4 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#1e3a3a' }} />현금</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#3d7b7b' }} />카드</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#7fb5b5' }} />배달앱</span>
                </div>
            </div>

            {/* Top Vendors */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate" style={{ animationDelay: '0.2s' }}>
                <h3 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-xs text-white">🏆</span>
                    TOP {byVendor.length} 거래처
                </h3>
                <div className="flex flex-col">
                    {byVendor.length > 0 ? byVendor.map((v, i) => (
                        <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-b-0" key={v.name}>
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                            <span className="text-sm font-semibold text-slate-700 flex-1">{v.name}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                v.category === 'cash' ? 'bg-emerald-50 text-emerald-600' :
                                v.category === 'card' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                                {v.category === 'cash' ? '💵 현금' : v.category === 'card' ? '💳 카드' : '🛵 배달'}
                            </span>
                            <span className="text-sm font-bold text-slate-800">{formatNumber(v.total)}원</span>
                        </div>
                    )) : (
                        <div className="text-slate-400 text-center py-6 text-sm">거래처 데이터가 없습니다</div>
                    )}
                </div>
            </div>
        </div>
    );
}
