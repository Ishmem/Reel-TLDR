import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AnalyzerForm } from './components/AnalyzerForm';
import { AnalysisResultView } from './components/AnalysisResultView';
import { BatchResultView } from './components/BatchResultView';
import { PythonSuiteViewer } from './components/PythonSuiteViewer';
import { AnalysisResponse, BatchAnalysisResponse } from './types';
import { Terminal, Sparkles, Video, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function App() {
  const [provider, setProvider] = useState<'gemini' | 'groq'>('gemini');
  const [currentResult, setCurrentResult] = useState<AnalysisResponse | null>(null);
  const [currentBatch, setCurrentBatch] = useState<BatchAnalysisResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'analyzer' | 'python'>('analyzer');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [hasGeminiKey, setHasGeminiKey] = useState(true);
  const [hasGroqKey, setHasGroqKey] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setHasGeminiKey(Boolean(data.hasGeminiKey));
        setHasGroqKey(Boolean(data.hasGroqKey));
      })
      .catch(() => {});
  }, []);

  const handleAnalysisComplete = (result: AnalysisResponse) => {
    setCurrentBatch(null);
    setCurrentResult(result);
  };

  const handleBatchComplete = (batch: BatchAnalysisResponse) => {
    setCurrentResult(null);
    setCurrentBatch(batch);
  };

  const handleReset = () => {
    setCurrentResult(null);
    setCurrentBatch(null);
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#E2E4E9] flex flex-col font-sans selection:bg-[#6366F1] selection:text-white">
      {/* Top Header */}
      <Header
        provider={provider}
        onProviderChange={setProvider}
        hasGeminiKey={hasGeminiKey}
        hasGroqKey={hasGroqKey}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Bar between Analyzer and Python CLI Suite */}
        <div className="flex items-center justify-between border-b border-[#2A2D35] pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#16191E] border border-[#2A2D35] rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('analyzer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'analyzer'
                  ? 'bg-[#21262E] text-white border border-[#3A414A] shadow-xs'
                  : 'text-[#8E9299] hover:text-white hover:bg-[#21262E]/50'
              }`}
            >
              <Video className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Interactive Reel Analyzer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('python')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'python'
                  ? 'bg-[#21262E] text-white border border-[#3A414A] shadow-xs'
                  : 'text-[#8E9299] hover:text-white hover:bg-[#21262E]/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-[#A1A7B0]" />
              <span>Python CLI & Architecture</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-[#8E9299]">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              Auto-cleanup temp storage active
            </span>
          </div>
        </div>

        {/* TAB 1: INTERACTIVE ANALYZER */}
        {activeTab === 'analyzer' && (
          <div className="space-y-6">
            {/* Input Form Area */}
            <AnalyzerForm
              provider={provider}
              onAnalysisComplete={handleAnalysisComplete}
              onBatchComplete={handleBatchComplete}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              statusMessage={statusMessage}
              setStatusMessage={setStatusMessage}
            />

            {/* Results Display Area */}
            {currentResult && (
              <AnalysisResultView
                result={currentResult}
                onReset={handleReset}
              />
            )}

            {currentBatch && (
              <BatchResultView
                batchData={currentBatch}
                onReset={handleReset}
              />
            )}
          </div>
        )}

        {/* TAB 2: PYTHON CLI & SUITE VIEWER */}
        {activeTab === 'python' && (
          <PythonSuiteViewer />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2A2D35] bg-[#16191E] py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#8E9299]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Instagram Reel Content Analyzer</span>
            <span>•</span>
            <span>Instaloader / yt-dlp &rarr; Gemini 3.7 Flash & Groq Whisper+Vision</span>
          </div>
          <div className="text-[#5C616B]">
            Structured JSON & Human-Readable TXT Summaries
          </div>
        </div>
      </footer>
    </div>
  );
}
