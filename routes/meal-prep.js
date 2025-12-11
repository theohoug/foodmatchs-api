const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'database', 'foodmatchs.db');
const getDb = () => new Database(DB_PATH);

// =====================================================
// GET WEEKLY PLAN
// =====================================================
router.get('/plan', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { week_start } = req.query;
        
        let query = `
            SELECT * FROM meal_prep_plans
            WHERE user_id = ?
        `;
        const params = [userId];
        
        if (week_start) {
            query += ' AND week_start = ?';
            params.push(week_start);
        } else {
            query += ' ORDER BY week_start DESC LIMIT 1';
        }
        
        const plan = db.prepare(query).get(...params);
        
        if (plan) {
            plan.meals = JSON.parse(plan.meals_json || '{}');
            plan.shopping_list = JSON.parse(plan.shopping_list_json || '[]');
        }
        
        db.close();
        res.json(plan || null);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// CREATE/UPDATE WEEKLY PLAN
// =====================================================
router.post('/plan', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { week_start, meals, servings = 2 } = req.body;
        
        if (!week_start || !meals) {
            db.close();
            return res.status(400).json({ error: 'week_start and meals required' });
        }
        
        // meals format: { monday: { lunch: 'meal_id', dinner: 'meal_id' }, tuesday: {...}, ... }
        
        // Generate shopping list from meal ingredients
        const shoppingList = {};
        const mealIds = [];
        
        for (const day of Object.values(meals)) {
            for (const mealId of Object.values(day)) {
                if (mealId && !mealIds.includes(mealId)) {
                    mealIds.push(mealId);
                }
            }
        }
        
        // Get all meal ingredients
        for (const mealId of mealIds) {
            const meal = db.prepare('SELECT ingredients_json FROM meals WHERE id = ?').get(mealId);
            if (meal) {
                const ingredients = JSON.parse(meal.ingredients_json || '[]');
                for (const ing of ingredients) {
                    const key = `${ing.name}_${ing.cat || 'other'}`;
                    if (!shoppingList[key]) {
                        shoppingList[key] = {
                            name: ing.name,
                            category: ing.cat || 'other',
                            quantities: [],
                            checked: false
                        };
                    }
                    shoppingList[key].quantities.push(ing.qty);
                }
            }
        }
        
        const shoppingListArray = Object.values(shoppingList).map(item => ({
            ...item,
            quantity: item.quantities.join(' + ')
        }));
        
        // Check if plan exists for this week
        const existing = db.prepare(`
            SELECT id FROM meal_prep_plans WHERE user_id = ? AND week_start = ?
        `).get(userId, week_start);
        
        if (existing) {
            db.prepare(`
                UPDATE meal_prep_plans
                SET meals_json = ?, shopping_list_json = ?, servings = ?
                WHERE id = ?
            `).run(JSON.stringify(meals), JSON.stringify(shoppingListArray), servings, existing.id);
            
            db.close();
            return res.json({
                id: existing.id,
                week_start,
                meals,
                shopping_list: shoppingListArray,
                servings
            });
        }
        
        const planId = uuidv4();
        db.prepare(`
            INSERT INTO meal_prep_plans (id, user_id, week_start, meals_json, shopping_list_json, servings)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(planId, userId, week_start, JSON.stringify(meals), JSON.stringify(shoppingListArray), servings);
        
        db.close();
        res.status(201).json({
            id: planId,
            week_start,
            meals,
            shopping_list: shoppingListArray,
            servings
        });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// UPDATE SHOPPING LIST ITEM (check/uncheck)
// =====================================================
router.patch('/plan/:planId/shopping/:itemIndex', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { planId, itemIndex } = req.params;
        const { checked } = req.body;
        
        const plan = db.prepare('SELECT * FROM meal_prep_plans WHERE id = ? AND user_id = ?').get(planId, userId);
        
        if (!plan) {
            db.close();
            return res.status(404).json({ error: 'Plan not found' });
        }
        
        const shoppingList = JSON.parse(plan.shopping_list_json || '[]');
        const index = parseInt(itemIndex);
        
        if (index >= 0 && index < shoppingList.length) {
            shoppingList[index].checked = checked;
            
            db.prepare('UPDATE meal_prep_plans SET shopping_list_json = ? WHERE id = ?')
                .run(JSON.stringify(shoppingList), planId);
        }
        
        db.close();
        res.json({ success: true, shopping_list: shoppingList });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// DELETE WEEKLY PLAN
// =====================================================
router.delete('/plan/:id', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        db.prepare('DELETE FROM meal_prep_plans WHERE id = ? AND user_id = ?').run(req.params.id, userId);
        
        db.close();
        res.json({ success: true });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET SHOPPING LISTS
// =====================================================
router.get('/shopping-lists', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        const lists = db.prepare(`
            SELECT * FROM shopping_lists
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).all(userId);
        
        for (const list of lists) {
            list.items = JSON.parse(list.items_json || '[]');
        }
        
        db.close();
        res.json(lists);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// CREATE SHOPPING LIST
// =====================================================
router.post('/shopping-lists', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { name, items } = req.body;
        
        const listId = uuidv4();
        
        db.prepare(`
            INSERT INTO shopping_lists (id, user_id, name, items_json)
            VALUES (?, ?, ?, ?)
        `).run(listId, userId, name || 'Ma liste', JSON.stringify(items || []));
        
        db.close();
        res.status(201).json({ id: listId, name, items: items || [] });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// UPDATE SHOPPING LIST
// =====================================================
router.put('/shopping-lists/:id', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const listId = req.params.id;
        const { name, items } = req.body;
        
        const existing = db.prepare('SELECT user_id FROM shopping_lists WHERE id = ?').get(listId);
        
        if (!existing || existing.user_id !== userId) {
            db.close();
            return res.status(403).json({ error: 'Not authorized' });
        }
        
        db.prepare(`
            UPDATE shopping_lists
            SET name = COALESCE(?, name), items_json = COALESCE(?, items_json)
            WHERE id = ?
        `).run(name, items ? JSON.stringify(items) : null, listId);
        
        db.close();
        res.json({ success: true });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// DELETE SHOPPING LIST
// =====================================================
router.delete('/shopping-lists/:id', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        db.prepare('DELETE FROM shopping_lists WHERE id = ? AND user_id = ?').run(req.params.id, userId);
        
        db.close();
        res.json({ success: true });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GENERATE MEAL PLAN SUGGESTIONS
// =====================================================
router.post('/suggest', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { days = 7, preferences } = req.body;
        
        // Get user preferences
        const userPrefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId);
        const diet = userPrefs?.diet || 'omnivore';
        const budget = preferences?.budget || 'medium';
        
        let whereClause = '1=1';
        if (diet === 'vegetarian') whereClause += ' AND is_vegetarian = 1';
        if (diet === 'vegan') whereClause += ' AND is_vegan = 1';
        if (budget) whereClause += ` AND budget = '${budget}'`;
        
        const meals = {};
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        for (let i = 0; i < days && i < 7; i++) {
            const day = dayNames[i];
            
            const lunch = db.prepare(`
                SELECT id FROM meals WHERE type = 'main' AND ${whereClause}
                ORDER BY RANDOM() LIMIT 1
            `).get();
            
            const dinner = db.prepare(`
                SELECT id FROM meals WHERE type = 'main' AND ${whereClause}
                ORDER BY RANDOM() LIMIT 1
            `).get();
            
            meals[day] = {
                lunch: lunch?.id || null,
                dinner: dinner?.id || null
            };
        }
        
        db.close();
        res.json({ suggested_meals: meals });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
