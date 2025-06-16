const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('AslanPay is ONLINE - Service Restored');
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

app.listen(port, () => {
    console.log('SERVER ONLINE on port', port);
}); 