const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'database', 'foodmatchs.db');
const getDb = () => new Database(DB_PATH);

// =====================================================
// GET QUESTIONS FOR QUIZ
// =====================================================
router.get('/questions', (req, res) => {
    const db = getDb();
    try {
        const { count = 15, category } = req.query;
        
        let query = 'SELECT * FROM questions WHERE 1=1';
        const params = [];
        
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        
        query += ' ORDER BY RANDOM() LIMIT ?';
        params.push(parseInt(count));
        
        const questions = db.prepare(query).all(...params);
        db.close();
        
        res.json(questions);
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// SUBMIT QUIZ ANSWERS & GET PROFILE
// =====================================================
router.post('/submit', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const { answers } = req.body; // [{ question_id, liked: true/false }]
        const userId = req.user.userId;
        
        if (!answers || !Array.isArray(answers)) {
            db.close();
            return res.status(400).json({ error: 'Answers array required' });
        }
        
        // Save answers
        const insertAnswer = db.prepare(`
            INSERT OR REPLACE INTO user_answers (user_id, question_id, liked)
            VALUES (?, ?, ?)
        `);
        
        for (const ans of answers) {
            insertAnswer.run(userId, ans.question_id, ans.liked ? 1 : 0);
        }
        
        // Calculate profile based on liked tags
        const likedAnswers = db.prepare(`
            SELECT q.tags FROM user_answers ua
            JOIN questions q ON ua.question_id = q.id
            WHERE ua.user_id = ? AND ua.liked = 1
        `).all(userId);
        
        // Count tag occurrences
        const tagCounts = {};
        for (const row of likedAnswers) {
            const tags = row.tags.split(',');
            for (const tag of tags) {
                tagCounts[tag.trim()] = (tagCounts[tag.trim()] || 0) + 1;
            }
        }
        
        // Get all profiles and score them
        const profiles = db.prepare('SELECT * FROM profiles').all();
        let bestProfile = null;
        let bestScore = -1;
        
        for (const profile of profiles) {
            const profileTags = profile.tags.split(',');
            let score = 0;
            for (const tag of profileTags) {
                score += tagCounts[tag.trim()] || 0;
            }
            if (score > bestScore) {
                bestScore = score;
                bestProfile = profile;
            }
        }
        
        // Save user profile
        if (bestProfile) {
            db.prepare(`
                INSERT OR REPLACE INTO user_profiles (user_id, profile_id, score)
                VALUES (?, ?, ?)
            `).run(userId, bestProfile.id, bestScore);
        }
        
        // Award XP for completing quiz
        const xpGain = 50;
        db.prepare('UPDATE users SET total_xp = total_xp + ? WHERE id = ?').run(xpGain, userId);
        db.prepare(`
            INSERT INTO xp_history (user_id, amount, reason)
            VALUES (?, ?, ?)
        `).run(userId, xpGain, 'quiz_completed');
        
        db.close();
        
        res.json({
            profile: bestProfile,
            score: bestScore,
            xp_gained: xpGain
        });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET USER PROFILE
// =====================================================
router.get('/profile', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        const userProfile = db.prepare(`
            SELECT p.*, up.score FROM user_profiles up
            JOIN profiles p ON up.profile_id = p.id
            WHERE up.user_id = ?
            ORDER BY up.assigned_at DESC LIMIT 1
        `).get(userId);
        
        db.close();
        res.json(userProfile || null);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// DAILY QUIZ - GET TODAY'S MENU
// =====================================================
router.get('/daily', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const today = new Date().toISOString().split('T')[0];
        
        // Check if already answered today
        const existing = db.prepare(`
            SELECT * FROM daily_quiz WHERE user_id = ? AND DATE(created_at) = ?
        `).get(userId, today);
        
        if (existing) {
            // Return existing menu
            const alternatives = JSON.parse(existing.alternatives_json || '{}');
            db.close();
            return res.json({
                already_answered: true,
                menu: {
                    starter: db.prepare('SELECT * FROM meals WHERE id = ?').get(existing.starter_id),
                    main: db.prepare('SELECT * FROM meals WHERE id = ?').get(existing.main_id),
                    dessert: db.prepare('SELECT * FROM meals WHERE id = ?').get(existing.dessert_id),
                    cheese: existing.cheese_id ? db.prepare('SELECT * FROM meals WHERE id = ?').get(existing.cheese_id) : null,
                    wine: existing.wine_id ? db.prepare('SELECT * FROM meals WHERE id = ?').get(existing.wine_id) : null,
                },
                alternatives
            });
        }
        
        db.close();
        res.json({ already_answered: false, needs_quiz: true });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// DAILY QUIZ - SUBMIT PREFERENCES
// =====================================================
router.post('/daily', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { budget, servings, mood, include_cheese, include_wine } = req.body;
        
        // Get user preferences
        const prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId);
        const allergens = prefs?.allergens ? JSON.parse(prefs.allergens) : [];
        const diet = prefs?.diet || 'omnivore';
        
        // Build query conditions
        let conditions = [];
        if (diet === 'vegetarian') conditions.push('is_vegetarian = 1');
        if (diet === 'vegan') conditions.push('is_vegan = 1');
        if (allergens.includes('gluten')) conditions.push('is_gluten_free = 1');
        if (budget) conditions.push(`budget = '${budget}'`);
        
        const whereClause = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';
        
        // Get random meals
        const getRandomMeal = (type) => {
            return db.prepare(`
                SELECT * FROM meals WHERE type = ? ${whereClause}
                ORDER BY RANDOM() LIMIT 1
            `).get(type);
        };
        
        const starter = getRandomMeal('starter');
        const main = getRandomMeal('main');
        const dessert = getRandomMeal('dessert');
        const cheese = include_cheese ? getRandomMeal('cheese') : null;
        const wine = include_wine ? getRandomMeal('wine') : null;
        
        // Get alternatives
        const getAlternatives = (type, excludeId) => {
            return db.prepare(`
                SELECT * FROM meals WHERE type = ? AND id != ? ${whereClause}
                ORDER BY RANDOM() LIMIT 3
            `).all(type, excludeId || '');
        };
        
        const alternatives = {
            starters: getAlternatives('starter', starter?.id),
            mains: getAlternatives('main', main?.id),
            desserts: getAlternatives('dessert', dessert?.id)
        };
        
        // Save daily quiz
        const { v4: uuidv4 } = require('uuid');
        const quizId = uuidv4();
        
        db.prepare(`
            INSERT INTO daily_quiz (id, user_id, budget, servings, mood, starter_id, main_id, dessert_id, cheese_id, wine_id, alternatives_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(quizId, userId, budget, servings, mood, starter?.id, main?.id, dessert?.id, cheese?.id, wine?.id, JSON.stringify(alternatives));
        
        // Update streak
        const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId);
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        
        let newStreak = 1;
        if (streak) {
            if (streak.last_quiz_date === yesterday) {
                newStreak = streak.current_streak + 1;
            } else if (streak.last_quiz_date === today) {
                newStreak = streak.current_streak;
            }
            
            const longestStreak = Math.max(streak.longest_streak, newStreak);
            db.prepare(`
                UPDATE streaks SET current_streak = ?, longest_streak = ?, last_quiz_date = ?
                WHERE user_id = ?
            `).run(newStreak, longestStreak, today, userId);
        }
        
        // Award XP
        const xpGain = 25 + (newStreak > 1 ? 5 * Math.min(newStreak, 10) : 0);
        db.prepare('UPDATE users SET total_xp = total_xp + ? WHERE id = ?').run(xpGain, userId);
        
        db.close();
        
        res.json({
            menu: { starter, main, dessert, cheese, wine },
            alternatives,
            streak: newStreak,
            xp_gained: xpGain
        });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// SWAP MEAL IN MENU
// =====================================================
router.post('/daily/swap', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { meal_type, new_meal_id } = req.body;
        const today = new Date().toISOString().split('T')[0];
        
        const columnMap = {
            starter: 'starter_id',
            main: 'main_id',
            dessert: 'dessert_id',
            cheese: 'cheese_id',
            wine: 'wine_id'
        };
        
        const column = columnMap[meal_type];
        if (!column) {
            db.close();
            return res.status(400).json({ error: 'Invalid meal type' });
        }
        
        db.prepare(`
            UPDATE daily_quiz SET ${column} = ?
            WHERE user_id = ? AND DATE(created_at) = ?
        `).run(new_meal_id, userId, today);
        
        const newMeal = db.prepare('SELECT * FROM meals WHERE id = ?').get(new_meal_id);
        
        db.close();
        res.json({ success: true, meal: newMeal });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
