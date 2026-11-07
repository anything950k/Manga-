import React, { useState, useEffect } from 'react';
import {
  Search,
  Server,
  BookOpen,
  FileText,
  Layers,
  ChevronDown,
  X,
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { IndexEntry, CatalogItem, ItemDetails, ChapterItem } from '../types';
import { ReaderModal } from './ReaderModal';

interface SearchExploreViewProps {
  sources: IndexEntry[];
  initialSlug?: string;
  onInspectCode?: (slug: string) => void;
  onRunProbe?: (slug: string) => void;
}

const PRESET_SUGGESTIONS = [
  { label: 'One Piece', targetSource: 'weebcentral' },
  { label: 'Naruto', targetSource: 'mangakatana' },
  { label: 'Solo Leveling', targetSource: 'asura-scans' },
  { label: 'Lookism', targetSource: 'atsu' },
  { label: 'Berserk', targetSource: 'mangakatana' },
  { label: 'Demon', targetSource: 'chikari' },
  { label: 'Shadow', targetSource: 'lnori' },
  { label: 'SynManga Top', targetSource: 'synthetiq-manga' },
  { label: 'MangaBuddy Top', targetSource: 'mangabuddy' },
];

export const SearchExploreView: React.FC<SearchExploreViewProps> = ({
  sources,
  initialSlug,
  onInspectCode,
  onRunProbe,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string>(initialSlug || 'weebcentral');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'pageImages' | 'text'>('all');
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');

  // Results & Loading
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Selected Item / Detail state
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [itemDetails, setItemDetails] = useState<ItemDetails | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Reader state
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null);

  // Filtered sources according to contentTypeFilter and dropdownSearch
  const availableSources = sources.filter((s) => {
    if (contentTypeFilter === 'all') return true;
    return s.contentType === contentTypeFilter;
  });

  const currentSource = sources.find((s) => (s.slug || s.id) === selectedSlug) || sources[0];

  // If contentTypeFilter changed and currentSource doesn't match, pick the first matching source
  const handleContentTypeChange = (type: 'all' | 'pageImages' | 'text') => {
    setContentTypeFilter(type);
    if (type !== 'all' && currentSource.contentType !== type) {
      const match = sources.find((s) => s.contentType === type);
      if (match) {
        const newSlug = match.slug || match.id;
        setSelectedSlug(newSlug);
        if (searchQuery.trim()) {
          handleSearch(undefined, searchQuery.trim(), newSlug);
        }
      }
    }
  };

  const handleSelectSource = (newSlug: string) => {
    setSelectedSlug(newSlug);
    setShowSourceDropdown(false);
    setDropdownSearch('');

    // Automatically trigger search on the newly switched source if there is a query
    if (searchQuery.trim()) {
      handleSearch(undefined, searchQuery.trim(), newSlug);
    }
  };

  const handleSearch = (e?: React.FormEvent, overrideQuery?: string, overrideSlug?: string) => {
    if (e) e.preventDefault();
    const q = (overrideQuery !== undefined ? overrideQuery : searchQuery).trim();
    const slug = overrideSlug || selectedSlug;

    if (!q) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setSelectedItem(null);
    setItemDetails(null);
    setChapters([]);

    fetch(`/api/sources/${slug}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const list = Array.isArray(data) ? data : data.items || [];
        setResults(list);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Search failed. Try another server or query.');
        setLoading(false);
      });
  };

  const handleSuggestionClick = (preset: { label: string; targetSource?: string }) => {
    setSearchQuery(preset.label);
    let target = selectedSlug;
    if (preset.targetSource && sources.some((s) => (s.slug || s.id) === preset.targetSource)) {
      target = preset.targetSource;
      setSelectedSlug(target);
    }
    handleSearch(undefined, preset.label, target);
  };

  const handleSelectItem = (item: CatalogItem) => {
    setSelectedItem(item);
    setDetailLoading(true);
    setDetailError(null);

    Promise.all([
      fetch(`/api/sources/${selectedSlug}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/sources/${selectedSlug}/chapters`, {
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
        setDetailError(err.message || 'Failed to extract title details');
        setDetailLoading(false);
      });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-black text-slate-100 flex flex-col min-h-full">
      {/* Search Header Container (styled exactly per screenshot) */}
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
        {/* Title & Subtitle */}
        <div className="mb-5 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Search &amp; Explore
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Search across any active Anime streaming engine or Manga provider
          </p>
        </div>

        {/* Search Input Box */}
        <form onSubmit={handleSearch} className="space-y-3.5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search anime title, manga, character..."
              className="w-full pl-12 pr-10 py-3.5 bg-[#12141a] border border-[#222530] hover:border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Source / Server Selector & Search Button Row */}
          <div className="flex items-center space-x-3">
            {/* Server / Source Dropdown Button */}
            <div className="relative flex-1 sm:max-w-xs">
              <button
                type="button"
                onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                className="w-full h-11 px-3.5 bg-[#12141a] border border-[#222530] hover:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-200 flex items-center justify-between transition group"
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <Server className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 flex-shrink-0" />
                  <span className="truncate">{currentSource?.name || 'Select Server'}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300 flex-shrink-0 ml-1" />
              </button>

              {/* Source Picker Popup */}
              {showSourceDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowSourceDropdown(false)}
                  />
                  <div className="absolute left-0 top-12 z-40 w-72 sm:w-80 bg-[#161822] border border-[#262a38] rounded-xl shadow-2xl overflow-hidden py-1">
                    <div className="p-2 border-b border-[#262a38]">
                      <input
                        type="text"
                        placeholder="Filter 47 sources..."
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#0e1017] border border-[#262a38] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-[#262a38]/40">
                      {availableSources
                        .filter((s) =>
                          s.name.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
                          s.id.toLowerCase().includes(dropdownSearch.toLowerCase())
                        )
                        .map((s) => {
                          const isSelected = (s.slug || s.id) === selectedSlug;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleSelectSource(s.slug || s.id)}
                              className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition ${
                                isSelected
                                  ? 'bg-indigo-600/20 text-indigo-400 font-semibold'
                                  : 'text-slate-300 hover:bg-[#1e2230]'
                              }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <img
                                  src={`/api/sources/${s.slug || s.id}/icon`}
                                  alt=""
                                  className="w-5 h-5 rounded object-cover bg-slate-800"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                <span className="truncate">{s.name}</span>
                              </div>
                              <span className="text-[10px] uppercase font-mono text-slate-500 ml-2">
                                {s.contentType === 'pageImages' ? 'Manga' : s.contentType === 'text' ? 'Novel' : s.contentType}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Search Action Button */}
            <button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="h-11 px-7 bg-[#3b3c9b] hover:bg-[#4748b5] disabled:opacity-40 disabled:hover:bg-[#3b3c9b] text-white font-medium text-sm rounded-xl shadow-lg transition flex items-center justify-center space-x-1.5 flex-shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <span>Search</span>
              )}
            </button>
          </div>

          {/* Module Filter Buttons (All, Anime/Manga, Novels) */}
          <div className="flex items-center space-x-1.5 pt-1">
            <button
              type="button"
              onClick={() => handleContentTypeChange('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                contentTypeFilter === 'all'
                  ? 'bg-[#2b2d3d] text-white'
                  : 'bg-[#14161f] text-slate-400 hover:text-white hover:bg-[#1f212d]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleContentTypeChange('pageImages')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                contentTypeFilter === 'pageImages'
                  ? 'bg-[#2b2d3d] text-white'
                  : 'bg-[#14161f] text-slate-400 hover:text-white hover:bg-[#1f212d]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Manga</span>
            </button>
            <button
              type="button"
              onClick={() => handleContentTypeChange('text')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                contentTypeFilter === 'text'
                  ? 'bg-[#2b2d3d] text-white'
                  : 'bg-[#14161f] text-slate-400 hover:text-white hover:bg-[#1f212d]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Novels</span>
            </button>
          </div>

          {/* Suggestions Row */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <span className="text-xs text-slate-400 mr-1">Suggestions:</span>
            {PRESET_SUGGESTIONS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSuggestionClick(preset)}
                className="px-3 py-1 bg-[#14161f] hover:bg-[#202330] border border-[#222530] text-xs text-slate-300 hover:text-white rounded-lg transition"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Main Results / Details / Initial Empty State Area */}
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* SELECTED ITEM DETAILS VIEW */}
        {selectedItem ? (
          <div className="space-y-6">
            <button
              onClick={() => setSelectedItem(null)}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 transition font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Search Results</span>
            </button>

            {/* Detail card */}
            <div className="bg-[#12141a] border border-[#222530] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row gap-6 shadow-xl">
              {selectedItem.image && (
                <img
                  src={`/api/proxy-image?url=${encodeURIComponent(selectedItem.image)}`}
                  alt={selectedItem.title}
                  className="w-40 h-56 object-cover rounded-xl bg-slate-900 shadow-md border border-[#222530] flex-shrink-0 mx-auto md:mx-0"
                  onError={(e) => {
                    e.currentTarget.src = selectedItem.image || '';
                  }}
                />
              )}
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {itemDetails?.title || selectedItem.title}
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-slate-800 text-indigo-400 rounded border border-slate-700 flex-shrink-0">
                    {currentSource.name}
                  </span>
                </div>

                {itemDetails?.author && (
                  <p className="text-xs text-slate-400">
                    <span className="text-slate-500">Author:</span> {itemDetails.author}
                  </p>
                )}

                {itemDetails?.status && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-500">Status:</span>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-[#1e2230] text-slate-300 font-medium">
                      {itemDetails.status}
                    </span>
                  </div>
                )}

                {itemDetails?.tags && itemDetails.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {itemDetails.tags.slice(0, 8).map((t, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-[#181a24] text-slate-400 border border-[#262a38]"
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

            {/* Chapters list */}
            <div className="bg-[#12141a] border border-[#222530] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#222530] pb-3">
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
                  <span>Loading chapter manifest from {currentSource.name}...</span>
                </div>
              ) : chapters.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No chapters found for this title.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
                  {chapters.map((chap) => (
                    <button
                      key={chap.id}
                      onClick={() => setActiveChapter(chap)}
                      className="p-3 bg-[#0e1017] hover:bg-[#1a1e2c] border border-[#222530] hover:border-indigo-500/40 rounded-xl text-left flex items-center justify-between group transition"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-medium text-slate-200 group-hover:text-indigo-300 truncate">
                          {chap.title || `Chapter ${chap.number ?? ''}`}
                        </div>
                        {chap.date && <div className="text-[10px] text-slate-500 mt-0.5">{chap.date}</div>}
                      </div>
                      <span className="px-2 py-1 text-[10px] font-medium bg-[#1e2230] text-slate-300 group-hover:bg-indigo-600 group-hover:text-white rounded-md transition flex items-center space-x-1 flex-shrink-0">
                        <span>Read</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : loading ? (
          /* LOADING STATE */
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 className="w-9 h-9 text-indigo-500 animate-spin" />
            <p className="text-sm text-slate-400">Searching {currentSource.name} for &quot;{searchQuery}&quot;...</p>
          </div>
        ) : error ? (
          /* ERROR STATE */
          <div className="p-6 bg-[#16131c] border border-rose-500/20 text-rose-300 rounded-2xl max-w-lg mx-auto text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h4 className="text-sm font-semibold">Search Unsuccessful</h4>
            <p className="text-xs text-slate-400">{error}</p>
            <p className="text-xs text-slate-500">
              Try selecting a different source module (e.g. MangaKatana, WeebCentral, NovelFire) or modifying your search query.
            </p>
          </div>
        ) : hasSearched && results.length === 0 ? (
          /* NO RESULTS */
          <div className="text-center py-24 text-slate-500 space-y-2">
            <Search className="w-10 h-10 text-slate-700 mx-auto" />
            <h3 className="text-sm font-medium text-slate-300">No results found on {currentSource.name}</h3>
            <p className="text-xs text-slate-500">
              Try searching with another keyword or pick a different source provider above.
            </p>
          </div>
        ) : hasSearched && results.length > 0 ? (
          /* SEARCH RESULTS GRID */
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#222530] pb-2 text-xs text-slate-400">
              <span>Found {results.length} results on <strong className="text-white">{currentSource.name}</strong></span>
              <span className="font-mono text-slate-500">Query: {searchQuery}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {results.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className="group bg-[#12141a] border border-[#222530] hover:border-indigo-500/50 rounded-xl overflow-hidden cursor-pointer transition flex flex-col shadow hover:shadow-indigo-500/10 hover:-translate-y-0.5"
                >
                  <div className="aspect-[3/4] w-full bg-[#0e1017] relative overflow-hidden">
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
                      <div className="w-full h-full flex items-center justify-center text-slate-700">
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
        ) : (
          /* INITIAL EMPTY STATE (Identical to Screenshot!) */
          <div className="flex flex-col items-center justify-center py-28 sm:py-36 text-center space-y-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-slate-600">
              <Search className="w-14 h-14 stroke-[1.5]" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Explore Anime &amp; Manga
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed px-4">
                Type any anime or manga title in the search bar above, or click one of the suggestion tags to begin.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Reader Modal */}
      {activeChapter && selectedItem && (
        <ReaderModal
          slug={selectedSlug}
          sourceBaseUrl={currentSource?.baseURL || ''}
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
