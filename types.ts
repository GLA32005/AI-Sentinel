export enum AgentRole {
  COMMANDER = 'Commander',
  SCOUT = 'Scout',
  SNIPER = 'Sniper', // Tester
  ANALYST = 'Analyst'
}

export enum AgentStatus {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  OBSERVING = 'OBSERVING',
  ACTING = 'ACTING',
  REPORTING = 'REPORTING',
  REMEDIATING = 'REMEDIATING'
}

export interface Agent {
  id: string;
  role: AgentRole;
  name: string;
  status: AgentStatus;
  currentTask: string;
  logs: string[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  agentRole: AgentRole;
  message: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  details?: string;
}

export interface NetworkNode {
  id: string;
  group: number; // 1: Gateway, 2: Server, 3: DB, 4: Workstation
  label: string;
  status: 'secure' | 'vulnerable' | 'compromised' | 'unknown';
  ip: string;
  riskScore: number;
}

export interface NetworkLink {
  source: string;
  target: string;
  value: number;
}

export interface NetworkGraphData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export interface Vulnerability {
  id: string;
  host: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  name: string;
  description: string;
  remediation?: string;
}

export interface StrategicInsight {
  id: string;
  timestamp: string;
  title: string;
  content: string; // Concise summary of the risk
  recommendation: string; // Actionable advice
  severity: 'critical' | 'high' | 'medium' | 'info';
  remediationAction?: string; // The action to take (e.g., "patch_db")
}

export interface AppConfig {
  interval: number;
  model: string;
  targetNetwork: string;
  apiEndpoint?: string; // Optional URL override for local models
  apiKey?: string; // Optional user provided key
}