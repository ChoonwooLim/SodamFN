import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle, Clock, Lock, ArrowRight, Zap, Shield, TrendingUp, Users, Calculator, Globe, Sparkles, Target, Layers, FileText, Brain } from 'lucide-react';

const phases = [
    {
        id: 1,
        title: 'Phase 1 — 내부 경영관리 고도화',
        subtitle: '완료',
        status: 'done',
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: Zap,
        description: '급여·매출·매입 관리 기능을 정밀하고 자동화된 수준으로 구축 완료했습니다.',
        modules: [
            {
                name: '급여 계산 엔진 정밀화',
                status: 'done',
                items: [
                    { text: '간이세액표 기반 소득세 자동 계산', done: true },
                    { text: '4대보험료 보수월액 자동 산출', done: true },
                    { text: '국민연금 60세 이상 자동 면제', done: true },
                    { text: '두루누리 사회보험 80% 감면 지원', done: true },
                    { text: '세금 대납 (사업주 부담) 기능', done: true },
                    { text: '부양가족/자녀 수 기반 소득세 산정', done: true },
                    { text: '총 보상액 / 실수령액 / 이체액 3단계 분리 표시', done: true },
                ],
            },
            {
                name: '손익계산서 자동화',
                status: 'done',
                items: [
                    { text: '인건비·보험료·원천세 자동 분리', done: true },
                    { text: '카드 매출 자동 매칭 (VAN 데이터 연동)', done: true },
                    { text: '매입 PDF 자동 파싱 (은행 거래내역)', done: true },
                    { text: '월별 손익 자동 집계', done: true },
                ],
            },
            {
                name: '배달앱 매출 관리',
                status: 'done',
                items: [
                    { text: '배민/쿠팡이츠/요기요 매출 수동 입력', done: true },
                    { text: '수수료·배달비 자동 분리 계산', done: true },
                    { text: '플랫폼별 수익률 비교 대시보드', done: true },
                ],
            },
            {
                name: '연말정산 지원',
                status: 'done',
                items: [
                    { text: '직원별 연간 소득·세금 현황 조회', done: true },
                    { text: '근로소득원천징수영수증 생성', done: true },
                    { text: '연말정산 간소화 데이터 연동 (PDF 업로드)', done: true },
                    { text: '연말정산 환급/추가납부 자동 계산', done: true },
                ],
            },
        ],
    },
    {
        id: 2,
        title: 'Phase 2 — HR 인사관리 시스템',
        subtitle: '완료',
        status: 'done',
        color: 'from-emerald-500 to-teal-500',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        icon: Users,
        description: '유료 SaaS 수준의 종합 HR 인사관리 시스템을 구축 완료했습니다. 근로기준법 준수 자동 체크, 증명서 발급, 교육관리까지.',
        modules: [
            {
                name: '인사기록관리 (9탭 시스템)',
                status: 'done',
                items: [
                    { text: '기본정보 — 인적사항·재직현황·체류자격·계좌 통합 관리', done: true },
                    { text: '근태관리 — GPS 기반 출퇴근 + 캘린더 기반 인라인 입력', done: true },
                    { text: '급여대장 — 매월 급여 산출·명세서·이체 실행', done: true },
                    { text: '계약관리 — 전자계약서 생성·카카오톡 발송·전자서명', done: true },
                    { text: '서류관리 — 다중 파일 업로드·미리보기·증명서 발급', done: true },
                    { text: '변경이력 — 인사정보 변경 시 자동 추적 (old→new 기록)', done: true },
                ],
            },
            {
                name: '연차/휴가 관리',
                status: 'done',
                items: [
                    { text: '연차 유급휴가 자동 산정 (입사일 기준, 한국 노동법)', done: true },
                    { text: '1년 미만: 월 1일 (최대 11일) / 1년 이상: 15일', done: true },
                    { text: '3년 이상: 매 2년마다 +1일 (최대 25일)', done: true },
                    { text: '10종 휴가 타입 (연차/병가/경조/출산/육아/공가 등)', done: true },
                    { text: '휴가 신청 → 승인/반려 워크플로우 (원자적 트랜잭션)', done: true },
                    { text: '월별 사용량 차트 + 관리자 잔액 직접 조정', done: true },
                    { text: '직원앱 연차/휴가 자가 신청 (사업장 규모별 차단)', done: true },
                ],
            },
            {
                name: '교육/자격증 관리',
                status: 'done',
                items: [
                    { text: '법정 의무교육 5종 이수 체크 (산업안전, 성희롱, 개인정보 등)', done: true },
                    { text: '교육 이력 CRUD + 이수증 파일 첨부', done: true },
                    { text: '자격증 관리 + 만료일 자동 경고', done: true },
                    { text: '전 직원 교육 이수율 통합 대시보드', done: true },
                ],
            },
            {
                name: '퇴직 관리',
                status: 'done',
                items: [
                    { text: '퇴직금 자동 산정 (3개월 평균임금 기준)', done: true },
                    { text: '퇴직소득세 자동 계산 (근속연수 공제 반영)', done: true },
                    { text: '퇴직금 지급 관리 및 지급 확인서', done: true },
                    { text: '퇴직연금 DC/DB 관리', done: false },
                ],
            },
            {
                name: '증명서 자동 발급 & 회사직인',
                status: 'done',
                items: [
                    { text: '재직증명서 (A4 인쇄용, 직인 자동 삽입 가능)', done: true },
                    { text: '경력증명서 (근속기간 자동 계산)', done: true },
                    { text: '급여확인서 (최근 3개월 급여 요약)', done: true },
                    { text: '퇴직증명서 (퇴사자 전용, 퇴직금 정보 포함)', done: true },
                    { text: '회사직인 관리 — 11종 SVG 직인 + 영문 전통 낙관(seal-11) 추가', done: true },
                    { text: '직인 재사용 컴포넌트 (계약서·증명서 자동 삽입)', done: true },
                    { text: '직인 이미지 직접 업로드 지원 (실제 스캔본 사용)', done: true },
                    { text: '서버사이드 WeasyPrint PDF 렌더링 (/hr/certificate/pdf/{type}/{id})', done: true },
                ],
            },
            {
                name: '회사정보 관리 & 공식문서 보관함',
                status: 'done',
                items: [
                    { text: '환경설정 "회사정보 관리" 탭 신설 (최상단)', done: true },
                    { text: '회사 기본정보 15필드 편집 (한글·영문 대표자, 업태, 이메일, 팩스 등)', done: true },
                    { text: '공식문서 12유형 보관함 (사업자등록증·영업신고증·임대차·통장사본·납세증명 등)', done: true },
                    { text: 'BusinessDocument 모델 + /business-docs CRUD API', done: true },
                    { text: '증명서/계약서/명세서에서 회사정보 자동 반영 (settings_json 병합)', done: true },
                ],
            },
            {
                name: '팩스 전송 (Popbill 연동)',
                status: 'done',
                items: [
                    { text: '/hr/fax 페이지 — 증명서 자동생성·보관함·직접업로드 3종 소스', done: true },
                    { text: '전송 이력 + 재전송 + 상태 추적 (대기/전송중/완료/실패)', done: true },
                    { text: 'FAX 프로바이더 추상화 (stub/popbill/phaxio/korean_generic)', done: true },
                    { text: 'Popbill SDK 연동 (팩스 + 향후 세금계산서·문자·계좌조회 확장 가능)', done: true },
                    { text: '직원 상세 → 서류 탭에서 딥링크 (?staff_id=&cert=) 지원', done: true },
                    { text: '테스트환경 LinkID/SecretKey 발급 완료, 발신번호 서류인증 진행중', done: true },
                ],
            },
            {
                name: 'HR 대시보드 & 알림',
                status: 'done',
                items: [
                    { text: 'HR 대시보드 — 인력현황·연차현황·알림 통합 뷰', done: true },
                    { text: '계약 만료 자동 알림 (7일/30일 전)', done: true },
                    { text: '서류 미제출 직원 자동 감지', done: true },
                    { text: '수습 기간 종료 알림', done: true },
                    { text: '교육/자격증 만료 예정 경고', done: true },
                    { text: '근로시간 모니터링 (주 48시간 초과 경고)', done: true },
                    { text: '휴가 신청 대기 실시간 알림 (규모별 공통)', done: true },
                    { text: '알림/연차 카드 높이 통일 + 내부 스크롤 UX', done: true },
                ],
            },
            {
                name: '5인 미만/이상 사업장 모드',
                status: 'done',
                items: [
                    { text: '사업장 규모 설정 (Settings + HR 대시보드 즉시 전환)', done: true },
                    { text: '5인 미만 간편모드 — 연차/교육 탭 자동 숨김', done: true },
                    { text: '5인 이상 전체모드 — 모든 HR 기능 활성화', done: true },
                    { text: 'HR 대시보드 규모별 조건부 렌더링', done: true },
                    { text: '5인 미만 사업장 무급/병가/경조사 휴가 허용', done: true },
                    { text: '규모별 노동법 핵심 안내 패널 (근기법·임금·교육 아코디언)', done: true },
                    { text: '라우팅 가드 + StaffDetail 탭 이중 방어', done: true },
                    { text: 'SuperAdmin View-As 헤더 지원 (멀티테넌트 안전)', done: true },
                ],
            },
            {
                name: '외국인 근로자 관리',
                status: 'done',
                items: [
                    { text: '외국인 고용안내 페이지 (비자별 상세 가이드)', done: true },
                    { text: '체류자격별 허용 업종·필요서류·갱신주기 안내', done: true },
                    { text: '관공서·보험·법률 상담 연락처 통합 제공', done: true },
                    { text: '기본정보 탭 체류자격/외국인등록번호 필드', done: true },
                ],
            },
            {
                name: '구인/채용 지원',
                status: 'done',
                items: [
                    { text: '국내 구인 플랫폼 15곳 비교 가이드', done: true },
                    { text: '정부/공공 (워크넷·EPS·HI KOREA) 무료 등록 안내', done: true },
                    { text: '알바 (알바몬·알바천국·당근알바·벼룩시장) 비용 비교', done: true },
                    { text: '종합 (사람인·잡코리아·인크루트·커리어) 유료 플랜 분석', done: true },
                    { text: '전문직 (원티드·잡플래닛·리멤버·링크드인) 특화 안내', done: true },
                    { text: '시나리오별 추천 (업종·예산·긴급도) 5종', done: true },
                ],
            },
        ],
    },
    {
        id: 3,
        title: 'Phase 3 — SaaS 플랫폼 상용화',
        subtitle: '진행중',
        status: 'active',
        color: 'from-rose-500 to-pink-500',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-200',
        icon: Globe,
        description: '셈하나를 다른 소규모 사업자들도 사용할 수 있는 SaaS 플랫폼으로 확장합니다.',
        modules: [
            {
                name: '멀티테넌트 아키텍처',
                status: 'done',
                items: [
                    { text: '사업자별 독립 데이터 스토어 (business_id 기반)', done: true },
                    { text: '업종별 맞춤 설정 (음식점, 소매, 서비스업)', done: true },
                    { text: '요금제 및 결제 시스템 (무료/기본/프리미엄)', done: true },
                    { text: '온보딩 자동화 (가입 → 설정 → 사용)', done: true },
                ],
            },
            {
                name: 'SuperAdmin 대시보드',
                status: 'done',
                items: [
                    { text: '멀티테넌트 매장 등록/해지 관리', done: true },
                    { text: '전체 매장 매출·인건비 실시간 모니터링', done: true },
                    { text: '매장별 요금제 관리 및 이용료 정산', done: true },
                    { text: '3단계 권한 체계 (SuperAdmin → Admin → Staff)', done: true },
                    { text: '매장별 이슈 관리 및 공지사항 일괄 배포', done: true },
                    { text: '업종별·지역별 통계 및 벤치마크 리포트', done: true },
                ],
            },
            {
                name: '외부 서비스 연동',
                status: 'in-progress',
                items: [
                    { text: '카카오톡 알림톡 연동 (계약서/급여명세서)', done: true },
                    { text: '배달앱 (배민, 쿠팡이츠, 요기요) 매출 연동', done: false },
                    { text: 'POS 시스템 실시간 연동', done: false },
                    { text: '온라인 뱅킹 Open API (계좌 조회/이체)', done: false },
                    { text: '세무사/노무사 협업 포털', done: false },
                    { text: '팝빌 팩스 전송 (FaxService) — 증명서·서류 즉시 팩스', done: true },
                    { text: '팝빌 알림톡 관리 UI (KakaoNotifications) — 잔액·템플릿·발송이력', done: true },
                    { text: '팝빌 사업자등록상태 조회 (ClosedownService) — 거래처 자동확인', done: true },
                    { text: '팝빌 예금주조회 (AccountCheckService) — 급여이체 오입금 방지', done: true },
                    { text: '팝빌 기업정보 자동채움 (BizInfoCheckService) — 거래처 prefill', done: true },
                    { text: '팝빌 EasyFinBank 계좌조회 인프라 — API 모듈 활성화 대기 중', done: false },
                ],
            },
            {
                name: '모바일 앱 고도화',
                status: 'in-progress',
                items: [
                    { text: 'PWA 기반 직원용 앱 (출퇴근, 급여명세서)', done: true },
                    { text: 'PWA 기반 관리자 앱 (인사·매출·급여 관리)', done: true },
                    { text: 'React Native 네이티브 앱 (iOS/Android)', done: false },
                    { text: '사장님 전용 앱 (실시간 매출/출퇴근 알림)', done: false },
                    { text: '오프라인 모드 지원', done: false },
                ],
            },
            {
                name: '모듈형 커스터마이징 엔진',
                status: 'planned',
                items: [
                    { text: '드래그 앤 드롭 모듈 선택기 (매장별 기능 ON/OFF)', done: false },
                    { text: '매출관리·급여·재고·예약 등 독립 모듈 분리', done: false },
                    { text: '매장별 대시보드 레이아웃 커스텀 (위젯 구성)', done: false },
                    { text: '업종별 기본 모듈 프리셋 (음식점/카페/소매/서비스)', done: false },
                    { text: '모듈별 독립 권한 설정 (직원별 접근 제어)', done: false },
                    { text: '커스텀 데이터 필드 추가 (매장별 고유 항목)', done: false },
                ],
            },
            {
                name: '업종별 템플릿 & 마켓플레이스',
                status: 'planned',
                items: [
                    { text: '업종별 스타터 템플릿 (메뉴/상품/서비스 구조)', done: false },
                    { text: '맞춤 보고서 템플릿 (업종별 KPI 대시보드)', done: false },
                    { text: '모듈 마켓플레이스 (서드파티 확장 모듈)', done: false },
                    { text: '매장 간 모듈 설정 복제/공유 기능', done: false },
                    { text: 'API 웹훅 지원 (외부 시스템 연동 자동화)', done: false },
                    { text: '화이트라벨 지원 (브랜드별 로고/테마 변경)', done: false },
                ],
            },
        ],
    },
    {
        id: 4,
        title: 'Phase 4 — 세무 신고 자동화',
        subtitle: '예정',
        status: 'planned',
        color: 'from-violet-500 to-purple-500',
        bgColor: 'bg-violet-50',
        borderColor: 'border-violet-200',
        icon: Calculator,
        description: '홈택스·공단 EDI 연동을 통해 세무사 없이도 기본적인 세무 신고가 가능한 수준으로 업그레이드합니다.',
        modules: [
            {
                name: '원천세 신고 자동화',
                status: 'planned',
                items: [
                    { text: '홈택스 API 연동 (전자신고)', done: false },
                    { text: '원천징수이행상황신고서 자동 생성', done: false },
                    { text: '지급명세서 자동 제출 (근로/사업소득)', done: false },
                    { text: '간이지급명세서 반기별 자동 제출', done: false },
                ],
            },
            {
                name: '4대보험 EDI 연동',
                status: 'planned',
                items: [
                    { text: '직원 4대보험 취득/상실 자동 신고', done: false },
                    { text: '보수월액 변경 신고 (정기결정)', done: false },
                    { text: '두루누리 지원금 자동 신청', done: false },
                    { text: '보험료 고지서 조회 및 자동납부 연동', done: false },
                ],
            },
            {
                name: '부가가치세 신고',
                status: 'in-progress',
                items: [
                    { text: '전자세금계산서 발행/수취 연동', done: false },
                    { text: '카드 매출/매입 자동 집계', done: false },
                    { text: '부가세 신고서 자동 작성', done: false },
                    { text: '예정/확정 신고 일정 알림', done: false },
                    { text: '팝빌 전자세금계산서 발행 (TaxinvoiceService)', done: true },
                    { text: '팝빌 현금영수증 발행 (CashbillService)', done: true },
                    { text: '팝빌 홈택스 매출/매입 자동 수집 (HTTaxinvoiceService)', done: true },
                ],
            },
            {
                name: '연말정산 자동화',
                status: 'planned',
                items: [
                    { text: '직원별 연간 소득·세금 현황 조회', done: false },
                    { text: '근로소득원천징수영수증 자동 생성', done: false },
                    { text: '연말정산 간소화 데이터 연동 (PDF 업로드)', done: false },
                    { text: '연말정산 환급/추가납부 자동 계산', done: false },
                ],
            },
        ],
    },
    {
        id: 5,
        title: 'Phase 5 — 재무관리 및 경영분석',
        subtitle: '예정',
        status: 'planned',
        color: 'from-amber-500 to-orange-500',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        icon: TrendingUp,
        description: '회계 장부 자동 작성, 재무제표 생성, 경영 분석 리포트까지 — 소규모 사업자를 위한 올인원 재무관리 시스템입니다.',
        modules: [
            {
                name: '복식부기 회계 시스템',
                status: 'planned',
                items: [
                    { text: '계정과목 체계 (중소기업 표준)', done: false },
                    { text: '매출/매입 자동 분개 (전표 생성)', done: false },
                    { text: '급여/보험료 자동 분개', done: false },
                    { text: '감가상각 자동 계산', done: false },
                ],
            },
            {
                name: '재무제표 자동 생성',
                status: 'planned',
                items: [
                    { text: '재무상태표 (대차대조표)', done: false },
                    { text: '손익계산서 (법정 서식)', done: false },
                    { text: '현금흐름표', done: false },
                    { text: '세무조정계산서', done: false },
                ],
            },
            {
                name: '경영 분석 대시보드',
                status: 'planned',
                items: [
                    { text: 'AI 기반 매출 예측 (시계열 분석)', done: false },
                    { text: '원가율 분석 및 메뉴별 수익성 분석', done: false },
                    { text: '인건비 비율 최적화 제안', done: false },
                    { text: '동종업계 벤치마크 비교', done: false },
                ],
            },
        ],
    },
    {
        id: 6,
        title: 'Phase 6 — AI 경영 비서',
        subtitle: '비전',
        status: 'planned',
        color: 'from-indigo-500 to-blue-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        icon: Brain,
        description: 'AI가 경영 데이터를 분석하고, 사장님에게 실시간으로 경영 인사이트와 의사결정 지원을 제공합니다.',
        modules: [
            {
                name: 'AI 자동 분석',
                status: 'planned',
                items: [
                    { text: 'AI 매출 이상 감지 및 원인 분석', done: false },
                    { text: '인건비 최적화 AI 추천 (시간대별 배치)', done: false },
                    { text: '메뉴별 수익성 AI 분석 및 가격 제안', done: false },
                    { text: '시즌별 매출 예측 및 재고 추천', done: false },
                ],
            },
            {
                name: '자연어 경영 질의',
                status: 'planned',
                items: [
                    { text: '"이번 달 인건비가 지난달보다 얼마나 늘었어?" 자연어 질문', done: false },
                    { text: '챗봇 기반 경영 데이터 조회', done: false },
                    { text: '음성 인식 기반 경영 리포트', done: false },
                    { text: '일일/주간/월간 자동 경영 브리핑', done: false },
                ],
            },
            {
                name: '노무 리스크 AI 진단',
                status: 'planned',
                items: [
                    { text: '근로기준법 위반 리스크 자동 스캔', done: false },
                    { text: '퇴직금 분쟁 예방 AI 점검', done: false },
                    { text: '취업규칙 자동 생성 및 개정 추천', done: false },
                    { text: '노무 관련 법령 변경 실시간 알림', done: false },
                ],
            },
        ],
    },
];

const techStack = [
    { category: '백엔드', items: ['FastAPI (Python)', 'PostgreSQL + SQLModel', 'Redis (캐싱)', 'Celery (비동기 작업)'] },
    { category: '프론트엔드', items: ['React 19 + Vite', 'Tailwind CSS v4', 'Chart.js / Recharts', 'PWA (직원앱/관리자앱)'] },
    { category: '인프라', items: ['Docker (Orbitron 서버)', 'GitHub Actions CI/CD', 'Nginx Reverse Proxy', 'SSL + CORS 보안'] },
    { category: '연동 API', items: ['카카오 알림톡 (완료)', '홈택스 (원천세/부가세)', '4대보험 EDI', '금융결제원 (오픈뱅킹)'] },
];

export default function DevelopmentRoadmap() {
    const navigate = useNavigate();
    const [expandedPhase, setExpandedPhase] = useState(1);

    // 전체 진행률 계산
    const overallStats = phases.reduce((acc, phase) => {
        phase.modules.forEach(mod => {
            mod.items.forEach(item => {
                acc.total++;
                if (item.done) acc.done++;
            });
        });
        return acc;
    }, { total: 0, done: 0 });
    const overallProgress = overallStats.total > 0 ? Math.round((overallStats.done / overallStats.total) * 100) : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* ── Hero Header ── */}
            <div className="relative overflow-hidden border-b border-slate-800/80">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/15 via-transparent to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

                <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-14">
                    <div className="flex items-start gap-4 md:gap-6">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 flex items-center justify-center shadow-2xl shadow-violet-500/30 hover:scale-105 transition-transform"
                            aria-label="뒤로"
                        >
                            <Rocket className="w-7 h-7 md:w-8 md:h-8 text-white" />
                        </button>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold mb-2">
                                <Sparkles className="w-4 h-4" />
                                <span className="uppercase tracking-wider">Development Roadmap</span>
                            </div>

                            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-3">
                                <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
                                    셈하나 개발 로드맵
                                </span>
                            </h1>
                            <p className="text-slate-300 text-base md:text-lg max-w-3xl leading-relaxed">
                                하나로 셈을 끝내다 — 급여·HR·세무·노무·재무·AI 통합 플랫폼으로 가는 6단계 여정
                            </p>

                            {/* 메타 카드 */}
                            <div className="mt-5 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-medium">
                                    <Layers className="w-3.5 h-3.5 text-violet-400" />
                                    {phases.length} Phases
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-medium">
                                    <Target className="w-3.5 h-3.5 text-amber-400" />
                                    {overallStats.total}개 목표
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs font-medium">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    {overallStats.done}개 완료 ({overallProgress}%)
                                </span>
                            </div>

                            {/* 전체 진행률 바 */}
                            <div className="mt-5 max-w-2xl">
                                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                                    <span>전체 진행률</span>
                                    <span className="font-bold text-white">{overallProgress}%</span>
                                </div>
                                <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/40">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 shadow-lg shadow-violet-500/30 transition-all duration-700"
                                        style={{ width: `${overallProgress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 pb-32">
                {/* Vision Banner */}
                <div className="relative rounded-3xl bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 backdrop-blur border border-slate-700/60 p-6 md:p-8 shadow-2xl mb-8 overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative flex items-start gap-4">
                        <div className="p-3.5 bg-gradient-to-br from-blue-500/30 to-cyan-500/20 border border-blue-400/30 rounded-2xl shadow-lg shadow-blue-500/20">
                            <Target size={28} className="text-blue-300" />
                        </div>
                        <div>
                            <h2 className="text-lg md:text-xl font-bold text-white mb-2">비전: 소규모 사업자를 위한 올인원 경영관리 플랫폼</h2>
                            <p className="text-slate-300 text-sm md:text-[15px] leading-relaxed">
                                세무사·노무사 없이도 급여 정산, 세금 신고, 노무 관리, 재무 분석까지 —
                                <strong className="text-white"> 셈하나</strong>가 소규모 사업자의 <strong className="text-white">경영 파트너</strong>가 되겠습니다.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                {['급여 자동화', 'HR 인사관리', '세무 자동화', '노무 관리', '재무 분석', 'SaaS 플랫폼', 'AI 경영 비서'].map(tag => (
                                    <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-slate-200">{tag}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Phase Cards */}
                <div className="space-y-4 mb-8">
                    {phases.map((phase) => {
                        const PhaseIcon = phase.icon;
                        const isExpanded = expandedPhase === phase.id;
                        const totalItems = phase.modules.reduce((sum, m) => sum + m.items.length, 0);
                        const doneItems = phase.modules.reduce((sum, m) => sum + m.items.filter(i => i.done).length, 0);
                        const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

                        return (
                            <div key={phase.id} className={`bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden transition-all`}>
                                {/* Phase Header */}
                                <button
                                    className="w-full text-left p-5 md:p-6"
                                    onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${phase.color} text-white shadow-lg`}>
                                            <PhaseIcon size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-lg font-bold text-white">{phase.title}</h3>
                                                {phase.status === 'done' && (
                                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold">완료</span>
                                                )}
                                                {phase.status === 'active' && (
                                                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold animate-pulse">진행중</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5">{phase.subtitle}</p>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <div className="text-sm font-bold text-white">{progress}%</div>
                                            <div className="w-20 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                                                <div className={`h-full rounded-full bg-gradient-to-r ${phase.color}`} style={{ width: `${progress}%` }} />
                                            </div>
                                        </div>
                                        <ArrowRight size={18} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    </div>
                                </button>

                                {/* Phase Content */}
                                {isExpanded && (
                                    <div className={`px-5 md:px-6 pb-6 bg-white/5 border-t border-white/10`}>
                                        <p className="text-sm text-slate-400 py-4">{phase.description}</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {phase.modules.map((mod, mi) => (
                                                <div key={mi} className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        {mod.status === 'done' ? (
                                                            <CheckCircle size={16} className="text-emerald-500" />
                                                        ) : mod.status === 'in-progress' ? (
                                                            <Clock size={16} className="text-amber-500" />
                                                        ) : (
                                                            <Lock size={16} className="text-slate-300" />
                                                        )}
                                                        <h4 className="font-bold text-sm text-white">{mod.name}</h4>
                                                    </div>
                                                    <ul className="space-y-1.5">
                                                        {mod.items.map((item, ii) => (
                                                            <li key={ii} className="flex items-start gap-2 text-xs">
                                                                {item.done ? (
                                                                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                                                ) : (
                                                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 shrink-0 mt-0.5" />
                                                                )}
                                                                <span className={item.done ? 'text-slate-500 line-through' : 'text-slate-300'}>{item.text}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Tech Stack */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-8">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Shield size={20} className="text-indigo-400" /> 기술 스택 계획
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {techStack.map((stack) => (
                            <div key={stack.category} className="bg-white/5 rounded-xl p-4">
                                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-2">{stack.category}</h4>
                                <ul className="space-y-1">
                                    {stack.items.map((item, i) => (
                                        <li key={i} className="text-xs text-slate-300 flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-indigo-400" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Timeline Summary */}
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl p-6 shadow-xl">
                    <h3 className="text-lg font-bold mb-4">📅 전체 타임라인</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {phases.map((p, i) => (
                            <div key={i} className={`backdrop-blur-sm rounded-xl p-3 text-center ${p.status === 'done' ? 'bg-emerald-500/20 border border-emerald-500/30' : p.status === 'active' ? 'bg-amber-500/15 border border-amber-500/30' : 'bg-white/10'}`}>
                                <div className="text-[10px] font-medium text-white/60 mb-1">{p.subtitle}</div>
                                <div className="text-xs font-bold">{p.title.split('—')[1]?.trim() || p.title}</div>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-white/60 mt-4 text-center">
                        * 각 Phase는 독립적으로 운영 가능하며, 우선순위에 따라 순서 조정 가능
                    </p>
                </div>
            </div>
        </div>
    );
}
