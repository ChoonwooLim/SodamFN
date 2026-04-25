import { Sparkles, AlertTriangle } from 'lucide-react';
import ProgressCard from '../../components/sales-guide/ProgressCard';
import { useSalesGuide } from '../../hooks/useSalesGuide';

export default function SalesGuideHome() {
  const { industry, stats, loading, error } = useSalesGuide();

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p className="text-slate-500">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" /> {error}
        </div>
      </div>
    );
  }

  const overall = stats?.overall || { completed: 0, total: 0, percent: 0 };
  const isFirstTime = overall.completed === 0;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <header className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">영업관리</h1>
        </div>
        <p className="text-slate-600 text-sm sm:text-base">
          {industry.industryLabel} · 사업 시작·운영에 필요한 모든 정보
        </p>

        {/* 전체 진행률 */}
        <div className="mt-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">전체 진행률</span>
            <span className="text-2xl font-bold text-blue-600">{overall.percent}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${overall.percent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            필수 {overall.total}개 중 {overall.completed}개 완료
          </p>
        </div>
      </header>

      {/* 1차 방문 안내 */}
      {isFirstTime && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-900 mb-1">처음 사업 시작하시나요?</h3>
          <p className="text-sm text-blue-800">
            아래 6 카테고리에 영업 시작·운영에 필요한 모든 항목이 정리되어 있습니다.
            카드를 클릭해서 하나씩 진행 상황을 확인하세요.
          </p>
        </div>
      )}

      {/* 6 카테고리 카드 (2x3 grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {industry.categories.map((cat) => {
          const catStats = stats?.categories?.find((s) => s.key === cat.key);
          return <ProgressCard key={cat.key} category={cat} stats={catStats} />;
        })}
      </div>
    </div>
  );
}
