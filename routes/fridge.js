const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'database', 'foodmatchs.db');
const getDb = () => new Database(DB_PATH);

// =====================================================
// GET FRIDGE ITEMS
// =====================================================
router.get('/', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        const items = db.prepare(`
            SELECT * FROM fridge_items
            WHERE user_id = ?
            ORDER BY expiry_date ASC
        `).all(userId);
        
        // Mark items expiring soon
        const today = new Date();
        const itemsWithStatus = items.map(item => {
            const expiry = new Date(item.expiry_date);
            const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
            
            return {
                ...item,
                days_until_expiry: daysUntilExpiry,
                status: daysUntilExpiry < 0 ? 'expired' : daysUntilExpiry <= 3 ? 'expiring_soon' : 'ok'
            };
        });
        
        db.close();
        res.json(itemsWithStatus);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// ADD ITEM TO FRIDGE
// =====================================================
router.post('/', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { name, quantity, unit, category, expiry_date } = req.body;
        
        if (!name) {
            db.close();
            return res.status(400).json({ error: 'Name required' });
        }
        
        const itemId = uuidv4();
        
        db.prepare(`
            INSERT INTO fridge_items (id, user_id, name, quantity, unit, category, expiry_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(itemId, userId, name, quantity || 1, unit || 'unité', category || 'other', expiry_date || null);
        
        const item = db.prepare('SELECT * FROM fridge_items WHERE id = ?').get(itemId);
        
        db.close();
        res.status(201).json(item);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// UPDATE FRIDGE ITEM
// =====================================================
router.put('/:id', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const itemId = req.params.id;
        const { name, quantity, unit, category, expiry_date } = req.body;
        
        // Verify ownership
        const existing = db.prepare('SELECT user_id FROM fridge_items WHERE id = ?').get(itemId);
        
        if (!existing || existing.user_id !== userId) {
            db.close();
            return res.status(403).json({ error: 'Not authorized' });
        }
        
        db.prepare(`
            UPDATE fridge_items
            SET name = COALESCE(?, name),
                quantity = COALESCE(?, quantity),
                unit = COALESCE(?, unit),
                category = COALESCE(?, category),
                expiry_date = COALESCE(?, expiry_date)
            WHERE id = ?
        `).run(name, quantity, unit, category, expiry_date, itemId);
        
        const item = db.prepare('SELECT * FROM fridge_items WHERE id = ?').get(itemId);
        
        db.close();
        res.json(item);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// DELETE FRIDGE ITEM
// =====================================================
router.delete('/:id', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const itemId = req.params.id;
        
        const existing = db.prepare('SELECT user_id FROM fridge_items WHERE id = ?').get(itemId);
        
        if (!existing || existing.user_id !== userId) {
            db.close();
            return res.status(403).json({ error: 'Not authorized' });
        }
        
        db.prepare('DELETE FROM fridge_items WHERE id = ?').run(itemId);
        
        db.close();
        res.json({ success: true });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// FIND RECIPES WITH FRIDGE ITEMS
// =====================================================
router.get('/recipes/suggestions', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        // Get fridge items
        const fridgeItems = db.prepare('SELECT name FROM fridge_items WHERE user_id = ?').all(userId);
        
        if (fridgeItems.length === 0) {
            db.close();
            return res.json({ recipes: [], message: 'Add items to your fridge first' });
        }
        
        // Search meals that match fridge ingredients
        const itemNames = fridgeItems.map(i => i.name.toLowerCase());
        
        const allMeals = db.prepare(`
            SELECT * FROM meals WHERE type IN ('starter', 'main', 'dessert')
        `).all();
        
        // Score meals by how many fridge items they use
        const scoredMeals = allMeals.map(meal => {
            const ingredients = JSON.parse(meal.ingredients_json || '[]');
            let matchCount = 0;
            let matchedItems = [];
            
            for (const ing of ingredients) {
                const ingName = ing.name.toLowerCase();
                for (const fridgeItem of itemNames) {
                    if (ingName.includes(fridgeItem) || fridgeItem.includes(ingName)) {
                        matchCount++;
                        matchedItems.push(ing.name);
                        break;
                    }
                }
            }
            
            return {
                ...meal,
                match_score: matchCount,
                matched_ingredients: matchedItems,
                total_ingredients: ingredients.length,
                match_percent: ingredients.length > 0 ? Math.round((matchCount / ingredients.length) * 100) : 0
            };
        });
        
        // Sort by match score and filter out zero matches
        const suggestions = scoredMeals
            .filter(m => m.match_score > 0)
            .sort((a, b) => b.match_percent - a.match_percent)
            .slice(0, 20);
        
        db.close();
        res.json({ recipes: suggestions });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET EXPIRING ITEMS (for notifications)
// =====================================================
router.get('/expiring', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { days = 3 } = req.query;
        
        const items = db.prepare(`
            SELECT * FROM fridge_items
            WHERE user_id = ?
              AND expiry_date IS NOT NULL
              AND DATE(expiry_date) <= DATE('now', '+' || ? || ' days')
            ORDER BY expiry_date ASC
        `).all(userId, parseInt(days));
        
        db.close();
        res.json(items);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// BULK ADD ITEMS
// =====================================================
router.post('/bulk', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { items } = req.body;
        
        if (!items || !Array.isArray(items)) {
            db.close();
            return res.status(400).json({ error: 'Items array required' });
        }
        
        const insert = db.prepare(`
            INSERT INTO fridge_items (id, user_id, name, quantity, unit, category, expiry_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insert.run(
                    uuidv4(),
                    userId,
                    item.name,
                    item.quantity || 1,
                    item.unit || 'unité',
                    item.category || 'other',
                    item.expiry_date || null
                );
            }
        });
        
        insertMany(items);
        
        db.close();
        res.json({ success: true, count: items.length });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
