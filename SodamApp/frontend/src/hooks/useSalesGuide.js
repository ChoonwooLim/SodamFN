import { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { getIndustryData } from '../data/sales-guide';

/**
 * 영업관리 데이터 통합 훅.
 * 페이지 진입 시 progress + sync + stats 한 번에 페치.
 *
 * Returns:
 * - industry: 정적 카탈로그 (categories 포함)
 * - progress: { item_key: progress_row } map
 * - sync: { sync_key: { completed, total, label } }
 * - stats: { overall, categories: [...] }
 * - loading, error, refresh, patchItem
 */
export function useSalesGuide(industryKey = 'kimbap') {
  const [progress, setProgress] = useState({});
  const [sync, setSync] = useState({});
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const industry = getIndustryData(industryKey);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [progressRes, syncRes, statsRes] = await Promise.all([
        api.get('/sales-guide/progress'),
        api.get('/sales-guide/sync-status'),
        api.get('/sales-guide/stats'),
      ]);

      const progressMap = {};
      progressRes.data.items.forEach((p) => {
        progressMap[p.item_key] = p;
      });
      setProgress(progressMap);
      setSync(syncRes.data);
      setStats(statsRes.data);
    } catch (e) {
      console.error('Sales guide fetch failed:', e);
      setError(e.message || '데이터를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const patchItem = useCallback(
    async (itemKey, updates) => {
      try {
        const res = await api.patch(`/sales-guide/progress/${itemKey}`, updates);
        setProgress((prev) => ({ ...prev, [itemKey]: res.data }));
        // stats 재계산을 위해 stats 만 다시 페치 (가벼운 쿼리)
        const statsRes = await api.get('/sales-guide/stats');
        setStats(statsRes.data);
        return res.data;
      } catch (e) {
        console.error('Patch failed:', e);
        throw e;
      }
    },
    []
  );

  return { industry, progress, sync, stats, loading, error, refresh: fetchAll, patchItem };
}
