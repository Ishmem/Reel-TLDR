import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { SAMPLE_REELS } from './src/data/samples.js';

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
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasGroqKey: Boolean(process.env.GROQ_API_KEY),
      timestamp: new Date().toISOString()
    });
  });

  // Get pre-configured sample reels
  app.get('/api/samples', (req, res) => {
    res.json(SAMPLE_REELS);
  });

  // Single Reel URL Analysis endpoint
  app.post('/api/analyze-reel', async (req, res) => {
    const { url, provider = 'gemini' } = req.body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Please provide a valid Instagram Reel URL.' });
    }

    const cleanUrl = url.trim();
    console.log(`[API] Received analysis request for URL: ${cleanUrl} (Provider: ${provider})`);

    const outputDir = path.join(os.tmpdir(), `reel_out_${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });

    try {
      const startTime = Date.now();
      const pythonResult = await runPythonCommand([
        'reel_analyzer.py',
        cleanUrl,
        '--provider',
        provider,
        '--output-dir',
        outputDir,
        '--json-only'
      ]);

      const executionTime = Date.now() - startTime;
      console.log(`[API] Python run completed with code ${pythonResult.code} in ${executionTime}ms`);

      if (pythonResult.code !== 0 || !pythonResult.stdout.trim()) {
        console.error('[API] Python execution error:', pythonResult.stderr);

        // Check if it's an Instagram download blocking issue
        let userFriendlyError = pythonResult.stderr || 'Analysis failed.';
        if (userFriendlyError.includes('Instaloader') || userFriendlyError.includes('yt-dlp') || userFriendlyError.includes('login') || userFriendlyError.includes('HTTP Error 401') || userFriendlyError.includes('HTTP Error 429')) {
          userFriendlyError = 'Instagram download blocked by platform rate-limits or private account security. Tip: You can test immediately using our built-in Sample Reels or upload a .mp4 video file directly!';
        }

        return res.status(500).json({
          status: 'FAILED',
          url: cleanUrl,
          provider,
          error: userFriendlyError,
          rawError: pythonResult.stderr
        });
      }

      try {
        const parsed = extractJsonFromOutput(pythonResult.stdout);
        parsed.execution_time_ms = executionTime;
        return res.json(parsed);
      } catch (parseErr) {
        console.error('[API] JSON parse error:', parseErr, 'Raw output:', pythonResult.stdout);
        return res.status(500).json({
          status: 'FAILED',
          error: 'Failed to parse analyzer response. Raw output: ' + (pythonResult.stdout.slice(0, 300) || 'Empty output'),
          rawOutput: pythonResult.stdout,
          rawError: pythonResult.stderr
        });
      }
    } catch (err: any) {
      console.error('[API] Exception in /api/analyze-reel:', err);
      return res.status(500).json({
        status: 'FAILED',
        error: err.message || 'Internal server error during analysis.'
      });
    } finally {
      // Clean up output dir
      try {
        fs.rmSync(outputDir, { recursive: true, force: true });
      } catch (e) {
        // ignore
      }
    }
  });

  // Direct video file upload analysis endpoint
  app.post('/api/analyze-upload', upload.single('video'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded.' });
    }

    const videoFilePath = req.file.path;
    const provider = req.body.provider || 'gemini';
    console.log(`[API] Received uploaded video: ${req.file.originalname} (${req.file.size} bytes), provider: ${provider}`);

    const outputDir = path.join(os.tmpdir(), `upload_out_${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });

    try {
      const startTime = Date.now();
      const pythonResult = await runPythonCommand([
        'reel_analyzer.py',
        '--video',
        videoFilePath,
        '--provider',
        provider,
        '--output-dir',
        outputDir,
        '--json-only'
      ]);

      const executionTime = Date.now() - startTime;
      console.log(`[API] Upload analysis completed in ${executionTime}ms (Code: ${pythonResult.code})`);

      if (pythonResult.code !== 0 || !pythonResult.stdout.trim()) {
        return res.status(500).json({
          status: 'FAILED',
          provider,
          error: pythonResult.stderr || 'Video analysis failed.',
          rawError: pythonResult.stderr
        });
      }

      try {
        const parsed = extractJsonFromOutput(pythonResult.stdout);
        parsed.execution_time_ms = executionTime;
        return res.json(parsed);
      } catch (parseErr) {
        return res.status(500).json({
          status: 'FAILED',
          error: 'Failed to parse video analysis response.',
          rawOutput: pythonResult.stdout,
          rawError: pythonResult.stderr
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        status: 'FAILED',
        error: err.message || 'Error processing uploaded video.'
      });
    } finally {
      // Guaranteed cleanup of uploaded temp video file
      try {
        if (fs.existsSync(videoFilePath)) {
          fs.unlinkSync(videoFilePath);
        }
        fs.rmSync(outputDir, { recursive: true, force: true });
      } catch (cleanErr) {
        console.error('[API] Cleanup warning:', cleanErr);
      }
    }
  });

  // Batch analysis endpoint
  app.post('/api/batch-analyze', upload.single('batchFile'), async (req, res) => {
    let urls: string[] = [];
    const provider = req.body.provider || 'gemini';

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

    // Limit to max 10 reels per batch in web interface to avoid gateway timeouts
    const limitedUrls = urls.slice(0, 10);
    const tempBatchFile = path.join(os.tmpdir(), `batch_urls_${Date.now()}.txt`);
    fs.writeFileSync(tempBatchFile, limitedUrls.join('\n'), 'utf-8');

    const outputDir = path.join(os.tmpdir(), `batch_out_${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });

    try {
      console.log(`[API] Starting batch analysis for ${limitedUrls.length} URLs (Provider: ${provider})`);
      const pythonResult = await runPythonCommand([
        'reel_analyzer.py',
        '--batch',
        tempBatchFile,
        '--provider',
        provider,
        '--output-dir',
        outputDir,
        '--json-only'
      ]);

      if (pythonResult.code !== 0 || !pythonResult.stdout.trim()) {
        return res.status(500).json({
          status: 'FAILED',
          error: pythonResult.stderr || 'Batch analysis failed.',
          rawError: pythonResult.stderr
        });
      }

      try {
        const parsed = extractJsonFromOutput(pythonResult.stdout);
        return res.json(parsed);
      } catch (parseErr) {
        return res.status(500).json({
          status: 'FAILED',
          error: 'Failed to parse batch analysis response.',
          rawOutput: pythonResult.stdout,
          rawError: pythonResult.stderr
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        status: 'FAILED',
        error: err.message || 'Error executing batch analysis.'
      });
    } finally {
      try {
        if (fs.existsSync(tempBatchFile)) fs.unlinkSync(tempBatchFile);
        fs.rmSync(outputDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });

  // Get Python code files for inspection or copy
  app.get('/api/python-suite', (req, res) => {
    try {
      const files = {
        'reel_analyzer.py': fs.readFileSync(path.join(process.cwd(), 'reel_analyzer.py'), 'utf-8'),
        'requirements.txt': fs.readFileSync(path.join(process.cwd(), 'requirements.txt'), 'utf-8'),
        'analyzer/schemas.py': fs.readFileSync(path.join(process.cwd(), 'analyzer', 'schemas.py'), 'utf-8'),
        'analyzer/downloader.py': fs.readFileSync(path.join(process.cwd(), 'analyzer', 'downloader.py'), 'utf-8'),
        'analyzer/pipeline.py': fs.readFileSync(path.join(process.cwd(), 'analyzer', 'pipeline.py'), 'utf-8'),
        'analyzer/formatter.py': fs.readFileSync(path.join(process.cwd(), 'analyzer', 'formatter.py'), 'utf-8'),
        'analyzer/providers/gemini_provider.py': fs.readFileSync(path.join(process.cwd(), 'analyzer', 'providers', 'gemini_provider.py'), 'utf-8'),
        'analyzer/providers/groq_provider.py': fs.readFileSync(path.join(process.cwd(), 'analyzer', 'providers', 'groq_provider.py'), 'utf-8')
      };
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: 'Could not load Python suite files: ' + err.message });
    }
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
