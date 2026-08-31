import React, { useState, useRef } from 'react';
import {
  Link as LinkIcon,
  Upload,
  Layers,
  Sparkles,
  Play,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  FolderOpen
} from 'lucide-react';
import { SampleReel, AnalysisResponse, BatchAnalysisResponse } from '../types';
import { SAMPLE_REELS } from '../data/samples';

interface AnalyzerFormProps {
  provider: 'gemini' | 'groq';
  onAnalysisComplete: (result: AnalysisResponse) => void;
  onBatchComplete: (batch: BatchAnalysisResponse) => void;
  isLoading: boolean;
  setIsLoading: (l: boolean) => void;
  statusMessage: string;
  setStatusMessage: (s: string) => void;
}

export const AnalyzerForm: React.FC<AnalyzerFormProps> = ({
  provider,
  onAnalysisComplete,
  onBatchComplete,
  isLoading,
  setIsLoading,
  statusMessage,
  setStatusMessage
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'upload' | 'batch' | 'presets'>('url');
  const [reelUrl, setReelUrl] = useState('');
  const [batchUrlsText, setBatchUrlsText] = useState(
    'https://www.instagram.com/reel/C8k9xL2pQ1A/\nhttps://www.instagram.com/reel/C9m4pB8rZ3K/\nhttps://www.instagram.com/reel/C7p2wK1vM9L/'
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single URL Submit
  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reelUrl.trim()) return;

    setErrorMessage(null);
    setIsLoading(true);
    setStatusMessage('1/3 Downloading Reel (Instaloader with yt-dlp fallback)...');

    try {
      // Step simulator for UI feedback while python runs in background
      const timer1 = setTimeout(() => {
        setStatusMessage(
          provider === 'gemini'
            ? '2/3 Multimodal AI analysis (Gemini 3.7 Flash native video + audio)...'
            : '2/3 Assembling Whisper transcript + Vision frame descriptions...'
        );
      }, 3000);

      const timer2 = setTimeout(() => {
        setStatusMessage('3/3 Extracting on-screen OCR text, list items & generating summary...');
      }, 7000);

      const response = await fetch('/api/analyze-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: reelUrl.trim(), provider })
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      const data = await response.json();

      if (!response.ok || data.status === 'FAILED') {
        throw new Error(data.error || 'Failed to analyze reel.');
      }

      onAnalysisComplete(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while analyzing the Reel.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  // Video Upload Submit
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setErrorMessage(null);
    setIsLoading(true);
    setStatusMessage(`Uploading and analyzing ${selectedFile.name}...`);

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('provider', provider);

    try {
      const response = await fetch('/api/analyze-upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok || data.status === 'FAILED') {
        throw new Error(data.error || 'Failed to analyze uploaded video.');
      }

      onAnalysisComplete(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing uploaded video.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  // Batch Submit
  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = batchUrlsText
      .split('\n')
      .map(u => u.trim())
      .filter(u => u && !u.startsWith('#'));

    if (!urls.length) {
      setErrorMessage('Please enter at least one Instagram Reel URL.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    setStatusMessage(`Starting batch processing for ${urls.length} reels...`);

    try {
      const response = await fetch('/api/batch-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, provider })
      });

      const data = await response.json();

      if (!response.ok || data.status === 'FAILED') {
        throw new Error(data.error || 'Batch analysis failed.');
      }

      onBatchComplete(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error during batch analysis.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  // Preset Selection
  const handlePresetSelect = (preset: SampleReel) => {
    setErrorMessage(null);
    setIsLoading(true);
    setStatusMessage(`Loading preset analysis for: "${preset.title}"...`);

    setTimeout(() => {
      onAnalysisComplete({
        status: 'SUCCESS',
        url: preset.url,
        shortcode: preset.id,
        provider,
        analysis: preset.sampleAnalysis,
        text_summary: `============================================================
 INSTAGRAM REEL CONTENT ANALYSIS: ${preset.title}
============================================================

📌 CONTENT TYPE:   ${preset.sampleAnalysis.content_type}
🎭 DOMINANT MOOD:  ${preset.sampleAnalysis.dominant_mood}
🗣️ SPOKEN SPEECH:  ${preset.sampleAnalysis.has_speech ? 'Yes' : 'No / Ambient Audio Only'}

------------------------------------------------------------
📝 EXECUTIVE SUMMARY
------------------------------------------------------------
${preset.sampleAnalysis.summary}

------------------------------------------------------------
📋 LIST FORMAT DETECTED: ${preset.sampleAnalysis.list_title || 'List'}
------------------------------------------------------------
${preset.sampleAnalysis.list_items.map((it, i) => `  ${i + 1}. ${it}`).join('\n')}

------------------------------------------------------------
💡 KEY TAKEAWAYS & HIGHLIGHTS
------------------------------------------------------------
${preset.sampleAnalysis.key_points.map(p => `  • ${p}`).join('\n')}

------------------------------------------------------------
🎙️ SPOKEN NARRATION & DIALOGUE SUMMARY
------------------------------------------------------------
${preset.sampleAnalysis.spoken_content_summary}

------------------------------------------------------------
🔍 ON-SCREEN TEXT & GRAPHIC OCR
------------------------------------------------------------
${preset.sampleAnalysis.on_screen_text.map(t => `  [Text] ${t}`).join('\n')}

------------------------------------------------------------
🎬 VISUAL SCENE & AESTHETIC BREAKDOWN
------------------------------------------------------------
${preset.sampleAnalysis.visual_description}

------------------------------------------------------------
🏷️ RECOMMENDED HASHTAGS
------------------------------------------------------------
${preset.sampleAnalysis.hashtag_suggestions.map(t => `#${t}`).join(' ')}
============================================================`,
        execution_time_ms: 1200
      });
      setIsLoading(false);
      setStatusMessage('');
    }, 600);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.includes('video') || file.name.endsWith('.mp4') || file.name.endsWith('.mov')) {
        setSelectedFile(file);
      } else {
        setErrorMessage('Please upload a video file (.mp4 or .mov).');
      }
    }
  };

  return (
    <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs overflow-hidden">
      {/* Mode Navigation Tabs */}
      <div className="flex border-b border-[#2A2D35] bg-[#0F1115] p-1.5 gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => { setActiveTab('url'); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'url'
              ? 'bg-[#21262E] text-white border border-[#3A414A] shadow-xs'
              : 'text-[#8E9299] hover:text-white hover:bg-[#21262E]/50'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5 text-[#6366F1]" />
          Single Reel URL
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('upload'); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-[#21262E] text-white border border-[#3A414A] shadow-xs'
              : 'text-[#8E9299] hover:text-white hover:bg-[#21262E]/50'
          }`}
        >
          <Upload className="w-3.5 h-3.5 text-[#818CF8]" />
          Direct Video Upload
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('batch'); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'batch'
              ? 'bg-[#21262E] text-white border border-[#3A414A] shadow-xs'
              : 'text-[#8E9299] hover:text-white hover:bg-[#21262E]/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-[#A5B4FC]" />
          Batch Processing (URLs)
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('presets'); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'presets'
              ? 'bg-[#21262E] text-white border border-[#3A414A] shadow-xs'
              : 'text-[#8E9299] hover:text-white hover:bg-[#21262E]/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Quick Test Presets
        </button>
      </div>

      <div className="p-5 md:p-6">
        {/* TAB 1: SINGLE URL FORM */}
        {activeTab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div>
              <label htmlFor="reel-url-input" className="block text-[11px] font-bold text-[#8E9299] uppercase tracking-wider mb-2">
                Instagram Reel URL
              </label>
              <div className="relative">
                <input
                  id="reel-url-input"
                  type="url"
                  placeholder="https://www.instagram.com/reel/C8k9xL2pQ1A/ or shortcode"
                  value={reelUrl}
                  onChange={(e) => setReelUrl(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-4 pr-36 py-3 bg-[#0F1115] border border-[#2A2D35] rounded-xl text-sm text-[#E2E4E9] placeholder-[#5C616B] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] transition-all"
                  required
                />
                <button
                  type="submit"
                  id="btn-analyze-reel"
                  disabled={isLoading || !reelUrl.trim()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-[#6366F1] hover:bg-[#5558E6] disabled:bg-[#21262E] disabled:text-[#5C616B] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Analyze Reel
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick paste sample chips */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-xs text-[#8E9299] font-medium">Quick paste:</span>
              {SAMPLE_REELS.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setReelUrl(s.url)}
                  className="text-[11px] px-2.5 py-1 bg-[#21262E] hover:bg-[#2A2D35] text-[#A1A7B0] hover:text-white rounded-md border border-[#2A2D35] transition-colors truncate max-w-[200px] cursor-pointer"
                  title={s.title}
                >
                  {s.title}
                </button>
              ))}
            </div>

            {/* Pipeline info banner */}
            <div className="mt-4 p-3.5 bg-[#0F1115] rounded-lg border border-[#2A2D35] text-xs text-[#A1A7B0] flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#6366F1] shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Automated Pipeline:</strong> Instaloader (yt-dlp fallback) &rarr; {provider === 'gemini' ? 'Gemini 3.7 Flash Multimodal' : 'Groq Whisper + Vision'} &rarr; Structured JSON + TXT summary &rarr; Immediate temp file cleanup.
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: DIRECT VIDEO UPLOAD */}
        {activeTab === 'upload' && (
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                }
              }}
            />

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-[#6366F1] bg-[#6366F1]/10'
                  : selectedFile
                  ? 'border-[#10B981]/50 bg-[#10B981]/5'
                  : 'border-[#2A2D35] bg-[#0F1115] hover:bg-[#21262E]/40 hover:border-[#3A414A]'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-[#21262E] border border-[#2A2D35] flex items-center justify-center mx-auto mb-3 text-stone-300">
                {selectedFile ? <CheckCircle2 className="w-6 h-6 text-[#10B981]" /> : <FolderOpen className="w-6 h-6 text-[#818CF8]" />}
              </div>

              {selectedFile ? (
                <div>
                  <p className="text-sm font-semibold text-white">{selectedFile.name}</p>
                  <p className="text-xs text-[#8E9299] mt-0.5">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click or drop another file to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-white">
                    Drop a Reel video file here, or click to browse
                  </p>
                  <p className="text-xs text-[#8E9299] mt-1">
                    Supports .mp4, .mov (Max 100MB)
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading || !selectedFile}
                className="px-5 py-2.5 bg-[#6366F1] hover:bg-[#5558E6] disabled:bg-[#21262E] disabled:text-[#5C616B] text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing Video...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Analyze Uploaded Reel
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: BATCH PROCESSING */}
        {activeTab === 'batch' && (
          <form onSubmit={handleBatchSubmit} className="space-y-4">
            <div>
              <label htmlFor="batch-urls-input" className="block text-[11px] font-bold text-[#8E9299] uppercase tracking-wider mb-2">
                Batch Reel URLs (one per line)
              </label>
              <textarea
                id="batch-urls-input"
                rows={5}
                value={batchUrlsText}
                onChange={(e) => setBatchUrlsText(e.target.value)}
                disabled={isLoading}
                placeholder="https://www.instagram.com/reel/Cxxxx/&#10;https://www.instagram.com/reel/Cyyyy/&#10;https://www.instagram.com/reel/Czzzz/"
                className="w-full p-3 bg-[#0F1115] border border-[#2A2D35] rounded-xl text-xs font-mono text-[#E2E4E9] placeholder-[#5C616B] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1]"
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-[#8E9299]">
                Processes each reel sequentially with individual and combined roll-up summaries.
              </p>
              <button
                type="submit"
                disabled={isLoading || !batchUrlsText.trim()}
                className="px-5 py-2.5 bg-[#6366F1] hover:bg-[#5558E6] disabled:bg-[#21262E] disabled:text-[#5C616B] text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Running Batch...
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    Run Batch Analysis
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: PRESETS */}
        {activeTab === 'presets' && (
          <div className="space-y-3">
            <p className="text-xs text-[#8E9299] mb-2">
              Select any pre-configured Reel scenario to inspect the full structured multimodal analysis:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SAMPLE_REELS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset)}
                  className="p-4 rounded-xl border border-[#2A2D35] bg-[#0F1115] hover:bg-[#21262E] hover:border-[#6366F1]/50 hover:shadow-xs transition-all cursor-pointer group text-left"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold text-[#818CF8] bg-[#6366F1]/15 px-2 py-0.5 rounded border border-[#6366F1]/30">
                      {preset.category}
                    </span>
                    <span className="text-xs font-medium text-[#8E9299] group-hover:text-white flex items-center gap-0.5">
                      Load <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-[#818CF8] transition-colors">
                    {preset.title}
                  </h4>
                  <p className="text-xs text-[#8E9299] mt-1 line-clamp-2">
                    {preset.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading Progress State */}
        {isLoading && (
          <div className="mt-4 p-4 rounded-xl bg-[#21262E] border border-[#2A2D35] text-white flex items-center gap-3 animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin text-[#818CF8] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white tracking-wide">
                {statusMessage || 'Processing Instagram Reel...'}
              </p>
              <p className="text-[11px] text-[#8E9299] mt-0.5">
                Executing automated download &rarr; AI Vision/Audio Synthesis &rarr; Temp cleanup
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-rose-200">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-semibold text-white">Analysis Notice</p>
              <p className="mt-0.5 leading-relaxed text-rose-200">{errorMessage}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('presets')}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium text-[11px] cursor-pointer"
                >
                  Try Sample Reel Preset
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="px-2.5 py-1 bg-[#21262E] hover:bg-[#2A2D35] text-white rounded font-medium text-[11px] border border-[#3A414A] cursor-pointer"
                >
                  Upload Video File Directly
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
