export interface PayRequest {
  agentToken: string;
  invoice: string;
  sats?: number;
}

export interface PayResponse {
  ok: boolean;
  spentSat: number;
  newBalanceSat: number;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = 'PaymentError';
  }
} 