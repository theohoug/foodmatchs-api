const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (fix for Railway)
app.set('trust proxy', 1);

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Trop de requêtes' },
    standardHeaders: true,
    legacyHeaders: false
}));

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Auto-initialize database if not exists
const DB_PATH = path.join(__dirname, 'database', 'foodmatchs.db');
if (!fs.existsSync(DB_PATH)) {
    console.log('🍽️  Database not found, initializing...');
    try {
        require('./database/init');
        console.log('✅ Database initialized');
        
        // Run seeds
        require('./database/seed-meals');
        console.log('✅ Questions and starters seeded');
        
        require('./database/seed-meals-mains');
        console.log('✅ Main dishes seeded');
        
        require('./database/seed-meals-desserts');
        console.log('✅ Desserts seeded');
        
        require('./database/seed-meals-extras');
        console.log('✅ Cheeses and wines seeded');
        
        console.log('🎉 Database setup complete!');
    } catch (error) {
        console.error('❌ Database init error:', error.message);
    }
}

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
    const db = new Database(DB_PATH);
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

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
    console.log(`🍽️  FoodMatchs API on port ${PORT}`);
});

module.exports = app;
