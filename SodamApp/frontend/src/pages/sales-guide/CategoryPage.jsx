import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, ArrowLeft } from 'lucide-react';
import ItemCard from '../../components/sales-guide/ItemCard';
import ItemDetailModal from '../../components/sales-guide/ItemDetailModal';
import { useSalesGuide } from '../../hooks/useSalesGuide';

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'required', label: '필수' },
  { key: 'completed', label: '완료' },
  { key: 'incomplete', label: '미완료' },
  { key: 'expiring', label: '만료임박' },
];

export default function CategoryPage() {
  const { category: categoryKey } = useParams();
  const { industry, progress, sync, stats, loading, patchItem } = useSalesGuide();
  const [filter, setFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);

  if (loading) {
    return <div className="p-6"><p className="text-slate-500">불러오는 중...</p></div>;
  }

  const category = industry.categories.find((c) => c.key === categoryKey);
  if (!category) {
    return <div className="p-6"><p>카테고리를 찾을 수 없습니다.</p></div>;
  }

  const catStats = stats?.categories?.find((s) => s.key === categoryKey);
  const currentIndex = industry.categories.findIndex((c) => c.key === categoryKey);
  const prevCat = currentIndex > 0 ? industry.categories[currentIndex - 1] : null;
  const nextCat = currentIndex < industry.categories.length - 1 ? industry.categories[currentIndex + 1] : null;

  // 필터 적용
  const filteredItems = category.items.filter((item) => {
    const p = progress[item.key];
    const s = item.syncWith ? sync[item.syncWith] : null;
    const isCompleted = p?.is_completed || (s && s.total > 0 && s.completed >= s.total);

    if (filter === 'required') return item.required;
    if (filter === 'completed') return isCompleted;
    if (filter === 'incomplete') return !isCompleted;
    if (filter === 'expiring') {
      if (!p?.expires_at) return false;
      const days = Math.ceil((new Date(p.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 30;
    }
    return true;
  });

  const handleToggle = async (itemKey, isCompleted) => {
    try {
      await patchItem(itemKey, { is_completed: isCompleted });
    } catch (e) {
      alert('변경 실패: ' + e.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* 브레드크럼 */}
      <nav className="mb-4 text-sm text-slate-600">
        <Link to="/sales-guide" className="hover:text-blue-600 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 영업관리
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-900 font-medium">{category.label}</span>
      </nav>

      {/* 카테고리 헤더 */}
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">{category.label}</h1>
        <p className="text-sm text-slate-600 mb-3">{category.description}</p>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-700">진행률</span>
            <span className="text-lg font-bold text-blue-600">{catStats?.percent ?? 0}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${catStats?.percent ?? 0}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            필수 {catStats?.required_total ?? 0}개 중 {catStats?.required_completed ?? 0}개 완료
            {category.items.filter((i) => !i.required).length > 0 && (
              <> · 선택 {category.items.filter((i) => !i.required).length}개 항목</>
            )}
          </p>
        </div>
      </header>

      {/* 필터 (sticky) */}
      <div className="sticky top-0 bg-slate-50 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4 z-10 border-b border-slate-200">
        <div className="flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                filter === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 항목 리스트 */}
      <div className="space-y-3 mb-6">
        {filteredItems.length === 0 ? (
          <p className="text-center text-slate-500 py-8">조건에 맞는 항목이 없습니다.</p>
        ) : (
          filteredItems.map((item) => (
            <ItemCard
              key={item.key}
              item={item}
              progress={progress[item.key]}
              syncCount={item.syncWith ? sync[item.syncWith] : null}
              onToggle={handleToggle}
              onOpen={setSelectedItem}
            />
          ))
        )}
      </div>

      {/* 카테고리 네비 */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        {prevCat ? (
          <Link
            to={`/sales-guide/${prevCat.key}`}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600"
          >
            <ChevronLeft className="w-4 h-4" />
            이전: {prevCat.label}
          </Link>
        ) : (
          <span />
        )}
        {nextCat && (
          <Link
            to={`/sales-guide/${nextCat.key}`}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600"
          >
            다음: {nextCat.label}
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* 모달 */}
      <ItemDetailModal
        item={selectedItem}
        progress={selectedItem ? progress[selectedItem.key] : null}
        syncCount={selectedItem?.syncWith ? sync[selectedItem.syncWith] : null}
        onClose={() => setSelectedItem(null)}
        onPatch={patchItem}
      />
    </div>
  );
}
