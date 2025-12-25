import { Agent, AgentRole, AgentStatus, NetworkGraphData } from './types';

export const INITIAL_AGENTS: Agent[] = [
  {
    id: '1',
    role: AgentRole.COMMANDER,
    name: 'Overlord-1',
    status: AgentStatus.IDLE,
    currentTask: '等待指令',
    logs: []
  },
  {
    id: '2',
    role: AgentRole.SCOUT,
    name: 'Recon-Unit-Alpha',
    status: AgentStatus.IDLE,
    currentTask: '传感器已就绪',
    logs: []
  },
  {
    id: '3',
    role: AgentRole.ANALYST,
    name: 'Logic-Core-7',
    status: AgentStatus.IDLE,
    currentTask: '知识库已加载',
    logs: []
  },
  {
    id: '4',
    role: AgentRole.SNIPER,
    name: 'Hunter-Killer-X',
    status: AgentStatus.IDLE,
    currentTask: '安全协议已启动',
    logs: []
  }
];

export const INITIAL_NETWORK_DATA: NetworkGraphData = {
  nodes: [
    { id: 'gateway', group: 1, label: 'Gateway-FW', status: 'secure', ip: '192.168.1.1', riskScore: 0 },
    { id: 'web-prod', group: 2, label: 'Web-Prod-01', status: 'secure', ip: '192.168.1.10', riskScore: 0 },
    { id: 'db-prod', group: 3, label: 'DB-Main', status: 'secure', ip: '192.168.1.20', riskScore: 0 },
    { id: 'workstation-1', group: 4, label: 'Admin-PC', status: 'unknown', ip: '192.168.1.50', riskScore: 0 },
  ],
  links: [
    { source: 'gateway', target: 'web-prod', value: 5 },
    { source: 'web-prod', target: 'db-prod', value: 3 },
    { source: 'gateway', target: 'workstation-1', value: 1 },
    { source: 'workstation-1', target: 'db-prod', value: 1 }, // Potential risk path
  ]
};