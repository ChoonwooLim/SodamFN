import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Sparkles, Loader2, Upload, Download, ZoomIn, ZoomOut,
  RotateCw, Sun, Contrast, Save, Wand2, ArrowUpCircle,
  Pencil, Image as ImageIcon, ChevronRight, RefreshCw,
  Trash2, Copy, Check, Sliders, Maximize2, Undo2
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const CATEGORIES = ['김밥류', '분식류', '주먹밥류', '음료류'];

const STYLE_OPTIONS = [
  { id: 'natural', label: '자연광', desc: '밝고 따뜻한 자연광 촬영', icon: '☀️' },
  { id: 'studio', label: '스튜디오', desc: '다크 배경 + 드라마틱 조명', icon: '📸' },
  { id: 'minimal', label: '미니멀', desc: '깔끔한 플랫레이 스타일', icon: '✨' },
];

const FOOD_PRESETS = [
  { label: '김밥 단면', prompt: '김밥, 깔끔하게 잘린 단면이 보이도록' },
  { label: '떡볶이', prompt: '떡볶이, 매콤한 소스에 쫄깃한 떡' },
  { label: '라면', prompt: '라면, 양은냄비에 꼬불꼬불한 인스턴트 라면' },
  { label: '치즈라면', prompt: '치즈라면, 양은냄비 인스턴트 라면 위에 노란 슬라이스 치즈' },
  { label: '순대', prompt: '순대, 잘린 단면에 당면이 보이도록' },
  { label: '주먹밥', prompt: '주먹밥, 삼각형 모양 김으로 감싸진' },
  { label: '어묵', prompt: '어묵 꼬치, 따뜻한 국물에 담긴' },
  { label: '유부초밥', prompt: '유부초밥, 밥이 들어간 유부 주머니' },
];

const UPSCALE_OPTIONS = [
  { value: 1, label: '원본', desc: '512×512' },
  { value: 2, label: '2배', desc: '1024×1024' },
  { value: 4, label: '4배', desc: '2048×2048' },
];

/* ══════════════════════════════════════════
   AI Image Studio - 전문 이미지 생성/편집 도구
   ══════════════════════════════════════════ */
export default function AIImageStudio({ onClose, onSave, aiProvider }) {
  const [activeTab, setActiveTab] = useState('generate'); // generate | upscale | edit

  // ── 생성 탭 상태 ──
  const [prompt, setPrompt] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('김밥류');
  const [style, setStyle] = useState('natural');
  const [upscale, setUpscale] = useState(4);
  const [seed, setSeed] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [referenceImg, setReferenceImg] = useState(null);
  const [referencePreview, setReferencePreview] = useState(null);
  const [referenceDesc, setReferenceDesc] = useState('');
  const refInputRef = useRef(null);

  // ── 생성 결과 ──
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generationHistory, setGenerationHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── 업스케일 탭 상태 ──
  const [upscaleFile, setUpscaleFile] = useState(null);
  const [upscalePreview, setUpscalePreview] = useState(null);
  const [upscaleScale, setUpscaleScale] = useState(4);
  const [upscaling, setUpscaling] = useState(false);
  const [upscaleResult, setUpscaleResult] = useState(null);
  const [upscaleInfo, setUpscaleInfo] = useState(null);
  const upscaleInputRef = useRef(null);

  // ── 편집 탭 상태 ──
  const [editImage, setEditImage] = useState(null);
  const [editPreview, setEditPreview] = useState(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [editOriginal, setEditOriginal] = useState(null);
  const editInputRef = useRef(null);
  const canvasRef = useRef(null);

  // ══════════════════════════════
  // 생성 탭 핸들러
  // ══════════════════════════════

  const handleReferenceUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReferenceImg(file);
    const reader = new FileReader();
    reader.onload = (ev) => setReferencePreview(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setGeneratedImage(null);
    setSaved(false);

    try {
      const payload = {
        prompt: prompt,
        name: name || prompt.slice(0, 20),
        category,
        style,
        upscale,
        width: 512,
        height: 512,
        steps: 4,
      };
      if (seed) payload.seed = parseInt(seed, 10);
      if (negativePrompt.trim()) payload.negative_prompt = negativePrompt;
      if (referenceDesc.trim()) payload.reference_description = referenceDesc;

      // 미리보기 모드: 이미지만 생성 (DB 저장 안함)
      const res = await axios.post(`${API_URL}/api/delivery-images/ai-preview`, payload, {
        headers: getAuthHeaders(),
        responseType: 'blob',
        timeout: 200000,
      });

      let imageUrl;
      if (res.data instanceof Blob && res.data.type.startsWith('image/')) {
        imageUrl = URL.createObjectURL(res.data);
      } else {
        // JSON response with URL (cloud providers)
        const text = await res.data.text();
        const json = JSON.parse(text);
        imageUrl = json.image_url;
      }

      setGeneratedImage(imageUrl);
      setGenerationHistory(prev => [{
        url: imageUrl,
        prompt: prompt,
        style,
        time: new Date().toLocaleTimeString('ko-KR'),
      }, ...prev].slice(0, 10));
    } catch (err) {
      const msg = err.response?.data instanceof Blob
        ? await err.response.data.text()
        : err.response?.data?.detail;
      alert(msg || 'AI 이미지 생성 실패');
    }
    setGenerating(false);
  };

  const handleSaveGenerated = async () => {
    if (!generatedImage || saved) return;
    setSaving(true);
    try {
      // 생성된 이미지를 DB에 저장
      const payload = {
        prompt,
        name: name || prompt.slice(0, 20),
        category,
        style,
        upscale,
        width: 512,
        height: 512,
        steps: 4,
      };
      if (seed) payload.seed = parseInt(seed, 10);
      if (negativePrompt.trim()) payload.negative_prompt = negativePrompt;
      if (referenceDesc.trim()) payload.reference_description = referenceDesc;

      await axios.post(`${API_URL}/api/delivery-images/ai-generate`, payload, {
        headers: getAuthHeaders(),
        timeout: 200000,
      });

      setSaved(true);
      onSave?.();
    } catch (err) {
      alert(err.response?.data?.detail || '저장 실패');
    }
    setSaving(false);
  };

  const handleDownloadGenerated = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `${name || 'ai-image'}.png`;
    a.click();
  };

  // ══════════════════════════════
  // 업스케일 탭 핸들러
  // ══════════════════════════════

  const handleUpscaleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpscaleFile(file);
    setUpscaleResult(null);
    setUpscaleInfo(null);
    const reader = new FileReader();
    reader.onload = (ev) => setUpscalePreview(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUpscale = async () => {
    if (!upscaleFile) return;
    setUpscaling(true);
    setUpscaleResult(null);
    try {
      const formData = new FormData();
      formData.append('file', upscaleFile);
      formData.append('scale', upscaleScale);

      const res = await axios.post(`${API_URL}/api/delivery-images/upscale`, formData, {
        headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
        timeout: 120000,
      });

      const url = URL.createObjectURL(res.data);
      setUpscaleResult(url);
      setUpscaleInfo({
        originalSize: res.headers['x-original-size'] || '?',
        outputSize: res.headers['x-output-size'] || '?',
        scale: res.headers['x-scale'] || upscaleScale,
        time: res.headers['x-upscale-time'] || '?',
      });
    } catch (err) {
      alert('업스케일 실패. GPU 서버를 확인해주세요.');
    }
    setUpscaling(false);
  };

  const handleDownloadUpscaled = () => {
    if (!upscaleResult) return;
    const a = document.createElement('a');
    a.href = upscaleResult;
    a.download = `upscaled_${upscaleScale}x.png`;
    a.click();
  };

  // ══════════════════════════════
  // 편집 탭 핸들러
  // ══════════════════════════════

  const handleEditFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEditImage(ev.target.result);
      setEditOriginal(ev.target.result);
      setEditPreview(ev.target.result);
      resetEditControls();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const resetEditControls = () => {
    setBrightness(100);
    setContrast(100);
    setSaturate(100);
    setRotation(0);
  };

  const handleResetEdit = () => {
    resetEditControls();
    if (editOriginal) setEditPreview(editOriginal);
  };

  const editFilterStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`,
    transform: `rotate(${rotation}deg)`,
  };

  const handleExportEdit = useCallback(() => {
    if (!editImage) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const isRotated = rotation % 180 !== 0;
      canvas.width = isRotated ? img.height : img.width;
      canvas.height = isRotated ? img.width : img.height;
      const ctx = canvas.getContext('2d');

      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited_image.png';
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.src = editImage;
  }, [editImage, brightness, contrast, saturate, rotation]);

  // 생성된 이미지를 편집탭으로 보내기
  const sendToEdit = (imageUrl) => {
    setEditImage(imageUrl);
    setEditOriginal(imageUrl);
    setEditPreview(imageUrl);
    resetEditControls();
    setActiveTab('edit');
  };

  // 생성된 이미지를 업스케일탭으로 보내기
  const sendToUpscale = async (imageUrl) => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], 'generated.png', { type: 'image/png' });
      setUpscaleFile(file);
      setUpscalePreview(imageUrl);
      setUpscaleResult(null);
      setUpscaleInfo(null);
      setActiveTab('upscale');
    } catch {
      alert('이미지 전송 실패');
    }
  };

  // ══════════════════════════════
  // 탭 컨텐츠
  // ══════════════════════════════

  const tabs = [
    { id: 'generate', label: 'AI 생성', icon: Wand2 },
    { id: 'upscale', label: '업스케일', icon: ArrowUpCircle },
    { id: 'edit', label: '편집', icon: Pencil },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="bg-white w-full h-full sm:w-[95vw] sm:h-[92vh] sm:max-w-[1400px] sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl">

        {/* ── 헤더 ── */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-300" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">AI 이미지 스튜디오</h2>
              <p className="text-[11px] text-slate-400">{aiProvider || 'Flux.1-schnell'} 기반</p>
            </div>
          </div>

          {/* 탭 */}
          <div className="flex bg-slate-700/50 rounded-xl p-1 gap-0.5">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === t.id
                    ? 'bg-white text-slate-900 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-600/50'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── 메인 컨텐츠 ── */}
        <div className="flex-1 overflow-hidden flex">

          {/* ═══════════════════════════════
              생성 탭
              ═══════════════════════════════ */}
          {activeTab === 'generate' && (
            <>
              {/* 왼쪽: 컨트롤 */}
              <div className="w-[380px] shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50">
                <div className="p-5 space-y-4">

                  {/* 빠른 프롬프트 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">빠른 선택</label>
                    <div className="flex flex-wrap gap-1.5">
                      {FOOD_PRESETS.map(p => (
                        <button
                          key={p.label}
                          onClick={() => { setPrompt(p.prompt); if (!name) setName(p.label); }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            prompt === p.prompt
                              ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-300'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 프롬프트 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">이미지 설명</label>
                    <textarea
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder="예: 치즈가 녹아내리는 치즈라면, 김이 모락모락"
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 resize-none bg-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">한국어 음식명을 자동으로 영어 번역하여 정확도를 높입니다</p>
                  </div>

                  {/* 저장 정보 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">상품명</label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="불고기김밥 (AI)"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">카테고리</label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* 스타일 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">촬영 스타일</label>
                    <div className="grid grid-cols-3 gap-2">
                      {STYLE_OPTIONS.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setStyle(s.id)}
                          className={`p-2.5 rounded-xl text-center transition-all ${
                            style === s.id
                              ? 'bg-violet-100 ring-2 ring-violet-400 text-violet-700'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-200'
                          }`}
                        >
                          <div className="text-lg mb-0.5">{s.icon}</div>
                          <div className="text-xs font-bold">{s.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 업스케일 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">출력 해상도</label>
                    <div className="flex gap-2">
                      {UPSCALE_OPTIONS.map(o => (
                        <button
                          key={o.value}
                          onClick={() => setUpscale(o.value)}
                          className={`flex-1 py-2.5 rounded-xl text-center transition-all ${
                            upscale === o.value
                              ? 'bg-violet-100 ring-2 ring-violet-400 text-violet-700'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-200'
                          }`}
                        >
                          <div className="text-xs font-bold">{o.label}</div>
                          <div className="text-[10px] text-slate-400">{o.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 참조 이미지 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">참조 이미지 (선택)</label>
                    <input ref={refInputRef} type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
                    {referencePreview ? (
                      <div className="relative">
                        <img src={referencePreview} alt="참조" className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                        <button
                          onClick={() => { setReferenceImg(null); setReferencePreview(null); setReferenceDesc(''); }}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <input
                          type="text"
                          value={referenceDesc}
                          onChange={e => setReferenceDesc(e.target.value)}
                          placeholder="참조 이미지 설명 (예: 이 구도와 비슷하게)"
                          className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => refInputRef.current?.click()}
                        className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50/30 transition-all flex flex-col items-center gap-1"
                      >
                        <Upload className="w-5 h-5" />
                        <span className="text-xs font-medium">비슷한 느낌의 이미지 업로드</span>
                      </button>
                    )}
                  </div>

                  {/* 고급 설정 */}
                  <div>
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      고급 설정
                      <ChevronRight className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                    </button>
                    {showAdvanced && (
                      <div className="mt-2 space-y-3 bg-white rounded-xl p-3 border border-slate-200">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">시드 (재현성)</label>
                          <input
                            type="number"
                            value={seed}
                            onChange={e => setSeed(e.target.value)}
                            placeholder="랜덤 (비워두기)"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">네거티브 프롬프트</label>
                          <textarea
                            value={negativePrompt}
                            onChange={e => setNegativePrompt(e.target.value)}
                            placeholder="제외할 요소 (예: 사람, 텍스트, 워터마크)"
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs resize-none bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 생성 버튼 */}
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !prompt.trim()}
                    className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        생성 중... (약 60~75초)
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        이미지 생성
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 오른쪽: 결과 미리보기 */}
              <div className="flex-1 overflow-y-auto bg-slate-100 p-5">
                {generating ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <div className="relative w-24 h-24 mb-4">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
                      <div className="absolute inset-0 rounded-full border-4 border-t-violet-500 animate-spin" />
                      <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-violet-400 animate-pulse" />
                    </div>
                    <p className="text-sm font-bold text-slate-600">AI가 이미지를 생성하고 있습니다</p>
                    <p className="text-xs text-slate-400 mt-1">Flux.1-schnell + Real-ESRGAN 업스케일</p>
                  </div>
                ) : generatedImage ? (
                  <div className="space-y-4">
                    {/* 메인 결과 */}
                    <div className="bg-white rounded-2xl overflow-hidden shadow-lg">
                      <img
                        src={generatedImage}
                        alt="생성된 이미지"
                        className="w-full max-h-[60vh] object-contain bg-slate-50"
                      />
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{name || prompt.slice(0, 30)}</p>
                          <p className="text-xs text-slate-400">{STYLE_OPTIONS.find(s => s.id === style)?.label} · {UPSCALE_OPTIONS.find(o => o.value === upscale)?.desc}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => sendToEdit(generatedImage)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                            title="편집으로 보내기"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            편집
                          </button>
                          <button
                            onClick={() => sendToUpscale(generatedImage)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                            title="업스케일로 보내기"
                          >
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            업스케일
                          </button>
                          <button
                            onClick={handleDownloadGenerated}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            다운로드
                          </button>
                          <button
                            onClick={handleSaveGenerated}
                            disabled={saving || saved}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                              saved
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-violet-500 text-white hover:bg-violet-600 shadow-lg shadow-violet-500/20'
                            }`}
                          >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                            {saving ? '저장 중...' : saved ? '저장 완료' : '라이브러리 저장'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 다시 생성 */}
                    <button
                      onClick={handleGenerate}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 transition-all mx-auto"
                    >
                      <RefreshCw className="w-4 h-4" />
                      다시 생성
                    </button>

                    {/* 생성 히스토리 */}
                    {generationHistory.length > 1 && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">생성 기록</p>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {generationHistory.map((h, i) => (
                            <button
                              key={i}
                              onClick={() => setGeneratedImage(h.url)}
                              className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                                generatedImage === h.url ? 'border-violet-500' : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <img src={h.url} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon className="w-16 h-16 mb-3 opacity-30" />
                    <p className="text-sm font-bold text-slate-500">이미지가 여기에 표시됩니다</p>
                    <p className="text-xs text-slate-400 mt-1">왼쪽에서 설명을 입력하고 생성하세요</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══════════════════════════════
              업스케일 탭
              ═══════════════════════════════ */}
          {activeTab === 'upscale' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-6">

                {/* 업로드 영역 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <ArrowUpCircle className="w-4 h-4 text-blue-500" />
                    AI 업스케일러 (Real-ESRGAN)
                  </h3>

                  <input ref={upscaleInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpscaleFileSelect} />

                  {!upscalePreview ? (
                    <button
                      onClick={() => upscaleInputRef.current?.click()}
                      className="w-full py-12 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex flex-col items-center gap-2 text-slate-400"
                    >
                      <Upload className="w-8 h-8" />
                      <span className="text-sm font-bold">이미지를 업로드하세요</span>
                      <span className="text-xs">JPG, PNG, WEBP</span>
                    </button>
                  ) : (
                    <div className="space-y-4">
                      {/* 스케일 선택 */}
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-slate-500">배율:</span>
                        <div className="flex gap-2">
                          {[2, 4].map(s => (
                            <button
                              key={s}
                              onClick={() => setUpscaleScale(s)}
                              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                upscaleScale === s
                                  ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {s}x 업스케일
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={handleUpscale}
                          disabled={upscaling}
                          className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                        >
                          {upscaling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
                          {upscaling ? '처리 중...' : '업스케일 실행'}
                        </button>
                      </div>

                      {/* Before/After */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-2">원본</p>
                          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                            <img src={upscalePreview} alt="원본" className="w-full max-h-[45vh] object-contain" />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-2">
                            업스케일 결과 {upscaleInfo && `(${upscaleInfo.outputSize}, ${upscaleInfo.time}s)`}
                          </p>
                          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                            {upscaleResult ? (
                              <img src={upscaleResult} alt="업스케일" className="w-full max-h-[45vh] object-contain" />
                            ) : upscaling ? (
                              <div className="h-64 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                              </div>
                            ) : (
                              <div className="h-64 flex items-center justify-center text-slate-300">
                                <Maximize2 className="w-8 h-8" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 다운로드 */}
                      {upscaleResult && (
                        <div className="flex justify-center gap-3">
                          <button
                            onClick={handleDownloadUpscaled}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all"
                          >
                            <Download className="w-4 h-4" />
                            업스케일 이미지 다운로드
                          </button>
                          <button
                            onClick={() => sendToEdit(upscaleResult)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                          >
                            <Pencil className="w-4 h-4" />
                            편집으로 보내기
                          </button>
                          <button
                            onClick={() => { setUpscaleFile(null); setUpscalePreview(null); setUpscaleResult(null); setUpscaleInfo(null); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all"
                          >
                            <RefreshCw className="w-4 h-4" />
                            새 이미지
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════
              편집 탭
              ═══════════════════════════════ */}
          {activeTab === 'edit' && (
            <div className="flex-1 overflow-hidden flex">
              {/* 왼쪽: 편집 도구 */}
              <div className="w-[300px] shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
                <div className="p-5 space-y-5">

                  <input ref={editInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditFileSelect} />
                  <button
                    onClick={() => editInputRef.current?.click()}
                    className="w-full py-3 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    이미지 선택
                  </button>

                  {editImage && (
                    <>
                      {/* 밝기 */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                            <Sun className="w-3.5 h-3.5" />
                            밝기
                          </label>
                          <span className="text-xs text-slate-400">{brightness}%</span>
                        </div>
                        <input
                          type="range"
                          min="50" max="150" value={brightness}
                          onChange={e => setBrightness(Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none bg-slate-200 accent-amber-500"
                        />
                      </div>

                      {/* 대비 */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                            <Contrast className="w-3.5 h-3.5" />
                            대비
                          </label>
                          <span className="text-xs text-slate-400">{contrast}%</span>
                        </div>
                        <input
                          type="range"
                          min="50" max="150" value={contrast}
                          onChange={e => setContrast(Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none bg-slate-200 accent-blue-500"
                        />
                      </div>

                      {/* 채도 */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            채도
                          </label>
                          <span className="text-xs text-slate-400">{saturate}%</span>
                        </div>
                        <input
                          type="range"
                          min="0" max="200" value={saturate}
                          onChange={e => setSaturate(Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none bg-slate-200 accent-emerald-500"
                        />
                      </div>

                      {/* 회전 */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                          <RotateCw className="w-3.5 h-3.5" />
                          회전
                        </label>
                        <div className="flex gap-2">
                          {[0, 90, 180, 270].map(deg => (
                            <button
                              key={deg}
                              onClick={() => setRotation(deg)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                rotation === deg
                                  ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {deg}°
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="space-y-2 pt-2">
                        <button
                          onClick={handleResetEdit}
                          className="w-full py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          초기화
                        </button>
                        <button
                          onClick={handleExportEdit}
                          className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <Download className="w-3.5 h-3.5" />
                          편집 이미지 다운로드
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 오른쪽: 이미지 미리보기 */}
              <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-6">
                {editImage ? (
                  <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-full max-h-full">
                    <img
                      src={editImage}
                      alt="편집 중"
                      className="max-w-full max-h-[70vh] object-contain transition-all duration-200"
                      style={editFilterStyle}
                    />
                  </div>
                ) : (
                  <div className="text-center text-slate-400">
                    <Pencil className="w-16 h-16 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-bold text-slate-500">편집할 이미지를 선택하세요</p>
                    <p className="text-xs text-slate-400 mt-1">왼쪽에서 이미지를 업로드하거나, 생성 탭에서 보내기</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
