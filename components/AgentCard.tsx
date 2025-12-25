import React from 'react';
import { Agent, AgentStatus, AgentRole } from '../types';

interface AgentCardProps {
  agent: Agent;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  const isThinking = agent.status === AgentStatus.THINKING;
  const isActing = agent.status === AgentStatus.ACTING || agent.status === AgentStatus.OBSERVING;

  const getRoleIcon = (role: AgentRole) => {
    switch (role) {
      case AgentRole.COMMANDER: return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      );
      case AgentRole.SCOUT: return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
      case AgentRole.SNIPER: return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
      case AgentRole.ANALYST: return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    }
  };

  const borderColor = {
    [AgentRole.COMMANDER]: 'border-yellow-500/30',
    [AgentRole.SCOUT]: 'border-green-500/30',
    [AgentRole.SNIPER]: 'border-red-500/30',
    [AgentRole.ANALYST]: 'border-blue-500/30',
  }[agent.role];

  const bgColor = {
    [AgentRole.COMMANDER]: 'bg-yellow-500/10 text-yellow-500',
    [AgentRole.SCOUT]: 'bg-green-500/10 text-green-500',
    [AgentRole.SNIPER]: 'bg-red-500/10 text-red-500',
    [AgentRole.ANALYST]: 'bg-blue-500/10 text-blue-500',
  }[agent.role];

  const roleLabels: Record<AgentRole, string> = {
    [AgentRole.COMMANDER]: '指挥官',
    [AgentRole.SCOUT]: '侦察兵',
    [AgentRole.SNIPER]: '攻防专家',
    [AgentRole.ANALYST]: '分析师',
  };

  const statusLabels: Record<string, string> = {
    [AgentStatus.IDLE]: '待命',
    [AgentStatus.THINKING]: '思考中',
    [AgentStatus.OBSERVING]: '观察中',
    [AgentStatus.ACTING]: '执行中',
    [AgentStatus.REPORTING]: '汇报中',
  };

  return (
    <div className={`p-4 rounded-lg bg-slate-900 border ${borderColor} flex items-center justify-between`}>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-full ${bgColor}`}>
          {getRoleIcon(agent.role)}
        </div>
        <div>
          <h3 className="font-semibold text-slate-200 text-sm">{agent.name}</h3>
          <p className="text-xs text-slate-500 font-mono">{roleLabels[agent.role]}</p>
        </div>
      </div>
      
      <div className="flex flex-col items-end">
        <div className="flex items-center gap-2">
           {isThinking && (
             <span className="flex h-2 w-2 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
             </span>
           )}
           {isActing && (
             <span className="flex h-2 w-2 relative">
               <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
             </span>
           )}
           <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
             {statusLabels[agent.status] || agent.status}
           </span>
        </div>
        <div className="text-[10px] text-slate-500 mt-1 max-w-[120px] truncate text-right">
          {agent.currentTask || "Standing by"}
        </div>
      </div>
    </div>
  );
};

export default AgentCard;