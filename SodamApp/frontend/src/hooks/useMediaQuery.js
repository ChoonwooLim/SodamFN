import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile viewport
 * @param {number} breakpoint - Max width in px to consider "mobile" (default: 768)
 * @returns {boolean} true if viewport width <= breakpoint
 */
export function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
    );

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
        const handler = (e) => setIsMobile(e.matches);

        // Set initial value
        setIsMobile(mql.matches);

        // Modern API
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [breakpoint]);

    return isMobile;
}
