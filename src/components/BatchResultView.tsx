import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Download,
  Copy,
  Check,
  Layers,
  Sparkles
} from 'lucide-react';
import { BatchAnalysisResponse } from '../types';
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
      <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6 md:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b-2 border-[#1A1A1A]">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E8B94A] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A]">
                Batch Process Report
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#C8D5C0] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[1.5px_1.5px_0px_#1A1A1A]">
                {batchData.successful} of {batchData.total} Succeeded
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[#1A1A1A] tracking-tight font-display">
              Batch Reel Analysis Summary
            </h2>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleDownloadBatchSummary}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1A1A1A] bg-white hover:bg-[#FAF7F2] rounded-xl transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Combined .txt</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadBatchJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1A1A1A] bg-white hover:bg-[#FAF7F2] rounded-xl transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Combined .json</span>
            </button>
            <button
              type="button"
              onClick={onReset}
              className="px-3.5 py-2 text-xs font-bold text-[#1A1A1A] bg-[#E8B94A] hover:bg-[#d8a83a] rounded-xl transition-all border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] cursor-pointer"
            >
              New Batch
            </button>
          </div>
        </div>

        {/* View Switcher Tabs (Bordered Pill Switcher) */}
        <div className="flex items-center gap-2 mt-5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border-2 border-[#1A1A1A] ${
              activeTab === 'items'
                ? 'bg-[#E8B94A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] shadow-[1.5px_1.5px_0px_#1A1A1A]'
            }`}
          >
            Individual Reel Inspector ({batchData.results.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('combined')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border-2 border-[#1A1A1A] ${
              activeTab === 'combined'
                ? 'bg-[#E8B94A] text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] shadow-[1.5px_1.5px_0px_#1A1A1A]'
            }`}
          >
            Combined Rollup Report
          </button>
        </div>
      </div>

      {activeTab === 'combined' ? (
        /* Combined Rollup View */
        <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-6 md:p-7">
          <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-[#1A1A1A]">
            <h3 className="text-lg font-bold text-[#1A1A1A] font-display">
              Batch Combined Summary Text
            </h3>
            <button
              type="button"
              onClick={copyCombinedSummary}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1A1A1A] bg-white hover:bg-[#FAF7F2] px-3.5 py-2 rounded-xl border-2 border-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] cursor-pointer transition-all"
            >
              {copied ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
          </div>
          <pre className="p-5 bg-[#FAF7F2] border-2 border-[#1A1A1A] text-[#1A1A1A] rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto shadow-[2px_2px_0px_#1A1A1A]">
            {batchData.combined_summary_text || 'No combined text available.'}
          </pre>
        </div>
      ) : (
        /* Individual List & Inspector */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: List of Reels (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider px-1 font-display">
              Processed Reels ({batchData.results.length})
            </h3>
            <div className="space-y-2.5">
              {batchData.results.map((item, idx) => {
                const isSelected = selectedReelIndex === idx;
                const isSuccess = item.status === 'SUCCESS';
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedReelIndex(idx)}
                    className={`w-full text-left p-4 rounded-xl border-2 border-[#1A1A1A] transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#E8B94A] text-[#1A1A1A] shadow-[3px_3px_0px_#1A1A1A] translate-x-[-1px] translate-y-[-1px]'
                        : 'bg-white text-[#1A1A1A] shadow-[2px_2px_0px_#1A1A1A] hover:bg-[#FAF7F2] hover:shadow-[3px_3px_0px_#1A1A1A]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {isSuccess ? (
                          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <XCircle className="w-4 h-4 stroke-[2.5]" />
                        )}
                        <span className="font-bold text-xs truncate max-w-[140px] text-[#1A1A1A]">
                          Reel #{idx + 1}
                        </span>
                      </div>
                      {item.shortcode && (
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border border-[#1A1A1A] font-bold ${isSelected ? 'bg-white text-[#1A1A1A]' : 'bg-[#FAF7F2] text-[#1A1A1A]'}`}>
                          {item.shortcode}
                        </span>
                      )}
                    </div>

                    <p className="text-xs line-clamp-2 text-[#1A1A1A] font-medium">
                      {item.analysis?.summary || item.error || item.url}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Reel Inspector (8 cols) */}
          <div className="lg:col-span-8">
            {selectedReelIndex !== null && batchData.results[selectedReelIndex] ? (
              batchData.results[selectedReelIndex].status === 'SUCCESS' ? (
                <AnalysisResultView result={batchData.results[selectedReelIndex]} />
              ) : (
                <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-8 text-center">
                  <XCircle className="w-12 h-12 stroke-[2.5] mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-[#1A1A1A] font-display">Analysis Failed for this Reel</h3>
                  <p className="text-xs text-[#555] font-medium mt-1 max-w-md mx-auto">
                    {batchData.results[selectedReelIndex].error || 'Could not process reel video.'}
                  </p>
                </div>
              )
            ) : (
              <div className="bg-white rounded-2xl border-[2.5px] border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] p-8 text-center text-[#555] font-medium">
                Select a reel from the list to view its full multimodal analysis.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
