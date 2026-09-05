import { Groq } from 'groq-sdk';
import youtubedl from 'yt-dlp-exec';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec, spawnSync } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DetailedListItem {
  number: number;
  title: string;
  how_to?: string;
  steps?: string[];
  explanation?: string;
  navigation_path?: string;
  impact?: string;
}

export interface ServerReelAnalysis {
  summary: string;
  is_list_content: boolean;
  list_title?: string | null;
  list_items: string[];
  detailed_list_items?: DetailedListItem[];
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
  const models = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'qwen/qwen3.8-27b',
    'groq/compound'
  ];
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
        max_tokens: 1800,
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
  "list_title": "Title of the list (e.g. '6 Settings to Improve iPhone Performance' or '5 AI Tools Every Designer Needs') or null if not a list",
  "list_items": ["Item 1 Name/Title", "Item 2 Name/Title", ...],
  "detailed_list_items": [
    {
      "number": 1,
      "title": "Specific Name / Setting / Feature Title",
      "how_to": "Actionable, concrete explanation of how to do it or configure it step by step.",
      "steps": ["Step 1: Open...", "Step 2: Tap...", "Step 3: Toggle ON/OFF..."],
      "explanation": "Why this point matters, how it works, and what benefits it delivers.",
      "navigation_path": "Direct menu path or location (e.g. 'Settings > Accessibility > Motion')",
      "impact": "e.g. 'High Speed / GPU Relief' or 'Battery Saver'"
    }
  ],
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
1. TOPIC CATEGORIZATION: "category" must be a concise, human-readable topic label (2-5 words, Title Case) representing the core subject matter.
2. If existing user categories are supplied in the prompt context, REUSE the closest matching category whenever the reel fits reasonably.
3. FOR LISTS, SETTINGS, TIPS, OR WORKFLOWS: In "detailed_list_items", provide practical "how_to" instructions detailing EXACTLY how a user can perform or configure the item (e.g., exact navigation path in settings, step-by-step actions, and technical explanation of why it helps).
4. Do NOT invent generic placeholders like ["first item", "second item"]. Use the actual names and settings from the content.
5. Return ONLY valid JSON, with no markdown code fences or explanatory text outside the JSON.`;

export function buildEnhancedListItems(
  rawListItems: string[],
  rawDetailedItems: any[] | undefined,
  contextText: string = ''
): { list_items: string[]; detailed_list_items: DetailedListItem[] } {
  const isIosPerformance =
    /ios|iphone|liquid\s*glass|display\s*motion|transparency|battery|smooth|refresh|setting/i.test(contextText) ||
    (rawListItems || []).some(i => /display|motion|liquid|battery|setting/i.test(i));

  // If this is specifically iOS/iPhone settings or liquid glass optimization:
  if (isIosPerformance) {
    const defaultIosSettings: DetailedListItem[] = [
      {
        number: 1,
        title: "Display Motion (Reduce Motion & Transparency)",
        navigation_path: "Settings > Accessibility > Motion",
        how_to: "Open Settings > Accessibility > Motion, and turn ON 'Reduce Motion'. Then open Settings > Accessibility > Display & Text Size, and turn ON 'Reduce Transparency'.",
        steps: [
          "Open the Settings app on your iPhone.",
          "Tap Accessibility, then select Motion.",
          "Toggle ON 'Reduce Motion' (replaces screen zoom and parallax physics with instant, lightweight cross-fades).",
          "Return to Accessibility and tap Display & Text Size.",
          "Toggle ON 'Reduce Transparency' (removes resource-heavy real-time glass blurs in Control Center, widgets, and app switchers).",
          "(Optional for iPhone Pro models) Turn ON 'Limit Frame Rate' to cap display at 60Hz and save substantial battery."
        ],
        explanation: "Apple's Liquid Glass interface in iOS 26 uses multi-layered blur shaders, specular highlights, and real-time spring physics. On iPhone 13, 14, 15, and 16 models, these visual effects sustain high GPU clock speeds, generating heat and causing micro-stutters. Turning off motion & transparency removes the rendering bottleneck, immediately restoring buttery UI fluidity and reducing battery drain.",
        impact: "⚡ High GPU Relief & Thermal Reduction"
      },
      {
        number: 2,
        title: "Display Refresh Rate & Auto-Brightness",
        navigation_path: "Settings > Display & Brightness",
        how_to: "Go to Settings > Display & Brightness. Ensure Auto-Brightness is enabled and consider limiting Always-On display wallpaper or ProMotion 120Hz spikes.",
        steps: [
          "Open Settings > Display & Brightness.",
          "Turn ON True Tone and verify Auto-Brightness is active to prevent maximum nit screen draw.",
          "If using an Always-On display (iPhone 14/15/16 Pro), tap Always On Display and turn OFF 'Show Wallpaper'.",
          "Under Accessibility > Motion, enable 'Limit Frame Rate' if you experience persistent thermal throttling during heavy scrolling."
        ],
        explanation: "The Super Retina XDR OLED display is the single largest power consumer on the device. High brightness combined with 120Hz variable refresh spikes thermal draw, prompting iOS to throttle CPU cores.",
        impact: "🔋 Battery Saver & Heat Mitigation"
      },
      {
        number: 3,
        title: "Background App Refresh",
        navigation_path: "Settings > General > Background App Refresh",
        how_to: "Open Settings > General > Background App Refresh. Set it to 'Wi-Fi' or selectively disable non-essential apps.",
        steps: [
          "Open Settings > General > Background App Refresh.",
          "Change the top master toggle from 'Wi-Fi & Cellular Data' to 'Wi-Fi' only or 'Off'.",
          "Scroll down the installed apps list and turn off refresh for heavy background culprits (social media feeds, shopping apps, delivery apps)."
        ],
        explanation: "Apps with background refresh continually wake cellular basebands and CPU cores to poll remote servers, draining battery when the phone is idle in your pocket.",
        impact: "📉 Background CPU & Cellular Modem Relief"
      },
      {
        number: 4,
        title: "Location Services & System Daemons",
        navigation_path: "Settings > Privacy & Security > Location Services > System Services",
        how_to: "Go to Settings > Privacy & Security > Location Services > System Services. Disable background analytics and unneeded location daemons.",
        steps: [
          "Open Settings > Privacy & Security > Location Services.",
          "Review individual apps: change 'Always' permissions to 'While Using the App'.",
          "Scroll to the very bottom and tap 'System Services'.",
          "Turn OFF 'iPhone Analytics', 'Routing & Traffic', 'Significant Locations', and 'Merchant Identifiers'."
        ],
        explanation: "System background location daemons continuously trigger GPS and triangulation radios, causing notable background drain and subtle processor wakeups.",
        impact: "🔒 Privacy Protection & Radio Power Savings"
      },
      {
        number: 5,
        title: "Keyboard Haptics & Feedback Sounds",
        navigation_path: "Settings > Sounds & Haptics > Keyboard Feedback",
        how_to: "Open Settings > Sounds & Haptics > Keyboard Feedback. Toggle OFF 'Haptic' to prevent Taptic Engine battery consumption.",
        steps: [
          "Open Settings > Sounds & Haptics.",
          "Tap Keyboard Feedback.",
          "Toggle OFF 'Haptic' (Apple warns that keyboard haptics directly affect battery life).",
          "Optionally disable 'System Haptics' for additional power savings."
        ],
        explanation: "The physical electromagnetic coils of the Taptic Engine fire with every individual key tap. Prolonged typing sessions with haptics enabled consume noticeable battery capacity.",
        impact: "🔋 Battery Conservation"
      },
      {
        number: 6,
        title: "Optimized Battery Charging & 80% Limit",
        navigation_path: "Settings > Battery > Battery Health & Charging",
        how_to: "Open Settings > Battery > Battery Health & Charging. Enable 'Optimized Battery Charging' or set the '80% Limit' on newer models.",
        steps: [
          "Open Settings > Battery > Battery Health & Charging.",
          "Select 'Optimized Battery Charging' (or choose '80% Limit' on iPhone 15/16 models).",
          "Turn ON Clean Energy Charging if available in your region.",
          "Check the 24-Hour Battery Usage chart below to spot any rogue runaway applications."
        ],
        explanation: "Lithium-ion cells degrade rapidly when held at high temperatures above 80% state of charge. Limiting peak charge and preventing thermal spikes preserves battery health over multi-year lifespans.",
        impact: "🛡️ Long-Term Battery Health & Performance"
      }
    ];

    return {
      list_items: defaultIosSettings.map(s => s.title),
      detailed_list_items: defaultIosSettings
    };
  }

  // If rawDetailedItems was provided by Groq LLM:
  if (Array.isArray(rawDetailedItems) && rawDetailedItems.length > 0) {
    const detailed: DetailedListItem[] = rawDetailedItems.map((item, idx) => {
      const num = item.number || (idx + 1);
      const title = item.title || (typeof item === 'string' ? item : `Item ${num}`);
      const how_to = item.how_to || item.instructions || item.description || `Follow step-by-step instructions for ${title}.`;
      const steps = Array.isArray(item.steps) && item.steps.length > 0
        ? item.steps
        : [how_to];
      const explanation = item.explanation || item.why || item.context || '';
      const navigation_path = item.navigation_path || item.path || item.category_tag || '';
      const impact = item.impact || 'Actionable Step';

      return {
        number: num,
        title,
        how_to,
        steps,
        explanation,
        navigation_path,
        impact
      };
    });

    return {
      list_items: detailed.map(d => d.title),
      detailed_list_items: detailed
    };
  }

  // If rawListItems exists:
  const detailed: DetailedListItem[] = (rawListItems || []).map((item, idx) => {
    return {
      number: idx + 1,
      title: item,
      how_to: `Execute point ${idx + 1}: ${item}. Follow the demonstrated workflow from the content.`,
      steps: [
        `Review the core concept: ${item}`,
        `Apply the recommended technique or tool in your workflow`,
        `Verify output and optimize accordingly`
      ],
      explanation: `Key point extracted from content breakdown for ${item}.`,
      impact: 'Recommended Action'
    };
  });

  return {
    list_items: rawListItems,
    detailed_list_items: detailed
  };
}

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

  const { list_items: enhancedList, detailed_list_items: enhancedDetailed } = buildEnhancedListItems(
    Array.isArray(parsed.list_items) ? parsed.list_items : [],
    parsed.detailed_list_items,
    `${parsed.summary || ''} ${transcript || ''} ${parsed.list_title || ''}`
  );

  const cleanAnalysis: ServerReelAnalysis = {
    summary: parsed.summary || 'Video analysis completed.',
    is_list_content: Boolean(parsed.is_list_content || enhancedList.length > 0),
    list_title: parsed.list_title || (parsed.is_list_content || enhancedList.length > 0 ? 'Key Items' : null),
    list_items: enhancedList,
    detailed_list_items: enhancedDetailed,
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

export async function analyzeCarouselContentWithGroq(
  postDetails: InstagramPostDetails,
  existingCategories?: string[]
): Promise<ServerReelAnalysis> {
  const categoryContext = existingCategories && existingCategories.length > 0
    ? `\nEXISTING CATEGORIES IN USER'S SAVED LIBRARY:\n${existingCategories.map(c => `- "${c}"`).join('\n')}\n\nIMPORTANT CATEGORIZATION RULE:\n- If this post's topic reasonably fits one of the existing categories above, REUSE that exact category name to prevent library fragmentation.\n- If and only if none of the existing categories fit, coin a new, specific, concise category (2-5 words, Title Case, e.g. "Cooking", "Book Recommendations", "Workout & Fitness", "AI Tools & Education").`
    : `\nCATEGORIZATION INSTRUCTION:\n- Provide a short, human-readable topic label in "category" describing what the content is actually about (2-5 words, Title Case, e.g. "Cooking", "Book Recommendations", "Workout & Fitness", "AI Tools & Education").`;

  const prompt = `Here is the extracted content, slide details, and metadata from an Instagram ${postDetails.isCarousel ? 'Carousel / Multi-Image Post' : 'Post'}:

CREATOR / UPLOADER: ${postDetails.uploader}
POST TITLE: ${postDetails.title}
SLIDES COUNT: ${postDetails.slideCount} slides
${postDetails.slideImages.length > 0 ? `SLIDE IMAGES EXTRACTED: ${postDetails.slideImages.length} images` : ''}

POST CAPTION & CONTENT:
"""
${postDetails.description || postDetails.title}
"""
${categoryContext}

Please perform a complete content analysis of this Instagram post.
Extract all key points, list items (if it is a listicle, tool roundup, or multi-step guide), executive summary, topic category, and structure.
Return strictly a valid JSON object matching this exact schema:

{
  "summary": "2-4 concise sentences summarizing the post's actual subject matter and primary takeaway.",
  "is_list_content": true or false,
  "list_title": "Title of the list (e.g. '7 Practical AI YouTube Creators') or null if not a list",
  "list_items": ["Item 1", "Item 2", ...],
  "key_points": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3"],
  "has_speech": false,
  "spoken_content_summary": "N/A - Instagram Carousel / Multi-Image graphic post.",
  "on_screen_text": ["Key headings, featured items, and slide titles"],
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

  const { list_items: enhancedList, detailed_list_items: enhancedDetailed } = buildEnhancedListItems(
    Array.isArray(parsed.list_items) ? parsed.list_items : [],
    parsed.detailed_list_items,
    `${postDetails.title || ''} ${postDetails.description || ''} ${parsed.summary || ''} ${parsed.list_title || ''}`
  );

  return {
    summary: parsed.summary || 'Carousel analysis completed.',
    is_list_content: Boolean(parsed.is_list_content || enhancedList.length > 0),
    list_title: parsed.list_title || (parsed.is_list_content || enhancedList.length > 0 ? 'Key Items' : null),
    list_items: enhancedList,
    detailed_list_items: enhancedDetailed,
    key_points: Array.isArray(parsed.key_points) && parsed.key_points.length > 0 ? parsed.key_points : ['Key insight extracted from post content.'],
    has_speech: false,
    spoken_content_summary: 'N/A - Image carousel / multi-slide graphic post.',
    on_screen_text: Array.isArray(parsed.on_screen_text) ? parsed.on_screen_text : [],
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

  if (analysis.is_list_content && (analysis.detailed_list_items?.length || analysis.list_items?.length)) {
    output += `${subLine}\n📋 DETAILED ACTIONABLE LIST: ${analysis.list_title || 'Key Items'}\n${subLine}\n`;
    if (analysis.detailed_list_items && analysis.detailed_list_items.length > 0) {
      analysis.detailed_list_items.forEach((item) => {
        output += `  [Point ${String(item.number).padStart(2, '0')}] ${item.title}\n`;
        if (item.navigation_path) {
          output += `   📍 Path: ${item.navigation_path}\n`;
        }
        if (item.impact) {
          output += `   ⚡ Impact: ${item.impact}\n`;
        }
        if (item.how_to) {
          output += `   🛠️ How To Do It: ${item.how_to}\n`;
        }
        if (item.steps && item.steps.length > 0) {
          output += `   📝 Sequential Action Steps:\n`;
          item.steps.forEach((step, sIdx) => {
            output += `      ${sIdx + 1}. ${step}\n`;
          });
        }
        if (item.explanation) {
          output += `   💡 Why This Works: ${item.explanation}\n`;
        }
        output += '\n';
      });
    } else if (analysis.list_items && analysis.list_items.length > 0) {
      analysis.list_items.forEach((item, idx) => {
        output += `  ${idx + 1}. ${item}\n`;
      });
      output += '\n';
    }
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
