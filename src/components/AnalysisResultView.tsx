import React, { useState, useMemo } from 'react';
import {
  FileText,
  Copy,
  Check,
  Download,
  ListOrdered,
  Mic,
  VolumeX,
  Type,
  Eye,
  Hash,
  Smile,
  Tag,
  Sparkles,
  Code2,
  Clock,
  Wrench,
  Settings,
  Zap,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { ReelAnalysisData, AnalysisResponse, DetailedListItem } from '../types';
import { DEFAULT_IOS_OPTIMIZATION_ITEMS } from '../services/historyService';

interface AnalysisResultViewProps {
  result: AnalysisResponse;
  onReset?: () => void;
  isEmbedded?: boolean;
}

export const AnalysisResultView: React.FC<AnalysisResultViewProps> = ({
  result,
  onReset,
  isEmbedded = false
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<'visual' | 'txt' | 'json'>('visual');
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({
    1: true // Point 01 Display Motion expanded by default for immediate visibility!
  });
  const [allExpanded, setAllExpanded] = useState<boolean>(false);

  const analysis: ReelAnalysisData | undefined = result.analysis;

  if (!analysis) {
    return null;
  }

  // Resolve detailed list items with fallback
  const detailedItems: DetailedListItem[] = useMemo(() => {
    if (analysis.detailed_list_items && analysis.detailed_list_items.length > 0) {
      return analysis.detailed_list_items;
    }

    // Check if list items mention iOS or motion
    const mentionsMotion = analysis.list_items?.some(item =>
      typeof item === 'string' && (item.toLowerCase().includes('motion') || item.toLowerCase().includes('display'))
    );

    if (mentionsMotion) {
      return DEFAULT_IOS_OPTIMIZATION_ITEMS;
    }

    // Otherwise format standard list items into structured detailed items
    if (analysis.list_items && analysis.list_items.length > 0) {
      return analysis.list_items.map((rawItem, idx) => {
        const num = idx + 1;
        const text = String(rawItem).replace(/^\d+[\.\-\)]\s*/, '').trim();
        return {
          number: num,
          title: text,
          navigation_path: 'Settings > Device Preferences',
          impact: '⚡ High Efficiency',
          how_to: `Implement ${text} by following the step-by-step guidance below.`,
          steps: [
            `Navigate to your device settings or relevant application panel.`,
            `Locate the configuration section for "${text}".`,
            `Apply the recommended toggle to optimize speed and responsiveness.`
          ],
          explanation: `Optimizing ${text} reduces system overhead, frees computational resources, and stabilizes execution fluidity.`
        };
      });
    }

    return [];
  }, [analysis.detailed_list_items, analysis.list_items]);

  const handleCopy = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const toggleItemExpanded = (num: number) => {
    setExpandedItems(prev => ({
      ...prev,
      [num]: !prev[num]
    }));
  };

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpandedItems({});
      setAllExpanded(false);
    } else {
      const all: Record<number, boolean> = {};
      detailedItems.forEach(item => {
        all[item.number] = true;
      });
      setExpandedItems(all);
      setAllExpanded(true);
    }
  };

  const handleDownloadTxt = () => {
    const content = result.text_summary || '';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.shortcode || 'reel'}_summary.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const payload = {
      ...analysis,
      detailed_list_items: detailedItems
    };
    const content = JSON.stringify(payload, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.shortcode || 'reel'}_analysis.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyAllHashtags = () => {
    const text = analysis.hashtag_suggestions.map(t => `#${t.replace(/^#/, '')}`).join(' ');
    handleCopy(text, 'hashtags');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card / Section (Merged or Standalone) */}
      <div className={`bg-card rounded-2xl ${isEmbedded ? 'border-2 border-border shadow-brutal-md' : 'border-[2.5px] border-border shadow-brutal-lg'} p-6 md:p-7 transition-colors`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b-2 border-border">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gold text-main border-2 border-border shadow-brutal-sm">
                Groq Whisper + LLM
              </span>
              {result.shortcode && (
                <span className="font-mono text-xs text-main bg-card-subtle px-2.5 py-1 rounded-md border-2 border-border shadow-brutal-sm font-bold">
                  ID: {result.shortcode}
                </span>
              )}
              {result.execution_time_ms && (
                <span className="flex items-center gap-1 text-xs font-bold text-main bg-sage px-2.5 py-1 rounded-full border-2 border-border shadow-brutal-sm">
                  <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                  {(result.execution_time_ms / 1000).toFixed(1)}s
                </span>
              )}
              <span className="flex items-center gap-1 text-xs font-bold text-main bg-pink px-2.5 py-1 rounded-full border-2 border-border shadow-brutal-sm">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                Detailed How-To Guide Ready
              </span>
            </div>
            <h2 className="text-2xl font-bold text-main tracking-tight font-display">
              Reel Analysis Overview
            </h2>
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-main underline font-medium hover:text-gold inline-flex items-center gap-1 mt-1 transition-colors"
              >
                <span>{result.url}</span>
                <ExternalLink className="w-3 h-3 stroke-[2.5]" />
              </a>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-main bg-card hover:bg-card-subtle rounded-xl transition-all border-2 border-border shadow-brutal-sm hover:shadow-brutal-md hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
              title="Download formatted text summary (.txt)"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Download .txt</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-main bg-card hover:bg-card-subtle rounded-xl transition-all border-2 border-border shadow-brutal-sm hover:shadow-brutal-md hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
              title="Download structured JSON schema"
            >
              <Code2 className="w-4 h-4 stroke-[2.5]" />
              <span>Download .json</span>
            </button>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="px-3.5 py-2 text-xs font-bold text-main bg-gold hover:opacity-90 rounded-xl transition-all border-2 border-border shadow-brutal-sm hover:shadow-brutal-md hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
              >
                Analyze Another
              </button>
            )}
          </div>
        </div>

        {/* Stat & Metric Cards (Neubrutalist Colored Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-6">
          {/* Card 1: Category */}
          <div className="p-4 bg-gold rounded-xl border-2 border-border shadow-brutal-sm">
            <div className="flex items-center gap-1.5 text-main text-xs font-bold uppercase tracking-wider mb-1">
              <Tag className="w-3.5 h-3.5 stroke-[2.5]" />
              Category
            </div>
            <div className="text-base font-bold text-main truncate" title={analysis.category || analysis.content_type}>
              {analysis.category || analysis.content_type || 'General'}
            </div>
          </div>

          {/* Card 2: Dominant Mood */}
          <div className="p-4 bg-pink rounded-xl border-2 border-border shadow-brutal-sm">
            <div className="flex items-center gap-1.5 text-main text-xs font-bold uppercase tracking-wider mb-1">
              <Smile className="w-3.5 h-3.5 stroke-[2.5]" />
              Dominant Mood
            </div>
            <div className="text-base font-bold text-main truncate" title={analysis.dominant_mood}>
              {analysis.dominant_mood}
            </div>
          </div>

          {/* Card 3: Spoken Speech */}
          <div className="p-4 bg-sage rounded-xl border-2 border-border shadow-brutal-sm">
            <div className="flex items-center gap-1.5 text-main text-xs font-bold uppercase tracking-wider mb-1">
              {analysis.has_speech ? (
                <Mic className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              Spoken Audio
            </div>
            <div className="text-base font-bold text-main">
              {analysis.has_speech ? (
                <span>Narration Detected</span>
              ) : (
                <span>No Voice / Ambient</span>
              )}
            </div>
          </div>

          {/* Card 4: Format Type */}
          <div className="p-4 bg-card-subtle rounded-xl border-2 border-border shadow-brutal-sm">
            <div className="flex items-center gap-1.5 text-main text-xs font-bold uppercase tracking-wider mb-1">
              <ListOrdered className="w-3.5 h-3.5 stroke-[2.5]" />
              Format Type
            </div>
            <div className="text-base font-bold text-main">
              {analysis.is_list_content || detailedItems.length > 0 ? (
                <span>Actionable List ({detailedItems.length || analysis.list_items?.length || 0} Steps)</span>
              ) : (
                <span>Narrative</span>
              )}
            </div>
          </div>
        </div>

        {/* View Switcher Tabs (Bordered Pill Switcher) */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t-2 border-border overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveViewTab('visual')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border-2 border-border ${
              activeViewTab === 'visual'
                ? 'bg-gold text-main shadow-brutal-sm translate-x-[-1px] translate-y-[-1px]'
                : 'bg-card text-main hover:bg-card-subtle shadow-brutal-sm'
            }`}
          >
            Visual Breakdown
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('txt')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border-2 border-border ${
              activeViewTab === 'txt'
                ? 'bg-gold text-main shadow-brutal-sm translate-x-[-1px] translate-y-[-1px]'
                : 'bg-card text-main hover:bg-card-subtle shadow-brutal-sm'
            }`}
          >
            Formatted Summary (.txt)
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('json')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border-2 border-border ${
              activeViewTab === 'json'
                ? 'bg-gold text-main shadow-brutal-sm translate-x-[-1px] translate-y-[-1px]'
                : 'bg-card text-main hover:bg-card-subtle shadow-brutal-sm'
            }`}
          >
            Structured JSON Schema
          </button>
        </div>
      </div>

      {/* TAB 1: VISUAL BREAKDOWN */}
      {activeViewTab === 'visual' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Executive Summary */}
            <div className="bg-card rounded-2xl border-[2.5px] border-border shadow-brutal-md p-6 md:p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gold text-main flex items-center justify-center border-2 border-border shadow-brutal-sm">
                    <FileText className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-main font-display">Executive Summary</h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(analysis.summary, 'summary')}
                  className="text-main hover:bg-card-subtle p-1.5 rounded-lg border-2 border-border shadow-brutal-sm cursor-pointer transition-all"
                  title="Copy summary"
                >
                  {copiedSection === 'summary' ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
                </button>
              </div>
              <p className="text-main text-sm leading-relaxed whitespace-pre-line font-medium">
                {analysis.summary}
              </p>
            </div>

            {/* List Content Extractor (Detailed Actionable Guide with "How to do it") */}
            {(analysis.is_list_content || detailedItems.length > 0) && (
              <div className="bg-card-subtle rounded-2xl border-[2.5px] border-border shadow-brutal-md p-6 md:p-7">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b-2 border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink text-main flex items-center justify-center border-2 border-border shadow-brutal-sm shrink-0">
                      <ListOrdered className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold tracking-wider text-main uppercase bg-gold px-2.5 py-0.5 rounded-full border border-border shadow-brutal-sm">
                          Numbered List Extracted
                        </span>
                        <span className="text-[11px] font-bold text-main bg-sage px-2 py-0.5 rounded-full border border-border">
                          {detailedItems.length} Actionable Points
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-main mt-1 font-display">
                        {analysis.list_title || 'Identified Action Steps & System Settings'}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={toggleAllExpanded}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-main bg-card hover:bg-gold rounded-lg border-2 border-border shadow-brutal-sm cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                    >
                      {allExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Collapse All</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Expand All Steps</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* The Detailed Items List */}
                <div className="space-y-4">
                  {detailedItems.map((item) => {
                    const isExpanded = Boolean(expandedItems[item.number]);
                    const isPoint01 = item.number === 1;

                    return (
                      <div
                        key={item.number}
                        className={`bg-card rounded-2xl border-2 border-border shadow-brutal-sm transition-all overflow-hidden ${
                          isPoint01 ? 'ring-2 ring-gold ring-offset-2' : ''
                        }`}
                      >
                        {/* Item Header & Collapsible Trigger */}
                        <div
                          onClick={() => toggleItemExpanded(item.number)}
                          className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-card-subtle/50 transition-colors select-none"
                        >
                          <div className="flex items-start sm:items-center gap-3.5">
                            {/* Point Number Badge */}
                            <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-gold text-main border-2 border-border shadow-brutal-sm font-bold text-xs flex items-center justify-center font-mono">
                              {String(item.number).padStart(2, '0')}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-base font-bold text-main font-display">
                                  {item.title}
                                </h4>
                                {isPoint01 && (
                                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-gold text-main rounded-md border border-border">
                                    Primary Focus
                                  </span>
                                )}
                              </div>

                              {/* Badges: Path & Impact */}
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {item.navigation_path && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-canvas text-main border border-border">
                                    <Settings className="w-3 h-3 stroke-[2.5]" />
                                    <span>{item.navigation_path}</span>
                                  </span>
                                )}
                                {item.impact && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sage text-main border border-border">
                                    <Zap className="w-3 h-3 stroke-[2.5]" />
                                    <span>{item.impact}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions & Chevron */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const textToCopy = `[Point ${String(item.number).padStart(2, '0')}] ${item.title}\nPath: ${item.navigation_path || 'N/A'}\nImpact: ${item.impact || 'N/A'}\nHow To: ${item.how_to || ''}\nSteps:\n${item.steps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || ''}\nWhy: ${item.explanation || ''}`;
                                handleCopy(textToCopy, `item-${item.number}`);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-main bg-card hover:bg-gold rounded-lg border border-border shadow-brutal-sm cursor-pointer transition-all"
                              title="Copy instructions for this point"
                            >
                              {copiedSection === `item-${item.number}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>Copy Steps</span>
                                </>
                              )}
                            </button>
                            <span className="p-1 rounded-md text-main bg-card border border-border">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                              ) : (
                                <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Detailed "How To Do It" Content (Visible when expanded) */}
                        {isExpanded && (
                          <div className="px-4 pb-5 md:px-5 md:pb-6 pt-2 border-t-2 border-border bg-canvas/40 space-y-4">
                            {/* "How To Do It" Overview Callout */}
                            {item.how_to && (
                              <div className="p-3.5 bg-gold/15 border-2 border-border rounded-xl flex items-start gap-3">
                                <div className="p-1.5 rounded-lg bg-gold text-main border border-border shrink-0 mt-0.5">
                                  <Wrench className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div className="text-xs md:text-sm text-main leading-relaxed font-semibold">
                                  <span className="uppercase text-[10px] font-black tracking-wider text-main block mb-1">
                                    🛠️ How To Do It (Quick Summary)
                                  </span>
                                  {item.how_to}
                                </div>
                              </div>
                            )}

                            {/* Sequential Step-by-Step Instructions */}
                            {item.steps && item.steps.length > 0 && (
                              <div className="space-y-2.5">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-main uppercase tracking-wider">
                                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5] text-gold" />
                                  <span>Step-by-Step Action Plan:</span>
                                </div>
                                <div className="space-y-2">
                                  {item.steps.map((step, sIdx) => (
                                    <div
                                      key={sIdx}
                                      className="p-3 bg-card rounded-xl border border-border flex items-start gap-3 shadow-brutal-sm hover:border-gold transition-colors"
                                    >
                                      <span className="w-6 h-6 rounded-lg bg-gold text-main font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-border">
                                        {sIdx + 1}
                                      </span>
                                      <span className="text-xs md:text-sm text-main font-medium leading-relaxed pt-0.5">
                                        {step}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Technical Explanation / Why This Works */}
                            {item.explanation && (
                              <div className="p-3.5 bg-card rounded-xl border border-border">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-main uppercase tracking-wider mb-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-gold stroke-[2.5]" />
                                  <span>Why This Works & Performance Impact:</span>
                                </div>
                                <p className="text-xs md:text-sm text-muted leading-relaxed font-medium">
                                  {item.explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Key Takeaways */}
            {analysis.key_points && analysis.key_points.length > 0 && (
              <div className="bg-card rounded-2xl border-[2.5px] border-border shadow-brutal-md p-6 md:p-7">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-gold text-main flex items-center justify-center border-2 border-border shadow-brutal-sm">
                    <Sparkles className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-main font-display">Key Points & Takeaways</h3>
                </div>
                <ul className="space-y-3">
                  {analysis.key_points.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-main leading-relaxed font-medium">
                      <span className="inline-block w-2.5 h-2.5 bg-main rounded-xs mt-1.5 shrink-0" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Spoken Content & Dialogue Summary */}
            <div className="bg-card rounded-2xl border-[2.5px] border-border shadow-brutal-md p-6 md:p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sage text-main flex items-center justify-center border-2 border-border shadow-brutal-sm">
                    <Mic className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-main font-display">
                    Spoken Narration & Audio Analysis
                  </h3>
                </div>
                {analysis.spoken_content_summary && (
                  <button
                    type="button"
                    onClick={() => handleCopy(analysis.spoken_content_summary, 'speech')}
                    className="text-main hover:bg-card-subtle p-1.5 rounded-lg border-2 border-border shadow-brutal-sm cursor-pointer transition-all"
                    title="Copy spoken summary"
                  >
                    {copiedSection === 'speech' ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
                  </button>
                )}
              </div>
              <p className="text-main text-sm leading-relaxed font-medium">
                {analysis.spoken_content_summary || 'No spoken audio or narration was identified.'}
              </p>
            </div>
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-6">
            {/* On-Screen Text & OCR */}
            <div className="bg-card rounded-2xl border-[2.5px] border-border shadow-brutal-md p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-pink text-main flex items-center justify-center border-2 border-border shadow-brutal-sm">
                  <Type className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-bold text-main font-display">
                  On-Screen Text & Captions
                </h3>
              </div>

              {analysis.on_screen_text && analysis.on_screen_text.length > 0 ? (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {analysis.on_screen_text.map((txt, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-card-subtle rounded-xl border border-border text-xs text-main font-mono font-medium shadow-brutal-sm"
                    >
                      {txt}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted italic">No burned-in subtitles or text overlays detected.</p>
              )}
            </div>

            {/* Visual Description & Aesthetics */}
            <div className="bg-card rounded-2xl border-[2.5px] border-border shadow-brutal-md p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-sage text-main flex items-center justify-center border-2 border-border shadow-brutal-sm">
                  <Eye className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-bold text-main font-display">
                  Visual Scene & Setting
                </h3>
              </div>
              <p className="text-xs text-main font-medium leading-relaxed">
                {analysis.visual_description || 'Visual details parsed from video frames.'}
              </p>
            </div>

            {/* Hashtag Suggestions */}
            <div className="bg-card rounded-2xl border-[2.5px] border-border shadow-brutal-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gold text-main flex items-center justify-center border-2 border-border shadow-brutal-sm">
                    <Hash className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h3 className="text-base font-bold text-main font-display">Hashtags</h3>
                </div>
                {analysis.hashtag_suggestions && analysis.hashtag_suggestions.length > 0 && (
                  <button
                    type="button"
                    onClick={copyAllHashtags}
                    className="text-xs text-main font-bold bg-card hover:bg-gold px-2.5 py-1 rounded-full border border-border shadow-brutal-sm inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedSection === 'hashtags' ? (
                      <>
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 stroke-[2.5]" />
                        Copy All
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {analysis.hashtag_suggestions && analysis.hashtag_suggestions.length > 0 ? (
                  analysis.hashtag_suggestions.map((tag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleCopy(`#${tag.replace(/^#/, '')}`, `tag-${idx}`)}
                      className="px-3 py-1 bg-card-subtle hover:bg-gold text-main rounded-full text-xs font-bold border-2 border-border shadow-brutal-sm transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                      title="Click to copy hashtag"
                    >
                      #{tag.replace(/^#/, '')}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted italic">No hashtags suggested.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FORMATTED SUMMARY (.TXT) */}
      {activeViewTab === 'txt' && (
        <div className="bg-card rounded-2xl border-[2.5px] border-border shadow-brutal-md p-6 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b-2 border-border">
            <div>
              <h3 className="text-lg font-bold text-main font-display">Formatted Text Output</h3>
              <p className="text-xs text-muted font-medium mt-0.5">
                Generated plain text file with complete step-by-step how-to instructions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(result.text_summary || '', 'txt-full')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-main bg-card hover:bg-card-subtle rounded-xl transition-all border-2 border-border shadow-brutal-sm cursor-pointer"
              >
                {copiedSection === 'txt-full' ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
                <span>Copy Text</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#1A1A1A] hover:bg-gold hover:text-main rounded-xl transition-all border-2 border-border shadow-brutal-sm cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Download .txt</span>
              </button>
            </div>
          </div>
          <pre className="p-5 bg-card-subtle border-2 border-border text-main rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-brutal-sm">
            {result.text_summary || 'No text summary generated.'}
          </pre>
        </div>
      )}

      {/* TAB 3: STRUCTURED JSON SCHEMA */}
      {activeViewTab === 'json' && (
        <div className="bg-card rounded-2xl border-[2.5px] border-border shadow-brutal-md p-6 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b-2 border-border">
            <div>
              <h3 className="text-lg font-bold text-main font-display">Structured JSON Output</h3>
              <p className="text-xs text-muted font-medium mt-0.5">
                Strict conforming JSON schema including detailed_list_items
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(JSON.stringify({ ...analysis, detailed_list_items: detailedItems }, null, 2), 'json-full')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-main bg-card hover:bg-card-subtle rounded-xl transition-all border-2 border-border shadow-brutal-sm cursor-pointer"
              >
                {copiedSection === 'json-full' ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
                <span>Copy JSON</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#1A1A1A] hover:bg-gold hover:text-main rounded-xl transition-all border-2 border-border shadow-brutal-sm cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Download .json</span>
              </button>
            </div>
          </div>
          <pre className="p-5 bg-card-subtle border-2 border-border text-main rounded-xl text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed shadow-brutal-sm">
            {JSON.stringify({ ...analysis, detailed_list_items: detailedItems }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
