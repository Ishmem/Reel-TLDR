import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  ExternalLink,
  Trash2,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Tag,
  Smile,
  ListOrdered,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  Search,
  Code2,
  FileText
} from 'lucide-react';
import { SavedReel, AnalysisResponse } from '../types';
import {
  getAllSavedReels,
  deleteSavedReel,
  clearAllSavedReels,
  getCategories
} from '../services/historyService';

interface LibraryViewProps {
  onAnalyzeReelClick: () => void;
  onOpenInViewer?: (result: AnalysisResponse) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onAnalyzeReelClick,
  onOpenInViewer
}) => {
  const [reels, setReels] = useState<SavedReel[]>(() => getAllSavedReels());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedReelId, setExpandedReelId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  // Refresh data from storage
  const refreshReels = () => {
    setReels(getAllSavedReels());
  };

  // Categories with counts
  const categoriesList = useMemo(() => {
    return getCategories();
  }, [reels]);

  // Filtered reels based on category and search query
  const filteredReels = useMemo(() => {
    let result = reels;
    if (selectedCategory !== 'all') {
      result = result.filter(
        r => (r.category || 'General').trim().toLowerCase() === selectedCategory.trim().toLowerCase()
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => {
        const inCategory = (r.category || '').toLowerCase().includes(q);
        const inSummary = (r.summary || '').toLowerCase().includes(q);
        const inShortcode = (r.shortcode || '').toLowerCase().includes(q);
        const inListTitle = (r.list_title || '').toLowerCase().includes(q);
        const inListItems = (r.list_items || []).some(item => item.toLowerCase().includes(q));
        const inKeyPoints = (r.key_points || []).some(point => point.toLowerCase().includes(q));
        const inMood = (r.dominant_mood || '').toLowerCase().includes(q);
        const inUrl = (r.url || '').toLowerCase().includes(q);
        return (
          inCategory ||
          inSummary ||
          inShortcode ||
          inListTitle ||
          inListItems ||
          inKeyPoints ||
          inMood ||
          inUrl
        );
      });
    }
    return result;
  }, [reels, selectedCategory, searchQuery]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteSavedReel(id);
    setReels(updated);
    if (expandedReelId === id) {
      setExpandedReelId(null);
    }
  };

  const handleClearAll = () => {
    clearAllSavedReels();
    setReels([]);
    setExpandedReelId(null);
    setConfirmClear(false);
  };

  const handleCopySummary = (reel: SavedReel, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = reel.text_summary || `${reel.category}: ${reel.summary}\n\nKey Points:\n${reel.key_points.map(p => `• ${p}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedId(reel.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadTxt = (reel: SavedReel, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = reel.text_summary || `${reel.category}\n${reel.summary}\n\nKey Points:\n${reel.key_points.join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary_${reel.shortcode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllJson = () => {
    const content = JSON.stringify(reels, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reels_library_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenViewer = (reel: SavedReel, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenInViewer && reel.analysis) {
      const response: AnalysisResponse = {
        status: 'SUCCESS',
        url: reel.url,
        shortcode: reel.shortcode,
        provider: 'groq',
        analysis: reel.analysis,
        text_summary: reel.text_summary
      };
      onOpenInViewer(response);
    }
  };

  // Empty state if no reels saved at all
  if (reels.length === 0) {
    return (
      <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] p-10 md:p-14 text-center max-w-2xl mx-auto shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-[#6366F1]/10 border border-[#6366F1]/25 flex items-center justify-center mx-auto mb-5 text-[#818CF8]">
          <BookOpen className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Your Library is Empty</h3>
        <p className="text-sm text-[#8E9299] max-w-md mx-auto mb-6 leading-relaxed">
          Every time you analyze an Instagram Reel or upload a video, it will automatically be
          saved here and organized into topic-based categories like Book Recommendations, Cooking,
          or Fitness.
        </p>
        <button
          type="button"
          onClick={onAnalyzeReelClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors shadow-xs cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Analyze Your First Reel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] p-5 md:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#2A2D35]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#6366F1]/15 text-[#818CF8] border border-[#6366F1]/30">
                Saved Library
              </span>
              <span className="text-xs text-[#8E9299]">
                {reels.length} {reels.length === 1 ? 'Reel' : 'Reels'} Saved Across{' '}
                {categoriesList.length} {categoriesList.length === 1 ? 'Category' : 'Categories'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Categorized Reels Knowledge Base
            </h2>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadAllJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E2E4E9] bg-[#21262E] hover:bg-[#2A2D35] rounded-lg transition-colors border border-[#3A414A] cursor-pointer"
              title="Export all saved reels to JSON"
            >
              <Code2 className="w-3.5 h-3.5" />
              Export All (.json)
            </button>

            {confirmClear ? (
              <div className="inline-flex items-center gap-1.5">
                <span className="text-xs text-rose-400">Clear all?</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
                >
                  Yes, Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2.5 py-1 text-xs font-medium text-[#8E9299] hover:text-white bg-[#21262E] rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#8E9299] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                title="Clear all saved history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear History
              </button>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="pt-4 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8E9299] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search saved reels by topic, keywords, list items, or URL..."
              className="w-full bg-[#0F1115] border border-[#2A2D35] focus:border-[#6366F1] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-[#5A606A] outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8E9299] hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Topic Category Tabs / Pills */}
        <div className="pt-3 flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#6366F1] text-white shadow-xs'
                : 'bg-[#21262E] text-[#8E9299] hover:text-white hover:bg-[#2A2D35] border border-[#2A2D35]'
            }`}
          >
            <span>All Reels</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
                selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-[#16191E] text-[#8E9299]'
              }`}
            >
              {reels.length}
            </span>
          </button>

          {categoriesList.map(cat => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory.toLowerCase() === cat.name.toLowerCase()
                  ? 'bg-[#6366F1] text-white shadow-xs'
                  : 'bg-[#21262E] text-[#8E9299] hover:text-white hover:bg-[#2A2D35] border border-[#2A2D35]'
              }`}
            >
              <Tag className="w-3 h-3 opacity-70" />
              <span>{cat.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
                  selectedCategory.toLowerCase() === cat.name.toLowerCase()
                    ? 'bg-white/20 text-white'
                    : 'bg-[#16191E] text-[#8E9299]'
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter results info */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-[#8E9299]">
          Showing {filteredReels.length} {filteredReels.length === 1 ? 'reel' : 'reels'}
          {selectedCategory !== 'all' ? ` in "${selectedCategory}"` : ''}
          {searchQuery ? ` matching "${searchQuery}"` : ''}
        </span>
        {selectedCategory !== 'all' && (
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className="text-xs text-[#818CF8] hover:underline cursor-pointer"
          >
            Show All
          </button>
        )}
      </div>

      {/* Reel Cards Grid / List */}
      {filteredReels.length === 0 ? (
        <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] p-8 text-center">
          <p className="text-sm text-[#8E9299] mb-3">No saved reels found matching the current filter.</p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className="text-xs text-[#818CF8] hover:underline font-medium cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredReels.map(reel => {
            const isExpanded = expandedReelId === reel.id;

            return (
              <div
                key={reel.id}
                className="bg-[#16191E] rounded-xl border border-[#2A2D35] hover:border-[#3A414A] transition-all shadow-xs overflow-hidden"
              >
                {/* Card Header Bar */}
                <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#1A1D24]/60 border-b border-[#2A2D35]">
                  <div className="flex items-center flex-wrap gap-2">
                    {/* Category Tag */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/25">
                      <Tag className="w-3 h-3" />
                      {reel.category}
                    </span>

                    {/* Mood Badge */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#A5B4FC]/10 text-[#A5B4FC] border border-[#A5B4FC]/20">
                      <Smile className="w-3 h-3" />
                      {reel.dominant_mood}
                    </span>

                    {/* Format Type */}
                    {reel.list_items && reel.list_items.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#6366F1]/15 text-[#818CF8] border border-[#6366F1]/30">
                        <ListOrdered className="w-3 h-3" />
                        {reel.list_items.length} Items List
                      </span>
                    )}
                  </div>

                  {/* Actions & Timestamp */}
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#8E9299]">
                      <Calendar className="w-3 h-3" />
                      {reel.analyzed_at}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={e => handleCopySummary(reel, e)}
                        className="p-1.5 text-[#8E9299] hover:text-white hover:bg-[#21262E] rounded-lg transition-colors cursor-pointer"
                        title="Copy Summary"
                      >
                        {copiedId === reel.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={e => handleDownloadTxt(reel, e)}
                        className="p-1.5 text-[#8E9299] hover:text-white hover:bg-[#21262E] rounded-lg transition-colors cursor-pointer"
                        title="Download .txt"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={e => handleDelete(reel.id, e)}
                        className="p-1.5 text-[#8E9299] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete from Library"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Content Body */}
                <div className="p-4 md:p-5 space-y-4">
                  {/* URL link if available */}
                  {reel.url ? (
                    <div className="flex items-center gap-1.5 text-xs text-[#8E9299]">
                      <span className="font-medium text-[#A1A7B0]">Source:</span>
                      <a
                        href={reel.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#818CF8] hover:text-[#A5B4FC] hover:underline truncate max-w-md"
                      >
                        <span className="truncate">{reel.url}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-[#8E9299]">
                      <span className="font-medium text-[#A1A7B0]">File:</span> {reel.shortcode}
                    </div>
                  )}

                  {/* Summary */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8E9299] mb-1">
                      Summary
                    </h4>
                    <p className="text-sm text-[#E2E4E9] leading-relaxed">{reel.summary}</p>
                  </div>

                  {/* List items if present */}
                  {reel.list_items && reel.list_items.length > 0 && (
                    <div className="bg-[#101216] p-3.5 rounded-lg border border-[#21262E]">
                      <h4 className="text-xs font-semibold text-[#A5B4FC] mb-2 flex items-center gap-1.5">
                        <ListOrdered className="w-3.5 h-3.5" />
                        {reel.list_title || 'Extracted List Items'}
                      </h4>
                      <ol className="space-y-1.5 list-decimal list-inside text-xs text-[#D1D5DB]">
                        {reel.list_items.map((item, idx) => (
                          <li key={idx} className="leading-snug">
                            <span className="text-white font-medium">{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Key Points */}
                  {reel.key_points && reel.key_points.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8E9299] mb-1.5">
                        Key Points & Takeaways
                      </h4>
                      <ul className="space-y-1 text-xs text-[#A1A7B0]">
                        {reel.key_points.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[#6366F1] font-bold">•</span>
                            <span className="leading-snug">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Expandable Details Accordion */}
                  {reel.analysis && (
                    <div className="pt-2 border-t border-[#2A2D35]/70">
                      <button
                        type="button"
                        onClick={() => setExpandedReelId(isExpanded ? null : reel.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#818CF8] hover:text-white transition-colors cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            Hide Full Breakdown
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            View Full Breakdown (Audio, Scene, Hashtags)
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 p-4 bg-[#0F1115] rounded-lg border border-[#21262E] space-y-3 text-xs">
                          {reel.analysis.spoken_content_summary && (
                            <div>
                              <span className="font-semibold text-[#8E9299] block mb-0.5">
                                Spoken Narration:
                              </span>
                              <p className="text-[#C5CAD3]">
                                {reel.analysis.spoken_content_summary}
                              </p>
                            </div>
                          )}

                          {reel.analysis.visual_description && (
                            <div>
                              <span className="font-semibold text-[#8E9299] block mb-0.5">
                                Visual Scene & Aesthetics:
                              </span>
                              <p className="text-[#C5CAD3]">
                                {reel.analysis.visual_description}
                              </p>
                            </div>
                          )}

                          {reel.analysis.on_screen_text && reel.analysis.on_screen_text.length > 0 && (
                            <div>
                              <span className="font-semibold text-[#8E9299] block mb-0.5">
                                On-Screen Text / OCR:
                              </span>
                              <ul className="list-disc list-inside text-[#9CA3AF] space-y-0.5">
                                {reel.analysis.on_screen_text.map((txt, i) => (
                                  <li key={i}>{txt}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {reel.analysis.hashtag_suggestions && reel.analysis.hashtag_suggestions.length > 0 && (
                            <div>
                              <span className="font-semibold text-[#8E9299] block mb-1">
                                Hashtags:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {reel.analysis.hashtag_suggestions.map((tag, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded bg-[#1F242C] text-[#818CF8] text-[11px]"
                                  >
                                    #{tag.replace(/^#/, '')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {onOpenInViewer && (
                            <div className="pt-2 border-t border-[#21262E] flex justify-end">
                              <button
                                type="button"
                                onClick={e => handleOpenViewer(reel, e)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg transition-colors cursor-pointer"
                              >
                                <span>Open in Analyzer Studio</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
