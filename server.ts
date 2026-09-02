import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  analyzeVideoWithGroq,
  formatAnalysisTextSummary,
  analyzeInstagramUrlWithGroq,
  processBatchReelsWithGroq
} from './src/services/groqService.js';

const upload = multer({
  dest: path.join(os.tmpdir(), 'reel_uploads'),
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB max
});

// Helper to run python script as a promise
function runPythonCommand(args: string[], cwd: string = process.cwd()): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn('python3', args, {
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });

    proc.on('error', (err) => {
      stderr += `Process spawn error: ${err.message}\n`;
      resolve({ stdout, stderr, code: 1 });
    });
  });
}

// Safely extract and parse JSON from process stdout even if CLI messages precede or follow it
function extractJsonFromOutput(rawOutput: string): any {
  const trimmed = rawOutput.trim();
  try {
    return JSON.parse(trimmed);
  } catch (initialErr) {
    const firstBrace = trimmed.indexOf('{');
    const firstBracket = trimmed.indexOf('[');
    let startIdx = -1;
    let endIdx = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      endIdx = trimmed.lastIndexOf('}');
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      endIdx = trimmed.lastIndexOf(']');
    }

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const jsonSubstring = trimmed.substring(startIdx, endIdx + 1);
      return JSON.parse(jsonSubstring);
    }
    throw initialErr;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGroqKey: Boolean(process.env.GROQ_API_KEY),
      provider: 'groq',
      timestamp: new Date().toISOString()
    });
  });

  // Single Reel URL Analysis endpoint
  app.post('/api/analyze-reel', async (req, res) => {
    const { url, existingCategories } = req.body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Please provide a valid Instagram Reel URL.' });
    }

    const cleanUrl = url.trim();
    const categoriesList = Array.isArray(existingCategories)
      ? existingCategories.filter((c: any) => typeof c === 'string' && c.trim())
      : undefined;

    console.log(`[API] Received Groq analysis request for URL: ${cleanUrl} (Existing categories count: ${categoriesList?.length || 0})`);

    try {
      const result = await analyzeInstagramUrlWithGroq(cleanUrl, categoriesList);
      if (result.status === 'FAILED') {
        return res.status(422).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      console.error('[API] Exception in /api/analyze-reel:', err);
      return res.status(500).json({
        status: 'FAILED',
        url: cleanUrl,
        provider: 'groq',
        error: err.message || 'Internal server error during Groq analysis.'
      });
    }
  });

  // Direct video file upload analysis endpoint
  app.post('/api/analyze-upload', upload.single('video'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded.' });
    }

    const videoFilePath = req.file.path;
    const baseName = req.file.originalname.replace(/\.[^/.]+$/, '') || 'uploaded_video';
    let categoriesList: string[] | undefined;
    if (req.body.existingCategories) {
      try {
        const parsed = typeof req.body.existingCategories === 'string' ? JSON.parse(req.body.existingCategories) : req.body.existingCategories;
        if (Array.isArray(parsed)) {
          categoriesList = parsed.filter((c: any) => typeof c === 'string' && c.trim());
        }
      } catch {}
    }

    console.log(`[API] Received uploaded video for Groq processing: ${req.file.originalname} (${req.file.size} bytes)`);

    const startTime = Date.now();
    try {
      // Groq Whisper audio extraction & high-speed LLM analysis
      const analysis = await analyzeVideoWithGroq(videoFilePath, categoriesList);
      const textSummary = formatAnalysisTextSummary(analysis, baseName);
      const executionTime = Date.now() - startTime;

      return res.json({
        status: 'SUCCESS',
        shortcode: baseName,
        provider: 'groq',
        analysis,
        text_summary: textSummary,
        execution_time_ms: executionTime,
        output_files: {
          json: `analysis_${baseName}.json`,
          txt: `summary_${baseName}.txt`
        }
      });
    } catch (err: any) {
      console.error('[API] Error in /api/analyze-upload:', err);
      return res.status(500).json({
        status: 'FAILED',
        error: err.message || 'Error processing uploaded video with Groq.'
      });
    } finally {
      // Guaranteed cleanup of uploaded temp video file
      try {
        if (fs.existsSync(videoFilePath)) {
          fs.unlinkSync(videoFilePath);
        }
      } catch (cleanErr) {
        console.error('[API] Cleanup warning:', cleanErr);
      }
    }
  });

  // Batch analysis endpoint
  app.post('/api/batch-analyze', upload.single('batchFile'), async (req, res) => {
    let urls: string[] = [];

    if (req.file) {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      urls = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      fs.unlinkSync(req.file.path);
    } else if (req.body.urls) {
      if (Array.isArray(req.body.urls)) {
        urls = req.body.urls;
      } else if (typeof req.body.urls === 'string') {
        urls = req.body.urls.split('\n').map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith('#'));
      }
    }

    if (!urls.length) {
      return res.status(400).json({ error: 'No Instagram Reel URLs provided for batch processing.' });
    }

    let categoriesList: string[] | undefined;
    if (req.body.existingCategories) {
      try {
        const parsed = typeof req.body.existingCategories === 'string' ? JSON.parse(req.body.existingCategories) : req.body.existingCategories;
        if (Array.isArray(parsed)) {
          categoriesList = parsed.filter((c: any) => typeof c === 'string' && c.trim());
        }
      } catch {}
    }

    // Limit to max 10 reels per batch in web interface to avoid gateway timeouts
    const limitedUrls = urls.slice(0, 10);
    console.log(`[API] Starting Groq batch analysis for ${limitedUrls.length} URLs`);

    try {
      const batchResult = await processBatchReelsWithGroq(limitedUrls, categoriesList);
      return res.json(batchResult);
    } catch (err: any) {
      console.error('[API] Batch analysis error:', err);
      return res.status(500).json({
        status: 'FAILED',
        error: err.message || 'Error executing batch analysis with Groq.'
      });
    }
  });

  // Get Python code files for inspection or copy
  app.get('/api/python-suite', (req, res) => {
    try {
      const files: Record<string, string> = {
        'reel_analyzer.py': fs.readFileSync(path.join(process.cwd(), 'reel_analyzer.py'), 'utf-8'),
        'requirements.txt': fs.readFileSync(path.join(process.cwd(), 'requirements.txt'), 'utf-8'),
        'analyzer/schemas.py': fs.readFileSync(path.join(process.cwd(), 'analyzer', 'schemas.py'), 'utf-8'),
        'analyzer/downloader.py': fs.readFileSync(path.join(process.cwd(), 'analyzer', 'downloader.py'), 'utf-8'),
        'analyzer/pipeline.py': fs.readFileSync(path.join(process.cwd(), 'analyzer', 'pipeline.py'), 'utf-8'),
        'analyzer/formatter.py': fs.readFileSync(path.join(process.cwd(), 'analyzer', 'formatter.py'), 'utf-8'),
        'analyzer/providers/groq_provider.py': fs.readFileSync(path.join(process.cwd(), 'analyzer', 'providers', 'groq_provider.py'), 'utf-8'),
        'analyzer/providers/gemini_provider.py': fs.readFileSync(path.join(process.cwd(), 'analyzer', 'providers', 'gemini_provider.py'), 'utf-8')
      };
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: 'Could not load Python suite files: ' + err.message });
    }
  });

  // Strict JSON error fallback for any unknown API route - prevents HTML fallback on /api requests
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      status: 'FAILED',
      error: `API endpoint not found: ${req.method} ${req.originalUrl || req.url}`
    });
  });

  // Vite middleware for development / static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Instagram Reel Content Analyzer running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
