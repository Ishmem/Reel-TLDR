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
  Share2,
  Clock,
  Layers
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
    const blobガラ = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blobガラ);
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
      <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#2A2D35]">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Groq Whisper + LLM
              </span>
              {result.shortcode && (
                <span className="font-mono text-xs text-[#A1A7B0] bg-[#21262E] px-2 py-0.5 rounded border border-[#2A2D35]">
                  ID: {result.shortcode}
                </span>
              )}
              {result.execution_time_ms && (
                <span className="flex items-center gap-1 text-xs text-[#8E9299]">
                  <Clock className="w-3 h-3" />
                  {(result.execution_time_ms / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Reel Analysis Overview
            </h2>
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#818CF8] hover:underline inline-block mt-0.5"
              >
                {result.url}
              </a>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E2E4E9] bg-[#21262E] hover:bg-[#2A2D35] rounded-lg transition-colors border border-[#3A414A] cursor-pointer"
              title="Download text summary file (.txt)"
            >
              <Download className="w-3.5 h-3.5" />
              Download .txt
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E2E4E9] bg-[#21262E] hover:bg-[#2A2D35] rounded-lg transition-colors border border-[#3A414A] cursor-pointer"
              title="Download structured JSON file"
            >
              <Code2 className="w-3.5 h-3.5" />
              Download .json
            </button>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="px-3 py-1.5 text-xs font-medium text-[#8E9299] hover:text-white hover:bg-[#21262E] rounded-lg transition-colors cursor-pointer"
              >
                Analyze Another
              </button>
            )}
          </div>
        </div>

        {/* Badges Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
          <div className="p-3 bg-[#21262E] rounded-lg border border-[#2A2D35]">
            <div className="flex items-center gap-1.5 text-[#8E9299] text-xs font-medium mb-1">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              Category
            </div>
            <div className="text-sm font-semibold text-white truncate" title={analysis.category || analysis.content_type}>
              {analysis.category || analysis.content_type || 'General'}
            </div>
          </div>

          <div className="p-3 bg-[#21262E] rounded-lg border border-[#2A2D35]">
            <div className="flex items-center gap-1.5 text-[#8E9299] text-xs font-medium mb-1">
              <Smile className="w-3.5 h-3.5 text-[#A5B4FC]" />
              Dominant Mood
            </div>
            <div className="text-sm font-semibold text-white truncate" title={analysis.dominant_mood}>
              {analysis.dominant_mood}
            </div>
          </div>

          <div className="p-3 bg-[#21262E] rounded-lg border border-[#2A2D35]">
            <div className="flex items-center gap-1.5 text-[#8E9299] text-xs font-medium mb-1">
              {analysis.has_speech ? (
                <Mic className="w-3.5 h-3.5 text-[#10B981]" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-[#8E9299]" />
              )}
              Spoken Speech
            </div>
            <div className="text-sm font-semibold text-white">
              {analysis.has_speech ? (
                <span className="text-[#10B981] font-medium">Narration Detected</span>
              ) : (
                <span className="text-[#8E9299] font-medium">No Voice / Ambient Only</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-[#21262E] rounded-lg border border-[#2A2D35]">
            <div className="flex items-center gap-1.5 text-[#8E9299] text-xs font-medium mb-1">
              <ListOrdered className="w-3.5 h-3.5 text-[#818CF8]" />
              Format Type
            </div>
            <div className="text-sm font-semibold text-white">
              {analysis.is_list_content ? (
                <span className="text-[#818CF8] font-medium">List / Countdown</span>
              ) : (
                <span className="text-[#A1A7B0] font-medium">Standard Narrative</span>
              )}
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-[#2A2D35]">
          <button
            type="button"
            onClick={() => setActiveViewTab('visual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeViewTab === 'visual'
                ? 'bg-[#21262E] text-white border border-[#3A414A]'
                : 'text-[#8E9299] hover:text-white hover:bg-[#21262E]/50'
            }`}
          >
            Visual Breakdown
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('txt')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeViewTab === 'txt'
                ? 'bg-[#21262E] text-white border border-[#3A414A]'
                : 'text-[#8E9299] hover:text-white hover:bg-[#21262E]/50'
            }`}
          >
            Formatted Summary (.txt)
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('json')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeViewTab === 'json'
                ? 'bg-[#21262E] text-white border border-[#3A414A]'
                : 'text-[#8E9299] hover:text-white hover:bg-[#21262E]/50'
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
            <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs p-5 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#6366F1]/15 text-[#818CF8] flex items-center justify-center border border-[#6366F1]/30">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Executive Summary</h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(analysis.summary, 'summary')}
                  className="text-[#8E9299] hover:text-white p-1 rounded cursor-pointer"
                  title="Copy summary"
                >
                  {copiedSection === 'summary' ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[#E2E4E9] text-sm leading-relaxed whitespace-pre-line font-light">
                {analysis.summary}
              </p>
            </div>

            {/* List Content Extractor (If detected) */}
            {analysis.is_list_content && (
              <div className="bg-[#16191E] rounded-xl border border-[#6366F1]/40 shadow-xs p-5 md:p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#6366F1]/20 text-[#818CF8] flex items-center justify-center border border-[#6366F1]/30">
                    <ListOrdered className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold tracking-wider text-[#818CF8] uppercase">
                      Numbered List Extracted
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {analysis.list_title || 'Identified List Items'}
                    </h3>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  {analysis.list_items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-[#21262E] rounded-lg border border-[#2A2D35] hover:border-[#6366F1]/50 transition-colors"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/30 font-bold text-xs flex items-center justify-center font-mono">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-medium text-[#E2E4E9] leading-snug pt-0.5">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Takeaways */}
            {analysis.key_points && analysis.key_points.length > 0 && (
              <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs p-5 md:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Key Points & Takeaways</h3>
                </div>
                <ul className="space-y-2.5">
                  {analysis.key_points.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-[#A1A7B0] leading-relaxed">
                      <span className="text-[#818CF8] font-bold mt-0.5">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Spoken Content & Dialogue Summary */}
            <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs p-5 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center border border-[#10B981]/30">
                    <Mic className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    Spoken Narration & Audio Analysis
                  </h3>
                </div>
                {analysis.spoken_content_summary && (
                  <button
                    type="button"
                    onClick={() => handleCopy(analysis.spoken_content_summary, 'speech')}
                    className="text-[#8E9299] hover:text-white p-1 rounded cursor-pointer"
                    title="Copy spoken summary"
                  >
                    {copiedSection === 'speech' ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <p className="text-[#A1A7B0] text-sm leading-relaxed">
                {analysis.spoken_content_summary || 'No spoken audio or narration was identified.'}
              </p>
            </div>
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-6">
            {/* On-Screen Text & OCR */}
            <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-[#6366F1]/15 text-[#818CF8] flex items-center justify-center border border-[#6366F1]/30">
                  <Type className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  On-Screen Text & Captions
                </h3>
              </div>

              {analysis.on_screen_text && analysis.on_screen_text.length > 0 ? (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {analysis.on_screen_text.map((txt, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-[#21262E] rounded-md border border-[#2A2D35] text-xs text-[#A1A7B0] font-mono"
                    >
                      {txt}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#5C616B] italic">No burned-in subtitles or text overlays detected.</p>
              )}
            </div>

            {/* Visual Description & Aesthetics */}
            <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Eye className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  Visual Scene & Setting
                </h3>
              </div>
              <p className="text-xs text-[#A1A7B0] leading-relaxed">
                {analysis.visual_description || 'Visual details parsed from video frames.'}
              </p>
            </div>

            {/* Hashtag Suggestions */}
            <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/30">
                    <Hash className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Hashtag Suggestions</h3>
                </div>
                {analysis.hashtag_suggestions && analysis.hashtag_suggestions.length > 0 && (
                  <button
                    type="button"
                    onClick={copyAllHashtags}
                    className="text-xs text-[#818CF8] hover:text-white font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSection === 'hashtags' ? (
                      <>
                        <Check className="w-3 h-3 text-[#10B981]" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy All
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {analysis.hashtag_suggestions && analysis.hashtag_suggestions.length > 0 ? (
                  analysis.hashtag_suggestions.map((tag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleCopy(`#${tag.replace(/^#/, '')}`, `tag-${idx}`)}
                      className="px-2.5 py-1 bg-[#21262E] hover:bg-[#2A2D35] text-[#A1A7B0] hover:text-white rounded-full text-xs font-medium border border-[#2A2D35] transition-colors cursor-pointer"
                      title="Click to copy hashtag"
                    >
                      #{tag.replace(/^#/, '')}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-[#5C616B] italic">No hashtags suggested.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FORMATTED SUMMARY (.TXT) */}
      {activeViewTab === 'txt' && (
        <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs p-5 md:p-6">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#2A2D35]">
            <div>
              <h3 className="text-base font-semibold text-white">Formatted Text Output</h3>
              <p className="text-xs text-[#8E9299]">
                Generated plain text file saved to disk for human consumption
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(result.text_summary || '', 'txt-full')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#E2E4E9] bg-[#21262E] hover:bg-[#2A2D35] rounded-lg transition-colors border border-[#3A414A] cursor-pointer"
              >
                {copiedSection === 'txt-full' ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Text
              </button>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#6366F1] hover:bg-[#5558E6] rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download .txt
              </button>
            </div>
          </div>
          <pre className="p-4 bg-[#0F1115] border border-[#2A2D35] text-[#A1A7B0] rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {result.text_summary || 'No text summary generated.'}
          </pre>
        </div>
      )}

      {/* TAB 3: STRUCTURED JSON SCHEMA */}
      {activeViewTab === 'json' && (
        <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs p-5 md:p-6">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#2A2D35]">
            <div>
              <h3 className="text-base font-semibold text-white">Structured JSON Output</h3>
              <p className="text-xs text-[#8E9299]">
                Strict conforming JSON schema matching project specifications
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(JSON.stringify(analysis, null, 2), 'json-full')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#E2E4E9] bg-[#21262E] hover:bg-[#2A2D35] rounded-lg transition-colors border border-[#3A414A] cursor-pointer"
              >
                {copiedSection === 'json-full' ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                Copy JSON
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#6366F1] hover:bg-[#5558E6] rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download .json
              </button>
            </div>
          </div>
          <pre className="p-4 bg-[#0F1115] border border-[#2A2D35] text-[#818CF8] rounded-lg text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">
            {JSON.stringify(analysis, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
