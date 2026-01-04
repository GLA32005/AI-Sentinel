import React, { useEffect, useRef, useState } from 'react';
import { LogEntry, AgentRole } from '../types';

interface TerminalProps {
  logs: LogEntry[];
  onCommand?: (cmd: string) => void;
}

const COMMAND_LIST = [
  { cmd: '/scan', args: '<target>', desc: '深度扫描目标资产' },
  { cmd: '/isolate', args: '<host>', desc: '隔离受损主机' },
  { cmd: '/remediate', args: '<host>', desc: '执行漏洞修复' },
  { cmd: '/status', args: '', desc: '显示系统状态' },
  { cmd: '/clear', args: '', desc: '清空日志' },
  { cmd: '/help', args: '', desc: '显示帮助信息' },
];

const Terminal: React.FC<TerminalProps> = ({ logs, onCommand }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && onCommand) {
      onCommand(input.trim());
      setInput('');
      setShowHelp(false);
    }
  };

  const getRoleColor = (role: AgentRole | 'USER') => {
    switch (role) {
      case AgentRole.COMMANDER: return 'text-amber-400';
      case AgentRole.SCOUT: return 'text-emerald-400';
      case AgentRole.SNIPER: return 'text-rose-400';
      case AgentRole.ANALYST: return 'text-cyan-400';
      case 'USER': return 'text-slate-300';
      default: return 'text-slate-400';
    }
  };

  const getMsgColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'danger': return 'text-rose-500';
      case 'warning': return 'text-amber-500';
      case 'success': return 'text-emerald-500';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded border border-slate-800 font-mono text-xs md:text-sm overflow-hidden shadow-2xl relative">
      {/* CRT Effects */}
      <div className="scanlines opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-indigo-900/10 pointer-events-none"></div>

      {/* Header */}
      <div className="bg-slate-900/80 p-2 flex items-center justify-between border-b border-slate-800 shrink-0 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-emerald-500/80 text-[10px] uppercase tracking-widest">System_Log // Live</span>
        </div>
        <div className="text-[10px] text-slate-600">bash v2.4.0</div>
      </div>
      
      {/* Logs */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2 z-10 font-mono text-[11px] md:text-xs">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300 leading-relaxed border-l border-transparent hover:border-slate-700 pl-1">
            <span className="text-slate-600 shrink-0 select-none opacity-60">[{log.timestamp}]</span>
            <span className={`font-bold shrink-0 w-24 ${getRoleColor(log.agentRole)} uppercase tracking-tighter`}>
              {log.agentRole === 'USER' ? 'SYS_ADMIN' : log.agentRole}
            </span>
            <span className={`${getMsgColor(log.type)} break-all`}>
               <span className="mr-2 text-slate-700 select-none">::</span>{log.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-slate-600 italic opacity-50 p-2">
             > Initializing Neural Sentinel Kernel...<br/>
             > Connecting to Secure Grid...<br/>
             > Ready for input.
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Command Helper Popover */}
      {showHelp && (
        <div className="absolute bottom-12 left-2 right-2 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-slate-950/50 p-2 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                <span>Available Commands</span>
                <button onClick={() => setShowHelp(false)} className="hover:text-slate-300">✕</button>
            </div>
            <div className="p-1 max-h-48 overflow-y-auto">
                {COMMAND_LIST.map((item) => (
                    <button
                        key={item.cmd}
                        onClick={() => {
                            setInput(`${item.cmd} `);
                            // Keep help open to see args or close? Usually closing is better UX if they just want to type args. 
                            // Or focusing input.
                            const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
                            inputEl?.focus();
                        }}
                        className="w-full flex items-center justify-between p-2 hover:bg-slate-800 rounded group text-left transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold">{item.cmd}</span>
                            <span className="text-slate-500 text-[10px]">{item.args}</span>
                        </div>
                        <span className="text-slate-400 text-[10px] opacity-70 group-hover:opacity-100">{item.desc}</span>
                    </button>
                ))}
            </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-slate-800 bg-slate-900/80 flex items-center gap-2 shrink-0 z-20 backdrop-blur relative">
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className={`p-1.5 rounded transition-colors ${showHelp ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
            title="Command List"
          >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
          </button>
          
          <span className="text-emerald-500 font-bold animate-pulse select-none">{'>'}</span>
          
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Execute Command..."
            className="flex-1 bg-transparent border-none outline-none text-emerald-100 placeholder-slate-600 font-mono text-xs focus:ring-0"
            autoComplete="off"
            spellCheck="false"
          />
      </form>
    </div>
  );
};

export default Terminal;