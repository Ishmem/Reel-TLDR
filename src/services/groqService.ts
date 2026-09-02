import { Groq } from 'groq-sdk';
import youtubedl from 'yt-dlp-exec';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
  category: string;
  content_type?: string;
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

let groqClient: Groq | null = null;

export function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not configured.');
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

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
  // Strip markdown code fences
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // Also strip any <think> tags if model produces reasoning
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

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
    throw new Error(`Failed to parse AI JSON response: ${cleaned.slice(0, 200)}`);
  }
}

// Extract audio from video file using ffmpeg
export async function extractAudioFromVideo(videoPath: string): Promise<string> {
  const audioPath = path.join(os.tmpdir(), `audio_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp3`);
  try {
    await execAsync(`ffmpeg -i "${videoPath}" -vn -ar 16000 -ac 1 -c:a mp3 "${audioPath}" -y`);
    return audioPath;
  } catch (err: any) {
    console.warn(`[GroqService] FFmpeg audio extraction error: ${err.message}`);
    throw err;
  }
}

// Transcribe audio using Groq Whisper
export async function transcribeAudioWithGroq(audioPath: string): Promise<string> {
  const groq = getGroqClient();
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-large-v3-turbo',
      response_format: 'json',
      temperature: 0.0,
    });
    return transcription.text || '';
  } catch (err: any) {
    console.warn(`[GroqService] Groq Whisper Turbo failed, retrying with whisper-large-v3: ${err.message}`);
    try {
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-large-v3',
        response_format: 'json',
        temperature: 0.0,
      });
      return transcription.text || '';
    } catch (fallbackErr: any) {
      console.error(`[GroqService] Whisper transcription error: ${fallbackErr.message}`);
      return '';
    }
  }
}

// Call Groq LLM with fallback models
export async function queryGroqLLM(prompt: string, systemPrompt?: string): Promise<any> {
  const groq = getGroqClient();
  const models = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'groq/compound', 'qwen/qwen3.6-27b'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const messages: any[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 3000,
      });

      const content = response.choices[0]?.message?.content || '';
      return parseJsonSafely(content);
    } catch (err: any) {
      lastError = err;
      console.warn(`[GroqService] Model ${model} failed: ${err.message}. Trying next model...`);
    }
  }

  throw lastError || new Error('All Groq models failed to generate response.');
}

const GROQ_SYSTEM_PROMPT = `You are an expert social media and video content analyst specializing in short-form Instagram Reels.
You will analyze the transcript, audio, captions, and context of a video reel.
Extract and return STRICTLY a valid JSON object matching this exact schema:

{
  "summary": "2-4 concise sentences summarizing the reel's actual subject matter and primary takeaway.",
  "is_list_content": true or false,
  "list_title": "Title of the list (e.g. '5 AI Tools Every Designer Needs') or null if not a list",
  "list_items": ["Item 1 Name/Title", "Item 2 Name/Title", ...],
  "key_points": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3"],
  "has_speech": true or false,
  "spoken_content_summary": "Comprehensive explanation of what is spoken in the narration/dialogue",
  "on_screen_text": ["Identified text, headings, steps, captions"],
  "visual_description": "Description of the visual presentation, setting, aesthetic, or screen demonstration",
  "dominant_mood": "e.g. High Energy / Actionable, Educational / Informative, Humorous / Satirical, Motivational",
  "category": "Short, human-readable topic label describing what the content is actually about (e.g. 'Book Recommendations', 'Workout & Fitness', 'Cooking', 'Business & Entrepreneurship', 'Self-Reflection & Mindset', 'Comedy', 'Travel')",
  "content_type": "Format description (e.g. 'Listicle / Resource Roundup', 'Educational / Tutorial', 'Tech Demo', 'Lifestyle / Vlog')",
  "hashtag_suggestions": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

CRITICAL RULES:
1. TOPIC CATEGORIZATION: "category" must be a concise, human-readable topic label (2-5 words, Title Case) representing the core subject matter (e.g., "Book Recommendations", "Workout & Fitness", "Cooking", "Business & Entrepreneurship", "Self-Reflection & Mindset", "Comedy", "Travel").
2. If existing user categories are supplied in the prompt context, REUSE the closest matching category whenever the reel fits reasonably, so similar reels stay grouped together in the user's library.
3. If the audio transcript or context has a numbered list (e.g., "1. Relume", "2. Vectorizer", "3. Krea", "First habit: ...", "Second habit: ..."), extract the exact specific named items in list_items!
4. Do NOT invent generic placeholders like ["first item", "second item"]. Use the actual names from the content.
5. Return ONLY valid JSON, with no markdown code fences or explanatory text outside the JSON.`;

export async function analyzeVideoWithGroq(
  videoPath: string,
  existingCategories?: string[]
): Promise<ServerReelAnalysis> {
  let audioPath: string | null = null;
  let transcript = '';

  try {
    audioPath = await extractAudioFromVideo(videoPath);
    transcript = await transcribeAudioWithGroq(audioPath);
  } catch (err: any) {
    console.warn(`[GroqService] Video audio extraction/transcription note: ${err.message}`);
  } finally {
    if (audioPath && fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
      } catch (e) {}
    }
  }

  const categoryContext = existingCategories && existingCategories.length > 0
    ? `\nEXISTING CATEGORIES IN USER'S SAVED LIBRARY:\n${existingCategories.map(c => `- "${c}"`).join('\n')}\n\nIMPORTANT CATEGORIZATION RULE:\n- If this reel's topic reasonably fits one of the existing categories above, REUSE that exact category name to prevent library fragmentation.\n- If and only if none of the existing categories fit, coin a new, specific, concise category (2-5 words, Title Case, e.g. "Cooking", "Book Recommendations", "Workout & Fitness", "Urban Planning & Transit").`
    : `\nCATEGORIZATION INSTRUCTION:\n- Provide a short, human-readable topic label in "category" describing what the content is actually about (2-5 words, Title Case, e.g. "Book Recommendations", "Workout & Fitness", "Cooking", "Business & Entrepreneurship", "Self-Reflection & Mindset", "Comedy", "Travel").`;

  const prompt = `Here is the transcribed audio and metadata from the uploaded Instagram Reel video:

AUDIO TRANSCRIPT:
"""
${transcript.trim() || '[No spoken audio or instrumental music only]'}
"""
${categoryContext}

Please perform a complete content analysis. Extract all key points, list items (if it's a listicle/tips format), speech summary, topic category, and structure. Return strictly JSON adhering to the schema.`;

  const parsed = await queryGroqLLM(prompt, GROQ_SYSTEM_PROMPT);

  const rawCategory = (parsed.category || parsed.content_type || 'General').trim();
  let cleanCategory = rawCategory;
  if (existingCategories && existingCategories.length > 0) {
    const matched = existingCategories.find(c => c.trim().toLowerCase() === cleanCategory.toLowerCase());
    if (matched) cleanCategory = matched;
  }

  const cleanAnalysis: ServerReelAnalysis = {
    summary: parsed.summary || 'Video analysis completed.',
    is_list_content: Boolean(parsed.is_list_content),
    list_title: parsed.list_title || (parsed.is_list_content ? 'Key Items' : null),
    list_items: Array.isArray(parsed.list_items) ? parsed.list_items : [],
    key_points: Array.isArray(parsed.key_points) && parsed.key_points.length > 0 ? parsed.key_points : ['Key insight extracted from video content.'],
    has_speech: Boolean(transcript.trim().length > 0 || parsed.has_speech),
    spoken_content_summary: parsed.spoken_content_summary || (transcript.trim() ? `Transcript: "${transcript.slice(0, 300)}..."` : 'No spoken speech detected.'),
    on_screen_text: Array.isArray(parsed.on_screen_text) ? parsed.on_screen_text : [],
    visual_description: parsed.visual_description || 'High-definition vertical video presentation.',
    dominant_mood: parsed.dominant_mood || 'Informative / Engaging',
    category: cleanCategory,
    content_type: parsed.content_type || cleanCategory || (parsed.is_list_content ? 'Listicle / Resource Roundup' : 'Video Content'),
    hashtag_suggestions: Array.isArray(parsed.hashtag_suggestions) ? parsed.hashtag_suggestions : ['reels', 'content', 'viral', 'explore', 'trending']
  };

  return cleanAnalysis;
}

// Ensure yt-dlp binary is present and executable
let binaryEnsurePromise: Promise<string | null> | null = null;

async function ensureYtDlpBinary(): Promise<string | null> {
  if (binaryEnsurePromise) return binaryEnsurePromise;

  binaryEnsurePromise = (async () => {
    const defaultBin = path.resolve(process.cwd(), 'node_modules/yt-dlp-exec/bin/yt-dlp');
    const tmpBin = path.join(os.tmpdir(), 'yt-dlp-bin');

    if (fs.existsSync(defaultBin)) {
      try {
        fs.chmodSync(defaultBin, 0o755);
      } catch {}
      return defaultBin;
    }

    if (fs.existsSync(tmpBin)) {
      try {
        fs.chmodSync(tmpBin, 0o755);
      } catch {}
      return tmpBin;
    }

    // Try executing postinstall script to download official binary
    try {
      const postinstallScript = path.resolve(process.cwd(), 'node_modules/yt-dlp-exec/scripts/postinstall.js');
      if (fs.existsSync(postinstallScript)) {
        await execAsync(`node "${postinstallScript}"`);
        if (fs.existsSync(defaultBin)) {
          fs.chmodSync(defaultBin, 0o755);
          return defaultBin;
        }
      }
    } catch (err: any) {
      console.warn('[GroqService] yt-dlp postinstall run warning:', err.message);
    }

    // Direct curl download fallback if needed
    try {
      console.log('[GroqService] Fetching standalone yt-dlp binary...');
      await execAsync(`curl -sL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" -o "${tmpBin}" && chmod +x "${tmpBin}"`);
      if (fs.existsSync(tmpBin) && fs.statSync(tmpBin).size > 100000) {
        return tmpBin;
      }
    } catch (curlErr: any) {
      console.warn('[GroqService] curl standalone download warning:', curlErr.message);
    }

    return fs.existsSync(defaultBin) ? defaultBin : null;
  })();

  return binaryEnsurePromise;
}

export async function analyzeInstagramUrlWithGroq(
  url: string,
  existingCategories?: string[]
): Promise<SingleReelResult> {
  const startTime = Date.now();
  const cleanUrl = url.trim();
  const shortcode = extractShortcode(cleanUrl);

  // 1. Try downloading with yt-dlp
  const tempDir = path.join(os.tmpdir(), `reel_dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  let downloadedVideoPath: string | null = null;
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  try {
    fs.mkdirSync(tempDir, { recursive: true });
    const outputPath = path.join(tempDir, 'video.mp4');

    const binPath = await ensureYtDlpBinary();
    const ytRunner = binPath && typeof (youtubedl as any).create === 'function'
      ? (youtubedl as any).create(binPath)
      : youtubedl;

    // Attempt video download via bundled yt-dlp with 60-second timeout and realistic User-Agent
    await ytRunner(
      cleanUrl,
      {
        format: 'mp4',
        maxFilesize: '50M',
        output: outputPath,
        noPlaylist: true,
        userAgent
      },
      {
        timeout: 60000
      }
    );

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
      downloadedVideoPath = outputPath;
    }
  } catch (dlErr: any) {
    const errMsg = dlErr.stderr || dlErr.message || String(dlErr);
    console.error(`[GroqService] yt-dlp download failed for ${cleanUrl}: ${errMsg.slice(0, 500)}`);
  }

  // 2. If video was downloaded, run real Groq Whisper + LLM extraction
  if (downloadedVideoPath) {
    try {
      const analysis = await analyzeVideoWithGroq(downloadedVideoPath, existingCategories);
      const textSummary = formatAnalysisTextSummary(analysis, shortcode);
      return {
        status: 'SUCCESS',
        url: cleanUrl,
        shortcode,
        provider: 'groq',
        analysis,
        text_summary: textSummary,
        execution_time_ms: Date.now() - startTime,
        output_files: {
          json: `analysis_${shortcode}.json`,
          txt: `summary_${shortcode}.txt`
        }
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }

  // Clean up temporary directory if download did not succeed
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  // 3. Return explicit FAILED status with clear message if download failed
  return {
    status: 'FAILED',
    url: cleanUrl,
    shortcode,
    provider: 'groq',
    error: 'Could not download the video from this URL. Instagram/Facebook may be blocking automated downloads, or the link may be private/expired. Try uploading the video file directly instead.'
  };
}

export async function processBatchReelsWithGroq(
  urls: string[],
  existingCategories?: string[]
): Promise<BatchAnalysisResult> {
  const results: SingleReelResult[] = [];
  let successful = 0;
  let failed = 0;
  const currentCategories = [...(existingCategories || [])];

  for (const url of urls) {
    try {
      const result = await analyzeInstagramUrlWithGroq(url, currentCategories);
      results.push(result);
      if (result.status === 'SUCCESS' && result.analysis?.category) {
        successful++;
        if (!currentCategories.includes(result.analysis.category)) {
          currentCategories.push(result.analysis.category);
        }
      } else if (result.status === 'SUCCESS') {
        successful++;
      } else {
        failed++;
      }
    } catch (err: any) {
      failed++;
      results.push({
        status: 'FAILED',
        url,
        shortcode: extractShortcode(url),
        provider: 'groq',
        error: err.message || 'Batch item analysis failed.'
      });
    }
  }

  // Build combined summary
  const summaryDivider = '='.repeat(60);
  let combinedSummary = `${summaryDivider}\n BATCH INSTAGRAM REEL ANALYSIS REPORT\n Total Processed: ${urls.length} | Success: ${successful} | Failed: ${failed}\n Provider: Groq AI (Whisper Audio Transcription & High-Speed LLM)\n${summaryDivider}\n\n`;

  results.forEach((r, idx) => {
    combinedSummary += `--- REEL #${idx + 1}: ${r.shortcode} ---\n`;
    if (r.status === 'SUCCESS' && r.analysis) {
      combinedSummary += `Topic Summary: ${r.analysis.summary}\n`;
      if (r.analysis.is_list_content && r.analysis.list_items.length > 0) {
        combinedSummary += `List Format: ${r.analysis.list_title || 'Items'}\n`;
        r.analysis.list_items.forEach((item, i) => {
          combinedSummary += `  ${i + 1}. ${item}\n`;
        });
      }
      combinedSummary += `Dominant Mood: ${r.analysis.dominant_mood}\n`;
      combinedSummary += `Topic Category: ${r.analysis.category || r.analysis.content_type}\n`;
    } else {
      combinedSummary += `Status: FAILED - ${r.error}\n`;
    }
    combinedSummary += '\n';
  });

  return {
    status: successful > 0 ? 'COMPLETED' : 'FAILED',
    total: urls.length,
    successful,
    failed,
    results,
    combined_summary_text: combinedSummary,
    combined_files: {
      json: `batch_analysis_${Date.now()}.json`,
      txt: `batch_summary_${Date.now()}.txt`
    }
  };
}

export function formatAnalysisTextSummary(analysis: ServerReelAnalysis, titleOrShortcode: string): string {
  const line = '='.repeat(60);
  const subLine = '-'.repeat(60);

  let output = `${line}\n INSTAGRAM REEL CONTENT ANALYSIS: ${titleOrShortcode}\n${line}\n\n`;
  output += `🏷️ TOPIC CATEGORY: ${analysis.category || analysis.content_type || 'General'}\n`;
  output += `📌 CONTENT TYPE:   ${analysis.content_type || analysis.category || 'Video Content'}\n`;
  output += `🎭 DOMINANT MOOD:  ${analysis.dominant_mood}\n`;
  output += `🗣️ SPOKEN SPEECH:  ${analysis.has_speech ? 'Yes (Narration / Voice detected)' : 'No spoken speech detected'}\n\n`;

  output += `${subLine}\n📝 EXECUTIVE SUMMARY\n${subLine}\n`;
  output += `${analysis.summary}\n\n`;

  if (analysis.is_list_content && analysis.list_items && analysis.list_items.length > 0) {
    output += `${subLine}\n📋 LIST FORMAT DETECTED: ${analysis.list_title || 'Key Items'}\n${subLine}\n`;
    analysis.list_items.forEach((item, idx) => {
      output += `  ${idx + 1}. ${item}\n`;
    });
    output += '\n';
  }

  if (analysis.key_points && analysis.key_points.length > 0) {
    output += `${subLine}\n💡 KEY TAKEAWAYS & HIGHLIGHTS\n${subLine}\n`;
    analysis.key_points.forEach(point => {
      output += `  • ${point}\n`;
    });
    output += '\n';
  }

  if (analysis.spoken_content_summary) {
    output += `${subLine}\n🎙️ SPOKEN NARRATION & DIALOGUE SUMMARY\n${subLine}\n`;
    output += `${analysis.spoken_content_summary}\n\n`;
  }

  if (analysis.on_screen_text && analysis.on_screen_text.length > 0) {
    output += `${subLine}\n🔍 ON-SCREEN TEXT & GRAPHIC OCR\n${subLine}\n`;
    analysis.on_screen_text.forEach(txt => {
      output += `  [Text] ${txt}\n`;
    });
    output += '\n';
  }

  if (analysis.visual_description) {
    output += `${subLine}\n🎬 VISUAL SCENE & AESTHETIC BREAKDOWN\n${subLine}\n`;
    output += `${analysis.visual_description}\n\n`;
  }

  if (analysis.hashtag_suggestions && analysis.hashtag_suggestions.length > 0) {
    output += `${subLine}\n🏷️ RECOMMENDED HASHTAGS\n${subLine}\n`;
    output += `#${analysis.hashtag_suggestions.join(' #')}\n`;
  }

  output += `${line}`;
  return output;
}
