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

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/public')));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('API listening on', PORT));