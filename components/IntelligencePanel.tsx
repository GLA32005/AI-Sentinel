import React from 'react';
import { StrategicInsight } from '../types';

interface IntelligencePanelProps {
  insight: StrategicInsight | null;
  onRemediate: () => void;
  isRemediating: boolean;
}

const IntelligencePanel: React.FC<IntelligencePanelProps> = ({ insight, onRemediate, isRemediating }) => {
  if (!insight) {
    return (
      <div className="h-full bg-slate-950 rounded-lg border border-slate-800 p-6 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none"></div>
        <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mb-4 group-hover:border-indigo-500/50 transition-colors">
            <svg className="w-6 h-6 text-slate-500 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
        </div>
        <h3 className="text-sm font-bold text-slate-300 mb-1">AI 核心监控中</h3>
        <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
           神经网络正在分析实时数据流。等待高价值情报生成...
        </p>
        <span className="mt-4 flex h-1.5 w-1.5 relative">
           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
           <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
        </span>
      </div>
    );
  }

  const severityColor = {
    critical: 'border-l-rose-500 bg-rose-500/5',
    high: 'border-l-orange-500 bg-orange-500/5',
    medium: 'border-l-amber-500 bg-amber-500/5',
    info: 'border-l-blue-500 bg-blue-500/5'
  }[insight.severity] || 'border-l-slate-500';

  const titleColor = {
    critical: 'text-rose-300',
    high: 'text-orange-300',
    medium: 'text-amber-300',
    info: 'text-blue-300'
  }[insight.severity] || 'text-slate-300';

  return (
    <div className={`h-full bg-slate-950 rounded-lg border border-slate-800 shadow-xl overflow-hidden flex flex-col relative`}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/></svg>
      </div>

      <div className="p-3 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/30">
        <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
               <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">AI 智能分析摘要</span>
        </div>
        <span className="text-[10px] font-mono text-slate-600">{insight.timestamp}</span>
      </div>

      <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto">
         {/* Title Section */}
         <div className={`border-l-2 pl-4 py-1 ${severityColor}`}>
            <h3 className={`text-sm font-bold ${titleColor} mb-1 flex items-center gap-2`}>
                {insight.title}
            </h3>
            <span className="text-[10px] uppercase font-mono tracking-wide opacity-70 border border-slate-700 rounded px-1.5 py-0.5">
                Level: {insight.severity}
            </span>
         </div>

         {/* Content */}
         <div className="text-xs text-slate-300 leading-relaxed opacity-90">
             {insight.content}
         </div>

         {/* Recommendation Box */}
         <div className="mt-auto flex flex-col gap-3">
             <div className="bg-slate-900/80 rounded border border-slate-800 p-3">
                 <div className="text-[10px] font-bold text-emerald-500 uppercase mb-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    AI 建议 (Action Plan)
                 </div>
                 <p className="text-xs text-slate-400 font-mono">
                     {insight.recommendation}
                 </p>
             </div>

             <button 
                onClick={onRemediate}
                disabled={isRemediating}
                className={`w-full py-2 px-4 rounded font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    isRemediating 
                    ? 'bg-emerald-500/20 text-emerald-400 cursor-wait border border-emerald-500/50' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                }`}
             >
                {isRemediating ? (
                    <>
                        <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                        执行处置协议...
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        立即执行处置
                    </>
                )}
             </button>
         </div>
      </div>
    </div>
  );
};

export default IntelligencePanel;