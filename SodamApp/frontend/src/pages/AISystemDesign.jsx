import { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import {
  Brain,
  Sparkles,
  Calendar,
  User,
  GitCommit,
  FileText,
  List,
  ChevronRight,
  Layers,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import designDoc from '../content/ai-gateway-phase1-design.md?raw';

// ─────────────────────────────────────────────
// 유틸: 마크다운 제목을 anchor slug 로 변환
// rehype-slug 와 동일 규칙(github-slugger) 을 근사한다
// ─────────────────────────────────────────────
const slugify = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-');

// ─────────────────────────────────────────────
// 제목(Heading)만 추출해서 TOC 데이터 생성
// ─────────────────────────────────────────────
const parseHeadings = (md) => {
  const lines = md.split('\n');
  const headings = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = /^(#{1,3})\s+(.+)$/.exec(line);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/[*_`]/g, '').trim();
      headings.push({ level, text, id: slugify(text) });
    }
  }
  return headings;
};

// ─────────────────────────────────────────────
// 메타데이터 추출 (문서 상단의 `- **키**: 값` 패턴)
// ─────────────────────────────────────────────
const parseMeta = (md) => {
  const meta = {};
  const metaLines = md.split('\n').slice(0, 15);
  for (const line of metaLines) {
    const m = /^-\s+\*\*([^*]+)\*\*:\s*(.+)$/.exec(line);
    if (m) meta[m[1].trim()] = m[2].trim();
  }
  return meta;
};

// ─────────────────────────────────────────────
// 커스텀 마크다운 컴포넌트 (Tailwind 다크 테마)
// ─────────────────────────────────────────────
const mdComponents = {
  h1: ({ children, ...props }) => (
    <h1
      {...props}
      className="text-3xl md:text-4xl font-black text-white mt-10 mb-6 pb-4 border-b border-slate-700/60 scroll-mt-24"
    >
      <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-cyan-300 bg-clip-text text-transparent">
        {children}
      </span>
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      {...props}
      className="text-2xl md:text-3xl font-bold text-white mt-12 mb-5 pl-4 border-l-4 border-indigo-500 scroll-mt-24"
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      {...props}
      className="text-xl md:text-2xl font-bold text-slate-100 mt-8 mb-4 flex items-center gap-2 scroll-mt-24"
    >
      <ChevronRight className="w-5 h-5 text-sky-400" />
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 {...props} className="text-lg font-semibold text-slate-200 mt-6 mb-3 scroll-mt-24">
      {children}
    </h4>
  ),
  p: ({ children }) => <p className="text-slate-300 leading-relaxed mb-4 text-[15px]">{children}</p>,
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-sky-300 not-italic font-medium">{children}</em>,
  a: ({ children, href, ...props }) => (
    <a
      {...props}
      href={href}
      className="text-sky-400 hover:text-sky-300 underline decoration-sky-400/40 hover:decoration-sky-300 transition-colors"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="space-y-2 mb-5 ml-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-2 mb-5 text-slate-300 ml-2">{children}</ol>,
  li: ({ children, ordered }) =>
    ordered ? (
      <li className="text-slate-300 leading-relaxed pl-1">{children}</li>
    ) : (
      <li className="text-slate-300 leading-relaxed flex gap-2 items-start">
        <span className="text-sky-400 mt-1.5 flex-shrink-0">▸</span>
        <span className="flex-1">{children}</span>
      </li>
    ),
  blockquote: ({ children }) => (
    <blockquote className="my-5 pl-4 pr-3 py-3 border-l-4 border-amber-500/70 bg-amber-500/5 rounded-r-lg text-amber-100/90">
      {children}
    </blockquote>
  ),
  code: ({ inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code
          className="px-1.5 py-0.5 mx-0.5 text-[13px] font-mono text-pink-300 bg-slate-800/80 border border-slate-700/60 rounded"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={`${className || ''} block text-[13px] font-mono text-slate-200 leading-relaxed`} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-5 p-4 bg-slate-950/80 border border-slate-700/60 rounded-xl overflow-x-auto shadow-inner">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-slate-700/60 shadow-lg">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-800/90">{children}</thead>,
  th: ({ children }) => (
    <th className="px-4 py-3 text-left font-semibold text-slate-100 border-b border-slate-700/60">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-slate-300 border-b border-slate-800/60">{children}</td>
  ),
  tr: ({ children }) => <tr className="hover:bg-slate-800/30 transition-colors">{children}</tr>,
  hr: () => <hr className="my-10 border-t border-slate-700/40" />,
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="my-5 rounded-xl border border-slate-700/60 max-w-full" />
  ),
};

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function AISystemDesign() {
  const meta = useMemo(() => parseMeta(designDoc), []);
  const headings = useMemo(() => parseHeadings(designDoc), []);
  const contentRef = useRef(null);
  const [activeId, setActiveId] = useState('');
  const [copied, setCopied] = useState(false);

  // 스크롤 위치에 따라 현재 섹션 하이라이트
  useEffect(() => {
    const onScroll = () => {
      if (!contentRef.current) return;
      const headingEls = contentRef.current.querySelectorAll('h1, h2, h3');
      let current = '';
      for (const el of headingEls) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 120) {
          current = el.id;
        } else {
          break;
        }
      }
      if (current) setActiveId(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const handleDownload = () => {
    const blob = new Blob([designDoc], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2026-04-11-ai-gateway-phase1-design.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // TOC 상위 섹션만(## 레벨) — ### 는 서브로
  const tocItems = headings.filter((h) => h.level === 2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden border-b border-slate-800/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/15 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-14">
          <div className="flex items-start gap-4 md:gap-6">
            <div className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
              <Brain className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sky-400 text-sm font-semibold mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="uppercase tracking-wider">AI System Design</span>
              </div>

              <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-3">
                <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-cyan-200 bg-clip-text text-transparent">
                  AI Gateway Phase 1
                </span>
              </h1>
              <p className="text-slate-300 text-base md:text-lg max-w-3xl leading-relaxed">
                셈하나 AI 통합 게이트웨이 설계 문서 — OpenAI-Compatible 단일 진입점 + DB 기반 프로바이더 레지스트리 + 캐스케이딩 폴백
              </p>

              {/* 메타 카드 */}
              <div className="mt-5 flex flex-wrap gap-2">
                {meta['작성일'] && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-medium">
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                    {meta['작성일']}
                  </span>
                )}
                {meta['작성자'] && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-medium">
                    <User className="w-3.5 h-3.5 text-sky-400" />
                    {meta['작성자']}
                  </span>
                )}
                {meta['단계'] && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/40 text-indigo-300 text-xs font-medium">
                    <Layers className="w-3.5 h-3.5" />
                    {meta['단계']}
                  </span>
                )}
                {meta['위치'] && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-mono">
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    {meta['위치']}
                  </span>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-sm font-medium transition-all hover:-translate-y-0.5"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? '링크 복사됨' : '링크 복사'}
                </button>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5"
                >
                  <Download className="w-4 h-4" />
                  .md 다운로드
                </button>
                <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40 text-slate-400 text-xs">
                  <GitCommit className="w-3.5 h-3.5" />
                  committed to git
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body: TOC + Content ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="flex gap-8">
          {/* ── TOC (데스크탑 전용 스티키) ── */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-6">
              <div className="rounded-2xl bg-slate-900/60 backdrop-blur border border-slate-800/60 p-4 shadow-xl">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 pb-3 border-b border-slate-800/60">
                  <List className="w-4 h-4" />
                  목차
                </div>
                <nav className="space-y-1 max-h-[calc(100vh-240px)] overflow-y-auto pr-1 custom-scrollbar">
                  {tocItems.map((h, idx) => (
                    <a
                      key={`${h.id}-${idx}`}
                      href={`#${h.id}`}
                      className={`block text-sm py-1.5 px-3 rounded-lg transition-all ${
                        activeId === h.id
                          ? 'bg-indigo-500/15 text-indigo-300 font-medium border-l-2 border-indigo-400'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          </aside>

          {/* ── Content ── */}
          <main ref={contentRef} className="flex-1 min-w-0">
            <article className="rounded-2xl bg-slate-900/40 backdrop-blur border border-slate-800/60 p-6 md:p-10 shadow-2xl">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSlug]}
                components={mdComponents}
              >
                {designDoc}
              </ReactMarkdown>
            </article>

            {/* Footer */}
            <div className="mt-8 text-center text-slate-500 text-xs">
              <p>이 문서는 <code className="text-slate-400">docs/superpowers/specs/2026-04-11-ai-gateway-phase1-design.md</code> 의 스냅샷입니다.</p>
              <p className="mt-1">원본이 수정되면 <code className="text-slate-400">frontend/src/content/</code> 로 다시 복사해야 합니다.</p>
            </div>
          </main>
        </div>
      </div>

      {/* 커스텀 스크롤바 */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.3); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.5); }
      `}</style>
    </div>
  );
}
