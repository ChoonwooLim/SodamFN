/**
 * 회사 직인 (Company Seal) 렌더러
 *
 * 10가지 전통/현대 인장 스타일. 회사명 텍스트를 받아 SVG로 렌더링합니다.
 * 계약서·증명서 등에 재사용할 수 있도록 독립 컴포넌트로 분리.
 */

function wrapText(text, maxPerLine = 2) {
    const t = (text || '').trim();
    if (!t) return [''];
    if (t.length <= maxPerLine) return [t];
    // 간단한 줄바꿈: maxPerLine 글자씩
    const lines = [];
    for (let i = 0; i < t.length; i += maxPerLine) {
        lines.push(t.slice(i, i + maxPerLine));
    }
    return lines;
}

// 공통: 한국 전통 명조체 폰트 스택
const FONT_TRAD = 'Nanum Myeongjo, "Noto Serif KR", serif';
const FONT_MOD = 'Pretendard, "Noto Sans KR", sans-serif';

const styles = {
    // 1. 클래식 원형 적색 (가장 표준적인 법인 직인)
    'seal-01': {
        name: '클래식 원형',
        description: '전통 적색 원형 인장. 가장 보편적인 법인 직인 형태.',
        render: (text) => {
            const lines = wrapText(text, 2);
            const fontSize = lines.length > 1 ? 42 : 54;
            return (
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="100" cy="100" r="88" fill="#c1272d" />
                    <circle cx="100" cy="100" r="88" fill="none" stroke="#8b1a1f" strokeWidth="3" />
                    <g fontFamily={FONT_TRAD} fontWeight="900" fill="#fff8f0" textAnchor="middle">
                        {lines.map((l, i) => (
                            <text key={i} x="100" y={lines.length === 1 ? 118 : 90 + i * 50} fontSize={fontSize}>{l}</text>
                        ))}
                    </g>
                </svg>
            );
        },
    },

    // 2. 이중 원 (Double Ring) — 격식 있는 느낌
    'seal-02': {
        name: '이중 원',
        description: '바깥과 안쪽 이중 선. 격식 있는 공식 인장.',
        render: (text) => {
            const lines = wrapText(text, 2);
            const fontSize = lines.length > 1 ? 36 : 48;
            return (
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="100" cy="100" r="92" fill="#c1272d" />
                    <circle cx="100" cy="100" r="92" fill="none" stroke="#7a161a" strokeWidth="4" />
                    <circle cx="100" cy="100" r="72" fill="none" stroke="#fef2f2" strokeWidth="2" />
                    <g fontFamily={FONT_TRAD} fontWeight="900" fill="#fff8f0" textAnchor="middle">
                        {lines.map((l, i) => (
                            <text key={i} x="100" y={lines.length === 1 ? 115 : 92 + i * 42} fontSize={fontSize}>{l}</text>
                        ))}
                    </g>
                </svg>
            );
        },
    },

    // 3. 사각 인장 (Square Stamp) — 한자 직인 풍
    'seal-03': {
        name: '사각 인장',
        description: '전통 한자식 사각 인장. 세로 배치.',
        render: (text) => {
            const chars = (text || '').slice(0, 4).split('');
            return (
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <rect x="20" y="20" width="160" height="160" rx="6" fill="#c1272d" />
                    <rect x="20" y="20" width="160" height="160" rx="6" fill="none" stroke="#7a161a" strokeWidth="5" />
                    <rect x="32" y="32" width="136" height="136" rx="3" fill="none" stroke="#fef2f2" strokeWidth="1.5" />
                    <g fontFamily={FONT_TRAD} fontWeight="900" fill="#fff8f0" textAnchor="middle">
                        {chars.length <= 2 ? (
                            chars.map((c, i) => (
                                <text key={i} x="100" y={80 + i * 50} fontSize="56">{c}</text>
                            ))
                        ) : (
                            // 4자: 2x2 배치
                            chars.map((c, i) => {
                                const col = i % 2;
                                const row = Math.floor(i / 2);
                                return <text key={i} x={65 + col * 70} y={90 + row * 55} fontSize="46">{c}</text>;
                            })
                        )}
                    </g>
                </svg>
            );
        },
    },

    // 4. 톱니 테두리 (Scalloped) — 장식적
    'seal-04': {
        name: '톱니 테두리',
        description: '주변에 작은 점 장식을 넣은 화려한 인장.',
        render: (text) => {
            const lines = wrapText(text, 2);
            const fontSize = lines.length > 1 ? 40 : 52;
            const dots = Array.from({ length: 24 }).map((_, i) => {
                const angle = (i / 24) * 2 * Math.PI;
                const x = 100 + 92 * Math.cos(angle);
                const y = 100 + 92 * Math.sin(angle);
                return <circle key={i} cx={x} cy={y} r="3" fill="#c1272d" />;
            });
            return (
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    {dots}
                    <circle cx="100" cy="100" r="80" fill="#c1272d" />
                    <circle cx="100" cy="100" r="80" fill="none" stroke="#8b1a1f" strokeWidth="2.5" />
                    <g fontFamily={FONT_TRAD} fontWeight="900" fill="#fff8f0" textAnchor="middle">
                        {lines.map((l, i) => (
                            <text key={i} x="100" y={lines.length === 1 ? 116 : 92 + i * 46} fontSize={fontSize}>{l}</text>
                        ))}
                    </g>
                </svg>
            );
        },
    },

    // 5. 모던 블루 (Modern Blue) — 현대적 전문가 느낌
    'seal-05': {
        name: '모던 블루',
        description: '청색 얇은 원. 모던하고 전문적인 느낌.',
        render: (text) => {
            const lines = wrapText(text, 3);
            const fontSize = lines.length > 1 ? 30 : 38;
            return (
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="100" cy="100" r="88" fill="none" stroke="#1e40af" strokeWidth="6" />
                    <circle cx="100" cy="100" r="72" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
                    <g fontFamily={FONT_MOD} fontWeight="800" fill="#1e3a8a" textAnchor="middle">
                        {lines.map((l, i) => (
                            <text key={i} x="100" y={lines.length === 1 ? 113 : 92 + i * 34} fontSize={fontSize}>{l}</text>
                        ))}
                    </g>
                </svg>
            );
        },
    },

    // 6. 프리미엄 골드 (Gold Premium) — 고급스러운 느낌
    'seal-06': {
        name: '프리미엄 골드',
        description: '골드 그라데이션의 고급스러운 인장.',
        render: (text) => {
            const lines = wrapText(text, 2);
            const fontSize = lines.length > 1 ? 38 : 50;
            return (
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <radialGradient id="goldGrad" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#fcd34d" />
                            <stop offset="60%" stopColor="#d97706" />
                            <stop offset="100%" stopColor="#92400e" />
                        </radialGradient>
                    </defs>
                    <circle cx="100" cy="100" r="90" fill="url(#goldGrad)" />
                    <circle cx="100" cy="100" r="90" fill="none" stroke="#78350f" strokeWidth="3" />
                    <circle cx="100" cy="100" r="74" fill="none" stroke="#fef3c7" strokeWidth="1.5" />
                    <g fontFamily={FONT_TRAD} fontWeight="900" fill="#78350f" textAnchor="middle">
                        {lines.map((l, i) => (
                            <text key={i} x="100" y={lines.length === 1 ? 116 : 94 + i * 44} fontSize={fontSize}>{l}</text>
                        ))}
                    </g>
                </svg>
            );
        },
    },

    // 7. 블랙 포멀 (Black Formal) — 엄숙한 공식 느낌
    'seal-07': {
        name: '블랙 포멀',
        description: '검은색 원형. 엄숙한 공식 문서용.',
        render: (text) => {
            const lines = wrapText(text, 2);
            const fontSize = lines.length > 1 ? 38 : 50;
            return (
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="100" cy="100" r="88" fill="#1f2937" />
                    <circle cx="100" cy="100" r="88" fill="none" stroke="#000" strokeWidth="3" />
                    <circle cx="100" cy="100" r="70" fill="none" stroke="#f3f4f6" strokeWidth="1.5" />
                    <g fontFamily={FONT_TRAD} fontWeight="900" fill="#f3f4f6" textAnchor="middle">
                        {lines.map((l, i) => (
                            <text key={i} x="100" y={lines.length === 1 ? 116 : 94 + i * 44} fontSize={fontSize}>{l}</text>
                        ))}
                    </g>
                </svg>
            );
        },
    },

    // 8. 꽃문양 (Floral) — 장식적, 전통미
    'seal-08': {
        name: '꽃문양',
        description: '꽃문양 테두리. 전통미를 살린 장식적 인장.',
        render: (text) => {
            const lines = wrapText(text, 2);
            const fontSize = lines.length > 1 ? 36 : 48;
            const petals = Array.from({ length: 12 }).map((_, i) => {
                const angle = (i / 12) * 2 * Math.PI;
                const x = 100 + 84 * Math.cos(angle);
                const y = 100 + 84 * Math.sin(angle);
                return <circle key={i} cx={x} cy={y} r="5" fill="#c1272d" />;
            });
            return (
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    {petals}
                    <circle cx="100" cy="100" r="76" fill="#c1272d" />
                    <circle cx="100" cy="100" r="76" fill="none" stroke="#8b1a1f" strokeWidth="2" />
                    <circle cx="100" cy="100" r="64" fill="none" stroke="#fef2f2" strokeWidth="1" strokeDasharray="2,3" />
                    <g fontFamily={FONT_TRAD} fontWeight="900" fill="#fff8f0" textAnchor="middle">
                        {lines.map((l, i) => (
                            <text key={i} x="100" y={lines.length === 1 ? 115 : 92 + i * 42} fontSize={fontSize}>{l}</text>
                        ))}
                    </g>
                </svg>
            );
        },
    },

    // 9. 미니멀 (Minimal) — 얇은 선, 현대적
    'seal-09': {
        name: '미니멀',
        description: '얇은 선의 깔끔한 인장. 캐주얼 사업장용.',
        render: (text) => {
            const lines = wrapText(text, 3);
            const fontSize = lines.length > 1 ? 28 : 36;
            return (
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="100" cy="100" r="85" fill="#fef2f2" />
                    <circle cx="100" cy="100" r="85" fill="none" stroke="#c1272d" strokeWidth="3" />
                    <g fontFamily={FONT_MOD} fontWeight="800" fill="#c1272d" textAnchor="middle">
                        {lines.map((l, i) => (
                            <text key={i} x="100" y={lines.length === 1 ? 112 : 92 + i * 32} fontSize={fontSize}>{l}</text>
                        ))}
                    </g>
                </svg>
            );
        },
    },

    // 10. 대표이사 직인 (CEO Stamp) — 직함 포함
    'seal-10': {
        name: '대표이사 직인',
        description: '"대표이사 + 회사명 + 印" 포맷. 공식 법인 대표 직인.',
        render: (text) => {
            const name = wrapText(text, 3)[0] || '';
            return (
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="100" cy="100" r="90" fill="#c1272d" />
                    <circle cx="100" cy="100" r="90" fill="none" stroke="#7a161a" strokeWidth="3" />
                    <circle cx="100" cy="100" r="76" fill="none" stroke="#fef2f2" strokeWidth="1.5" />
                    <g fontFamily={FONT_TRAD} fontWeight="900" fill="#fff8f0" textAnchor="middle">
                        <text x="100" y="62" fontSize="20" letterSpacing="2">대표이사</text>
                        <text x="100" y="115" fontSize={name.length > 3 ? 36 : 44}>{name}</text>
                        <text x="100" y="158" fontSize="24">印</text>
                    </g>
                </svg>
            );
        },
    },

    // 11. English Traditional Seal — 영문 전각 스타일 원형 낙관
    'seal-11': {
        name: 'English Traditional',
        description: 'Round red seal with English name in carved seal-script style. Mirrors a traditional East Asian 낙관.',
        render: (text) => {
            const words = (text || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
            const line1 = words[0] || '';
            const line2 = words.slice(1).join(' ');
            const longest = Math.max(line1.length, line2.length, 3);
            const fs = Math.max(20, Math.min(40, Math.floor(180 / longest)));
            return (
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <filter id="sealRough11" x="-10%" y="-10%" width="120%" height="120%">
                            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" />
                            <feDisplacementMap in="SourceGraphic" scale="2.2" />
                        </filter>
                    </defs>
                    <g filter="url(#sealRough11)">
                        <circle cx="100" cy="100" r="90" fill="#b71c1c" />
                        <circle cx="100" cy="100" r="90" fill="none" stroke="#7f0f10" strokeWidth="3" />
                        <circle cx="100" cy="100" r="74" fill="none" stroke="#ffe9e0" strokeWidth="1.5" />
                        <g fontFamily={'Georgia, "Times New Roman", serif'} fontWeight="900" fill="#fff3ec" textAnchor="middle" letterSpacing="3">
                            {line2 ? (
                                <>
                                    <text x="100" y="92" fontSize={fs}>{line1}</text>
                                    <text x="100" y="134" fontSize={fs}>{line2}</text>
                                </>
                            ) : (
                                <text x="100" y="115" fontSize={fs + 4}>{line1}</text>
                            )}
                        </g>
                    </g>
                </svg>
            );
        },
    },
};

export const SEAL_STYLES = Object.entries(styles).map(([key, v]) => ({
    key,
    name: v.name,
    description: v.description,
}));

export function CompanySeal({ style = 'seal-01', text = '회사명', size = 120, rotate = 0 }) {
    const entry = styles[style] || styles['seal-01'];
    return (
        <div
            style={{
                width: size,
                height: size,
                transform: rotate ? `rotate(${rotate}deg)` : undefined,
                display: 'inline-block',
            }}
        >
            {entry.render(text)}
        </div>
    );
}

export default CompanySeal;
