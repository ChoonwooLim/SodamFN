import { useState, useRef, useCallback } from 'react';
import {
  Store, Upload, Download, Trash2, Eye, Search,
  FileText, Image as ImageIcon, Film, File,
  FolderOpen, Plus, X, Grid3x3, List
} from 'lucide-react';

/* ── 탭 정의 ── */
const TABS = [
  { id: 'signs', label: '매장 사인물', icon: Store, color: '#f59e0b', desc: '간판, 배너, 포스터, 입간판' },
  { id: 'training', label: '교육 자료', icon: FileText, color: '#3b82f6', desc: '직원 교육용 매뉴얼, 가이드' },
  { id: 'naver', label: '네이버플레이스', icon: ImageIcon, color: '#2db400', desc: '네이버 플레이스 등록용 사진' },
  { id: 'etc', label: '기타', icon: File, color: '#64748b', desc: '기타 인쇄물, 홍보물' },
];

/* ── 파일 타입 아이콘/색상 ── */
const getFileType = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return { type: 'image', Icon: ImageIcon, color: '#8b5cf6' };
  if (['mp4','mov','avi','webm'].includes(ext)) return { type: 'video', Icon: Film, color: '#ef4444' };
  if (['pdf'].includes(ext)) return { type: 'pdf', Icon: FileText, color: '#f59e0b' };
  return { type: 'file', Icon: File, color: '#64748b' };
};

/* ── 포맷 파일 사이즈 ── */
const fmtSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function StoreMaterials() {
  const [activeTab, setActiveTab] = useState('signs');
  const [files, setFiles] = useState({
    signs: [],
    training: [],
    naver: [],
    etc: [],
  });
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [previewFile, setPreviewFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const currentTab = TABS.find(t => t.id === activeTab);
  const currentFiles = files[activeTab] || [];

  /* ── 필터 ── */
  const filtered = currentFiles.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  /* ── 파일 업로드 처리 ── */
  const handleFiles = useCallback((fileList) => {
    const newFiles = Array.from(fileList).map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      lastModified: new Date(file.lastModified).toLocaleDateString('ko-KR'),
      url: URL.createObjectURL(file),
      rawFile: file,
    }));

    setFiles(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], ...newFiles],
    }));
  }, [activeTab]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  /* ── 파일 삭제 ── */
  const removeFile = useCallback((id) => {
    setFiles(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].filter(f => f.id !== id),
    }));
    if (previewFile?.id === id) setPreviewFile(null);
  }, [activeTab, previewFile]);

  /* ── 파일 다운로드 ── */
  const downloadFile = (file) => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    a.click();
  };

  /* ── 미리보기 렌더 ── */
  const renderPreview = (file) => {
    const { type } = getFileType(file.name);
    if (type === 'image') {
      return <img src={file.url} alt={file.name} className="w-full h-full object-cover" />;
    }
    if (type === 'video') {
      return (
        <video src={file.url} className="w-full h-full object-cover" muted>
          <source src={file.url} />
        </video>
      );
    }
    const { Icon, color } = getFileType(file.name);
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100">
        <Icon className="w-10 h-10" style={{ color }} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-4 sm:px-8 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Store className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">매장 홍보물</h1>
          </div>
          <p className="text-slate-400 text-sm ml-[52px]">사인물, 교육자료, 네이버플레이스 사진을 관리하세요</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-5">

        {/* ── 탭 ── */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = files[tab.id]?.length || 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-white shadow-lg border border-slate-200 scale-[1.02]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <TabIcon className="w-4 h-4" style={isActive ? { color: tab.color } : {}} />
                <span style={isActive ? { color: tab.color } : {}}>{tab.label}</span>
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── 업로드 드롭존 ── */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-blue-400 bg-blue-50 scale-[1.01]'
              : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf"
            className="hidden"
            onChange={e => { if (e.target.files.length) handleFiles(e.target.files); e.target.value = ''; }}
          />
          <Upload className={`w-8 h-8 mx-auto mb-3 ${dragOver ? 'text-blue-500' : 'text-slate-400'}`} />
          <p className="text-sm font-bold text-slate-700 mb-1">
            파일을 드래그하거나 클릭하여 업로드
          </p>
          <p className="text-xs text-slate-500">
            {currentTab.desc} · 이미지(JPG/PNG), PDF, 영상(MP4) 지원
          </p>
        </div>

        {/* ── 검색/보기 바 ── */}
        {currentFiles.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="파일명 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
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
            <span className="text-xs text-slate-500 font-medium">{filtered.length}개 파일</span>
          </div>
        )}

        {/* ── 파일 그리드 ── */}
        {filtered.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filtered.map(file => {
                const { Icon, color } = getFileType(file.name);
                return (
                  <div
                    key={file.id}
                    className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-slate-300 transition-all"
                  >
                    {/* 썸네일 */}
                    <div className="aspect-square overflow-hidden">
                      {renderPreview(file)}
                    </div>

                    {/* 파일 정보 */}
                    <div className="p-3">
                      <p className="text-sm font-bold text-slate-800 truncate" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Icon className="w-3 h-3" style={{ color }} />
                        <span className="text-xs text-slate-500">{fmtSize(file.size)}</span>
                        <span className="text-xs text-slate-400">{file.lastModified}</span>
                      </div>
                    </div>

                    {/* 호버 액션 */}
                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                      <button
                        onClick={() => downloadFile(file)}
                        className="w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                      </button>
                      <button
                        onClick={() => removeFile(file.id)}
                        className="w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── 리스트 뷰 ── */
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
              {filtered.map(file => {
                const { Icon, color } = getFileType(file.name);
                return (
                  <div key={file.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 transition-all">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                      {renderPreview(file)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{file.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Icon className="w-3 h-3" style={{ color }} />
                        <span className="text-xs text-slate-500">{fmtSize(file.size)}</span>
                        <span className="text-xs text-slate-400">{file.lastModified}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => setPreviewFile(file)} className="p-2 rounded-lg hover:bg-slate-100 transition-all">
                        <Eye className="w-4 h-4 text-slate-500" />
                      </button>
                      <button onClick={() => downloadFile(file)} className="p-2 rounded-lg hover:bg-slate-100 transition-all">
                        <Download className="w-4 h-4 text-blue-500" />
                      </button>
                      <button onClick={() => removeFile(file.id)} className="p-2 rounded-lg hover:bg-slate-100 transition-all">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : currentFiles.length === 0 ? (
          /* ── 빈 상태 ── */
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <FolderOpen className="w-14 h-14 text-slate-300 mx-auto mb-4" />
            <h3 className="text-base font-bold text-slate-700 mb-1">{currentTab.label} 파일이 없습니다</h3>
            <p className="text-sm text-slate-500 mb-4">{currentTab.desc}를 업로드해보세요</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: currentTab.color }}
            >
              <Plus className="w-4 h-4" />
              파일 업로드
            </button>
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-bold">검색 결과가 없습니다</p>
          </div>
        )}

        {/* AI 도우미 (Phase 2 placeholder) */}
        <div className="bg-gradient-to-br from-slate-50 to-amber-50 rounded-2xl border border-slate-200 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
            <Store className="w-6 h-6 text-amber-500" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">AI 홍보물 제작</h3>
          <p className="text-sm text-slate-500 mb-3">AI가 매장 특성에 맞는 사인물, 배너, 포스터를 자동 생성합니다</p>
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 text-slate-500 text-sm font-bold">
            준비 중
          </span>
        </div>
      </div>

      {/* ── 미리보기 모달 ── */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* 미리보기 본문 */}
            <div className="max-h-[70vh] overflow-auto bg-slate-100">
              {(() => {
                const { type } = getFileType(previewFile.name);
                if (type === 'image') {
                  return <img src={previewFile.url} alt={previewFile.name} className="w-full object-contain" />;
                }
                if (type === 'video') {
                  return <video src={previewFile.url} controls className="w-full" />;
                }
                if (type === 'pdf') {
                  return (
                    <iframe
                      src={previewFile.url}
                      className="w-full h-[70vh]"
                      title={previewFile.name}
                    />
                  );
                }
                return (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-slate-500">미리보기를 지원하지 않는 파일입니다</p>
                  </div>
                );
              })()}
            </div>

            {/* 하단 바 */}
            <div className="p-4 flex items-center justify-between border-t border-slate-200">
              <div>
                <p className="text-base font-bold text-slate-800">{previewFile.name}</p>
                <p className="text-xs text-slate-500">{fmtSize(previewFile.size)} · {previewFile.lastModified}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadFile(previewFile)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 transition-all"
                >
                  <Download className="w-4 h-4" />
                  다운로드
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
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
