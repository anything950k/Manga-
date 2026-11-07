import React, { useState, useEffect } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Activity,
  Zap,
  Filter,
  Copy,
  Check,
  RotateCw,
  Sliders,
  ChevronDown,
  ChevronRight,
  Shield,
  Layers,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { IndexEntry, ProbeReport, ProbeStage } from '../types';

interface ProbeRunnerProps {
  sources: IndexEntry[];
  initialSlug?: string;
  onInspectCode: (slug: string) => void;
}

export const ProbeRunner: React.FC<ProbeRunnerProps> = ({
  sources,
  initialSlug,
  onInspectCode,
}) => {
  const [selectedSlug, setSelectedSlug] = useState<string>(initialSlug || 'xkcd');
  const [mode, setMode] = useState<'live' | 'fixtures'>('live');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<ProbeReport | null>(null);
  const [rawOutput, setRawOutput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({
    load: true,
    discoveryHome: true,
    searchResults: true,
    extractChapters: true,
    extractImages: true,
    extractText: true,
  });

  // Sync initial slug
  useEffect(() => {
    if (initialSlug) setSelectedSlug(initialSlug);
  }, [initialSlug]);

  // Load module default query
  useEffect(() => {
    fetch(`/api/sources/${selectedSlug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.defaultQuery) setQuery(data.defaultQuery);
      })
      .catch(() => {});
  }, [selectedSlug]);

  const runProbe = async () => {
    setIsRunning(true);
    setErrorMessage(null);
    setReport(null);
    setRawOutput('');

    try {
      const res = await fetch('/api/run-probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: selectedSlug,
          mode,
          query: query.trim() || undefined,
          limit,
        }),
      });

      const data = await res.json();
      setRawOutput(data.rawOutput || data.stderr || '');

      if (data.report) {
        setReport(data.report);
      } else if (data.error) {
        setErrorMessage(data.error);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Execution error');
    } finally {
      setIsRunning(false);
    }
  };

  const copyLog = () => {
    navigator.clipboard.writeText(rawOutput || JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentSource = sources.find((s) => s.slug === selectedSlug || s.id === selectedSlug);

  const toggleStage = (stageName: string) => {
    setExpandedStages((prev) => ({
      ...prev,
      [stageName]: !prev[stageName],
    }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Configuration Controls */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Source Picker */}
          <div>
            <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
              Target Module Source
            </label>
            <select
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="bg-slate-950 text-xs font-medium text-slate-200 border border-slate-800 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {sources.map((s) => (
                <option key={s.id} value={s.slug || s.id}>
                  {s.name} ({s.contentType})
                </option>
              ))}
            </select>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">Execution Mode</label>
            <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800">
              <button
                onClick={() => setMode('live')}
                className={`px-3 py-1 text-xs rounded-md transition font-medium ${
                  mode === 'live' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Live Network
              </button>
              <button
                onClick={() => setMode('fixtures')}
                className={`px-3 py-1 text-xs rounded-md transition font-medium ${
                  mode === 'fixtures' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Recorded Fixtures
              </button>
            </div>
          </div>

          {/* Query Input */}
          <div>
            <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">Probe Query</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. one piece, colony, a"
              className="w-36 sm:w-44 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>

          {/* Limit */}
          <div>
            <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">Sample Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-slate-950 text-xs font-mono text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value={1}>1 item</option>
              <option value={2}>2 items</option>
              <option value={3}>3 items</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onInspectCode(selectedSlug)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center space-x-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>View Source</span>
          </button>
          <button
            onClick={runProbe}
            disabled={isRunning}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-md flex items-center space-x-2 transition"
          >
            {isRunning ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Probing VM Sandbox...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Probe</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Probe Workspace */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Pipeline Status */}
        <div className="lg:col-span-7 space-y-5">
          {/* Status Header Banner */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src={`/api/sources/${selectedSlug}/icon`}
                alt={selectedSlug}
                className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-slate-700"
              />
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>{currentSource?.name || selectedSlug}</span>
                  <span className="text-xs font-mono text-slate-500">v{currentSource?.version}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Target runtime: Node VM sandbox &bull; Mode: {mode.toUpperCase()}
                </p>
              </div>
            </div>

            {report ? (
              <div
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 ${
                  report.passed
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {report.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                <span>{report.passed ? 'PROBE PASSED' : 'PROBE FAILED'}</span>
              </div>
            ) : isRunning ? (
              <div className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-mono flex items-center space-x-1.5">
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </div>
            ) : (
              <span className="text-xs font-mono text-slate-500">Awaiting execution</span>
            )}
          </div>

          {/* Timing summary cards */}
          {report && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Total Duration</span>
                <div className="text-base font-bold text-slate-100 font-mono mt-0.5">
                  {report.durationMs}ms
                </div>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Load &amp; VM Bind</span>
                <div className="text-base font-bold text-slate-100 font-mono mt-0.5">
                  {report.timingsMs.load || report.stages.load?.durationMs || 0}ms
                </div>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Discovery Time</span>
                <div className="text-base font-bold text-slate-100 font-mono mt-0.5">
                  {report.timingsMs.discoveryHome || report.stages.discoveryHome?.durationMs || 0}ms
                </div>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Search &amp; Delivery</span>
                <div className="text-base font-bold text-slate-100 font-mono mt-0.5">
                  {report.timingsMs.searchResults || report.stages.searchResults?.durationMs || 0}ms
                </div>
              </div>
            </div>
          )}

          {/* Pipeline Stages */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Synthetiq Source Pipeline Execution
            </h4>

            {report ? (
              <div className="space-y-2.5">
                {/* STAGE: load */}
                {report.stages.load && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleStage('load')}
                    >
                      <div className="flex items-center space-x-2.5">
                        {report.stages.load.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span className="text-xs font-bold text-slate-200">1. Script Load &amp; VM Handlers</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-slate-400">{report.stages.load.durationMs}ms</span>
                        {expandedStages.load ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                      </div>
                    </div>
                    {expandedStages.load && (
                      <div className="pl-6 pt-1 text-xs text-slate-400 space-y-1">
                        <div>Terminal handler: <span className="font-mono text-indigo-400 font-bold">{report.stages.load.terminal}</span></div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(report.stages.load.handlers || []).map((h, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STAGE: discoveryHome */}
                {report.stages.discoveryHome && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleStage('discoveryHome')}
                    >
                      <div className="flex items-center space-x-2.5">
                        {report.stages.discoveryHome.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span className="text-xs font-bold text-slate-200">2. Discovery Feed (discoveryHome)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-slate-400">{report.stages.discoveryHome.durationMs}ms</span>
                        {expandedStages.discoveryHome ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                      </div>
                    </div>
                    {expandedStages.discoveryHome && (
                      <div className="pl-6 pt-1 text-xs text-slate-400 space-y-1">
                        {report.stages.discoveryHome.sections && (
                          <div className="space-y-1">
                            {report.stages.discoveryHome.sections.map((sec, i) => (
                              <div key={i} className="flex items-center justify-between text-slate-300 font-mono text-[11px]">
                                <span>Section: {sec.title}</span>
                                <span className="text-indigo-400 font-semibold">{sec.count} items</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {report.stages.discoveryHome.error && (
                          <div className="text-rose-400 font-mono text-[11px]">{report.stages.discoveryHome.error}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* STAGE: searchResults */}
                {report.stages.searchResults && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleStage('searchResults')}
                    >
                      <div className="flex items-center space-x-2.5">
                        {report.stages.searchResults.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span className="text-xs font-bold text-slate-200">3. Search Extraction (searchResults)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-slate-400">{report.stages.searchResults.durationMs}ms</span>
                        {expandedStages.searchResults ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                      </div>
                    </div>
                    {expandedStages.searchResults && (
                      <div className="pl-6 pt-1 text-xs text-slate-400 space-y-1.5">
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span>Matched titles:</span>
                          <span className="text-indigo-400 font-semibold">{report.stages.searchResults.count}</span>
                        </div>
                        {report.stages.searchResults.sample && (
                          <div className="space-y-1 pt-1">
                            {report.stages.searchResults.sample.map((s: any, idx: number) => (
                              <div key={idx} className="p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-slate-200 truncate">{s.title}</span>
                                <span className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">{s.id}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* STAGE: extractChapters */}
                {report.stages.extractChapters && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleStage('extractChapters')}
                    >
                      <div className="flex items-center space-x-2.5">
                        {report.stages.extractChapters.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span className="text-xs font-bold text-slate-200">4. Chapter Schema (extractChapters)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-slate-400">{report.stages.extractChapters.durationMs}ms</span>
                        {expandedStages.extractChapters ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                      </div>
                    </div>
                    {expandedStages.extractChapters && (
                      <div className="pl-6 pt-1 text-xs text-slate-400 space-y-1.5">
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span>Chapter count parsed:</span>
                          <span className="text-indigo-400 font-semibold">{report.stages.extractChapters.count} chapters</span>
                        </div>
                        {report.stages.extractChapters.sample && (
                          <div className="space-y-1 pt-1">
                            {report.stages.extractChapters.sample.map((chap: any, idx: number) => (
                              <div key={idx} className="p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-slate-200 truncate">{chap.title || `Chapter ${chap.number ?? ''}`}</span>
                                <span className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">{chap.id}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* STAGE: Terminal (extractImages or extractText or extractResources) */}
                {(report.stages.extractImages || report.stages.extractText || report.stages.extractResources) && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleStage('extractImages')}
                    >
                      <div className="flex items-center space-x-2.5">
                        {(report.stages.extractImages?.ok || report.stages.extractText?.ok || report.stages.extractResources?.ok) ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span className="text-xs font-bold text-slate-200">5. Content &amp; Stream Delivery</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-slate-400">
                          {report.stages.extractImages?.durationMs || report.stages.extractText?.durationMs || 0}ms
                        </span>
                        {expandedStages.extractImages ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                      </div>
                    </div>
                    {expandedStages.extractImages && (
                      <div className="pl-6 pt-1 text-xs text-slate-400 space-y-1.5">
                        {report.stages.extractImages?.deliveries && (
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-mono text-slate-500">Binary payload verified:</span>
                            {report.stages.extractImages.deliveries.map((del: any, idx: number) => (
                              <div key={idx} className="p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                                <span className="text-emerald-400 font-semibold">HTTP {del.status}</span>
                                <span>{del.contentType}</span>
                                <span className="text-slate-500">{(del.bytes / 1024).toFixed(1)} KB</span>
                                <span className="text-indigo-400">{del.durationMs}ms</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-3">
                <Zap className="w-8 h-8 text-indigo-400 mx-auto opacity-70" />
                <h4 className="text-sm font-semibold text-slate-300">Ready to Probe</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click &quot;Execute Probe&quot; above to exercise this module in the Node VM environment with real or fixture network pipelines.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Raw Node VM Console & JSON Report */}
        <div className="lg:col-span-5 flex flex-col h-full space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>Probe Output Console</span>
            </h4>
            <button
              onClick={copyLog}
              disabled={!rawOutput && !report}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-white flex items-center space-x-1 transition disabled:opacity-40"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy Log'}</span>
            </button>
          </div>

          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-y-auto font-mono text-xs leading-relaxed text-slate-300 select-text min-h-[350px] max-h-[600px] shadow-inner">
            {isRunning ? (
              <div className="flex items-center space-x-2 text-indigo-400">
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Running Node VM harness for {selectedSlug}...</span>
              </div>
            ) : rawOutput ? (
              <pre className="whitespace-pre-wrap">{rawOutput}</pre>
            ) : errorMessage ? (
              <div className="text-rose-400">
                <div className="font-bold mb-1">Error:</div>
                <pre className="whitespace-pre-wrap">{errorMessage}</pre>
              </div>
            ) : (
              <div className="text-slate-600 italic">
                Execution logs, assertions, timing traces, and JSON telemetry will stream here upon executing a probe.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
