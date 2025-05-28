import { subscribeToInvoices } from 'ln-service';
import lightningService from './lightning';
import { prisma } from '../lib/prisma';

// Use the database to find wallet by invoice ID
async function findWalletIdByInvoiceId(invoiceId: string): Promise<string | null> {
  try {
    const invoiceMapping = await prisma.invoiceMapping.findUnique({
      where: { invoiceId }
    });
    return invoiceMapping?.walletId || null;
  } catch (error) {
    console.error('Error finding wallet for invoice:', error);
    return null;
  }
}

export function startInvoiceListener() {
  const lnd = lightningService.lnd;
  if (!lnd) {
    console.error('LND is not connected. Invoice listener not started.');
    return;
  }
  const sub = subscribeToInvoices({ lnd });

  sub.on('invoice_updated', async (invoice) => {
    if (invoice.is_confirmed) {
      const walletId = await findWalletIdByInvoiceId(invoice.id);
      if (walletId) {
        try {
          // Update the wallet balance in the database
          const updatedWallet = await prisma.wallet.update({
            where: { id: walletId },
            data: {
              balanceSat: {
                increment: invoice.received
              }
            }
          });
          console.log(`Wallet ${walletId} credited with ${invoice.received} sats. New balance: ${updatedWallet.balanceSat} sats`);
        } catch (error) {
          console.error(`Error updating wallet ${walletId}:`, error);
        }
      } else {
        console.warn(`No wallet found for invoice ${invoice.id}`);
      }
    }
  });

  sub.on('error', (err) => {
    console.error('Invoice listener error:', err);
  });
} 