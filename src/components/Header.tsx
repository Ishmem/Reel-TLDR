import React from 'react';
import { Video, Cpu, CheckCircle2, Zap, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  hasGroqKey?: boolean;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasGroqKey = true,
  theme = 'light',
  onToggleTheme
}) => {
  return (
    <header className="border-b-[2.5px] border-border bg-card-subtle sticky top-0 z-30 shadow-brutal-header transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gold border-2 border-border shadow-brutal-md flex items-center justify-center text-main">
            <Video className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-main tracking-tight">
                Instagram Reel Content Analyzer
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink text-main border-2 border-border shadow-brutal-sm">
                <Cpu className="w-3.5 h-3.5 stroke-[2.5]" />
                Groq AI Engine
              </span>
            </div>
            <p className="text-xs text-muted font-medium mt-0.5">
              Multimodal video analyzer extracting spoken speech (Whisper), on-screen text, list items, and key takeaways
            </p>
          </div>
        </div>

        {/* Right: AI Engine Status & Dark Mode Toggle */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-card rounded-xl border-2 border-border shadow-brutal-sm text-xs font-medium">
            <div className="flex items-center gap-1.5 text-main font-bold">
              <Zap className="w-3.5 h-3.5 fill-gold stroke-[2.5]" />
              <span>Whisper + Llama 3</span>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gold text-main border-1.5 border-border font-bold">
              Ultra-Fast
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs pl-2 border-l-2 border-border">
            <span className="inline-flex items-center gap-1.5 font-bold text-xs text-main bg-sage px-2.5 py-1 rounded-full border-2 border-border shadow-brutal-sm">
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              {hasGroqKey ? 'Online' : 'API Ready'}
            </span>
          </div>

          {/* Theme Sun/Moon Toggle Button */}
          {onToggleTheme && (
            <button
              type="button"
              id="header-theme-toggle"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-border bg-card text-main shadow-brutal-sm hover:bg-gold transition-all cursor-pointer font-bold text-xs active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-gold stroke-[2.5]" />
                  <span className="hidden md:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 stroke-[2.5]" />
                  <span className="hidden md:inline">Dark</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
