import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';

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
            { text: '→ 남은 계란 / 어묵 개수는 아래 재고 체크에 기록', type: 'info' },
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

export default function OpenChecklist() {
    const navigate = useNavigate();
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

    const totalCheckItems = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.filter(i => i.type === 'check').length, 0);
    const checkedCount = [...checkedItems].filter(k => {
        const [secId, itemIdx] = k.split('-').map(Number);
        const sec = CHECKLIST_SECTIONS.find(s => s.id === secId);
        return sec && sec.items[itemIdx]?.type === 'check';
    }).length;
    const progress = totalCheckItems > 0 ? (checkedCount / totalCheckItems * 100) : 0;

    const renderItem = (item, secId, idx) => {
        const key = `${secId}-${idx}`;
        const isChecked = checkedItems.has(key);
        const styles = {
            check: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 8px', borderRadius: 8 },
            sub: { display: 'flex', gap: 6, padding: '2px 8px', paddingLeft: 36, fontSize: '0.82rem', color: '#64748b' },
            highlight: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', marginTop: 8, fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' },
            warning: { display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 10px', marginLeft: 16, fontSize: '0.8rem', color: '#b45309', background: '#fffbeb', borderRadius: 8, marginTop: 2 },
            timeline: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', marginTop: 4, background: '#eff6ff', borderRadius: 8, fontWeight: 600, fontSize: '0.82rem', color: '#1e40af' },
            info: { display: 'flex', alignItems: 'flex-start', gap: 6, padding: '3px 8px', marginLeft: 16, fontSize: '0.8rem', color: '#475569', fontStyle: 'italic' },
        };
        if (item.type === 'check') {
            return (
                <label key={key} style={{ ...styles.check, cursor: 'pointer' }}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(key)}
                        style={{ width: 18, height: 18, marginTop: 2, accentColor: '#10b981', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.85rem', color: isChecked ? '#94a3b8' : '#1e293b', textDecoration: isChecked ? 'line-through' : 'none' }}>
                        {item.text}
                    </span>
                </label>
            );
        }
        if (item.type === 'sub') return <div key={key} style={styles.sub}><span style={{ color: '#cbd5e1' }}>•</span><span>{item.text}</span></div>;
        if (item.type === 'highlight') return <div key={key} style={styles.highlight}>✅ {item.text}</div>;
        if (item.type === 'warning') return <div key={key} style={styles.warning}>⚠️ {item.text}</div>;
        if (item.type === 'timeline') return <div key={key} style={styles.timeline}>{item.text}</div>;
        if (item.type === 'info') return <div key={key} style={styles.info}><span style={{ color: '#60a5fa' }}>→</span><span>{item.text}</span></div>;
        return null;
    };

    return (
        <div className="page animate-fade" style={{ paddingBottom: 80 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <ArrowLeft size={22} color="#475569" />
                </button>
                <div>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>📋 오픈 체크리스트</h1>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>매일 오픈 준비 절차</p>
                </div>
            </div>

            {/* Progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #10b981, #14b8a6)', borderRadius: 8, transition: 'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{checkedCount}/{totalCheckItems}</span>
            </div>

            {/* Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CHECKLIST_SECTIONS.map(section => {
                    const isExpanded = expandedSections.has(section.id);
                    const sectionCheckCount = section.items.filter(i => i.type === 'check').length;
                    const sectionChecked = section.items.filter((item, idx) => item.type === 'check' && checkedItems.has(`${section.id}-${idx}`)).length;
                    return (
                        <div key={section.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                            <button onClick={() => toggleSection(section.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '1.1rem' }}>{section.emoji}</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>{section.title}</span>
                                    {sectionCheckCount > 0 && (
                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12, fontWeight: 600, background: sectionChecked === sectionCheckCount ? '#dcfce7' : '#f1f5f9', color: sectionChecked === sectionCheckCount ? '#16a34a' : '#64748b' }}>
                                            {sectionChecked}/{sectionCheckCount}
                                        </span>
                                    )}
                                </div>
                                {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                            </button>
                            {isExpanded && (
                                <div style={{ padding: '0 14px 12px', borderTop: '1px solid #f1f5f9' }}>
                                    {section.items.map((item, idx) => renderItem(item, section.id, idx))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Notice */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 14, marginTop: 16 }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e3a5f', marginBottom: 8 }}>😊 안내사항</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {['속도보다 정확성과 안전이 우선입니다.', '처음에는 느릴 수 있습니다. 손에 익으면 빨라집니다.', '추후 홀/배달/맛살 손질 추가 시 시간 재조정 예정'].map((t, i) => (
                        <li key={i} style={{ fontSize: '0.75rem', color: '#1e40af', lineHeight: 1.8 }}>• {t}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
