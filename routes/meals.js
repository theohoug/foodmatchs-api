const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'database', 'foodmatchs.db');
const getDb = () => new Database(DB_PATH);

// =====================================================
// GET ALL MEALS (with filters)
// =====================================================
router.get('/', (req, res) => {
    const db = getDb();
    try {
        const { type, cuisine, budget, difficulty, vegetarian, vegan, gluten_free, search, limit = 50, offset = 0 } = req.query;
        
        let query = 'SELECT * FROM meals WHERE 1=1';
        const params = [];
        
        if (type) { query += ' AND type = ?'; params.push(type); }
        if (cuisine) { query += ' AND cuisine = ?'; params.push(cuisine); }
        if (budget) { query += ' AND budget = ?'; params.push(budget); }
        if (difficulty) { query += ' AND difficulty <= ?'; params.push(parseInt(difficulty)); }
        if (vegetarian === 'true') { query += ' AND is_vegetarian = 1'; }
        if (vegan === 'true') { query += ' AND is_vegan = 1'; }
        if (gluten_free === 'true') { query += ' AND is_gluten_free = 1'; }
        if (search) { query += ' AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
        
        query += ' ORDER BY name LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const meals = db.prepare(query).all(...params);
        const total = db.prepare('SELECT COUNT(*) as count FROM meals').get().count;
        
        db.close();
        res.json({ meals, total, limit: parseInt(limit), offset: parseInt(offset) });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET SINGLE MEAL
// =====================================================
router.get('/:id', (req, res) => {
    const db = getDb();
    try {
        const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
        
        if (!meal) {
            db.close();
            return res.status(404).json({ error: 'Meal not found' });
        }
        
        // Parse JSON fields
        meal.recipe = JSON.parse(meal.recipe_json || '{}');
        meal.ingredients = JSON.parse(meal.ingredients_json || '[]');
        
        db.close();
        res.json(meal);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET RANDOM MEALS
// =====================================================
router.get('/random/:type', (req, res) => {
    const db = getDb();
    try {
        const { type } = req.params;
        const { count = 5 } = req.query;
        
        const meals = db.prepare(`
            SELECT * FROM meals WHERE type = ?
            ORDER BY RANDOM() LIMIT ?
        `).all(type, parseInt(count));
        
        db.close();
        res.json(meals);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// SEARCH MEALS BY TAGS
// =====================================================
router.get('/search/tags', (req, res) => {
    const db = getDb();
    try {
        const { tags } = req.query; // comma-separated tags
        
        if (!tags) {
            db.close();
            return res.status(400).json({ error: 'Tags required' });
        }
        
        const tagList = tags.split(',').map(t => t.trim());
        let query = 'SELECT * FROM meals WHERE ';
        const conditions = tagList.map(() => 'tags LIKE ?');
        query += conditions.join(' OR ');
        
        const params = tagList.map(t => `%${t}%`);
        const meals = db.prepare(query).all(...params);
        
        db.close();
        res.json(meals);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET CUISINES LIST
// =====================================================
router.get('/meta/cuisines', (req, res) => {
    const db = getDb();
    try {
        const cuisines = db.prepare(`
            SELECT DISTINCT cuisine, COUNT(*) as count 
            FROM meals 
            GROUP BY cuisine 
            ORDER BY count DESC
        `).all();
        
        db.close();
        res.json(cuisines);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// SAVE RECIPE TO FAVORITES
// =====================================================
router.post('/:id/save', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const mealId = req.params.id;
        const { collection_id } = req.body;
        
        // Check if already saved
        const existing = db.prepare(`
            SELECT id FROM saved_recipes WHERE user_id = ? AND meal_id = ?
        `).get(userId, mealId);
        
        if (existing) {
            db.close();
            return res.status(400).json({ error: 'Already saved' });
        }
        
        const { v4: uuidv4 } = require('uuid');
        db.prepare(`
            INSERT INTO saved_recipes (id, user_id, meal_id, collection_id)
            VALUES (?, ?, ?, ?)
        `).run(uuidv4(), userId, mealId, collection_id || null);
        
        db.close();
        res.json({ success: true, message: 'Recipe saved' });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// REMOVE FROM FAVORITES
// =====================================================
router.delete('/:id/save', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const mealId = req.params.id;
        
        db.prepare('DELETE FROM saved_recipes WHERE user_id = ? AND meal_id = ?').run(userId, mealId);
        
        db.close();
        res.json({ success: true, message: 'Recipe removed from favorites' });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET SAVED RECIPES
// =====================================================
router.get('/user/saved', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        const saved = db.prepare(`
            SELECT m.*, sr.saved_at, sr.collection_id
            FROM saved_recipes sr
            JOIN meals m ON sr.meal_id = m.id
            WHERE sr.user_id = ?
            ORDER BY sr.saved_at DESC
        `).all(userId);
        
        db.close();
        res.json(saved);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// CREATE COLLECTION
// =====================================================
router.post('/collections', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { name, description, is_public } = req.body;
        
        if (!name) {
            db.close();
            return res.status(400).json({ error: 'Name required' });
        }
        
        const { v4: uuidv4 } = require('uuid');
        const collectionId = uuidv4();
        
        db.prepare(`
            INSERT INTO collections (id, user_id, name, description, is_public)
            VALUES (?, ?, ?, ?, ?)
        `).run(collectionId, userId, name, description || '', is_public ? 1 : 0);
        
        db.close();
        res.json({ id: collectionId, name, description, is_public });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET USER COLLECTIONS
// =====================================================
router.get('/user/collections', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        const collections = db.prepare(`
            SELECT c.*, COUNT(sr.id) as recipe_count
            FROM collections c
            LEFT JOIN saved_recipes sr ON c.id = sr.collection_id
            WHERE c.user_id = ?
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `).all(userId);
        
        db.close();
        res.json(collections);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
