import { useState } from 'react';
import {
    BookOpen, ChevronDown, ChevronRight, Info, CheckCircle, AlertTriangle,
    LayoutDashboard, BarChart3, Wallet, PieChart, Receipt, Users, Truck, CreditCard,
    Upload, Globe, ClipboardList, Settings, HelpCircle, MousePointerClick, LogIn,
    Sparkles, FileText, Smartphone
} from 'lucide-react';
import './UserManual.css';

// ── 메뉴 지도 데이터 ──
const MENU_MAP = [
    { icon: LayoutDashboard, name: '대시보드', what: '오늘·이번 달 매출과 이익을 한 화면에서 봅니다', when: '매일 아침 가게 상태를 확인할 때' },
    { icon: BarChart3, name: '매출관리', what: '현금·카드·배달앱 매출을 날짜별로 봅니다', when: '얼마 팔렸는지 확인하거나 매출 자료를 올릴 때' },
    { icon: Wallet, name: '비용관리', what: '재료비·임차료·공과금 등 나간 돈을 정리합니다', when: '카드내역·통장내역을 올려 지출을 모을 때' },
    { icon: PieChart, name: '손익계산서', what: '매출에서 비용을 뺀 “진짜 이익”을 보여줍니다', when: '이번 달 얼마 벌었는지 알고 싶을 때' },
    { icon: Truck, name: '배달앱관리', what: '배민·쿠팡이츠·요기요 정산과 수수료를 봅니다', when: '배달앱에서 돈이 얼마 들어왔나 확인할 때' },
    { icon: CreditCard, name: '카드관리', what: '카드사 매출과 입금(정산)을 맞춰봅니다', when: '카드 매출이 통장에 제대로 들어왔나 볼 때' },
    { icon: Users, name: '직원관리', what: '직원 정보·근무·급여(주휴수당 포함)를 관리합니다', when: '월급 계산하고 명세서를 만들 때' },
    { icon: Receipt, name: '전자세금계산서·현금영수증', what: '세금 증빙 서류를 발행하고 모읍니다', when: '거래처에 계산서를 끊거나 증빙이 필요할 때' },
    { icon: Globe, name: '외부 연동·자동수집', what: '은행·카드·배달앱을 연결해 자동으로 자료를 받습니다', when: '매번 손으로 안 올리고 자동화하고 싶을 때' },
    { icon: ClipboardList, name: '통합게시판', what: '공지·건의·오픈 체크리스트로 직원과 소통합니다', when: '직원에게 공지하거나 오픈 준비를 점검할 때' },
];

// ── 자주 하는 일 (task) ──
const TASKS = [
    { id: 't-revenue', icon: BarChart3, color: '#3b82f6', title: '오늘 매출 확인하기' },
    { id: 't-upload', icon: Upload, color: '#8b5cf6', title: '매출·비용 자료 올리기' },
    { id: 't-profit', icon: PieChart, color: '#10b981', title: '이번 달 이익 보기' },
    { id: 't-payroll', icon: Users, color: '#f59e0b', title: '직원 급여 계산하기' },
    { id: 't-delivery', icon: Truck, color: '#ef4444', title: '배달앱 정산 확인' },
    { id: 't-auto', icon: Globe, color: '#06b6d4', title: '자동으로 자료 받기' },
];

export default function UserManual() {
    const [open, setOpen] = useState({
        start: true, map: true, tasks: true, faq: true, help: true,
        't-revenue': true, 't-upload': true, 't-profit': true,
        't-payroll': true, 't-delivery': true, 't-auto': true,
    });
    const toggle = (k) => setOpen(p => ({ ...p, [k]: !p[k] }));
    const Caret = ({ k }) => open[k] ? <ChevronDown size={20} /> : <ChevronRight size={20} />;

    return (
        <div className="manual-page">
            <div className="manual-inner">
                {/* ── Hero ── */}
                <div className="manual-header">
                    <div className="header-icon"><BookOpen size={30} /></div>
                    <div className="header-text">
                        <h1>셈하나 사용 설명서</h1>
                        <p>처음 쓰시는 분도 천천히 따라 하실 수 있게 만들었습니다. 어려운 말은 빼고, <strong style={{ color: '#fff' }}>해야 할 일</strong> 중심으로 정리했어요.</p>
                    </div>
                </div>

                {/* ── 이 설명서 보는 법 ── */}
                <div className="info-box tip" style={{ fontSize: '1rem' }}>
                    <span className="icon">💡</span>
                    <div>
                        <strong>이 설명서 보는 법</strong><br />
                        ① 아래 <strong>목차</strong>에서 궁금한 항목을 누르면 그 위치로 바로 이동합니다.<br />
                        ② 각 제목(파란 줄)을 누르면 내용이 <strong>접혔다 펴졌다</strong> 합니다.<br />
                        ③ <span className="badge green">초록 상자</span>는 도움말, <span className="badge amber">노랑 상자</span>는 주의사항입니다.
                    </div>
                </div>

                {/* ── 목차 ── */}
                <div className="toc">
                    <h3>📑 목차</h3>
                    <ul className="toc-list">
                        <li><a href="#start">1. 처음 시작하기 (로그인)</a></li>
                        <li><a href="#map">2. 화면 한눈에 보기 (메뉴 지도)</a></li>
                        <li><a href="#tasks">3. 자주 하는 일 따라 하기</a></li>
                        <li><a href="#faq">4. 자주 묻는 질문</a></li>
                        <li><a href="#help">5. 막히면 이렇게 하세요</a></li>
                    </ul>
                </div>

                {/* ═══ 1. 처음 시작하기 ═══ */}
                <div className="manual-section" id="start">
                    <h2 onClick={() => toggle('start')} style={{ cursor: 'pointer' }}>
                        <Caret k="start" /> <LogIn size={22} /> 1. 처음 시작하기
                    </h2>
                    {open.start && (
                        <div>
                            <p>인터넷 주소창에 <strong>관리자 사이트 주소</strong>를 입력하고, 받으신 <strong>아이디·비밀번호</strong>로 로그인하면 끝입니다.</p>
                            <ol className="step-list">
                                <li><strong>인터넷(크롬·엣지 등)</strong>을 열고 관리자 주소로 들어갑니다. 즐겨찾기 해두면 편합니다.</li>
                                <li>아이디와 비밀번호를 넣고 <strong>로그인</strong>을 누릅니다.</li>
                                <li>로그인하면 가장 먼저 <strong>대시보드</strong> 화면이 나옵니다. 여기서 오늘 상태를 봅니다.</li>
                                <li>왼쪽의 <strong>메뉴(목록)</strong>를 눌러 원하는 기능으로 이동합니다.</li>
                            </ol>
                            <div className="info-box tip">
                                <span className="icon">✅</span>
                                <div><strong>비밀번호를 잊으셨다면</strong> 직접 푸시지 말고 관리자(또는 셈하나 담당자)에게 연락해 새 비밀번호를 받으세요. 여러 번 틀려도 컴퓨터가 고장 나지 않으니 안심하세요.</div>
                            </div>
                            <div className="info-box warning">
                                <span className="icon">⚠️</span>
                                <div><strong>공용 컴퓨터·PC방</strong>에서 쓰셨다면 끝나고 꼭 오른쪽/아래의 <strong>로그아웃</strong>을 눌러 주세요. 내 가게 정보를 지키는 방법입니다.</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ 2. 메뉴 지도 ═══ */}
                <div className="manual-section" id="map">
                    <h2 onClick={() => toggle('map')} style={{ cursor: 'pointer' }}>
                        <Caret k="map" /> <MousePointerClick size={22} /> 2. 화면 한눈에 보기 (메뉴 지도)
                    </h2>
                    {open.map && (
                        <div>
                            <p>왼쪽 메뉴가 많아 보여도 자주 쓰는 건 몇 개뿐입니다. 아래 표에서 <strong>“언제 쓰나요”</strong>만 보셔도 충분합니다.</p>
                            <table className="manual-table">
                                <thead>
                                    <tr><th style={{ width: '22%' }}>메뉴</th><th>무엇을 하나요</th><th style={{ width: '32%' }}>언제 쓰나요</th></tr>
                                </thead>
                                <tbody>
                                    {MENU_MAP.map((m) => {
                                        const Icon = m.icon;
                                        return (
                                            <tr key={m.name}>
                                                <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#e2e8f0' }}><Icon size={16} style={{ color: '#818cf8' }} /> {m.name}</span></td>
                                                <td>{m.what}</td>
                                                <td style={{ color: '#94a3b8' }}>{m.when}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="info-box tip">
                                <span className="icon">💡</span>
                                <div>가장 많이 쓰는 3가지는 <strong>대시보드 · 매출관리 · 손익계산서</strong>입니다. 이 셋만 익히셔도 가게 돈 흐름을 다 파악할 수 있습니다.</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ 3. 자주 하는 일 ═══ */}
                <div className="manual-section" id="tasks">
                    <h2 onClick={() => toggle('tasks')} style={{ cursor: 'pointer' }}>
                        <Caret k="tasks" /> <Sparkles size={22} /> 3. 자주 하는 일 따라 하기
                    </h2>
                    {open.tasks && (
                        <div>
                            <p>하고 싶은 일을 고르세요. 아래 카드 중 하나를 누르면 그 방법으로 이동합니다.</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, margin: '16px 0 8px' }}>
                                {TASKS.map((t) => {
                                    const Icon = t.icon;
                                    return (
                                        <a key={t.id} href={`#${t.id}`} style={{
                                            display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
                                            padding: '16px 18px', borderRadius: 14,
                                            background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9))',
                                            border: `1px solid ${t.color}44`,
                                        }}>
                                            <span style={{ width: 40, height: 40, borderRadius: 10, background: `${t.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Icon size={20} style={{ color: t.color }} />
                                            </span>
                                            <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3 }}>{t.title}</span>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── 3-① 매출 확인 ── */}
                <div className="manual-section" id="t-revenue">
                    <h2 onClick={() => toggle('t-revenue')} style={{ cursor: 'pointer' }}>
                        <Caret k="t-revenue" /> <BarChart3 size={22} /> ① 오늘 매출 확인하기
                    </h2>
                    {open['t-revenue'] && (
                        <div>
                            <ol className="step-list">
                                <li>왼쪽 메뉴에서 <strong>매출관리</strong>를 누릅니다.</li>
                                <li>맨 위 <strong>년·월</strong>을 원하는 달로 맞춥니다. (화살표 <strong>‹ ›</strong> 로 이동)</li>
                                <li>위쪽 카드에서 <strong>현금 · 카드 · 배달앱 · 총 매출</strong> 금액을 한눈에 봅니다.</li>
                                <li>아래 <strong>일별 매출 추이</strong> 그래프로 어느 날 많이 팔렸는지 봅니다.</li>
                            </ol>
                            <div className="info-box tip">
                                <span className="icon">📊</span>
                                <div>그래프의 색은 <span className="badge green">현금</span> <span className="badge blue">카드</span> <span className="badge amber">배달앱</span> 을 뜻합니다. 막대에 마우스를 올리면 정확한 금액이 보입니다.</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── 3-② 자료 올리기 ── */}
                <div className="manual-section" id="t-upload">
                    <h2 onClick={() => toggle('t-upload')} style={{ cursor: 'pointer' }}>
                        <Caret k="t-upload" /> <Upload size={22} /> ② 매출·비용 자료 올리기 (엑셀 업로드)
                    </h2>
                    {open['t-upload'] && (
                        <div>
                            <p>카드사·은행·배달앱 홈페이지에서 받은 <strong>엑셀(또는 PDF) 파일</strong>을 올리면, 셈하나가 알아서 날짜·금액·거래처를 정리해 줍니다.</p>
                            <h3>매출 자료 올리기</h3>
                            <ol className="step-list">
                                <li><strong>매출관리 → 업로드</strong> 탭을 누릅니다.</li>
                                <li><strong>파일 선택</strong>을 눌러 카드사/배달앱에서 받은 파일을 고릅니다.</li>
                                <li>잠시 기다리면 내용이 표로 보입니다. 맞으면 <strong>저장(확인)</strong>을 누릅니다.</li>
                            </ol>
                            <h3>비용(매입) 자료 올리기</h3>
                            <ol className="step-list">
                                <li><strong>비용관리 → 업로드</strong> 탭을 누릅니다.</li>
                                <li>카드 사용내역·통장 거래내역 파일을 고릅니다.</li>
                                <li>거래처 이름이 비슷한 게 있으면 <strong>“같은 곳인가요?”</strong> 묻습니다. 맞으면 합치기, 새 거래처면 새로 만들기를 누릅니다.</li>
                                <li><strong>저장</strong>을 누르면 끝. 손익계산서에도 자동 반영됩니다.</li>
                            </ol>
                            <div className="info-box tip">
                                <span className="icon">🛡️</span>
                                <div><strong>같은 파일을 두 번 올려도 안전합니다.</strong> 셈하나가 똑같은 거래를 자동으로 걸러내(중복 방지) 금액이 두 배로 부풀지 않습니다.</div>
                            </div>
                            <div className="info-box warning">
                                <span className="icon">⚠️</span>
                                <div><strong>카드대금 납부 · 4대보험 납부</strong>는 비용에서 자동으로 빠집니다. 실제 비용은 “카드를 쓴 시점”과 “급여 계산”에 이미 잡히기 때문에, 통장 출금을 또 더하면 이중으로 계산되기 때문입니다.</div>
                            </div>
                            <div className="info-box danger">
                                <span className="icon">↩️</span>
                                <div><strong>잘못 올렸을 때:</strong> 업로드 화면의 <strong>“취소/기록”</strong> 탭에서 방금 올린 건의 <strong>되돌리기(↩)</strong> 버튼을 누르면 통째로 지워집니다. 한 건씩 지울 필요 없습니다.</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── 3-③ 이익 보기 ── */}
                <div className="manual-section" id="t-profit">
                    <h2 onClick={() => toggle('t-profit')} style={{ cursor: 'pointer' }}>
                        <Caret k="t-profit" /> <PieChart size={22} /> ③ 이번 달 얼마 벌었나 (손익계산서)
                    </h2>
                    {open['t-profit'] && (
                        <div>
                            <p><strong>손익계산서</strong>는 “번 돈(매출)”에서 “쓴 돈(비용)”을 뺀 <strong>진짜 이익</strong>을 월별로 보여 줍니다.</p>
                            <ol className="step-list">
                                <li>왼쪽 메뉴 <strong>손익관리 → 손익계산서</strong>를 누릅니다.</li>
                                <li>맨 위 칸에서 <strong>연간 매출 · 비용 · 영업이익 · 이익률</strong>을 봅니다.</li>
                                <li>표에서 <strong>월별</strong>로 매출과 각 비용(재료비·인건비·임차료 등)을 비교합니다.</li>
                            </ol>
                            <div className="info-box tip">
                                <span className="icon">🧮</span>
                                <div><strong>자동으로 계산됩니다.</strong> 매출관리·비용관리·급여에 자료만 잘 넣으면, 손익계산서는 화면을 열 때마다 최신으로 다시 계산됩니다. 따로 “계산” 버튼을 누를 필요가 없습니다.</div>
                            </div>
                            <div className="info-box warning">
                                <span className="icon">⚠️</span>
                                <div>어떤 달의 <strong>인건비가 0원</strong>으로 보이면, 그 달 <strong>급여대장이 아직 입력 전</strong>이라는 뜻입니다. 직원관리에서 급여를 “완료”로 만들면 손익에 자동 반영됩니다.</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── 3-④ 급여 ── */}
                <div className="manual-section" id="t-payroll">
                    <h2 onClick={() => toggle('t-payroll')} style={{ cursor: 'pointer' }}>
                        <Caret k="t-payroll" /> <Users size={22} /> ④ 직원 급여 계산하기 (주휴수당 포함)
                    </h2>
                    {open['t-payroll'] && (
                        <div>
                            <ol className="step-list">
                                <li><strong>직원관리</strong>에서 직원을 등록합니다. (월급제인지 시급제인지, 시급·근무시간 입력)</li>
                                <li>해당 <strong>월</strong>을 고르고 <strong>급여 계산</strong>을 누릅니다.</li>
                                <li>시급제 직원은 <strong>주휴수당</strong>이 자동으로 더해집니다. (주 15시간 이상 근무 시)</li>
                                <li>금액을 확인하고 <strong>이체 완료</strong>로 표시하면 손익계산서 인건비에 반영됩니다.</li>
                            </ol>
                            <div className="info-box tip">
                                <span className="icon">💵</span>
                                <div><strong>주휴수당이 뭔가요?</strong> 일주일에 정해진 시간(보통 15시간) 이상 일한 직원에게 “하루치 유급 휴일”을 더 주는 제도입니다. 셈하나가 근무시간을 보고 자동 계산하니 직접 안 하셔도 됩니다.</div>
                            </div>
                            <div className="info-box warning">
                                <span className="icon">⚠️</span>
                                <div>급여 계산식을 바꾸면 <strong>실수령액</strong>이 달라집니다. 바꾸기 전·후 금액을 꼭 비교해 보고 직원에게 안내하세요.</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── 3-⑤ 배달앱 ── */}
                <div className="manual-section" id="t-delivery">
                    <h2 onClick={() => toggle('t-delivery')} style={{ cursor: 'pointer' }}>
                        <Caret k="t-delivery" /> <Truck size={22} /> ⑤ 배달앱 정산 확인하기
                    </h2>
                    {open['t-delivery'] && (
                        <div>
                            <p>배민·쿠팡이츠·요기요에서 <strong>실제로 통장에 들어온 돈(정산금)</strong>과 <strong>수수료</strong>를 한눈에 봅니다.</p>
                            <ol className="step-list">
                                <li><strong>배달앱관리</strong> 메뉴(또는 매출관리의 배달앱 탭)를 누릅니다.</li>
                                <li>앱별로 <strong>매출 · 수수료 · 정산금 · 주문수</strong>를 봅니다.</li>
                                <li>수수료 상세(중개·결제·배달비·광고비)까지 펼쳐 볼 수 있습니다.</li>
                            </ol>
                            <div className="info-box tip">
                                <span className="icon">🛵</span>
                                <div>배달앱은 매출에서 수수료를 떼고 입금합니다. 그래서 <strong>“매출은 큰데 통장엔 적게 들어오는”</strong> 차이를 여기서 정확히 확인할 수 있습니다.</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── 3-⑥ 자동수집 ── */}
                <div className="manual-section" id="t-auto">
                    <h2 onClick={() => toggle('t-auto')} style={{ cursor: 'pointer' }}>
                        <Caret k="t-auto" /> <Globe size={22} /> ⑥ 자동으로 자료 받기 (외부 연동)
                    </h2>
                    {open['t-auto'] && (
                        <div>
                            <p>은행·카드·배달앱·POS를 한 번 연결해 두면, 매번 손으로 올리지 않아도 <strong>자료가 자동으로 들어옵니다.</strong></p>
                            <ol className="step-list">
                                <li><strong>외부 연동</strong> 메뉴에서 연결하려는 곳(은행·카드·배달앱 등)을 고릅니다.</li>
                                <li>화면 안내에 따라 <strong>로그인 정보</strong>나 <strong>인증</strong>을 한 번 등록합니다.</li>
                                <li><strong>자동수집 상태</strong> 메뉴에서 잘 들어오는지 초록불(정상)을 확인합니다.</li>
                            </ol>
                            <div className="info-box warning">
                                <span className="icon">🔑</span>
                                <div>로그인 정보·인증서 등록 같은 <strong>중요한 설정</strong>은 사장님이 직접 하시거나 담당자와 함께 하세요. 비밀번호가 바뀌면 자동수집이 멈출 수 있으니, 빨간불이 뜨면 다시 연결하면 됩니다.</div>
                            </div>
                            <div className="info-box tip">
                                <span className="icon">✅</span>
                                <div>자동수집이 켜져 있어도 <strong>손으로 올리는 방법</strong>은 그대로 쓸 수 있습니다. 둘을 같이 써도 중복은 자동으로 걸러집니다.</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ 4. FAQ ═══ */}
                <div className="manual-section" id="faq">
                    <h2 onClick={() => toggle('faq')} style={{ cursor: 'pointer' }}>
                        <Caret k="faq" /> <HelpCircle size={22} /> 4. 자주 묻는 질문
                    </h2>
                    {open.faq && (
                        <div>
                            <h3>숫자가 이상해요. 두 배로 보여요.</h3>
                            <p>같은 자료가 두 곳(예: 카드 + 통장)에서 들어와 겹친 경우입니다. 셈하나가 자동으로 걸러주지만, 혹시 남아 있으면 해당 항목을 지우거나 담당자에게 알려 주세요.</p>
                            <h3>매출은 올렸는데 손익계산서에 안 보여요.</h3>
                            <p>화면을 <strong>새로고침(F5)</strong> 해보세요. 그래도 안 보이면 “저장”을 눌렀는지, 올린 <strong>달(년·월)</strong>이 맞는지 확인하세요.</p>
                            <h3>인건비가 0원이에요.</h3>
                            <p>그 달 <strong>급여대장이 아직 입력 전</strong>입니다. 직원관리에서 급여를 계산하고 “완료”로 표시하면 자동 반영됩니다.</p>
                            <h3>파일을 올렸는데 “내용이 없습니다”라고 나와요.</h3>
                            <p>카드사·배달앱에서 받은 <strong>원본 파일 그대로</strong> 올려야 합니다. 엑셀에서 열어 수정·저장한 파일은 형식이 바뀌어 인식이 안 될 수 있어요. 다시 내려받아 올려 보세요.</p>
                            <h3>실수로 잘못 올렸어요.</h3>
                            <p>업로드 화면의 <strong>“취소/기록”</strong> 탭에서 <strong>되돌리기(↩)</strong>를 누르면 그 업로드가 통째로 사라집니다.</p>
                            <h3>글씨가 작아요 / 화면이 잘 안 보여요.</h3>
                            <p>키보드에서 <strong>Ctrl 키와 + 키</strong>를 함께 누르면 화면이 커집니다. (<strong>Ctrl 와 0</strong> 은 원래 크기로)</p>
                        </div>
                    )}
                </div>

                {/* ═══ 5. 도움 ═══ */}
                <div className="manual-section" id="help">
                    <h2 onClick={() => toggle('help')} style={{ cursor: 'pointer' }}>
                        <Caret k="help" /> <Info size={22} /> 5. 막히면 이렇게 하세요
                    </h2>
                    {open.help && (
                        <div>
                            <ol className="step-list">
                                <li><strong>새로고침(F5)</strong> 한 번 — 화면이 멈춘 것 같을 때 대부분 해결됩니다.</li>
                                <li><strong>로그아웃 후 다시 로그인</strong> — 그래도 이상하면 한 번 나갔다 들어오세요.</li>
                                <li><strong>담당자에게 연락</strong> — 어떤 화면에서 무엇을 누르니 무엇이 안 됐는지 알려 주시면 빠릅니다. (화면 <strong>사진</strong>을 찍어 보내면 가장 좋아요)</li>
                            </ol>
                            <div className="info-box tip">
                                <span className="icon">🤝</span>
                                <div>잘못 눌러도 <strong>가게 자료가 사라지지 않습니다.</strong> 대부분의 작업은 되돌릴 수 있으니, 겁내지 말고 천천히 눌러 보세요. 익숙해지면 하루 5분이면 충분합니다.</div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
