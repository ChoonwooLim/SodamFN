import { Check, ChevronRight, AlertTriangle, Calendar } from 'lucide-react';

/**
 * 카테고리 페이지의 개별 항목 카드.
 *
 * Props:
 * - item: 카탈로그 항목
 * - progress: SalesGuideProgress row (또는 null)
 * - syncCount: { completed, total, label } (또는 null)
 * - onToggle: (itemKey, isCompleted) => void
 * - onOpen: (item) => void
 */
export default function ItemCard({ item, progress, syncCount, onToggle, onOpen }) {
  const isCompleted = progress?.is_completed || (syncCount && syncCount.total > 0 && syncCount.completed >= syncCount.total);

  // 만료 D-day
  const today = new Date();
  let dDay = null;
  let isExpired = false;
  let isExpiringSoon = false;
  if (progress?.expires_at) {
    const exp = new Date(progress.expires_at);
    dDay = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    isExpired = dDay < 0;
    isExpiringSoon = dDay >= 0 && dDay <= 30;
  }

  // sync partial
  const isSyncPartial = syncCount && syncCount.total > 0 && syncCount.completed < syncCount.total;

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-4">
        {/* 체크박스 (44px+ 터치영역) */}
        <button
          onClick={() => onToggle(item.key, !isCompleted)}
          className={`flex-shrink-0 w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-colors ${
            isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : 'bg-white border-slate-300 hover:border-blue-400'
          }`}
          aria-label={isCompleted ? '완료 해제' : '완료 표시'}
        >
          {isCompleted && <Check className="w-5 h-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {item.required && !isCompleted && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-label="필수" />
            )}
            <h4 className="text-base font-semibold text-slate-900">{item.title}</h4>

            {/* 배지들 */}
            {item.required && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">필수</span>
            )}
            {item.renewalCycle && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                매 {item.renewalCycle.months}개월
              </span>
            )}
            {dDay !== null && !isExpired && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isExpiringSoon ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                D-{dDay}
              </span>
            )}
            {isExpired && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">만료</span>
            )}
            {isSyncPartial && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                {syncCount.completed}/{syncCount.total}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-600 line-clamp-2 mb-2">{item.description}</p>

          {progress?.completed_at && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {progress.completed_at}
              {progress.expires_at && ` · ${progress.expires_at} 만료`}
            </p>
          )}
        </div>

        <button
          onClick={() => onOpen(item)}
          className="flex-shrink-0 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition"
        >
          자세히
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
