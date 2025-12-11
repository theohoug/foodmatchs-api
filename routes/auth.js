const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticateToken, generateToken, generateRefreshToken } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const db = getDb();

        // Validation
        if (!email || !username || !password) {
            return res.status(400).json({ error: 'Email, pseudo et mot de passe requis' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Mot de passe minimum 6 caractères' });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'Pseudo entre 3 et 20 caractères' });
        }

        // Check if exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email.toLowerCase(), username.toLowerCase());
        if (existing) {
            return res.status(409).json({ error: 'Email ou pseudo déjà utilisé' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();

        // Create user
        db.prepare(`
            INSERT INTO users (id, email, username, password_hash)
            VALUES (?, ?, ?, ?)
        `).run(userId, email.toLowerCase(), username.toLowerCase(), hashedPassword);

        // Create default preferences
        db.prepare(`
            INSERT INTO user_preferences (user_id)
            VALUES (?)
        `).run(userId);

        // Create streak entry
        db.prepare(`
            INSERT INTO streaks (user_id, current_streak, longest_streak)
            VALUES (?, 0, 0)
        `).run(userId);

        // Generate tokens
        const user = { id: userId, email: email.toLowerCase(), username: username.toLowerCase() };
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        res.status(201).json({
            message: 'Compte créé avec succès',
            user: { id: userId, email: email.toLowerCase(), username: username.toLowerCase() },
            token,
            refreshToken
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const db = getDb();

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        // Find user
        const user = db.prepare(`
            SELECT id, email, username, password_hash, avatar, bio, level, total_xp, is_premium
            FROM users WHERE email = ?
        `).get(email.toLowerCase());

        if (!user) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        // Update last login
        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

        // Get streak
        const streak = db.prepare('SELECT current_streak, longest_streak FROM streaks WHERE user_id = ?').get(user.id);

        // Generate tokens
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        res.json({
            message: 'Connexion réussie',
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                avatar: user.avatar,
                bio: user.bio,
                level: user.level,
                total_xp: user.total_xp,
                is_premium: user.is_premium,
                streak: streak?.current_streak || 0
            },
            token,
            refreshToken
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        const user = db.prepare(`
            SELECT u.id, u.email, u.username, u.avatar, u.bio, u.level, u.total_xp, u.is_premium, u.created_at,
                   s.current_streak, s.longest_streak,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                   (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count
            FROM users u
            LEFT JOIN streaks s ON s.user_id = u.id
            WHERE u.id = ?
        `).get(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        // Get preferences
        const preferences = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);

        // Get achievements count
        const achievementsCount = db.prepare('SELECT COUNT(*) as count FROM user_achievements WHERE user_id = ?').get(req.user.id);

        res.json({
            ...user,
            preferences: preferences ? {
                allergens: JSON.parse(preferences.allergens || '[]'),
                diet: preferences.diet,
                alcohol: preferences.alcohol,
                extras: JSON.parse(preferences.extras || '[]'),
                default_servings: preferences.default_servings,
                preferred_budget: preferences.preferred_budget
            } : null,
            achievements_count: achievementsCount.count
        });

    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/auth/preferences
router.put('/preferences', authenticateToken, (req, res) => {
    try {
        const { allergens, diet, alcohol, extras, default_servings, preferred_budget } = req.body;
        const db = getDb();

        db.prepare(`
            UPDATE user_preferences SET
                allergens = ?,
                diet = ?,
                alcohol = ?,
                extras = ?,
                default_servings = ?,
                preferred_budget = ?
            WHERE user_id = ?
        `).run(
            JSON.stringify(allergens || []),
            diet || 'omnivore',
            alcohol ? 1 : 0,
            JSON.stringify(extras || []),
            default_servings || 2,
            preferred_budget || 'medium',
            req.user.id
        );

        res.json({ message: 'Préférences mises à jour' });

    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, (req, res) => {
    try {
        const { username, bio, avatar } = req.body;
        const db = getDb();

        // Check username availability if changed
        if (username) {
            const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
                .get(username.toLowerCase(), req.user.id);
            if (existing) {
                return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
            }
        }

        db.prepare(`
            UPDATE users SET
                username = COALESCE(?, username),
                bio = COALESCE(?, bio),
                avatar = COALESCE(?, avatar)
            WHERE id = ?
        `).run(username?.toLowerCase(), bio, avatar, req.user.id);

        const updatedUser = db.prepare('SELECT id, email, username, bio, avatar FROM users WHERE id = ?')
            .get(req.user.id);

        res.json({ message: 'Profil mis à jour', user: updatedUser });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
