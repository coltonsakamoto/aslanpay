declare module 'ln-service' {
  export interface AuthenticatedLndGrpc {
    lnd: any;
    socket: string;
  }

  export interface CreateInvoiceArgs {
    lnd: any;
    tokens: number;
    description: string;
  }

  export interface Invoice {
    request: string;
    id: string;
    secret: string;
    tokens: number;
    description: string;
    created_at: string;
  }

  export interface WalletInfo {
    alias: string;
    public_key: string;
    chains: string[];
  }

  export function authenticatedLndGrpc(args: {
    socket: string;
    macaroon: string;
    cert_path?: string;
  }): Promise<AuthenticatedLndGrpc>;

  export function createInvoice(args: CreateInvoiceArgs): Promise<Invoice>;

  export function getWalletInfo(args: { lnd: any }): Promise<WalletInfo>;
} 