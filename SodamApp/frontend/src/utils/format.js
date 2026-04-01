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
