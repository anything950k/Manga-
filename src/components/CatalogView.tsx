import React, { useState, useEffect } from 'react';
import {
  Search,
  BookOpen,
  Filter,
  ExternalLink,
  Play,
  Layers,
  ChevronRight,
  Loader2,
  AlertCircle,
  Tag,
  Calendar,
  Sparkles,
  ArrowLeft,
  FileCode,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { IndexEntry, CatalogItem, DiscoverySection, ItemDetails, ChapterItem } from '../types';
import { ReaderModal } from './ReaderModal';

interface CatalogViewProps {
  sources: IndexEntry[];
  onInspectCode: (slug: string) => void;
  onRunProbe: (slug: string) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  sources,
  onInspectCode,
  onRunProbe,
}) => {
  // Source filtering state
  const [sourceSearch, setSourceSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSlug, setSelectedSlug] = useState<string>(sources[0]?.slug || 'weebcentral');

  // Source active data state
  const [activeTab, setActiveTab] = useState<'discovery' | 'search'>('discovery');
  const [discoverySections, setDiscoverySections] = useState<DiscoverySection[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Detail / Chapter state
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [itemDetails, setItemDetails] = useState<ItemDetails | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Reader modal state
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null);

  const currentSource = sources.find((s) => s.slug === selectedSlug || s.id === selectedSlug) || sources[0];

  // Filter sources
  const filteredSources = sources.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(sourceSearch.toLowerCase()) ||
      s.id.toLowerCase().includes(sourceSearch.toLowerCase()) ||
      (s.slug && s.slug.toLowerCase().includes(sourceSearch.toLowerCase()));
    const matchesType = selectedType === 'all' || s.contentType === selectedType;
    return matchesSearch && matchesType;
  });

  // Load discovery when source changes
  useEffect(() => {
    if (!currentSource?.slug) return;
    setDiscoveryLoading(true);
    setDiscoveryError(null);
    setSelectedItem(null);
    setItemDetails(null);
    setChapters([]);

    fetch(`/api/sources/${currentSource.slug}/discovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        if (data.sections && Array.isArray(data.sections)) {
          setDiscoverySections(data.sections);
        } else if (data.items && Array.isArray(data.items)) {
          setDiscoverySections([{ id: 'feed', title: 'Feed', items: data.items }]);
        } else {
          setDiscoverySections([]);
        }
        setDiscoveryLoading(false);
      })
      .catch((err) => {
        setDiscoveryError(err.message || 'Discovery not available for this source.');
        setDiscoveryLoading(false);
      });
  }, [currentSource?.slug]);

  // Handle Search
  const handlePerformSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentSource?.slug || !searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchError(null);
    setActiveTab('search');

    fetch(`/api/sources/${currentSource.slug}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const list = Array.isArray(data) ? data : data.items || [];
        setSearchResults(list);
        setSearchLoading(false);
      })
      .catch((err) => {
        setSearchError(err.message || 'Search request failed.');
        setSearchLoading(false);
      });
  };

  // Load item details & chapters
  const handleSelectItem = (item: CatalogItem) => {
    setSelectedItem(item);
    setDetailLoading(true);
    setDetailError(null);

    Promise.all([
      fetch(`/api/sources/${currentSource.slug}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/sources/${currentSource.slug}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([detailsData, chaptersData]) => {
        if (detailsData) {
          setItemDetails(detailsData);
        } else {
          setItemDetails({
            id: item.id,
            title: item.title,
            image: item.image,
          });
        }

        const rawChapters = Array.isArray(chaptersData)
          ? chaptersData
          : chaptersData?.chapters || chaptersData?.items || [];
        setChapters(rawChapters);
        setDetailLoading(false);
      })
      .catch((err) => {
        setDetailError(err.message || 'Failed to fetch details');
        setDetailLoading(false);
      });
  };

  const getContentTypeBadge = (type: string) => {
    switch (type) {
      case 'pageImages':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">Manga / Comics</span>;
      case 'text':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">Web Novel</span>;
      case 'publication':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">Publication</span>;
      case 'audio':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">Audiobook</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-700 text-slate-300 rounded">{type}</span>;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* LEFT SIDEBAR: Source Selector */}
      <aside className="w-full lg:w-80 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-auto lg:h-full max-h-[40vh] lg:max-h-full">
        {/* Source Search & Filters */}
        <div className="p-3 border-b border-slate-800 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search 47 sources..."
              value={sourceSearch}
              onChange={(e) => setSourceSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-[11px]">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-2 py-1 rounded whitespace-nowrap transition ${
                selectedType === 'all' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              All ({sources.length})
            </button>
            <button
              onClick={() => setSelectedType('pageImages')}
              className={`px-2 py-1 rounded whitespace-nowrap transition ${
                selectedType === 'pageImages' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Manga
            </button>
            <button
              onClick={() => setSelectedType('text')}
              className={`px-2 py-1 rounded whitespace-nowrap transition ${
                selectedType === 'text' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Novels
            </button>
            <button
              onClick={() => setSelectedType('publication')}
              className={`px-2 py-1 rounded whitespace-nowrap transition ${
                selectedType === 'publication' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Books
            </button>
          </div>
        </div>

        {/* Source List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {filteredSources.map((s) => {
            const isSelected = (s.slug || s.id) === selectedSlug;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSlug(s.slug || s.id)}
                className={`w-full text-left p-3 flex items-center space-x-3 transition ${
                  isSelected ? 'bg-indigo-600/15 border-l-2 border-indigo-500' : 'hover:bg-slate-800/50'
                }`}
              >
                <img
                  src={`/api/sources/${s.slug || s.id}/icon`}
                  alt={s.name}
                  className="w-9 h-9 rounded-lg object-cover bg-slate-800 border border-slate-700/80 flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="%234f46e5" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 truncate">{s.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">v{s.version}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 mt-1">
                    {getContentTypeBadge(s.contentType)}
                    <span className="text-[10px] text-slate-400 uppercase font-mono">{s.language || 'en'}</span>
                    {s.releaseTrack && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                        {s.releaseTrack}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* RIGHT MAIN AREA: Source Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {currentSource ? (
          <>
            {/* Source Header Banner */}
            <div className="p-4 sm:p-5 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <img
                  src={`/api/sources/${currentSource.slug || currentSource.id}/icon`}
                  alt={currentSource.name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-700 bg-slate-800 shadow"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-white">{currentSource.name}</h2>
                    <span className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-indigo-400 rounded-md border border-slate-700">
                      v{currentSource.version}
                    </span>
                    {getContentTypeBadge(currentSource.contentType)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    ID: {currentSource.id} &bull; Manifest: {currentSource.manifest.path}
                  </p>
                </div>
              </div>

              {/* Source Quick Actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onRunProbe(currentSource.slug || currentSource.id)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 shadow-sm transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Probe</span>
                </button>
                <button
                  onClick={() => onInspectCode(currentSource.slug || currentSource.id)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Inspect Code</span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs & Search Bar */}
            <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => {
                    setActiveTab('discovery');
                    setSelectedItem(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
                    activeTab === 'discovery' && !selectedItem
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Discovery Feed</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('search');
                    setSelectedItem(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
                    activeTab === 'search' && !selectedItem
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Catalog Search</span>
                </button>
                {selectedItem && (
                  <div className="flex items-center space-x-1">
                    <span className="text-slate-600 text-xs">/</span>
                    <span className="px-2.5 py-1 text-xs text-slate-300 font-semibold bg-slate-800 rounded">
                      {selectedItem.title}
                    </span>
                  </div>
                )}
              </div>

              {/* Source-specific Search Form */}
              <form onSubmit={handlePerformSearch} className="flex items-center space-x-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder={`Search ${currentSource.name}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchLoading || !searchQuery.trim()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition flex items-center space-x-1"
                >
                  {searchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>Search</span>}
                </button>
              </form>
            </div>

            {/* Content Feed or Details */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
              {/* ITEM DETAILS & CHAPTER LIST VIEW */}
              {selectedItem ? (
                <div className="max-w-4xl mx-auto space-y-6">
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 transition font-medium"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to {activeTab === 'discovery' ? 'Discovery' : 'Search Results'}</span>
                  </button>

                  {/* Header info */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row gap-6">
                    {selectedItem.image && (
                      <img
                        src={`/api/proxy-image?url=${encodeURIComponent(selectedItem.image)}`}
                        alt={selectedItem.title}
                        className="w-36 h-52 object-cover rounded-xl bg-slate-800 shadow-md border border-slate-800 flex-shrink-0 mx-auto md:mx-0"
                        onError={(e) => {
                          e.currentTarget.src = selectedItem.image || '';
                        }}
                      />
                    )}
                    <div className="flex-1 space-y-3">
                      <h1 className="text-2xl font-bold text-white">{itemDetails?.title || selectedItem.title}</h1>

                      {itemDetails?.author && (
                        <p className="text-xs text-slate-400">
                          <span className="text-slate-500">Author:</span> {itemDetails.author}
                        </p>
                      )}

                      {itemDetails?.status && (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-500">Status:</span>
                          <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 font-medium border border-slate-700">
                            {itemDetails.status}
                          </span>
                        </div>
                      )}

                      {itemDetails?.tags && itemDetails.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {itemDetails.tags.slice(0, 8).map((t, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-slate-300 leading-relaxed pt-2 line-clamp-4">
                        {itemDetails?.synopsis || itemDetails?.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>

                  {/* Chapter List */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center space-x-2">
                        <BookOpen className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-sm font-semibold text-slate-200">
                          Available Chapters ({chapters.length})
                        </h3>
                      </div>
                      <span className="text-xs font-mono text-slate-500">Live source extraction</span>
                    </div>

                    {detailLoading ? (
                      <div className="flex items-center justify-center py-12 space-x-2 text-slate-400 text-xs">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                        <span>Extracting chapters from {currentSource.name}...</span>
                      </div>
                    ) : chapters.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs">
                        No chapters extracted for this title or single-issue content.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
                        {chapters.map((chap) => (
                          <button
                            key={chap.id}
                            onClick={() => setActiveChapter(chap)}
                            className="p-3 bg-slate-950 hover:bg-indigo-600/10 border border-slate-800 hover:border-indigo-500/40 rounded-xl text-left flex items-center justify-between group transition"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-medium text-slate-200 group-hover:text-indigo-300 truncate">
                                {chap.title || `Chapter ${chap.number ?? ''}`}
                              </div>
                              {chap.date && <div className="text-[10px] text-slate-500 mt-0.5">{chap.date}</div>}
                            </div>
                            <span className="px-2 py-1 text-[10px] font-medium bg-slate-800 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white rounded-md transition flex items-center space-x-1 flex-shrink-0">
                              <span>Read</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === 'discovery' ? (
                /* DISCOVERY FEED */
                <div className="space-y-8">
                  {discoveryLoading && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-xs text-slate-400">Loading discovery feed from {currentSource.name}...</p>
                    </div>
                  )}

                  {discoveryError && (
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl max-w-lg mx-auto text-center space-y-3">
                      <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                      <h4 className="text-sm font-semibold text-slate-200">Discovery Home Not Supported</h4>
                      <p className="text-xs text-slate-400">
                        {discoveryError}. This module uses direct catalog search or title queries.
                      </p>
                      <button
                        onClick={() => {
                          setActiveTab('search');
                          setSearchQuery('a');
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition"
                      >
                        Try Catalog Search
                      </button>
                    </div>
                  )}

                  {!discoveryLoading &&
                    !discoveryError &&
                    discoverySections.map((sec) => (
                      <section key={sec.id} className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span>{sec.title || sec.id}</span>
                          </h3>
                          <span className="text-xs text-slate-500 font-mono">{(sec.items || []).length} titles</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                          {(sec.items || []).map((item) => (
                            <div
                              key={item.id}
                              onClick={() => handleSelectItem(item)}
                              className="group bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 rounded-xl overflow-hidden cursor-pointer transition flex flex-col shadow-sm hover:shadow-indigo-500/5 hover:-translate-y-0.5"
                            >
                              <div className="aspect-[3/4] w-full bg-slate-800 relative overflow-hidden">
                                {item.image ? (
                                  <img
                                    src={`/api/proxy-image?url=${encodeURIComponent(item.image)}`}
                                    alt={item.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.src = item.image || '';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                                    <BookOpen className="w-8 h-8 opacity-40" />
                                  </div>
                                )}
                                {item.badge && (
                                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white uppercase shadow">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <div className="p-2.5 flex-1 flex flex-col justify-between">
                                <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-400 line-clamp-2 transition leading-tight">
                                  {item.title}
                                </h4>
                                {item.latestChapter && (
                                  <span className="text-[10px] text-slate-500 truncate mt-1">
                                    {item.latestChapter}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                </div>
              ) : (
                /* SEARCH RESULTS */
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-sm font-semibold text-slate-200">
                      Search Results for &quot;{searchQuery}&quot; ({searchResults.length})
                    </h3>
                  </div>

                  {searchLoading && (
                    <div className="flex flex-col items-center justify-center py-20 space-x-2">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-xs text-slate-400 mt-2">Searching {currentSource.name}...</p>
                    </div>
                  )}

                  {searchError && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                      {searchError}
                    </div>
                  )}

                  {!searchLoading && searchResults.length === 0 && !searchError && (
                    <div className="text-center py-16 text-slate-500 text-xs">
                      No titles found. Try another search query or check the discovery feed.
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className="group bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 rounded-xl overflow-hidden cursor-pointer transition flex flex-col shadow-sm hover:shadow-indigo-500/5 hover:-translate-y-0.5"
                      >
                        <div className="aspect-[3/4] w-full bg-slate-800 relative overflow-hidden">
                          {item.image ? (
                            <img
                              src={`/api/proxy-image?url=${encodeURIComponent(item.image)}`}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.src = item.image || '';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <BookOpen className="w-8 h-8 opacity-40" />
                            </div>
                          )}
                        </div>
                        <div className="p-2.5 flex-1 flex flex-col justify-between">
                          <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-400 line-clamp-2 transition leading-tight">
                            {item.title}
                          </h4>
                          {item.latestChapter && (
                            <span className="text-[10px] text-slate-500 truncate mt-1">
                              {item.latestChapter}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Select a source to browse content
          </div>
        )}
      </main>

      {/* Chapter Reader Modal */}
      {activeChapter && selectedItem && (
        <ReaderModal
          slug={currentSource.slug || currentSource.id}
          sourceBaseUrl=""
          itemTitle={selectedItem.title}
          chapter={activeChapter}
          allChapters={chapters}
          contentType={currentSource.contentType}
          onClose={() => setActiveChapter(null)}
          onSelectChapter={(chap) => setActiveChapter(chap)}
        />
      )}
    </div>
  );
};
