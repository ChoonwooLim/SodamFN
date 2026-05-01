import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare, Send, Sparkles, Loader2, Image as ImageIcon, X,
  RotateCcw, Wand2, Eye, Camera
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * AI 와 대화하며 식품 사진 프롬프트를 함께 만드는 컴포넌트.
 * 사용자 ↔ OpenClaw GPT-5.5 멀티턴 대화 → 최종 ```prompt``` 영문 프롬프트
 *  → 사용자 확정 → 부모 콜백 onGenerate(prompt) 으로 Flux 생성 요청.
 *
 * Props:
 *  - onGenerate(prompt: string): 사용자가 [이 프롬프트로 생성] 클릭 시 호출
 *  - onClose(): 모드 종료
 *  - onSaved(): img2img+refs 경로에서 DB 저장이 완료되면 호출 (갤러리 새로고침용)
 */
export default function AIChatPromptBuilder({ onGenerate, onClose, onSaved }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        '안녕하세요! 어떤 음식 사진을 만들어볼까요?\n\n' +
        '메뉴 이름과 분위기·조명·플레이팅·카메라 스타일 등을 자유롭게 설명해주세요. ' +
        '비슷한 느낌의 참고 이미지가 있으면 위에서 업로드하시면 분석해서 같이 고려할게요.',
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [generating, setGenerating] = useState(false);  // img2img+refs 경로 생성 중

  // 참고 이미지 N장: 각 항목 = { id, file, preview, description, analyzing, error }
  const [refImages, setRefImages] = useState([]);
  const MAX_REF_IMAGES = 6;

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  // unmount 시 ObjectURL 정리
  useEffect(() => {
    return () => {
      refImages.forEach((r) => r.preview && URL.revokeObjectURL(r.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 참고 이미지 다중 업로드 + 순차 분석
  const handleReferenceUpload = async (files) => {
    const list = Array.from(files || []).filter((f) => f && f.type.startsWith('image/'));
    if (!list.length) return;

    // 한도 확인
    const room = MAX_REF_IMAGES - refImages.length;
    if (room <= 0) {
      alert(`참고 이미지는 최대 ${MAX_REF_IMAGES}장까지 업로드 가능합니다.`);
      return;
    }
    const accepted = list.slice(0, room);

    // 즉시 썸네일 등록 (analyzing=true)
    const newItems = accepted.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      preview: URL.createObjectURL(file),
      description: '',
      analyzing: true,
      error: false,
    }));
    setRefImages((prev) => [...prev, ...newItems]);

    // 순차 분석 (병렬 시 LLaVA GPU 충돌 방지)
    for (const item of newItems) {
      try {
        const formData = new FormData();
        formData.append('file', item.file);
        const res = await axios.post(
          `${API_URL}/api/delivery-images/analyze-reference`,
          formData,
          { headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }, timeout: 180000 }
        );
        const desc = res.data?.description || '';
        setRefImages((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, description: desc, analyzing: false } : r))
        );
      } catch (err) {
        const msg = err.response?.data?.detail || err.message;
        setRefImages((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, error: true, analyzing: false, description: `(분석 실패: ${msg})` } : r))
        );
      }
    }

    // 분석 결과를 채팅에 합산 메시지로 한 번 출력
    const analyzedCount = accepted.length;
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content:
          `참고 이미지 ${analyzedCount}장을 분석에 반영했어요. ` +
          `종합적으로 봐서 어떤 느낌이 마음에 드시는지 알려주시면, 공통 요소를 우선 반영해 프롬프트를 만들어드릴게요.\n\n` +
          `(예: "1번 사진의 조명 + 2번 사진의 플레이팅 + 매콤한 느낌")`,
      },
    ]);
  };

  // 개별 참고이미지 삭제
  const removeRefImage = (id) => {
    setRefImages((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((r) => r.id !== id);
    });
  };

  // GPT-5.5 에 보낼 통합 묘사 문자열 (이미지 N장 → 번호 매겨 join)
  const composedReferenceDescription = useCallback(() => {
    const ready = refImages.filter((r) => !r.analyzing && r.description && !r.error);
    if (!ready.length) return undefined;
    if (ready.length === 1) return ready[0].description;
    return ready
      .map((r, i) => `[참고 이미지 ${i + 1}]\n${r.description}`)
      .join('\n\n');
  }, [refImages]);

  // 사용자 메시지 전송
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || thinking) return;
    // 분석 중인 이미지가 있으면 잠시 대기 안내
    if (refImages.some((r) => r.analyzing)) {
      alert('참고 이미지 분석이 끝난 후 메시지를 보내주세요.');
      return;
    }
    const newUserMsg = { role: 'user', content: text };
    const next = [...messages, newUserMsg];
    setMessages(next);
    setInput('');
    setThinking(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/delivery-images/ai-chat`,
        {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          reference_image_description: composedReferenceDescription(),
        },
        { headers: getAuthHeaders(), timeout: 180000 }
      );
      const reply = res.data?.reply || '';
      const finalPrompt = res.data?.final_prompt || null;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, final_prompt: finalPrompt }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '⚠️ 응답 실패: ' +
            (err.response?.data?.detail || err.message) +
            '\n\n다시 시도해주세요.',
          error: true,
        },
      ]);
    }
    setThinking(false);
  }, [input, thinking, messages, refImages, composedReferenceDescription]);

  // 새로 시작
  const handleReset = () => {
    if (!confirm('대화 내용과 참고 이미지를 모두 초기화하시겠습니까?')) return;
    setMessages([
      {
        role: 'assistant',
        content: '새로 시작할게요. 어떤 음식 사진을 만들어볼까요?',
      },
    ]);
    setInput('');
    refImages.forEach((r) => r.preview && URL.revokeObjectURL(r.preview));
    setRefImages([]);
  };

  const handleEnter = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // [이 프롬프트로 이미지 생성] 클릭 분기:
  //  - 참고 이미지 0장: 부모 onGenerate(prompt) → 빠른 생성 탭에서 ai-generate
  //  - 참고 이미지 1장+: 직접 ai-generate-with-refs 호출 (콜라주 → img2img)
  //    이 경로는 LLaVA 텍스트 묘사 대신 실제 이미지를 init_image 로 사용해
  //    한국 음식 인식 약점을 우회한다.
  const handleGenerateClick = useCallback(async (englishPrompt) => {
    const ready = refImages.filter((r) => !r.analyzing && !r.error && r.file);
    if (ready.length === 0) {
      onGenerate?.(englishPrompt);
      return;
    }

    setGenerating(true);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: `🎨 참고 이미지 ${ready.length}장을 합성한 콜라주를 baseline 으로 새 이미지를 생성하고 있어요... (40초~2분)`,
      },
    ]);
    try {
      const formData = new FormData();
      formData.append('prompt', englishPrompt);
      formData.append('name', `AI 채팅 - ${new Date().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}`);
      formData.append('category', '김밥류');
      formData.append('strength', '0.55');
      formData.append('steps', '4');
      ready.forEach((r) => formData.append('files', r.file, r.file.name || 'ref.png'));

      const res = await axios.post(
        `${API_URL}/api/delivery-images/ai-generate-with-refs`,
        formData,
        {
          headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
          timeout: 600000,  // 10분 — Flux 콜라주 img2img 안전 여유
        }
      );
      const url = res.data?.data?.image_url;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `✅ 이미지 생성 완료! 갤러리에 저장됐어요. 마음에 안 들면 "조금 더 어둡게" 같이 수정 요청해서 새 프롬프트를 받아보세요.`,
          generated_image_url: url,
        },
      ]);
      onSaved?.();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ 이미지 생성 실패: ' + (err.response?.data?.detail || err.message),
          error: true,
        },
      ]);
    }
    setGenerating(false);
  }, [refImages, onGenerate, onSaved]);

  // 마크다운 ```prompt``` 블록을 자연스럽게 렌더링하기 위한 분할
  const renderContent = (content) => {
    const parts = content.split(/(```(?:prompt)?\n[\s\S]+?\n```)/gi);
    return parts.map((part, i) => {
      const m = part.match(/^```(?:prompt)?\n([\s\S]+?)\n```$/i);
      if (m) {
        return (
          <div
            key={i}
            className="my-2 rounded-xl bg-slate-900 text-emerald-200 px-3 py-2.5 text-[12px] font-mono leading-relaxed border border-slate-700"
          >
            {m[1].trim()}
          </div>
        );
      }
      return (
        <span key={i} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col h-full min-h-[600px] bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3 bg-gradient-to-r from-violet-50 to-purple-50">
        <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-extrabold text-slate-800">AI와 대화하며 만들기</p>
          <p className="text-[11px] text-slate-500">GPT-5.5 가 함께 정확한 프롬프트를 작성합니다</p>
        </div>
        <button
          onClick={handleReset}
          title="새로 시작"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          title="빠른 생성으로 돌아가기"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 참고 이미지 갤러리 (최대 N장) */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-1.5 mb-2">
          <Eye className="w-3 h-3 text-violet-500" />
          <span className="text-[11px] font-bold text-slate-600">
            참고 이미지 {refImages.length > 0 ? `(${refImages.length}/${MAX_REF_IMAGES})` : '(선택)'}
          </span>
          {refImages.some((r) => r.analyzing) && (
            <span className="flex items-center gap-1 text-[10px] text-violet-500 ml-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              분석 중
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {refImages.map((r, idx) => (
            <div
              key={r.id}
              className="group relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0"
              title={r.description || (r.analyzing ? '분석 중...' : '')}
            >
              <img src={r.preview} alt={`ref-${idx + 1}`} className="w-full h-full object-cover" />
              {r.analyzing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              )}
              {r.error && (
                <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
                  <X className="w-4 h-4 text-white" />
                </div>
              )}
              {!r.analyzing && !r.error && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5">
                  <span className="text-[9px] font-bold text-white">#{idx + 1}</span>
                </div>
              )}
              <button
                onClick={() => removeRefImage(r.id)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
              >
                <X className="w-2.5 h-2.5 text-slate-700" />
              </button>
            </div>
          ))}

          {refImages.length < MAX_REF_IMAGES && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/30 transition-all flex flex-col items-center justify-center gap-0.5 shrink-0"
              title="참고 이미지 추가"
            >
              <Camera className="w-4 h-4 text-slate-400" />
              <span className="text-[9px] font-bold text-slate-400">
                {refImages.length === 0 ? '추가' : '+'}
              </span>
            </button>
          )}
        </div>

        {refImages.length === 0 && (
          <p className="text-[10px] text-slate-400 mt-2">
            여러 장 업로드하면 종합적으로 분석해 더 정확한 프롬프트를 만들 수 있어요.
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleReferenceUpload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* 메시지 리스트 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/30 min-h-0">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1 ml-1">
                  <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                    <Sparkles className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">GPT-5.5</span>
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : msg.error
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-white text-slate-800 border border-slate-200 shadow-sm'
                }`}
              >
                {renderContent(msg.content)}
              </div>
              {msg.role === 'assistant' && msg.final_prompt && !generating && (
                <button
                  onClick={() => handleGenerateClick(msg.final_prompt)}
                  className="mt-2 ml-1 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-xl transition-all"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  {refImages.filter((r) => !r.analyzing && !r.error).length > 0
                    ? `참고 이미지 ${refImages.filter((r) => !r.analyzing && !r.error).length}장 + 프롬프트로 생성`
                    : '이 프롬프트로 이미지 생성'}
                </button>
              )}
              {msg.generated_image_url && (
                <div className="mt-2 ml-1 rounded-xl overflow-hidden border border-violet-200 max-w-xs">
                  <img src={msg.generated_image_url} alt="생성 결과" className="w-full h-auto" />
                </div>
              )}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 bg-white border border-slate-200 shadow-sm flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
              <span className="text-[11px] text-slate-500">GPT-5.5 가 생각 중...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      <div className="px-5 py-3 border-t border-slate-200 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleEnter}
            placeholder="음식, 분위기, 조명 등을 자유롭게 입력하세요. (Shift+Enter 줄바꿈)"
            rows={2}
            className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
            disabled={thinking}
          />
          <button
            onClick={handleSend}
            disabled={thinking || !input.trim()}
            className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 ml-1">
          AI 가 충분한 정보를 모으면 영문 최종 프롬프트를 제안합니다. 원하시는 내용이면 [이 프롬프트로 이미지 생성] 버튼을 눌러주세요.
        </p>
      </div>
    </div>
  );
}
