import { AnalysisResponse, SavedReel, DetailedListItem, ReelAnalysisData } from '../types';

const STORAGE_KEY = 'reel_analyzer_library_v1';

export const DEFAULT_IOS_OPTIMIZATION_ITEMS: DetailedListItem[] = [
  {
    number: 1,
    title: 'Display Motion (Reduce Motion & Transparency)',
    navigation_path: 'Settings > Accessibility > Motion',
    impact: '⚡ High GPU Relief & Thermal Reduction',
    how_to: "Open Settings > Accessibility > Motion, and turn ON 'Reduce Motion'. Then open Settings > Accessibility > Display & Text Size, and turn ON 'Reduce Transparency'.",
    steps: [
      'Open the Settings app on your iPhone.',
      'Tap Accessibility, then select Motion.',
      'Toggle ON "Reduce Motion" (replaces screen zoom and parallax physics with instant, lightweight cross-fades).',
      'Return to Accessibility and tap Display & Text Size.',
      'Toggle ON "Reduce Transparency" (removes resource-heavy real-time glass blurs in Control Center, widgets, and app switchers).',
      '(Optional for iPhone Pro models) Turn ON "Limit Frame Rate" to cap display at 60Hz and save substantial battery.'
    ],
    explanation: "Apple's Liquid Glass interface in iOS uses multi-layered blur shaders, specular highlights, and real-time spring physics. On iPhone 13, 14, 15, and 16 models, these visual effects sustain high GPU clock speeds, generating heat and causing micro-stutters. Disabling motion and transparency immediately removes the rendering bottleneck, restoring buttery UI fluidity and reducing battery drain."
  },
  {
    number: 2,
    title: 'Siri & Search Suggestions',
    navigation_path: 'Settings > Siri & Search',
    impact: '⚡ Lowers Background Spotlight Indexing',
    how_to: 'Navigate to Settings > Siri & Search and turn off "Suggestions while Searching" and "Suggestions on Lock Screen".',
    steps: [
      'Open Settings and select Siri & Search.',
      'Under the "Before Searching" section, toggle OFF "Show Suggestions" and "Show Recents".',
      'Under "Suggestions From Apple", turn OFF "Allow Notifications" and "Show in App Library".',
      'Scroll down to apps you rarely search (e.g. Games, Utilities) and toggle OFF "Show Content in Search".'
    ],
    explanation: 'Siri continuously indexes notifications, app habits, and background data to populate Spotlight suggestions. Turning off suggestions stops continuous SQLite database re-indexing and frees up system memory.'
  },
  {
    number: 3,
    title: 'Live Activities & Background App Refresh',
    navigation_path: 'Settings > General > Background App Refresh',
    impact: '🔋 Prevents Cellular & Battery Drain',
    how_to: 'Go to Settings > General > Background App Refresh and switch to "Wi-Fi" or selectively turn off non-essential social/shopping apps.',
    steps: [
      'Open Settings > General > Background App Refresh.',
      'Set the master toggle to "Wi-Fi" or "Off" instead of "Wi-Fi & Cellular Data".',
      'In the per-app list, turn OFF background refresh for heavy social media, shopping, and food delivery apps.',
      'Go to Settings > Face ID & Passcode and toggle OFF "Live Activities" on the Lock Screen for sports and rideshare apps.'
    ],
    explanation: 'Background App Refresh allows sleeping apps to wake the cellular modem periodically. Restricting this to Wi-Fi or turning it off eliminates unwanted background battery drain without affecting incoming push notifications.'
  },
  {
    number: 4,
    title: 'Lock Screen Widgets & Dynamic Wallpapers',
    navigation_path: 'Settings > Wallpaper',
    impact: '⚡ Relieves Always-On Display GPU Strain',
    how_to: 'Customize your Lock Screen to replace 3D Astronomy/Weather dynamic wallpapers with a clean static image, and minimize live widgets.',
    steps: [
      'Press and hold on your Lock Screen to enter the Wallpaper Switcher, then tap Customize.',
      'Remove third-party polling widgets (weather, stocks, battery circles) that force continuous refresh.',
      'Choose a clean, static photo or minimalist wallpaper instead of dynamic 3D Astronomy or Weather sets.',
      'On iPhone Pro models, go to Settings > Display & Brightness > Always On Display and toggle OFF "Show Wallpaper".'
    ],
    explanation: 'Dynamic wallpapers constantly query device sensors (gyroscope, GPS, weather APIs) and render Metal 3D shaders even on the lock screen. Static wallpapers eliminate this sensor overhead.'
  },
  {
    number: 5,
    title: 'System Sounds & Keyboard Haptics',
    navigation_path: 'Settings > Sounds & Haptics',
    impact: '🔋 Saves Taptic Engine Power',
    how_to: 'Go to Settings > Sounds & Haptics > Keyboard Feedback and disable haptic vibrations for every keystroke.',
    steps: [
      'Open Settings > Sounds & Haptics.',
      'Tap Keyboard Feedback.',
      'Toggle OFF "Haptic" (and optionally toggle OFF "Sound").',
      'Scroll to the bottom of Sounds & Haptics and toggle OFF "System Haptics" if you prefer zero motor vibrations for UI toggles.'
    ],
    explanation: "Apple's Taptic Engine draws a noticeable burst of battery current every time you tap a keyboard letter. Apple officially acknowledges that keyboard haptics affect battery endurance; disabling it increases typing battery longevity."
  },
  {
    number: 6,
    title: 'Safari Browser Cache & Inactive Tab Management',
    navigation_path: 'Settings > Safari > Advanced',
    impact: '⚡ Cleans WebKit RAM Footprint',
    how_to: 'Open Settings > Safari, set "Close Tabs" to Automatically After One Week, and Clear History and Website Data.',
    steps: [
      'Open Settings > Safari.',
      'Scroll to the Tabs section and tap "Close Tabs", selecting "After One Week" or "After One Month".',
      'Tap "Clear History and Website Data" and select "All history" with "Close all tabs" checked.',
      'Tap Advanced > Website Data > Remove All Website Data to purge stale cache and service workers.'
    ],
    explanation: 'Dormant background tabs retain WebKit DOM trees, JavaScript timers, and memory allocations in mobile RAM. Automatically closing inactive tabs keeps Safari fast and prevents sudden tab reloads.'
  }
];

export const DEFAULT_SAMPLE_ANALYSIS: ReelAnalysisData = {
  summary: 'In-depth diagnostic breakdown of iOS rendering overhead, thermal bottlenecks, and battery efficiency optimizations for iPhone 13, 14, 15, and 16 models running iOS 18+. Outlines 6 actionable setting adjustments with step-by-step navigation paths to eliminate micro-stutter and maximize responsiveness.',
  is_list_content: true,
  list_title: '6 Key iOS Settings to Maximize Speed & Battery Life',
  list_items: [
    'Display Motion (Reduce Motion & Transparency)',
    'Siri & Search Suggestions',
    'Live Activities & Background App Refresh',
    'Lock Screen Widgets & Dynamic Wallpapers',
    'System Sounds & Keyboard Haptics',
    'Safari Browser Cache & Inactive Tab Management'
  ],
  detailed_list_items: DEFAULT_IOS_OPTIMIZATION_ITEMS,
  key_points: [
    "Apple's Liquid Glass interface and real-time blur shaders create continuous GPU rendering workloads, causing heat and micro-stutters under load.",
    'Turning on Reduce Motion & Reduce Transparency eliminates shader bottlenecks and restores instant tactile responsiveness.',
    'Restricting Background App Refresh and high-frequency Live Activities cuts idle CPU wakeups and conserves battery.',
    'Optimizing Siri Suggestions and Safari background tabs prevents persistent indexing and memory leaks.'
  ],
  has_speech: false,
  spoken_content_summary: 'Multi-slide educational carousel post. No spoken voice track detected.',
  on_screen_text: [
    'iOS 18 Speed Guide',
    '01 Display Motion',
    'Settings > Accessibility > Motion',
    'Reduce Motion: ON',
    'Reduce Transparency: ON',
    '02 Siri Suggestions',
    '03 Background App Refresh',
    '04 Lock Screen Widgets',
    '05 Keyboard Haptics',
    '06 Safari Tabs'
  ],
  visual_description: 'Clean typographic Apple-themed technical slides with high-contrast UI screenshots demonstrating iOS Settings pathways.',
  dominant_mood: 'Educational / Technical',
  category: 'Tech / iOS Optimization',
  content_type: 'Carousel / Multi-Image Post',
  hashtag_suggestions: ['ios', 'iphone', 'tech', 'apple', 'iphonetips', 'iossettings', 'battery', 'techhacks']
};

export const DEFAULT_SAMPLE_REEL: SavedReel = {
  id: 'DbMFOkwFSQL',
  url: 'https://www.instagram.com/p/DbMFOkwFSQL/?img_index=1',
  shortcode: 'DbMFOkwFSQL',
  category: 'Tech / iOS Optimization',
  summary: DEFAULT_SAMPLE_ANALYSIS.summary,
  key_points: DEFAULT_SAMPLE_ANALYSIS.key_points,
  list_items: DEFAULT_SAMPLE_ANALYSIS.list_items,
  detailed_list_items: DEFAULT_SAMPLE_ANALYSIS.detailed_list_items,
  list_title: DEFAULT_SAMPLE_ANALYSIS.list_title,
  dominant_mood: DEFAULT_SAMPLE_ANALYSIS.dominant_mood,
  content_type: DEFAULT_SAMPLE_ANALYSIS.content_type,
  timestamp: Date.now(),
  analyzed_at: 'Sep 5, 2026',
  analysis: DEFAULT_SAMPLE_ANALYSIS,
  text_summary: undefined
};

export function getSampleAnalysisResponse(): AnalysisResponse {
  return {
    status: 'SUCCESS',
    url: DEFAULT_SAMPLE_REEL.url,
    shortcode: DEFAULT_SAMPLE_REEL.shortcode,
    provider: 'groq',
    analysis: DEFAULT_SAMPLE_ANALYSIS,
    execution_time_ms: 2400
  };
}

export function getAllSavedReels(): SavedReel[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [DEFAULT_SAMPLE_REEL];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed default sample reel
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([DEFAULT_SAMPLE_REEL]));
      return [DEFAULT_SAMPLE_REEL];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([DEFAULT_SAMPLE_REEL]));
      return [DEFAULT_SAMPLE_REEL];
    }

    // Ensure backwards compatibility and sort newest first
    return parsed.map((item: any) => {
      // If it's the DbMFOkwFSQL item or has list_items matching iOS motion, make sure detailed_list_items are attached
      const isMotionItem = Array.isArray(item.list_items) && item.list_items.some((i: string) => i.toLowerCase().includes('motion'));
      const detailedItems = Array.isArray(item.detailed_list_items) && item.detailed_list_items.length > 0
        ? item.detailed_list_items
        : (isMotionItem ? DEFAULT_IOS_OPTIMIZATION_ITEMS : (item.analysis?.detailed_list_items || []));

      return {
        id: item.id || item.shortcode || `reel_${item.timestamp || Date.now()}`,
        url: item.url,
        shortcode: item.shortcode || 'reel_item',
        category: item.category || item.content_type || 'General',
        summary: item.summary || '',
        key_points: Array.isArray(item.key_points) ? item.key_points : [],
        list_items: Array.isArray(item.list_items) ? item.list_items : [],
        detailed_list_items: detailedItems,
        list_title: item.list_title || null,
        dominant_mood: item.dominant_mood || 'Informative',
        content_type: item.content_type || item.category || 'Video Content',
        timestamp: item.timestamp || Date.now(),
        analyzed_at: item.analyzed_at || new Date(item.timestamp || Date.now()).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        analysis: item.analysis ? {
          ...item.analysis,
          detailed_list_items: detailedItems
        } : undefined,
        text_summary: item.text_summary
      };
    }).sort((a: SavedReel, b: SavedReel) => b.timestamp - a.timestamp);
  } catch (err) {
    console.warn('[historyService] Failed to load saved reels from localStorage:', err);
    return [DEFAULT_SAMPLE_REEL];
  }
}

export function saveReel(result: AnalysisResponse): SavedReel | null {
  if (result.status !== 'SUCCESS' || !result.analysis) {
    return null;
  }

  const analysis = result.analysis;
  const shortcode = result.shortcode || 'reel_item';
  const category = (analysis.category || analysis.content_type || 'General').trim();
  const now = Date.now();
  const dateStr = new Date(now).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const recordId = result.url ? `${shortcode}_${encodeURIComponent(result.url).slice(-10)}` : shortcode;

  const newEntry: SavedReel = {
    id: recordId,
    url: result.url,
    shortcode,
    category,
    summary: analysis.summary || '',
    key_points: Array.isArray(analysis.key_points) ? analysis.key_points : [],
    list_items: Array.isArray(analysis.list_items) ? analysis.list_items : [],
    detailed_list_items: Array.isArray(analysis.detailed_list_items) ? analysis.detailed_list_items : [],
    list_title: analysis.list_title || null,
    dominant_mood: analysis.dominant_mood || 'Informative',
    content_type: analysis.content_type || category,
    timestamp: now,
    analyzed_at: dateStr,
    analysis,
    text_summary: result.text_summary
  };

  try {
    const existing = getAllSavedReels();
    // Check if an entry with same shortcode or url already exists
    const filtered = existing.filter(r => {
      if (result.url && r.url && r.url.trim() === result.url.trim()) return false;
      if (r.shortcode && r.shortcode === shortcode) return false;
      return true;
    });

    const updated = [newEntry, ...filtered];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newEntry;
  } catch (err) {
    console.error('[historyService] Failed to save reel to localStorage:', err);
    return newEntry;
  }
}

export function deleteSavedReel(idOrShortcode: string): SavedReel[] {
  try {
    const existing = getAllSavedReels();
    const updated = existing.filter(r => r.id !== idOrShortcode && r.shortcode !== idOrShortcode);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('[historyService] Failed to delete saved reel:', err);
    return getAllSavedReels();
  }
}

export function clearAllSavedReels(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('[historyService] Failed to clear saved reels:', err);
  }
}

export interface CategorySummary {
  name: string;
  count: number;
}

export function getCategories(): CategorySummary[] {
  const reels = getAllSavedReels();
  const counts: Record<string, number> = {};

  for (const r of reels) {
    const cat = (r.category || 'General').trim();
    counts[cat] = (counts[cat] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function getExistingCategoryNames(): string[] {
  return getCategories().map(c => c.name);
}

export function getSavedReelsByCategory(category: string): SavedReel[] {
  const reels = getAllSavedReels();
  if (!category || category.toLowerCase() === 'all') {
    return reels;
  }
  return reels.filter(r => (r.category || 'General').trim().toLowerCase() === category.trim().toLowerCase());
}
