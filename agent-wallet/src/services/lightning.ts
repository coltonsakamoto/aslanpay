import { createAuthenticatedLndGrpc, createInvoice, getWalletInfo } from 'ln-service';
import { LightningClient, LightningConfig, LightningError } from '../types/lightning';

class LightningService implements LightningClient {
  lnd: any;
  isConnected: boolean = false;
  private config: LightningConfig;

  constructor(config: LightningConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      const { lnd } = await createAuthenticatedLndGrpc({
        socket: this.config.socket,
        macaroon: this.config.pairingPhrase, // LNC uses the pairing phrase as the macaroon
      });

      this.lnd = lnd;
      this.isConnected = true;

      // Verify connection by getting wallet info
      const walletInfo = await getWalletInfo({ lnd: this.lnd });
      console.log('Connected to Lightning Network:', {
        alias: walletInfo.alias,
        public_key: walletInfo.public_key,
        chains: walletInfo.chains,
      });
    } catch (error) {
      const lightningError = error as LightningError;
      console.error('Failed to connect to Lightning Network:', {
        code: lightningError.code,
        message: lightningError.message,
        details: lightningError.details,
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.lnd) {
      try {
        await this.lnd.disconnect();
        this.isConnected = false;
        console.log('Disconnected from Lightning Network');
      } catch (error) {
        console.error('Error disconnecting from Lightning Network:', error);
        throw error;
      }
    }
  }

  async createInvoice(amount: number, description: string): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Lightning client not connected');
    }

    try {
      const invoice = await createInvoice({
        lnd: this.lnd,
        tokens: amount,
        description,
      });

      return invoice.request;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const lightningService = new LightningService({
  pairingPhrase: process.env.PAIRING_PHRASE || '',
  socket: '127.0.0.1:10009', // Default LND socket address
});

export default lightningService; 