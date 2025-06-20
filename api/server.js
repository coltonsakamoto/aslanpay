const express = require('express');
const path = require('path');
const app = express();

// --- Health-check for Railway ---
app.get('/health', (_req, res) => res.status(200).send('ok'));

// Basic middleware
app.use(express.json());

// Serve static frontend files FIRST (before API routes)
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Basic API route (fallback for non-static requests)
app.get('/api', (req, res) => {
    res.json({ message: 'Aslan API is running', status: 'OK' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('API listening on', PORT));