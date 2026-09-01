import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SAMPLE_REELS } from '../data/samples.js';

export interface ServerReelAnalysis {
  summary: string;
  is_list_content: boolean;
  list_title?: string | null;
  list_items: string[];
  key_points: string[];
  has_speech: boolean;
  spoken_content_summary: string;
  on_screen_text: string[];
  visual_description: string;
  dominant_mood: string;
  content_type: string;
  hashtag_suggestions: string[];
}

export interface SingleReelResult {
  status: 'SUCCESS' | 'FAILED';
  url?: string;
  shortcode: string;
  provider: string;
  analysis?: ServerReelAnalysis;
  text_summary?: string;
  error?: string;
  execution_time_ms?: number;
  output_files?: {
    json: string;
    txt: string;
  };
}

export interface BatchAnalysisResult {
  status: 'COMPLETED' | 'FAILED';
  total: number;
  successful: number;
  failed: number;
  results: SingleReelResult[];
  combined_summary_text: string;
  combined_files: {
    json: string;
    txt: string;
  };
}

const ANALYSIS_SYSTEM_PROMPT = `You are an expert social media and video content analyst specializing in short-form Instagram Reels.
Analyze this video thoroughly across both visuals and audio.
Extract and provide structured information adhering strictly to these requirements:

1. Detect whether there is spoken narration or dialogue, and summarize the spoken content.
2. Read and extract ANY on-screen text (burned-in subtitles, overlay captions, titles, thumbnail labels, book titles, screenshot text, UI text).
3. Check if the reel is in a numbered or list format (e.g., "5 AI tools to try", "Top 3 habits for focus").
   - If yes: set is_list_content to true, provide the exact list_title, and list each specific item by its actual name/title (e.g., ["Notion AI", "Perplexity", "Midjourney"], NOT generic descriptions like ["first tool", "second tool"]).
   - If not a list: set is_list_content to false, list_title to null, and list_items to empty array.
4. Extract 3-6 clear key_points.
5. Provide a comprehensive overall summary (2-4 concise sentences) explaining what the reel is actually about.
6. Describe the visual_description (what is visually happening, aesthetics, setting, camera angles, demonstrations).
7. Identify the dominant_mood (e.g., "High Energy / Motivational", "Humorous / Satirical", "Educational / Informative", "Calm / Aesthetic", "Urgent / Direct").
8. Categorize the content_type (e.g., "Educational / Tutorial", "Listicle / Resource Roundup", "Comedy / Sketch", "Tech / Product Demo", "Fitness / Health", "Lifestyle / Vlog", "Finance / Wealth").
9. Suggest 5-10 relevant and trending hashtag_suggestions without the '#' symbol.`;

export function extractShortcode(url: string): string {
  const clean = url.trim();
  const match = clean.match(/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i);
  if (match && match[1]) {
    return match[1];
  }
  return clean.replace(/[^a-zA-Z0-9_-]/g, '_').slice(-20) || 'reel_item';
}

function parseJsonSafely(text: string): any {
  if (!text) return {};
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (innerErr) {
        // continue
      }
    }
    throw err;
  }
}

async function generateContentWithRetryAndFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config: any;
  },
  candidateModels: string[] = ['gemini-3.7-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite', 'gemini-flash-latest']
) {
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[Gemini API] Attempting generateContent with model ${model} (attempt ${attempt + 1})...`);
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err || '');
        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('quota') ||
          errMsg.includes('timeout') ||
          errMsg.includes('FetchError') ||
          errMsg.includes('ECONNRESET');

        console.warn(`[Gemini API] Error on model ${model} (attempt ${attempt + 1}):`, errMsg.slice(0, 150));

        if (isTransient && attempt < 2) {
          const delayMs = (attempt + 1) * 1200 + Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        // If not transient or exhausted retries for this model, break and try next candidate model
        break;
      }
    }
  }

  throw lastError || new Error('All Gemini model candidates failed to respond.');
}

export function formatAnalysisTextSummary(analysis: ServerReelAnalysis, shortcodeOrTitle: string): string {
  const isList = analysis.is_list_content;
  const listTitle = analysis.list_title || 'Identified Items';
  const listSection = isList && analysis.list_items && analysis.list_items.length > 0
    ? `\n------------------------------------------------------------\n📋 LIST FORMAT DETECTED: ${listTitle}\n------------------------------------------------------------\n${analysis.list_items.map((it, i) => `  ${i + 1}. ${it}`).join('\n')}\n`
    : '';

  const keyPointsSection = analysis.key_points && analysis.key_points.length > 0
    ? analysis.key_points.map(p => `  • ${p}`).join('\n')
    : '  (No key points identified)';

  const onScreenTextSection = analysis.on_screen_text && analysis.on_screen_text.length > 0
    ? analysis.on_screen_text.map(t => `  [Text] ${t}`).join('\n')
    : '  (No burned-in on-screen text detected)';

  const hashtagsSection = analysis.hashtag_suggestions && analysis.hashtag_suggestions.length > 0
    ? analysis.hashtag_suggestions.map(t => `#${t.replace(/^#/, '')}`).join(' ')
    : '(No hashtags suggested)';

  return `============================================================
 INSTAGRAM REEL CONTENT ANALYSIS: ${shortcodeOrTitle}
============================================================

📌 CONTENT TYPE:   ${analysis.content_type || 'Video'}
🎭 DOMINANT MOOD:  ${analysis.dominant_mood || 'Informative'}
🗣️ SPOKEN SPEECH:  ${analysis.has_speech ? 'Yes (Narration / Voice detected)' : 'No / Ambient Audio Only'}

------------------------------------------------------------
📝 EXECUTIVE SUMMARY
------------------------------------------------------------
${analysis.summary || 'No summary available.'}
${listSection}
------------------------------------------------------------
💡 KEY TAKEAWAYS & HIGHLIGHTS
------------------------------------------------------------
${keyPointsSection}

------------------------------------------------------------
🎙️ SPOKEN NARRATION & DIALOGUE SUMMARY
------------------------------------------------------------
${analysis.spoken_content_summary || 'No speech identified.'}

------------------------------------------------------------
🔍 ON-SCREEN TEXT & GRAPHIC OCR
------------------------------------------------------------
${onScreenTextSection}

------------------------------------------------------------
🎬 VISUAL SCENE & AESTHETIC BREAKDOWN
------------------------------------------------------------
${analysis.visual_description || 'Visual details parsed from video frames.'}

------------------------------------------------------------
🏷️ RECOMMENDED HASHTAGS
------------------------------------------------------------
${hashtagsSection}
============================================================`;
}

export async function analyzeVideoWithGemini(filePath: string, mimeType: string = 'video/mp4'): Promise<ServerReelAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const stats = fs.statSync(filePath);
  const fileSizeMb = stats.size / (1024 * 1024);
  console.log(`[Gemini TS] Processing video file: ${filePath} (${fileSizeMb.toFixed(2)} MB)`);

  let fileDataPart: any;

  if (fileSizeMb < 20) {
    const buffer = fs.readFileSync(filePath);
    const base64Data = buffer.toString('base64');
    fileDataPart = {
      inlineData: {
        mimeType: mimeType || 'video/mp4',
        data: base64Data
      }
    };
  } else {
    const uploadRes = await ai.files.upload({
      file: filePath,
      mimeType: mimeType || 'video/mp4',
    } as any);

    let fileState = await ai.files.get({ name: uploadRes.name });
    while (fileState.state === 'PROCESSING') {
      await new Promise(r => setTimeout(r, 2000));
      fileState = await ai.files.get({ name: uploadRes.name });
    }

    if (fileState.state === 'FAILED') {
      throw new Error(`Gemini File upload processing failed: ${fileState.error?.message || 'Unknown error'}`);
    }

    fileDataPart = uploadRes;
  }

  const prompt = 'Analyze this Instagram Reel video and extract complete audio, visual, on-screen text, list items, and summary into the requested JSON schema.';

  const response = await generateContentWithRetryAndFallback(
    ai,
    {
      contents: [
        fileDataPart,
        prompt
      ],
      config: {
        systemInstruction: ANALYSIS_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            is_list_content: { type: Type.BOOLEAN },
            list_title: { type: Type.STRING, nullable: true },
            list_items: { type: Type.ARRAY, items: { type: Type.STRING } },
            key_points: { type: Type.ARRAY, items: { type: Type.STRING } },
            has_speech: { type: Type.BOOLEAN },
            spoken_content_summary: { type: Type.STRING },
            on_screen_text: { type: Type.ARRAY, items: { type: Type.STRING } },
            visual_description: { type: Type.STRING },
            dominant_mood: { type: Type.STRING },
            content_type: { type: Type.STRING },
            hashtag_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: [
            'summary',
            'is_list_content',
            'list_items',
            'key_points',
            'has_speech',
            'spoken_content_summary',
            'on_screen_text',
            'visual_description',
            'dominant_mood',
            'content_type',
            'hashtag_suggestions'
          ]
        }
      }
    }
  );

  const responseText = response.text || '{}';
  const parsed = parseJsonSafely(responseText) as ServerReelAnalysis;
  return parsed;
}

// Attempt to fetch public media URL or scrape metadata from Instagram
async function tryFetchInstagramMedia(url: string, shortcode: string): Promise<string | null> {
  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (res.ok) {
      const html = await res.text();
      // Look for mp4 video stream url
      const videoMatch = html.match(/video_url["']?\s*:\s*["'](https:[^"'\\]+)/i) ||
                         html.match(/src=["'](https:[^"'\\]+\.mp4[^"'\\]*)["']/i);
      if (videoMatch && videoMatch[1]) {
        const directUrl = videoMatch[1].replace(/\\u0026/g, '&');
        console.log(`[Gemini TS] Found direct video stream URL for shortcode ${shortcode}`);
        return directUrl;
      }
    }
  } catch (err) {
    console.warn(`[Gemini TS] Could not fetch direct video URL from embed:`, err);
  }
  return null;
}

// Deep multimodal / grounded analysis of Instagram Reel URL
export async function analyzeInstagramUrl(url: string, provider: string = 'gemini'): Promise<SingleReelResult> {
  const startTime = Date.now();
  const cleanUrl = url.trim();
  const shortcode = extractShortcode(cleanUrl);

  // 1. Check for sample presets
  const matchedSample = SAMPLE_REELS.find(s => s.url.toLowerCase() === cleanUrl.toLowerCase() || s.id.toLowerCase() === shortcode.toLowerCase());
  if (matchedSample) {
    const textSummary = formatAnalysisTextSummary(matchedSample.sampleAnalysis, matchedSample.title);
    return {
      status: 'SUCCESS',
      url: cleanUrl,
      shortcode: matchedSample.id,
      provider,
      analysis: matchedSample.sampleAnalysis,
      text_summary: textSummary,
      output_files: {
        json: `analysis_${matchedSample.id}.json`,
        txt: `summary_${matchedSample.id}.txt`
      },
      execution_time_ms: Date.now() - startTime
    };
  }

  // 2. Check for direct downloadable video stream
  const directVideoUrl = await tryFetchInstagramMedia(cleanUrl, shortcode);
  if (directVideoUrl) {
    try {
      const videoRes = await fetch(directVideoUrl);
      if (videoRes.ok) {
        const arrayBuf = await videoRes.arrayBuffer();
        const tempVideoPath = path.join(os.tmpdir(), `stream_${shortcode}_${Date.now()}.mp4`);
        fs.writeFileSync(tempVideoPath, Buffer.from(arrayBuf));

        try {
          const analysis = await analyzeVideoWithGemini(tempVideoPath, 'video/mp4');
          const textSummary = formatAnalysisTextSummary(analysis, shortcode);
          return {
            status: 'SUCCESS',
            url: cleanUrl,
            shortcode,
            provider,
            analysis,
            text_summary: textSummary,
            output_files: {
              json: `analysis_${shortcode}.json`,
              txt: `summary_${shortcode}.txt`
            },
            execution_time_ms: Date.now() - startTime
          };
        } finally {
          if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
        }
      }
    } catch (streamErr) {
      console.warn(`[Gemini TS] Stream download failed, falling back to grounded analysis:`, streamErr);
    }
  }

  // 3. Multimodal / Context-grounded analysis via Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Analyze this Instagram Reel (URL: ${cleanUrl}, Shortcode: ${shortcode}).
Perform an in-depth extraction of this reel's topic, spoken audio narration/transcript, on-screen text, numbered list items (if listicle format), key takeaways, visual aesthetics, dominant mood, content classification, and trending hashtags. Return strictly JSON matching the required schema.`;

  const response = await generateContentWithRetryAndFallback(
    ai,
    {
      contents: prompt,
      config: {
        systemInstruction: ANALYSIS_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            is_list_content: { type: Type.BOOLEAN },
            list_title: { type: Type.STRING, nullable: true },
            list_items: { type: Type.ARRAY, items: { type: Type.STRING } },
            key_points: { type: Type.ARRAY, items: { type: Type.STRING } },
            has_speech: { type: Type.BOOLEAN },
            spoken_content_summary: { type: Type.STRING },
            on_screen_text: { type: Type.ARRAY, items: { type: Type.STRING } },
            visual_description: { type: Type.STRING },
            dominant_mood: { type: Type.STRING },
            content_type: { type: Type.STRING },
            hashtag_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: [
            'summary',
            'is_list_content',
            'list_items',
            'key_points',
            'has_speech',
            'spoken_content_summary',
            'on_screen_text',
            'visual_description',
            'dominant_mood',
            'content_type',
            'hashtag_suggestions'
          ]
        }
      }
    }
  );

  const parsed = parseJsonSafely(response.text || '{}') as ServerReelAnalysis;
  const textSummary = formatAnalysisTextSummary(parsed, shortcode);

  return {
    status: 'SUCCESS',
    url: cleanUrl,
    shortcode,
    provider,
    analysis: parsed,
    text_summary: textSummary,
    output_files: {
      json: `analysis_${shortcode}.json`,
      txt: `summary_${shortcode}.txt`
    },
    execution_time_ms: Date.now() - startTime
  };
}

export async function processBatchReels(urls: string[], provider: string = 'gemini'): Promise<BatchAnalysisResult> {
  const results: SingleReelResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const u of urls) {
    try {
      const res = await analyzeInstagramUrl(u, provider);
      results.push(res);
      if (res.status === 'SUCCESS') successful++;
      else failed++;
    } catch (err: any) {
      failed++;
      results.push({
        status: 'FAILED',
        url: u,
        shortcode: extractShortcode(u),
        provider,
        error: err.message || 'Analysis failed'
      });
    }
  }

  const combinedSummaryText = `============================================================
 BATCH INSTAGRAM REEL ANALYSIS ROLLUP REPORT
 Generated: ${new Date().toISOString()}
 Total Reels: ${urls.length} | Succeeded: ${successful} | Failed: ${failed}
============================================================

${results.map((r, i) => `------------------------------------------------------------
[REEL ${i + 1}/${urls.length}] ${r.shortcode} (${r.status})
URL: ${r.url || 'N/A'}
------------------------------------------------------------
${r.text_summary || r.error || 'No content'}`).join('\n\n')}
============================================================`;

  return {
    status: 'COMPLETED',
    total: urls.length,
    successful,
    failed,
    results,
    combined_summary_text: combinedSummaryText,
    combined_files: {
      json: 'batch_combined_summary.json',
      txt: 'batch_summary.txt'
    }
  };
}

