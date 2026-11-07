import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BookOpen,
  Volume2,
  FileText,
  Loader2,
  Layers,
  Settings2,
  Image as ImageIcon,
  Eye,
  Sparkles,
} from 'lucide-react';
import { ChapterItem } from '../types';
import { thumbHashToDataURL } from '../utils/thumbhash';

interface ReaderModalProps {
  slug: string;
  sourceBaseUrl?: string;
  itemTitle: string;
  chapter: ChapterItem;
  allChapters: ChapterItem[];
  contentType: string;
  onClose: () => void;
  onSelectChapter: (chap: ChapterItem) => void;
}

export const ReaderModal: React.FC<ReaderModalProps> = ({
  slug,
  sourceBaseUrl = '',
  itemTitle,
  chapter,
  allChapters,
  contentType,
  onClose,
  onSelectChapter,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contentData, setContentData] = useState<any>(null);

  // Manga reader settings
  const [viewMode, setViewMode] = useState<'webtoon' | 'single'>('webtoon');
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);

  // Novel reader settings
  const [novelTheme, setNovelTheme] = useState<'dark' | 'sepia' | 'black' | 'light'>('dark');
  const [fontSize, setFontSize] = useState(18);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedIllustration, setSelectedIllustration] = useState<any>(null);

  const currentIdx = allChapters.findIndex((c) => c.id === chapter.id);
  const prevChapter = currentIdx > 0 ? allChapters[currentIdx - 1] : null;
  const nextChapter = currentIdx < allChapters.length - 1 ? allChapters[currentIdx + 1] : null;

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);
    setCurrentPage(1);

    fetch(`/api/sources/${slug}/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId: chapter.id }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isCancelled) {
          if (data.error) throw new Error(data.error);
          setContentData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err.message || 'Failed to load chapter content');
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [slug, chapter.id]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (viewMode === 'single' && contentData?.type === 'images') {
        const pList = extractPages();
        if (e.key === 'ArrowRight' || e.key === ' ') {
          setCurrentPage((prev) => Math.min(pList.length, prev + 1));
        } else if (e.key === 'ArrowLeft') {
          setCurrentPage((prev) => Math.max(1, prev - 1));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, contentData, onClose]);

  interface PageItem {
    url: string;
    referer?: string;
  }

  const extractPages = (): PageItem[] => {
    if (!contentData) return [];
    if (contentData.type === 'images') {
      const rawPages = contentData.pages || [];
      return (Array.isArray(rawPages) ? rawPages : [])
        .map((p: any) => {
          if (typeof p === 'string') return { url: p };
          if (p && p.url) {
            const ref = p.headers?.Referer || p.headers?.referer || '';
            return { url: p.url, referer: ref };
          }
          return null;
        })
        .filter((item): item is PageItem => Boolean(item && item.url));
    }
    return [];
  };

  const pages = extractPages();

  const getProxyImageUrl = (page: PageItem | undefined) => {
    if (!page || !page.url) return '';
    const ref = page.referer || sourceBaseUrl || '';
    return `/api/proxy-image?url=${encodeURIComponent(page.url)}&referer=${encodeURIComponent(ref)}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="flex items-center space-x-3 truncate">
          <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-sm">
            <BookOpen className="w-4 h-4" />
            <span className="truncate max-w-[200px] sm:max-w-[320px]">{itemTitle}</span>
          </div>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 text-sm font-medium truncate max-w-[200px]">
            {chapter.title || `Chapter ${chapter.number ?? ''}`}
          </span>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Chapter Selector Dropdown */}
          <select
            value={chapter.id}
            onChange={(e) => {
              const selected = allChapters.find((c) => c.id === e.target.value);
              if (selected) onSelectChapter(selected);
            }}
            className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[140px] sm:max-w-[200px] truncate"
          >
            {allChapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title || `Ch. ${c.number ?? ''}`}
              </option>
            ))}
          </select>

          {/* Manga Mode Controls */}
          {contentType === 'pageImages' && (
            <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => setViewMode('webtoon')}
                className={`px-2.5 py-1 text-xs rounded-md transition ${
                  viewMode === 'webtoon' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
                title="Continuous Vertical Scroll (Webtoon style)"
              >
                Webtoon
              </button>
              <button
                onClick={() => setViewMode('single')}
                className={`px-2.5 py-1 text-xs rounded-md transition ${
                  viewMode === 'single' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
                title="Single Page Flip Mode"
              >
                Single Page
              </button>
            </div>
          )}

          {/* Zoom controls for Manga */}
          {contentType === 'pageImages' && (
            <div className="hidden md:flex items-center space-x-1 bg-slate-800 rounded px-1.5 py-1 border border-slate-700 text-xs text-slate-300">
              <button
                onClick={() => setZoom((z) => Math.max(50, z - 15))}
                className="p-1 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="w-9 text-center font-mono">{zoom}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(180, z + 15))}
                className="p-1 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(100)}
                className="p-1 hover:text-white"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Novel Reader Controls */}
          {contentType === 'text' && (
            <div className="flex items-center space-x-2 bg-slate-800 rounded px-2 py-1 border border-slate-700 text-xs">
              <button
                onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                className="px-1.5 py-0.5 bg-slate-700 rounded hover:bg-slate-600 font-bold"
                title="Smaller Font"
              >
                A-
              </button>
              <span className="font-mono">{fontSize}px</span>
              <button
                onClick={() => setFontSize((s) => Math.min(32, s + 2))}
                className="px-1.5 py-0.5 bg-slate-700 rounded hover:bg-slate-600 font-bold"
                title="Larger Font"
              >
                A+
              </button>
              <div className="h-4 w-px bg-slate-700 mx-1" />
              <button
                onClick={() => setNovelTheme('dark')}
                className={`w-4 h-4 rounded-full bg-slate-900 border ${novelTheme === 'dark' ? 'ring-2 ring-indigo-500' : 'border-slate-600'}`}
                title="Dark Theme"
              />
              <button
                onClick={() => setNovelTheme('sepia')}
                className={`w-4 h-4 rounded-full bg-[#fbf0d9] border ${novelTheme === 'sepia' ? 'ring-2 ring-indigo-500' : 'border-amber-400'}`}
                title="Sepia Theme"
              />
              <button
                onClick={() => setNovelTheme('black')}
                className={`w-4 h-4 rounded-full bg-black border ${novelTheme === 'black' ? 'ring-2 ring-indigo-500' : 'border-slate-800'}`}
                title="AMOLED Black"
              />
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition"
            title="Close Reader (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative bg-slate-950 flex flex-col items-center">
        {loading && (
          <div className="flex flex-col items-center justify-center h-96 space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-slate-400 text-sm">Extracting chapter stream via Synthetiq engine...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-8 max-w-lg text-center my-auto">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4">
              <X className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Content Unavailable</h3>
            <p className="text-sm text-slate-400 mb-6">{error}</p>
            <div className="flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 text-sm transition"
              >
                Reload
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 text-sm transition"
              >
                Return to Catalog
              </button>
            </div>
          </div>
        )}

        {/* MANGA / COMIC / IMAGE READER */}
        {!loading && !error && contentType === 'pageImages' && pages.length > 0 && (
          <div className="w-full flex flex-col items-center py-6 px-2">
            {viewMode === 'webtoon' ? (
              // Continuous Vertical Scroll
              <div
                className="flex flex-col items-center space-y-2 transition-all duration-150"
                style={{ width: `${Math.min(100, zoom)}%`, maxWidth: zoom > 100 ? `${zoom * 9}px` : '850px' }}
              >
                {pages.map((page, idx) => (
                  <div key={idx} className="relative w-full shadow-lg rounded-sm overflow-hidden bg-slate-900 group">
                    <img
                      src={getProxyImageUrl(page)}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-auto block select-none"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to direct URL if proxy failed
                        const target = e.currentTarget;
                        if (target.src.includes('/api/proxy-image')) {
                          target.src = page.url;
                        }
                      }}
                    />
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-slate-300 text-xs opacity-0 group-hover:opacity-100 transition">
                      {idx + 1} / {pages.length}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Single Page Mode
              <div className="flex flex-col items-center justify-center min-h-[75vh]">
                <div
                  className="relative shadow-2xl rounded overflow-hidden bg-slate-900"
                  style={{ width: `${zoom}%`, maxWidth: `${zoom * 8}px` }}
                >
                  <img
                    src={getProxyImageUrl(pages[currentPage - 1])}
                    alt={`Page ${currentPage}`}
                    className="w-full max-h-[82vh] object-contain mx-auto select-none"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src.includes('/api/proxy-image') && pages[currentPage - 1]) {
                        target.src = pages[currentPage - 1].url;
                      }
                    }}
                  />
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur text-slate-200 text-xs font-mono border border-slate-700 shadow-md">
                    Page {currentPage} of {pages.length}
                  </div>
                </div>

                {/* Page Navigation Controls */}
                <div className="flex items-center space-x-4 mt-6">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-lg flex items-center space-x-1.5 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous Page</span>
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={pages.length}
                    value={currentPage}
                    onChange={(e) => setCurrentPage(Number(e.target.value))}
                    className="w-36 accent-indigo-500 cursor-pointer"
                  />
                  <button
                    disabled={currentPage >= pages.length}
                    onClick={() => setCurrentPage((p) => Math.min(pages.length, p + 1))}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-lg flex items-center space-x-1.5 transition"
                  >
                    <span>Next Page</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Chapter Navigation Footer */}
            <div className="flex items-center justify-between w-full max-w-2xl mt-12 mb-8 pt-6 border-t border-slate-800 px-4">
              <button
                disabled={!prevChapter}
                onClick={() => prevChapter && onSelectChapter(prevChapter)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-200 text-sm font-medium rounded-lg flex items-center space-x-2 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous Chapter</span>
              </button>

              <span className="text-xs text-slate-500 font-mono">
                {currentIdx + 1} of {allChapters.length} Chapters
              </span>

              <button
                disabled={!nextChapter}
                onClick={() => nextChapter && onSelectChapter(nextChapter)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:pointer-events-none text-white text-sm font-medium rounded-lg flex items-center space-x-2 transition"
              >
                <span>Next Chapter</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* WEB NOVEL / TEXT READER WITH FULL ILLUSTRATIONS SUPPORT */}
        {!loading && !error && contentType === 'text' && contentData && (() => {
          const novelData = contentData.data;
          const illustrations: any[] = novelData?.illustrations || [];
          const elements: any[] = novelData?.elements || [];

          return (
            <div
              className={`w-full min-h-full py-12 px-6 sm:px-12 flex flex-col items-center transition-colors ${
                novelTheme === 'sepia'
                  ? 'bg-[#f4ecd8] text-[#3c2f1f]'
                  : novelTheme === 'light'
                  ? 'bg-white text-slate-900'
                  : novelTheme === 'black'
                  ? 'bg-black text-slate-200'
                  : 'bg-slate-950 text-slate-200'
              }`}
            >
              <div className="max-w-3xl w-full">
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-center mb-6 border-b pb-4 opacity-90 border-current/20">
                  {novelData?.title || chapter.title || 'Chapter Text'}
                </h1>

                {/* Illustrations bar if volume has illustrations */}
                {illustrations.length > 0 && (
                  <div className="flex items-center justify-between p-3.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl mb-8">
                    <div className="flex items-center space-x-2.5 text-xs text-indigo-200">
                      <ImageIcon className="w-4 h-4 text-indigo-400" />
                      <span>
                        This volume contains <strong className="text-white font-semibold">{illustrations.length} illustrations</strong> &amp; color inserts.
                      </span>
                    </div>
                    <button
                      onClick={() => setShowGallery(true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition shadow"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>View Gallery ({illustrations.length})</span>
                    </button>
                  </div>
                )}

                {/* Body Content with Inline Illustrations */}
                <div
                  className="font-serif leading-relaxed select-text space-y-4"
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
                >
                  {elements.length > 0 ? (
                    elements.map((el: any, idx: number) => {
                      if (el.type === 'heading') {
                        return (
                          <h2
                            key={idx}
                            className="text-xl sm:text-2xl font-bold font-serif text-center mt-12 mb-6 border-b border-current/20 pb-2 text-indigo-400 opacity-95"
                          >
                            {el.text}
                          </h2>
                        );
                      }
                      if (el.type === 'image') {
                        const illus = el.data;
                        const thumbUrl = illus.th ? thumbHashToDataURL(illus.th) : '';
                        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(illus.src)}&referer=${encodeURIComponent('https://lnori.com/')}`;

                        return (
                          <figure key={idx} className="my-8 flex flex-col items-center select-none group w-full">
                            <div
                              onClick={() => setSelectedIllustration(illus)}
                              className="relative max-w-full rounded-2xl overflow-hidden shadow-2xl border border-current/20 bg-black/40 cursor-pointer transition hover:border-indigo-500/60"
                              style={{ maxWidth: '640px' }}
                            >
                              <img
                                src={proxyUrl}
                                alt={illus.alt || 'Illustration'}
                                className="max-h-[75vh] w-auto mx-auto object-contain transition-transform duration-300 group-hover:scale-[1.01]"
                                style={{
                                  backgroundImage: thumbUrl ? `url("${thumbUrl}")` : undefined,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }}
                                onError={(e) => {
                                  if (thumbUrl) {
                                    e.currentTarget.src = thumbUrl;
                                  }
                                }}
                              />
                              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur text-white text-[11px] font-medium border border-slate-700 opacity-0 group-hover:opacity-100 transition flex items-center space-x-1 shadow">
                                <Eye className="w-3.5 h-3.5" />
                                <span>Zoom</span>
                              </div>
                            </div>
                            <figcaption className="mt-2.5 text-xs text-center opacity-75 flex items-center space-x-2 font-sans">
                              <span className="font-semibold text-indigo-400">Illustration #{illus.index || 1}</span>
                              {illus.alt && illus.alt !== 'Illustration' && (
                                <>
                                  <span className="opacity-40">•</span>
                                  <span className="italic">{illus.alt}</span>
                                </>
                              )}
                            </figcaption>
                          </figure>
                        );
                      }
                      return (
                        <p key={idx} className="leading-relaxed whitespace-pre-wrap">
                          {el.text}
                        </p>
                      );
                    })
                  ) : (
                    // Fallback string renderer with marker parsing
                    (typeof novelData === 'string' ? novelData : novelData?.content || '')
                      .split(/(\[\[ILLUSTRATION:[^\]]+\]\])/g)
                      .map((chunk: string, idx: number) => {
                        if (chunk.startsWith('[[ILLUSTRATION:') && chunk.endsWith(']]')) {
                          const parts = chunk.slice('[[ILLUSTRATION:'.length, -2).split('|');
                          const [src, alt, th, w, h, illusIdx] = parts;
                          const thumbUrl = th ? thumbHashToDataURL(th) : '';
                          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}&referer=${encodeURIComponent('https://lnori.com/')}`;
                          const illus = { src, alt, th, width: Number(w) || null, height: Number(h) || null, index: Number(illusIdx) || 1 };

                          return (
                            <figure key={idx} className="my-8 flex flex-col items-center select-none group w-full">
                              <div
                                onClick={() => setSelectedIllustration(illus)}
                                className="relative max-w-full rounded-2xl overflow-hidden shadow-2xl border border-current/20 bg-black/40 cursor-pointer"
                                style={{ maxWidth: '640px' }}
                              >
                                <img
                                  src={proxyUrl}
                                  alt={alt || 'Illustration'}
                                  className="max-h-[75vh] w-auto mx-auto object-contain"
                                  style={{
                                    backgroundImage: thumbUrl ? `url("${thumbUrl}")` : undefined,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                  }}
                                  onError={(e) => {
                                    if (thumbUrl) e.currentTarget.src = thumbUrl;
                                  }}
                                />
                              </div>
                              <figcaption className="mt-2 text-xs text-center opacity-75 font-sans">
                                <span className="font-semibold text-indigo-400">Illustration #{illusIdx || 1}</span>: {alt}
                              </figcaption>
                            </figure>
                          );
                        }
                        return (
                          <div key={idx} className="whitespace-pre-wrap space-y-4">
                            {chunk}
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Chapter Navigation Footer for Novel */}
                <div className="flex items-center justify-between mt-16 pt-8 border-t border-current/20">
                  <button
                    disabled={!prevChapter}
                    onClick={() => prevChapter && onSelectChapter(prevChapter)}
                    className="px-4 py-2 rounded-lg bg-black/10 hover:bg-black/20 text-sm font-medium flex items-center space-x-1.5 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous Chapter</span>
                  </button>
                  <button
                    disabled={!nextChapter}
                    onClick={() => nextChapter && onSelectChapter(nextChapter)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 text-sm font-medium flex items-center space-x-1.5 transition"
                  >
                    <span>Next Chapter</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Gallery Modal */}
              {showGallery && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-sm">
                        <ImageIcon className="w-4 h-4" />
                        <span>Volume Illustrations Gallery ({illustrations.length})</span>
                      </div>
                      <button
                        onClick={() => setShowGallery(false)}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {illustrations.map((illus, idx) => {
                        const thumbUrl = illus.th ? thumbHashToDataURL(illus.th) : '';
                        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(illus.src)}&referer=${encodeURIComponent('https://lnori.com/')}`;

                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedIllustration(illus);
                            }}
                            className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/60 cursor-pointer group transition flex flex-col"
                          >
                            <div className="aspect-[3/4] bg-slate-900 overflow-hidden relative">
                              <img
                                src={proxyUrl}
                                alt={illus.alt}
                                className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                                style={{
                                  backgroundImage: thumbUrl ? `url("${thumbUrl}")` : undefined,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }}
                                onError={(e) => {
                                  if (thumbUrl) e.currentTarget.src = thumbUrl;
                                }}
                              />
                              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
                                #{idx + 1}
                              </div>
                            </div>
                            <div className="p-2 text-xs truncate font-medium text-slate-300 text-center">
                              {illus.alt || `Illustration #${idx + 1}`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Lightbox Full Zoom View */}
              {selectedIllustration && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none"
                  onClick={() => setSelectedIllustration(null)}
                >
                  <div
                    className="relative max-w-4xl max-h-[92vh] flex flex-col items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setSelectedIllustration(null)}
                      className="absolute -top-12 right-0 p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full transition shadow-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    {(() => {
                      const thumbUrl = selectedIllustration.th ? thumbHashToDataURL(selectedIllustration.th) : '';
                      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(selectedIllustration.src)}&referer=${encodeURIComponent('https://lnori.com/')}`;
                      return (
                        <>
                          <img
                            src={proxyUrl}
                            alt={selectedIllustration.alt}
                            className="max-h-[80vh] w-auto rounded-xl shadow-2xl object-contain border border-slate-800 bg-slate-950"
                            style={{
                              backgroundImage: thumbUrl ? `url("${thumbUrl}")` : undefined,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}
                            onError={(e) => {
                              if (thumbUrl) e.currentTarget.src = thumbUrl;
                            }}
                          />
                          <div className="mt-3 text-center text-xs text-slate-300 bg-slate-900/90 backdrop-blur px-4 py-2 rounded-full border border-slate-800">
                            <span className="text-indigo-400 font-semibold">
                              Illustration #{selectedIllustration.index || 1}
                            </span>
                            : {selectedIllustration.alt}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* PUBLICATION / AUDIO / RESOURCE READER */}
        {!loading && !error && (contentType === 'publication' || contentType === 'audio') && contentData && (
          <div className="max-w-2xl w-full my-auto p-8 bg-slate-900 border border-slate-800 rounded-xl shadow-xl text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-600/20 text-indigo-400 mx-auto flex items-center justify-center mb-4">
              <Volume2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">Media &amp; Publication Resources</h2>
            <p className="text-sm text-slate-400 mb-6">{chapter.title || 'Resource'}</p>

            {contentData.data?.resources && Array.isArray(contentData.data.resources) && (
              <div className="space-y-3 text-left">
                {contentData.data.resources.map((res: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-800 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-200">{res.title || res.name || `Resource #${idx + 1}`}</div>
                      <div className="text-xs text-slate-400">{res.format || res.type || 'Media stream'}</div>
                    </div>
                    {res.url && (
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-500 font-medium transition"
                      >
                        Open Resource
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Audio direct playback if mp3 url is available */}
            {contentData.data?.url && (
              <div className="mt-6">
                <audio controls className="w-full" src={contentData.data.url} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
