import React, { useState } from 'react';
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
  Clock
} from 'lucide-react';
import { ReelAnalysisData, AnalysisResponse } from '../types';

interface AnalysisResultViewProps {
  result: AnalysisResponse;
  onReset?: () => void;
}

export const AnalysisResultView: React.FC<AnalysisResultViewProps> = ({ result, onReset }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<'visual' | 'txt' | 'json'>('visual');

  const analysis: ReelAnalysisData | undefined = result.analysis;

  if (!analysis) {
    return null;
  }

  const handleCopy = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2000);
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
    const content = JSON.stringify(analysis, null, 2);
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
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6 md:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b-2 border-[#1A1A1A]">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E8B94A] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A]">
                Groq Whisper + LLM
              </span>
              {result.shortcode && (
                <span className="font-mono text-xs text-[#1A1A1A] bg-[#FAF7F2] px-2.5 py-1 rounded-md border-2 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A] font-bold">
                  ID: {result.shortcode}
                </span>
              )}
              {result.execution_time_ms && (
                <span className="flex items-center gap-1 text-xs font-bold text-[#1A1A1A] bg-[#C8D5C0] px-2.5 py-1 rounded-full border-2 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A]">
                  <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                  {(result.execution_time_ms / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-[#1A1A1A] tracking-tight font-display">
              Reel Analysis Overview
            </h2>
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#1A1A1A] underline font-medium hover:text-[#E8B94A] inline-block mt-1"
              >
                {result.url}
              </a>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1A1A1A] bg-white hover:bg-[#FAF7F2] rounded-xl transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] hover:shadow-[3px_3px_0px_#1A1A1A] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
              title="Download text summary file (.txt)"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Download .txt</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1A1A1A] bg-white hover:bg-[#FAF7F2] rounded-xl transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] hover:shadow-[3px_3px_0px_#1A1A1A] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
              title="Download structured JSON file"
            >
              <Code2 className="w-4 h-4 stroke-[2.5]" />
              <span>Download .json</span>
            </button>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="px-3.5 py-2 text-xs font-bold text-[#1A1A1A] bg-[#E8B94A] hover:bg-[#d8a83a] rounded-xl transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] hover:shadow-[3px_3px_0px_#1A1A1A] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
              >
                Analyze Another
              </button>
            )}
          </div>
        </div>

        {/* Stat & Metric Cards (Neubrutalist Colored Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-6">
          {/* Card 1: Category (Mustard Yellow Accent) */}
          <div className="p-4 bg-[#E8B94A] rounded-xl border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A]">
            <div className="flex items-center gap-1.5 text-[#1A1A1A] text-xs font-bold uppercase tracking-wider mb-1">
              <Tag className="w-3.5 h-3.5 stroke-[2.5]" />
              Category
            </div>
            <div className="text-base font-bold text-[#1A1A1A] truncate" title={analysis.category || analysis.content_type}>
              {analysis.category || analysis.content_type || 'General'}
            </div>
          </div>

          {/* Card 2: Dominant Mood (Soft Pink Secondary Accent) */}
          <div className="p-4 bg-[#F5C6D6] rounded-xl border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A]">
            <div className="flex items-center gap-1.5 text-[#1A1A1A] text-xs font-bold uppercase tracking-wider mb-1">
              <Smile className="w-3.5 h-3.5 stroke-[2.5]" />
              Dominant Mood
            </div>
            <div className="text-base font-bold text-[#1A1A1A] truncate" title={analysis.dominant_mood}>
              {analysis.dominant_mood}
            </div>
          </div>

          {/* Card 3: Spoken Speech (Sage Green Accent) */}
          <div className="p-4 bg-[#C8D5C0] rounded-xl border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A]">
            <div className="flex items-center gap-1.5 text-[#1A1A1A] text-xs font-bold uppercase tracking-wider mb-1">
              {analysis.has_speech ? (
                <Mic className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              Spoken Audio
            </div>
            <div className="text-base font-bold text-[#1A1A1A]">
              {analysis.has_speech ? (
                <span>Narration Detected</span>
              ) : (
                <span>No Voice / Ambient</span>
              )}
            </div>
          </div>

          {/* Card 4: Format Type (Warm Cream Accent) */}
          <div className="p-4 bg-[#FAF7F2] rounded-xl border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A]">
            <div className="flex items-center gap-1.5 text-[#1A1A1A] text-xs font-bold uppercase tracking-wider mb-1">
              <ListOrdered className="w-3.5 h-3.5 stroke-[2.5]" />
              Format Type
            </div>
            <div className="text-base font-bold text-[#1A1A1A]">
              {analysis.is_list_content ? (
                <span>List / Countdown</span>
              ) : (
                <span>Narrative</span>
              )}
            </div>
          </div>
        </div>

        {/* View Switcher Tabs (Bordered Pill Switcher) */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t-2 border-[#1A1A1A] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveViewTab('visual')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border-2 border-[#1A1A1A] ${
              activeViewTab === 'visual'
                ? 'bg-[#E8B94A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] shadow-[1.5px_1.5px_0px_#1A1A1A]'
            }`}
          >
            Visual Breakdown
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('txt')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border-2 border-[#1A1A1A] ${
              activeViewTab === 'txt'
                ? 'bg-[#E8B94A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] shadow-[1.5px_1.5px_0px_#1A1A1A]'
            }`}
          >
            Formatted Summary (.txt)
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('json')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border-2 border-[#1A1A1A] ${
              activeViewTab === 'json'
                ? 'bg-[#E8B94A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] shadow-[1.5px_1.5px_0px_#1A1A1A]'
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
            <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6 md:p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#E8B94A] text-[#1A1A1A] flex items-center justify-center border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
                    <FileText className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1A1A1A] font-display">Executive Summary</h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(analysis.summary, 'summary')}
                  className="text-[#1A1A1A] hover:bg-[#FAF7F2] p-1.5 rounded-lg border-1.5 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A] cursor-pointer transition-all"
                  title="Copy summary"
                >
                  {copiedSection === 'summary' ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
                </button>
              </div>
              <p className="text-[#1A1A1A] text-sm leading-relaxed whitespace-pre-line font-medium">
                {analysis.summary}
              </p>
            </div>

            {/* List Content Extractor (If detected) */}
            {analysis.is_list_content && (
              <div className="bg-[#FAF7F2] rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6 md:p-7">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F5C6D6] text-[#1A1A1A] flex items-center justify-center border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
                    <ListOrdered className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold tracking-wider text-[#1A1A1A] uppercase bg-[#E8B94A] px-2 py-0.5 rounded-full border border-[#1A1A1A]">
                      Numbered List Extracted
                    </span>
                    <h3 className="text-lg font-bold text-[#1A1A1A] mt-1 font-display">
                      {analysis.list_title || 'Identified List Items'}
                    </h3>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {analysis.list_items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3.5 bg-white rounded-xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]"
                    >
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#E8B94A] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[1px_1px_0px_#1A1A1A] font-bold text-xs flex items-center justify-center font-mono">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-bold text-[#1A1A1A] leading-snug pt-0.5">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Takeaways */}
            {analysis.key_points && analysis.key_points.length > 0 && (
              <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6 md:p-7">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-[#E8B94A] text-[#1A1A1A] flex items-center justify-center border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
                    <Sparkles className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1A1A1A] font-display">Key Points & Takeaways</h3>
                </div>
                <ul className="space-y-3">
                  {analysis.key_points.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-[#1A1A1A] leading-relaxed font-medium">
                      <span className="inline-block w-2.5 h-2.5 bg-[#1A1A1A] rounded-xs mt-1.5 shrink-0" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Spoken Content & Dialogue Summary */}
            <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6 md:p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#C8D5C0] text-[#1A1A1A] flex items-center justify-center border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
                    <Mic className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1A1A1A] font-display">
                    Spoken Narration & Audio Analysis
                  </h3>
                </div>
                {analysis.spoken_content_summary && (
                  <button
                    type="button"
                    onClick={() => handleCopy(analysis.spoken_content_summary, 'speech')}
                    className="text-[#1A1A1A] hover:bg-[#FAF7F2] p-1.5 rounded-lg border-1.5 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A] cursor-pointer transition-all"
                    title="Copy spoken summary"
                  >
                    {copiedSection === 'speech' ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
                  </button>
                )}
              </div>
              <p className="text-[#1A1A1A] text-sm leading-relaxed font-medium">
                {analysis.spoken_content_summary || 'No spoken audio or narration was identified.'}
              </p>
            </div>
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-6">
            {/* On-Screen Text & OCR */}
            <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-[#F5C6D6] text-[#1A1A1A] flex items-center justify-center border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
                  <Type className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-bold text-[#1A1A1A] font-display">
                  On-Screen Text & Captions
                </h3>
              </div>

              {analysis.on_screen_text && analysis.on_screen_text.length > 0 ? (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {analysis.on_screen_text.map((txt, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#FAF7F2] rounded-xl border-1.5 border-[#1A1A1A] text-xs text-[#1A1A1A] font-mono font-medium shadow-[1.5px_1.5px_0px_#1A1A1A]"
                    >
                      {txt}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#666] italic">No burned-in subtitles or text overlays detected.</p>
              )}
            </div>

            {/* Visual Description & Aesthetics */}
            <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-[#C8D5C0] text-[#1A1A1A] flex items-center justify-center border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
                  <Eye className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-bold text-[#1A1A1A] font-display">
                  Visual Scene & Setting
                </h3>
              </div>
              <p className="text-xs text-[#1A1A1A] font-medium leading-relaxed">
                {analysis.visual_description || 'Visual details parsed from video frames.'}
              </p>
            </div>

            {/* Hashtag Suggestions */}
            <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#E8B94A] text-[#1A1A1A] flex items-center justify-center border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
                    <Hash className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h3 className="text-base font-bold text-[#1A1A1A] font-display">Hashtags</h3>
                </div>
                {analysis.hashtag_suggestions && analysis.hashtag_suggestions.length > 0 && (
                  <button
                    type="button"
                    onClick={copyAllHashtags}
                    className="text-xs text-[#1A1A1A] font-bold bg-[#FAF7F2] hover:bg-[#E8B94A] px-2.5 py-1 rounded-full border border-[#1A1A1A] shadow-[1px_1px_0px_#1A1A1A] inline-flex items-center gap-1 cursor-pointer transition-colors"
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
                      className="px-3 py-1 bg-[#FAF7F2] hover:bg-[#E8B94A] text-[#1A1A1A] rounded-full text-xs font-bold border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                      title="Click to copy hashtag"
                    >
                      #{tag.replace(/^#/, '')}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-[#666] italic">No hashtags suggested.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FORMATTED SUMMARY (.TXT) */}
      {activeViewTab === 'txt' && (
        <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b-2 border-[#1A1A1A]">
            <div>
              <h3 className="text-lg font-bold text-[#1A1A1A] font-display">Formatted Text Output</h3>
              <p className="text-xs text-[#555] font-medium mt-0.5">
                Generated plain text file for human reading and archiving
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(result.text_summary || '', 'txt-full')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1A1A1A] bg-white hover:bg-[#FAF7F2] rounded-xl transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] cursor-pointer"
              >
                {copiedSection === 'txt-full' ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
                <span>Copy Text</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#1A1A1A] hover:bg-[#E8B94A] hover:text-[#1A1A1A] rounded-xl transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Download .txt</span>
              </button>
            </div>
          </div>
          <pre className="p-5 bg-[#FAF7F2] border-2 border-[#1A1A1A] text-[#1A1A1A] rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-[2px_2px_0px_#1A1A1A]">
            {result.text_summary || 'No text summary generated.'}
          </pre>
        </div>
      )}

      {/* TAB 3: STRUCTURED JSON SCHEMA */}
      {activeViewTab === 'json' && (
        <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b-2 border-[#1A1A1A]">
            <div>
              <h3 className="text-lg font-bold text-[#1A1A1A] font-display">Structured JSON Output</h3>
              <p className="text-xs text-[#555] font-medium mt-0.5">
                Strict conforming JSON schema for downstream integrations and APIs
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(JSON.stringify(analysis, null, 2), 'json-full')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1A1A1A] bg-white hover:bg-[#FAF7F2] rounded-xl transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] cursor-pointer"
              >
                {copiedSection === 'json-full' ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
                <span>Copy JSON</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#1A1A1A] hover:bg-[#E8B94A] hover:text-[#1A1A1A] rounded-xl transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Download .json</span>
              </button>
            </div>
          </div>
          <pre className="p-5 bg-[#FAF7F2] border-2 border-[#1A1A1A] text-[#1A1A1A] rounded-xl text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed shadow-[2px_2px_0px_#1A1A1A]">
            {JSON.stringify(analysis, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
