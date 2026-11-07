import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

export interface IndexEntry {
  id: string;
  familyID?: string;
  name: string;
  version: string;
  language: string;
  contentType: 'pageImages' | 'text' | 'publication' | 'audio';
  contentRating?: string;
  releaseTrack?: string;
  status?: string;
  manifest: { path: string; sha256: string };
  icon: { path: string; sha256: string };
  slug?: string;
  baseURL?: string;
}

export interface ModuleManifest {
  contractVersion: number;
  id: string;
  familyID: string;
  name: string;
  version: string;
  minimumAppVersion: string;
  contentType: string;
  contentRating: string;
  releaseTrack: string;
  capabilities: string[];
  baseURL: string;
  universalURLs?: string[];
  entry: { path: string; sha256: string };
  icon: { path: string; sha256: string };
  hosts: string[];
  attribution?: {
    author?: string;
    website?: string;
    sourceCode?: string;
  };
}

let cachedIndex: { schemaVersion: number; modules: IndexEntry[] } | null = null;

export async function getIndexData() {
  if (!cachedIndex) {
    const raw = await fs.readFile(path.join(root, 'index.json'), 'utf8');
    cachedIndex = JSON.parse(raw);
    if (cachedIndex && Array.isArray(cachedIndex.modules)) {
      cachedIndex.modules = cachedIndex.modules.map(m => ({
        ...m,
        slug: m.manifest.path.split('/')[1] || m.id,
      }));
    }
  }
  return cachedIndex;
}

export async function getModuleManifest(slug: string): Promise<ModuleManifest | null> {
  try {
    const raw = await fs.readFile(path.join(root, 'modules', slug, 'manifest.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getModuleCode(slug: string): Promise<string> {
  return await fs.readFile(path.join(root, 'modules', slug, 'index.js'), 'utf8');
}

export async function getModuleFixtures(slug: string): Promise<string[]> {
  try {
    const dir = path.join(root, 'modules', slug, 'fixtures');
    const files = await fs.readdir(dir);
    return files;
  } catch {
    return [];
  }
}

function createCookieJar(host: string) {
  return { host: String(host || '').toLowerCase(), values: new Map<string, string>() };
}

function updateCookieJar(response: Response, requestURL: URL, jar: { host: string; values: Map<string, string> }) {
  if (!jar || !requestURL || requestURL.hostname.toLowerCase() !== jar.host) return;
  // @ts-ignore
  const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  for (const setCookie of setCookies) {
    const pair = String(setCookie).split(';', 1)[0];
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!name) continue;
    if (/max-age\s*=\s*0/i.test(setCookie)) jar.values.delete(name);
    else jar.values.set(name, value);
  }
}

async function curlNetworkResponse(url: string, headers: Record<string, string> = {}, method = 'GET', body: any = null, options: any = {}) {
  const started = Date.now();
  const args = ['-s', '-L', '-w', '\n__STATUS__:%{http_code}\n__FINALURL__:%{url_effective}'];

  if (method && method.toUpperCase() !== 'GET') {
    args.push('-X', method.toUpperCase());
  }

  const defaultUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
  let hasUA = false;
  let hasRef = false;
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      if (!v) continue;
      const lower = k.toLowerCase();
      if (lower === 'user-agent') hasUA = true;
      if (lower === 'referer') hasRef = true;
      args.push('-H', `${k}: ${v}`);
    }
  }
  if (!hasUA) args.push('-H', `User-Agent: ${defaultUA}`);
  if (!hasRef) {
    try {
      const u = new URL(url);
      args.push('-H', `Referer: ${u.protocol}//${u.host}/`);
    } catch {}
  }

  if (body) {
    const bodyStr = typeof body === 'object' && !(body instanceof Uint8Array) ? JSON.stringify(body) : String(body);
    args.push('--data-raw', bodyStr);
  }

  args.push(url);

  const timeoutMs = Math.max(10_000, Number(options.timeoutMilliseconds) || 25_000);
  const { stdout } = await execFileAsync('curl', args, {
    maxBuffer: 32 * 1024 * 1024,
    timeout: timeoutMs,
  });

  const marker = '\n__STATUS__:';
  const idx = stdout.lastIndexOf(marker);
  let status = 200;
  let finalUrl = url;
  let textBody = stdout;

  if (idx !== -1) {
    textBody = stdout.slice(0, idx);
    const metaPart = stdout.slice(idx + marker.length);
    const [statusStr, finalUrlLine] = metaPart.split('\n__FINALURL__:');
    status = parseInt(statusStr.trim(), 10) || 200;
    if (finalUrlLine) finalUrl = finalUrlLine.trim();
  }

  const bytes = Buffer.from(textBody, 'utf8');
  const limit = Number(options.maxBytesHint) || 16 * 1024 * 1024;
  const dropped = bytes.length > limit;

  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {},
    finalUrl,
    body: dropped ? '' : textBody,
    bodyDropped: dropped,
    dropReason: dropped ? 'maxBytesHint' : null,
    bodyBytes: bytes.length,
    bodyMagicHex: bytes.slice(0, 16).toString('hex'),
    contentType: textBody.startsWith('{') || textBody.startsWith('[') ? 'application/json' : 'text/html',
    error: null,
    durationMs: Date.now() - started,
    text: async () => textBody,
    json: async () => JSON.parse(textBody),
  };
}

async function networkResponse(url: string, headers: Record<string, string> = {}, method = 'GET', body: any = null, options: any = {}) {
  const started = Date.now();
  const requestURL = new URL(url);
  const requestHeaders = new Headers(headers || {});

  if (!requestHeaders.has('User-Agent')) {
    requestHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
  }

  if (
    options.implicitCookies !== false &&
    options.cookieJar &&
    requestURL.hostname.toLowerCase() === options.cookieJar.host &&
    !requestHeaders.has('Cookie')
  ) {
    const cookieHeader = [...options.cookieJar.values.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    if (cookieHeader) requestHeaders.set('Cookie', cookieHeader);
  }

  // If targeting atsu.moe, use curl directly to avoid Cloudflare undici/TLS fingerprinting 403
  if (requestURL.hostname.includes('atsu.moe')) {
    try {
      return await curlNetworkResponse(url, headers, method, body, options);
    } catch (err: any) {
      console.warn(`[Runner] Direct curl request failed for ${url}: ${err.message}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? (typeof body === 'object' && !(body instanceof Uint8Array) ? JSON.stringify(body) : body) : null,
      redirect: options.followRedirects === false ? 'manual' : 'follow',
      signal: AbortSignal.timeout(Math.max(10_000, Number(options.timeoutMilliseconds) || 25_000)),
    });
  } catch (err) {
    // If fetch failed completely, fallback to curl
    try {
      return await curlNetworkResponse(url, headers, method, body, options);
    } catch {
      throw err;
    }
  }

  // If anti-bot challenge or 403 occurred, fallback to curl
  if (response.status === 403 || response.status === 503) {
    try {
      const curlRes = await curlNetworkResponse(url, headers, method, body, options);
      if (curlRes.ok) {
        return curlRes;
      }
    } catch {}
  }

  if (options.cookieJar) {
    updateCookieJar(response, requestURL, options.cookieJar);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const limit = Number(options.maxBytesHint) || 16 * 1024 * 1024;
  const dropped = bytes.length > limit;
  const textBody = dropped ? '' : new TextDecoder().decode(bytes);

  return {
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
    finalUrl: response.url,
    body: textBody,
    bodyDropped: dropped,
    dropReason: dropped ? 'maxBytesHint' : null,
    bodyBytes: bytes.length,
    bodyMagicHex: Buffer.from(bytes.slice(0, 16)).toString('hex'),
    contentType: response.headers.get('content-type') || '',
    error: null,
    durationMs: Date.now() - started,
    text: async () => textBody,
    json: async () => JSON.parse(textBody),
  };
}

function fixtureResponse(body: string, status = 200, finalUrl = 'https://fixture.invalid/') {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {},
    finalUrl,
    body,
    bodyDropped: false,
    dropReason: null,
    bodyBytes: Buffer.byteLength(body),
    contentType: 'text/html',
    error: null,
    durationMs: 0,
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

export async function createRuntime(slug: string, mode: 'live' | 'fixtures' = 'live') {
  const source = await getModuleCode(slug);
  const calls: Array<{ kind: string; url: string; durationMs?: number; status?: number }> = [];
  const lifecycle: any[] = [];
  let bridges: any;

  if (mode === 'fixtures') {
    const fixture = async (name: string) => {
      try {
        return await fs.readFile(path.join(root, 'modules', slug, 'fixtures', name), 'utf8');
      } catch {
        return null;
      }
    };

    const home =
      (await fixture('home.html')) ||
      (await fixture('search.html')) ||
      (await fixture('home.json')) ||
      (await fixture('search.json'));
    const details = (await fixture('details.html')) || (await fixture('details.json'));
    const chapters = (await fixture('chapters.html')) || (await fixture('chapters.json'));
    const images =
      (await fixture('chapter.html')) ||
      (await fixture('images.html')) ||
      (await fixture('images.json')) ||
      (await fixture('pages.json')) ||
      (await fixture('chapter.json')) ||
      (await fixture('chapter-1.html'));

    bridges = {
      fetchv2: async (url: string, headers: any, method: string, body: any, options: any) => {
        calls.push({ kind: 'fetchv2', url: String(url) });
        const u = String(url);
        if (u.includes('chapter') || u.includes('image') || u.includes('page')) {
          if (images) return fixtureResponse(images);
        }
        if (u.includes('details') || u.includes('/series/') || u.includes('/manga/')) {
          if (details) return fixtureResponse(details);
        }
        if (u.includes('chapter') || u.includes('/chapters')) {
          if (chapters) return fixtureResponse(chapters);
        }
        if (home) return fixtureResponse(home);
        if (details) return fixtureResponse(details);
        throw new Error(`No fixture matched for ${u}`);
      },
      pagev2: async (task: any) => {
        calls.push({ kind: 'pagev2', url: String(task && task.url) });
        if (home) {
          return {
            finalURL: task.url,
            title: '',
            html: home,
            events: [],
            cookies: {},
            evaluatedData: home,
          };
        }
        throw new Error('Fixture mode does not implement pagev2 for this module.');
      },
      reportProgress: async (payload: any) => {
        lifecycle.push({ at: Date.now(), kind: 'reportProgress', payload: payload ?? null });
        return { ok: true };
      },
    };
  } else {
    const cookieJar = createCookieJar('mangaball.net');
    bridges = {
      fetchv2: async (url: string, headers: any, method: string, body: any, options: any = {}) => {
        const start = Date.now();
        calls.push({ kind: 'fetchv2', url: String(url) });
        const res = await networkResponse(url, headers, method, body, {
          ...options,
          cookieJar,
          implicitCookies: false,
        });
        const lastCall = calls[calls.length - 1];
        if (lastCall) {
          lastCall.durationMs = Date.now() - start;
          lastCall.status = res.status;
        }
        return res;
      },
      pagev2: async (task: any) => {
        const start = Date.now();
        calls.push({ kind: 'pagev2', url: String(task && task.url) });
        const response = await networkResponse(task.url, task.headers || {}, 'GET', null, {
          followRedirects: true,
          maxBytesHint: task.maxResponseCharacters || 1_000_000,
          timeoutMilliseconds: task.timeoutMilliseconds,
        });
        const lastCall = calls[calls.length - 1];
        if (lastCall) {
          lastCall.durationMs = Date.now() - start;
          lastCall.status = response.status;
        }
        if (!response.ok || response.bodyDropped) {
          throw new Error(`pagev2 failed for ${task.url}`);
        }
        return {
          finalURL: response.finalUrl,
          title: '',
          html: task.includeHTML ? response.body : null,
          events: [],
          cookies: {},
          evaluatedData: response.body,
        };
      },
      reportProgress: async (payload: any) => {
        lifecycle.push({ at: Date.now(), kind: 'reportProgress', payload: payload ?? null });
        return { ok: true };
      },
    };
  }

  const context: any = vm.createContext({
    URL,
    URLSearchParams,
    TextDecoder,
    TextEncoder,
    console,
    setTimeout,
    clearTimeout,
    ...bridges,
  });
  context.globalThis = context;
  new vm.Script(source, { filename: `modules/${slug}/index.js` }).runInContext(context);

  if (typeof context.SynthetiqModule !== 'object') {
    throw new Error(`${slug} did not export SynthetiqModule`);
  }

  return { module: context.SynthetiqModule, calls, lifecycle };
}

export async function executeDiscovery(slug: string, feedId?: string) {
  const { module } = await createRuntime(slug, 'live');
  if (feedId && typeof module.discoveryFeed === 'function') {
    return await module.discoveryFeed(feedId);
  }
  if (typeof module.discoveryHome === 'function') {
    return await module.discoveryHome();
  }
  // Fallback to empty discovery
  return { sections: [] };
}

export async function executeSearch(slug: string, query: string, page = 1, filters = {}): Promise<any> {
  const { module } = await createRuntime(slug, 'live');
  if (typeof module.searchResults !== 'function') {
    throw new Error(`Module ${slug} does not support searchResults`);
  }
  const effectiveQuery = Object.keys(filters).length ? { text: query, ...filters } : query;
  try {
    return await module.searchResults(effectiveQuery, page);
  } catch (err: any) {
    if (slug === 'comix') {
      // Smart Headless Provider: fallback to fast mirror search for Comix
      try {
        const mirrorSearch: any = await executeSearch('mangabuddy', query, page, filters);
        if (mirrorSearch && Array.isArray(mirrorSearch.items) && mirrorSearch.items.length > 0) {
          const mappedItems: any = mirrorSearch.items.map((item: any) => ({
            ...item,
            id: `comix::search::${encodeURIComponent(item.title)}::${encodeURIComponent(item.id || item.url)}`,
            href: item.href || item.url,
            url: item.url || item.href,
          }));
          return { items: mappedItems, hasMore: mirrorSearch.hasMore };
        }
      } catch {}
    }
    throw err;
  }
}

export async function executeDetails(slug: string, id: string): Promise<any> {
  if (slug === 'comix' && id.startsWith('comix::search::')) {
    const parts = id.split('::');
    const mirrorId = decodeURIComponent(parts[3] || '');
    return await executeDetails('mangabuddy', mirrorId);
  }
  const { module } = await createRuntime(slug, 'live');
  if (typeof module.extractDetails !== 'function') {
    throw new Error(`Module ${slug} does not support extractDetails`);
  }
  return await module.extractDetails(id);
}

export async function executeChapters(slug: string, id: string, paginationContext: any = null): Promise<any> {
  if (slug === 'comix') {
    try {
      let seriesTitle = '';
      let mirrorUrl = '';
      let latestChapterNum = 0;

      if (id.startsWith('comix::search::')) {
        const parts = id.split('::');
        seriesTitle = decodeURIComponent(parts[2] || '');
        mirrorUrl = decodeURIComponent(parts[3] || '');
      } else {
        try {
          const details = await executeDetails('comix', id);
          seriesTitle = details?.title || '';
          if (details?.latestChapter) latestChapterNum = Number(details.latestChapter);
        } catch {}
      }

      // If we don't have mirrorUrl, search mirror for clean keywords from seriesTitle
      if (!mirrorUrl && seriesTitle) {
        try {
          const cleanQuery = seriesTitle
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 4)
            .join(' ');
          const searchRes: any = await executeSearch('mangabuddy', cleanQuery, 1);
          if (searchRes?.items?.length) {
            // Find best matching title
            const targetLower = seriesTitle.toLowerCase();
            const matched =
              searchRes.items.find((item: any) =>
                item.title?.toLowerCase().includes(cleanQuery.toLowerCase()) ||
                targetLower.includes(item.title?.toLowerCase() || '')
              ) || searchRes.items[0];
            if (matched) {
              mirrorUrl = matched.id || matched.url;
            }
          }
        } catch {}
      }

      if (mirrorUrl) {
        const mirrorChapters: any = await executeChapters('mangabuddy', mirrorUrl);
        if (Array.isArray(mirrorChapters) && mirrorChapters.length > 0) {
          return mirrorChapters.map((ch: any) => ({
            ...ch,
            id: `comix::chapter::${encodeURIComponent(seriesTitle || 'series')}::${ch.number ?? 0}::${encodeURIComponent(ch.url || ch.id)}`,
            url: ch.url,
            href: ch.href,
          }));
        }
      }

      // If mirror didn't return chapters, check if latestChapterNum was found
      if (latestChapterNum > 0) {
        const genChapters = [];
        for (let i = latestChapterNum; i >= 1; i--) {
          genChapters.push({
            id: `comix::chapter::${encodeURIComponent(seriesTitle || 'series')}::${i}::fallback`,
            url: `https://comix.to/chapter/${i}`,
            href: `https://comix.to/chapter/${i}`,
            title: `Chapter ${i}`,
            number: i,
            releaseDate: new Date().toISOString(),
            language: 'en',
          });
        }
        return genChapters;
      }
    } catch (e: any) {
      console.warn(`[Comix Smart Resolver] Chapter resolution fallback: ${e.message}`);
    }
  }

  const { module } = await createRuntime(slug, 'live');
  if (typeof module.extractChapters !== 'function') {
    throw new Error(`Module ${slug} does not support extractChapters`);
  }
  return await module.extractChapters(id, paginationContext);
}

export async function executeContent(slug: string, chapterId: string) {
  const { module } = await createRuntime(slug, 'live');
  if (typeof module.extractImages === 'function') {
    const pages = await module.extractImages(chapterId);
    return { type: 'images', pages };
  }
  if (typeof module.extractText === 'function') {
    const text = await module.extractText(chapterId);
    return { type: 'text', data: text };
  }
  if (typeof module.extractResources === 'function') {
    const resources = await module.extractResources(chapterId);
    return { type: 'resources', data: resources };
  }
  if (typeof module.extractAudio === 'function') {
    const audio = await module.extractAudio(chapterId);
    return { type: 'audio', data: audio };
  }
  throw new Error(`Module ${slug} has no content extraction handler`);
}

export const MODULE_DEFAULT_QUERIES: Record<string, string> = {
  atsu: 'one piece',
  'synthetiq-manga': 'one piece',
  weebcentral: 'one piece',
  mangakatana: 'naruto',
  'asura-scans': 'solo leveling',
  chikari: 'demon',
  mangabuddy: 'solo',
  lnori: 'shadow',
};
