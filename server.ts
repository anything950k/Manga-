import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import {
  getIndexData,
  getModuleManifest,
  getModuleCode,
  getModuleFixtures,
  createRuntime,
  executeDiscovery,
  executeSearch,
  executeDetails,
  executeChapters,
  executeContent,
  MODULE_DEFAULT_QUERIES,
} from './src/server/runner.ts';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;

const app = express();
const port = 3000;
const host = '0.0.0.0';

app.use(express.json({ limit: '10mb' }));

// API: Get all module sources from index.json
app.get('/api/sources', async (req, res) => {
  try {
    const data = await getIndexData();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to read index.json' });
  }
});

// API: Get single module details (manifest + index data)
app.get('/api/sources/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const manifest = await getModuleManifest(slug);
    const indexData = await getIndexData();
    const indexEntry = indexData?.modules?.find(m => m.slug === slug || m.id === slug);
    const fixtures = await getModuleFixtures(slug);
    const defaultQuery = MODULE_DEFAULT_QUERIES[slug] || 'a';

    if (!manifest && !indexEntry) {
      return res.status(404).json({ error: `Module ${slug} not found` });
    }

    res.json({
      slug,
      manifest,
      indexEntry,
      fixtures,
      defaultQuery,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get module' });
  }
});

// API: Serve module icon
app.get('/api/sources/:slug/icon', async (req, res) => {
  try {
    const { slug } = req.params;
    const iconPath = path.join(root, 'modules', slug, 'icon.png');
    await fs.access(iconPath);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const stream = await fs.readFile(iconPath);
    res.send(stream);
  } catch {
    res.status(404).json({ error: 'Icon not found' });
  }
});

// API: Get raw module JavaScript code
app.get('/api/sources/:slug/code', async (req, res) => {
  try {
    const { slug } = req.params;
    const code = await getModuleCode(slug);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(code);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to read module script' });
  }
});

// API: Get module fixtures
app.get('/api/sources/:slug/fixtures', async (req, res) => {
  try {
    const { slug } = req.params;
    const fixtures = await getModuleFixtures(slug);
    res.json({ fixtures });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Read specific fixture content
app.get('/api/sources/:slug/fixtures/:filename', async (req, res) => {
  try {
    const { slug, filename } = req.params;
    const filePath = path.join(root, 'modules', slug, 'fixtures', filename);
    const content = await fs.readFile(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (err: any) {
    res.status(404).json({ error: 'Fixture not found' });
  }
});

// API: Live Discovery
app.post('/api/sources/:slug/discovery', async (req, res) => {
  try {
    const { slug } = req.params;
    const { feedId } = req.body || {};
    const result = await executeDiscovery(slug, feedId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Discovery failed' });
  }
});

// API: Live Search
app.post('/api/sources/:slug/search', async (req, res) => {
  try {
    const { slug } = req.params;
    const { query = 'a', page = 1, filters = {} } = req.body || {};
    const result = await executeSearch(slug, query, page, filters);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

// API: Details
app.post('/api/sources/:slug/details', async (req, res) => {
  try {
    const { slug } = req.params;
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing item id' });
    const result = await executeDetails(slug, id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to extract details' });
  }
});

// API: Chapters
app.post('/api/sources/:slug/chapters', async (req, res) => {
  try {
    const { slug } = req.params;
    const { id, paginationContext } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing item id' });
    const result = await executeChapters(slug, id, paginationContext);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to extract chapters' });
  }
});

// API: Content (Images / Text / Resources / Audio)
app.post('/api/sources/:slug/content', async (req, res) => {
  try {
    const { slug } = req.params;
    const { chapterId } = req.body;
    if (!chapterId) return res.status(400).json({ error: 'Missing chapterId' });
    const result = await executeContent(slug, chapterId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to extract content' });
  }
});

// API: Run Probe (using Node VM module-tester logic)
app.post('/api/run-probe', async (req, res) => {
  try {
    const { slug, mode = 'live', query, limit = 2 } = req.body;
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const activeQuery = query || MODULE_DEFAULT_QUERIES[slug] || 'a';
    const flagMode = mode === 'fixtures' ? '--fixtures' : '';
    const cmd = `node scripts/module-tester.mjs ${slug} ${flagMode} --query "${activeQuery}" --limit ${limit}`.trim();

    const { stdout, stderr } = await execAsync(cmd, { cwd: root, timeout: 35000 });
    // Parse json report from output if possible
    const jsonMatch = stdout.match(/\{[\s\S]*"reports":[\s\S]*\}/);
    let parsed = null;
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {}
    }

    res.json({
      rawOutput: stdout,
      stderr,
      report: parsed?.reports?.[0] || null,
      fullSummary: parsed || null,
    });
  } catch (err: any) {
    const stdout = err.stdout || '';
    const stderr = err.stderr || err.message;
    const jsonMatch = stdout.match(/\{[\s\S]*"reports":[\s\S]*\}/);
    let parsed = null;
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {}
    }
    res.json({
      rawOutput: stdout,
      stderr,
      report: parsed?.reports?.[0] || null,
      error: err.message,
    });
  }
});

// API: Repository Validation Audit
app.get('/api/repo/audit', async (req, res) => {
  try {
    const { stdout: validateOut } = await execAsync('node scripts/validate.mjs', { cwd: root, timeout: 20000 });
    let verifyOut = '';
    try {
      const res = await execAsync('node scripts/verify-repository.mjs', { cwd: root, timeout: 20000 });
      verifyOut = res.stdout;
    } catch (e: any) {
      verifyOut = e.stdout || e.message;
    }

    res.json({
      ok: true,
      validateOutput: validateOut.trim(),
      verifyOutput: verifyOut.trim(),
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err.message,
      output: err.stdout || '',
    });
  }
});

// API: Proxy Image / Media to bypass CORS & Referer protections
app.get('/api/proxy-image', async (req, res) => {
  const targetUrl = req.query.url as string;
  const referer = (req.query.referer as string) || '';

  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };
    let activeReferer = referer;
    const lowerTarget = targetUrl.toLowerCase();
    if (!activeReferer) {
      if (lowerTarget.includes('cmzcdn.org') || lowerTarget.includes('comizy')) {
        activeReferer = 'https://comizy.io/';
      } else if (lowerTarget.includes('wowpic') || lowerTarget.includes('comix.to')) {
        activeReferer = 'https://comix.to/';
      } else if (lowerTarget.includes('asurascans') || lowerTarget.includes('asura-images')) {
        activeReferer = 'https://asurascans.com/';
      } else if (lowerTarget.includes('mangafire')) {
        activeReferer = 'https://mangafire.to/';
      } else if (lowerTarget.includes('mangakatana')) {
        activeReferer = 'https://mangakatana.com/';
      } else if (lowerTarget.includes('weebcentral')) {
        activeReferer = 'https://weebcentral.com/';
      } else if (lowerTarget.includes('atsu.moe')) {
        activeReferer = 'https://atsu.moe/';
      } else if (lowerTarget.includes('lnori.com')) {
        activeReferer = 'https://lnori.com/';
      } else {
        try {
          const u = new URL(targetUrl);
          activeReferer = `${u.protocol}//${u.host}/`;
        } catch {}
      }
    }
    if (activeReferer) {
      headers['Referer'] = activeReferer;
    }

    if (lowerTarget.includes('atsu.moe')) {
      try {
        const curlArgs = [
          '-s', '-L',
          '-A', headers['User-Agent'],
          '-H', `Referer: ${activeReferer || 'https://atsu.moe/'}`,
          targetUrl,
        ];
        const { stdout } = await execFileAsync('curl', curlArgs, {
          encoding: 'buffer',
          maxBuffer: 25 * 1024 * 1024,
          timeout: 20000,
        });
        if (stdout && stdout.length > 0) {
          let contentType = 'image/jpeg';
          if (lowerTarget.endsWith('.webp')) contentType = 'image/webp';
          else if (lowerTarget.endsWith('.png')) contentType = 'image/png';
          else if (lowerTarget.endsWith('.avif')) contentType = 'image/avif';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=604800');
          return res.send(stdout);
        }
      } catch (e: any) {
        console.warn(`[Proxy] Direct curl for atsu failed: ${e.message}`);
      }
    }

    let upstream: Response | null = null;
    try {
      upstream = await fetch(targetUrl, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
    } catch {}

    if (!upstream || !upstream.ok) {
      // Fallback curl
      try {
        const curlArgs = [
          '-s', '-L',
          '-A', headers['User-Agent'],
          '-H', `Referer: ${activeReferer || targetUrl}`,
          targetUrl,
        ];
        const { stdout } = await execFileAsync('curl', curlArgs, {
          encoding: 'buffer',
          maxBuffer: 25 * 1024 * 1024,
          timeout: 20000,
        });
        if (stdout && stdout.length > 0) {
          let contentType = 'image/jpeg';
          if (lowerTarget.endsWith('.webp')) contentType = 'image/webp';
          else if (lowerTarget.endsWith('.png')) contentType = 'image/png';
          else if (lowerTarget.endsWith('.avif')) contentType = 'image/avif';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=604800');
          return res.send(stdout);
        }
      } catch {}
      return res.status(upstream ? upstream.status : 502).send(`Upstream responded with ${upstream?.status || 'error'}`);
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days

    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    res.status(502).send(`Proxy fetch failed: ${err.message}`);
  }
});

// Vite Middleware or Static Files
async function setupVite() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(root, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(root, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }
}

await setupVite();

app.listen(port, host, () => {
  console.log(`[Synthetiq Manga Sources] Server running on http://${host}:${port}`);
});
