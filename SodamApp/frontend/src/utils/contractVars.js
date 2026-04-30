/**
 * 전자근로계약서 — 표준 양식 + 변수 치환 유틸
 *
 * 사용처:
 *   - ContractSettings: 기본 양식 초기화
 *   - StaffDetail: 모달 열 때 자동 치환
 *   - ContractTab: '변수 치환' 버튼
 *
 * 모든 변수는 `{변수명}` 형태. 미입력 필드는 빈 문자열 또는 안내 placeholder.
 */
import { formatNumber } from './format';

/**
 * 고용노동부 표준근로계약서 (기간의 정함이 없는 경우)
 * 출처 양식 기반, 변수 자리에 {변수명} 박아놓음.
 */
export function getStandardContractTemplate() {
    return `표준근로계약서

{business_owner}(이하 "사업주"라 함)와(과) {name}(이하 "근로자"라 함)은(는) 다음과 같이 근로계약을 체결한다.

1. 근로개시일 : {start_date}부터 {contract_end_date}까지
   ※ 근로계약기간을 정하지 않는 경우에는 "근로개시일"만 기재

2. 근 무 장 소 : {business_name} ({business_address})

3. 업무의 내용 : {job_description}

4. 소정근로시간 : {work_start_time}부터 {work_end_time}까지
   (휴게시간 : {rest_start_time} ~ {rest_end_time})

5. 근무일/휴일 : 매주 {working_days} 근무, 주휴일 {weekly_holiday}

6. 임   금
   - 월(일, 시간)급 : {wage}원
   - 상여금 : {bonus_info}
   - 기타급여(제수당 등) : 있음(주휴수당), 없음( )
   - 임금지급일 : {salary_payment_date} (휴일의 경우는 전일 지급)
   - 지급방법 : {salary_payment_method}

7. 연차유급휴가
   - 연차유급휴가는 근로기준법에서 정하는 바에 따라 부여함

8. 사회보험 적용여부(해당란에 체크)
   ☐ 고용보험   ☐ 산재보험   ☐ 국민연금   ☐ 건강보험

9. 근로계약서 교부
   - 사업주는 근로계약을 체결함과 동시에 본 계약서를 사본하여 근로자의 교부요구와
     관계없이 근로자에게 교부함 (근로기준법 제17조 이행)

10. 근로계약, 취업규칙 등의 성실한 이행의무
    - 사업주와 근로자는 각자가 근로계약, 취업규칙, 단체협약을 지키고 성실하게 이행하여야 함

11. 기 타
    - 이 계약에 정함이 없는 사항은 근로기준법령에 의함

{today_korean}

(사 업 주) 사업체명 : {business_name}             (전화 : {business_phone})
           주    소 : {business_address}
           대 표 자 : {business_owner}                                    (서명)
           사업자등록번호 : {business_number}

(근 로 자) 주    소 : {address}
           연 락 처 : {phone}
           성    명 : {name}                                              (서명)
`;
}

/**
 * 직원 + 사업주 + 오늘 날짜 데이터를 변수 매핑 dict 로 빌드.
 *
 * @param {Object} staff   직원 폼/객체 (Staff 모델 필드)
 * @param {Object} business 사업주 정보 (GET /api/business-info 응답)
 * @returns {Record<string, string>}
 */
export function buildContractVariables(staff = {}, business = {}) {
    const wageNum = staff.contract_type === '정규직'
        ? staff.monthly_salary
        : staff.hourly_wage;
    const formattedWage = wageNum ? formatNumber(wageNum) : '';

    const bonusInfo = staff.bonus_enabled
        ? `있음 (${staff.bonus_amount || ''})`
        : '없음';

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = today.getMonth() + 1;
    const dd = today.getDate();

    return {
        // ── 직원 정보 ──
        '{name}': staff.name || '',
        '{phone}': staff.phone || '',
        '{email}': staff.email || '',
        '{address}': staff.address || '',
        '{resident_number}': staff.resident_number || '',
        '{birth_date}': staff.birth_date || '',
        '{nationality}': staff.nationality || '',
        '{visa_type}': staff.visa_type || '',
        '{role}': staff.role || '',
        '{contract_type}': staff.contract_type || '',

        // ── 임금/근무 ──
        '{wage}': formattedWage,
        '{hourly_wage}': staff.hourly_wage ? formatNumber(staff.hourly_wage) : '',
        '{monthly_salary}': staff.monthly_salary ? formatNumber(staff.monthly_salary) : '',
        '{insurance_base_salary}': staff.insurance_base_salary ? formatNumber(staff.insurance_base_salary) : '',
        '{bonus_info}': bonusInfo,
        '{bonus_amount}': staff.bonus_amount || '',
        '{salary_payment_date}': staff.salary_payment_date || '매월 말일',
        '{salary_payment_method}': staff.salary_payment_method || '근로자 계좌 입금',

        // ── 계약 기간 / 근무 시간 ──
        '{start_date}': staff.start_date || '',
        '{contract_start_date}': staff.contract_start_date || '',
        '{contract_end_date}': staff.contract_end_date || '근로계약기간을 정하지 않은 경우 기재 생략',
        '{work_start_time}': staff.work_start_time || '',
        '{work_end_time}': staff.work_end_time || '',
        '{rest_start_time}': staff.rest_start_time || '',
        '{rest_end_time}': staff.rest_end_time || '',
        '{working_days}': staff.working_days || '',
        '{weekly_holiday}': staff.weekly_holiday || '',
        '{job_description}': staff.job_description || '',

        // ── 계좌 (해당 시) ──
        '{bank_name}': staff.bank_name || '',
        '{account_number}': staff.account_number || '',
        '{account_holder}': staff.account_holder || '',

        // ── 사업주 정보 ──
        '{business_name}': business.business_name || '',
        '{business_address}': business.address || '',
        '{business_phone}': business.phone || '',
        '{business_owner}': business.owner_name || '',
        '{business_number}': business.business_number || '',
        '{business_type}': business.business_type || '',
        '{business_email}': business.email || '',
        '{business_fax}': business.fax || '',
        '{representative_eng}': business.representative_eng || '',
        '{tax_office}': business.tax_office || '',

        // ── 오늘 날짜 ──
        '{today}': `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
        '{today_year}': String(yyyy),
        '{today_month}': String(mm),
        '{today_day}': String(dd),
        '{today_korean}': `${yyyy}년 ${mm}월 ${dd}일`,
    };
}

/**
 * 템플릿 문자열에 변수 매핑을 적용해 치환.
 * 미정의 변수는 그대로 둠 (빈 문자열로 안 만듦 — 사용자가 변수 자리 인지 가능).
 */
export function applyContractVariables(template, variables) {
    let out = template || '';
    for (const [key, value] of Object.entries(variables)) {
        // {key} 형태 정규식 안전 이스케이프 (key 안에 정규식 메타문자 없음 — 단순 문자열)
        out = out.split(key).join(value);
    }
    return out;
}

/**
 * 변수 안내용 카탈로그 (UI 도움말 표시).
 */
export const CONTRACT_VARIABLE_CATALOG = [
    {
        group: '직원 정보',
        items: [
            { key: '{name}', label: '성명' },
            { key: '{phone}', label: '연락처' },
            { key: '{email}', label: '이메일' },
            { key: '{address}', label: '주소' },
            { key: '{resident_number}', label: '주민등록번호' },
            { key: '{birth_date}', label: '생년월일' },
            { key: '{role}', label: '직책' },
            { key: '{contract_type}', label: '계약유형' },
        ],
    },
    {
        group: '임금/근무',
        items: [
            { key: '{wage}', label: '임금 (정규직=월급, 그 외=시급)' },
            { key: '{hourly_wage}', label: '시급' },
            { key: '{monthly_salary}', label: '월급' },
            { key: '{bonus_info}', label: '상여금 (있음/없음)' },
            { key: '{salary_payment_date}', label: '급여 지급일' },
            { key: '{salary_payment_method}', label: '지급 방법' },
        ],
    },
    {
        group: '계약 기간 / 근무 시간',
        items: [
            { key: '{start_date}', label: '근로개시일' },
            { key: '{contract_end_date}', label: '계약 종료일' },
            { key: '{work_start_time}', label: '근무 시작' },
            { key: '{work_end_time}', label: '근무 종료' },
            { key: '{rest_start_time}', label: '휴게 시작' },
            { key: '{rest_end_time}', label: '휴게 종료' },
            { key: '{working_days}', label: '근무일' },
            { key: '{weekly_holiday}', label: '주휴일' },
            { key: '{job_description}', label: '업무 내용' },
        ],
    },
    {
        group: '사업주 정보',
        items: [
            { key: '{business_name}', label: '사업체명' },
            { key: '{business_address}', label: '사업장 주소' },
            { key: '{business_phone}', label: '사업장 전화' },
            { key: '{business_owner}', label: '대표자명' },
            { key: '{business_number}', label: '사업자등록번호' },
        ],
    },
    {
        group: '오늘 날짜',
        items: [
            { key: '{today_korean}', label: 'YYYY년 M월 D일' },
            { key: '{today}', label: 'YYYY-MM-DD' },
            { key: '{today_year}', label: '연도' },
            { key: '{today_month}', label: '월' },
            { key: '{today_day}', label: '일' },
        ],
    },
];
