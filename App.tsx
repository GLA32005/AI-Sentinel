import React, { useState, useEffect, useRef } from 'react';
import NetworkGraph from './components/NetworkGraph';
import Terminal from './components/Terminal';
import AgentCard from './components/AgentCard';
import IntelligencePanel from './components/IntelligencePanel';
import VoiceCommander from './components/VoiceCommander';
import VulnerabilityModal from './components/VulnerabilityModal';
import { simulateAgentStep, testModelConnection } from './services/geminiService';
import { INITIAL_AGENTS, INITIAL_NETWORK_DATA } from './constants';
import { 
  AppConfig, 
  Agent, 
  LogEntry, 
  NetworkGraphData, 
  Vulnerability, 
  StrategicInsight, 
  AgentRole,
  AgentStatus
} from './types';

// Increased interval to 10000ms to avoid hitting Gemini Free Tier rate limits (RPM)
const DEFAULT_CONFIG: AppConfig = {
  interval: 10000, 
  model: 'gemini-3-flash-preview',
  targetNetwork: '192.168.1.0/24',
  apiEndpoint: '',
  apiKey: ''
};

const PRESET_MODELS = [
  { value: 'gemini-3-flash-preview', label: 'gemini-3-flash-preview (Speed)' },
  { value: 'gemini-3-pro-preview', label: 'gemini-3-pro-preview (Reasoning)' }
];

export default function App() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  
  // Config Modal State
  const [tempConfig, setTempConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Simulation State
  const [isRunning, setIsRunning] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [networkData, setNetworkData] = useState<NetworkGraphData>(INITIAL_NETWORK_DATA);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [latestInsight, setLatestInsight] = useState<StrategicInsight | null>(null);
  
  // UI Interaction State
  const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null);
  const [isRemediating, setIsRemediating] = useState(false);

  // Stats for Status Bar
  const errorCount = logs.filter(l => l.type === 'danger').length;
  const warningCount = logs.filter(l => l.type === 'warning').length;

  // Initialize temp config
  useEffect(() => {
    if (showConfig) setTempConfig(config);
  }, [showConfig, config]);

  // Simulation Loop
  useEffect(() => {
    let timer: any;
    if (isRunning) {
      timer = setInterval(async () => {
        try {
          // Update Active Agent Status
          const phase = cycleCount % 4;
          const roleMap = [AgentRole.SCOUT, AgentRole.ANALYST, AgentRole.COMMANDER, AgentRole.SNIPER];
          const activeRole = roleMap[phase];

          setAgents(prev => prev.map(a => ({
            ...a,
            status: a.role === activeRole ? AgentStatus.THINKING : AgentStatus.IDLE
          })));

          // Call Gemini
          const knownAssets = networkData.nodes.map(n => `${n.label} (${n.ip})`);
          const result = await simulateAgentStep(cycleCount, knownAssets, config);

          // Update State based on result
          if (result.logs) {
            setLogs(prev => [...prev.slice(-50), ...result.logs]);
            
            // Update Agent logs/task
            const lastLog = result.logs[result.logs.length - 1];
            setAgents(prev => prev.map(a => {
               if (a.role === lastLog.agentRole) {
                   return { 
                       ...a, 
                       logs: [...a.logs.slice(-4), lastLog.message],
                       status: AgentStatus.ACTING,
                       currentTask: lastLog.message.slice(0, 30) + '...'
                   };
               }
               return a;
            }));
          }

          if (result.newAssets) {
             setNetworkData(prev => {
                 const newNodes = result.newAssets!.map((asset, i) => ({
                     id: `new-${Date.now()}-${i}`,
                     group: 4,
                     label: asset.label,
                     ip: asset.ip,
                     status: 'unknown' as const,
                     riskScore: 50
                 }));
                 // Link to gateway
                 const newLinks = newNodes.map(n => ({
                     source: 'gateway',
                     target: n.id,
                     value: 1
                 }));
                 return {
                     nodes: [...prev.nodes, ...newNodes],
                     links: [...prev.links, ...newLinks]
                 };
             });
          }

          if (result.vulnerability) {
              setVulnerabilities(prev => [...prev, result.vulnerability!]);
              // Mark random node as vulnerable for visual effect
              setNetworkData(prev => ({
                  ...prev,
                  nodes: prev.nodes.map(n => n.id === 'web-prod' ? { ...n, status: 'vulnerable', riskScore: 80 } : n)
              }));
          }

          if (result.strategicInsight) {
              setLatestInsight(result.strategicInsight);
          }

          if (result.shouldStop) {
              setIsRunning(false);
          }

          setCycleCount(c => c + 1);

        } catch (e) {
            console.error(e);
            setIsRunning(false);
        }
      }, config.interval);
    }
    return () => clearInterval(timer);
  }, [isRunning, cycleCount, config, networkData]);

  const handleTestConnection = async () => {
    setTestStatus('testing');
    const success = await testModelConnection(tempConfig);
    setTestStatus(success ? 'success' : 'error');
    if (success) setTimeout(() => setTestStatus('idle'), 3000);
  };

  const saveConfig = () => {
      setConfig(tempConfig);
      setShowConfig(false);
  };

  const handleRemediation = async () => {
      if (!selectedVulnerability) return;

      setIsRemediating(true);
      
      // Log initiation
      setLogs(prev => [...prev, {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          agentRole: AgentRole.SNIPER,
          message: `正在执行针对主机 ${selectedVulnerability.host} 的漏洞修复协议...`,
          type: 'warning'
      }]);

      // Simulate remediation delay
      await new Promise(r => setTimeout(r, 2000));
      
      // Remove specifically the selected vulnerability
      setVulnerabilities(prev => {
          const remaining = prev.filter(v => v.id !== selectedVulnerability.id);
          
          // If no vulnerabilities left, reset network visual status
          if (remaining.length === 0) {
             setLatestInsight(null);
             setNetworkData(data => ({
                ...data,
                nodes: data.nodes.map(n => ({ 
                    ...n, 
                    status: n.status === 'vulnerable' || n.status === 'compromised' ? 'secure' : n.status, 
                    riskScore: 10 
                }))
             }));
          }
          return remaining;
      });

      setLogs(prev => [...prev, {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          agentRole: AgentRole.SNIPER,
          message: `漏洞 [${selectedVulnerability.name}] 已成功修复，系统恢复安全状态。`,
          type: 'success'
      }]);
      
      setIsRemediating(false);
      setSelectedVulnerability(null);
  };

  const isPresetModel = (model: string) => PRESET_MODELS.some(p => p.value === model);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden selection:bg-indigo-500/30">
        {/* Header */}
        <header className="h-14 border-b border-slate-800 bg-slate-950/50 backdrop-blur flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                    <h1 className="font-bold tracking-wider text-lg bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                        GLA3-NEURAL SENTINEL <span className="text-slate-600 text-xs font-mono ml-2">v2.0.4</span>
                    </h1>
                </div>
                {/* Target Info Removed */}
            </div>

            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setShowConfig(true)}
                    className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                    title="配置"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
                <button
                    onClick={() => setIsRunning(!isRunning)}
                    className={`px-4 py-1.5 rounded text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${
                        isRunning 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20 shadow-red-500/10' 
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/20 shadow-emerald-500/10'
                    }`}
                >
                    {isRunning ? (
                        <>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            STOP SYSTEM
                        </>
                    ) : (
                        <>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                            INITIATE
                        </>
                    )}
                </button>
            </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 p-4 grid grid-cols-12 gap-4 min-h-0 overflow-hidden relative z-0">
            {/* Left: Agents */}
            <div className="col-span-3 flex flex-col gap-3 overflow-y-auto pr-1">
                {agents.map(agent => (
                    <AgentCard key={agent.id} agent={agent} />
                ))}
            </div>

            {/* Middle: Graph & Terminal */}
            <div className="col-span-6 flex flex-col gap-4 min-h-0">
                <div className="flex-[2] min-h-0 rounded-lg overflow-hidden border border-slate-800 bg-slate-900/50 relative">
                     <NetworkGraph data={networkData} />
                     
                     {/* Overlay Stats */}
                     <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none">
                        <div className="bg-slate-900/80 backdrop-blur border border-slate-700 p-2 rounded text-xs">
                            <span className="text-slate-500 block mb-1">NODES</span>
                            <span className="text-slate-200 font-mono text-lg">{networkData.nodes.length}</span>
                        </div>
                        <div className="bg-slate-900/80 backdrop-blur border border-slate-700 p-2 rounded text-xs">
                            <span className="text-slate-500 block mb-1">RISK LEVEL</span>
                            <span className={`font-mono text-lg ${vulnerabilities.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {vulnerabilities.length > 0 ? 'CRITICAL' : 'STABLE'}
                            </span>
                        </div>
                     </div>
                </div>
                <div className="flex-1 min-h-0">
                    <Terminal logs={logs} />
                </div>
            </div>

            {/* Right: Intelligence */}
            <div className="col-span-3 flex flex-col gap-4 min-h-0">
                <div className="flex-1 min-h-0">
                    <IntelligencePanel 
                        insight={latestInsight} 
                        onRemediate={() => {
                            if (vulnerabilities.length > 0) {
                                setSelectedVulnerability(vulnerabilities[0]);
                                setTimeout(() => handleRemediation(), 100);
                            }
                        }}
                        isRemediating={isRemediating}
                    />
                </div>
                
                {/* Vulnerability List */}
                <div className="h-1/3 bg-slate-900 rounded-lg border border-slate-800 p-3 flex flex-col">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>风险态势 (Risk Posture)</span>
                        <span className="bg-slate-800 text-slate-400 px-1.5 rounded text-[10px]">{vulnerabilities.length}</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {vulnerabilities.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
                                未发现活跃威胁 (No active threats)
                            </div>
                        ) : (
                            vulnerabilities.map(v => (
                                <div 
                                    key={v.id} 
                                    onClick={() => setSelectedVulnerability(v)}
                                    className="p-2 bg-slate-950/50 border border-slate-800 rounded hover:border-slate-600 cursor-pointer transition-colors group"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs font-bold ${
                                            v.severity === 'Critical' ? 'text-red-400' : 
                                            v.severity === 'High' ? 'text-orange-400' : 'text-yellow-400'
                                        }`}>{v.name}</span>
                                        <span className="text-[10px] text-slate-500 group-hover:text-slate-300">{v.severity}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate font-mono">
                                        Host: {v.host}
                                    </div>
                                    <div className="hidden group-hover:block text-[10px] text-indigo-400 mt-1">
                                        点击查看详情 & 处置 &rarr;
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Status Bar (VS Code Style) */}
        <footer className="h-6 bg-indigo-950 border-t border-indigo-900 flex items-center justify-between px-3 text-[10px] text-slate-300 select-none shrink-0 z-20">
            {/* Left Section */}
            <div className="flex items-center h-full gap-3">
                <div className="flex items-center gap-1 hover:bg-white/10 px-1 h-full cursor-pointer transition-colors" title="Remote Connection">
                    <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="font-bold text-indigo-100">SENTINEL</span>
                </div>
                
                <div className="flex items-center gap-1 hover:bg-white/10 px-1 h-full cursor-pointer transition-colors text-slate-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <span>main*</span>
                </div>

                <div className="flex items-center gap-3 ml-2">
                    <div className="flex items-center gap-1 hover:bg-white/10 px-1 h-full cursor-pointer transition-colors" title={`${errorCount} Errors`}>
                        <svg className="w-3 h-3 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{errorCount}</span>
                    </div>
                    <div className="flex items-center gap-1 hover:bg-white/10 px-1 h-full cursor-pointer transition-colors" title={`${warningCount} Warnings`}>
                        <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>{warningCount}</span>
                    </div>
                </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center h-full gap-4">
                <div className="flex items-center gap-1 hover:bg-white/10 px-1 h-full cursor-pointer transition-colors" title="Current OODA Cycle">
                    <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Cycle: {cycleCount}</span>
                </div>

                <div 
                    onClick={() => setShowConfig(true)}
                    className="flex items-center gap-1 hover:bg-white/10 px-1 h-full cursor-pointer transition-colors" 
                    title="Active Model (Click to Change)"
                >
                    <svg className="w-3 h-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <span>{config.model || 'Local Model'}</span>
                </div>

                <div className="flex items-center gap-1 hover:bg-white/10 px-1 h-full cursor-pointer transition-colors" title="Target Network">
                     <span className="text-emerald-500">Target:</span>
                     <span>{config.targetNetwork}</span>
                </div>

                <div className="hover:bg-white/10 px-2 h-full flex items-center cursor-pointer">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                </div>
            </div>
        </footer>

        {/* Modals */}
        <VulnerabilityModal 
            vulnerability={selectedVulnerability} 
            onClose={() => setSelectedVulnerability(null)} 
            onRemediate={handleRemediation}
            isRemediating={isRemediating}
        />
        
        <VoiceCommander 
            apiKey={config.apiKey} 
            vulnerabilities={vulnerabilities}
            latestInsight={latestInsight}
            onExecuteRemediation={() => {
                if (vulnerabilities.length > 0) {
                    setSelectedVulnerability(vulnerabilities[0]);
                    setTimeout(() => handleRemediation(), 100);
                }
            }}
        />

        {/* Config Modal */}
        {showConfig && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-lg shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                        <h3 className="font-bold text-slate-200">System Configuration</h3>
                        <button onClick={() => setShowConfig(false)} className="text-slate-500 hover:text-white">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-[10px] text-slate-500 uppercase mb-1">Target Network (CIDR)</label>
                            <input 
                              type="text" 
                              value={tempConfig.targetNetwork}
                              onChange={(e) => setTempConfig({...tempConfig, targetNetwork: e.target.value})}
                              className="w-full bg-slate-950 border border-slate-700 text-slate-300 rounded p-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-500 uppercase mb-1">Model Selection</label>
                            <select 
                              value={isPresetModel(tempConfig.model) ? tempConfig.model : 'custom'}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'custom') {
                                      setTempConfig({...tempConfig, model: ''});
                                  } else {
                                      setTempConfig({...tempConfig, model: val});
                                  }
                              }}
                              className="w-full bg-slate-950 border border-slate-700 text-slate-300 rounded p-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                            >
                                {PRESET_MODELS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                                <option value="custom">+ 自定义 / 本地模型 (Custom / Local)</option>
                            </select>

                            {/* Custom Model Input */}
                            {(!isPresetModel(tempConfig.model)) && (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                                    <input 
                                      type="text"
                                      value={tempConfig.model}
                                      onChange={(e) => setTempConfig({...tempConfig, model: e.target.value})}
                                      placeholder="输入模型名称 (e.g. llama3, qwen2.5)"
                                      className="w-full bg-slate-950 border border-indigo-500/50 text-slate-300 rounded p-2 text-xs font-mono focus:border-indigo-500 focus:outline-none placeholder-slate-600"
                                      autoFocus
                                    />
                                    <p className="text-[9px] text-slate-500 mt-1">
                                        请输入本地模型名称 (如 ollama run llama3 中的 llama3)
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        {/* API Endpoint for Custom Models */}
                        <div className="mt-2">
                            <label className="block text-[10px] text-slate-500 uppercase mb-1">服务地址 (Endpoint URL)</label>
                            <input 
                              type="text"
                              value={tempConfig.apiEndpoint || ''}
                              onChange={(e) => {
                                  setTempConfig({...tempConfig, apiEndpoint: e.target.value});
                                  setTestStatus('idle');
                              }}
                              placeholder="Default (Google GenAI)"
                              className="w-full bg-slate-950 border border-slate-700 text-slate-300 rounded p-2 text-xs font-mono focus:border-indigo-500 focus:outline-none placeholder-slate-600"
                            />
                            <p className="text-[9px] text-slate-600 mt-0.5">
                                * 留空使用 Google 官方服务。本地模型示例: http://localhost:11434/v1beta
                            </p>
                        </div>

                        <div className="mt-4">
                            <button
                                onClick={handleTestConnection}
                                disabled={!tempConfig.model || testStatus === 'testing'}
                                className={`w-full py-2 rounded text-xs flex items-center justify-center gap-2 transition-colors ${
                                    testStatus === 'testing' 
                                    ? 'bg-slate-800 text-slate-400 cursor-wait' 
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {testStatus === 'testing' ? (
                                    <>
                                        <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                                        测试连接中...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        测试连接 (Test Connection)
                                    </>
                                )}
                            </button>

                            {/* Test Result Message Below Button */}
                            {testStatus === 'success' && (
                                <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-400 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    连接成功 (Connection Successful)
                                </div>
                            )}
                            
                            {testStatus === 'error' && (
                                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    连接失败 (Connection Failed)
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                            <button onClick={() => setShowConfig(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
                            <button onClick={saveConfig} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded font-bold shadow-lg shadow-indigo-500/20">Save Configuration</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}