import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Zap,
  FileCode,
  ShieldCheck,
  Server,
  Layers,
  Sparkles,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { IndexEntry } from './types';
import { SearchExploreView } from './components/SearchExploreView';
import { CatalogView } from './components/CatalogView';
import { ProbeRunner } from './components/ProbeRunner';
import { CodeInspector } from './components/CodeInspector';
import { RepoAudit } from './components/RepoAudit';

export default function App() {
  const [sources, setSources] = useState<IndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default to the requested 'search' tab
  const [activeTab, setActiveTab] = useState<'search' | 'catalog' | 'probe' | 'code' | 'audit'>('search');
  const [targetSlug, setTargetSlug] = useState<string>('weebcentral');

  const loadSources = () => {
    setLoading(true);
    setError(null);
    fetch('/api/sources')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data && Array.isArray(data.modules)) {
          setSources(data.modules);
          if (data.modules.length > 0) {
            setTargetSlug(data.modules[0].slug || data.modules[0].id);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load module repository index.');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleInspectCode = (slug: string) => {
    setTargetSlug(slug);
    setActiveTab('code');
  };

  const handleRunProbe = (slug: string) => {
    setTargetSlug(slug);
    setActiveTab('probe');
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-slate-100 space-y-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <BookOpen className="w-7 h-7 text-indigo-400 animate-pulse" />
          </div>
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin absolute -bottom-1 -right-1" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-sm font-bold text-slate-200">Synthetiq Manga Sources</h2>
          <p className="text-xs text-slate-500">Mounting 8 source modules and Node VM sandbox...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-slate-100 p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4">
          <Server className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-white mb-2">Repository Initialization Error</h2>
        <p className="text-xs text-slate-400 max-w-md mb-6">{error}</p>
        <button
          onClick={loadSources}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black font-sans antialiased text-slate-100">
      {/* Top Application Navbar */}
      <header className="h-14 bg-[#0d0f15] border-b border-[#222530] flex items-center justify-between px-4 sm:px-6 z-20 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/30">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight text-white">Synthetiq Sources</span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {sources.length} Active Modules
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden md:block">
              Universal Manga &amp; Web Novel Source Engine
            </span>
          </div>
        </div>

        {/* View Mode Navigation Tabs */}
        <nav className="flex items-center bg-[#141620] p-1 rounded-xl border border-[#222530] space-x-0.5">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'search'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search &amp; Explore</span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'catalog'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Catalog &amp; Discovery</span>
          </button>

          <button
            onClick={() => setActiveTab('probe')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'probe'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Testbench</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'code'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Code &amp; Manifests</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Audit</span>
          </button>
        </nav>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'search' && (
          <SearchExploreView
            sources={sources}
            initialSlug={targetSlug}
            onInspectCode={handleInspectCode}
            onRunProbe={handleRunProbe}
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogView
            sources={sources}
            onInspectCode={handleInspectCode}
            onRunProbe={handleRunProbe}
          />
        )}

        {activeTab === 'probe' && (
          <ProbeRunner
            sources={sources}
            initialSlug={targetSlug}
            onInspectCode={handleInspectCode}
          />
        )}

        {activeTab === 'code' && (
          <CodeInspector
            sources={sources}
            initialSlug={targetSlug}
          />
        )}

        {activeTab === 'audit' && (
          <RepoAudit sources={sources} />
        )}
      </div>
    </div>
  );
}
