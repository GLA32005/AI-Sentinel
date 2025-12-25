import { GoogleGenAI, Type } from "@google/genai";
import { AgentRole, LogEntry, Vulnerability, AppConfig, StrategicInsight } from "../types";

// Helper to safely access environment variables in browser or node
const getEnvApiKey = () => {
  try {
    // Check if process is defined (Node or bundled env)
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      // @ts-ignore
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore errors accessing process
  }
  return undefined;
};

const getAiClient = (config: AppConfig) => {
  // Priority: User Config Key > Env Var > Placeholder (for local/ollama)
  let apiKey = config.apiKey || getEnvApiKey();

  if (!apiKey || apiKey.trim() === '') {
    apiKey = 'no-key-needed-for-local'; 
  }
  
  const options: any = { apiKey };
  
  if (config.apiEndpoint && config.apiEndpoint.trim().length > 0) {
    options.baseUrl = config.apiEndpoint;
  }

  return new GoogleGenAI(options);
};

// Helper for exponential backoff retry
const generateContentWithRetry = async (ai: GoogleGenAI, params: any, retries = 3, initialDelay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      // Check for rate limit errors (429) or server errors (503)
      const isRateLimit = error.status === 429 || 
                          error.code === 429 || 
                          error.message?.includes('429') || 
                          error.toString().includes('429') ||
                          error.message?.includes('Quota exceeded');
      
      if (isRateLimit && i < retries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Hit rate limit. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
};

// Test if a specific model is reachable/working
export const testModelConnection = async (config: AppConfig): Promise<boolean> => {
  const ai = getAiClient(config);
  if (!ai) return false;

  try {
    // Send a minimal token request to verify connectivity
    await ai.models.generateContent({
      model: config.model,
      contents: "Ping",
      config: {
        maxOutputTokens: 1
      }
    });
    return true;
  } catch (error) {
    console.warn(`Connection test failed for model ${config.model} at ${config.apiEndpoint || 'default'}:`, error);
    return false;
  }
};

// Simulate the OODA loop decision making
export const simulateAgentStep = async (
  cycleCount: number,
  knownAssets: string[],
  config: AppConfig
): Promise<{
  logs: LogEntry[];
  newAssets?: { label: string; ip: string; type: string }[];
  vulnerability?: Vulnerability;
  strategicInsight?: StrategicInsight;
  shouldStop?: boolean;
}> => {
  const ai = getAiClient(config);
  
  // We rotate through simulation phases based on cycle count to simulate OODA
  // This is a simplified state machine driven by Gemini
  const phase = cycleCount % 4; // 0: Observe, 1: Orient, 2: Decide, 3: Act

  let prompt = "";
  let systemInstruction = "";

  if (phase === 0) {
    // Scout Phase
    systemInstruction = "你是一个网络安全侦察兵 (Scout Agent)。你负责扫描网络以发现资产。请始终用中文回复。";
    prompt = `生成一条逼真的网络扫描日志。
    目标网段范围: ${config.targetNetwork}。
    当前已知资产: ${knownAssets.join(", ")}。
    可以在目标网段内发现一个新资产（如 192.168.x.x），或者扫描现有资产。
    如果发现了极其可疑的未授权设备，可以生成一条 'strategicInsight'，提示需要关注此新设备。
    返回 JSON 格式。`;
  } else if (phase === 1) {
    // Analyst Phase
    systemInstruction = "你是一个网络安全分析师 (Analyst Agent)。你负责分析扫描结果中的异常。请始终用中文回复。";
    prompt = `分析最近的网络活动，关注范围 ${config.targetNetwork}。
    生成一条关于分析服务（例如检查 HTTP 头、指纹识别）的日志。
    如果发现异常流量模式或高危配置，生成一条 'strategicInsight'，包含标题、简明摘要和具体修复建议。
    返回 JSON 格式。`;
  } else if (phase === 2) {
    // Commander Phase
    systemInstruction = "你是自主安全小队的指挥官 (Commander)。你负责决策下一步行动。请始终用中文回复。";
    prompt = `基于在 ${config.targetNetwork} 的潜在发现，决定下一步行动。
    生成一条决策日志。
    如果有重大安全态势变化，生成一条 'strategicInsight' 进行全盘总结和指令下达。
    返回 JSON 格式。`;
  } else {
    // Sniper Phase
    systemInstruction = "你是一个渗透测试专家 (Sniper Agent)。你负责安全地验证漏洞。请始终用中文回复。";
    prompt = `模拟一次安全的漏洞验证（例如目录枚举或 SQL 注入测试）。
    偶尔发现一个漏洞。
    如果发现了漏洞，**必须** 生成一条 'strategicInsight'，向用户解释该漏洞的严重性和具体的修复步骤（remediation）。
    返回 JSON 格式。`;
  }

  try {
    const response = await generateContentWithRetry(ai, {
      model: config.model || 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            logMessage: { type: Type.STRING },
            logType: { type: Type.STRING },
            detectedAsset: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                ip: { type: Type.STRING },
                type: { type: Type.STRING }
              }
            },
            vulnerability: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                severity: { type: Type.STRING },
                description: { type: Type.STRING },
                remediation: { type: Type.STRING }
              }
            },
            strategicInsight: {
              type: Type.OBJECT,
              description: "Only generate this if there is high-value, actionable intelligence for the user.",
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING, description: "A concise summary of the issue." },
                recommendation: { type: Type.STRING, description: "Direct actionable advice." },
                severity: { type: Type.STRING, enum: ["critical", "high", "medium", "info"] }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const data = JSON.parse(text);
    
    const roleMap = [AgentRole.SCOUT, AgentRole.ANALYST, AgentRole.COMMANDER, AgentRole.SNIPER];

    return {
      logs: [{
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        agentRole: roleMap[phase],
        message: data.logMessage,
        type: (data.logType as 'info' | 'warning' | 'danger' | 'success') || 'info'
      }],
      newAssets: data.detectedAsset ? [data.detectedAsset] : undefined,
      vulnerability: data.vulnerability ? { ...data.vulnerability, id: Date.now().toString(), host: "Target" } : undefined,
      strategicInsight: data.strategicInsight ? { ...data.strategicInsight, id: Date.now().toString(), timestamp: new Date().toLocaleTimeString() } : undefined
    };

  } catch (error: any) {
    console.error("Gemini Error", error);
    
    // Check specifically for Quota Exceeded to give better feedback
    const isRateLimit = error.status === 429 || 
                        error.code === 429 || 
                        error.message?.includes('429') || 
                        error.toString().includes('429') ||
                        error.message?.includes('Quota exceeded');

    if (isRateLimit) {
      return {
        logs: [{
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          agentRole: AgentRole.COMMANDER,
          message: "⚠️ API 配额已耗尽 (429)。请在“系统配置”中更换 Key 或使用本地模型。",
          type: 'danger'
        }],
        shouldStop: true
      };
    }

    return {
      logs: [{
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        agentRole: AgentRole.COMMANDER,
        message: `连接神经核心失败: ${error.message || 'Unknown Error'}`,
        type: 'danger'
      }]
    };
  }
};