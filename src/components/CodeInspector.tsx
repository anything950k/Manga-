import React, { useState, useEffect } from 'react';
import {
  FileCode,
  FileText,
  Layers,
  Copy,
  Check,
  Search,
  ExternalLink,
  ShieldCheck,
  Globe,
  Tag,
  Key,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { IndexEntry, ModuleManifest } from '../types';

interface CodeInspectorProps {
  sources: IndexEntry[];
  initialSlug?: string;
}

export const CodeInspector: React.FC<CodeInspectorProps> = ({
  sources,
  initialSlug,
}) => {
  const [selectedSlug, setSelectedSlug] = useState<string>(initialSlug || 'xkcd');
  const [activeTab, setActiveTab] = useState<'manifest' | 'code' | 'fixtures'>('manifest');

  const [manifest, setManifest] = useState<ModuleManifest | null>(null);
  const [code, setCode] = useState<string>('');
  const [fixtures, setFixtures] = useState<string[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<string | null>(null);
  const [fixtureContent, setFixtureContent] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [codeSearch, setCodeSearch] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialSlug) setSelectedSlug(initialSlug);
  }, [initialSlug]);

  useEffect(() => {
    if (!selectedSlug) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/sources/${selectedSlug}`).then((r) => r.json()),
      fetch(`/api/sources/${selectedSlug}/code`).then((r) => (r.ok ? r.text() : '')),
      fetch(`/api/sources/${selectedSlug}/fixtures`).then((r) => (r.ok ? r.json() : { fixtures: [] })),
    ])
      .then(([sourceData, codeText, fixtureData]) => {
        setManifest(sourceData.manifest || null);
        setCode(codeText);
        setFixtures(fixtureData.fixtures || []);
        setSelectedFixture(null);
        setFixtureContent('');
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [selectedSlug]);

  const loadFixture = (filename: string) => {
    setSelectedFixture(filename);
    fetch(`/api/sources/${selectedSlug}/fixtures/${filename}`)
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => setFixtureContent(text));
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentSource = sources.find((s) => s.slug === selectedSlug || s.id === selectedSlug);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Source Picker and Navigation */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="bg-slate-950 text-xs font-medium text-slate-200 border border-slate-800 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {sources.map((s) => (
              <option key={s.id} value={s.slug || s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </select>

          <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setActiveTab('manifest')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition flex items-center space-x-1.5 ${
                activeTab === 'manifest' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Manifest Contract</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition flex items-center space-x-1.5 ${
                activeTab === 'code' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>index.js Source</span>
            </button>
            <button
              onClick={() => setActiveTab('fixtures')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition flex items-center space-x-1.5 ${
                activeTab === 'fixtures' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Fixtures ({fixtures.length})</span>
            </button>
          </div>
        </div>

        {activeTab === 'code' && (
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Find in code..."
                value={codeSearch}
                onChange={(e) => setCodeSearch(e.target.value)}
                className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono w-44"
              />
            </div>
            <button
              onClick={() => copyText(code)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 flex items-center space-x-1 transition border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Inspection View */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
        {loading ? (
          <div className="flex items-center justify-center h-64 space-x-2 text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span>Loading module files...</span>
          </div>
        ) : activeTab === 'manifest' ? (
          /* MANIFEST CONTRACT VIEW */
          <div className="max-w-4xl mx-auto space-y-6">
            {manifest ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-mono">Contract Version</span>
                    <div className="text-base font-bold text-white font-mono">
                      v{manifest.contractVersion}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-mono">Content Type</span>
                    <div className="text-base font-bold text-indigo-400 font-mono">
                      {manifest.contentType}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-mono">Track &amp; Status</span>
                    <div className="text-base font-bold text-slate-200 capitalize font-mono">
                      {manifest.releaseTrack}
                    </div>
                  </div>
                </div>

                {/* Capabilities and Hosts */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono flex items-center space-x-1.5">
                      <Key className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Declared Module Capabilities</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {manifest.capabilities?.map((cap, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 text-xs rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono flex items-center space-x-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Allowlisted Network Hosts ({manifest.hosts?.length || 0})</span>
                    </h4>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {manifest.hosts?.map((host, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-[11px] rounded bg-slate-950 text-slate-300 border border-slate-800 font-mono"
                        >
                          {host}
                        </span>
                      ))}
                    </div>
                  </div>

                  {manifest.baseURL && (
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500">Base Universal URL:</span>
                      <a
                        href={manifest.baseURL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:underline flex items-center space-x-1"
                      >
                        <span>{manifest.baseURL}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Raw Manifest JSON */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-400">manifest.json</span>
                    <button
                      onClick={() => copyText(JSON.stringify(manifest, null, 2))}
                      className="text-xs text-slate-500 hover:text-white flex items-center space-x-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-950 rounded-lg overflow-x-auto text-xs font-mono text-slate-300">
                    {JSON.stringify(manifest, null, 2)}
                  </pre>
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs">No manifest found for this module.</div>
            )}
          </div>
        ) : activeTab === 'code' ? (
          /* CODE VIEWER */
          <div className="max-w-5xl mx-auto bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-lg">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>modules/{selectedSlug}/index.js</span>
              <span>{code.split('\n').length} lines &bull; {(code.length / 1024).toFixed(1)} KB</span>
            </div>
            <pre className="p-4 bg-slate-950 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed max-h-[75vh]">
              <code>
                {code.split('\n').map((line, idx) => {
                  const isHighlighted = codeSearch && line.toLowerCase().includes(codeSearch.toLowerCase());
                  return (
                    <div
                      key={idx}
                      className={`table-row ${isHighlighted ? 'bg-amber-500/20 text-amber-200' : ''}`}
                    >
                      <span className="table-cell pr-4 text-right text-slate-600 select-none text-[11px] w-12">
                        {idx + 1}
                      </span>
                      <span className="table-cell">{line}</span>
                    </div>
                  );
                })}
              </code>
            </pre>
          </div>
        ) : (
          /* FIXTURES VIEWER */
          <div className="max-w-4xl mx-auto space-y-4">
            <h3 className="text-sm font-bold text-slate-200 font-mono">
              Recorded Test Fixtures for {selectedSlug} ({fixtures.length})
            </h3>
            {fixtures.length === 0 ? (
              <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                No offline fixtures recorded for this module.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1 space-y-1">
                  {fixtures.map((file) => (
                    <button
                      key={file}
                      onClick={() => loadFixture(file)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition flex items-center space-x-2 ${
                        selectedFixture === file
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 opacity-70" />
                      <span className="truncate">{file}</span>
                    </button>
                  ))}
                </div>

                <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-4 min-h-[300px]">
                  {selectedFixture ? (
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-mono text-slate-400">
                        <span>{selectedFixture}</span>
                        <button
                          onClick={() => copyText(fixtureContent)}
                          className="hover:text-white flex items-center space-x-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                      <pre className="p-3 bg-slate-950 rounded text-xs font-mono text-slate-300 overflow-x-auto max-h-[500px]">
                        {fixtureContent}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                      Select a fixture on the left to inspect its recorded HTML or JSON payload.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
