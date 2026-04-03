import React from 'react';
import { formatNumber } from '../../utils/format';
import { EXPENSE_CATEGORIES } from '../../utils/constants';

// Card company colors
const CARD_COLORS = {
    '롯데카드': { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
    '삼성카드': { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' },
    '신한카드': { bg: '#d1fae5', text: '#059669', border: '#6ee7b7' },
    '신한은행': { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' },
    '국민은행': { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
    '수협은행': { bg: '#cffafe', text: '#0e7490', border: '#67e8f9' },
    '현대카드': { bg: '#f3f4f6', text: '#1f2937', border: '#d1d5db' },
    '기타': { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
};

export function PurchaseSummary({ categoryData, cardData, bankData, topVendors, summary }) {
    return (
        <div className="space-y-4">
            {/* Category Breakdown */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">📂 카테고리별 매입 현황</h3>
                <div className="space-y-3">
                    {EXPENSE_CATEGORIES.filter(cat => cat.id !== '개인가계부').map(cat => {
                        const catInfo = categoryData[cat.id];
                        const amount = catInfo?.amount || 0;
                        const bizTotal = EXPENSE_CATEGORIES.filter(c => c.id !== '개인가계부').reduce((s, c) => s + (categoryData[c.id]?.amount || 0), 0);
                        const pct = bizTotal > 0 ? (amount / bizTotal * 100) : 0;
                        const ALWAYS_SHOW = ['배달앱수수료', '카드수수료'];
                        if (amount === 0 && !ALWAYS_SHOW.includes(cat.id)) return null;
                        return (
                            <div key={cat.id}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-semibold text-slate-600">{cat.icon} {cat.label}</span>
                                    <span className="text-xs font-bold text-slate-800">{formatNumber(amount)}원 ({pct.toFixed(1)}%)</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cat.color }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Card + Bank (left) + Delivery Fee (right) — 2 columns */}
            <div className="grid grid-cols-[3.5fr_6.5fr] gap-4">
                {/* LEFT: Card Company + Bank Transfer */}
                <div className="flex flex-col gap-4">
                    {/* Card Company Breakdown */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate min-w-0">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">💳 카드사별 매입 현황</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(cardData).filter(([k]) => k !== '기타').sort((a, b) => b[1].amount - a[1].amount).map(([card, info]) => {
                                const colors = CARD_COLORS[card] || CARD_COLORS['기타'];
                                return (
                                    <div key={card} className="rounded-xl p-3 border text-center" style={{ background: colors.bg, borderColor: colors.border }}>
                                        <div className="text-xs font-bold mb-1" style={{ color: colors.text }}>{card}</div>
                                        <div className="text-sm font-extrabold text-slate-800">{formatNumber(info.amount)}원</div>
                                        <div className="text-[11px] text-slate-400">{info.count}건</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bank Transfer Breakdown */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate min-w-0">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">🏦 계좌이체 현황</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.keys(bankData).length > 0 ? (
                                Object.entries(bankData).sort((a, b) => b[1].amount - a[1].amount).map(([bank, info]) => {
                                    const colors = CARD_COLORS[bank] || { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' };
                                    return (
                                        <div key={bank} className="rounded-xl p-3 border text-center" style={{ background: colors.bg, borderColor: colors.border }}>
                                            <div className="text-xs font-bold mb-1" style={{ color: colors.text }}>{bank}</div>
                                            <div className="text-sm font-extrabold text-slate-800">{formatNumber(info.amount)}원</div>
                                            <div className="text-[11px] text-slate-400">{info.count}건</div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="col-span-2 text-slate-400 py-5 text-center text-sm">계좌이체 내역 없음</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Delivery App Fee Breakdown */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">🛵 배달앱 수수료 상세</h3>
                    {summary.delivery_fees && summary.delivery_fees.length > 0 ? (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                {(() => {
                                    const ORDER = ['쿠팡이츠', '배달의민족', '요기요', '땡겨요'];
                                    const sorted = [...summary.delivery_fees].sort((a, b) => {
                                        const ai = ORDER.indexOf(a.label);
                                        const bi = ORDER.indexOf(b.label);
                                        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                                    });
                                    return sorted.map(df => {
                                    const CHANNEL_COLORS = { '배달의민족': '#2AC1BC', '쿠팡이츠': '#FF6B2C', '요기요': '#FA0050', '땡겨요': '#4A90D9' };
                                    const color = CHANNEL_COLORS[df.label] || '#6366f1';
                                    return (
                                        <div key={df.channel} style={{
                                            background: `linear-gradient(135deg, ${color}10, ${color}05)`,
                                            border: `1px solid ${color}30`,
                                            borderRadius: 12, padding: '14px 16px',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <span style={{ fontSize: 15, fontWeight: 800, color }}>{df.label}</span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}15`, padding: '3px 10px', borderRadius: 20 }}>
                                                    {df.fee_rate}%
                                                </span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: 13 }}>
                                                <div>
                                                    <div style={{ color: '#94a3b8', fontSize: 11 }}>매출</div>
                                                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{formatNumber(df.total_sales)}원</div>
                                                </div>
                                                <div>
                                                    <div style={{ color: '#94a3b8', fontSize: 11 }}>수수료</div>
                                                    <div style={{ fontWeight: 800, color: '#ef4444' }}>-{formatNumber(df.total_fees)}원</div>
                                                </div>
                                                <div>
                                                    <div style={{ color: '#94a3b8', fontSize: 11 }}>정산금</div>
                                                    <div style={{ fontWeight: 700, color: '#059669' }}>{formatNumber(df.settlement)}원</div>
                                                </div>
                                                <div>
                                                    <div style={{ color: '#94a3b8', fontSize: 11 }}>주문수</div>
                                                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{df.order_count}건</div>
                                                </div>
                                            </div>
                                            {/* Fee Breakdown Detail */}
                                            {df.fee_breakdown && Object.keys(df.fee_breakdown).length > 0 && (
                                                <div style={{ marginTop: 8, borderTop: `1px solid ${color}20`, paddingTop: 8 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>📋 수수료 항목별 상세</div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        {Object.entries(df.fee_breakdown).map(([key, val]) => {
                                                            const isCredit = val < 0;
                                                            const absVal = Math.abs(val);
                                                            const pct = df.total_sales > 0 ? (absVal / df.total_sales * 100).toFixed(1) : '0.0';
                                                            return (
                                                                <div key={key} style={{
                                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                    fontSize: 12, padding: '3px 0',
                                                                    borderBottom: '1px solid #f1f5f9',
                                                                }}>
                                                                    <span style={{ color: '#475569', flex: 1 }}>{key}</span>
                                                                    <span style={{
                                                                        fontWeight: 700,
                                                                        color: isCredit ? '#0f172a' : '#ef4444',
                                                                        fontVariantNumeric: 'tabular-nums',
                                                                        minWidth: 100, textAlign: 'right',
                                                                    }}>
                                                                        {isCredit ? '+' : '-'}{formatNumber(absVal)}원
                                                                    </span>
                                                                    <span style={{
                                                                        fontSize: 11, color: '#94a3b8', fontWeight: 600,
                                                                        minWidth: 40, textAlign: 'right', marginLeft: 4,
                                                                    }}>
                                                                        {isCredit ? '' : `${pct}%`}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                    });
                                })()}
                            </div>
                            <div style={{
                                background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderRadius: 10,
                                padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>수수료 합계</span>
                                <span style={{ color: '#ef4444', fontSize: 16, fontWeight: 800 }}>
                                    {formatNumber(summary.total_delivery_fee)}원
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="text-slate-400 py-5 text-center text-sm">배달앱 정산 파일 업로드 후 자동 표시</div>
                    )}
                </div>
            </div>

            {/* Top Vendors */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">🏆 TOP 10 거래처</h3>
                <div className="space-y-1">
                    {topVendors.map((v, i) => (
                        <div key={v.name} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 ${
                                i < 3 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
                            }`}>{i + 1}</span>
                            <span className="text-sm font-semibold text-slate-700 flex-1 truncate">{v.name}</span>
                            <span className="text-[11px] text-slate-400 font-medium">{v.count}건</span>
                            <span className="text-sm font-bold text-slate-800 tabular-nums">{formatNumber(v.amount)}원</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
