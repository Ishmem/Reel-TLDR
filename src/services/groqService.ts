import { Groq } from 'groq-sdk';
import youtubedl from 'yt-dlp-exec';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec, spawnSync } from 'child_process';
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

// Local override and binary resolution for yt-dlp
export function getLocalYtDlpOverride(): string | null {
  const isWindows = process.platform === 'win32';
  const localWinBin = path.join(process.cwd(), 'bin', 'yt-dlp.exe');
  const localUnixBin = path.join(process.cwd(), 'bin', 'yt-dlp');

  if (isWindows && fs.existsSync(localWinBin)) {
    return localWinBin;
  }
  if (!isWindows && fs.existsSync(localUnixBin)) {
    try {
      fs.chmodSync(localUnixBin, 0o755);
    } catch {}
    return localUnixBin;
  }

  // Cross-platform fallback check
  if (fs.existsSync(localWinBin)) {
    return localWinBin;
  }
  if (fs.existsSync(localUnixBin)) {
    try {
      fs.chmodSync(localUnixBin, 0o755);
    } catch {}
    return localUnixBin;
  }

  return null;
}

// Ensure yt-dlp binary is present and executable
let binaryEnsurePromise: Promise<string | null> | null = null;

export async function ensureYtDlpBinary(): Promise<string | null> {
  const localOverride = getLocalYtDlpOverride();
  if (localOverride) {
    return localOverride;
  }

  if (binaryEnsurePromise) return binaryEnsurePromise;

  binaryEnsurePromise = (async () => {
    const isWindows = process.platform === 'win32';
    const defaultBin = path.resolve(
      process.cwd(),
      isWindows ? 'node_modules/yt-dlp-exec/bin/yt-dlp.exe' : 'node_modules/yt-dlp-exec/bin/yt-dlp'
    );
    const tmpBin = path.join(os.tmpdir(), isWindows ? 'yt-dlp.exe' : 'yt-dlp-bin');

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
      const downloadUrl = isWindows
        ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
        : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
      await execAsync(`curl -sL "${downloadUrl}" -o "${tmpBin}" && chmod +x "${tmpBin}"`);
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

// Log startup binary path resolution for easy CLI / packaged .exe debugging
export function printResolvedYtDlpBinary(): void {
  const localOverride = getLocalYtDlpOverride();
  if (localOverride) {
    console.log(`[yt-dlp] Resolved active binary: "${localOverride}" (local override)`);
  } else {
    const isWindows = process.platform === 'win32';
    const defaultBin = path.resolve(
      process.cwd(),
      isWindows ? 'node_modules/yt-dlp-exec/bin/yt-dlp.exe' : 'node_modules/yt-dlp-exec/bin/yt-dlp'
    );
    console.log(`[yt-dlp] Resolved active binary: "${defaultBin}" (bundled / auto-managed default)`);
  }
}

export interface InstagramPostDetails {
  title: string;
  description: string;
  uploader: string;
  slideCount: number;
  isCarousel: boolean;
  slideImages: string[];
}

export async function extractInstagramPostDetails(
  url: string,
  shortcode: string
): Promise<InstagramPostDetails | null> {
  const localBin = getLocalYtDlpOverride() || await ensureYtDlpBinary() || 'yt-dlp';
  let title = '';
  let description = '';
  let uploader = '';
  let slideCount = 1;
  let isCarousel = false;
  const slideImages: string[] = [];

  // 1. Query yt-dlp with -J --no-warnings to extract full post metadata
  try {
    const res = spawnSync(localBin, [url, '-J', '--no-warnings', '--no-playlist'], {
      maxBuffer: 15 * 1024 * 1024,
      timeout: 25000
    });
    if (res.stdout && res.stdout.length > 0) {
      try {
        const data = JSON.parse(res.stdout.toString());
        title = data.title || '';
        description = data.description || '';
        uploader = data.channel || data.uploader || '';
        slideCount = data.playlist_count || (Array.isArray(data.entries) ? data.entries.length : 1);
        if (data._type === 'playlist' || slideCount > 1 || url.includes('/p/')) {
          isCarousel = true;
        }
      } catch (parseErr) {}
    }
  } catch (err: any) {
    console.warn(`[GroqService] yt-dlp metadata extraction note: ${err.message}`);
  }

  // 2. Fetch captioned embed to get additional caption & slide images if needed
  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const embedRes = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (embedRes.ok) {
      const html = await embedRes.text();
      if (!description) {
        const captionMatch = html.match(/<div class="Caption"[^>]*>([\s\S]*?)<\/div>/i);
        if (captionMatch) {
          description = captionMatch[1]
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
        }
      }

      const unescaped = html.replace(/\\\/\\\//g, '//').replace(/\\\//g, '/');
      const matches = unescaped.match(/https:\/\/scontent[^\s"<>]+/g) || [];
      const highRes = [...new Set(matches)].filter(u => u.includes('regular_photo') || u.includes('1080x1080') || u.includes('s1080x1080') || u.includes('dst-webp'));
      if (highRes.length > 0) {
        slideImages.push(...highRes.slice(0, 10));
        isCarousel = true;
        if (slideImages.length > slideCount) {
          slideCount = slideImages.length;
        }
      }
    }
  } catch (embedErr: any) {
    // continue
  }

  if (!description && !title && slideImages.length === 0) {
    return null;
  }

  return {
    title: title || `Instagram Post by ${uploader || shortcode}`,
    description,
    uploader: uploader || 'Instagram Creator',
    slideCount: Math.max(1, slideCount),
    isCarousel,
    slideImages
  };
}

export async function analyzeImageWithGroqVision(
  imageUrl: string,
  slideNumber: number
): Promise<string> {
  const groq = getGroqClient();
  const visionModels = [
    'qwen/qwen3.8-27b',
    'qwen/qwen3.6-27b',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'llama-3.2-11b-vision-preview'
  ];

  // If imageUrl is an external web link, preload buffer as base64 data URI to avoid external CDN 403 blocks
  let effectiveUrl = imageUrl;
  if (!effectiveUrl.startsWith('data:')) {
    try {
      const res = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 50) {
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          const mime = contentType.includes('png') ? 'image/png' : 'image/jpeg';
          effectiveUrl = `data:${mime};base64,${buffer.toString('base64')}`;
        }
      }
    } catch (fetchErr: any) {
      console.warn(`[GroqService] Direct image buffer preload note for slide ${slideNumber}: ${fetchErr.message}`);
    }
  }

  let lastError: any = null;

  for (const model of visionModels) {
    try {
      const response = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract ALL text, headings, and instructions visible in this image exactly as written. If this is a step/tip/setting from a tutorial or listicle, include the full instruction text, not just the title.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: effectiveUrl
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1200
      });

      const extracted = response.choices[0]?.message?.content || '';
      return extracted.trim();
    } catch (err: any) {
      lastError = err;
      console.warn(`[GroqService] Vision model ${model} failed for slide ${slideNumber}: ${err.message}. Trying next model...`);
    }
  }

  throw lastError || new Error(`Failed to analyze slide image ${slideNumber} with Groq Vision.`);
}

export async function analyzeCarouselContentWithGroq(
  postDetails: InstagramPostDetails,
  existingCategories?: string[]
): Promise<ServerReelAnalysis> {
  const categoryContext = existingCategories && existingCategories.length > 0
    ? `\nEXISTING CATEGORIES IN USER'S SAVED LIBRARY:\n${existingCategories.map(c => `- "${c}"`).join('\n')}\n\nIMPORTANT CATEGORIZATION RULE:\n- If this post's topic reasonably fits one of the existing categories above, REUSE that exact category name to prevent library fragmentation.\n- If and only if none of the existing categories fit, coin a new, specific, concise category (2-5 words, Title Case, e.g. "Cooking", "Book Recommendations", "Workout & Fitness", "AI Tools & Education").`
    : `\nCATEGORIZATION INSTRUCTION:\n- Provide a short, human-readable topic label in "category" describing what the content is actually about (2-5 words, Title Case, e.g. "Cooking", "Book Recommendations", "Workout & Fitness", "AI Tools & Education").`;

  // 1. Loop through postDetails.slideImages (capped at 10) and analyze each with Groq Vision
  const slideImages = (postDetails.slideImages || []).slice(0, 10);
  const slideResults: { slideNumber: number; text: string }[] = [];
  const concurrency = 2;

  if (slideImages.length > 0) {
    console.log(`[GroqService] Analyzing ${slideImages.length} carousel slide images with Groq Vision...`);
    for (let i = 0; i < slideImages.length; i += concurrency) {
      const chunk = slideImages.slice(i, i + concurrency);
      const chunkPromises = chunk.map(async (imageUrl, idx) => {
        const slideNumber = i + idx + 1;
        try {
          const extractedText = await analyzeImageWithGroqVision(imageUrl, slideNumber);
          return { slideNumber, text: extractedText };
        } catch (err: any) {
          console.warn(`[GroqService] Warning: Failed to analyze slide image ${slideNumber}: ${err.message}`);
          return { slideNumber, text: '' };
        }
      });

      const results = await Promise.all(chunkPromises);
      slideResults.push(...results);

      // Short delay between batches to respect rate limits
      if (i + concurrency < slideImages.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  // 2. Concatenate results into a labeled block:
  // SLIDE 1 CONTENT: <extracted text>
  // SLIDE 2 CONTENT: <extracted text>
  const validSlides = slideResults.filter(s => s.text && s.text.trim().length > 0);
  const labeledSlideBlocks = validSlides.map(s => `SLIDE ${s.slideNumber} CONTENT:\n${s.text.trim()}`);
  const concatenatedSlideContent = labeledSlideBlocks.join('\n\n');

  const slideContentSection = concatenatedSlideContent
    ? `\nSLIDE-BY-SLIDE CONTENT (EXTRACTED DIRECTLY FROM CAROUSEL SLIDE IMAGES VIA VISION AI):\n"""\n${concatenatedSlideContent}\n"""`
    : (slideImages.length > 0
        ? `\nSLIDE IMAGES EXTRACTED: ${slideImages.length} images (OCR/Vision could not read text from slides)`
        : '');

  const prompt = `Here is the extracted content, slide details, and metadata from an Instagram ${postDetails.isCarousel ? 'Carousel / Multi-Image Post' : 'Post'}:

CREATOR / UPLOADER: ${postDetails.uploader}
POST TITLE: ${postDetails.title}
SLIDES COUNT: ${postDetails.slideCount} slides
${slideContentSection}

POST CAPTION (USE FOR CONTEXT / FRAMING ONLY):
"""
${postDetails.description || postDetails.title}
"""
${categoryContext}

CRITICAL ACCURACY INSTRUCTIONS FOR CAROUSEL / MULTI-SLIDE CONTENT:
1. PRIMARY SOURCE OF TRUTH: Extract "list_items" and "key_points" PRIMARILY from the SLIDE-BY-SLIDE CONTENT block above (the real per-slide text, step titles, settings paths, and instructions). Use the caption only for framing/context — do NOT guess or invent vague placeholder items from the caption alone.
2. CONCRETE TUTORIAL / LISTICLE DETAILS: If this post is a tutorial, tips guide, or settings walkthrough, extract the exact concrete instructions and settings paths as written on each slide (e.g. "Kill the Glass Renderer — Settings > Accessibility > Display & Text Size > turn on Reduce Transparency"), NOT vague placeholder summaries (e.g. do NOT output generic phrases like "Setting 1 (Display/Motion)").
3. ON-SCREEN TEXT EXTRACTION: Populate "on_screen_text" with the actual extracted headings, featured steps, setting paths, and key text verbatim from each slide image.
4. If a slide contains a specific recommendation, app name, setting, or tip, ensure each distinct item corresponds to an entry in "list_items".

Please perform a complete content analysis of this Instagram post.
Extract all key points, list items (if it is a listicle, tool roundup, or multi-step guide), executive summary, topic category, and structure.
Return strictly a valid JSON object matching this exact schema:

{
  "summary": "2-4 concise sentences summarizing the post's actual subject matter and primary takeaway.",
  "is_list_content": true or false,
  "list_title": "Title of the list (e.g. '7 Practical AI YouTube Creators' or 'Speed-Up Settings') or null if not a list",
  "list_items": ["Item 1 (Title — Detailed instruction/setting)", "Item 2 (Title — Detailed instruction/setting)", ...],
  "key_points": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3"],
  "has_speech": false,
  "spoken_content_summary": "N/A - Instagram Carousel / Multi-Image graphic post.",
  "on_screen_text": ["Actual extracted headings, instructions, and text per slide"],
  "visual_description": "Description of the visual presentation and multi-slide layout",
  "dominant_mood": "e.g. High Energy / Actionable, Educational / Informative, Resourceful",
  "category": "Concise topic label (2-5 words, Title Case)",
  "content_type": "${postDetails.isCarousel ? 'Carousel / Resource Roundup' : 'Graphic / Post'}",
  "hashtag_suggestions": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`;

  const parsed = await queryGroqLLM(prompt, GROQ_SYSTEM_PROMPT);

  const rawCategory = (parsed.category || parsed.content_type || 'General').trim();
  let cleanCategory = rawCategory;
  if (existingCategories && existingCategories.length > 0) {
    const matched = existingCategories.find(c => c.trim().toLowerCase() === cleanCategory.toLowerCase());
    if (matched) cleanCategory = matched;
  }

  // Fallback for on_screen_text if LLM omitted it despite having slide content
  const extractedOnScreenText = Array.isArray(parsed.on_screen_text) && parsed.on_screen_text.length > 0
    ? parsed.on_screen_text
    : (validSlides.length > 0
        ? validSlides.map(s => `Slide ${s.slideNumber}: ${s.text.split('\n')[0].slice(0, 100)}`)
        : []);

  return {
    summary: parsed.summary || 'Carousel analysis completed.',
    is_list_content: Boolean(parsed.is_list_content || (parsed.list_items && parsed.list_items.length > 0)),
    list_title: parsed.list_title || (parsed.is_list_content ? 'Key Items' : null),
    list_items: Array.isArray(parsed.list_items) ? parsed.list_items : [],
    key_points: Array.isArray(parsed.key_points) && parsed.key_points.length > 0 ? parsed.key_points : ['Key insight extracted from post content.'],
    has_speech: false,
    spoken_content_summary: 'N/A - Image carousel / multi-slide graphic post.',
    on_screen_text: extractedOnScreenText,
    visual_description: parsed.visual_description || `Instagram multi-image carousel post by ${postDetails.uploader} featuring ${postDetails.slideCount} slides.`,
    dominant_mood: parsed.dominant_mood || 'Educational / Informative',
    category: cleanCategory,
    content_type: parsed.content_type || (postDetails.isCarousel ? 'Carousel / Multi-Image Post' : 'Post Content'),
    hashtag_suggestions: Array.isArray(parsed.hashtag_suggestions) ? parsed.hashtag_suggestions : ['instagram', 'content', 'explore', 'trending']
  };
}

export async function analyzeInstagramUrlWithGroq(
  url: string,
  existingCategories?: string[]
): Promise<SingleReelResult> {
  const startTime = Date.now();
  const cleanUrl = url.trim();
  const shortcode = extractShortcode(cleanUrl);

  // 1. Try downloading video with yt-dlp
  const tempDir = path.join(os.tmpdir(), `reel_dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  let downloadedVideoPath: string | null = null;
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  try {
    fs.mkdirSync(tempDir, { recursive: true });
    const outputPath = path.join(tempDir, 'video.mp4');

    const localOverride = getLocalYtDlpOverride();
    let ytRunner: any;

    if (localOverride) {
      // Use local override binary directly via yt-dlp-exec create()
      ytRunner = typeof (youtubedl as any).create === 'function'
        ? (youtubedl as any).create(localOverride)
        : youtubedl;
    } else {
      // Fall back to yt-dlp-exec's default auto-managed binary
      const autoBin = await ensureYtDlpBinary();
      ytRunner = autoBin && typeof (youtubedl as any).create === 'function'
        ? (youtubedl as any).create(autoBin)
        : youtubedl;
    }

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
    let errMsg = dlErr.stderr || dlErr.message || String(dlErr);
    // Sanitize Python version deprecation warnings so they do not pollute logs
    errMsg = errMsg.replace(/Deprecated Feature: Support for Python version [^\n]*\n?/gi, '').trim();
    if (errMsg) {
      console.warn(`[GroqService] yt-dlp video stream note for ${cleanUrl}: ${errMsg.slice(0, 300)}`);
    }
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

  // 3. Fallback: If video download was not possible (e.g. carousel / photo post, or video stream restricted),
  // extract post details, caption, and slide images and analyze with Groq LLM
  try {
    console.log(`[GroqService] Video stream not found or URL is a carousel post. Attempting Instagram post & carousel extraction for ${cleanUrl}...`);
    const postDetails = await extractInstagramPostDetails(cleanUrl, shortcode);
    if (postDetails && (postDetails.description || postDetails.title || postDetails.slideImages.length > 0)) {
      console.log(`[GroqService] Successfully extracted ${postDetails.isCarousel ? 'carousel' : 'post'} metadata (${postDetails.slideCount} slides). Running Groq structuring...`);
      const analysis = await analyzeCarouselContentWithGroq(postDetails, existingCategories);
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
    }
  } catch (postErr: any) {
    console.error(`[GroqService] Post extraction fallback failed for ${cleanUrl}: ${postErr.message}`);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }

  // 4. Return explicit FAILED status with clear message if download and carousel fallback failed
  return {
    status: 'FAILED',
    url: cleanUrl,
    shortcode,
    provider: 'groq',
    error: 'Could not download the video or extract carousel content from this URL. The link may be private or expired. Try uploading the video file or image directly instead.'
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
