import React from 'react';
import { Video, Cpu, CheckCircle2, Zap } from 'lucide-react';

interface HeaderProps {
  hasGroqKey?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  hasGroqKey = true
}) => {
  return (
    <header className="border-b border-[#2A2D35] bg-[#16191E]/95 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-white shadow-sm ring-1 ring-white/10">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white tracking-tight">
                Instagram Reel Content Analyzer
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Cpu className="w-3 h-3" />
                Groq AI Engine
              </span>
            </div>
            <p className="text-xs text-[#8E9299]">
              Summarizes spoken speech (Whisper), on-screen text, list items, and key takeaways
            </p>
          </div>
        </div>

        {/* Right: AI Engine Status */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0F1115] rounded-lg border border-[#2A2D35] text-xs font-medium">
            <div className="flex items-center gap-1.5 text-white">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold">Groq Whisper + LLM</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
              Ultra-Fast Inference
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#8E9299] pl-2 border-l border-[#2A2D35]">
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#A1A7B0]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
              Online
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};


