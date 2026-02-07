export enum WorkflowType {
  SOCIAL_POST_GEN = 'SOCIAL_POST_GEN',
  AUTO_REPLY_BOT = 'AUTO_REPLY_BOT',
  PHONE_AI = 'PHONE_AI',
  CONFIG_MANUAL = 'CONFIG_MANUAL' // Added for the new view
}

export interface BusinessProfile {
  name: string;
  domain: string;
  description: string;
  channels: { 
    id: string; 
    platform: string; 
    url: string; 
    apiKey: string; // Added field for API Key/Token
  }[];
}

export interface WorkflowNode {
  id: string;
  label: string;
  type: 'trigger' | 'action' | 'ai' | 'router' | 'app';
  icon?: string;
  status?: 'idle' | 'running' | 'success' | 'error';
  data?: any;
}

export interface WorkflowDef {
  id: WorkflowType;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: { from: string; to: string }[];
}

export interface SocialPost {
  platform: 'LinkedIn' | 'Twitter' | 'Facebook' | 'Instagram';
  content: string;
  hashtags: string[];
}

export interface BotResponse {
  reply: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: string;
  actionTaken: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  workflow: string;
  message: string;
  type: 'info' | 'success' | 'error';
}