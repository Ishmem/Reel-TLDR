import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ListOrdered,
  Tag,
  Smile,
  Layers,
  Sparkles
} from 'lucide-react';
import { BatchAnalysisResponse, AnalysisResponse } from '../types';
import { AnalysisResultView } from './AnalysisResultView';

interface BatchResultViewProps {
  batchData: BatchAnalysisResponse;
  onReset: () => void;
}

export const BatchResultView: React.FC<BatchResultViewProps> = ({ batchData, onReset }) => {
  const [selectedReelIndex, setSelectedReelIndex] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'combined'>('items');

  const handleDownloadBatchSummary = () => {
    const text = batchData.combined_summary_text || '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch_reels_summary.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadBatchJson = () => {
    const content = JSON.stringify(batchData.results, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch_reels_combined.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCombinedSummary = () => {
    if (batchData.combined_summary_text) {
      navigator.clipboard.writeText(batchData.combined_summary_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Batch Summary Header Card */}
      <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#2A2D35]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#6366F1]/15 text-[#818CF8] border border-[#6366F1]/30">
                Batch Process Report
              </span>
              <span className="text-xs text-[#8E9299]">
                {batchData.successful} of {batchData.total} Succeeded
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Batch Reel Analysis Summary
            </h2>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadBatchSummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E2E4E9] bg-[#21262E] hover:bg-[#2A2D35] rounded-lg transition-colors border border-[#3A414A] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Combined .txt
            </button>
            <button
              type="button"
              onClick={handleDownloadBatchJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E2E4E9] bg-[#21262E] hover:bg-[#2A2D35] rounded-lg transition-colors border border-[#3A414A] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Combined .json
            </button>
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-1.5 text-xs font-medium text-[#8E9299] hover:text-white hover:bg-[#21262E] rounded-lg transition-colors cursor-pointer"
            >
              New Batch
            </button>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'items'
                ? 'bg-[#21262E] text-white border border-[#3A414A]'
                : 'text-[#8E9299] hover:text-white hover:bg-[#21262E]/50'
            }`}
          >
            Individual Reel Inspector ({batchData.results.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('combined')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'combined'
                ? 'bg-[#21262E] text-white border border-[#3A414A]'
                : 'text-[#8E9299] hover:text-white hover:bg-[#21262E]/50'
            }`}
          >
            Combined Rollup Report
          </button>
        </div>
      </div>

      {activeTab === 'combined' ? (
        /* Combined Rollup View */
        <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] shadow-xs p-5 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-white">
              Batch Combined Summary Text
            </h3>
            <button
              type="button"
              onClick={copyCombinedSummary}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#E2E4E9] hover:text-white bg-[#21262E] hover:bg-[#2A2D35] px-3 py-1.5 rounded-lg border border-[#3A414A] cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Text'}
            </button>
          </div>
          <pre className="p-4 bg-[#0F1115] border border-[#2A2D35] text-[#A1A7B0] rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {batchData.combined_summary_text || 'No combined text available.'}
          </pre>
        </div>
      ) : (
        /* Individual List & Inspector */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: List of Reels (4 cols) */}
          <div className="lg:col-span-4 space-y-2">
            <h3 className="text-xs font-semibold text-[#8E9299] uppercase tracking-wider px-1">
              Processed Reels ({batchData.results.length})
            </h3>
            {batchData.results.map((item, idx) => {
              const isSelected = selectedReelIndex === idx;
              const isSuccess = item.status === 'SUCCESS';
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedReelIndex(idx)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#21262E] text-white border-[#6366F1] shadow-sm'
                      : 'bg-[#16191E] text-[#E2E4E9] border-[#2A2D35] hover:border-[#3A414A] hover:bg-[#21262E]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {isSuccess ? (
                        <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span className="font-semibold text-xs truncate max-w-[140px] text-white">
                        Reel #{idx + 1}
                      </span>
                    </div>
                    {item.shortcode && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isSelected ? 'bg-[#0F1115] text-[#818CF8] border border-[#6366F1]/30' : 'bg-[#21262E] text-[#8E9299] border border-[#2A2D35]'}`}>
                        {item.shortcode}
                      </span>
                    )}
                  </div>

                  <p className={`text-xs line-clamp-2 ${isSelected ? 'text-[#E2E4E9]' : 'text-[#8E9299]'}`}>
                    {item.analysis?.summary || item.error || item.url}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Right Column: Selected Reel Inspector (8 cols) */}
          <div className="lg:col-span-8">
            {selectedReelIndex !== null && batchData.results[selectedReelIndex] ? (
              batchData.results[selectedReelIndex].status === 'SUCCESS' ? (
                <AnalysisResultView result={batchData.results[selectedReelIndex]} />
              ) : (
                <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] p-6 text-center">
                  <XCircle className="w-10 h-10 text-rose-400 mx-auto mb-2" />
                  <h3 className="text-base font-semibold text-white">Analysis Failed for this Reel</h3>
                  <p className="text-xs text-[#8E9299] mt-1 max-w-md mx-auto">
                    {batchData.results[selectedReelIndex].error || 'Could not process reel video.'}
                  </p>
                </div>
              )
            ) : (
              <div className="bg-[#16191E] rounded-xl border border-[#2A2D35] p-8 text-center text-[#8E9299]">
                Select a reel from the list to view its full multimodal analysis.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
