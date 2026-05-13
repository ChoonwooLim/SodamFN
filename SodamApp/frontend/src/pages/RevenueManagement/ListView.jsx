import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Edit3, Trash2, RotateCcw, Archive } from 'lucide-react';
import { formatNumber, getWeekday } from '../../utils/format';

// 채널별 색상 및 메타데이터
const CHANNEL_META = {
    cash: {
        icon: '💵',
        label: '현금매출',
        color: '#059669',
        bg: '#ecfdf5',
        border: '#a7f3d0',
        amountColor: '#059669',
    },
    card: {
        icon: '💳',
        label: '카드매출',
        color: '#2563eb',
        bg: '#eff6ff',
        border: '#bfdbfe',
        amountColor: '#1d4ed8',
    },
    delivery: {
        icon: '🛵',
        label: '배달매출',
        color: '#d97706',
        bg: '#fffbeb',
        border: '#fcd34d',
        amountColor: '#b45309',
    },
};

export function ListView({
    year, month, loading, filteredData, sortedDates, groupedByDate,
    openAddModal, openEditModal, handleDelete, getDisplayName, getStoreName,
    showBackup = false, setShowBackup = () => {}, handleRestore = () => {},
}) {
    const [collapsedDates, setCollapsedDates] = useState(new Set());
    const [expandedChannels, setExpandedChannels] = useState({}); // key: `${channel}-${dateStr}` → bool

    const toggleDateCollapse = (dateStr) => {
        setCollapsedDates(prev => {
            const next = new Set(prev);
            if (next.has(dateStr)) next.delete(dateStr);
            else next.add(dateStr);
            return next;
        });
    };

    const toggleChannel = (channel, dateStr) => {
        const key = `${channel}-${dateStr}`;
        setExpandedChannels(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const renderChannelSection = (channel, items, dateStr) => {
        if (items.length === 0) return null;
        const meta = CHANNEL_META[channel];
        const total = items.reduce((s, i) => s + (i.amount || 0), 0);
        const key = `${channel}-${dateStr}`;
        const isExpanded = expandedChannels[key] === true;

        return (
            <div key={key} className="border-t border-slate-100">
                {/* 채널 토글 헤더 */}
                <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 bg-transparent border-none cursor-pointer hover:bg-slate-50/80 transition-colors text-left"
                    onClick={() => toggleChannel(channel, dateStr)}
                >
                    {isExpanded
                        ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
                        : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                    <span className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: meta.color }}>
                        <span className="text-base leading-none">{meta.icon}</span>
                        {meta.label}
                    </span>
                    <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
                    >
                        {items.length}건
                    </span>
                    <span className="ml-auto text-sm font-bold tabular-nums" style={{ color: meta.amountColor }}>
                        {formatNumber(total)}원
                    </span>
                </button>

                {/* 확장 시 아이템 리스트 */}
                {isExpanded && (
                    <div className="divide-y divide-slate-50 bg-slate-50/30">
                        {items.map(item => {
                            const isBackup = item.source === 'manual_overwritten';
                            return (
                            <div
                                key={item.id}
                                className={`flex items-center gap-3 px-6 py-2.5 hover:bg-white transition-colors ${isBackup ? 'opacity-70 bg-amber-50/40' : ''}`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-semibold text-slate-700 truncate flex items-center gap-1.5">
                                        {getDisplayName(item.vendor_name, item.item)}
                                        {isBackup && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 inline-flex items-center gap-0.5">
                                                <Archive size={9} /> 백업
                                            </span>
                                        )}
                                    </div>
                                    {(getStoreName(item.item) || item.note) && (
                                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                            {getStoreName(item.item) && <span>{getStoreName(item.item)}</span>}
                                            {getStoreName(item.item) && item.note && <span className="mx-1">·</span>}
                                            {item.note && <span>{item.note}</span>}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right shrink-0">
                                    <div className={`text-[13px] font-bold tabular-nums ${isBackup ? 'line-through text-slate-400' : ''}`} style={isBackup ? {} : { color: meta.amountColor }}>
                                        {formatNumber(item.amount)}원
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {isBackup ? (
                                        <button
                                            className="h-7 px-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 border-none cursor-pointer flex items-center gap-1 text-[11px] font-bold transition-colors"
                                            onClick={() => handleRestore(item.id)}
                                            title="이 백업 행을 수동 데이터로 복구"
                                        >
                                            <RotateCcw size={11} /> 복구
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-500 border-none cursor-pointer flex items-center justify-center transition-colors"
                                                onClick={() => openEditModal(item)}
                                                title="수정"
                                            >
                                                <Edit3 size={13} />
                                            </button>
                                            <button
                                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 border-none cursor-pointer flex items-center justify-center transition-colors"
                                                onClick={() => handleDelete(item.id)}
                                                title="삭제"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto px-6">
            {/* 상단 바 — 카운트 + 백업 토글 + 추가 버튼 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 card-animate flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                        총 {filteredData.length}건
                    </span>
                    {/* 자동수집 마이그레이션 백업 토글 */}
                    <label
                        className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 cursor-pointer select-none hover:text-slate-700 transition-colors"
                        title="자동수집으로 덮어쓰여진 수동 입력 백업 행을 표시합니다"
                    >
                        <input
                            type="checkbox"
                            checked={showBackup}
                            onChange={e => setShowBackup(e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                        />
                        <Archive size={12} className="text-amber-500" />
                        백업 표시
                    </label>
                </div>
                <button
                    className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl border-none cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                    onClick={openAddModal}
                >
                    <Plus size={16} /> 매출 추가
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-sm text-slate-400">불러오는 중...</p>
                </div>
            ) : filteredData.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 shadow-sm border border-slate-100 text-center card-animate">
                    <div className="text-4xl mb-3">📋</div>
                    <h3 className="text-base font-bold text-slate-700 mb-1">매출 데이터가 없습니다</h3>
                    <p className="text-sm text-slate-400 mb-2">{year}년 {month}월</p>
                    <p className="text-xs text-slate-400">
                        우측 상단 <strong className="text-slate-600">+ 매출 추가</strong> 또는 <strong className="text-slate-600">업로드</strong> 탭에서 데이터를 등록하세요
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedDates.map(dateStr => {
                        const items = groupedByDate[dateStr];
                        const dayTotal = items.reduce((sum, i) => sum + (i.amount || 0), 0);
                        const weekday = getWeekday(dateStr);
                        const dayNum = dateStr.split('-')[2];

                        const cashItems = items.filter(i => i.ui_category === 'cash');
                        const cardItems = items.filter(i => i.ui_category === 'card');
                        const deliveryItems = items.filter(i => i.ui_category === 'delivery');

                        const isCollapsed = collapsedDates.has(dateStr);

                        return (
                            <div key={dateStr} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden card-animate">
                                {/* 날짜 헤더 */}
                                <button
                                    className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-100 bg-transparent border-none cursor-pointer hover:from-slate-100 hover:to-slate-100 transition-colors text-left"
                                    onClick={() => toggleDateCollapse(dateStr)}
                                >
                                    {isCollapsed
                                        ? <ChevronRight size={16} className="text-slate-500 shrink-0" />
                                        : <ChevronDown size={16} className="text-slate-500 shrink-0" />}
                                    <span className="text-sm font-bold text-slate-700">
                                        📅 {month}/{dayNum} ({weekday})
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-medium">{items.length}건</span>
                                    <span className="ml-auto text-sm font-extrabold text-slate-800 tabular-nums">
                                        {formatNumber(dayTotal)}원
                                    </span>
                                </button>

                                {/* 채널별 섹션 */}
                                {!isCollapsed && (
                                    <div>
                                        {renderChannelSection('cash', cashItems, dateStr)}
                                        {renderChannelSection('card', cardItems, dateStr)}
                                        {renderChannelSection('delivery', deliveryItems, dateStr)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
