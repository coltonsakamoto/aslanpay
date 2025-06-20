const express = require('express');
const app = express();

// --- Health-check for Railway ---
app.get('/health', (_req, res) => res.status(200).send('ok'));

// Basic middleware
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
    res.json({ message: 'Aslan API is running', status: 'OK' });
});

const PORT = process.env.PORT || 8080;   // Railway supplies PORT
app.listen(PORT, () => console.log('API listening on', PORT)); 