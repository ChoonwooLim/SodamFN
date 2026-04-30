/**
 * 사업주 전용 비공개 정책 배지
 *
 * 사업주(admin/superadmin) 만 보이는 운영 상태 배지 — 직원 목록·헤더 등에서
 * "이 직원이 어떤 비공개 정책으로 운영 중인지" 한눈에 파악하도록.
 *
 * 입력은 staff 응답에 admin 요약으로 포함된 두 필드:
 *   - private_payment_method: 'transfer' | 'cash' | 'other_account'
 *   - private_tax_unreported: boolean
 *
 * 일반 직원·매니저 토큰의 응답에는 이 필드가 아예 없으므로 자동으로 미렌더.
 */
export default function StaffPrivateBadges({ staff, size = 'sm' }) {
    if (!staff) return null;
    const method = staff.private_payment_method;
    const taxUnreported = !!staff.private_tax_unreported;

    const items = [];
    if (method === 'cash') items.push({ key: 'cash', label: '현금지급', color: 'amber' });
    if (method === 'other_account') items.push({ key: 'other', label: '타인계좌', color: 'amber' });
    if (taxUnreported) items.push({ key: 'tax', label: '세금미신고', color: 'red' });

    if (items.length === 0) return null;

    const padClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
    const colorClass = (c) => c === 'red'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-amber-50 text-amber-800 border-amber-200';

    return (
        <span className="inline-flex items-center gap-1 flex-wrap">
            {items.map(it => (
                <span
                    key={it.key}
                    title="사업주 전용 — 외부에 노출되지 않음"
                    className={`inline-flex items-center rounded-full border font-bold ${padClass} ${colorClass(it.color)}`}
                >
                    {it.label}
                </span>
            ))}
        </span>
    );
}
