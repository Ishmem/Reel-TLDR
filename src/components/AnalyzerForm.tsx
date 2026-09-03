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
import { getExistingCategoryNames } from '../services/historyService';

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

    const formData = new FormData();
    formData.append('video', selectedFile);
    const existingCats = getExistingCategoryNames();
    if (existingCats.length > 0) {
      formData.append('existingCategories', JSON.stringify(existingCats));
    }

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
      const existingCats = getExistingCategoryNames();
      const data = await safeApiFetch('/api/batch-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls,
          existingCategories: existingCats
        })
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
    <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] overflow-hidden">
      {/* Mode Navigation Tabs (Bordered Pill Switcher) */}
      <div className="flex border-b-[2.5px] border-[#1A1A1A] bg-[#FAF7F2] p-3 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => { setActiveTab('url'); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border-2 border-[#1A1A1A] ${
            activeTab === 'url'
              ? 'bg-[#E8B94A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
              : 'bg-white text-[#1A1A1A] hover:bg-[#F5F1E8] shadow-[1.5px_1.5px_0px_#1A1A1A]'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Single Reel URL</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('upload'); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border-2 border-[#1A1A1A] ${
            activeTab === 'upload'
              ? 'bg-[#E8B94A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
              : 'bg-white text-[#1A1A1A] hover:bg-[#F5F1E8] shadow-[1.5px_1.5px_0px_#1A1A1A]'
          }`}
        >
          <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Direct Video Upload</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('batch'); setErrorMessage(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border-2 border-[#1A1A1A] ${
            activeTab === 'batch'
              ? 'bg-[#E8B94A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
              : 'bg-white text-[#1A1A1A] hover:bg-[#F5F1E8] shadow-[1.5px_1.5px_0px_#1A1A1A]'
          }`}
        >
          <Layers className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Batch Processing (URLs)</span>
        </button>
      </div>

      <div className="p-6 md:p-7">
        {/* TAB 1: SINGLE URL FORM */}
        {activeTab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div>
              <label htmlFor="reel-url-input" className="block text-xs font-bold text-[#1A1A1A] uppercase tracking-wider mb-2 font-display">
                Instagram Reel or Post URL
              </label>
              <div className="relative flex flex-col sm:flex-row items-stretch gap-2">
                <input
                  id="reel-url-input"
                  type="url"
                  placeholder="https://www.instagram.com/reel/..."
                  value={reelUrl}
                  onChange={(e) => setReelUrl(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 pl-4 pr-4 py-3.5 bg-[#FAF7F2] border-2 border-[#1A1A1A] rounded-xl text-sm font-medium text-[#1A1A1A] placeholder-[#777] focus:bg-white focus:outline-none shadow-[2px_2px_0px_#1A1A1A] transition-all"
                  required
                />
                <button
                  type="submit"
                  id="btn-analyze-reel"
                  disabled={isLoading || !reelUrl.trim()}
                  className="px-6 py-3.5 bg-[#1A1A1A] hover:bg-[#E8B94A] hover:text-[#1A1A1A] text-white disabled:bg-[#CCCCCC] disabled:text-[#666666] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] hover:shadow-[4px_4px_0px_#1A1A1A] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current stroke-[2.5]" />
                      <span>Analyze Reel</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Guidance banner */}
            <div className="mt-4 p-4 bg-[#FAF7F2] rounded-xl border-2 border-[#1A1A1A] text-xs text-[#1A1A1A] flex items-start gap-3 shadow-[2px_2px_0px_#1A1A1A]">
              <Sparkles className="w-4 h-4 text-[#1A1A1A] shrink-0 mt-0.5 stroke-[2.5]" />
              <div className="leading-relaxed">
                <strong className="font-bold">Pro Tip:</strong> Supports Instagram Reels and Posts. For offline video files or if Instagram blocks download access, switch to the{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="font-bold underline text-[#1A1A1A] hover:bg-[#E8B94A] px-1 rounded transition-colors cursor-pointer"
                >
                  Direct Video Upload
                </button>{' '}
                tab to process your downloaded .mp4 or .mov file immediately.
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
                  ? 'border-[#1A1A1A] bg-[#E8B94A]/20'
                  : selectedFile
                  ? 'border-[#1A1A1A] bg-[#C8D5C0]/40'
                  : 'border-[#1A1A1A] bg-[#FAF7F2] hover:bg-white'
              }`}
            >
              <div className="w-14 h-14 rounded-xl bg-[#E8B94A] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center mx-auto mb-3 text-[#1A1A1A]">
                {selectedFile ? (
                  <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                ) : (
                  <FolderOpen className="w-7 h-7 stroke-[2.5]" />
                )}
              </div>

              {selectedFile ? (
                <div>
                  <p className="text-sm font-bold text-[#1A1A1A]">{selectedFile.name}</p>
                  <p className="text-xs text-[#555] font-medium mt-1">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click or drop another file to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-[#1A1A1A]">
                    Drop a Reel video file here, or click to browse
                  </p>
                  <p className="text-xs text-[#555] font-medium mt-1">
                    Supports .mp4, .mov (Max 100MB)
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading || !selectedFile}
                className="px-6 py-3 bg-[#1A1A1A] hover:bg-[#E8B94A] hover:text-[#1A1A1A] text-white disabled:bg-[#CCCCCC] disabled:text-[#666666] text-xs font-bold rounded-xl flex items-center gap-2 transition-all border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] hover:shadow-[4px_4px_0px_#1A1A1A] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer disabled:cursor-not-allowed"
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
              <label htmlFor="batch-urls-input" className="block text-xs font-bold text-[#1A1A1A] uppercase tracking-wider mb-2 font-display">
                Batch Reel URLs (one per line)
              </label>
              <textarea
                id="batch-urls-input"
                rows={5}
                value={batchUrlsText}
                onChange={(e) => setBatchUrlsText(e.target.value)}
                disabled={isLoading}
                placeholder="https://www.instagram.com/reel/Cxxxx/&#10;https://www.instagram.com/reel/Cyyyy/&#10;https://www.instagram.com/reel/Czzzz/"
                className="w-full p-4 bg-[#FAF7F2] border-2 border-[#1A1A1A] rounded-xl text-xs font-mono text-[#1A1A1A] placeholder-[#777] focus:bg-white focus:outline-none shadow-[2px_2px_0px_#1A1A1A]"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-xs text-[#555] font-medium">
                Processes each reel sequentially with individual and combined roll-up summaries.
              </p>
              <button
                type="submit"
                disabled={isLoading || !batchUrlsText.trim()}
                className="px-6 py-3 bg-[#1A1A1A] hover:bg-[#E8B94A] hover:text-[#1A1A1A] text-white disabled:bg-[#CCCCCC] disabled:text-[#666666] text-xs font-bold rounded-xl flex items-center gap-2 transition-all border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] hover:shadow-[4px_4px_0px_#1A1A1A] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer disabled:cursor-not-allowed shrink-0"
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
          <div className="mt-5 p-4 rounded-xl bg-[#E8B94A] border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] text-[#1A1A1A] flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin stroke-[2.5] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold tracking-wide">
                {statusMessage || 'Processing Instagram Reel with Groq AI...'}
              </p>
              <p className="text-[11px] font-medium text-[#1A1A1A] mt-0.5">
                Executing audio extraction &rarr; Groq Whisper Transcription &rarr; Groq LLM JSON Synthesis
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-5 p-4 rounded-xl bg-[#F5C6D6] border-2 border-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] flex items-start gap-3 text-[#1A1A1A]">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 stroke-[2.5]" />
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-bold">Analysis Notice</p>
              <p className="mt-0.5 leading-relaxed font-medium">{errorMessage}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="px-3 py-1.5 bg-white text-[#1A1A1A] rounded-lg font-bold text-xs border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] hover:bg-[#FAF7F2] cursor-pointer"
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
