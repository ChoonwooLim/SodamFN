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
 */
export default function AIChatPromptBuilder({ onGenerate, onClose }) {
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

  const [refFile, setRefFile] = useState(null);
  const [refPreview, setRefPreview] = useState(null);
  const [refDescription, setRefDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  // 참고 이미지 분석
  const handleReferenceUpload = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setRefFile(file);
    setRefPreview(URL.createObjectURL(file));
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(
        `${API_URL}/api/delivery-images/analyze-reference`,
        formData,
        { headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }, timeout: 180000 }
      );
      setRefDescription(res.data?.description || '');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '참고 이미지를 분석했어요. 이걸 참고로 진행할게요.\n\n' +
            `_${(res.data?.description || '').slice(0, 200)}${
              (res.data?.description || '').length > 200 ? '...' : ''
            }_\n\n` +
            '추가로 어떤 느낌으로 만들고 싶으신지 알려주세요. (예: 한국 김밥으로, 매콤한 김치 보이게, 자연광)',
        },
      ]);
    } catch (err) {
      alert('이미지 분석 실패: ' + (err.response?.data?.detail || err.message));
      setRefFile(null);
      setRefPreview(null);
    }
    setAnalyzing(false);
  };

  // 사용자 메시지 전송
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || thinking) return;
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
          reference_image_description: refDescription || undefined,
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
  }, [input, thinking, messages, refDescription]);

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
    setRefFile(null);
    if (refPreview) URL.revokeObjectURL(refPreview);
    setRefPreview(null);
    setRefDescription('');
  };

  const handleEnter = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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

      {/* 참고 이미지 영역 */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        {refPreview ? (
          <div className="flex items-center gap-3">
            <img src={refPreview} alt="ref" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Eye className="w-3 h-3 text-violet-500" />
                <span className="text-[11px] font-bold text-slate-600">참고 이미지 분석됨</span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {analyzing ? '분석 중...' : refDescription.slice(0, 100) + (refDescription.length > 100 ? '...' : '')}
              </p>
            </div>
            <button
              onClick={() => {
                setRefFile(null);
                if (refPreview) URL.revokeObjectURL(refPreview);
                setRefPreview(null);
                setRefDescription('');
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzing}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-500 bg-white border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                참고 이미지 분석 중...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                참고 이미지 업로드 (선택사항)
              </>
            )}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleReferenceUpload(e.target.files?.[0]);
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
              {msg.role === 'assistant' && msg.final_prompt && (
                <button
                  onClick={() => onGenerate(msg.final_prompt)}
                  className="mt-2 ml-1 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-xl transition-all"
                >
                  <Wand2 className="w-3.5 h-3.5" />이 프롬프트로 이미지 생성
                </button>
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
