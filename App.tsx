import React, { useState, useEffect, useCallback } from 'react';
import { 
  Agent, 
  AgentStatus, 
  LogEntry, 
  NetworkGraphData, 
  Vulnerability, 
  AgentRole,
  AppConfig,
  StrategicInsight
} from './types';
import { INITIAL_AGENTS, INITIAL_NETWORK_DATA } from './constants';
import { simulateAgentStep, testModelConnection } from './services/geminiService';
import NetworkGraph from './components/NetworkGraph';
import Terminal from './components/Terminal';
import AgentCard from './components/AgentCard';
import IntelligencePanel from './components/IntelligencePanel';
import VoiceCommander from './components/VoiceCommander';

const DEFAULT_CONFIG: AppConfig = {
  interval: 8000, // Default to 8s to be safer with rate limits
  model: 'gemini-3-flash-preview',
  targetNetwork: '192.168.1.0/24',
  apiEndpoint: '',
  apiKey: ''
};

const PRESET_MODELS = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash (Fast)' },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3.0 Pro (Thinking)' },
  { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Experimental)' },
  { value: 'gemini-2.0-pro-exp', label: 'Gemini 2.0 Pro (Experimental)' },
];

const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [networkData, setNetworkData] = useState<NetworkGraphData>(INITIAL_NETWORK_DATA);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [isPatrolling, setIsPatrolling] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  
  // Configuration State - Load from LocalStorage if available
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('gla3_config');
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<AppConfig>(config);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Vulnerability Modal State
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);

  // Strategic Insight State
  const [latestInsight, setLatestInsight] = useState<StrategicInsight | null>(null);
  
  // Remediation State
  const [isRemediating, setIsRemediating] = useState(false);

  // Persist Config Effect
  useEffect(() => {
    localStorage.setItem('gla3_config', JSON.stringify(config));
  }, [config]);

  // Helper to add logs
  const addLog = (log: LogEntry) => {
    setLogs(prev => [...prev, log]);
  };

  // Helper to update specific agent
  const updateAgentStatus = (role: AgentRole, status: AgentStatus, task: string) => {
    setAgents(prev => prev.map(a => 
      a.role === role ? { ...a, status, currentTask: task } : a
    ));
  };

  // Remediation Logic
  const handleExecuteRemediation = useCallback(() => {
    if (isRemediating) return;
    setIsRemediating(true);

    addLog({
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        agentRole: AgentRole.COMMANDER,
        message: "收到处置指令。正在初始化修复协议...",
        type: 'warning'
    });

    updateAgentStatus(AgentRole.SNIPER, AgentStatus.REMEDIATING, "执行补丁部署...");

    // Simulate delay
    setTimeout(() => {
        setNetworkData(prev => {
            const newNodes = prev.nodes.map(n => 
                n.status === 'vulnerable' || n.status === 'compromised' 
                ? { ...n, status: 'secure' as const, riskScore: 0 } 
                : n
            );
            return { ...prev, nodes: newNodes };
        });

        setVulnerabilities([]);
        setLatestInsight(null);
        setIsRemediating(false);
        updateAgentStatus(AgentRole.SNIPER, AgentStatus.IDLE, "待命");

        addLog({
            id: Date.now().toString(),
            timestamp: new Date().toLocaleTimeString(),
            agentRole: AgentRole.SNIPER,
            message: "威胁已消除。系统完整性已恢复 (100%)。",
            type: 'success'
        });

    }, 3000);
  }, [isRemediating]);


  // The Simulation Loop
  const runSimulationStep = useCallback(async () => {
    if (!isPatrolling || isRemediating) return; // Pause patrol during remediation

    // 1. Determine active role based on cycle
    const phase = cycleCount % 4;
    const activeRole = [AgentRole.SCOUT, AgentRole.ANALYST, AgentRole.COMMANDER, AgentRole.SNIPER][phase];
    
    // Set active agent to Thinking/Acting
    updateAgentStatus(activeRole, AgentStatus.THINKING, "正在查询神经模型...");

    // 2. Call Gemini Service
    const knownAssets = networkData.nodes.map(n => n.label);
    const result = await simulateAgentStep(cycleCount, knownAssets, config);

    // 3. Process Result
    // Update logs
    result.logs.forEach(log => addLog(log));

    // Check if we need to emergency stop due to rate limits
    if (result.shouldStop) {
      setIsPatrolling(false);
      updateAgentStatus(activeRole, AgentStatus.IDLE, "已暂停");
      return;
    }

    // Update Network Map (if new asset found)
    if (result.newAssets && result.newAssets.length > 0) {
      const newNodes = result.newAssets.map((asset, idx) => ({
        id: `new-${Date.now()}-${idx}`,
        group: asset.type.toLowerCase().includes('db') ? 3 : 2,
        label: asset.label,
        ip: asset.ip,
        status: 'unknown' as const,
        riskScore: 0
      }));

      setNetworkData(prev => ({
        nodes: [...prev.nodes, ...newNodes],
        links: [...prev.links, { source: 'gateway', target: newNodes[0].id, value: 1 }]
      }));
    }

    // Update Vulnerabilities (if found)
    if (result.vulnerability) {
      setVulnerabilities(prev => [...prev, result.vulnerability!]);
      // Mark node as vulnerable visually (simplified logic: pick random or last added)
      setNetworkData(prev => {
        const nodes = [...prev.nodes];
        if (nodes.length > 2) {
            nodes[nodes.length - 1].status = 'vulnerable';
        }
        return { ...prev, nodes };
      });
    }

    // Update Strategic Insight (if found)
    if (result.strategicInsight) {
        setLatestInsight(result.strategicInsight);
        // Also log a notification about it
        addLog({
            id: Date.now().toString(),
            timestamp: new Date().toLocaleTimeString(),
            agentRole: AgentRole.ANALYST,
            message: `★ 生成新的战略情报: ${result.strategicInsight.title}`,
            type: 'success'
        });
    }

    // Reset Agent Status
    updateAgentStatus(activeRole, AgentStatus.IDLE, "待命");
    
    // Increment cycle
    setCycleCount(prev => prev + 1);

  }, [isPatrolling, cycleCount, networkData, config, isRemediating]);

  // Interval for the loop
  useEffect(() => {
    if (isPatrolling) {
      const interval = setInterval(runSimulationStep, config.interval); 
      return () => clearInterval(interval);
    }
  }, [isPatrolling, runSimulationStep, config.interval]);

  const togglePatrol = () => {
    const newState = !isPatrolling;
    setIsPatrolling(newState);
    if (newState) {
      addLog({
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        agentRole: AgentRole.COMMANDER,
        message: "启动自主巡航序列。OODA 循环开始。",
        type: 'warning'
      });
    } else {
      addLog({
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        agentRole: AgentRole.COMMANDER,
        message: "巡航被手动挂起。",
        type: 'info'
      });
      // Reset agents to idle
      setAgents(prev => prev.map(a => ({...a, status: AgentStatus.IDLE, currentTask: '已挂起'})));
    }
  };

  const openSettings = () => {
    setTempConfig(config);
    setTestStatus('idle'); // Reset test status
    // Determine if current config is a custom model or a preset
    const isPreset = PRESET_MODELS.some(m => m.value === config.model);
    setIsCustomModel(!isPreset);
    setIsSettingsOpen(true);
  };

  const handleTestConnection = async () => {
    if (!tempConfig.model.trim()) return;
    setTestStatus('testing');
    const success = await testModelConnection(tempConfig);
    setTestStatus(success ? 'success' : 'error');
  };

  const saveSettings = () => {
    setConfig(tempConfig);
    setIsSettingsOpen(false);
    addLog({
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      agentRole: AgentRole.COMMANDER,
      message: `系统配置已更新: Model=${tempConfig.model}, Endpoint=${tempConfig.apiEndpoint || 'Default'}`,
      type: 'success'
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-neon-blue selection:text-white relative">
      
      {/* Voice Commander (Bottom Right) */}
      <VoiceCommander 
        apiKey={config.apiKey || process.env.API_KEY} 
        vulnerabilities={vulnerabilities}
        latestInsight={latestInsight}
        onExecuteRemediation={handleExecuteRemediation}
      />

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-2">
               <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                 <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
                 系统配置 (Configuration)
               </h3>
               <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
             </div>

             <div className="space-y-4 overflow-y-auto pr-2">
               
               {/* API Key Section */}
               <div className="bg-slate-950/50 p-3 rounded border border-slate-800">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex justify-between">
                     <span>Google Gemini API Key</span>
                     <span className="text-[10px] font-normal text-slate-600">可选 / Optional</span>
                  </label>
                  <input 
                      type="password"
                      value={tempConfig.apiKey || ''}
                      onChange={(e) => {
                          setTempConfig({...tempConfig, apiKey: e.target.value});
                          setTestStatus('idle');
                      }}
                      placeholder={process.env.API_KEY ? "已使用环境变量 (已隐藏)" : "输入 API Key 以解决 429 错误"}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-300 rounded p-2 text-sm focus:border-indigo-500 focus:outline-none placeholder-slate-600"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                      如果遇到 429 错误，请在此输入新的 API Key。配置将保存在本地浏览器中。
                  </p>
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">巡航频率 (ms)</label>
                 <div className="flex items-center gap-4">
                   <input 
                      type="range" 
                      min="2000" 
                      max="15000" 
                      step="500"
                      value={tempConfig.interval}
                      onChange={(e) => setTempConfig({...tempConfig, interval: parseInt(e.target.value)})}
                      className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                   />
                   <span className="text-sm font-mono text-indigo-400 min-w-[60px]">{tempConfig.interval}ms</span>
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">神经核心模型 (AI Model)</label>
                 <div className="space-y-2">
                    {!isCustomModel ? (
                      <select 
                          value={PRESET_MODELS.some(m => m.value === tempConfig.model) ? tempConfig.model : 'custom'}
                          onChange={(e) => {
                            setTestStatus('idle');
                            if (e.target.value === 'custom') {
                              setIsCustomModel(true);
                              setTempConfig({...tempConfig, model: ''});
                            } else {
                              setTempConfig({...tempConfig, model: e.target.value});
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-700 text-slate-300 rounded p-2 text-sm focus:border-indigo-500 focus:outline-none"
                      >
                        {PRESET_MODELS.map(model => (
                          <option key={model.value} value={model.value}>{model.label}</option>
                        ))}
                        <option value="custom">+ 自定义 / 本地模型 (Custom/Local)</option>
                      </select>
                    ) : (
                      <div className="flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex gap-2">
                            <input 
                              type="text"
                              value={tempConfig.model}
                              onChange={(e) => {
                                  setTempConfig({...tempConfig, model: e.target.value});
                                  setTestStatus('idle');
                              }}
                              placeholder="输入模型名称 (e.g. llama3-local)"
                              className={`w-full bg-slate-950 border text-slate-300 rounded p-2 text-sm focus:outline-none placeholder-slate-600 ${
                                  testStatus === 'success' ? 'border-emerald-500 focus:border-emerald-500' : 
                                  testStatus === 'error' ? 'border-red-500 focus:border-red-500' : 
                                  'border-indigo-500/50 focus:border-indigo-500'
                              }`}
                              autoFocus
                            />
                            <button 
                              onClick={() => {
                                setIsCustomModel(false);
                                setTestStatus('idle');
                                // Revert to default if canceling and value is empty
                                if (!tempConfig.model) {
                                    setTempConfig({...tempConfig, model: PRESET_MODELS[0].value});
                                }
                              }}
                              className="px-3 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded border border-slate-700 whitespace-nowrap"
                            >
                              列表
                            </button>
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

                        <div className="flex justify-between items-center mt-2">
                            <button
                                onClick={handleTestConnection}
                                disabled={!tempConfig.model || testStatus === 'testing'}
                                className={`text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-colors ${
                                    testStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                    testStatus === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                                    'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {testStatus === 'testing' ? (
                                    <>
                                        <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                                        测试连接中...
                                    </>
                                ) : testStatus === 'success' ? (
                                    <>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        连接成功
                                    </>
                                ) : testStatus === 'error' ? (
                                    <>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        连接失败
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        测试连接
                                    </>
                                )}
                            </button>
                        </div>
                      </div>
                    )}
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">目标网段 (Target Scope)</label>
                 <input 
                    type="text"
                    value={tempConfig.targetNetwork}
                    onChange={(e) => setTempConfig({...tempConfig, targetNetwork: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-300 rounded p-2 text-sm font-mono focus:border-indigo-500 focus:outline-none"
                    placeholder="192.168.1.0/24"
                 />
                 <p className="text-[10px] text-slate-600 mt-1">支持 CIDR 格式或 IP 范围描述。</p>
               </div>
             </div>

             <div className="mt-8 flex justify-end gap-2 pt-4 border-t border-slate-800">
               <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-sm"
               >
                 取消
               </button>
               <button 
                  onClick={saveSettings}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium shadow-lg shadow-indigo-500/20"
               >
                 保存配置
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Vulnerability Detail Modal */}
      {selectedVuln && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-800 flex justify-between items-start bg-slate-950">
                 <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                       {selectedVuln.name}
                    </h3>
                    <div className="flex gap-2 mt-2">
                        <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded ${
                            selectedVuln.severity === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            selectedVuln.severity === 'High' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                            selectedVuln.severity === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                            {selectedVuln.severity} Severity
                        </span>
                        <span className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-slate-400 rounded border border-slate-700">
                           HOST: {selectedVuln.host}
                        </span>
                    </div>
                 </div>
                 <button onClick={() => setSelectedVuln(null)} className="text-slate-500 hover:text-white p-1">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                 </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                 <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        问题描述 (Description)
                    </h4>
                    <p className="text-slate-300 leading-relaxed text-sm bg-slate-950/50 p-4 rounded border border-slate-800">
                        {selectedVuln.description}
                    </p>
                 </div>

                 <div>
                    <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        修复建议 (Remediation)
                    </h4>
                    <div className="bg-slate-950 p-4 rounded border border-slate-800 font-mono text-xs text-emerald-400/90 overflow-x-auto whitespace-pre-wrap">
                        {selectedVuln.remediation || "No automated remediation available. Please investigate manually."}
                    </div>
                 </div>
                 
                 <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button onClick={() => setSelectedVuln(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                        关闭
                    </button>
                    <button 
                        onClick={handleExecuteRemediation}
                        disabled={isRemediating}
                        className={`px-4 py-2 text-sm rounded transition-colors flex items-center gap-2 ${
                            isRemediating
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 cursor-not-allowed'
                            : 'bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/50'
                        }`}
                    >
                        {isRemediating ? '修复中...' : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                立即处置
                            </>
                        )}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Top Navigation / Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-14 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20">
            GLA3
          </div>
          <h1 className="font-bold text-lg tracking-tight">AIS</h1>
          <span className="text-xs px-2 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-400">v2.4.0 (CN)</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-4 hidden md:flex">
             <span className="text-xs text-slate-500 uppercase tracking-widest">系统状态</span>
             <span className="text-sm font-mono text-emerald-400">安全 // 监控中</span>
          </div>
          
          <button 
             onClick={openSettings}
             className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
             title="系统配置"
          >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>
          </button>

          <button 
            onClick={togglePatrol}
            className={`px-6 py-2 rounded font-medium text-sm transition-all duration-300 flex items-center gap-2 shadow-lg ${
              isPatrolling 
                ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20' 
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
            }`}
          >
            {isPatrolling ? (
              <>
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                停止巡航
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                开始巡航
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1920px] mx-auto w-full">
        
        {/* Left Column: Agents & Risk Report (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Agent Squad Section */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">行动小组</h2>
            <div className="space-y-3">
              {agents.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </section>

          {/* Vulnerabilities Section */}
          <section className="flex flex-col gap-3 flex-1 min-h-[300px]">
             <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">风险态势</h2>
             <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 flex-1 overflow-y-auto max-h-[500px] lg:max-h-[calc(100vh-32rem)] custom-scrollbar">
                {vulnerabilities.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-600 text-sm flex-col gap-2">
                    <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>未检测到活跃威胁。</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vulnerabilities.map(vuln => (
                      <div 
                        key={vuln.id} 
                        onClick={() => setSelectedVuln(vuln)}
                        className="bg-slate-950 border-l-2 border-red-500 p-3 rounded shadow-sm max-h-24 overflow-y-auto cursor-pointer hover:bg-slate-900 hover:border-l-4 transition-all duration-200 group"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-red-400 text-sm group-hover:text-red-300 transition-colors">{vuln.name}</span>
                          <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase">{vuln.severity}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2 leading-relaxed line-clamp-2">
                            {vuln.description}
                        </p>
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded">
                                Host: {vuln.host}
                            </span>
                            <span className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                查看详情 &rarr;
                            </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </section>
        </div>

        {/* Middle Column: World Model / Map (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="flex justify-between items-center">
             <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">实时网络拓扑</h2>
             <div className="flex gap-2">
               <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-blue-500"></span>网关</span>
               <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-purple-500"></span>服务器</span>
               <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-pink-500"></span>数据库</span>
             </div>
          </div>
          <div className="flex-1 min-h-[500px] relative">
            <NetworkGraph data={networkData} />
            {/* Scan Overlay Effect */}
            {isPatrolling && (
               <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
                 <div className="w-full h-[2px] bg-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-scan-line"></div>
               </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Intelligence & Terminal (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-6 lg:h-[calc(100vh-8rem)]">
          {/* Top: AI Intelligence Panel (Approx 35-40%) */}
          <div className="flex flex-col gap-3 h-[40%] min-h-[220px]">
             <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">智能情报分析</h2>
             <IntelligencePanel 
                insight={latestInsight} 
                onRemediate={handleExecuteRemediation}
                isRemediating={isRemediating}
             />
          </div>

          {/* Bottom: Logs (Remaining space) */}
          <div className="flex flex-col gap-3 flex-1 min-h-0">
             <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">行动日志</h2>
             <Terminal logs={logs} />
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;