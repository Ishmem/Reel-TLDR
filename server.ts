import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import multer from 'multer';
import {
  analyzeVideoWithGroq,
  formatAnalysisTextSummary,
  analyzeInstagramUrlWithGroq,
  processBatchReelsWithGroq,
  printResolvedYtDlpBinary
} from './src/services/groqService.ts';
import {
  analyzeInstagramUrl,
  analyzeVideoWithGemini,
  processBatchReels
} from './src/services/geminiService.ts';

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
    const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    res.json({
      status: 'ok',
      hasGroqKey,
      hasGeminiKey,
      provider: hasGroqKey ? 'groq' : (hasGeminiKey ? 'gemini' : 'none'),
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

    console.log(`[API] Received analysis request for URL: ${cleanUrl} (Existing categories count: ${categoriesList?.length || 0})`);

    // 1. Try Groq if GROQ_API_KEY is configured
    if (process.env.GROQ_API_KEY) {
      try {
        console.log('[API] Attempting analysis with Groq...');
        const result = await analyzeInstagramUrlWithGroq(cleanUrl, categoriesList);
        if (result.status === 'SUCCESS') {
          return res.json(result);
        }
        console.warn('[API] Groq returned non-success, attempting Gemini fallback...');
      } catch (err: any) {
        console.warn('[API] Groq analysis threw exception, attempting Gemini fallback:', err.message);
      }
    }

    // 2. Fall back to Gemini (injected automatically in Google AI Studio)
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log('[API] Executing analysis with Gemini fallback...');
        const result = await analyzeInstagramUrl(cleanUrl, 'gemini', undefined, categoriesList);
        if (result.status === 'FAILED') {
          return res.status(422).json(result);
        }
        return res.json(result);
      } catch (geminiErr: any) {
        console.error('[API] Gemini analysis error:', geminiErr);
        return res.status(500).json({
          status: 'FAILED',
          url: cleanUrl,
          provider: 'gemini',
          error: geminiErr.message || 'Internal server error during Gemini analysis.'
        });
      }
    }

    return res.status(500).json({
      status: 'FAILED',
      url: cleanUrl,
      error: 'Neither GROQ_API_KEY nor GEMINI_API_KEY is configured on this server.'
    });
  });

  // Direct video file upload analysis endpoint (supporting both route names)
  const handleUploadAnalysis = async (req: express.Request, res: express.Response) => {
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

    console.log(`[API] Received uploaded video for processing: ${req.file.originalname} (${req.file.size} bytes)`);
    const startTime = Date.now();

    try {
      // Try Groq Whisper audio extraction & LLM analysis if available
      if (process.env.GROQ_API_KEY) {
        try {
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
        } catch (groqErr: any) {
          console.warn('[API] Groq upload analysis note, falling back to Gemini:', groqErr.message);
        }
      }

      // Fall back to Gemini Multimodal analysis
      if (process.env.GEMINI_API_KEY) {
        console.log('[API] Processing uploaded video with Gemini multimodal engine...');
        const analysis = await analyzeVideoWithGemini(videoFilePath, req.file.mimetype || 'video/mp4', categoriesList);
        const textSummary = formatAnalysisTextSummary(analysis as any, baseName);
        const executionTime = Date.now() - startTime;

        return res.json({
          status: 'SUCCESS',
          shortcode: baseName,
          provider: 'gemini',
          analysis,
          text_summary: textSummary,
          execution_time_ms: executionTime,
          output_files: {
            json: `analysis_${baseName}.json`,
            txt: `summary_${baseName}.txt`
          }
        });
      }

      return res.status(500).json({
        status: 'FAILED',
        error: 'Neither GROQ_API_KEY nor GEMINI_API_KEY is configured on this server.'
      });
    } catch (err: any) {
      console.error('[API] Error in video upload analysis:', err);
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
      } catch (cleanErr) {
        console.error('[API] Cleanup warning:', cleanErr);
      }
    }
  };

  app.post('/api/analyze-upload', upload.single('video'), handleUploadAnalysis);
  app.post('/api/upload-video', upload.single('video'), handleUploadAnalysis);

  // Batch analysis endpoint (supporting both route names)
  const handleBatchAnalysis = async (req: express.Request, res: express.Response) => {
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

    const limitedUrls = urls.slice(0, 10);
    console.log(`[API] Starting batch analysis for ${limitedUrls.length} URLs`);

    try {
      if (process.env.GROQ_API_KEY) {
        try {
          const batchResult = await processBatchReelsWithGroq(limitedUrls, categoriesList);
          return res.json(batchResult);
        } catch (groqErr: any) {
          console.warn('[API] Groq batch analysis failed, trying Gemini:', groqErr.message);
        }
      }

      if (process.env.GEMINI_API_KEY) {
        const batchResult = await processBatchReels(limitedUrls, 'gemini', categoriesList);
        return res.json(batchResult);
      }

      return res.status(500).json({
        status: 'FAILED',
        error: 'Neither GROQ_API_KEY nor GEMINI_API_KEY is available.'
      });
    } catch (err: any) {
      console.error('[API] Batch analysis error:', err);
      return res.status(500).json({
        status: 'FAILED',
        error: err.message || 'Error executing batch analysis.'
      });
    }
  };

  app.post('/api/batch-analyze', upload.single('batchFile'), handleBatchAnalysis);
  app.post('/api/analyze-batch', upload.single('batchFile'), handleBatchAnalysis);

  // Get Python code files for inspection or copy
  app.get('/api/python-suite', (req, res) => {
    try {
      const files: Record<string, string> = {
        'growki_pipeline.py': fs.readFileSync(path.join(process.cwd(), 'growki_pipeline.py'), 'utf-8'),
        'test_growki_pipeline.py': fs.readFileSync(path.join(process.cwd(), 'test_growki_pipeline.py'), 'utf-8'),
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

  // Production vs Dev static serving
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isProduction = process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development');

  if (isProduction && hasDist) {
    console.log(`[Server] Serving production static bundle from ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log('[Server] Mounting Vite dev middleware...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Instagram Reel Content Analyzer running on http://0.0.0.0:${PORT}`);
    printResolvedYtDlpBinary();
  });
}

startServer();
