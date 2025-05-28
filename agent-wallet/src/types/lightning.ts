import { AuthenticatedLightningArgs } from 'lightning';

export interface LightningConfig {
  pairingPhrase: string;
  socket: string;
}

export interface LightningClient {
  lnd: AuthenticatedLightningArgs;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export interface LightningError extends Error {
  code?: string;
  details?: string;
} 