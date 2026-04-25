import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ChevronRight, AlertTriangle } from 'lucide-react';

/**
 * 영업관리 랜딩의 카테고리 진행률 카드.
 *
 * Props:
 * - category: { key, label, icon, color, description }
 * - stats: { required_total, required_completed, percent, alerts }
 */
export default function ProgressCard({ category, stats }) {
  const navigate = useNavigate();
  const Icon = Icons[category.icon] || Icons.Folder;

  const percent = stats?.percent ?? 0;
  const alerts = stats?.alerts ?? [];
  const expiringCount = alerts.filter((a) => a.type === 'expiring_soon').length;

  // 시각적 상태
  let borderClass = 'border-slate-200';
  if (percent === 100) borderClass = 'border-green-400';
  else if (expiringCount > 0) borderClass = 'border-orange-400';
  else if (percent === 0) borderClass = 'border-dashed border-slate-300';

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <button
      onClick={() => navigate(`/sales-guide/${category.key}`)}
      className={`w-full text-left bg-white rounded-2xl p-5 border-2 ${borderClass} hover:shadow-lg transition-all duration-200 group`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[category.color] || colorClasses.blue}`}>
          <Icon className="w-6 h-6" />
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-1">{category.label}</h3>
      <p className="text-sm text-slate-500 mb-4 line-clamp-1">{category.description}</p>

      {/* 진행률 바 */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
          <span>진행률</span>
          <span className="font-semibold">{percent}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percent === 100 ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        필수 {stats?.required_total ?? 0}개 중 {stats?.required_completed ?? 0}개 완료
      </p>

      {expiringCount > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 px-2.5 py-1.5 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{expiringCount}건 만료임박</span>
        </div>
      )}

      {percent === 0 && (
        <div className="mt-3 text-xs text-slate-500 font-medium">시작하기 →</div>
      )}
    </button>
  );
}
