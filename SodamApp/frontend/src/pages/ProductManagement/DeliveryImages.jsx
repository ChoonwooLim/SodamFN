import { useState, useCallback, useRef } from 'react';
import {
  Truck, Download, Upload, Search, Check, Grid3x3,
  List, ZoomIn, X, ExternalLink, Image as ImageIcon
} from 'lucide-react';

/* ── 상품 이미지 목록 (public/recipes/products/) ── */
const PRODUCT_IMAGES = [
  { id: 1, name: '소담김밥', file: 'sodam-gimbap.jpg', category: '김밥류' },
  { id: 2, name: '불고기김밥', file: 'bulgogi-gimbap.jpg', category: '김밥류' },
  { id: 3, name: '참치김밥', file: 'chamchi-gimbap.jpg', category: '김밥류' },
  { id: 4, name: '치즈김밥', file: 'cheese-gimbap.jpg', category: '김밥류' },
  { id: 5, name: '당근라페김밥', file: 'danggeun-gimbap.jpg', category: '김밥류' },
  { id: 6, name: '땡초멸치김밥', file: 'ttaengcho-gimbap.jpg', category: '김밥류' },
  { id: 7, name: '스팸에그김밥', file: 'spam-egg-gimbap.jpg', category: '김밥류' },
  { id: 8, name: '꼬마김밥', file: 'kkoma-gimbap.jpg', category: '김밥류' },
  { id: 9, name: '모둠김밥', file: 'modum-gimbap.jpg', category: '김밥류' },
  { id: 10, name: '소담떡볶이', file: 'tteokbokki.jpg', category: '분식류' },
  { id: 11, name: '미니떡볶이', file: 'mini-tteokbokki.jpg', category: '분식류' },
  { id: 12, name: '소담순대', file: 'sundae.jpg', category: '분식류' },
  { id: 13, name: '미니순대', file: 'mini-sundae.jpg', category: '분식류' },
  { id: 14, name: '소담어묵', file: 'eomuk.jpg', category: '분식류' },
  { id: 15, name: '유부초밥', file: 'yubu.jpg', category: '분식류' },
  { id: 16, name: '삶은계란', file: 'egg.jpg', category: '분식류' },
  { id: 17, name: '스팸주먹밥', file: 'spam-onigiri.jpg', category: '주먹밥류' },
  { id: 18, name: '순한맛주먹밥', file: 'sunhan-onigiri.jpg', category: '주먹밥류' },
  { id: 19, name: '매콤주먹밥', file: 'maekom-onigiri.jpg', category: '주먹밥류' },
  { id: 20, name: '불고기주먹밥', file: 'bulgogi-onigiri.jpg', category: '주먹밥류' },
  { id: 21, name: '멸치주먹밥', file: 'myeolchi-onigiri.jpg', category: '주먹밥류' },
  { id: 22, name: '햄치즈주먹밥', file: 'hamcheese-onigiri.jpg', category: '주먹밥류' },
];

/* ── 배달 플랫폼 프리셋 ── */
const PLATFORMS = [
  { id: 'coupang', name: '쿠팡이츠', size: '800×800', w: 800, h: 800, color: '#E31837', bg: '#FEF2F2' },
  { id: 'baemin', name: '배달의민족', size: '1000×1000', w: 1000, h: 1000, color: '#2AC1BC', bg: '#F0FDFA' },
  { id: 'yogiyo', name: '요기요', size: '600×600', w: 600, h: 600, color: '#FA0050', bg: '#FFF1F2' },
  { id: 'original', name: '원본', size: '원본 크기', w: null, h: null, color: '#64748B', bg: '#F8FAFC' },
];

const CATEGORIES = ['전체', '김밥류', '분식류', '주먹밥류'];
const IMG_BASE = '/recipes/products/';

export default function DeliveryImages() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('전체');
  const [viewMode, setViewMode] = useState('grid');
  const [selected, setSelected] = useState(new Set());
  const [platform, setPlatform] = useState('coupang');
  const [previewImg, setPreviewImg] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef(null);

  /* ── 필터링 ── */
  const filtered = PRODUCT_IMAGES.filter(img => {
    if (category !== '전체' && img.category !== category) return false;
    if (search && !img.name.includes(search)) return false;
    return true;
  });

  /* ── 선택 토글 ── */
  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(i => i.id)));
    }
  };

  /* ── 개별 다운로드 (리사이즈) ── */
  const downloadSingle = async (img) => {
    const preset = PLATFORMS.find(p => p.id === platform);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = IMG_BASE + img.file;

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const targetW = preset.w || image.naturalWidth;
      const targetH = preset.h || image.naturalHeight;
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      // cover crop
      const scale = Math.max(targetW / image.naturalWidth, targetH / image.naturalHeight);
      const sw = targetW / scale;
      const sh = targetH / scale;
      const sx = (image.naturalWidth - sw) / 2;
      const sy = (image.naturalHeight - sh) / 2;
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, targetW, targetH);

      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${img.name}_${preset.name}_${targetW}x${targetH}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/jpeg', 0.92);
    };
  };

  /* ── 일괄 다운로드 ── */
  const downloadSelected = async () => {
    if (selected.size === 0) return;
    setDownloading(true);
    const items = PRODUCT_IMAGES.filter(i => selected.has(i.id));
    for (const img of items) {
      await downloadSingle(img);
      await new Promise(r => setTimeout(r, 300));
    }
    setDownloading(false);
  };

  const currentPlatform = PLATFORMS.find(p => p.id === platform);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-4 sm:px-8 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Truck className="w-5 h-5 text-violet-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">배달앱 이미지</h1>
          </div>
          <p className="text-slate-400 text-sm ml-[52px]">배달 플랫폼별 규격에 맞게 상품 이미지를 관리하세요</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-5">

        {/* ── 플랫폼 선택 ── */}
        <div className="flex gap-2 flex-wrap">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                platform === p.id
                  ? 'shadow-lg scale-[1.02]'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
              style={platform === p.id ? { background: p.bg, color: p.color, border: `2px solid ${p.color}` } : {}}
            >
              <span>{p.name}</span>
              <span className="text-xs opacity-70">({p.size})</span>
            </button>
          ))}
        </div>

        {/* ── 검색/필터 바 ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="상품명 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>

          <div className="flex gap-1.5">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  category === c
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── 일괄 작업 바 ── */}
        {selected.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-blue-800">{selected.size}개 선택됨</span>
            <button
              onClick={downloadSelected}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {downloading ? '다운로드 중...' : `${currentPlatform.name} 규격 다운로드`}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-2 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
            >
              선택 해제
            </button>
          </div>
        )}

        {/* ── 이미지 그리드 ── */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* 전체 선택 카드 */}
            <button
              onClick={selectAll}
              className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/50 transition-all"
            >
              <Check className={`w-6 h-6 ${selected.size === filtered.length && filtered.length > 0 ? 'text-blue-500' : 'text-slate-400'}`} />
              <span className="text-xs font-bold text-slate-500">
                {selected.size === filtered.length && filtered.length > 0 ? '전체 해제' : '전체 선택'}
              </span>
            </button>

            {filtered.map(img => {
              const isSelected = selected.has(img.id);
              return (
                <div
                  key={img.id}
                  className={`group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 shadow-lg shadow-blue-500/15 scale-[1.02]'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                  onClick={() => toggleSelect(img.id)}
                >
                  <img
                    src={IMG_BASE + img.file}
                    alt={img.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* 오버레이 */}
                  <div className={`absolute inset-0 transition-all ${
                    isSelected ? 'bg-blue-500/15' : 'bg-black/0 group-hover:bg-black/10'
                  }`} />

                  {/* 체크마크 */}
                  <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-blue-500 text-white scale-100'
                      : 'bg-white/80 text-transparent scale-90 group-hover:scale-100'
                  }`}>
                    <Check className="w-3.5 h-3.5" />
                  </div>

                  {/* 이름 라벨 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-6">
                    <p className="text-white text-xs font-bold truncate">{img.name}</p>
                  </div>

                  {/* 확대 버튼 */}
                  <button
                    onClick={e => { e.stopPropagation(); setPreviewImg(img); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── 리스트 뷰 ── */
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {filtered.map(img => {
              const isSelected = selected.has(img.id);
              return (
                <div
                  key={img.id}
                  onClick={() => toggleSelect(img.id)}
                  className={`flex items-center gap-4 p-3 cursor-pointer transition-all ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <img
                    src={IMG_BASE + img.file}
                    alt={img.name}
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{img.name}</p>
                    <p className="text-xs text-slate-500">{img.category}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); downloadSingle(img); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {currentPlatform.size}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-bold">검색 결과가 없습니다</p>
          </div>
        )}

        {/* AI 도우미 (Phase 2 placeholder) */}
        <div className="bg-gradient-to-br from-slate-50 to-violet-50 rounded-2xl border border-slate-200 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
            <ImageIcon className="w-6 h-6 text-violet-500" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">AI 상품 사진 편집</h3>
          <p className="text-sm text-slate-500 mb-3">배경 제거, 보정, 워터마크 추가 등 AI 기반 이미지 편집</p>
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 text-slate-500 text-sm font-bold">
            준비 중
          </span>
        </div>
      </div>

      {/* ── 이미지 미리보기 모달 ── */}
      {previewImg && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={IMG_BASE + previewImg.file}
              alt={previewImg.name}
              className="w-full max-h-[70vh] object-contain bg-slate-100"
            />
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-slate-800">{previewImg.name}</p>
                <p className="text-xs text-slate-500">{previewImg.category}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadSingle(previewImg)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 transition-all"
                >
                  <Download className="w-4 h-4" />
                  {currentPlatform.name} 다운로드
                </button>
                <button
                  onClick={() => setPreviewImg(null)}
                  className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
