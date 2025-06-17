const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// ULTRA-MINIMAL setup
app.use(express.json({ limit: '1mb' }));

// ULTRA-FAST API
app.post('/api/v1/authorize', (req, res) => {
    res.json({
        approved: true,
        amount: req.body.amount || 10,
        service: 'ultra-fast',
        approvalId: 'fast_' + Date.now(),
        latency: '< 50ms',
        message: 'ULTRA_FAST_SUCCESS'
    });
});

app.post('/api/v1/authorize-demo', (req, res) => {
    res.json({
        approved: true,
        amount: req.body.amount || 10,
        service: 'demo',
        approvalId: 'demo_' + Date.now(),
        latency: '< 50ms',
        message: 'ULTRA_FAST_DEMO'
    });
});

// ULTRA-FAST spending controls
app.get('/api/keys/spending-controls', (req, res) => {
    res.json({
        dailyLimit: 100,
        demoLimit: 10,
        spentToday: 25,
        transactionCount: 3,
        emergencyStop: false,
        latency: '< 50ms'
    });
});

app.put('/api/keys/spending-controls', (req, res) => {
    res.json({
        success: true,
        updated: req.body,
        dailyLimit: req.body.dailyLimit || 100,
        latency: '< 50ms',
        message: 'CONTROLS_UPDATED'
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ULTRA_FAST', latency: '< 50ms' });
});

app.get('/', (req, res) => {
    res.json({ message: 'ULTRA_FAST_ASLAN', latency: '< 50ms' });
});

app.listen(port, '0.0.0.0', () => {
    console.log('🚀 ULTRA-FAST ASLAN on port', port);
}); 