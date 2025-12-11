const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting
app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Trop de requêtes' }
}));

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/meals', require('./routes/meals'));
app.use('/api/social', require('./routes/social'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/fridge', require('./routes/fridge'));
app.use('/api/meal-prep', require('./routes/meal-prep'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Stats
app.get('/api/stats', (req, res) => {
    const Database = require('better-sqlite3');
    const db = new Database(path.join(__dirname, 'database', 'foodmatchs.db'));
    try {
        const stats = {
            starters: db.prepare('SELECT COUNT(*) as c FROM meals WHERE type=?').get('starter').c,
            mains: db.prepare('SELECT COUNT(*) as c FROM meals WHERE type=?').get('main').c,
            desserts: db.prepare('SELECT COUNT(*) as c FROM meals WHERE type=?').get('dessert').c,
            cheeses: db.prepare('SELECT COUNT(*) as c FROM meals WHERE type=?').get('cheese').c,
            wines: db.prepare('SELECT COUNT(*) as c FROM meals WHERE type=?').get('wine').c,
            profiles: db.prepare('SELECT COUNT(*) as c FROM profiles').get().c,
            questions: db.prepare('SELECT COUNT(*) as c FROM questions').get().c,
            achievements: db.prepare('SELECT COUNT(*) as c FROM achievements').get().c,
        };
        db.close();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
    console.log(`🍽️  FoodMatchs API on http://localhost:${PORT}`);
});

module.exports = app;
