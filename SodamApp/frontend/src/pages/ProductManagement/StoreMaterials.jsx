import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Store, Sparkles, Image as ImageIcon, Megaphone, Music, Mic,
  Download, Play, Pause, Square, Loader2, ChevronRight,
  X, Check, RefreshCw, Volume2, Wand2, AlertCircle,
  Truck, Clock, Gift, Star, Heart, Users, Percent,
  Camera, MessageCircle, Award, Zap, Package, Edit3,
  Sun, Moon, Coffee, Headphones, Guitar,
} from 'lucide-react';
import api from '../../api';

/* ───────────────────────────────────
   아이콘 매핑
─────────────────────────────────── */
const ICON_MAP = {
  sparkles: Sparkles, percent: Percent, leaf: Sparkles, party: Gift, package: Package,
  'shopping-bag': Store, users: Users, gift: Gift, clock: Clock, truck: Truck,
  'plus-circle': Zap, star: Star, instagram: Camera, smartphone: Camera,
  'play-circle': Play, 'message-circle': MessageCircle, 'edit-3': Edit3,
  youtube: Play, calendar: Clock, heart: Heart, camera: Camera, smile: Users,
  award: Award, 'shopping-cart': Store, bike: Truck, utensils: Store,
  bell: Megaphone, ticket: Percent, zap: Zap, repeat: RefreshCw,
  'message-square': MessageCircle, layers: Package, sun: Sun,
  home: Store, 'book-open': Edit3, megaphone: Megaphone, hand: Users,
  snowflake: Sparkles, book: Edit3, shield: Check, list: Edit3,
  coffee: Coffee, 'battery-charging': Zap, moon: Moon, 'party-popper': Gift,
  music: Music, 'music-2': Music, headphones: Headphones, guitar: Guitar,
  'trending-up': Zap, sunrise: Sun,
};

const getIcon = (name) => ICON_MAP[name] || Sparkles;

/* ───────────────────────────────────
   탭 정의
─────────────────────────────────── */
const TABS = [
  { id: 'poster', label: '포스터/배너', icon: ImageIcon, color: '#f59e0b', gradient: 'from-amber-500 to-orange-500', desc: 'AI가 매장 포스터와 배너를 자동 생성합니다' },
  { id: 'sns', label: 'SNS 콘텐츠', icon: Camera, gradient: 'from-pink-500 to-rose-500', color: '#ec4899', desc: '인스타그램, 유튜브, 블로그용 이미지를 만들어보세요' },
  { id: 'delivery', label: '배달앱 배너', icon: Truck, gradient: 'from-teal-500 to-cyan-500', color: '#14b8a6', desc: '쿠팡이츠, 배민, 요기요 배너를 한 번에' },
  { id: 'tts', label: '나레이션', icon: Mic, gradient: 'from-blue-500 to-indigo-500', color: '#3b82f6', desc: '자연스러운 한국어 음성으로 나레이션을 생성하세요' },
  { id: 'music', label: '배경음악', icon: Music, gradient: 'from-purple-500 to-violet-500', color: '#8b5cf6', desc: 'AI가 매장 분위기에 맞는 배경음악을 작곡합니다' },
];

/* ───────────────────────────────────
   메인 컴포넌트
─────────────────────────────────── */
export default function StoreMaterials() {
  const [activeTab, setActiveTab] = useState('poster');
  const [presets, setPresets] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // 생성 관련
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);  // { type, url, blob }
  const [customText, setCustomText] = useState('');
  const [storeName, setStoreName] = useState('소담김밥');
  const [selectedVoice, setSelectedVoice] = useState('ko-KR-SunHiNeural');
  const [ttsSpeed, setTtsSpeed] = useState('+0%');
  const [musicDuration, setMusicDuration] = useState(30);

  // 오디오 플레이어
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentTab = TABS.find(t => t.id === activeTab);

  /* ── 프리셋 + AI 상태 로드 ── */
  useEffect(() => {
    const load = async () => {
      try {
        const [presetsRes, statusRes] = await Promise.all([
          api.get('/promotions/presets'),
          api.get('/promotions/ai-status').catch(() => ({ data: null })),
        ]);
        setPresets(presetsRes.data);
        setAiStatus(statusRes.data);
      } catch (err) {
        console.error('프리셋 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ── 탭 변경 시 리셋 ── */
  useEffect(() => {
    setSelectedPreset(null);
    setResult(null);
    setCustomText('');
    setIsPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
  }, [activeTab]);

  /* ── 이미지 생성 ── */
  const generateImage = useCallback(async (preset) => {
    setGenerating(true);
    setResult(null);
    try {
      const resp = await api.post('/promotions/generate-image', {
        preset_id: preset.id,
        custom_prompt: customText || undefined,
        store_name: storeName || undefined,
      }, { responseType: 'blob', timeout: 200000 });
      const url = URL.createObjectURL(resp.data);
      setResult({ type: 'image', url, blob: resp.data });
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setResult({ type: 'error', message: msg });
    } finally {
      setGenerating(false);
    }
  }, [customText, storeName]);

  /* ── TTS 생성 ── */
  const generateTTS = useCallback(async (preset) => {
    setGenerating(true);
    setResult(null);
    try {
      const resp = await api.post('/promotions/generate-tts', {
        preset_id: preset.id,
        custom_text: customText || undefined,
        store_name: storeName,
        voice: selectedVoice,
        speed: ttsSpeed,
      }, { responseType: 'blob', timeout: 60000 });
      const url = URL.createObjectURL(resp.data);
      setResult({ type: 'audio', url, blob: resp.data, format: 'mp3' });
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setResult({ type: 'error', message: msg });
    } finally {
      setGenerating(false);
    }
  }, [customText, storeName, selectedVoice, ttsSpeed]);

  /* ── 음악 생성 ── */
  const generateMusic = useCallback(async (preset) => {
    setGenerating(true);
    setResult(null);
    try {
      const resp = await api.post('/promotions/generate-music', {
        preset_id: preset.id,
        custom_prompt: customText || undefined,
        duration: musicDuration,
      }, { responseType: 'blob', timeout: 360000 });
      const url = URL.createObjectURL(resp.data);
      setResult({ type: 'audio', url, blob: resp.data, format: 'wav' });
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      setResult({ type: 'error', message: msg });
    } finally {
      setGenerating(false);
    }
  }, [customText, musicDuration]);

  /* ── 생성 핸들러 ── */
  const handleGenerate = useCallback(() => {
    if (!selectedPreset || generating) return;
    if (['poster', 'sns', 'delivery'].includes(activeTab)) {
      generateImage(selectedPreset);
    } else if (activeTab === 'tts') {
      generateTTS(selectedPreset);
    } else if (activeTab === 'music') {
      generateMusic(selectedPreset);
    }
  }, [selectedPreset, generating, activeTab, generateImage, generateTTS, generateMusic]);

  /* ── 다운로드 ── */
  const handleDownload = useCallback(() => {
    if (!result || result.type === 'error') return;
    const a = document.createElement('a');
    a.href = result.url;
    const ext = result.type === 'image' ? 'png' : result.format || 'mp3';
    a.download = `${selectedPreset?.name || 'promo'}_${Date.now()}.${ext}`;
    a.click();
  }, [result, selectedPreset]);

  /* ── 오디오 토글 ── */
  const toggleAudio = useCallback(() => {
    if (!audioRef.current || !result?.url) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = result.url;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, result]);

  /* ── 현재 탭 프리셋 가져오기 ── */
  const currentPresets = presets?.[activeTab] || [];

  /* ── AI 서비스 상태 뱃지 ── */
  const getServiceStatus = () => {
    if (!aiStatus) return null;
    if (['poster', 'sns', 'delivery'].includes(activeTab)) return aiStatus.gpu;
    if (activeTab === 'tts') return aiStatus.tts;
    if (activeTab === 'music') return aiStatus.music;
    return null;
  };
  const serviceStatus = getServiceStatus();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 font-medium">AI 스튜디오 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 숨겨진 오디오 요소 */}
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />

      {/* ── 히어로 헤더 ── */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 text-white px-4 sm:px-8 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">AI 홍보물 제작 스튜디오</h1>
              <p className="text-slate-400 text-sm">포스터, SNS, 나레이션, 배경음악을 AI가 자동 생성합니다</p>
            </div>
          </div>
          {/* AI 상태 표시 */}
          {aiStatus && (
            <div className="flex gap-3 mt-4 ml-14 flex-wrap">
              {[
                { label: '이미지', status: aiStatus.gpu?.online },
                { label: 'TTS', status: aiStatus.tts?.online },
                { label: '음악', status: aiStatus.music?.online },
              ].map(s => (
                <span key={s.label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  s.status ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.status ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {s.label} {s.status ? 'ON' : 'OFF'}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">

        {/* ── 탭 네비게이션 ── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {TABS.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white shadow-lg border border-slate-200 scale-[1.02]'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                }`}
              >
                <TabIcon className="w-4 h-4" style={isActive ? { color: tab.color } : {}} />
                <span style={isActive ? { color: tab.color } : {}}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── 탭 설명 + 서비스 상태 ── */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-slate-500 text-sm">{currentTab.desc}</p>
          {serviceStatus && !serviceStatus.online && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5" />
              AI 서비스 오프라인
            </span>
          )}
        </div>

        {/* ── 메인 레이아웃: 프리셋 그리드 + 결과 패널 ── */}
        <div className="flex gap-6 flex-col lg:flex-row">

          {/* ── 왼쪽: 프리셋 그리드 ── */}
          <div className={`${selectedPreset ? 'lg:w-[55%]' : 'w-full'} transition-all`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {currentPresets.map((preset, idx) => {
                const Icon = getIcon(preset.icon);
                const isSelected = selectedPreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedPreset(preset);
                      setResult(null);
                      setCustomText('');
                      setIsPlaying(false);
                    }}
                    className={`group relative text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10 scale-[1.02]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                    }`}
                    style={{ animationDelay: `${idx * 0.03}s` }}
                  >
                    {/* 아이콘 */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${preset.color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: preset.color }} />
                    </div>
                    {/* 텍스트 */}
                    <h3 className="text-sm font-bold text-slate-800 mb-1">{preset.name}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{preset.desc}</p>
                    {/* 선택 체크 */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 오른쪽: 생성 패널 ── */}
          {selectedPreset && (
            <div className="lg:w-[45%] space-y-4">
              {/* 패널 헤더 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className={`bg-gradient-to-r ${currentTab.gradient} p-4 text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {(() => { const I = getIcon(selectedPreset.icon); return <I className="w-5 h-5" />; })()}
                      <div>
                        <h3 className="font-bold">{selectedPreset.name}</h3>
                        <p className="text-white/80 text-xs">{selectedPreset.desc}</p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedPreset(null); setResult(null); }}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-4">

                  {/* ── 공통: 매장명 ── */}
                  {['poster', 'sns', 'delivery', 'tts'].includes(activeTab) && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">매장명</label>
                      <input
                        type="text"
                        value={storeName}
                        onChange={e => setStoreName(e.target.value)}
                        placeholder="소담김밥"
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      />
                    </div>
                  )}

                  {/* ── 이미지: 커스텀 프롬프트 ── */}
                  {['poster', 'sns', 'delivery'].includes(activeTab) && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">
                        추가 설명 <span className="text-slate-400 font-normal">(선택)</span>
                      </label>
                      <textarea
                        value={customText}
                        onChange={e => setCustomText(e.target.value)}
                        placeholder="예: 참치김밥 신메뉴, 가을 분위기, 할인율 30%..."
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      />
                    </div>
                  )}

                  {/* ── TTS: 나레이션 텍스트 ── */}
                  {activeTab === 'tts' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          나레이션 텍스트
                        </label>
                        <textarea
                          value={customText || selectedPreset.script?.replace(/\{store_name\}/g, storeName) || ''}
                          onChange={e => setCustomText(e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5">음성</label>
                          <select
                            value={selectedVoice}
                            onChange={e => setSelectedVoice(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          >
                            <option value="ko-KR-SunHiNeural">선희 (여성)</option>
                            <option value="ko-KR-HyunsuMultilingualNeural">현수 (남성)</option>
                            <option value="ko-KR-InJoonNeural">인준 (남성)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5">속도</label>
                          <select
                            value={ttsSpeed}
                            onChange={e => setTtsSpeed(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          >
                            <option value="-20%">느리게</option>
                            <option value="-10%">약간 느리게</option>
                            <option value="+0%">보통</option>
                            <option value="+10%">약간 빠르게</option>
                            <option value="+20%">빠르게</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── 음악: 옵션 ── */}
                  {activeTab === 'music' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          추가 설명 <span className="text-slate-400 font-normal">(선택)</span>
                        </label>
                        <textarea
                          value={customText}
                          onChange={e => setCustomText(e.target.value)}
                          placeholder="예: 좀 더 빠른 템포, 피아노 위주..."
                          rows={2}
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          길이: {musicDuration}초
                        </label>
                        <input
                          type="range"
                          min={10}
                          max={60}
                          step={5}
                          value={musicDuration}
                          onChange={e => setMusicDuration(Number(e.target.value))}
                          className="w-full h-2 rounded-full bg-slate-200 accent-purple-500"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                          <span>10초</span>
                          <span>30초</span>
                          <span>60초</span>
                        </div>
                      </div>
                      {selectedPreset.tags && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPreset.tags.split(', ').map(tag => (
                            <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-500 font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* ── 생성 버튼 ── */}
                  <button
                    onClick={handleGenerate}
                    disabled={generating || (serviceStatus && !serviceStatus.online)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all ${
                      generating
                        ? 'bg-slate-400 cursor-wait'
                        : `bg-gradient-to-r ${currentTab.gradient} hover:opacity-90 shadow-lg active:scale-[0.98]`
                    }`}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {activeTab === 'music' ? '음악 작곡 중... (최대 5분)' :
                         activeTab === 'tts' ? '나레이션 생성 중...' :
                         '이미지 생성 중... (30~60초)'}
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        AI 생성하기
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* ── 결과 표시 ── */}
              {result && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* 에러 */}
                  {result.type === 'error' && (
                    <div className="p-6 text-center">
                      <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                      <p className="text-sm font-bold text-red-600 mb-1">생성 실패</p>
                      <p className="text-xs text-slate-500">{result.message}</p>
                    </div>
                  )}

                  {/* 이미지 결과 */}
                  {result.type === 'image' && (
                    <div>
                      <div className="bg-slate-100 p-2">
                        <img src={result.url} alt="생성된 이미지" className="w-full rounded-xl object-contain max-h-[500px]" />
                      </div>
                      <div className="p-4 flex gap-2">
                        <button onClick={handleDownload}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-all">
                          <Download className="w-4 h-4" />
                          다운로드
                        </button>
                        <button onClick={handleGenerate} disabled={generating}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-all">
                          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                          재생성
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 오디오 결과 (TTS / Music) */}
                  {result.type === 'audio' && (
                    <div className="p-5">
                      <div className={`relative rounded-2xl p-6 bg-gradient-to-br ${currentTab.gradient} text-white mb-4`}>
                        <div className="flex items-center gap-4">
                          <button onClick={toggleAudio}
                            className="w-14 h-14 rounded-full bg-white/25 backdrop-blur flex items-center justify-center hover:bg-white/35 transition-all active:scale-95">
                            {isPlaying ?
                              <Pause className="w-6 h-6 text-white" /> :
                              <Play className="w-6 h-6 text-white ml-0.5" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate">{selectedPreset.name}</p>
                            <p className="text-white/70 text-xs mt-0.5">
                              {activeTab === 'tts' ? '나레이션' : '배경음악'} · {result.format?.toUpperCase()}
                            </p>
                          </div>
                          <Volume2 className="w-5 h-5 text-white/50" />
                        </div>
                        {/* 웨이브 애니메이션 */}
                        {isPlaying && (
                          <div className="flex items-end gap-0.5 absolute bottom-3 right-4 h-5">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="w-1 bg-white/60 rounded-full animate-pulse"
                                style={{ height: `${8 + Math.random() * 12}px`, animationDelay: `${i * 0.1}s`, animationDuration: '0.6s' }} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleDownload}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-all">
                          <Download className="w-4 h-4" />
                          다운로드
                        </button>
                        <button onClick={handleGenerate} disabled={generating}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-all">
                          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                          재생성
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 선택 안내 (프리셋 미선택 시) ── */}
        {!selectedPreset && currentPresets.length > 0 && (
          <div className="mt-8 text-center py-10 bg-white rounded-2xl border border-slate-200">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${currentTab.gradient} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
              {(() => { const I = currentTab.icon; return <I className="w-7 h-7 text-white" />; })()}
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">프리셋을 선택해주세요</h3>
            <p className="text-sm text-slate-500 mb-1">위 프리셋 카드 중 하나를 클릭하면</p>
            <p className="text-sm text-slate-500">AI가 자동으로 생성을 시작합니다</p>
            <div className="flex items-center justify-center gap-1 mt-4 text-xs text-slate-400">
              <ChevronRight className="w-4 h-4" />
              <span>{currentPresets.length}개의 프리셋 사용 가능</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
