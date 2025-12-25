import React, { useEffect, useRef } from 'react';
import { LogEntry, AgentRole } from '../types';

interface TerminalProps {
  logs: LogEntry[];
}

const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getRoleColor = (role: AgentRole) => {
    switch (role) {
      // Commander: softer amber instead of bright yellow
      case AgentRole.COMMANDER: return 'text-amber-300';
      // Scout: emerald instead of neon green
      case AgentRole.SCOUT: return 'text-emerald-300';
      // Sniper: rose instead of pure red
      case AgentRole.SNIPER: return 'text-rose-300';
      // Analyst: sky blue instead of deep blue
      case AgentRole.ANALYST: return 'text-sky-300';
      default: return 'text-slate-400';
    }
  };

  const getMsgColor = (type: LogEntry['type']) => {
    switch (type) {
      // Messages: using 400 scale for better readability on dark bg, avoiding harsh 500s
      case 'danger': return 'text-rose-400';
      case 'warning': return 'text-amber-400';
      case 'success': return 'text-emerald-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs md:text-sm overflow-hidden shadow-2xl">
      {/* Mac-style header */}
      <div className="bg-slate-900 p-2 flex items-center gap-2 border-b border-slate-800">
        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
        <span className="ml-2 text-slate-500 text-xs opacity-50">ooda_loop_v2.sh — active</span>
      </div>
      
      {/* Logs */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300 leading-relaxed">
            <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
            <span className={`font-medium shrink-0 w-24 ${getRoleColor(log.agentRole)}`}>
              {log.agentRole}:
            </span>
            <span className={`${getMsgColor(log.type)} break-all opacity-90`}>
               <span className="mr-2 text-slate-600 select-none">{'>'}</span>{log.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-slate-600 italic opacity-50">系统初始化完成。等待巡航指令...</div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default Terminal;