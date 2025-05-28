import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Agent spending analytics
router.get('/agents/:id/analytics', async (req: Request, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Get transaction history
    const transactions = await prisma.payment.findMany({
      where: {
        agentId,
        createdAt: { gte: since },
        status: 'completed'
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Calculate metrics
    const totalSpent = transactions.reduce((sum, tx) => sum + (tx.amountSat * 0.00035), 0);
    const transactionCount = transactions.length;
    const avgTransactionSize = transactionCount > 0 ? totalSpent / transactionCount : 0;
    
    // Group by service type
    const spendingByService = transactions.reduce((acc, tx) => {
      const service = tx.invoice?.startsWith('sms_') ? 'sms' : 
                     tx.invoice?.startsWith('dom_') ? 'domain' :
                     tx.invoice?.startsWith('gc_') ? 'gift-card' :
                     tx.invoice?.startsWith('vps_') ? 'vps' :
                     tx.invoice?.startsWith('aws_') ? 'aws-credits' : 'other';
      acc[service] = (acc[service] || 0) + (tx.amountSat * 0.00035);
      return acc;
    }, {} as Record<string, number>);
    
    // Daily spending trend
    const dailySpending = transactions.reduce((acc, tx) => {
      const date = tx.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + (tx.amountSat * 0.00035);
      return acc;
    }, {} as Record<string, number>);
    
    res.json({
      agentId,
      period,
      summary: {
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        transactionCount,
        avgTransactionSize: parseFloat(avgTransactionSize.toFixed(2)),
        topService: Object.entries(spendingByService).sort(([,a], [,b]) => b - a)[0]?.[0] || 'none'
      },
      spendingByService,
      dailySpending,
      recentTransactions: transactions.slice(0, 10).map(tx => ({
        id: tx.id,
        service: tx.invoice?.startsWith('sms_') ? 'sms' : 
                tx.invoice?.startsWith('dom_') ? 'domain' :
                tx.invoice?.startsWith('gc_') ? 'gift-card' :
                tx.invoice?.startsWith('vps_') ? 'vps' :
                tx.invoice?.startsWith('aws_') ? 'aws-credits' : 'other',
        amount: parseFloat((tx.amountSat * 0.00035).toFixed(2)),
        date: tx.createdAt,
        status: tx.status
      }))
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Platform-wide analytics (admin only)
router.get('/platform', async (req: Request, res: Response) => {
  try {
    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Platform metrics
    const [
      totalWallets,
      totalAgents,
      totalTransactions,
      recentTransactions,
      activeAgents
    ] = await Promise.all([
      prisma.wallet.count(),
      prisma.agent.count(),
      prisma.payment.count({
        where: { status: 'completed' }
      }),
      prisma.payment.findMany({
        where: {
          createdAt: { gte: since },
          status: 'completed'
        }
      }),
      prisma.agent.count({
        where: {
          payments: {
            some: {
              createdAt: { gte: since },
              status: 'completed'
            }
          }
        }
      })
    ]);
    
    const totalVolume = recentTransactions.reduce((sum, tx) => sum + (tx.amountSat * 0.00035), 0);
    const platformRevenue = totalVolume * 0.029; // 2.9% take rate
    
    // Growth metrics
    const previousPeriod = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);
    const previousTransactions = await prisma.payment.findMany({
      where: {
        createdAt: { gte: previousPeriod, lt: since },
        status: 'completed'
      }
    });
    
    const previousVolume = previousTransactions.reduce((sum, tx) => sum + (tx.amountSat * 0.00035), 0);
    const volumeGrowth = previousVolume > 0 ? ((totalVolume - previousVolume) / previousVolume) * 100 : 0;
    
    res.json({
      period,
      overview: {
        totalWallets,
        totalAgents,
        activeAgents,
        totalTransactions,
        totalVolume: parseFloat(totalVolume.toFixed(2)),
        platformRevenue: parseFloat(platformRevenue.toFixed(2)),
        volumeGrowth: parseFloat(volumeGrowth.toFixed(1))
      },
      metrics: {
        avgTransactionSize: recentTransactions.length > 0 ? totalVolume / recentTransactions.length : 0,
        transactionVelocity: recentTransactions.length / days, // transactions per day
        agentAdoptionRate: totalAgents > 0 ? (activeAgents / totalAgents) * 100 : 0
      }
    });
    
  } catch (error) {
    console.error('Platform analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch platform analytics' });
  }
});

export default router; 