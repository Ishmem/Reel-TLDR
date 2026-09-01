import React, { useState, useRef } from 'react';
import {
  Link as LinkIcon,
  Upload,
  Layers,
  Sparkles,
  Play,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FolderOpen
} from 'lucide-react';
import { AnalysisResponse, BatchAnalysisResponse } from '../types';

interface AnalyzerFormProps {
  onAnalysisComplete: (result: AnalysisResponse) => void;
  onBatchComplete: (batch: BatchAnalysisResponse) => void;
  isLoading: boolean;
  setIsLoading: (l: boolean) => void;
  statusMessage: string;
  setStatusMessage: (s: string) => void;
}

export const AnalyzerForm: React.FC<AnalyzerFormProps> = ({
  onAnalysisComplete,
  onBatchComplete,
  isLoading,
  setIsLoading,
  statusMessage,
  setStatusMessage
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'upload' | 'batch'>('url');
  const [reelUrl, setReelUrl] = useState('');
  const [batchUrlsText, setBatchUrlsText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Step simulator for UI feedback
      const timer1 = setTimeout(() => {
        setStatusMessage('2/3 Extracting audio & running Groq Whisper transcription...');
      }, 3000);

      const timer2 = setTimeout(() => {
        setStatusMessage('3/3 Groq LLM structured extraction (key points, list items & metadata)...');
      }, 7000);

      const data = await safeApiFetch('/api/analyze-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: reelUrl.trim()
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

    const formData = new FormData();
    formData.append('video', selectedFile);

    try {
      const data = await safeApiFetch('/api/analyze-upload', {
        method: 'POST',
        body: formData
      });

      onAnalysisComplete(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing uploaded video with Groq.');
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
    setStatusMessage(`Starting Groq batch processing for ${urls.length} reels...`);

    try {
      const data = await safeApiFetch('/api/batch-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      });

      onBatchComplete(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error during Groq batch analysis.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
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
                  placeholder="https://www.instagram.com/reel/..."
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

            {/* Guidance banner */}
            <div className="mt-4 p-3.5 bg-[#0F1115] rounded-lg border border-[#2A2D35] text-xs text-[#A1A7B0] flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#6366F1] shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Pro Tip:</strong> For automated frame-by-frame visual and audio Whisper speech recognition on any video file, switch to the <button type="button" onClick={() => setActiveTab('upload')} className="text-[#818CF8] underline font-medium hover:text-white cursor-pointer">Direct Video Upload</button> tab to upload your downloaded .mp4 or .mov file.
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

        {/* Loading Progress State */}
        {isLoading && (
          <div className="mt-4 p-4 rounded-xl bg-[#21262E] border border-[#2A2D35] text-white flex items-center gap-3 animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin text-[#818CF8] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white tracking-wide">
                {statusMessage || 'Processing Instagram Reel with Groq AI...'}
              </p>
              <p className="text-[11px] text-[#8E9299] mt-0.5">
                Executing audio extraction &rarr; Groq Whisper Transcription &rarr; Groq LLM JSON Synthesis
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
