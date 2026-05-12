import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { X as XIcon, HelpCircle } from 'lucide-react';

// 범용 도움말 모달 — markdown 문자열을 받아 렌더링.
// 진입점에서 title + markdown 만 전달하면 됨.

export default function HelpModal({ title, markdown, onClose }) {
    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape') onClose?.();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Markdown 요소별 커스텀 styling (tailwind typography 플러그인 미사용)
    const mdComponents = {
        h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold text-slate-900 mt-0 mb-4" {...props} />
        ),
        h2: ({ node, ...props }) => (
            <h2 className="text-lg font-bold text-slate-800 mt-6 mb-3 pb-1.5 border-b border-slate-200" {...props} />
        ),
        h3: ({ node, ...props }) => (
            <h3 className="text-base font-semibold text-slate-700 mt-4 mb-2" {...props} />
        ),
        p: ({ node, ...props }) => (
            <p className="text-sm text-slate-700 leading-relaxed my-2.5" {...props} />
        ),
        ul: ({ node, ordered, ...props }) => (
            <ul className="list-disc pl-5 my-2 space-y-1" {...props} />
        ),
        ol: ({ node, ordered, ...props }) => (
            <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />
        ),
        li: ({ node, ordered, ...props }) => (
            <li className="text-sm text-slate-700 leading-relaxed" {...props} />
        ),
        strong: ({ node, ...props }) => (
            <strong className="font-semibold text-slate-900" {...props} />
        ),
        code: ({ node, inline, className, ...props }) =>
            inline ? (
                <code className="text-fuchsia-700 bg-fuchsia-50 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
            ) : (
                <code className={className} {...props} />
            ),
        pre: ({ node, ...props }) => (
            <pre className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-3 overflow-x-auto my-3 font-mono" {...props} />
        ),
        blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-amber-300 bg-amber-50 py-2 px-3 rounded-r my-3 text-sm text-amber-900" {...props} />
        ),
        hr: ({ node, ...props }) => <hr className="my-5 border-slate-200" {...props} />,
        a: ({ node, ...props }) => (
            <a className="text-sky-600 hover:text-sky-700 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
        ),
        table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-slate-200">
                <table className="w-full text-sm" {...props} />
            </div>
        ),
        thead: ({ node, ...props }) => (
            <thead className="bg-slate-100" {...props} />
        ),
        th: ({ node, ...props }) => (
            <th className="text-left text-slate-700 font-semibold px-3 py-2 text-xs" {...props} />
        ),
        td: ({ node, ...props }) => (
            <td className="px-3 py-2 border-t border-slate-100 text-sm text-slate-700" {...props} />
        ),
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-sky-600 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <HelpCircle size={20} />
                        <h3 className="font-bold text-lg">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="hover:bg-white/10 p-1.5 rounded transition-colors"
                        title="닫기 (ESC)"
                    >
                        <XIcon size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <ReactMarkdown components={mdComponents}>{markdown}</ReactMarkdown>
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between shrink-0">
                    <span>💡 추가 도움이 필요하시면 셈하나 운영팀에 문의하세요</span>
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
