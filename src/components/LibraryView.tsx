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
  ArrowRight,
  Search,
  Code2
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
      <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] p-10 md:p-14 text-center max-w-2xl mx-auto shadow-[4px_4px_0px_#1A1A1A]">
        <div className="w-16 h-16 rounded-2xl bg-[#E8B94A] border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] flex items-center justify-center mx-auto mb-5 text-[#1A1A1A]">
          <BookOpen className="w-8 h-8 stroke-[2.5]" />
        </div>
        <h3 className="text-2xl font-bold text-[#1A1A1A] mb-2 font-display">Your Library is Empty</h3>
        <p className="text-sm text-[#555] max-w-md mx-auto mb-6 leading-relaxed font-medium">
          Every time you analyze an Instagram Reel or upload a video, it will automatically be
          saved here and organized into topic-based categories like Book Recommendations, Cooking,
          or Fitness.
        </p>
        <button
          type="button"
          onClick={onAnalyzeReelClick}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold text-white bg-[#1A1A1A] hover:bg-[#E8B94A] hover:text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] hover:shadow-[4px_4px_0px_#1A1A1A] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4 stroke-[2.5]" />
          <span>Analyze Your First Reel</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] p-6 md:p-7 shadow-[4px_4px_0px_#1A1A1A]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b-2 border-[#1A1A1A]">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E8B94A] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A]">
                Saved Library
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#C8D5C0] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A]">
                {reels.length} {reels.length === 1 ? 'Reel' : 'Reels'} Across{' '}
                {categoriesList.length} {categoriesList.length === 1 ? 'Category' : 'Categories'}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[#1A1A1A] tracking-tight font-display">
              Categorized Reels Knowledge Base
            </h2>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleDownloadAllJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1A1A1A] bg-white hover:bg-[#FAF7F2] rounded-xl transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] cursor-pointer"
              title="Export all saved reels to JSON"
            >
              <Code2 className="w-4 h-4 stroke-[2.5]" />
              <span>Export All (.json)</span>
            </button>

            {confirmClear ? (
              <div className="inline-flex items-center gap-2">
                <span className="text-xs font-bold text-[#1A1A1A]">Clear all?</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-3 py-1.5 text-xs font-bold text-[#1A1A1A] bg-[#F5C6D6] hover:bg-[#e0b2c2] rounded-xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] transition-all cursor-pointer"
                >
                  Yes, Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-1.5 text-xs font-bold text-[#1A1A1A] bg-white hover:bg-[#FAF7F2] rounded-xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1A1A1A] hover:bg-[#F5C6D6] bg-white rounded-xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] transition-all cursor-pointer"
                title="Clear all saved history"
              >
                <Trash2 className="w-4 h-4 stroke-[2.5]" />
                <span>Clear History</span>
              </button>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="pt-5 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#1A1A1A] absolute left-4 top-1/2 -translate-y-1/2 stroke-[2.5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search saved reels by topic, keywords, list items, or URL..."
              className="w-full bg-[#FAF7F2] border-2 border-[#1A1A1A] focus:bg-white rounded-xl pl-11 pr-14 py-3 text-sm font-medium text-[#1A1A1A] placeholder-[#777] outline-none shadow-[2px_2px_0px_#1A1A1A] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#1A1A1A] bg-white px-2 py-1 rounded-md border border-[#1A1A1A] hover:bg-[#FAF7F2]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Topic Category Tabs / Bordered Pills */}
        <div className="pt-3 flex items-center gap-2 overflow-x-auto pb-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border-2 border-[#1A1A1A] ${
              selectedCategory === 'all'
                ? 'bg-[#E8B94A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] shadow-[1.5px_1.5px_0px_#1A1A1A]'
            }`}
          >
            <span>All Reels</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border border-[#1A1A1A] ${
                selectedCategory === 'all' ? 'bg-white text-[#1A1A1A]' : 'bg-[#FAF7F2] text-[#1A1A1A]'
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
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border-2 border-[#1A1A1A] ${
                selectedCategory.toLowerCase() === cat.name.toLowerCase()
                  ? 'bg-[#E8B94A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                  : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] shadow-[1.5px_1.5px_0px_#1A1A1A]'
              }`}
            >
              <Tag className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{cat.name}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border border-[#1A1A1A] ${
                  selectedCategory.toLowerCase() === cat.name.toLowerCase()
                    ? 'bg-white text-[#1A1A1A]'
                    : 'bg-[#F5C6D6] text-[#1A1A1A]'
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
        <span className="text-xs font-bold text-[#1A1A1A]">
          Showing {filteredReels.length} {filteredReels.length === 1 ? 'reel' : 'reels'}
          {selectedCategory !== 'all' ? ` in "${selectedCategory}"` : ''}
          {searchQuery ? ` matching "${searchQuery}"` : ''}
        </span>
        {selectedCategory !== 'all' && (
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className="text-xs text-[#1A1A1A] font-bold underline hover:bg-[#E8B94A] px-2 py-0.5 rounded transition-colors cursor-pointer"
          >
            Show All
          </button>
        )}
      </div>

      {/* Reel Cards Grid / List */}
      {filteredReels.length === 0 ? (
        <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] p-8 text-center shadow-[4px_4px_0px_#1A1A1A]">
          <p className="text-sm font-medium text-[#555] mb-3">No saved reels found matching the current filter.</p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className="text-xs text-[#1A1A1A] font-bold underline hover:bg-[#E8B94A] px-2 py-1 rounded cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredReels.map(reel => {
            const isExpanded = expandedReelId === reel.id;

            return (
              <div
                key={reel.id}
                className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] hover:shadow-[5px_5px_0px_#1A1A1A] transition-all overflow-hidden"
              >
                {/* Card Header Bar */}
                <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#FAF7F2] border-b-2 border-[#1A1A1A]">
                  <div className="flex items-center flex-wrap gap-2.5">
                    {/* Category Tag */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E8B94A] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A]">
                      <Tag className="w-3.5 h-3.5 stroke-[2.5]" />
                      {reel.category}
                    </span>

                    {/* Mood Badge */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F5C6D6] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A]">
                      <Smile className="w-3.5 h-3.5 stroke-[2.5]" />
                      {reel.dominant_mood}
                    </span>

                    {/* Format Type */}
                    {reel.list_items && reel.list_items.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#C8D5C0] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A]">
                        <ListOrdered className="w-3.5 h-3.5 stroke-[2.5]" />
                        {reel.list_items.length} Items List
                      </span>
                    )}
                  </div>

                  {/* Actions & Timestamp */}
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#555]">
                      <Calendar className="w-3.5 h-3.5 stroke-[2.5]" />
                      {reel.analyzed_at}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={e => handleCopySummary(reel, e)}
                        className="p-2 text-[#1A1A1A] bg-white hover:bg-[#FAF7F2] rounded-xl border-1.5 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A] transition-all cursor-pointer"
                        title="Copy Summary"
                      >
                        {copiedId === reel.id ? (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <Copy className="w-4 h-4 stroke-[2.5]" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={e => handleDownloadTxt(reel, e)}
                        className="p-2 text-[#1A1A1A] bg-white hover:bg-[#FAF7F2] rounded-xl border-1.5 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A] transition-all cursor-pointer"
                        title="Download .txt"
                      >
                        <Download className="w-4 h-4 stroke-[2.5]" />
                      </button>

                      <button
                        type="button"
                        onClick={e => handleDelete(reel.id, e)}
                        className="p-2 text-[#1A1A1A] bg-white hover:bg-[#F5C6D6] rounded-xl border-1.5 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A] transition-all cursor-pointer"
                        title="Delete from Library"
                      >
                        <Trash2 className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Content Body */}
                <div className="p-5 md:p-6 space-y-4">
                  {/* URL link if available */}
                  {reel.url ? (
                    <div className="flex items-center gap-2 text-xs text-[#555] font-medium">
                      <span className="font-bold text-[#1A1A1A]">Source:</span>
                      <a
                        href={reel.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#1A1A1A] underline hover:text-[#E8B94A] truncate max-w-md"
                      >
                        <span className="truncate">{reel.url}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-[#555] font-medium">
                      <span className="font-bold text-[#1A1A1A]">File:</span> {reel.shortcode}
                    </div>
                  )}

                  {/* Summary */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-1.5 font-display">
                      Summary
                    </h4>
                    <p className="text-sm text-[#1A1A1A] leading-relaxed font-medium">{reel.summary}</p>
                  </div>

                  {/* List items if present */}
                  {reel.list_items && reel.list_items.length > 0 && (
                    <div className="bg-[#FAF7F2] p-4 rounded-xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
                      <h4 className="text-xs font-bold text-[#1A1A1A] mb-2.5 flex items-center gap-2 font-display">
                        <ListOrdered className="w-4 h-4 stroke-[2.5]" />
                        <span>{reel.list_title || 'Extracted List Items'}</span>
                      </h4>
                      <ol className="space-y-2 list-decimal list-inside text-xs text-[#1A1A1A]">
                        {reel.list_items.map((item, idx) => (
                          <li key={idx} className="leading-snug">
                            <span className="text-[#1A1A1A] font-bold">{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Key Points */}
                  {reel.key_points && reel.key_points.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-2 font-display">
                        Key Points & Takeaways
                      </h4>
                      <ul className="space-y-2 text-xs text-[#1A1A1A]">
                        {reel.key_points.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 font-medium">
                            <span className="w-2 h-2 rounded-xs bg-[#1A1A1A] mt-1.5 shrink-0" />
                            <span className="leading-snug">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Expandable Details Accordion */}
                  {reel.analysis && (
                    <div className="pt-3 border-t-2 border-[#1A1A1A]/20">
                      <button
                        type="button"
                        onClick={() => setExpandedReelId(isExpanded ? null : reel.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1A1A1A] bg-[#FAF7F2] hover:bg-[#E8B94A] px-3 py-1.5 rounded-full border border-[#1A1A1A] shadow-[1px_1px_0px_#1A1A1A] transition-all cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                            <span>Hide Full Breakdown</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                            <span>View Full Breakdown (Audio, Scene, Hashtags)</span>
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-4 p-5 bg-[#FAF7F2] rounded-xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] space-y-3.5 text-xs">
                          {reel.analysis.spoken_content_summary && (
                            <div>
                              <span className="font-bold text-[#1A1A1A] block mb-1">
                                Spoken Narration:
                              </span>
                              <p className="text-[#333] font-medium leading-relaxed">
                                {reel.analysis.spoken_content_summary}
                              </p>
                            </div>
                          )}

                          {reel.analysis.visual_description && (
                            <div>
                              <span className="font-bold text-[#1A1A1A] block mb-1">
                                Visual Scene & Aesthetics:
                              </span>
                              <p className="text-[#333] font-medium leading-relaxed">
                                {reel.analysis.visual_description}
                              </p>
                            </div>
                          )}

                          {reel.analysis.on_screen_text && reel.analysis.on_screen_text.length > 0 && (
                            <div>
                              <span className="font-bold text-[#1A1A1A] block mb-1">
                                On-Screen Text / OCR:
                              </span>
                              <ul className="list-disc list-inside text-[#333] font-mono space-y-1">
                                {reel.analysis.on_screen_text.map((txt, i) => (
                                  <li key={i}>{txt}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {reel.analysis.hashtag_suggestions && reel.analysis.hashtag_suggestions.length > 0 && (
                            <div>
                              <span className="font-bold text-[#1A1A1A] block mb-1.5">
                                Hashtags:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {reel.analysis.hashtag_suggestions.map((tag, i) => (
                                  <span
                                    key={i}
                                    className="px-2.5 py-1 rounded-full bg-white text-[#1A1A1A] border-1.5 border-[#1A1A1A] shadow-[1px_1px_0px_#1A1A1A] font-bold text-xs"
                                  >
                                    #{tag.replace(/^#/, '')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {onOpenInViewer && (
                            <div className="pt-3 border-t border-[#1A1A1A] flex justify-end">
                              <button
                                type="button"
                                onClick={e => handleOpenViewer(reel, e)}
                                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#1A1A1A] hover:bg-[#E8B94A] hover:text-[#1A1A1A] rounded-xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] transition-all cursor-pointer"
                              >
                                <span>Open in Analyzer Studio</span>
                                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
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
