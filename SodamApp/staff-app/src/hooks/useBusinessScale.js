import { useEffect, useState } from 'react';
import api from '../api';

/**
 * 사업장 규모(employee_scale) 조회 훅.
 * 결과: 'over5' | 'under5' | null (loading)
 *
 * JWT의 business_id를 기준으로 /auth/business-info 를 1회 조회하고
 * sessionStorage에 캐시하여 네비게이션 간 중복 호출 방지.
 */
export function useBusinessScale() {
    const [scale, setScale] = useState(() => sessionStorage.getItem('business_scale'));

    useEffect(() => {
        if (scale) return;
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const payload = JSON.parse(atob(token.split('.')[1]));
            const bid = payload.business_id;
            if (!bid) return;
            api.get(`/auth/business-info?bid=${bid}`)
                .then((res) => {
                    const s = res.data?.employee_scale || 'over5';
                    sessionStorage.setItem('business_scale', s);
                    setScale(s);
                })
                .catch(() => { });
        } catch { /* ignore */ }
    }, [scale]);

    return scale;
}
