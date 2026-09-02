import { AnalysisResponse, SavedReel } from '../types';

const STORAGE_KEY = 'reel_analyzer_library_v1';

export function getAllSavedReels(): SavedReel[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Ensure backwards compatibility and sort newest first
    return parsed.map((item: any) => ({
      id: item.id || item.shortcode || `reel_${item.timestamp || Date.now()}`,
      url: item.url,
      shortcode: item.shortcode || 'reel_item',
      category: item.category || item.content_type || 'General',
      summary: item.summary || '',
      key_points: Array.isArray(item.key_points) ? item.key_points : [],
      list_items: Array.isArray(item.list_items) ? item.list_items : [],
      list_title: item.list_title || null,
      dominant_mood: item.dominant_mood || 'Informative',
      content_type: item.content_type || item.category || 'Video Content',
      timestamp: item.timestamp || Date.now(),
      analyzed_at: item.analyzed_at || new Date(item.timestamp || Date.now()).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      analysis: item.analysis,
      text_summary: item.text_summary
    })).sort((a: SavedReel, b: SavedReel) => b.timestamp - a.timestamp);
  } catch (err) {
    console.warn('[historyService] Failed to load saved reels from localStorage:', err);
    return [];
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
