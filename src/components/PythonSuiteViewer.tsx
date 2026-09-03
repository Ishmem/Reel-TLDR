import React, { useState, useEffect } from 'react';
import { Terminal, Copy, Check, Download, FileCode, FolderGit2 } from 'lucide-react';

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

  const handleDownloadFile = () => {
    if (files[activeFile]) {
      const blob = new Blob([files[activeFile]], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = activeFile;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const fileList = Object.keys(files);

  return (
    <div className="space-y-6">
      {/* Architecture & CLI Cheat Sheet */}
      <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6 md:p-7">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#E8B94A] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] text-[#1A1A1A] flex items-center justify-center">
            <Terminal className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#1A1A1A] font-display">Python CLI & Architecture</h3>
            <p className="text-xs text-[#555] font-medium">
              Run standalone in terminal or integrate as a pluggable Python module
            </p>
          </div>
        </div>

        {/* Command Examples */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <div className="p-4 bg-[#FAF7F2] rounded-xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
            <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider block mb-1.5 font-display">
              1. Single Reel URL Analysis (Groq)
            </span>
            <code className="text-xs font-mono text-[#1A1A1A] bg-white px-3 py-2 rounded-lg border border-[#1A1A1A] block overflow-x-auto font-bold">
              python3 reel_analyzer.py https://www.instagram.com/reel/Cxxxx/ --provider groq
            </code>
          </div>

          <div className="p-4 bg-[#FAF7F2] rounded-xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
            <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider block mb-1.5 font-display">
              2. Batch Process from Text File
            </span>
            <code className="text-xs font-mono text-[#1A1A1A] bg-white px-3 py-2 rounded-lg border border-[#1A1A1A] block overflow-x-auto font-bold">
              python3 reel_analyzer.py --batch urls.txt --provider groq -o ./results
            </code>
          </div>

          <div className="p-4 bg-[#FAF7F2] rounded-xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
            <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider block mb-1.5 font-display">
              3. Custom Output Directory
            </span>
            <code className="text-xs font-mono text-[#1A1A1A] bg-white px-3 py-2 rounded-lg border border-[#1A1A1A] block overflow-x-auto font-bold">
              python3 reel_analyzer.py https://www.instagram.com/reel/Cxxxx/ -o ./my_summaries
            </code>
          </div>

          <div className="p-4 bg-[#FAF7F2] rounded-xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]">
            <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider block mb-1.5 font-display">
              4. Direct Video File Analysis (Whisper + LLM)
            </span>
            <code className="text-xs font-mono text-[#1A1A1A] bg-white px-3 py-2 rounded-lg border border-[#1A1A1A] block overflow-x-auto font-bold">
              python3 reel_analyzer.py --video sample_reel.mp4 --provider groq -o ./outputs
            </code>
          </div>
        </div>
      </div>

      {/* Code Browser */}
      <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#FAF7F2] border-b-2 border-[#1A1A1A]">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {fileList.map((fname) => (
              <button
                key={fname}
                type="button"
                onClick={() => setActiveFile(fname)}
                className={`px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap transition-all cursor-pointer border-2 border-[#1A1A1A] ${
                  activeFile === fname
                    ? 'bg-[#E8B94A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] font-bold'
                    : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] shadow-[1px_1px_0px_#1A1A1A]'
                }`}
              >
                {fname}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#1A1A1A] bg-white hover:bg-[#FAF7F2] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadFile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#1A1A1A] hover:bg-[#E8B94A] hover:text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Download</span>
            </button>
          </div>
        </div>

        <div className="p-5 overflow-x-auto max-h-[600px] bg-[#FAF7F2]">
          {loading ? (
            <p className="text-xs text-[#555] font-mono">Loading code files...</p>
          ) : (
            <pre className="text-xs font-mono text-[#1A1A1A] leading-relaxed whitespace-pre font-medium">
              {files[activeFile] || 'File content not found.'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
