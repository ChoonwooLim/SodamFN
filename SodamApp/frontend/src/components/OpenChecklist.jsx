import { useState } from 'react';
import {
    X, Download, ClipboardList, ChevronDown, ChevronUp,
    Clock, AlertTriangle, CheckCircle2
} from 'lucide-react';

const CHECKLIST_SECTIONS = [
    {
        id: 1,
        emoji: '🍳',
        title: '1. 집기 세팅',
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
        id: 2,
        emoji: '🐟',
        title: '2. 어묵 준비',
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
    {
        id: 3,
        emoji: '🥓',
        title: '3. 스팸 굽기',
        items: [
            { text: '약한 불에 굽기', type: 'check' },
        ]
    },
    {
        id: 4,
        emoji: '🍙',
        title: '4. 전날 재고 확인',
        items: [
            { text: '순대', type: 'check' },
            { text: '계란', type: 'check' },
            { text: '어묵', type: 'check' },
            { text: '→ 남은 계란 / 어묵 개수는 매일 체크리스트에 기록', type: 'info' },
        ]
    },
    {
        id: 5,
        emoji: '🐟',
        title: '5. 꼬치어묵',
        items: [
            { text: '끝이 빠지지 않도록 단단히 꽂기', type: 'check' },
        ]
    },
    {
        id: 6,
        emoji: '🔥',
        title: '6. 순대 데우기',
        items: [
            { text: '새 순대', type: 'highlight' },
            { text: '위 5분', type: 'sub' },
            { text: '아래 5분', type: 'sub' },
            { text: '남은 순대', type: 'highlight' },
            { text: '위 2~3분', type: 'sub' },
            { text: '아래 2~3분 (양 보고 조절)', type: 'sub' },
            { text: '⚠️ 너무 데우면 껍질이 터집니다', type: 'warning' },
            { text: '⚠️ 약간 덜 데운 느낌이어도 OK', type: 'warning' },
            { text: '→ 6시 영업 전까지 1시간 30분 동안 밥통에서 충분히 쪄집니다', type: 'info' },
            { text: '전자레인지 실수 방지', type: 'info' },
            { text: '→ 다 넣을 때까지 밥통 뚜껑 열어두기', type: 'sub' },
            { text: '→ 마지막에 닫기', type: 'sub' },
        ]
    },
    {
        id: 7,
        emoji: '🧅',
        title: '7. 파 종이컵 준비',
        items: [
            { text: '종이컵에 파 2~3조각씩 넣기', type: 'check' },
            { text: '20개 준비', type: 'check' },
            { text: '여유 종이컵 부족 시 꺼내기', type: 'check' },
        ]
    },
    {
        id: 8,
        emoji: '🥚',
        title: '8. 설거지 후 계란 삶기',
        items: [
            { text: '소금 + 식초 꼭 넣기', type: 'check' },
            { text: '평일 38개', type: 'sub' },
            { text: '주말 28개', type: 'sub' },
            { text: '약한 불에서 삶기 → 끓기 시작하면 15분', type: 'info' },
            { text: '⚠️ 계란 만진 후 반드시 손 씻기', type: 'warning' },
            { text: '⚠️ 식힐 때 살살 다루기 (쉽게 깨짐)', type: 'warning' },
        ]
    },
    {
        id: 9,
        emoji: '🍙',
        title: '9. 주먹밥 타임라인',
        items: [
            { text: '🕐 4:45 — 주먹밥 6종 준비 시작', type: 'timeline' },
            { text: '🕐 5:10 — 주먹밥 만들기 시작', type: 'timeline' },
            { text: '밥 보관 주의', type: 'info' },
            { text: '김밥용 밥이 눌리면 떡이 됨', type: 'sub' },
            { text: '김밥용 밥이 아래 깔려 있으면 → 주먹밥용 밥을 위로 올려두기', type: 'sub' },
            { text: '🕐 6:10까지 (화/목/토 중요!)', type: 'timeline' },
            { text: '스팸 주먹밥', type: 'check' },
            { text: '불고기 주먹밥', type: 'check' },
            { text: '반드시 준비 완료 (병원 손님)', type: 'info' },
            { text: '🕐 6:40까지', type: 'timeline' },
            { text: '멸치 5개 이상', type: 'check' },
            { text: '순한 5개 이상', type: 'check' },
            { text: '매콤 5개 이상', type: 'check' },
            { text: '※ 햄치즈 제외 모든 맛 쇼케이스에 준비', type: 'info' },
            { text: '(각 맛마다 단골이 있습니다)', type: 'info' },
        ]
    },
    {
        id: 10,
        emoji: '🐟',
        title: '10. 어묵',
        items: [
            { text: '🕐 7:30 — 어묵 시작', type: 'timeline' },
            { text: '🕐 7:45 — 불 켜기', type: 'timeline' },
            { text: '🕐 8:40까지', type: 'timeline' },
            { text: '어묵 담기 완료 (중간 바트 3개)', type: 'check' },
            { text: '뚜껑에 오늘 날짜 명확히 작성', type: 'check' },
            { text: '설거지 완료', type: 'check' },
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

export default function OpenChecklist({ isOpen, onClose }) {
    const [expandedSections, setExpandedSections] = useState(new Set([1, 2, 9, 10]));
    const [checkedItems, setCheckedItems] = useState(new Set());

    if (!isOpen) return null;

    const toggleSection = (id) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleCheck = (key) => {
        setCheckedItems(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const totalCheckItems = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.filter(i => i.type === 'check').length, 0);
    const checkedCount = [...checkedItems].filter(k => {
        const [secId, itemIdx] = k.split('-').map(Number);
        const sec = CHECKLIST_SECTIONS.find(s => s.id === secId);
        return sec && sec.items[itemIdx]?.type === 'check';
    }).length;

    const handleDownloadPDF = () => {
        // Open the inventory check image in a new tab for printing/saving as PDF
        const link = document.createElement('a');
        link.href = '/images/checklist/inventory_check.png';
        link.download = '오픈_재고_체크.png';
        link.click();
    };

    const renderItem = (item, secId, idx) => {
        const key = `${secId}-${idx}`;
        const isChecked = checkedItems.has(key);

        if (item.type === 'check') {
            return (
                <label key={key} className="flex items-start gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors select-none">
                    <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCheck(key)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <span className={`text-sm ${isChecked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {item.text}
                    </span>
                </label>
            );
        }
        if (item.type === 'sub') {
            return (
                <div key={key} className="flex items-start gap-2 py-0.5 pl-9 text-sm text-slate-500">
                    <span className="text-slate-300 shrink-0">•</span>
                    <span>{item.text}</span>
                </div>
            );
        }
        if (item.type === 'highlight') {
            return (
                <div key={key} className="flex items-center gap-2 py-1.5 px-2 mt-2">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span className="text-sm font-bold text-slate-800">{item.text}</span>
                </div>
            );
        }
        if (item.type === 'warning') {
            return (
                <div key={key} className="flex items-start gap-2 py-1 px-2 ml-4 text-sm text-amber-700 bg-amber-50 rounded-md my-0.5">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{item.text}</span>
                </div>
            );
        }
        if (item.type === 'timeline') {
            return (
                <div key={key} className="flex items-center gap-2 py-1.5 px-2 mt-1 bg-blue-50 rounded-lg">
                    <Clock size={14} className="text-blue-500 shrink-0" />
                    <span className="text-sm font-semibold text-blue-800">{item.text}</span>
                </div>
            );
        }
        if (item.type === 'info') {
            return (
                <div key={key} className="flex items-start gap-2 py-1 px-2 ml-4 text-sm text-slate-600 italic">
                    <span className="text-blue-400 shrink-0">→</span>
                    <span>{item.text}</span>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-4 relative" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="sticky top-0 z-10 bg-white border-b border-slate-100 rounded-t-2xl px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <ClipboardList size={20} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">📋 오픈 체크리스트</h2>
                                <p className="text-xs text-slate-400">매일 오픈 준비 절차</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                    {/* Progress */}
                    <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                                style={{ width: `${totalCheckItems > 0 ? (checkedCount / totalCheckItems * 100) : 0}%` }}
                            />
                        </div>
                        <span className="text-xs font-bold text-slate-500 whitespace-nowrap">{checkedCount}/{totalCheckItems}</span>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                    {CHECKLIST_SECTIONS.map(section => {
                        const isExpanded = expandedSections.has(section.id);
                        const sectionCheckCount = section.items.filter(i => i.type === 'check').length;
                        const sectionChecked = section.items.filter((item, idx) =>
                            item.type === 'check' && checkedItems.has(`${section.id}-${idx}`)
                        ).length;

                        return (
                            <div key={section.id} className="border border-slate-100 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{section.emoji}</span>
                                        <span className="font-bold text-slate-800 text-sm">{section.title}</span>
                                        {sectionCheckCount > 0 && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sectionChecked === sectionCheckCount
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {sectionChecked}/{sectionCheckCount}
                                            </span>
                                        )}
                                    </div>
                                    {isExpanded
                                        ? <ChevronUp size={16} className="text-slate-400" />
                                        : <ChevronDown size={16} className="text-slate-400" />
                                    }
                                </button>
                                {isExpanded && (
                                    <div className="px-4 pb-3 space-y-0.5 border-t border-slate-50">
                                        {section.items.map((item, idx) => renderItem(item, section.id, idx))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Notice */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4">
                        <h3 className="font-bold text-blue-900 text-sm mb-2">{NOTICE.title}</h3>
                        <ul className="space-y-1">
                            {NOTICE.items.map((item, idx) => (
                                <li key={idx} className="text-xs text-blue-700 leading-relaxed">{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Footer: Inventory Check Download */}
                <div className="sticky bottom-0 bg-white border-t border-slate-100 rounded-b-2xl px-6 py-4">
                    <button
                        onClick={handleDownloadPDF}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700 transition-all"
                    >
                        <Download size={18} />
                        📋 오픈 재고 체크 다운로드
                    </button>
                </div>
            </div>
        </div>
    );
}
