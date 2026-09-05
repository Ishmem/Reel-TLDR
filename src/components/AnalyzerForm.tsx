import React, { useState, useRef, useEffect } from 'react';
import {
  Link as LinkIcon,
  Upload,
  Layers,
  Sparkles,
  Play,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FolderOpen,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import { AnalysisResponse, BatchAnalysisResponse } from '../types';
import { getExistingCategoryNames } from '../services/historyService';

interface AnalyzerFormProps {
  onAnalysisComplete: (result: AnalysisResponse) => void;
  onBatchComplete: (batch: BatchAnalysisResponse) => void;
  isLoading: boolean;
  setIsLoading: (l: boolean) => void;
  statusMessage: string;
  setStatusMessage: (s: string) => void;
  currentResult?: AnalysisResponse | null;
  onReset?: () => void;
  children?: React.ReactNode;
}

export const AnalyzerForm: React.FC<AnalyzerFormProps> = ({
  onAnalysisComplete,
  onBatchComplete,
  isLoading,
  setIsLoading,
  statusMessage,
  setStatusMessage,
  currentResult,
  onReset,
  children
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'upload' | 'batch'>('url');
  const [reelUrl, setReelUrl] = useState(currentResult?.url || 'https://www.instagram.com/p/DbMFOkwFSQL/?img_index=1');
  const [batchUrlsText, setBatchUrlsText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync URL when currentResult changes
  useEffect(() => {
    if (currentResult?.url) {
      setReelUrl(currentResult.url);
    }
  }, [currentResult?.url]);

  // Safe API caller that prevents unhandled JSON parsing syntax errors or network drops
  const safeApiFetch = async (url: string, init?: RequestInit): Promise<any> => {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (netErr: any) {
      throw new Error('Connection failed or the server is starting up. Please wait a moment and try again.');
    }

    const rawText = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (jsonErr) {
      if (rawText.includes('<html') || rawText.includes('<!doctype') || rawText.includes('<!DOCTYPE')) {
        throw new Error(`Server temporarily unavailable or starting up (${response.status}). Please try again.`);
      }
      throw new Error(`Unexpected server response (${response.status}): ${rawText.slice(0, 120)}`);
    }

    if (!response.ok || parsed.status === 'FAILED') {
      throw new Error(parsed?.error || `Request failed with status ${response.status}`);
    }

    return parsed;
  };

  // Single URL Submit
  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reelUrl.trim()) return;

    setErrorMessage(null);
    setIsLoading(true);
    setStatusMessage('1/3 Fetching Reel video stream via yt-dlp...');

    try {
      const timer1 = setTimeout(() => {
        setStatusMessage('2/3 Extracting audio & running Groq Whisper transcription...');
      }, 3000);

      const timer2 = setTimeout(() => {
        setStatusMessage('3/3 Groq LLM structured extraction (key points, list items & metadata)...');
      }, 7000);

      const existingCats = getExistingCategoryNames();
      const data = await safeApiFetch('/api/analyze-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: reelUrl.trim(),
          existingCategories: existingCats
        })
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      if (data.status === 'FAILED') {
        setErrorMessage(data.error || 'Could not download the video from this URL. Instagram/Facebook may be blocking automated downloads, or the link may be private/expired. Try uploading the video file directly instead.');
        return;
      }

      onAnalysisComplete(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while analyzing the Reel with Groq.');
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
    setStatusMessage(`1/2 Extracting audio & running Groq Whisper transcription on ${selectedFile.name}...`);

    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      const existingCats = getExistingCategoryNames();
      formData.append('existingCategories', JSON.stringify(existingCats));

      const timer1 = setTimeout(() => {
        setStatusMessage('2/2 Groq LLM extracting key points & structured summary...');
      }, 4000);

      const data = await safeApiFetch('/api/upload-video', {
        method: 'POST',
        body: formData
      });

      clearTimeout(timer1);

      if (data.status === 'FAILED') {
        setErrorMessage(data.error || 'Failed to analyze uploaded video.');
        return;
      }

      onAnalysisComplete(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing uploaded video file.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  // Batch URLs Submit
  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = batchUrlsText
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);

    if (urls.length === 0) return;

    setErrorMessage(null);
    setIsLoading(true);
    setStatusMessage(`Processing batch queue (0 of ${urls.length} complete)...`);

    try {
      const data = await safeApiFetch('/api/analyze-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      });

      onBatchComplete(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing batch URL queue.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  // Drag and drop handlers
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
      if (file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.mov')) {
        setSelectedFile(file);
      } else {
        setErrorMessage('Please upload a video file (.mp4 or .mov).');
      }
    }
  };

  return (
    <div className="bg-card rounded-2xl border-[2.5px] border-border shadow-brutal-lg overflow-hidden transition-colors">
      {/* Mode Navigation Tabs (Bordered Pill Switcher) */}
      <div className="flex border-b-[2.5px] border-border bg-card-subtle p-3 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => { setActiveTab('url'); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border-2 border-border ${
            activeTab === 'url'
              ? 'bg-gold text-main shadow-brutal-sm translate-x-[-1px] translate-y-[-1px]'
              : 'bg-card text-main hover:bg-card-subtle shadow-brutal-sm'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Single Reel URL</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('upload'); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border-2 border-border ${
            activeTab === 'upload'
              ? 'bg-gold text-main shadow-brutal-sm translate-x-[-1px] translate-y-[-1px]'
              : 'bg-card text-main hover:bg-card-subtle shadow-brutal-sm'
          }`}
        >
          <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Direct Video Upload</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('batch'); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border-2 border-border ${
            activeTab === 'batch'
              ? 'bg-gold text-main shadow-brutal-sm translate-x-[-1px] translate-y-[-1px]'
              : 'bg-card text-main hover:bg-card-subtle shadow-brutal-sm'
          }`}
        >
          <Layers className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Batch Processing (URLs)</span>
        </button>
      </div>

      {/* Input Deck Section */}
      <div className="p-6 md:p-7">
        {/* TAB 1: SINGLE URL FORM */}
        {activeTab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="reel-url-input" className="block text-xs font-bold text-main uppercase tracking-wider font-display">
                  Instagram Reel or Post URL
                </label>
                {currentResult && (
                  <span className="text-[11px] font-bold text-main bg-sage px-2 py-0.5 rounded-md border border-border">
                    Active Reel Loaded
                  </span>
                )}
              </div>
              <div className="relative flex flex-col sm:flex-row items-stretch gap-2.5">
                <input
                  id="reel-url-input"
                  type="url"
                  placeholder="https://www.instagram.com/reel/..."
                  value={reelUrl}
                  onChange={(e) => setReelUrl(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 pl-4 pr-4 py-3.5 bg-card-subtle border-2 border-border rounded-xl text-sm font-medium text-main placeholder-muted focus:bg-card focus:outline-none shadow-brutal-sm transition-all"
                  required
                />
                <button
                  type="submit"
                  id="btn-analyze-reel"
                  disabled={isLoading || !reelUrl.trim()}
                  className="px-6 py-3.5 bg-[#1A1A1A] hover:bg-gold hover:text-main text-white disabled:bg-card-subtle disabled:text-muted text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all border-2 border-border shadow-brutal-sm hover:shadow-brutal-md hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current stroke-[2.5]" />
                      <span>{currentResult ? 'Re-Analyze Reel' : 'Analyze Reel'}</span>
                    </>
                  )}
                </button>
                {currentResult && onReset && (
                  <button
                    type="button"
                    onClick={onReset}
                    className="px-4 py-3.5 bg-card hover:bg-card-subtle text-main text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all border-2 border-border shadow-brutal-sm cursor-pointer"
                    title="Clear current analysis"
                  >
                    <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Guidance banner (Compact when result is present) */}
            <div className="mt-4 p-3.5 bg-card-subtle rounded-xl border-2 border-border text-xs text-main flex items-start gap-2.5 shadow-brutal-sm">
              <Sparkles className="w-4 h-4 text-gold shrink-0 mt-0.5 stroke-[2.5]" />
              <div className="leading-relaxed">
                <strong className="font-bold">Pro Tip:</strong> Enter any Instagram Reel or Carousel URL to extract transcript, key insights, and actionable numbered steps. For downloaded files, switch to{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="font-bold underline text-main hover:bg-gold px-1 rounded transition-colors cursor-pointer"
                >
                  Direct Video Upload
                </button>.
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: DIRECT VIDEO UPLOAD */}
        {activeTab === 'upload' && (
          <form onSubmit={handleUploadSubmit} className="space-y-5">
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
                  ? 'border-border bg-gold/20'
                  : selectedFile
                  ? 'border-border bg-sage/40'
                  : 'border-border bg-card-subtle hover:bg-card'
              }`}
            >
              <div className="w-14 h-14 rounded-xl bg-gold border-2 border-border shadow-brutal-sm flex items-center justify-center mx-auto mb-3 text-main">
                {selectedFile ? (
                  <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                ) : (
                  <FolderOpen className="w-7 h-7 stroke-[2.5]" />
                )}
              </div>

              {selectedFile ? (
                <div>
                  <p className="text-sm font-bold text-main">{selectedFile.name}</p>
                  <p className="text-xs text-muted font-medium mt-1">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click or drop another file to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-main">
                    Drop a Reel video file here, or click to browse
                  </p>
                  <p className="text-xs text-muted font-medium mt-1">
                    Supports .mp4, .mov (Max 100MB)
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading || !selectedFile}
                className="px-6 py-3 bg-[#1A1A1A] hover:bg-gold hover:text-main text-white disabled:bg-card-subtle disabled:text-muted text-xs font-bold rounded-xl flex items-center gap-2 transition-all border-2 border-border shadow-brutal-sm hover:shadow-brutal-md hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                    <span>Processing Video...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current stroke-[2.5]" />
                    <span>Analyze Uploaded Reel</span>
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
              <label htmlFor="batch-urls-input" className="block text-xs font-bold text-main uppercase tracking-wider mb-2 font-display">
                Batch Reel URLs (one per line)
              </label>
              <textarea
                id="batch-urls-input"
                rows={5}
                value={batchUrlsText}
                onChange={(e) => setBatchUrlsText(e.target.value)}
                disabled={isLoading}
                placeholder="https://www.instagram.com/reel/Cxxxx/&#10;https://www.instagram.com/reel/Cyyyy/&#10;https://www.instagram.com/reel/Czzzz/"
                className="w-full p-4 bg-card-subtle border-2 border-border rounded-xl text-xs font-mono text-main placeholder-muted focus:bg-card focus:outline-none shadow-brutal-sm"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-xs text-muted font-medium">
                Processes each reel sequentially with individual and combined roll-up summaries.
              </p>
              <button
                type="submit"
                disabled={isLoading || !batchUrlsText.trim()}
                className="px-6 py-3 bg-[#1A1A1A] hover:bg-gold hover:text-main text-white disabled:bg-card-subtle disabled:text-muted text-xs font-bold rounded-xl flex items-center gap-2 transition-all border-2 border-border shadow-brutal-sm hover:shadow-brutal-md hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                    <span>Running Batch...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4 stroke-[2.5]" />
                    <span>Run Batch Analysis</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Loading Progress State */}
        {isLoading && (
          <div className="mt-5 p-4 rounded-xl bg-gold border-2 border-border shadow-brutal-sm text-main flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin stroke-[2.5] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold tracking-wide">
                {statusMessage || 'Processing Instagram Reel with Groq AI...'}
              </p>
              <p className="text-[11px] font-medium text-main mt-0.5">
                Executing audio extraction &rarr; Groq Whisper Transcription &rarr; Groq LLM JSON Synthesis
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-5 p-4 rounded-xl bg-pink border-2 border-border shadow-brutal-sm flex items-start gap-3 text-main">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 stroke-[2.5]" />
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-bold">Analysis Notice</p>
              <p className="mt-0.5 leading-relaxed font-medium">{errorMessage}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="px-3 py-1.5 bg-card text-main rounded-lg font-bold text-xs border-2 border-border shadow-brutal-sm hover:bg-card-subtle cursor-pointer"
                >
                  Upload Video File Directly
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MERGED RESULT VIEW: The results render directly inside this SAME card! */}
      {children && (
        <div className="border-t-[2.5px] border-border bg-canvas/30 p-5 md:p-7">
          {children}
        </div>
      )}
    </div>
  );
};
