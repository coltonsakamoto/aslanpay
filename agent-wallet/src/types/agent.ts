export interface Agent {
  walletId: string;
  limitSat: number;
  spentTodaySat: number;  // Tracks daily spending, reset every 24h
  createdAt: Date;
}

export interface CreateAgentRequest {
  walletId: string;
  dailyUsdLimit: number;
}

export interface CreateAgentResponse {
  agentToken: string;
  limitSat: number;
}

export interface AgentTokenPayload {
  walletId: string;
  limitSat: number;
  iat: number;
  exp: number;
}

export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = 'AgentError';
  }
} 