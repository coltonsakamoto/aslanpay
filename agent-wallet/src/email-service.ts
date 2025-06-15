import nodemailer from 'nodemailer';

export class EmailService {
  private static transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  static async sendPaymentReceipt(customerInfo: {
    email: string;
    name: string;
    amount: number;
    transactionId: string;
    processingFee: number;
    totalCharged: number;
  }) {
    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@agentpay.com',
        to: customerInfo.email,
        subject: `Payment Receipt - $${customerInfo.amount} Added to Your AgentPay Wallet`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9f9f9; }
              .receipt-box { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .row { display: flex; justify-content: space-between; margin: 10px 0; }
              .total { border-top: 2px solid #667eea; padding-top: 10px; font-weight: bold; }
              .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🚀 AgentPay</h1>
                <h2>Payment Receipt</h2>
              </div>
              
              <div class="content">
                <p>Hello ${customerInfo.name},</p>
                <p>Thank you for funding your AgentPay wallet! Your payment has been processed successfully.</p>
                
                <div class="receipt-box">
                  <h3>Transaction Details</h3>
                  <div class="row">
                    <span>Transaction ID:</span>
                    <span>${customerInfo.transactionId}</span>
                  </div>
                  <div class="row">
                    <span>Amount Added:</span>
                    <span>$${customerInfo.amount.toFixed(2)}</span>
                  </div>
                  <div class="row">
                    <span>Processing Fee:</span>
                    <span>$${customerInfo.processingFee.toFixed(2)}</span>
                  </div>
                  <div class="row total">
                    <span>Total Charged:</span>
                    <span>$${customerInfo.totalCharged.toFixed(2)}</span>
                  </div>
                  <div class="row">
                    <span>Date:</span>
                    <span>${new Date().toLocaleDateString()}</span>
                  </div>
                </div>
                
                <p><strong>What's Next?</strong></p>
                <ul>
                  <li>Create AI agents with spending limits</li>
                  <li>Enable ChatGPT to make autonomous purchases</li>
                  <li>Monitor transactions in your dashboard</li>
                </ul>
                
                <p>Visit your dashboard: <a href="http://localhost:3000">AgentPay Dashboard</a></p>
              </div>
              
              <div class="footer">
                <p>AgentPay - The Future of AI Commerce</p>
                <p>Questions? Contact support@agentpay.com</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Receipt email sent to:', customerInfo.email);
    } catch (error) {
      console.error('Failed to send receipt email:', error);
    }
  }

  static async sendWelcomeEmail(email: string, name: string) {
    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@agentpay.com',
        to: email,
        subject: 'Welcome to AgentPay - Your AI Commerce Wallet is Ready!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9f9f9; }
              .cta-button { background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🚀 Welcome to AgentPay!</h1>
              </div>
              
              <div class="content">
                <p>Hello ${name},</p>
                <p>Welcome to the future of AI commerce! Your AgentPay wallet is now ready to enable autonomous spending for your AI agents.</p>
                
                <h3>🎯 What You Can Do:</h3>
                <ul>
                  <li><strong>Fund Your Wallet:</strong> Add money using credit cards or bank accounts</li>
                  <li><strong>Create AI Agents:</strong> Set spending limits and enable autonomous purchases</li>
                  <li><strong>ChatGPT Integration:</strong> Let AI make real purchases on your behalf</li>
                  <li><strong>Monitor Everything:</strong> Track all transactions in real-time</li>
                </ul>
                
                <a href="http://localhost:3000" class="cta-button">🏠 Go to Dashboard</a>
                
                <h3>🔐 Security Features:</h3>
                <ul>
                  <li>Daily spending limits for each AI agent</li>
                  <li>Real-time transaction monitoring</li>
                  <li>Secure payment processing via Stripe</li>
                  <li>Complete transaction history</li>
                </ul>
                
                <p>Ready to revolutionize how AI interacts with commerce? Start by funding your wallet!</p>
              </div>
              
              <div class="footer">
                <p>AgentPay - Enabling the Future of AI Commerce</p>
                <p>Need help? Reply to this email or visit our support center</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Welcome email sent to:', email);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }
} 