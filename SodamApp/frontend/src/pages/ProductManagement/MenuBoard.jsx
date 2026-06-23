import { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileText, Download, Printer, Edit3, Eye,
  Plus, Minus, RotateCcw, Palette, Type, Image as ImageIcon
} from 'lucide-react';
import api from '../../api';

/* ── 카테고리 한글 라벨 / 순서 ── */
const CAT_LABELS = {
  gimbap: '김밥류',
  bunsik: '분식류',
  onigiri: '주먹밥류',
  ramen: '라면류',
  drinks: '음료류',
};
const CAT_ORDER = ['gimbap', 'bunsik', 'onigiri', 'ramen', 'drinks'];

/* ── 템플릿 색상 프리셋 ── */
const COLOR_PRESETS = [
  { name: '클래식', bg: '#FFF8F0', header: '#8B4513', accent: '#D2691E', text: '#3E2723', border: '#D2691E' },
  { name: '모던', bg: '#FAFAFA', header: '#1E293B', accent: '#3B82F6', text: '#334155', border: '#E2E8F0' },
  { name: '내추럴', bg: '#F0F5E9', header: '#2D5016', accent: '#4CAF50', text: '#33691E', border: '#81C784' },
  { name: '레트로', bg: '#FFF3E0', header: '#BF360C', accent: '#FF6F00', text: '#4E342E', border: '#FF8F00' },
];

export default function MenuBoard() {
  const [editMode, setEditMode] = useState(false);
  const [prices, setPrices] = useState({});  // { category: [{id,name,price,emoji,spec}] }
  const [loading, setLoading] = useState(true);
  const [colorIdx, setColorIdx] = useState(0);
  const [shopName, setShopName] = useState('우리 가게');
  const [shopSub, setShopSub] = useState('정성을 담은 한 줄');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const printRef = useRef(null);

  const theme = COLOR_PRESETS[colorIdx];

  /* ── 매장 메뉴(상품) 불러오기 — 카테고리별 그룹 ── */
  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/menu-items', { params: { item_type: 'product' } });
      const grouped = {};
      (res.data.items || []).forEach(it => {
        const c = it.category || 'gimbap';
        (grouped[c] = grouped[c] || []).push(it);
      });
      setPrices(grouped);
    } catch (e) {
      console.error('메뉴 로드 실패', e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  /* ── 가격/이름 수정 (로컬 즉시 반영) ── */
  const handlePriceChange = useCallback((cat, idx, field, value) => {
    setPrices(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (field === 'price') {
        const num = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
        next[cat][idx].price = isNaN(num) ? 0 : num;
      } else {
        next[cat][idx][field] = value;
      }
      return next;
    });
  }, []);

  /* ── 서버 저장 (입력 onBlur) ── */
  const saveItem = useCallback(async (cat, idx) => {
    const it = prices[cat]?.[idx];
    if (!it?.id) return;
    try {
      await api.put(`/menu-items/${it.id}`, { name: it.name, price: it.price });
    } catch (e) { console.error('저장 실패', e); }
  }, [prices]);

  /* ── 항목 추가/삭제 (서버 반영) ── */
  const addItem = useCallback(async (cat) => {
    try {
      const res = await api.post('/menu-items', { item_type: 'product', name: '새 메뉴', price: 0, category: cat });
      setPrices(prev => ({ ...prev, [cat]: [...(prev[cat] || []), res.data] }));
    } catch (e) { console.error('추가 실패', e); }
  }, []);

  const removeItem = useCallback(async (cat, idx) => {
    const it = prices[cat]?.[idx];
    if (!it?.id) return;
    if (!window.confirm(`'${it.name}' 메뉴를 삭제할까요?`)) return;
    try {
      await api.delete(`/menu-items/${it.id}`);
      setPrices(prev => {
        const next = JSON.parse(JSON.stringify(prev));
        next[cat].splice(idx, 1);
        return next;
      });
    } catch (e) { console.error('삭제 실패', e); }
  }, [prices]);

  /* ── 서버에서 다시 불러오기 ── */
  const resetPrices = () => fetchMenu();

  /* ── PNG 내보내기 ── */
  const exportPNG = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        backgroundColor: theme.bg,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `메뉴판_${shopName}_${new Date().toISOString().slice(0,10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      alert('PNG 내보내기 실패: ' + e.message);
    }
    setExporting(false);
  };

  /* ── PDF 내보내기 ── */
  const exportPDF = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        backgroundColor: theme.bg,
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
      pdf.save(`메뉴판_${shopName}_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      alert('PDF 내보내기 실패: ' + e.message);
    }
    setExporting(false);
  };

  /* ── 인쇄 ── */
  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>메뉴판 - ${shopName}</title>
      <style>body{margin:0;padding:20px;font-family:'Pretendard',sans-serif;}@media print{body{padding:0;}}</style>
      </head><body>${content.outerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  /* ── 포맷 ── */
  const fmt = (n) => n.toLocaleString('ko-KR');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-4 sm:px-8 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">메뉴판 / 가격표</h1>
          </div>
          <p className="text-slate-400 text-sm ml-[52px]">메뉴판을 편집하고 PNG, PDF로 내보내세요</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">

        {/* ── 툴바 ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              editMode
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {editMode ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {editMode ? '미리보기' : '편집 모드'}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
            >
              <Palette className="w-4 h-4" />
              테마
              <div className="w-4 h-4 rounded-full border border-slate-300" style={{ background: theme.header }} />
            </button>
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl p-3 z-30 min-w-[180px]">
                {COLOR_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => { setColorIdx(i); setShowColorPicker(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                      colorIdx === i ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex gap-1">
                      <div className="w-4 h-4 rounded-full" style={{ background: p.header }} />
                      <div className="w-4 h-4 rounded-full" style={{ background: p.accent }} />
                      <div className="w-4 h-4 rounded-full" style={{ background: p.bg }} />
                    </div>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={resetPrices}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            초기화
          </button>

          <div className="flex-1" />

          <button
            onClick={exportPNG}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4" />
            PNG
          </button>
          <button
            onClick={exportPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-700 text-white hover:bg-slate-800 transition-all"
          >
            <Printer className="w-4 h-4" />
            인쇄
          </button>
        </div>

        {/* ── 메뉴판 프리뷰 ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-8 overflow-auto">
          <div
            ref={printRef}
            style={{
              background: theme.bg,
              color: theme.text,
              fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif",
              maxWidth: 800,
              margin: '0 auto',
              padding: '40px 36px',
              borderRadius: 16,
              border: `2px solid ${theme.border}`,
            }}
          >
            {/* 상호명 헤더 */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              {editMode ? (
                <>
                  <input
                    value={shopName}
                    onChange={e => setShopName(e.target.value)}
                    className="text-center text-3xl font-extrabold bg-transparent border-b-2 border-dashed outline-none w-full mb-2"
                    style={{ color: theme.header, borderColor: theme.accent }}
                  />
                  <input
                    value={shopSub}
                    onChange={e => setShopSub(e.target.value)}
                    className="text-center text-base bg-transparent border-b border-dashed outline-none w-full"
                    style={{ color: theme.accent, borderColor: theme.border }}
                  />
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: 32, fontWeight: 800, color: theme.header, margin: '0 0 6px', letterSpacing: -0.5 }}>
                    {shopName}
                  </h2>
                  <p style={{ fontSize: 15, color: theme.accent, fontWeight: 500, margin: 0 }}>{shopSub}</p>
                </>
              )}
              <div style={{ width: 60, height: 3, background: theme.accent, margin: '16px auto 0', borderRadius: 2 }} />
            </div>

            {/* 카테고리별 메뉴 */}
            {CAT_ORDER.filter(cat => (prices[cat] || []).length || editMode).map((cat) => {
              const items = prices[cat] || [];
              return (
              <div key={cat} style={{ marginBottom: 28 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
                  borderBottom: `2px solid ${theme.accent}`, paddingBottom: 8,
                }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: theme.header }}>
                    {CAT_LABELS[cat] || cat}
                  </span>
                </div>

                {items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 4px',
                      borderBottom: idx < items.length - 1 ? `1px dotted ${theme.border}` : 'none',
                    }}
                  >
                    {editMode ? (
                      <>
                        <input
                          value={item.name}
                          onChange={e => handlePriceChange(cat, idx, 'name', e.target.value)}
                          onBlur={() => saveItem(cat, idx)}
                          className="flex-1 bg-transparent border-b border-dashed outline-none text-base font-semibold"
                          style={{ color: theme.text, borderColor: theme.border }}
                        />
                        <input
                          value={item.price}
                          onChange={e => handlePriceChange(cat, idx, 'price', e.target.value)}
                          onBlur={() => saveItem(cat, idx)}
                          className="w-24 text-right bg-transparent border-b border-dashed outline-none text-base font-bold tabular-nums"
                          style={{ color: theme.header, borderColor: theme.border }}
                        />
                        <span style={{ fontSize: 13, color: theme.accent, minWidth: 16 }}>원</span>
                        <button
                          onClick={() => removeItem(cat, idx)}
                          className="p-1 rounded hover:bg-red-100 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>
                          {item.name}
                          {item.spec && (
                            <span style={{ fontSize: 12, fontWeight: 400, color: theme.accent, marginLeft: 6 }}>
                              ({item.spec})
                            </span>
                          )}
                        </span>
                        <span style={{
                          fontSize: 12, color: theme.border, margin: '0 8px',
                          flex: '1 1 auto', borderBottom: `1px dotted ${theme.border}`,
                          alignSelf: 'flex-end', marginBottom: 4,
                        }} />
                        <span style={{ fontSize: 16, fontWeight: 800, color: theme.header, fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(item.price)}
                        </span>
                        <span style={{ fontSize: 12, color: theme.accent, marginLeft: 2 }}>원</span>
                      </>
                    )}
                  </div>
                ))}

                {/* 설명 항목 */}
                {!editMode && items.filter(i => i.desc).map((item, i) => (
                  <div key={`desc-${i}`} style={{ fontSize: 12, color: theme.accent, paddingLeft: 8, marginTop: 4, fontStyle: 'italic' }}>
                    ※ {item.name}: {item.desc}
                  </div>
                ))}

                {editMode && (
                  <button
                    onClick={() => addItem(cat)}
                    className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                    style={{ color: theme.accent, background: `${theme.accent}15` }}
                  >
                    <Plus className="w-3.5 h-3.5" /> 항목 추가
                  </button>
                )}
              </div>
              );
            })}

            {/* 하단 안내 */}
            <div style={{
              textAlign: 'center', marginTop: 24, paddingTop: 16,
              borderTop: `1px solid ${theme.border}`,
              fontSize: 12, color: theme.accent,
            }}>
              가격은 부가세 포함입니다 · 메뉴 및 가격은 변경될 수 있습니다
            </div>
          </div>
        </div>

        {/* AI 도우미 (Phase 2 placeholder) */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-slate-200 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
            <Type className="w-6 h-6 text-blue-500" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">AI 메뉴판 디자인</h3>
          <p className="text-sm text-slate-500 mb-3">AI가 매장 스타일에 맞는 메뉴판을 자동 생성합니다</p>
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 text-slate-500 text-sm font-bold">
            준비 중
          </span>
        </div>
      </div>
    </div>
  );
}
