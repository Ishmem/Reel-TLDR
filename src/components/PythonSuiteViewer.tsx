import React, { useState, useEffect } from 'react';
import { Terminal, Copy, Check, Download, FileCode, FolderGit2, Cpu, Sparkles, Layers } from 'lucide-react';

export const PythonSuiteViewer: React.FC = () => {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string>('reel_analyzer.py');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/python-suite')
      .then(res => res.json())
      .then(data => {
        setFiles(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCopy = () => {
    if (files[activeFile]) {
      navigator.clipboard.writeText(files[activeFile]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fileList = Object.keys(files);

  return (
    <div className="space-y-6">
      {/* Architecture & CLI Cheat Sheet */}
      <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs p-5 md:p-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#21262E] border border-[#2A2D35] text-white flex items-center justify-center">
            <Terminal className="w-4 h-4 text-[#818CF8]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Python CLI & Architecture</h3>
            <p className="text-xs text-[#8E9299]">
              Run standalone in terminal or integrate as a pluggable Python module
            </p>
          </div>
        </div>

        {/* Command Examples */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="p-3.5 bg-[#0F1115] rounded-lg border border-[#2A2D35]">
            <span className="text-[11px] font-bold text-[#8E9299] uppercase tracking-wider block mb-1">
              1. Single Reel URL Analysis (Groq)
            </span>
            <code className="text-xs font-mono text-[#A1A7B0] bg-[#16191E] px-2 py-1 rounded border border-[#2A2D35] block overflow-x-auto">
              python3 reel_analyzer.py https://www.instagram.com/reel/Cxxxx/ --provider groq
            </code>
          </div>

          <div className="p-3.5 bg-[#0F1115] rounded-lg border border-[#2A2D35]">
            <span className="text-[11px] font-bold text-[#8E9299] uppercase tracking-wider block mb-1">
              2. Batch Process from Text File
            </span>
            <code className="text-xs font-mono text-[#A1A7B0] bg-[#16191E] px-2 py-1 rounded border border-[#2A2D35] block overflow-x-auto">
              python3 reel_analyzer.py --batch urls.txt --provider groq -o ./results
            </code>
          </div>

          <div className="p-3.5 bg-[#0F1115] rounded-lg border border-[#2A2D35]">
            <span className="text-[11px] font-bold text-[#8E9299] uppercase tracking-wider block mb-1">
              3. Custom Output Directory
            </span>
            <code className="text-xs font-mono text-[#A1A7B0] bg-[#16191E] px-2 py-1 rounded border border-[#2A2D35] block overflow-x-auto">
              python3 reel_analyzer.py https://www.instagram.com/reel/Cxxxx/ -o ./my_summaries
            </code>
          </div>

          <div className="p-3.5 bg-[#0F1115] rounded-lg border border-[#2A2D35]">
            <span className="text-[11px] font-bold text-[#8E9299] uppercase tracking-wider block mb-1">
              4. Direct Video File Analysis (Whisper + LLM)
            </span>
            <code className="text-xs font-mono text-[#A1A7B0] bg-[#16191E] px-2 py-1 rounded border border-[#2A2D35] block overflow-x-auto">
              python3 reel_analyzer.py --video sample_reel.mp4 --provider groq -o ./outputs
            </code>
          </div>
        </div>
      </div>

      {/* Code Browser */}
      <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#0F1115] border-b border-[#2A2D35]">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {fileList.map((fname) => (
              <button
                key={fname}
                type="button"
                onClick={() => setActiveFile(fname)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-colors cursor-pointer ${
                  activeFile === fname
                    ? 'bg-[#21262E] text-white border border-[#3A414A] font-medium shadow-xs'
                    : 'text-[#8E9299] hover:text-white hover:bg-[#21262E]/50'
                }`}
              >
                {fname}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E2E4E9] bg-[#21262E] hover:bg-[#2A2D35] rounded-lg border border-[#3A414A] transition-colors shadow-xs self-end sm:self-auto cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied Code' : 'Copy File'}
          </button>
        </div>

        <div className="relative">
          <pre className="p-5 bg-[#0F1115] text-[#A1A7B0] font-mono text-xs overflow-x-auto leading-relaxed max-h-[600px] select-text">
            {loading ? 'Loading Python codebase...' : files[activeFile] || 'No file content available.'}
          </pre>
        </div>
      </div>
    </div>
  );
};
