import { useState } from 'react';
import {
    ClipboardList, ChevronDown, ChevronUp,
    Clock, AlertTriangle, CheckCircle2
} from 'lucide-react';

const CHECKLIST_SECTIONS = [
    {
        id: 1, emoji: '🍳', title: '1. 집기 세팅',
        items: [
            { text: '집기류 꺼내서 제자리에 두기', type: 'check' },
            { text: '순대밥통 / 어묵통 코드 꽂고 전원 확인', type: 'check' },
            { text: '순대밥통 → 전원 ON', type: 'sub' },
            { text: '어묵통 → 전원 OFF', type: 'sub' },
            { text: '순대밥통에 뜨거운 물 붓기', type: 'check' },
            { text: '떡볶이 국자 통에 찬물 담고 국자 2개 넣어두기', type: 'check' },
            { text: '행주 정리', type: 'check' },
            { text: '2개 → 물받침용', type: 'sub' },
            { text: '2개 → 쟁반 닦이 / 홀 테이블 닦기용', type: 'sub' },
        ]
    },
    {
        id: 2, emoji: '🐟', title: '2. 어묵 준비',
        items: [
            { text: '어묵 국물 만들기', type: 'highlight' },
            { text: '눈금선까지 물 채우기', type: 'check' },
            { text: '참치액 3스푼', type: 'check' },
            { text: '가루 1봉지', type: 'check' },
            { text: '평일 → 2통', type: 'sub' },
            { text: '토요일 → 주방장님과 상의 후 수량 결정', type: 'sub' },
            { text: '물이 끓으면 → 새 어묵부터 삶기', type: 'info' },
            { text: '어묵 삶는 기준', type: 'highlight' },
            { text: '평일 35개 기준', type: 'sub' },
            { text: '토요일 30개 넘지 않기', type: 'sub' },
            { text: '전날 남은 어묵 개수 참고', type: 'sub' },
            { text: '남은 어묵 처리', type: 'info' },
            { text: '5개 이하 → 새 어묵 종료 1분 30초 전 같이 넣기', type: 'sub' },
            { text: '6개 이상 → 따로 1분 30초~2분 데우기', type: 'sub' },
            { text: '⚠️ 너무 오래 데우면 어묵이 불어요', type: 'warning' },
            { text: '보관', type: 'highlight' },
            { text: '15개 이상 → 큰 봉지', type: 'sub' },
            { text: '15개 미만 → 중간 봉지', type: 'sub' },
            { text: '새 어묵 20개는 따로 보관', type: 'sub' },
            { text: '바로 판매할 어묵은 어묵통 앞에 두기', type: 'sub' },
        ]
    },
    { id: 3, emoji: '🥓', title: '3. 스팸 굽기', items: [{ text: '약한 불에 굽기', type: 'check' }] },
    {
        id: 4, emoji: '🍙', title: '4. 전날 재고 확인',
        items: [
            { text: '순대', type: 'check' }, { text: '계란', type: 'check' }, { text: '어묵', type: 'check' },
            { text: '→ 남은 재고는 재고 체크 메뉴에서 기록', type: 'info' },
        ]
    },
    { id: 5, emoji: '🐟', title: '5. 꼬치어묵', items: [{ text: '끝이 빠지지 않도록 단단히 꽂기', type: 'check' }] },
    {
        id: 6, emoji: '🔥', title: '6. 순대 데우기',
        items: [
            { text: '새 순대', type: 'highlight' }, { text: '위 5분', type: 'sub' }, { text: '아래 5분', type: 'sub' },
            { text: '남은 순대', type: 'highlight' }, { text: '위 2~3분', type: 'sub' }, { text: '아래 2~3분 (양 보고 조절)', type: 'sub' },
            { text: '⚠️ 너무 데우면 껍질이 터집니다', type: 'warning' },
            { text: '⚠️ 약간 덜 데운 느낌이어도 OK', type: 'warning' },
            { text: '→ 6시 영업 전까지 1시간 30분 동안 밥통에서 충분히 쪄집니다', type: 'info' },
        ]
    },
    {
        id: 7, emoji: '🧅', title: '7. 파 종이컵 준비',
        items: [{ text: '종이컵에 파 2~3조각씩 넣기', type: 'check' }, { text: '20개 준비', type: 'check' }, { text: '여유 종이컵 부족 시 꺼내기', type: 'check' }]
    },
    {
        id: 8, emoji: '🥚', title: '8. 설거지 후 계란 삶기',
        items: [
            { text: '소금 + 식초 꼭 넣기', type: 'check' }, { text: '평일 38개', type: 'sub' }, { text: '주말 28개', type: 'sub' },
            { text: '약한 불에서 삶기 → 끓기 시작하면 15분', type: 'info' },
            { text: '⚠️ 계란 만진 후 반드시 손 씻기', type: 'warning' },
            { text: '⚠️ 식힐 때 살살 다루기 (쉽게 깨짐)', type: 'warning' },
        ]
    },
    {
        id: 9, emoji: '🍙', title: '9. 주먹밥 타임라인',
        items: [
            { text: '🕐 4:45 — 주먹밥 6종 준비 시작', type: 'timeline' },
            { text: '🕐 5:10 — 주먹밥 만들기 시작', type: 'timeline' },
            { text: '🕐 6:10까지 (화/목/토 중요!)', type: 'timeline' },
            { text: '스팸 주먹밥', type: 'check' }, { text: '불고기 주먹밥', type: 'check' },
            { text: '🕐 6:40까지', type: 'timeline' },
            { text: '멸치 5개 이상', type: 'check' }, { text: '순한 5개 이상', type: 'check' }, { text: '매콤 5개 이상', type: 'check' },
            { text: '※ 햄치즈 제외 모든 맛 쇼케이스에 준비', type: 'info' },
            { text: '(각 맛마다 단골이 있습니다)', type: 'info' },
        ]
    },
    {
        id: 10, emoji: '🐟', title: '10. 어묵',
        items: [
            { text: '🕐 7:30 — 어묵 시작', type: 'timeline' }, { text: '🕐 7:45 — 불 켜기', type: 'timeline' }, { text: '🕐 8:40까지', type: 'timeline' },
            { text: '어묵 담기 완료 (중간 바트 3개)', type: 'check' }, { text: '뚜껑에 오늘 날짜 명확히 작성', type: 'check' }, { text: '설거지 완료', type: 'check' },
        ]
    },
];

const NOTICE = {
    title: '😊 안내사항',
    items: [
        '※ 위 시간은 홀 없음 / 배달 없음 / 업무가 익숙해질 때까지 기준',
        '추후 홀 / 배달 / 맛살 손질 추가 시 → 시간 재조정 예정',
        '처음에는 느릴 수 있습니다. 손에 익으면 빨라집니다.',
        '속도보다 정확성과 안전이 우선입니다.',
    ]
};

export default function OpenChecklistPage() {
    const [expandedSections, setExpandedSections] = useState(new Set([1, 2, 9, 10]));
    const [checkedItems, setCheckedItems] = useState(new Set());

    const toggleSection = (id) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleCheck = (key) => {
        setCheckedItems(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const expandAll = () => setExpandedSections(new Set(CHECKLIST_SECTIONS.map(s => s.id)));
    const collapseAll = () => setExpandedSections(new Set());

    const totalCheckItems = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.filter(i => i.type === 'check').length, 0);
    const checkedCount = [...checkedItems].filter(k => {
        const [secId, itemIdx] = k.split('-').map(Number);
        const sec = CHECKLIST_SECTIONS.find(s => s.id === secId);
        return sec && sec.items[itemIdx]?.type === 'check';
    }).length;
    const progress = totalCheckItems > 0 ? Math.round(checkedCount / totalCheckItems * 100) : 0;

    const renderItem = (item, secId, idx) => {
        const key = `${secId}-${idx}`;
        const isChecked = checkedItems.has(key);

        if (item.type === 'check') {
            return (
                <label key={key} className="flex items-start gap-3 py-1.5 cursor-pointer group hover:bg-slate-50/50 rounded-lg px-2 -mx-2 transition-colors">
                    <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(key)}
                        className="mt-0.5 w-[18px] h-[18px] accent-emerald-500 flex-shrink-0 cursor-pointer" />
                    <span className={`text-sm leading-relaxed transition-colors ${isChecked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        {item.text}
                    </span>
                </label>
            );
        }
        if (item.type === 'sub') return (
            <div key={key} className="flex gap-2 pl-10 text-xs text-slate-500">
                <span className="text-slate-300">•</span><span>{item.text}</span>
            </div>
        );
        if (item.type === 'highlight') return (
            <div key={key} className="flex items-center gap-2 mt-3 mb-1 font-bold text-sm text-slate-800">
                <CheckCircle2 size={15} className="text-emerald-500" />{item.text}
            </div>
        );
        if (item.type === 'warning') return (
            <div key={key} className="flex items-start gap-2 ml-6 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-1 border border-amber-100">
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /><span>{item.text}</span>
            </div>
        );
        if (item.type === 'timeline') return (
            <div key={key} className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2 mt-1.5 font-semibold text-xs text-blue-800 border border-blue-100">
                <Clock size={13} /><span>{item.text}</span>
            </div>
        );
        if (item.type === 'info') return (
            <div key={key} className="flex items-start gap-2 ml-6 text-xs text-slate-500 italic py-0.5">
                <span className="text-blue-400 font-bold">→</span><span>{item.text}</span>
            </div>
        );
        return null;
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 rounded-xl">
                            <ClipboardList size={24} className="text-emerald-700" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">오픈 체크리스트</h1>
                            <p className="text-sm text-slate-500">매일 오픈 준비 10단계</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={expandAll}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                            전체 펼치기
                        </button>
                        <button onClick={collapseAll}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                            전체 접기
                        </button>
                    </div>
                </div>

                {/* Progress Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-sm text-slate-700">진행률</span>
                        <span className={`text-sm font-black ${progress === 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                            {checkedCount} / {totalCheckItems} ({progress}%)
                        </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }} />
                    </div>
                    {progress === 100 && (
                        <div className="mt-3 text-center text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl py-2 border border-emerald-100">
                            🎉 모든 항목을 완료했습니다!
                        </div>
                    )}
                </div>

                {/* Checklist Sections */}
                <div className="space-y-3">
                    {CHECKLIST_SECTIONS.map(section => {
                        const isExpanded = expandedSections.has(section.id);
                        const sectionCheckCount = section.items.filter(i => i.type === 'check').length;
                        const sectionChecked = section.items.filter((item, idx) =>
                            item.type === 'check' && checkedItems.has(`${section.id}-${idx}`)
                        ).length;
                        const sectionDone = sectionCheckCount > 0 && sectionChecked === sectionCheckCount;

                        return (
                            <div key={section.id}
                                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-colors ${sectionDone ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{section.emoji}</span>
                                        <span className="font-bold text-sm text-slate-800">{section.title}</span>
                                        {sectionCheckCount > 0 && (
                                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${sectionDone
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {sectionChecked}/{sectionCheckCount}
                                            </span>
                                        )}
                                    </div>
                                    {isExpanded
                                        ? <ChevronUp size={18} className="text-slate-400" />
                                        : <ChevronDown size={18} className="text-slate-400" />
                                    }
                                </button>
                                {isExpanded && (
                                    <div className="px-5 pb-4 space-y-0.5 border-t border-slate-100 pt-2">
                                        {section.items.map((item, idx) => renderItem(item, section.id, idx))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Notice */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mt-6">
                    <h3 className="font-bold text-blue-900 text-sm mb-3">{NOTICE.title}</h3>
                    <ul className="space-y-1.5">
                        {NOTICE.items.map((item, idx) => (
                            <li key={idx} className="text-xs text-blue-700 leading-relaxed">• {item}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
