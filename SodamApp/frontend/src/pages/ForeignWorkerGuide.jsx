import { useState } from 'react';
import { Globe, Phone, Shield, Building2, AlertTriangle, Clock, FileCheck, Info, User, ChevronDown, Search } from 'lucide-react';

const visaData = [
    {
        code: 'H-2',
        title: '방문취업',
        color: 'from-teal-600 to-teal-700',
        bg: 'bg-teal-50',
        border: 'border-teal-100',
        text: 'text-teal-800',
        accent: 'text-teal-700',
        icon: FileCheck,
        sections: [
            {
                label: '대상자',
                icon: Info,
                content: '중국·CIS 등 외국국적동포 (만 25세 이상). 한국어능력시험(TOPIK) 또는 사회통합프로그램 이수자 우대. 재외동포(F-4) 자격에 해당하지 않는 외국국적동포가 주 대상.',
            },
            {
                label: '취업 가능 업종',
                icon: Building2,
                content: '건설업, 서비스업(음식점업 포함), 제조업, 농축산업, 어업, 광업, 가사서비스업 등 고용노동부 고시 허용 업종에서 자유롭게 취업 가능. 단, 특례고용가능확인서 발급 후 취업 가능.',
            },
            {
                label: '필요 서류',
                icon: FileCheck,
                items: [
                    '특례고용가능확인서 (고용센터 발급, 사업주 신청)',
                    '외국인등록증 사본',
                    '근로계약서 (2부 작성, 근로자·사업주 각 1부 보관)',
                    '여권 사본',
                    '건강진단서 (채용 시)',
                ],
            },
            {
                label: '주의사항',
                icon: AlertTriangle,
                items: [
                    { text: '근로개시 신고: 근로 시작일로부터 14일 이내 고용센터 신고 필수', highlight: true },
                    '체류기간: 최대 3년 (출국 후 재입국하여 재취업 가능)',
                    '사업장 변경 시 고용센터에 변경 신고 (변경 횟수 제한 없음)',
                    '4대 보험 가입 의무 (국민연금·건강보험·고용보험·산재보험)',
                    '퇴직금: 1년 이상 근속 시 퇴직급여 지급 의무',
                    '최저임금 적용 (내국인과 동일)',
                ],
            },
        ],
    },
    {
        code: 'E-9',
        title: '비전문취업',
        color: 'from-cyan-600 to-cyan-700',
        bg: 'bg-cyan-50',
        border: 'border-cyan-100',
        text: 'text-cyan-800',
        accent: 'text-cyan-700',
        icon: FileCheck,
        sections: [
            {
                label: '대상자',
                icon: Info,
                content: '고용허가제(EPS)를 통해 입국한 비전문 외국인 근로자. 16개 송출국가 대상 (베트남, 필리핀, 태국, 캄보디아, 인도네시아, 미얀마, 몽골, 스리랑카, 파키스탄, 방글라데시, 네팔, 우즈베키스탄, 키르기스스탄, 중국, 동티모르, 라오스).',
            },
            {
                label: '취업 가능 업종',
                icon: Building2,
                content: '제조업, 건설업, 농축산업, 어업, 서비스업 (음식점업 포함). 고용허가서에 명시된 사업장에서만 취업 가능. 무단이탈 시 불법체류 처리.',
            },
            {
                label: '필요 서류',
                icon: FileCheck,
                items: [
                    '고용허가서 (고용센터 발급, 사업주 신청)',
                    '표준근로계약서 (한국산업인력공단 서식 사용)',
                    '외국인등록증 사본',
                    '출국만기보험 가입 증명 (사업주 부담, 월 급여 8.3%)',
                    '귀국비용보험 가입 증명 (근로자 부담)',
                    '상해보험 가입증명서 (입국 후 즉시 가입)',
                    '건강진단서',
                ],
            },
            {
                label: '체류기간',
                icon: Clock,
                content: '최초 3년. 성실근로자 재고용 시 1년 10개월 연장 가능 (최대 4년 10개월). 숙련기능인력(E-7-4) 전환 가능.',
            },
            {
                label: '주의사항',
                icon: AlertTriangle,
                items: [
                    { text: '사업장 변경 제한: 최대 3회 (사유 발생 시 1개월 이내 신청)', highlight: true },
                    '사업장 변경 사유: 휴·폐업, 근로조건 위반, 부당처우, 상해 등',
                    '출국만기보험: 월 급여의 8.3% 적립 (사업주 부담)',
                    '4대 보험 전부 가입 필수',
                    '임금체불 시 고용노동부 신고 가능 (1350)',
                    '숙식 제공 시 통화로 공제 가능 (근로계약서 명시 필수)',
                    { text: '불법고용 적발 시 사업주에게 과태료 최대 3,000만원', highlight: true },
                ],
            },
        ],
    },
    {
        code: 'D-2 / D-4',
        title: '유학 / 어학연수 (시간제 취업)',
        color: 'from-blue-600 to-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-100',
        text: 'text-blue-800',
        accent: 'text-blue-700',
        icon: Clock,
        sections: [
            {
                label: '대상자',
                icon: Info,
                content: '국내 대학(원) 재학 유학생(D-2) 또는 어학연수생(D-4). 시간제 취업허가를 받은 경우에만 아르바이트 가능. 미허가 취업 시 강제퇴거 사유.',
            },
            {
                label: '근로시간 제한',
                icon: Clock,
                table: {
                    headers: ['구분', '학기 중', '방학 중'],
                    rows: [
                        ['D-2 석·박사 과정', '주 30시간', '무제한'],
                        ['D-2 학부 과정', '주 25시간', '무제한'],
                        ['D-4 어학연수', '주 20시간', '무제한'],
                    ],
                },
            },
            {
                label: '필요 서류',
                icon: FileCheck,
                items: [
                    '시간제 취업허가서 (출입국관리사무소 발급)',
                    '재학증명서 및 성적증명서 (직전 학기 평균 C학점/2.0 이상)',
                    '학교 유학생 담당자 확인서 (학교장 추천서)',
                    '근로계약서',
                    '여권 및 외국인등록증 사본',
                    '통장 사본 (급여 입금용)',
                ],
            },
            {
                label: '주의사항',
                icon: AlertTriangle,
                items: [
                    { text: '허가 없이 취업 시 강제퇴거 + 입국금지 사유', highlight: true },
                    '유흥업소(유흥주점, 단란주점), 사행시설 등 취업 금지 업종 확인',
                    'TOPIK 2급 이상 소지 시 허가 우대',
                    '산재보험 의무가입, 건강보험 지역가입',
                    { text: '사업주도 허가 없는 유학생 고용 시 과태료 부과', highlight: true },
                    '학기 중 초과 근무 시 체류자격 취소 가능',
                    '출석률 저조 시 시간제 취업허가 취소',
                ],
            },
        ],
    },
    {
        code: 'F-2',
        title: '거주',
        color: 'from-violet-600 to-violet-700',
        bg: 'bg-violet-50',
        border: 'border-violet-100',
        text: 'text-violet-800',
        accent: 'text-violet-700',
        icon: Shield,
        sections: [
            {
                label: '대상자',
                icon: Info,
                content: '점수제(F-2-7) 거주자격 취득자 (학력·소득·나이·한국어능력 등 점수 합산). 국민의 미성년 자녀, 영주권자 배우자, 난민 인정자 등 포함.',
            },
            {
                label: '취업 범위',
                icon: Building2,
                content: '내국인과 동일하게 자유롭게 취업 가능. 업종·사업장 제한 없음. 별도 취업허가 불요. 자영업(사업자등록)도 가능.',
            },
            {
                label: '주의사항',
                icon: AlertTriangle,
                items: [
                    '체류기간 연장 시 소득·납세 증빙 필요 (소득금액증명원 등)',
                    '4대 보험 내국인과 동일하게 가입 의무',
                    '범죄경력·체류기간 준수 등 자격 유지 요건 확인',
                    '점수제(F-2-7) 갱신 시 점수 재심사',
                    '5년 이상 체류 시 영주권(F-5) 신청 가능',
                ],
            },
        ],
    },
    {
        code: 'F-4',
        title: '재외동포',
        color: 'from-indigo-600 to-indigo-700',
        bg: 'bg-indigo-50',
        border: 'border-indigo-100',
        text: 'text-indigo-800',
        accent: 'text-indigo-700',
        icon: Globe,
        sections: [
            {
                label: '대상자',
                icon: Info,
                content: '대한민국 국적을 보유했던 자 (또는 그 직계비속)로서 외국국적을 취득한 재외동포. 출생에 의해 대한민국 국적 취득 후 외국국적 취득자 및 그 비속.',
            },
            {
                label: '취업 범위',
                icon: Building2,
                content: '대부분 업종 자유 취업 가능. 단, 단순노무 일부 제한 (건설 단순노무, 가사도우미, 간병인 등은 별도 체류자격외활동허가 필요).',
            },
            {
                label: '주의사항',
                icon: AlertTriangle,
                items: [
                    '체류기간: 2년 (무제한 연장 가능)',
                    { text: '취업활동 신고: 근로 시작 후 14일 이내 출입국관리사무소 신고', highlight: true },
                    '단순노무 취업 시 별도 체류자격외활동허가 필요',
                    '건강보험 당연적용 (입국 6개월 후 지역가입, 취업 시 직장가입)',
                    '국민연금: 상호주의에 따라 적용 (본국 협정 확인)',
                    '부동산 취득·금융거래 자유',
                ],
            },
        ],
    },
    {
        code: 'F-5',
        title: '영주',
        color: 'from-emerald-600 to-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-100',
        text: 'text-emerald-800',
        accent: 'text-emerald-700',
        icon: Shield,
        sections: [
            {
                label: '대상자',
                icon: Info,
                content: '5년 이상 합법 체류 + 생계유지 능력 + 품행 단정 + 한국어능력 등 영주 요건 충족자. 대한민국에 특별한 공로가 있는 자, 투자이민 기준 충족자 포함.',
            },
            {
                label: '취업 범위',
                icon: Building2,
                content: '내국인과 완전히 동일. 모든 업종 자유 취업 + 자영업 가능. 별도 허가 불요. 공무원 임용 일부 가능 (외국인 채용 가능 직위).',
            },
            {
                label: '주의사항',
                icon: AlertTriangle,
                items: [
                    '체류기간 제한 없음 (영주권)',
                    { text: '출국 후 2년 이상 미입국 시 영주자격 취소 가능', highlight: true },
                    '재입국허가 기간 내 입국 필수 (장기체류자 재입국허가 신청)',
                    '4대 보험 내국인과 동일 의무가입',
                    '선거권은 없으나, 지방선거 투표권 부여 (영주권 취득 3년 후)',
                    '귀화 신청 시 영주권 보유 기간 산입',
                ],
            },
        ],
    },
    {
        code: 'F-6',
        title: '결혼이민',
        color: 'from-pink-600 to-rose-600',
        bg: 'bg-pink-50',
        border: 'border-pink-100',
        text: 'text-pink-800',
        accent: 'text-pink-700',
        icon: User,
        sections: [
            {
                label: '대상자',
                icon: Info,
                content: '대한민국 국민과 혼인관계에 있는 외국인. 혼인 파탄 시에도 본인 귀책사유 없거나 자녀 양육 시 체류 가능 (F-6-2, F-6-3).',
            },
            {
                label: '취업 범위',
                icon: Building2,
                content: '내국인과 동일하게 자유 취업 가능. 업종·시간 제한 없음. 자영업도 가능. 별도 취업허가 불요.',
            },
            {
                label: '주의사항',
                icon: AlertTriangle,
                items: [
                    '4대 보험 내국인과 동일 적용',
                    '한국어·사회통합프로그램(KIIP) 이수 시 영주권(F-5) 및 귀화 신청 유리',
                    '귀화 신청 시 체류기간 산입 (간이귀화: 혼인 후 2년)',
                    '다문화가족지원센터 이용 가능 (1577-1366)',
                    '가정폭력 피해 시 긴급보호 및 체류자격 변경 가능',
                    '배우자 사망·실종 시에도 체류 연장 가능',
                ],
            },
        ],
    },
];

const governmentContacts = [
    { name: '외국인종합안내센터 (출입국)', tel: '1345', desc: '체류자격·비자·신고 등 전반 상담 (20개 국어 지원)', category: 'gov' },
    { name: '고용노동부 고객상담센터', tel: '1350', desc: '임금체불·부당해고·근로기준법 상담 (다국어 지원)', category: 'gov' },
    { name: '외국인력지원센터 (한국산업인력공단)', tel: '1577-0071', desc: '외국인 근로자 고충상담·생활지원·통역 서비스', category: 'gov' },
    { name: '대한법률구조공단', tel: '132', desc: '무료 법률상담·소송지원 (외국인 포함, 임금체불 소송 등)', category: 'gov' },
    { name: '한국산업인력공단 (HRDKorea)', tel: '1644-8000', desc: 'EPS 고용허가제·한국어능력시험(TOPIK)·기능사 자격 관련', category: 'gov' },
    { name: '사회통합정보망 (SOCINET)', tel: '1345 (4번)', desc: '사회통합프로그램(KIIP) 등록·이수·레벨테스트 문의', category: 'gov' },
    { name: '다문화가족지원센터', tel: '1577-1366', desc: '결혼이민자 상담·한국어교육·자녀지원 (긴급보호 포함)', category: 'gov' },
    { name: '근로감독관 (관할 지방고용노동청)', tel: '1350', desc: '사업장 근로감독·불법고용 신고·산업안전 관련', category: 'gov' },
];

const insuranceContacts = [
    { name: '국민연금공단', tel: '1355', desc: '외국인 국민연금 가입·반환일시금 청구·상호주의 확인', category: 'insurance' },
    { name: '국민건강보험공단', tel: '1577-1000', desc: '직장가입자 등록·보험료 산정·자격변동·피부양자 등록', category: 'insurance' },
    { name: '근로복지공단 (산재보험)', tel: '1588-0075', desc: '산재보험 가입·산업재해 신고·요양급여·휴업급여 청구', category: 'insurance' },
    { name: '고용보험 (고용센터)', tel: '1350', desc: '고용보험 가입확인·실업급여·육아휴직급여 문의', category: 'insurance' },
];

const foreignWorkerInsurance = [
    { name: '출국만기보험 (삼성화재)', tel: '1588-5114', desc: 'E-9 출국만기보험 가입·적립금 청구 (사업주 가입 의무, 월 급여 8.3%)', category: 'foreign' },
    { name: '귀국비용보험 (삼성화재)', tel: '1588-5114', desc: 'E-9 귀국비용보험 가입·청구 (근로자 본인 가입, 입국 후 80일 이내)', category: 'foreign' },
    { name: '상해보험 (DB손해보험)', tel: '1588-0100', desc: 'E-9·H-2 상해보험 가입 (입국 후 즉시, 업무 외 상해·질병 보장)', category: 'foreign' },
    { name: '보증보험 (서울보증보험)', tel: '1670-7000', desc: '체불 임금 보증보험·이행보증보험 관련 문의', category: 'foreign' },
    { name: '외국인근로자 전용보험 안내 (HRDKorea)', tel: '1644-8000', desc: '보험 가입 절차·서류·환급 관련 통합 안내', category: 'foreign' },
];

export default function ForeignWorkerGuide() {
    const [expandedVisa, setExpandedVisa] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const toggleVisa = (code) => {
        setExpandedVisa(expandedVisa === code ? null : code);
    };

    const filteredVisa = visaData.filter(v =>
        !searchTerm ||
        v.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.title.includes(searchTerm) ||
        v.sections.some(s =>
            s.content?.includes(searchTerm) ||
            s.items?.some(item => (typeof item === 'string' ? item : item.text).includes(searchTerm))
        )
    );

    const renderContactCard = (item, colorClass) => (
        <div key={item.name + item.tel} className="bg-white rounded-xl p-4 border border-slate-100 hover:border-slate-300 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-slate-800 leading-snug">{item.name}</p>
                <span className={`text-sm font-bold ${colorClass} whitespace-nowrap px-3 py-1 rounded-lg`} style={{ minWidth: 'fit-content' }}>
                    {item.tel}
                </span>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{item.desc}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-blue-50/20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-200">
                            <Globe size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900">외국인 고용 안내</h1>
                            <p className="text-xs text-slate-400 mt-0.5">체류자격별 고용 요건 · 관계기관 연락처 · 보험 안내</p>
                        </div>
                    </div>
                    {/* Search */}
                    <div className="relative max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="체류자격 검색 (예: H-2, 유학, 영주...)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all placeholder:text-slate-300"
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Quick Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: '자유취업', codes: 'F-2 / F-5 / F-6', color: 'from-emerald-500 to-emerald-600', desc: '업종 제한 없음' },
                        { label: '일부 제한', codes: 'F-4 / H-2', color: 'from-amber-500 to-amber-600', desc: '단순노무 일부 제한' },
                        { label: '허가 필요', codes: 'E-9', color: 'from-cyan-500 to-cyan-600', desc: '고용허가서 필수' },
                        { label: '시간 제한', codes: 'D-2 / D-4', color: 'from-blue-500 to-blue-600', desc: '시간제 취업허가' },
                    ].map((card) => (
                        <div key={card.label} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                            <div className={`text-[10px] font-bold text-white bg-gradient-to-r ${card.color} px-2 py-0.5 rounded-md inline-block mb-2`}>{card.label}</div>
                            <p className="text-sm font-bold text-slate-800">{card.codes}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{card.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Visa Detail Cards */}
                <div className="space-y-4">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <FileCheck size={18} className="text-cyan-600" />
                        체류자격별 상세 안내
                    </h2>

                    {filteredVisa.length === 0 && (
                        <div className="text-center py-12 text-sm text-slate-400">
                            검색 결과가 없습니다.
                        </div>
                    )}

                    {filteredVisa.map((visa) => {
                        const isExpanded = expandedVisa === visa.code;
                        const IconComp = visa.icon;
                        return (
                            <div key={visa.code} className={`${visa.bg} rounded-xl overflow-hidden border ${visa.border} transition-all`}>
                                {/* Visa Header (Click to expand) */}
                                <button
                                    onClick={() => toggleVisa(visa.code)}
                                    className={`w-full px-5 py-4 bg-gradient-to-r ${visa.color} flex items-center gap-3 text-left transition-all hover:opacity-95`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                        <IconComp size={16} className="text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-white text-base">{visa.code} ({visa.title})</h3>
                                    </div>
                                    <ChevronDown
                                        size={18}
                                        className={`text-white/70 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="p-5 space-y-4">
                                        {visa.sections.map((section, si) => {
                                            const SIcon = section.icon;
                                            return (
                                                <div key={si}>
                                                    <p className={`text-xs font-bold ${visa.accent} mb-1.5 flex items-center gap-1.5`}>
                                                        <SIcon size={13} />
                                                        {section.label}
                                                    </p>
                                                    {section.content && (
                                                        <p className={`text-sm ${visa.text} leading-relaxed`}>{section.content}</p>
                                                    )}
                                                    {section.items && (
                                                        <ul className={`text-sm ${visa.text} space-y-1 ml-4 list-disc`}>
                                                            {section.items.map((item, ii) => (
                                                                <li key={ii}>
                                                                    {typeof item === 'string' ? item : (
                                                                        <span className={item.highlight ? 'font-bold text-red-600' : ''}>{item.text}</span>
                                                                    )}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    {section.table && (
                                                        <div className="bg-white/60 rounded-lg p-3 mt-1.5">
                                                            <table className={`w-full text-sm ${visa.text}`}>
                                                                <thead>
                                                                    <tr className="border-b border-slate-200">
                                                                        {section.table.headers.map((h, hi) => (
                                                                            <th key={hi} className="text-left pb-2 font-bold text-xs">{h}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100">
                                                                    {section.table.rows.map((row, ri) => (
                                                                        <tr key={ri}>
                                                                            {row.map((cell, ci) => (
                                                                                <td key={ci} className="py-2 text-sm">{cell}</td>
                                                                            ))}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Contact Information */}
                <div className="space-y-5 mt-8">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Phone size={18} className="text-slate-600" />
                        관계기관 연락처
                    </h2>

                    {/* Government Agencies */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-700 to-slate-800 flex items-center gap-2">
                            <Building2 size={15} className="text-white" />
                            <h3 className="font-bold text-sm text-white">정부·공공기관</h3>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {governmentContacts.map(item =>
                                renderContactCard(item, 'text-indigo-600 bg-indigo-50')
                            )}
                        </div>
                    </div>

                    {/* 4 Major Insurance */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-700 to-teal-700 flex items-center gap-2">
                            <Shield size={15} className="text-white" />
                            <h3 className="font-bold text-sm text-white">4대 보험 기관</h3>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {insuranceContacts.map(item =>
                                renderContactCard(item, 'text-emerald-600 bg-emerald-50')
                            )}
                        </div>
                    </div>

                    {/* Foreign Worker Specific Insurance */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 flex items-center gap-2">
                            <FileCheck size={15} className="text-white" />
                            <h3 className="font-bold text-sm text-white">외국인 근로자 전용 보험</h3>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {foreignWorkerInsurance.map(item =>
                                renderContactCard(item, 'text-amber-600 bg-amber-50')
                            )}
                        </div>
                    </div>

                    {/* Notice */}
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                        <p className="text-xs text-amber-700 leading-relaxed flex items-start gap-2">
                            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                            <span>
                                위 전화번호는 변경될 수 있습니다. 외국인 근로자 관련 민원은 <span className="font-bold">1345 (외국인종합안내센터)</span>에서
                                20개 국어로 상담 가능합니다. 운영시간: 평일 09:00~22:00, 주말·공휴일 09:00~18:00.
                                <br />
                                <span className="font-bold">고용허가제 관련</span> 문의는 한국산업인력공단 <span className="font-bold">1644-8000</span>,
                                <span className="font-bold"> 임금·근로조건</span> 관련은 고용노동부 <span className="font-bold">1350</span>으로 연락하세요.
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
