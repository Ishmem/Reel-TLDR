import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AnalyzerForm } from './components/AnalyzerForm';
import { AnalysisResultView } from './components/AnalysisResultView';
import { BatchResultView } from './components/BatchResultView';
import { PythonSuiteViewer } from './components/PythonSuiteViewer';
import { LibraryView } from './components/LibraryView';
import { AnalysisResponse, BatchAnalysisResponse } from './types';
import { saveReel, getAllSavedReels } from './services/historyService';
import { Terminal, Video, ShieldCheck, BookOpen, Sun, Moon } from 'lucide-react';

export default function App() {
  const [currentResult, setCurrentResult] = useState<AnalysisResponse | null>(null);
  const [currentBatch, setCurrentBatch] = useState<BatchAnalysisResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'analyzer' | 'library' | 'python'>('analyzer');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [hasGroqKey, setHasGroqKey] = useState(true);
  const [savedCount, setSavedCount] = useState<number>(() => getAllSavedReels().length);

  // Theme state: defaults to user's saved choice or prefers-color-scheme
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setHasGroqKey(Boolean(data.hasGroqKey));
      })
      .catch(() => {});
  }, []);

  const handleAnalysisComplete = (result: AnalysisResponse) => {
    setCurrentBatch(null);
    setCurrentResult(result);
    if (result.status === 'SUCCESS' && result.analysis) {
      saveReel(result);
      setSavedCount(getAllSavedReels().length);
    }
  };

  const handleBatchComplete = (batch: BatchAnalysisResponse) => {
    setCurrentResult(null);
    setCurrentBatch(batch);
    if (batch.results && batch.results.length > 0) {
      for (const res of batch.results) {
        if (res.status === 'SUCCESS' && res.analysis) {
          saveReel(res);
        }
      }
      setSavedCount(getAllSavedReels().length);
    }
  };

  const handleReset = () => {
    setCurrentResult(null);
    setCurrentBatch(null);
  };

  const handleOpenFromLibrary = (result: AnalysisResponse) => {
    setCurrentBatch(null);
    setCurrentResult(result);
    setActiveTab('analyzer');
  };

  return (
    <div className="min-h-screen bg-canvas text-main flex flex-col font-sans transition-colors">
      {/* Top Header */}
      <Header hasGroqKey={hasGroqKey} theme={theme} onToggleTheme={toggleTheme} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Neubrutalist Navigation Bar with Bordered Pill Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('analyzer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border-2 border-border ${
                activeTab === 'analyzer'
                  ? 'bg-gold text-main shadow-brutal-md translate-x-[-1px] translate-y-[-1px]'
                  : 'bg-card text-main shadow-brutal-sm hover:bg-card-subtle hover:shadow-brutal-md'
              }`}
            >
              <Video className="w-4 h-4 stroke-[2.5]" />
              <span>Interactive Reel Analyzer</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('library');
                setSavedCount(getAllSavedReels().length);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border-2 border-border ${
                activeTab === 'library'
                  ? 'bg-gold text-main shadow-brutal-md translate-x-[-1px] translate-y-[-1px]'
                  : 'bg-card text-main shadow-brutal-sm hover:bg-card-subtle hover:shadow-brutal-md'
              }`}
            >
              <BookOpen className="w-4 h-4 stroke-[2.5]" />
              <span>Library</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border border-border ${
                  activeTab === 'library'
                    ? 'bg-card text-main'
                    : 'bg-pink text-main'
                }`}
              >
                {savedCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('python')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border-2 border-border ${
                activeTab === 'python'
                  ? 'bg-gold text-main shadow-brutal-md translate-x-[-1px] translate-y-[-1px]'
                  : 'bg-card text-main shadow-brutal-sm hover:bg-card-subtle hover:shadow-brutal-md'
              }`}
            >
              <Terminal className="w-4 h-4 stroke-[2.5]" />
              <span>Python CLI & Architecture</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-main bg-sage px-3 py-1.5 rounded-full border-2 border-border shadow-brutal-sm">
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              Auto-saved to topic library
            </span>

            {/* Dark / Light Mode Toggle in nav bar beside tabs */}
            <button
              type="button"
              id="nav-theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-border bg-card text-main shadow-brutal-sm hover:bg-gold transition-all cursor-pointer font-bold text-xs active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-gold stroke-[2.5]" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* TAB 1: INTERACTIVE ANALYZER */}
        {activeTab === 'analyzer' && (
          <div className="space-y-8">
            {/* Input Form Area */}
            <AnalyzerForm
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

        {/* TAB 2: LIBRARY */}
        {activeTab === 'library' && (
          <LibraryView
            onAnalyzeReelClick={() => setActiveTab('analyzer')}
            onOpenInViewer={handleOpenFromLibrary}
          />
        )}

        {/* TAB 3: PYTHON CLI & SUITE VIEWER */}
        {activeTab === 'python' && (
          <PythonSuiteViewer />
        )}
      </main>

      {/* Neubrutalist Footer */}
      <footer className="border-t-[2.5px] border-border bg-card-subtle py-5 mt-auto shadow-brutal-footer transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium text-muted">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-main">Instagram Reel Content Analyzer</span>
            <span>•</span>
            <span>Groq AI Whisper Audio & High-Speed LLM Synthesis</span>
          </div>
          <div className="font-mono text-[11px] text-main bg-card px-2.5 py-1 rounded-md border-1.5 border-border shadow-brutal-sm">
            Structured JSON & Human-Readable TXT
          </div>
        </div>
      </footer>
    </div>
  );
}
