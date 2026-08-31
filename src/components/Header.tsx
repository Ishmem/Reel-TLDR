import React from 'react';
import { Video, Sparkles, Terminal, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';

interface HeaderProps {
  provider: 'gemini' | 'groq';
  onProviderChange: (p: 'gemini' | 'groq') => void;
  hasGeminiKey: boolean;
  hasGroqKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  provider,
  onProviderChange,
  hasGeminiKey,
  hasGroqKey
}) => {
  return (
    <header className="border-b border-[#2A2D35] bg-[#16191E]/95 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6366F1] via-[#818CF8] to-[#4F46E5] flex items-center justify-center text-white shadow-sm ring-1 ring-white/10">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white tracking-tight">
                Instagram Reel Content Analyzer
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#6366F1]/15 text-[#818CF8] border border-[#6366F1]/30">
                <Sparkles className="w-3 h-3" />
                Multimodal AI
              </span>
            </div>
            <p className="text-xs text-[#8E9299]">
              Summarizes what's said, shown, and written on screen without human watching
            </p>
          </div>
        </div>

        {/* Right: AI Provider & Engine Selector */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="inline-flex items-center p-1 bg-[#0F1115] rounded-lg border border-[#2A2D35] text-xs font-medium">
            <button
              type="button"
              onClick={() => onProviderChange('gemini')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                provider === 'gemini'
                  ? 'bg-[#21262E] text-white border border-[#3A414A] font-semibold shadow-xs'
                  : 'text-[#8E9299] hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Gemini 3.7 Flash</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/30">
                Native Video
              </span>
            </button>

            <button
              type="button"
              onClick={() => onProviderChange('groq')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                provider === 'groq'
                  ? 'bg-[#21262E] text-white border border-[#3A414A] font-semibold shadow-xs'
                  : 'text-[#8E9299] hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-amber-500" />
              <span>Groq Fallback</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Whisper + Vision
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#8E9299] pl-2 border-l border-[#2A2D35]">
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#A1A7B0]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
              Python 3.10
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
