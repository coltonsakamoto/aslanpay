export interface Wallet {
  id: string;
  balanceSat: number;
  createdAt: Date;
}

export interface FundWalletRequest {
  usd: number;
}

export interface FundWalletResponse {
  walletId: string;
  balanceSat: number;
  balanceUsd: number;
}

export interface CreateWalletResponse {
  walletId: string;
  balanceSat: number;
  balanceUsd: number;
}

export class WalletError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = 'WalletError';
  }
} 