import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Truck, Download, Upload, Search, Check, Grid3x3,
  List, ZoomIn, X, Trash2, Plus, Sparkles, Loader2,
  Image as ImageIcon, ChevronDown
} from 'lucide-react';
import axios from 'axios';
import AIImageStudio from './components/AIImageStudio';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* ── 기본 상품 이미지 (static fallback) ── */
const STATIC_IMAGES = [
  { id: 's1', name: '소담김밥', file: 'sodam-gimbap.jpg', category: '김밥류', source: 'static' },
  { id: 's2', name: '불고기김밥', file: 'bulgogi-gimbap.jpg', category: '김밥류', source: 'static' },
  { id: 's3', name: '참치김밥', file: 'chamchi-gimbap.jpg', category: '김밥류', source: 'static' },
  { id: 's4', name: '치즈김밥', file: 'cheese-gimbap.jpg', category: '김밥류', source: 'static' },
  { id: 's5', name: '당근라페김밥', file: 'danggeun-gimbap.jpg', category: '김밥류', source: 'static' },
  { id: 's6', name: '땡초멸치김밥', file: 'ttaengcho-gimbap.jpg', category: '김밥류', source: 'static' },
  { id: 's7', name: '스팸에그김밥', file: 'spam-egg-gimbap.jpg', category: '김밥류', source: 'static' },
  { id: 's8', name: '꼬마김밥', file: 'kkoma-gimbap.jpg', category: '김밥류', source: 'static' },
  { id: 's9', name: '모둠김밥', file: 'modum-gimbap.jpg', category: '김밥류', source: 'static' },
  { id: 's10', name: '소담떡볶이', file: 'tteokbokki.jpg', category: '분식류', source: 'static' },
  { id: 's11', name: '미니떡볶이', file: 'mini-tteokbokki.jpg', category: '분식류', source: 'static' },
  { id: 's12', name: '소담순대', file: 'sundae.jpg', category: '분식류', source: 'static' },
  { id: 's13', name: '미니순대', file: 'mini-sundae.jpg', category: '분식류', source: 'static' },
  { id: 's14', name: '소담어묵', file: 'eomuk.jpg', category: '분식류', source: 'static' },
  { id: 's15', name: '유부초밥', file: 'yubu.jpg', category: '분식류', source: 'static' },
  { id: 's16', name: '삶은계란', file: 'egg.jpg', category: '분식류', source: 'static' },
  { id: 's17', name: '소담세트', file: 'sodam-set.jpg', category: '분식류', source: 'static' },
  { id: 's18', name: '스팸주먹밥', file: 'spam-onigiri.jpg', category: '주먹밥류', source: 'static' },
  { id: 's19', name: '순한맛주먹밥', file: 'sunhan-onigiri.jpg', category: '주먹밥류', source: 'static' },
  { id: 's20', name: '매콤주먹밥', file: 'maekom-onigiri.jpg', category: '주먹밥류', source: 'static' },
  { id: 's21', name: '불고기주먹밥', file: 'bulgogi-onigiri.jpg', category: '주먹밥류', source: 'static' },
  { id: 's22', name: '멸치주먹밥', file: 'myeolchi-onigiri.jpg', category: '주먹밥류', source: 'static' },
  { id: 's23', name: '햄치즈주먹밥', file: 'hamcheese-onigiri.jpg', category: '주먹밥류', source: 'static' },
  { id: 's24', name: '생수', file: 'water.jpg', category: '음료류', source: 'static' },
  { id: 's25', name: '코카콜라', file: 'coca-cola.jpg', category: '음료류', source: 'static' },
  { id: 's26', name: '칠성사이다', file: 'chilsung-cider.jpg', category: '음료류', source: 'static' },
  { id: 's27', name: '칠성사이다(제로)', file: 'chilsung-cider-zero.jpg', category: '음료류', source: 'static' },
  { id: 's28', name: '펩시콜라(제로)', file: 'pepsi-zero.jpg', category: '음료류', source: 'static' },
  { id: 's29', name: '데미소다', file: 'demi-soda.jpg', category: '음료류', source: 'static' },
  { id: 's30', name: '애사비', file: 'apple-vinegar.jpg', category: '음료류', source: 'static' },
  { id: 's31', name: '환타', file: 'fanta.jpg', category: '음료류', source: 'static' },
];

/* ── 배달 플랫폼 프리셋 ── */
const PLATFORMS = [
  { id: 'coupang', name: '쿠팡이츠', size: '800×800', w: 800, h: 800, color: '#E31837', bg: '#FEF2F2' },
  { id: 'baemin', name: '배달의민족', size: '1000×1000', w: 1000, h: 1000, color: '#2AC1BC', bg: '#F0FDFA' },
  { id: 'yogiyo', name: '요기요', size: '600×600', w: 600, h: 600, color: '#FA0050', bg: '#FFF1F2' },
  { id: 'original', name: '원본', size: '원본 크기', w: null, h: null, color: '#64748B', bg: '#F8FAFC' },
];

const CATEGORIES = ['전체', '김밥류', '분식류', '주먹밥류', '음료류'];
const IMG_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/media/products/`;

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function DeliveryImages() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('전체');
  const [viewMode, setViewMode] = useState('grid');
  const [selected, setSelected] = useState(new Set());
  const [platform, setPlatform] = useState('coupang');
  const [previewImg, setPreviewImg] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef(null);

  // API 연동 상태
  const [dbImages, setDbImages] = useState([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAIStudio, setShowAIStudio] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 업로드 폼
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('김밥류');
  const [uploadFiles, setUploadFiles] = useState([]);

  // AI 생성 (Studio에서 처리)

  /* ── API에서 이미지 로드 ── */
  const loadImages = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/delivery-images`, {
        headers: getAuthHeaders(),
      });
      if (res.data?.data) {
        setDbImages(res.data.data.map(img => ({
          ...img,
          id: `db_${img.id}`,
          dbId: img.id,
        })));
      }
    } catch {
      // API 실패 시 static 이미지만 사용
    }
  }, []);

  const checkAIStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/delivery-images/ai-status`, {
        headers: getAuthHeaders(),
      });
      setAiEnabled(res.data?.ai_enabled || false);
      setAiProvider(res.data?.provider_name || '');
    } catch {
      setAiEnabled(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
    checkAIStatus();
  }, [loadImages, checkAIStatus]);

  /* ── 전체 이미지 (static + DB) ── */
  const allImages = [
    ...STATIC_IMAGES.map(img => ({
      ...img,
      image_url: IMG_BASE + img.file,
    })),
    ...dbImages.map(img => {
      let url = img.image_url || '';
      // 기존 미디어 서버 direct URL → 백엔드 프록시로 변환
      const mediaMatch = url.match(/^https?:\/\/[^/]+\/files\/(.+)$/);
      if (mediaMatch) {
        url = `${API_URL}/api/media/${mediaMatch[1]}`;
      } else if (!url.startsWith('http')) {
        url = `${API_URL}${url}`;
      }
      return { ...img, image_url: url };
    }),
  ];

  /* ── 필터링 ── */
  const filtered = allImages.filter(img => {
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

  /* ── 이미지 URL 가져오기 ── */
  const getImgSrc = (img) => img.image_url;

  /* ── 개별 다운로드 (리사이즈) ── */
  const downloadSingle = async (img) => {
    const preset = PLATFORMS.find(p => p.id === platform);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = getImgSrc(img);

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const targetW = preset.w || image.naturalWidth;
      const targetH = preset.h || image.naturalHeight;
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

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
    const items = allImages.filter(i => selected.has(i.id));
    for (const img of items) {
      await downloadSingle(img);
      await new Promise(r => setTimeout(r, 300));
    }
    setDownloading(false);
  };

  /* ── 이미지 업로드 ── */
  const handleUpload = async () => {
    if (!uploadFiles.length || !uploadName.trim()) return;
    setUploading(true);
    try {
      for (const file of uploadFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', uploadFiles.length === 1 ? uploadName : `${uploadName}_${file.name}`);
        formData.append('category', uploadCategory);
        await axios.post(`${API_URL}/api/delivery-images/upload`, formData, {
          headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
        });
      }
      await loadImages();
      setShowUploadModal(false);
      setUploadName('');
      setUploadFiles([]);
    } catch (err) {
      alert(err.response?.data?.detail || '업로드 실패');
    }
    setUploading(false);
  };

  /* ── 이미지 삭제 ── */
  const handleDelete = async (img) => {
    if (img.source === 'static') {
      alert('기본 제공 이미지는 삭제할 수 없습니다.');
      return;
    }
    if (!confirm(`"${img.name}" 이미지를 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/api/delivery-images/${img.dbId}`, {
        headers: getAuthHeaders(),
      });
      await loadImages();
      setPreviewImg(null);
    } catch (err) {
      alert(err.response?.data?.detail || '삭제 실패');
    }
    setDeleting(false);
  };

  /* ── 선택 삭제 ── */
  const handleBulkDelete = async () => {
    const dbSelected = allImages.filter(i => selected.has(i.id) && i.source !== 'static');
    if (dbSelected.length === 0) {
      alert('삭제 가능한 이미지가 없습니다. (기본 이미지는 삭제 불가)');
      return;
    }
    if (!confirm(`${dbSelected.length}개 이미지를 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      await axios.post(`${API_URL}/api/delivery-images/bulk-delete`, {
        ids: dbSelected.map(i => i.dbId),
      }, { headers: getAuthHeaders() });
      await loadImages();
      setSelected(new Set());
    } catch (err) {
      alert(err.response?.data?.detail || '삭제 실패');
    }
    setDeleting(false);
  };

  /* ── AI Studio에서 저장 시 새로고침 ── */
  const handleAIStudioSave = () => {
    loadImages();
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

        {/* ── 액션 바: 업로드 + AI 생성 ── */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all"
          >
            <Upload className="w-4 h-4" />
            이미지 업로드
          </button>
          <button
            onClick={() => {
              if (!aiEnabled) {
                alert('AI API 키가 설정되지 않았습니다.\n백엔드 .env 파일에 REPLICATE_API_TOKEN 또는 OPENAI_API_KEY를 추가해주세요.');
                return;
              }
              setShowAIStudio(true);
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
              aiEnabled
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-xl'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI 이미지 스튜디오
            {!aiEnabled && <span className="text-[10px] ml-1 opacity-70">(API 키 필요)</span>}
          </button>
        </div>

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
              onClick={handleBulkDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? '삭제 중...' : '선택 삭제'}
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
              const isDb = img.source !== 'static';
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
                    src={getImgSrc(img)}
                    alt={img.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

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

                  {/* AI/업로드 뱃지 */}
                  {img.source === 'ai_generated' && (
                    <div className="absolute top-2 left-10 px-1.5 py-0.5 rounded-md bg-violet-500 text-white text-[9px] font-bold flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> AI
                    </div>
                  )}
                  {img.source === 'upload' && (
                    <div className="absolute top-2 left-10 px-1.5 py-0.5 rounded-md bg-emerald-500 text-white text-[9px] font-bold">
                      업로드
                    </div>
                  )}

                  {/* 이름 라벨 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-6">
                    <p className="text-white text-xs font-bold truncate">{img.name}</p>
                  </div>

                  {/* 호버 액션 */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={e => { e.stopPropagation(); setPreviewImg(img); }}
                      className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white shadow"
                    >
                      <ZoomIn className="w-3.5 h-3.5 text-slate-700" />
                    </button>
                    {isDb && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(img); }}
                        className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-red-50 shadow"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── 리스트 뷰 ── */
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {filtered.map(img => {
              const isSelected = selected.has(img.id);
              const isDb = img.source !== 'static';
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
                    src={getImgSrc(img)}
                    alt={img.name}
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">{img.name}</p>
                      {img.source === 'ai_generated' && (
                        <span className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center gap-0.5 shrink-0">
                          <Sparkles className="w-2.5 h-2.5" /> AI
                        </span>
                      )}
                      {img.source === 'upload' && (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-600 text-[10px] font-bold shrink-0">업로드</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{img.category}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); downloadSingle(img); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {currentPlatform.size}
                    </button>
                    {isDb && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(img); }}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
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
      </div>

      {/* ══════════════════════════════════════════════
         이미지 업로드 모달
         ══════════════════════════════════════════════ */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !uploading && setShowUploadModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-500" />
                  이미지 업로드
                </h3>
                <button onClick={() => !uploading && setShowUploadModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* 상품명 */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">상품명</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  placeholder="예: 새우김밥"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">카테고리</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.filter(c => c !== '전체').map(c => (
                    <button
                      key={c}
                      onClick={() => setUploadCategory(c)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        uploadCategory === c ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* 파일 선택 */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">이미지 파일</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={e => { setUploadFiles(Array.from(e.target.files)); e.target.value = ''; }}
                  />
                  {uploadFiles.length > 0 ? (
                    <div className="space-y-1">
                      {uploadFiles.map((f, i) => (
                        <p key={i} className="text-sm text-slate-700 font-medium">{f.name}</p>
                      ))}
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">클릭하여 이미지 선택</p>
                      <p className="text-xs text-slate-400 mt-1">JPG, PNG, GIF, WEBP</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                취소
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFiles.length || !uploadName.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? '업로드 중...' : '업로드'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
         AI 이미지 스튜디오 (전문 도구)
         ══════════════════════════════════════════════ */}
      {showAIStudio && (
        <AIImageStudio
          onClose={() => setShowAIStudio(false)}
          onSave={handleAIStudioSave}
          aiProvider={aiProvider}
        />
      )}

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
              src={getImgSrc(previewImg)}
              alt={previewImg.name}
              className="w-full max-h-[70vh] object-contain bg-slate-100"
            />
            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-slate-800">{previewImg.name}</p>
                  {previewImg.source === 'ai_generated' && (
                    <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> AI 생성
                    </span>
                  )}
                </div>
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
                {previewImg.source !== 'static' && (
                  <button
                    onClick={() => handleDelete(previewImg)}
                    disabled={deleting}
                    className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
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
