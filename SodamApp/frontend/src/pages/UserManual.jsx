import { useState } from 'react';
import {
    BookOpen, ChevronDown, ChevronRight, Info, LogIn, MousePointerClick, Sparkles,
    LayoutDashboard, BarChart3, Wallet, PieChart, Receipt, Truck, CreditCard,
    Upload, Globe, ClipboardList, Settings, HelpCircle, Users, UserPlus, Calculator,
    Building2, Banknote, Store, Send, Bell, Briefcase, Package, Image, Megaphone,
    FileSignature, MessageCircle, ListChecks, FileText, Palette, Smartphone
} from 'lucide-react';
import './UserManual.css';

// ── 재사용 컴포넌트 ──
function Section({ id, icon: Icon, title, k, open, toggle, children }) {
    return (
        <div className="manual-section" id={id}>
            <h2 onClick={() => toggle(k)} style={{ cursor: 'pointer' }}>
                {open[k] ? <ChevronDown size={20} /> : <ChevronRight size={20} />} <Icon size={22} /> {title}
            </h2>
            {open[k] && <div>{children}</div>}
        </div>
    );
}
const Tip = ({ children, icon = '💡' }) => <div className="info-box tip"><span className="icon">{icon}</span><div>{children}</div></div>;
const Warn = ({ children, icon = '⚠️' }) => <div className="info-box warning"><span className="icon">{icon}</span><div>{children}</div></div>;
const Danger = ({ children, icon = '🛑' }) => <div className="info-box danger"><span className="icon">{icon}</span><div>{children}</div></div>;

const MENU_MAP = [
    ['메인', [['대시보드', '오늘·이번 달 매출과 이익을 한 화면에']]],
    ['돈 관리', [
        ['매출관리', '현금·카드·배달앱 매출을 날짜별로 보고 올리기'],
        ['비용관리', '재료비·임차료 등 나간 돈 정리 (옛 매입관리)'],
        ['손익계산서', '매출 − 비용 = 진짜 이익을 월별로'],
    ]],
    ['정산 확인', [
        ['배달앱관리', '배민·쿠팡이츠·요기요 정산·수수료'],
        ['카드관리', '카드 매출과 통장 입금 맞춰보기'],
    ]],
    ['세금·증빙', [
        ['전자세금계산서', '거래처에 세금계산서 발행'],
        ['전자명세서', '지출증빙용 명세서 발행'],
        ['현금영수증', '손님 현금영수증 발행'],
        ['홈택스 수집', '홈택스 자료 자동으로 가져오기'],
    ]],
    ['자동화', [
        ['외부 연동', '은행·카드·배달앱 연결해 자동 수집'],
        ['자동수집 상태', '자동 수집이 잘 되는지 점검'],
    ]],
    ['직원·급여', [
        ['직원관리', '직원 등록·근태·계약서·서류'],
        ['급여(주휴 포함)', '시급·월급·주휴수당 자동 계산'],
        ['구인등록', '알바·직원 구인 사이트 안내'],
        ['퇴직금 지급관리', '퇴직금 적립·지급 관리'],
        ['연말정산 지원', '연말정산 환급/추가납부 집계'],
    ]],
    ['알림·전송', [
        ['팩스 전송', '재직·경력증명서 등 팩스 발송'],
        ['알림톡 관리', '카카오 알림톡 보내기'],
    ]],
    ['상품·홍보', [
        ['레시피 관리', '상품·재료 레시피 모음'],
        ['메뉴판/가격표', '메뉴판 만들어 인쇄/저장'],
        ['배달앱 이미지', '배달앱용 사진 자동 크기조정'],
        ['매장 홍보물', 'AI로 포스터·SNS·배너 만들기'],
    ]],
    ['소통', [['통합게시판', '공지·건의·구매요청·소통방·체크리스트']]],
    ['설정', [
        ['거래처 관리', '거래처·품목 정리, 중복 합치기'],
        ['설정', '회사정보·로고·직인·계좌·위치·규모'],
    ]],
];

export default function UserManual() {
    const KEYS = ['start', 'dashboard', 'money', 'settle', 'tax', 'auto', 'hr', 'send', 'product', 'board', 'config', 'faq', 'help', 'map'];
    const [open, setOpen] = useState(Object.fromEntries(KEYS.map(k => [k, true])));
    const toggle = (k) => setOpen(p => ({ ...p, [k]: !p[k] }));
    const sec = { open, toggle };

    return (
        <div className="manual-page">
            <div className="manual-inner">
                {/* Hero */}
                <div className="manual-header">
                    <div className="header-icon"><BookOpen size={30} /></div>
                    <div className="header-text">
                        <h1>셈하나 사용 설명서</h1>
                        <p>처음 쓰시는 분도 천천히 따라 하실 수 있게 만들었습니다. 어려운 말은 빼고 <strong style={{ color: '#fff' }}>모든 메뉴를 하나하나</strong> 설명했어요.</p>
                    </div>
                </div>

                <Tip icon="💡">
                    <strong>이 설명서 보는 법</strong><br />
                    ① 아래 <strong>목차</strong>에서 항목을 누르면 그 위치로 바로 이동합니다.&nbsp;
                    ② 각 제목(파란 줄)을 누르면 내용이 <strong>접혔다 펴졌다</strong> 합니다.&nbsp;
                    ③ <span className="badge green">초록</span> 도움말 · <span className="badge amber">노랑</span> 주의 · <span className="badge red">빨강</span> 꼭 알아두기.&nbsp;
                    ④ 글씨가 작으면 키보드 <strong>Ctrl 과 +</strong> 를 함께 누르세요.
                </Tip>

                {/* 목차 */}
                <div className="toc">
                    <h3>📑 목차</h3>
                    <ul className="toc-list">
                        <li><a href="#start">1. 처음 시작하기 · 공통 조작</a></li>
                        <li><a href="#map">2. 메뉴 전체 지도</a></li>
                        <li><a href="#dashboard">3. 대시보드</a></li>
                        <li><a href="#money">4. 돈 관리 (매출·비용·손익)</a></li>
                        <li><a href="#settle">5. 배달앱·카드 정산</a></li>
                        <li><a href="#tax">6. 세금·증빙 서류</a></li>
                        <li><a href="#auto">7. 자동 수집 (외부 연동)</a></li>
                        <li><a href="#hr">8. 직원·급여 관리</a></li>
                        <li><a href="#send">9. 팩스·알림톡 전송</a></li>
                        <li><a href="#product">10. 상품·홍보물 만들기</a></li>
                        <li><a href="#board">11. 통합게시판 (직원 소통)</a></li>
                        <li><a href="#config">12. 거래처·설정</a></li>
                        <li><a href="#faq">13. 자주 묻는 질문</a></li>
                        <li><a href="#help">14. 막히면 이렇게</a></li>
                    </ul>
                </div>

                {/* 1. 시작 */}
                <Section id="start" icon={LogIn} title="1. 처음 시작하기 · 공통 조작" k="start" {...sec}>
                    <p>로그인 방법과, 어느 화면에서나 똑같이 쓰는 <strong>기본 조작</strong>을 먼저 익히면 나머지가 쉬워집니다.</p>
                    <h3>로그인</h3>
                    <ol className="step-list">
                        <li>인터넷(크롬·엣지)을 열고 관리자 주소로 들어갑니다. <strong>즐겨찾기</strong> 해두면 편합니다.</li>
                        <li>아이디·비밀번호를 넣고 <strong>로그인</strong>을 누릅니다. 로그인하면 <strong>대시보드</strong>가 먼저 나옵니다.</li>
                        <li>왼쪽 <strong>메뉴 목록</strong>에서 원하는 기능을 누릅니다. 메뉴에 화살표(∨)가 있으면 누르면 하위 메뉴가 펼쳐집니다.</li>
                    </ol>
                    <h3>어느 화면에서나 똑같은 조작</h3>
                    <ul>
                        <li><strong>월(날짜) 바꾸기</strong> — 화면 위쪽 <strong>‹ 2026년 5월 ›</strong> 의 화살표로 이전/다음 달로 이동합니다.</li>
                        <li><strong>탭(상단 작은 버튼)</strong> — 한 화면 안에서 보기 방식을 바꿉니다. 예: 대시보드 / 리스트 / 업로드.</li>
                        <li><strong>추가·수정·삭제</strong> — 보통 <strong>＋ 추가</strong> 버튼으로 새로 만들고, 줄을 누르면 수정, 휴지통으로 삭제합니다.</li>
                        <li><strong>새로고침</strong> — 화면이 멈춘 듯하면 키보드 <strong>F5</strong> 를 누르면 최신으로 다시 불러옵니다.</li>
                    </ul>
                    <Tip icon="✅">비밀번호를 잊으셨으면 직접 풀지 말고 담당자에게 새 비밀번호를 받으세요. 여러 번 틀려도 고장 나지 않습니다.</Tip>
                    <Warn>공용 PC에서 쓰셨다면 끝나고 꼭 <strong>로그아웃</strong> 하세요.</Warn>
                </Section>

                {/* 2. 메뉴 지도 */}
                <Section id="map" icon={MousePointerClick} title="2. 메뉴 전체 지도" k="map" {...sec}>
                    <p>왼쪽 메뉴를 묶음으로 정리했습니다. <strong>“무엇을 하나요”</strong>만 훑어보셔도 됩니다.</p>
                    {MENU_MAP.map(([group, items]) => (
                        <div key={group}>
                            <h3>{group}</h3>
                            <table className="manual-table">
                                <tbody>
                                    {items.map(([name, what]) => (
                                        <tr key={name}>
                                            <td style={{ width: '30%', fontWeight: 700, color: '#e2e8f0' }}>{name}</td>
                                            <td style={{ color: '#cbd5e1' }}>{what}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                    <Tip>가장 많이 쓰는 3가지는 <strong>대시보드 · 매출관리 · 손익계산서</strong>입니다.</Tip>
                </Section>

                {/* 3. 대시보드 */}
                <Section id="dashboard" icon={LayoutDashboard} title="3. 대시보드 (가게 상태 한눈에)" k="dashboard" {...sec}>
                    <p>로그인하면 가장 먼저 나오는 화면. <strong>이번 달 매출·순이익·이익률·직원 수</strong>를 위쪽 카드에서 봅니다.</p>
                    <ol className="step-list">
                        <li>맨 위 <strong>년·월</strong>을 원하는 달로 맞춥니다.</li>
                        <li><strong>6개월 이익 추이</strong> 그래프로 장사가 나아지는지 한눈에 봅니다.</li>
                        <li><strong>채널별 매출(원형 그래프)</strong> 로 매장·배달 비중을 봅니다.</li>
                        <li><strong>비용 TOP 5 거래처</strong> 로 어디에 돈이 가장 많이 나가는지 확인합니다.</li>
                    </ol>
                    <Tip icon="📈">매일 아침 대시보드만 한 번 봐도 가게 돈 흐름을 거의 다 파악할 수 있습니다.</Tip>
                </Section>

                {/* 4. 돈 관리 */}
                <Section id="money" icon={Wallet} title="4. 돈 관리 — 매출 · 비용 · 손익계산서" k="money" {...sec}>
                    <h3><BarChart3 size={16} style={{ verticalAlign: -2 }} /> 매출관리</h3>
                    <p>탭: <strong>대시보드 · 리스트 · 월별 상세 내역 · 매출요약 · 배달앱 · 업로드</strong>. 위쪽 카드는 <strong>현금 · 카드 · 배달앱 · 총 매출</strong>로 나뉩니다.</p>
                    <ol className="step-list">
                        <li><strong>대시보드</strong> 탭 — 채널별 비중과 일별 매출 막대그래프(현금/카드/배달).</li>
                        <li><strong>리스트</strong> 탭 — 날짜별 매출을 표로. 위의 <strong>전체/현금/카드/배달앱</strong> 으로 걸러봅니다.</li>
                        <li><strong>월별 상세 내역</strong> 탭 — 달력처럼 칸을 눌러 그 자리에서 직접 금액을 고칠 수 있습니다.</li>
                        <li><strong>＋추가</strong> — 손으로 매출 한 건을 넣을 때. <strong>업로드</strong> 탭 — 파일로 한꺼번에 넣을 때.</li>
                    </ol>
                    <Tip icon="💵">매장 매출은 <strong>현금</strong>과 <strong>카드</strong>로 나눠 들어갑니다. 배달은 자동으로 ‘배달앱’으로 분류됩니다.</Tip>

                    <h3><Wallet size={16} style={{ verticalAlign: -2 }} /> 비용관리 (옛 ‘매입관리’)</h3>
                    <p>탭: <strong>대시보드 · 사업용 내역 · 가계부 · 업로드</strong>. 재료비·소모품·임차료·세금 등 <strong>나간 돈</strong>을 모읍니다.</p>
                    <ol className="step-list">
                        <li><strong>업로드</strong> 탭에서 카드 사용내역·통장 거래내역 파일을 올립니다.</li>
                        <li>비슷한 거래처가 있으면 <strong>“같은 곳인가요?”</strong> 묻습니다 — 맞으면 합치기, 아니면 새로 만들기.</li>
                        <li>개인 지출은 <strong>가계부</strong> 탭으로 따로 빠집니다(사업 비용·이익에 안 들어감).</li>
                        <li>줄을 눌러 <strong>카테고리(분류)</strong>를 바꾸면, 같은 거래처 전체가 한 번에 바뀝니다.</li>
                    </ol>
                    <Warn><strong>카드대금 납부 · 4대보험 납부</strong>는 비용에서 자동 제외됩니다. 실제 비용은 ‘카드 쓴 시점’과 ‘급여 계산’에 이미 잡혀, 통장 출금을 또 더하면 이중이 되기 때문입니다.</Warn>
                    <Danger>잘못 올렸으면 <strong>업로드 → 취소/기록</strong> 탭의 <strong>되돌리기(↩)</strong>로 그 묶음을 통째로 지웁니다. 한 건씩 안 지워도 됩니다.</Danger>

                    <h3><PieChart size={16} style={{ verticalAlign: -2 }} /> 손익계산서 (진짜 이익)</h3>
                    <p>탭: <strong>대시보드 · 손익계산서 · 세부지출 · 1~12월</strong>. <strong>매출 − 비용 = 영업이익</strong>을 월별로 보여줍니다.</p>
                    <ol className="step-list">
                        <li><strong>대시보드</strong> 탭 — 올해 누적 매출·비용·영업이익·이익률.</li>
                        <li><strong>손익계산서</strong> 탭 — 수입(매장/배달)과 지출(재료비·인건비·임차료·4대보험·배달수수료 등)을 월별 표로.</li>
                        <li><strong>월(1~12월)</strong> 탭 — 거래처별·날짜별 지출을 칸을 눌러 직접 수정.</li>
                    </ol>
                    <Tip icon="🧮"><strong>자동 계산</strong>입니다. 매출·비용·급여만 잘 넣으면 손익계산서는 열 때마다 최신으로 다시 계산됩니다. ‘계산’ 버튼을 따로 누를 필요 없습니다.</Tip>
                    <Warn>어느 달 <strong>인건비가 0원</strong>이면 그 달 <strong>급여대장이 입력 전</strong>이라는 뜻입니다. (8번 직원·급여 참고)</Warn>
                </Section>

                {/* 5. 배달앱·카드 */}
                <Section id="settle" icon={Truck} title="5. 배달앱 · 카드 정산 확인" k="settle" {...sec}>
                    <h3><Truck size={16} style={{ verticalAlign: -2 }} /> 배달앱관리</h3>
                    <p>배민·쿠팡이츠·요기요·땡겨요에서 <strong>실제 통장에 들어온 돈(정산금)</strong>과 <strong>수수료</strong>를 봅니다.</p>
                    <ol className="step-list">
                        <li>위쪽 <strong>연도</strong>를 고릅니다.</li>
                        <li>앱별 <strong>매출 · 수수료 · 정산금 · 주문수</strong>와 월별 추이를 봅니다.</li>
                        <li>정산명세서 파일이 있으면 <strong>업로드</strong>로 더 정확히 맞출 수 있습니다.</li>
                    </ol>
                    <Tip icon="🛵">배달앱은 매출에서 수수료를 떼고 입금합니다. “매출은 큰데 통장엔 적게” 들어오는 차이를 여기서 확인하세요.</Tip>

                    <h3><CreditCard size={16} style={{ verticalAlign: -2 }} /> 카드관리</h3>
                    <p>탭: <strong>대시보드 · 매출내역 · 결제내역</strong>. 카드 매출이 통장에 제대로 입금됐는지 맞춰봅니다.</p>
                    <ol className="step-list">
                        <li><strong>CODEF 동기화</strong> 버튼으로 카드사 매출을 자동으로 가져오거나, 기간을 정해 파일로 올립니다.</li>
                        <li>카드사별 비중(원형/막대)과 상위 거래처, 일별 추이를 봅니다.</li>
                    </ol>
                </Section>

                {/* 6. 세금·증빙 */}
                <Section id="tax" icon={Receipt} title="6. 세금 · 증빙 서류 (팝빌·홈택스)" k="tax" {...sec}>
                    <p>세금계산서·명세서·현금영수증은 모두 <strong>팝빌</strong>을 통해 발행됩니다. 발행에는 잔액(충전)이 필요합니다.</p>
                    <h3><FileText size={16} style={{ verticalAlign: -2 }} /> 전자세금계산서</h3>
                    <ol className="step-list">
                        <li>받는 곳(거래처) <strong>상호·사업자번호·대표·주소·이메일</strong>을 넣습니다.</li>
                        <li><strong>과세/면세</strong>, <strong>청구/영수</strong>를 고르고 품목(수량·단가·세액)을 적습니다.</li>
                        <li><strong>발행</strong>을 누르면 끝. 최근 50건 이력에서 다시 보내거나 내려받을 수 있습니다.</li>
                    </ol>
                    <h3><FileText size={16} style={{ verticalAlign: -2 }} /> 전자명세서 · 현금영수증</h3>
                    <ul>
                        <li><strong>전자명세서</strong> — 지출증빙(121) 등 명세서를 발행. 작성법은 세금계산서와 비슷합니다.</li>
                        <li><strong>현금영수증</strong> — 손님 <strong>휴대폰번호/사업자번호</strong>와 금액을 넣으면 세액(10%)이 자동 계산되어 발행됩니다.</li>
                    </ul>
                    <h3><Globe size={16} style={{ verticalAlign: -2 }} /> 홈택스 수집</h3>
                    <p>홈택스의 <strong>현금영수증 매출/매입, 세금계산서</strong> 자료를 자동으로 가져옵니다. <strong>카카오·페이코·삼성패스·통신사PASS·네이버</strong> 중 한 가지로 간편인증을 한 번 등록하면 됩니다.</p>
                    <Warn>발행·수집은 실제 비용(과금)이 발생할 수 있습니다. 잔액과 인증 만료를 가끔 확인하세요.</Warn>
                </Section>

                {/* 7. 자동화 */}
                <Section id="auto" icon={Globe} title="7. 자동 수집 (외부 연동)" k="auto" {...sec}>
                    <p>은행·카드·배달앱·POS를 한 번 연결해 두면 자료가 <strong>자동으로</strong> 들어옵니다. 매번 손으로 안 올려도 됩니다.</p>
                    <h3>외부 연동</h3>
                    <ol className="step-list">
                        <li><strong>외부 연동</strong> 화면에서 연결할 모듈(카드매출·카드매입·은행·이지포스·쿠팡이츠·배민)을 고릅니다.</li>
                        <li><strong>설정</strong>을 눌러 로그인 정보나 인증을 한 번 등록하고 켭니다.</li>
                        <li>맨 위 <strong>이번 달 호출량·비용</strong>으로 사용량을 확인합니다.</li>
                    </ol>
                    <h3>자동수집 상태</h3>
                    <p><strong>마지막 수집 시각, 들어온 건수, 정상/오류</strong>를 점검합니다. 빨간불(오류)이 뜨면 보통 비밀번호 변경이 원인이니 다시 연결하면 됩니다.</p>
                    <Tip icon="✅">자동수집을 켜도 <strong>손으로 올리는 방법</strong>은 그대로 됩니다. 같이 써도 중복은 자동으로 걸러집니다.</Tip>
                    <Warn icon="🔑">로그인 정보·인증서 등록 같은 중요한 설정은 사장님이 직접 하거나 담당자와 함께 하세요.</Warn>
                </Section>

                {/* 8. 직원·급여 */}
                <Section id="hr" icon={Users} title="8. 직원 · 급여 관리" k="hr" {...sec}>
                    <h3><Users size={16} style={{ verticalAlign: -2 }} /> HR 대시보드</h3>
                    <p>우리 가게가 지켜야 할 <strong>노동법 항목</strong>(최저임금·주휴수당·퇴직금·4대보험·근로계약서 등)을 <strong>5인 미만/이상</strong>으로 나눠 점검표로 보여줍니다.</p>

                    <h3><UserPlus size={16} style={{ verticalAlign: -2 }} /> 직원관리 (인사기록)</h3>
                    <ol className="step-list">
                        <li><strong>＋직원 추가</strong>로 새 직원을 등록합니다.</li>
                        <li>재직/퇴사로 거르거나, 이름·시급으로 정렬합니다.</li>
                        <li>직원을 누르면 상세화면(<strong>기본정보·계약서·급여·근태·퇴직금·교육이력·서류보관소·개인정보</strong> 8개 탭)이 열립니다.</li>
                    </ol>

                    <h3><Calculator size={16} style={{ verticalAlign: -2 }} /> 급여 계산 (주휴수당 자동)</h3>
                    <ol className="step-list">
                        <li>직원 등록 시 <strong>월급제/시급제</strong>와 시급·근무시간을 정합니다.</li>
                        <li>해당 <strong>월</strong>을 고르고 <strong>급여 계산</strong>을 누릅니다.</li>
                        <li>시급제는 <strong>주 15시간 이상</strong>이면 <strong>주휴수당</strong>이 자동으로 더해집니다.</li>
                        <li>4대보험·세금 공제 후 <strong>실수령액</strong>이 나오고, <strong>이체 완료</strong>로 표시하면 손익계산서 인건비에 반영됩니다.</li>
                    </ol>
                    <Tip icon="💡"><strong>주휴수당</strong> = 일주일에 정해진 시간 이상 일한 직원에게 주는 ‘하루치 유급 휴일’. 근무시간을 보고 자동 계산되니 직접 안 하셔도 됩니다.</Tip>
                    <Warn>세금대납(사업주가 세금을 대신 내주는) 직원은 ‘총 보상액’, 일반 직원은 ‘실수령액’으로 표기됩니다. 계산식을 바꾸기 전엔 금액을 꼭 비교해 보세요.</Warn>

                    <h3><Briefcase size={16} style={{ verticalAlign: -2 }} /> 구인등록 · 퇴직금 · 연말정산</h3>
                    <ul>
                        <li><strong>구인등록</strong> — 업종에 맞는 구인 사이트(당근알바·알바몬·워크넷·사람인 등)를 추천하고 바로 연결합니다.</li>
                        <li><strong>퇴직금 지급관리</strong> — 적립액·지급일·상태(대기/지급완료)를 관리합니다.</li>
                        <li><strong>연말정산 지원</strong> — 연도를 고르면 직원별 환급/추가납부를 자동 집계합니다.</li>
                    </ul>
                </Section>

                {/* 9. 전송 */}
                <Section id="send" icon={Send} title="9. 팩스 · 알림톡 전송" k="send" {...sec}>
                    <h3><Send size={16} style={{ verticalAlign: -2 }} /> 팩스 전송</h3>
                    <p>탭: <strong>증명서 · 업로드파일 · 사업서류</strong>. 재직·경력·급여·퇴직증명서를 고르거나 파일을 올려 <strong>팩스 번호</strong>로 보냅니다. 보낸 이력도 남습니다.</p>
                    <h3><Bell size={16} style={{ verticalAlign: -2 }} /> 알림톡 관리</h3>
                    <p>카카오 <strong>알림톡 템플릿</strong>을 만들고(심사 통과 후 사용), 잔액·발송 이력을 관리합니다. 테스트 발송으로 먼저 확인할 수 있습니다.</p>
                    <Warn>알림톡 템플릿은 카카오 <strong>심사(승인)</strong>를 통과해야 발송됩니다. ‘문자(SMS) 발신번호’와는 별개입니다.</Warn>
                </Section>

                {/* 10. 상품·홍보 */}
                <Section id="product" icon={Package} title="10. 상품 · 홍보물 만들기" k="product" {...sec}>
                    <ul>
                        <li><strong><BookOpen size={14} style={{ verticalAlign: -2 }} /> 레시피 관리</strong> — 상품/재료 레시피를 분류·검색합니다.</li>
                        <li><strong><FileText size={14} style={{ verticalAlign: -2 }} /> 메뉴판/가격표</strong> — 메뉴·가격을 넣고 색 테마를 골라 <strong>PNG/PDF</strong>로 저장·인쇄합니다.</li>
                        <li><strong><Image size={14} style={{ verticalAlign: -2 }} /> 배달앱 이미지</strong> — 상품 사진을 올리면 <strong>앱별 크기(쿠팡 800·배민 1000·요기요 600)</strong>로 자동 조정·다운로드합니다.</li>
                        <li><strong><Megaphone size={14} style={{ verticalAlign: -2 }} /> 매장 홍보물</strong> — AI로 <strong>포스터·SNS·배달배너·나레이션·배경음악</strong>을 만듭니다.</li>
                    </ul>
                    <Tip>홍보물·이미지는 <strong>만든 뒤 다운로드</strong>해서 배달앱·SNS에 올려 쓰시면 됩니다.</Tip>
                </Section>

                {/* 11. 게시판 */}
                <Section id="board" icon={ClipboardList} title="11. 통합게시판 (직원 소통)" k="board" {...sec}>
                    <p>직원과 소통하는 공간입니다.</p>
                    <ul>
                        <li><strong>공지사항</strong> — 글을 올리고 중요한 건 <strong>고정(핀)</strong>합니다.</li>
                        <li><strong>건의사항</strong> — 직원 건의에 답글을 달고 검토중/완료로 표시합니다.</li>
                        <li><strong>구매요청</strong> — 비품 구매 요청을 받고 승인합니다.</li>
                        <li><strong>비상연락처</strong> — 직원 연락처를 모아둡니다.</li>
                        <li><strong>직원소통방</strong> — 가벼운 대화/공유 게시판.</li>
                        <li><strong>내 전자계약 · 오픈 체크리스트 · 오픈 재고 체크</strong> — 계약서 확인, 매일 오픈 준비 점검(직원용).</li>
                    </ul>
                    <Tip icon="📋"><strong>오픈 체크리스트</strong>는 직원이 휴대폰으로 출근해 체크하기 좋습니다.</Tip>
                </Section>

                {/* 12. 거래처·설정 */}
                <Section id="config" icon={Settings} title="12. 거래처 관리 · 설정" k="config" {...sec}>
                    <h3><Store size={16} style={{ verticalAlign: -2 }} /> 거래처 관리</h3>
                    <p>탭: <strong>사업용 비용 · 매출</strong>. 거래처를 카테고리별로 정리하고, <strong>중복 거래처 합치기</strong>, 순서·이름 정리, 활성만 보기 등을 합니다.</p>
                    <Tip>업로드할 때 같은 거래처가 여러 이름으로 들어가면 여기서 <strong>합쳐서</strong> 정리하면 깔끔합니다.</Tip>

                    <h3><Building2 size={16} style={{ verticalAlign: -2 }} /> 설정 (8가지)</h3>
                    <table className="manual-table">
                        <tbody>
                            <tr><td style={{ fontWeight: 700, width: '34%' }}>회사정보 관리</td><td>상호·사업자번호·대표 등 기본 정보</td></tr>
                            <tr><td style={{ fontWeight: 700 }}>거래처·품목 관리</td><td>거래처/품목 정리(위 거래처 관리와 연동)</td></tr>
                            <tr><td style={{ fontWeight: 700 }}>전자계약서 양식</td><td>직원 전자계약서 서식 설정</td></tr>
                            <tr><td style={{ fontWeight: 700 }}>급여 출금계좌</td><td>급여 이체에 쓸 통장 등록</td></tr>
                            <tr><td style={{ fontWeight: 700 }}>매장 위치 관리</td><td>지도/GPS로 매장 위치 지정(출퇴근용)</td></tr>
                            <tr><td style={{ fontWeight: 700 }}>회사 로고 관리</td><td>서류에 들어갈 로고 업로드</td></tr>
                            <tr><td style={{ fontWeight: 700 }}>회사직인 관리</td><td>계산서·서류에 찍힐 직인 모양·문구</td></tr>
                            <tr><td style={{ fontWeight: 700 }}>사업장 규모 설정</td><td>5인 미만/이상 — 노동법 기준이 바뀜</td></tr>
                        </tbody>
                    </table>
                    <Warn><strong>사업장 규모(5인 미만/이상)</strong>는 주휴·연장수당 등 계산에 영향을 줍니다. 실제 인원에 맞게 설정하세요.</Warn>
                </Section>

                {/* 13. FAQ */}
                <Section id="faq" icon={HelpCircle} title="13. 자주 묻는 질문" k="faq" {...sec}>
                    <h3>숫자가 두 배로 보여요.</h3>
                    <p>같은 자료가 두 곳(카드+통장 등)에서 겹친 경우입니다. 셈하나가 자동으로 걸러주지만, 남아 있으면 해당 항목을 지우거나 담당자에게 알려 주세요.</p>
                    <h3>매출/비용을 올렸는데 손익계산서에 안 보여요.</h3>
                    <p><strong>새로고침(F5)</strong> 해보세요. ‘저장’을 눌렀는지, 올린 <strong>달(년·월)</strong>이 맞는지 확인하세요.</p>
                    <h3>인건비가 0원이에요.</h3>
                    <p>그 달 <strong>급여대장이 입력 전</strong>입니다. 직원관리에서 급여를 계산하고 ‘완료’로 표시하면 자동 반영됩니다.</p>
                    <h3>파일을 올렸는데 “내용이 없습니다”라고 나와요.</h3>
                    <p>카드사·배달앱에서 받은 <strong>원본 파일 그대로</strong> 올려야 합니다. 엑셀로 열어 수정·저장한 파일은 형식이 바뀌어 인식이 안 될 수 있어요. 다시 내려받아 올려 보세요.</p>
                    <h3>세금계산서/현금영수증이 발행이 안 돼요.</h3>
                    <p>팝빌 <strong>잔액(충전)</strong>이 부족하거나 정보가 빠졌을 수 있습니다. 받는 곳 사업자번호·이메일이 맞는지, 잔액이 있는지 확인하세요.</p>
                    <h3>자동수집에 빨간불이 떠요.</h3>
                    <p>대부분 <strong>비밀번호/인증서가 바뀐</strong> 경우입니다. 외부 연동에서 그 항목을 다시 연결하면 됩니다.</p>
                    <h3>글씨가 작아요.</h3>
                    <p>키보드 <strong>Ctrl 과 +</strong> 를 함께 누르면 화면이 커집니다(<strong>Ctrl 과 0</strong> 은 원래대로).</p>
                </Section>

                {/* 14. 도움 */}
                <Section id="help" icon={Info} title="14. 막히면 이렇게 하세요" k="help" {...sec}>
                    <ol className="step-list">
                        <li><strong>새로고침(F5)</strong> 한 번 — 멈춘 것 같을 때 대부분 해결됩니다.</li>
                        <li><strong>로그아웃 후 다시 로그인</strong> — 그래도 이상하면 한 번 나갔다 들어오세요.</li>
                        <li><strong>담당자에게 연락</strong> — 어느 화면에서 무엇을 누르니 무엇이 안 됐는지, <strong>화면 사진</strong>과 함께 알려 주면 가장 빠릅니다.</li>
                    </ol>
                    <Tip icon="🤝">잘못 눌러도 <strong>가게 자료는 사라지지 않습니다.</strong> 대부분 되돌릴 수 있으니 천천히 눌러 보세요. 익숙해지면 하루 5분이면 충분합니다.</Tip>
                </Section>

            </div>
        </div>
    );
}
