import React from 'react';
import { ChevronRight, ChevronDown, Plus, Edit3, Trash2, Search, ArrowRightLeft, CheckSquare, Square } from 'lucide-react';
import { formatNumber, getWeekday } from '../../utils/format';
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

function getCardColor(note) {
    if (!note) return CARD_COLORS['기타'];
    for (const [card, colors] of Object.entries(CARD_COLORS)) {
        if (note.includes(card)) return colors;
    }
    return CARD_COLORS['기타'];
}

function getCardCompany(note) {
    if (!note) return '';
    const m = note.match(/카드사:([^,]+)/);
    return m ? m[1] : '';
}

export function PurchaseTable({
    viewMode,
    year,
    month,
    loading,
    filteredData,
    sortedDates,
    groupedByDate,
    searchTerm,
    setSearchTerm,
    filterCategory,
    setFilterCategory,
    selectedIds,
    toggleSelect,
    toggleSelectDay,
    collapsedDates,
    toggleDateCollapse,
    openAddModal,
    openEditModal,
    handleDelete,
    toggleCategory,
    handleBatchCategory,
    handleBatchDelete,
    setSelectedIds,
}) {
    const isHouseholdMode = viewMode === 'household';

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 card-animate flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                        <Search size={16} className="text-slate-400" />
                        <input
                            type="text"
                            className="bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400 w-40"
                            placeholder="거래처 검색..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {!isHouseholdMode && (
                        <select
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                        >
                            <option value="all">전체 카테고리</option>
                            {EXPENSE_CATEGORIES.filter(c => c.id !== '개인가계부').map(c => (
                                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                            ))}
                        </select>
                    )}

                    {isHouseholdMode && (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                            📒 가계부 모드 (개인가계부만 표시)
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">총 {filteredData.length}건</span>
                    <button className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl border-none cursor-pointer shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all" onClick={openAddModal}>
                        <Plus size={16} /> {isHouseholdMode ? '생활비 추가' : '매입 추가'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-8 h-8 border-3 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
                    <p className="text-sm text-slate-400">불러오는 중...</p>
                </div>
            ) : filteredData.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 shadow-sm border border-slate-100 text-center card-animate">
                    <div className="text-4xl mb-3">{isHouseholdMode ? '📒' : '📋'}</div>
                    <h3 className="text-base font-bold text-slate-700 mb-1">{isHouseholdMode ? '개인 생활비 내역이 없습니다' : '사업용 매입 내역이 없습니다'}</h3>
                    <p className="text-sm text-slate-400 mb-2">{year}년 {month}월</p>
                    <p className="text-xs text-slate-400">
                        우측 상단 <strong className="text-slate-600">+ 매입 추가</strong> 또는 <strong className="text-slate-600">업로드</strong> 탭에서 데이터를 등록하세요
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedDates.map(dateStr => {
                        const items = groupedByDate[dateStr];
                        const dayTotal = items.reduce((sum, i) => sum + (i.amount || 0), 0);
                        const weekday = getWeekday(dateStr);
                        const dayNum = dateStr.split('-')[2];

                        return (
                            <div key={dateStr} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden card-animate">
                                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-100">
                                    <button
                                        className="text-slate-400 hover:text-orange-500 transition-colors bg-transparent border-none cursor-pointer p-0"
                                        onClick={() => toggleSelectDay(items)}
                                        title="이 날짜 전체 선택/해제"
                                    >
                                        {items.every(i => selectedIds.has(i.id))
                                            ? <CheckSquare size={16} className="text-orange-500" />
                                            : <Square size={16} />}
                                    </button>
                                    <span className="flex items-center gap-1 text-sm font-bold text-slate-700 cursor-pointer select-none" onClick={() => toggleDateCollapse(dateStr)}>
                                        {collapsedDates.has(dateStr) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                        📅 {month}/{dayNum} ({weekday})
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-medium ml-1">{items.length}건</span>
                                    <span className="text-sm font-extrabold text-slate-800 ml-auto tabular-nums">{formatNumber(dayTotal)}원</span>
                                </div>
                                {!collapsedDates.has(dateStr) && (
                                    <div className="divide-y divide-slate-50">
                                        {items.map(item => {
                                            const cardCompany = getCardCompany(item.note);
                                            const cardColor = getCardColor(item.note);
                                            const catInfo = EXPENSE_CATEGORIES.find(c => c.id === item.category) || EXPENSE_CATEGORIES[5];

                                            return (
                                                <div key={item.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${selectedIds.has(item.id) ? 'bg-orange-50/50' : 'hover:bg-slate-50/50'}`}>
                                                    <label className="cursor-pointer shrink-0" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 accent-orange-500"
                                                            checked={selectedIds.has(item.id)}
                                                            onChange={() => toggleSelect(item.id)}
                                                        />
                                                    </label>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-slate-700 truncate">{item.vendor_name}</div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {cardCompany && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ background: cardColor.bg, color: cardColor.text, borderColor: cardColor.border }}>
                                                                    {cardCompany}
                                                                </span>
                                                            )}
                                                            <span className="text-[11px] font-medium" style={{ color: catInfo.color }}>
                                                                {catInfo.icon} {catInfo.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-sm font-bold text-slate-800 tabular-nums">{formatNumber(item.amount)}원</div>
                                                        <div className="flex items-center gap-1 mt-1 justify-end">
                                                            <button
                                                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-500 border-none cursor-pointer flex items-center justify-center transition-colors"
                                                                onClick={() => toggleCategory(item)}
                                                                title={isHouseholdMode ? "사업비용으로 변경" : "개인비용으로 변경"}
                                                            >
                                                                <ArrowRightLeft size={13} />
                                                            </button>
                                                            <button className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-500 border-none cursor-pointer flex items-center justify-center transition-colors" onClick={() => openEditModal(item)} title="수정">
                                                                <Edit3 size={13} />
                                                            </button>
                                                            <button className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 border-none cursor-pointer flex items-center justify-center transition-colors" onClick={() => handleDelete(item.id)} title="삭제">
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Batch Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700 px-5 py-3 flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold text-white">✅ {selectedIds.size}건 선택</span>
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer"
                            defaultValue=""
                            onChange={(e) => {
                                if (e.target.value) {
                                    handleBatchCategory(e.target.value);
                                    e.target.value = '';
                                }
                            }}
                        >
                            <option value="" disabled>📂 카테고리 변경</option>
                            {EXPENSE_CATEGORIES.map(c => (
                                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                            ))}
                        </select>
                        {!isHouseholdMode && (
                            <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-600 text-white border-none cursor-pointer hover:bg-violet-500 transition-colors" onClick={() => handleBatchCategory('개인가계부')}>
                                👤 개인비용 전환
                            </button>
                        )}
                        {isHouseholdMode && (
                            <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white border-none cursor-pointer hover:bg-blue-500 transition-colors" onClick={() => handleBatchCategory('기타비용')}>
                                💼 사업비용 전환
                            </button>
                        )}
                        <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600 text-white border-none cursor-pointer hover:bg-red-500 transition-colors" onClick={handleBatchDelete}>
                            🗑️ 삭제
                        </button>
                        <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 border-none cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => setSelectedIds(new Set())}>
                            ✕ 선택해제
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
