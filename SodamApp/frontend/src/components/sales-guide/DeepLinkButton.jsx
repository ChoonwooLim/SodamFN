import { ExternalLink, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * 외부 정부 사이트 또는 내부 SodamFN 페이지 deep-link.
 *
 * Props:
 * - link: { label, url?, path?, external: boolean }
 */
export default function DeepLinkButton({ link, variant = 'primary' }) {
  const navigate = useNavigate();

  const handleClick = (e) => {
    if (link.external) {
      // 외부 링크는 새 창
      window.open(link.url, '_blank', 'noopener,noreferrer');
    } else {
      e.preventDefault();
      navigate(link.path);
    }
  };

  const baseClass =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-slate-100 hover:bg-slate-200 text-slate-800';

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition ${baseClass}`}
    >
      <span>{link.label}</span>
      {link.external ? <ExternalLink className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
    </button>
  );
}
