// 출처 배지 — CardSalesApproval / CardPayment 등 source 컬럼 시각화
// Phase 1E (CODEF) 신규. Phase 4 와서 'popbill' source 도 같은 컴포넌트 사용.

const STYLES = {
    codef: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        label: 'CODEF',
        title: 'CODEF 자동 수집',
    },
    excel: {
        bg: 'bg-slate-200',
        text: 'text-slate-700',
        label: 'Excel',
        title: '엑셀 업로드',
    },
    manual: {
        bg: 'bg-amber-100',
        text: 'text-amber-800',
        label: '수동',
        title: '직접 입력',
    },
    excel_overridden: {
        bg: 'bg-slate-100',
        text: 'text-slate-400',
        label: 'Excel',
        title: 'CODEF 자동 수집으로 대체됨',
        strike: true,
    },
    popbill: {
        bg: 'bg-emerald-100',
        text: 'text-emerald-800',
        label: '팝빌',
        title: '팝빌 발급',
    },
};

export default function SourceBadge({ source, size = 'sm' }) {
    const style = STYLES[source] || STYLES.manual;
    const sizing = size === 'xs'
        ? 'px-1.5 py-0.5 text-[11px]'
        : 'px-2 py-0.5 text-xs';
    return (
        <span
            className={`inline-flex items-center rounded font-medium ${style.bg} ${style.text} ${sizing} ${style.strike ? 'line-through' : ''}`}
            title={style.title}
        >
            {style.label}
        </span>
    );
}

export { STYLES as SOURCE_STYLES };
