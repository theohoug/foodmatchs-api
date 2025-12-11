const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'database', 'foodmatchs.db');
const getDb = () => new Database(DB_PATH);

// XP required per level (exponential growth)
const getXpForLevel = (level) => Math.floor(100 * Math.pow(1.5, level - 1));

// =====================================================
// GET USER STATS
// =====================================================
router.get('/stats', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        const user = db.prepare('SELECT level, total_xp FROM users WHERE id = ?').get(userId);
        const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId);
        
        const currentLevelXp = getXpForLevel(user.level);
        const nextLevelXp = getXpForLevel(user.level + 1);
        const xpInCurrentLevel = user.total_xp - currentLevelXp;
        const xpNeededForNext = nextLevelXp - currentLevelXp;
        
        db.close();
        
        res.json({
            level: user.level,
            total_xp: user.total_xp,
            xp_progress: xpInCurrentLevel,
            xp_needed: xpNeededForNext,
            progress_percent: Math.floor((xpInCurrentLevel / xpNeededForNext) * 100),
            streak: {
                current: streak?.current_streak || 0,
                longest: streak?.longest_streak || 0,
                last_date: streak?.last_quiz_date
            }
        });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET ALL ACHIEVEMENTS
// =====================================================
router.get('/achievements', (req, res) => {
    const db = getDb();
    try {
        const achievements = db.prepare('SELECT * FROM achievements ORDER BY xp_reward ASC').all();
        db.close();
        res.json(achievements);
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET USER ACHIEVEMENTS
// =====================================================
router.get('/achievements/me', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        const unlocked = db.prepare(`
            SELECT a.*, ua.unlocked_at
            FROM user_achievements ua
            JOIN achievements a ON ua.achievement_id = a.id
            WHERE ua.user_id = ?
            ORDER BY ua.unlocked_at DESC
        `).all(userId);
        
        const all = db.prepare('SELECT * FROM achievements').all();
        
        const unlockedIds = new Set(unlocked.map(a => a.id));
        const locked = all.filter(a => !unlockedIds.has(a.id));
        
        db.close();
        
        res.json({
            unlocked,
            locked,
            total: all.length,
            unlocked_count: unlocked.length
        });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// CHECK & UNLOCK ACHIEVEMENTS
// =====================================================
router.post('/achievements/check', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const newUnlocks = [];
        
        // Get user stats
        const user = db.prepare(`
            SELECT u.*, s.current_streak, s.longest_streak,
                   (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                   (SELECT COUNT(*) FROM daily_quiz WHERE user_id = u.id) as quiz_count
            FROM users u
            LEFT JOIN streaks s ON u.id = s.user_id
            WHERE u.id = ?
        `).get(userId);
        
        // Get all achievements not yet unlocked
        const achievements = db.prepare(`
            SELECT * FROM achievements
            WHERE id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = ?)
        `).all(userId);
        
        for (const achievement of achievements) {
            let shouldUnlock = false;
            
            // Check conditions based on achievement name
            switch (achievement.name) {
                case 'Premier Plat':
                    shouldUnlock = user.quiz_count >= 1;
                    break;
                case 'Streak 3 jours':
                    shouldUnlock = user.current_streak >= 3;
                    break;
                case 'Streak 7 jours':
                    shouldUnlock = user.current_streak >= 7;
                    break;
                case 'Streak 30 jours':
                    shouldUnlock = user.current_streak >= 30;
                    break;
                case 'Streak 100 jours':
                    shouldUnlock = user.current_streak >= 100;
                    break;
                case 'Streak 365 jours':
                    shouldUnlock = user.current_streak >= 365;
                    break;
                case '10 abonnés':
                    shouldUnlock = user.followers_count >= 10;
                    break;
                case '100 abonnés':
                    shouldUnlock = user.followers_count >= 100;
                    break;
                case '1000 abonnés':
                    shouldUnlock = user.followers_count >= 1000;
                    break;
                case '10K abonnés':
                    shouldUnlock = user.followers_count >= 10000;
                    break;
                case 'Première recette':
                    shouldUnlock = user.post_count >= 1;
                    break;
                case '10 recettes':
                    shouldUnlock = user.post_count >= 10;
                    break;
                case '50 recettes':
                    shouldUnlock = user.post_count >= 50;
                    break;
                case '100 recettes':
                    shouldUnlock = user.post_count >= 100;
                    break;
            }
            
            if (shouldUnlock) {
                db.prepare(`
                    INSERT INTO user_achievements (id, user_id, achievement_id)
                    VALUES (?, ?, ?)
                `).run(uuidv4(), userId, achievement.id);
                
                // Award XP
                db.prepare('UPDATE users SET total_xp = total_xp + ? WHERE id = ?').run(achievement.xp_reward, userId);
                
                newUnlocks.push(achievement);
            }
        }
        
        // Check for level up
        const updatedUser = db.prepare('SELECT level, total_xp FROM users WHERE id = ?').get(userId);
        let newLevel = updatedUser.level;
        
        while (updatedUser.total_xp >= getXpForLevel(newLevel + 1)) {
            newLevel++;
        }
        
        if (newLevel > updatedUser.level) {
            db.prepare('UPDATE users SET level = ? WHERE id = ?').run(newLevel, userId);
        }
        
        db.close();
        
        res.json({
            new_achievements: newUnlocks,
            level_up: newLevel > updatedUser.level ? newLevel : null
        });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET XP HISTORY
// =====================================================
router.get('/xp/history', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { limit = 20 } = req.query;
        
        const history = db.prepare(`
            SELECT * FROM xp_history
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `).all(userId, parseInt(limit));
        
        db.close();
        res.json(history);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET LEADERBOARD
// =====================================================
router.get('/leaderboard', (req, res) => {
    const db = getDb();
    try {
        const { type = 'xp', limit = 50 } = req.query;
        
        let query;
        switch (type) {
            case 'streak':
                query = `
                    SELECT u.id, u.username, u.avatar, u.level, s.current_streak as value
                    FROM users u
                    JOIN streaks s ON u.id = s.user_id
                    ORDER BY s.current_streak DESC
                    LIMIT ?
                `;
                break;
            case 'achievements':
                query = `
                    SELECT u.id, u.username, u.avatar, u.level, COUNT(ua.id) as value
                    FROM users u
                    LEFT JOIN user_achievements ua ON u.id = ua.user_id
                    GROUP BY u.id
                    ORDER BY value DESC
                    LIMIT ?
                `;
                break;
            default: // xp
                query = `
                    SELECT id, username, avatar, level, total_xp as value
                    FROM users
                    ORDER BY total_xp DESC
                    LIMIT ?
                `;
        }
        
        const leaderboard = db.prepare(query).all(parseInt(limit));
        
        db.close();
        res.json(leaderboard);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET ALL PROFILES
// =====================================================
router.get('/profiles', (req, res) => {
    const db = getDb();
    try {
        const profiles = db.prepare('SELECT * FROM profiles ORDER BY name').all();
        db.close();
        res.json(profiles);
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
