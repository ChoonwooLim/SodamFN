export function formatNumber(n) {
    if (n == null || isNaN(n) || n === '') return '0';
    return Number(n).toLocaleString('ko-KR');
}

export function getWeekday(dateStr) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const d = new Date(dateStr);
    return days[d.getDay()];
}

export function formatCurrency(n) {
    if (n == null || isNaN(n) || n === '') return '0원';
    return formatNumber(n) + '원';
}

/**
 * 백엔드가 보내는 UTC datetime 을 KST 로 변환해 표시.
 *
 * 백엔드는 `datetime.utcnow()` 로 저장한 naive UTC 값을 타임존 표식 없이
 * 직렬화한다("2026-06-22T18:00:01"). JS `new Date()` 는 표식 없는 문자열을
 * 로컬(KST)로 해석하므로 변환 없이 9시간 어긋난다. 표식이 없으면 'Z'(UTC)를
 * 붙여 올바르게 KST 로 변환한다. 이미 'Z'/오프셋이 있으면(예: 일부 aware 필드)
 * 그대로 파싱한다.
 *
 * ⚠️ 서버 `datetime.now()`(KST naive) 로 저장되는 필드에는 사용 금지 —
 *    그런 값은 이미 KST 이므로 변환하면 거꾸로 9시간 밀린다. utcnow() 필드 전용.
 */
export function parseUtc(value) {
    if (!value) return null;
    let s = String(value).trim();
    if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
        s = s.replace(' ', 'T') + 'Z';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

function _toUtcAware(value) {
    return parseUtc(value) ?? new Date('');
}

export function formatUtcDateTime(value, fallback = '-') {
    if (!value) return fallback;
    const d = _toUtcAware(value);
    return isNaN(d.getTime()) ? fallback : d.toLocaleString('ko-KR');
}

export function formatUtcDate(value, fallback = '-') {
    if (!value) return fallback;
    const d = _toUtcAware(value);
    return isNaN(d.getTime()) ? fallback : d.toLocaleDateString('ko-KR');
}
