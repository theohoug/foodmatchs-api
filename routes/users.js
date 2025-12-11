const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// GET /api/users/search?q=username
router.get('/search', authenticateToken, (req, res) => {
    try {
        const { q } = req.query;
        const db = getDb();

        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Recherche minimum 2 caractères' });
        }

        const users = db.prepare(`
            SELECT u.id, u.username, u.avatar, u.bio, u.level,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                   EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
            FROM users u
            WHERE u.username LIKE ? AND u.id != ?
            LIMIT 20
        `).all(req.user.id, `%${q.toLowerCase()}%`, req.user.id);

        res.json(users);

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/users/:username - Get user profile
router.get('/:username', optionalAuth, (req, res) => {
    try {
        const { username } = req.params;
        const db = getDb();

        const user = db.prepare(`
            SELECT u.id, u.username, u.avatar, u.bio, u.level, u.total_xp, u.created_at,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                   (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
                   (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count
            FROM users u
            WHERE u.username = ?
        `).get(username.toLowerCase());

        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        // Check if following (if authenticated)
        let isFollowing = false;
        if (req.user) {
            const follow = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
                .get(req.user.id, user.id);
            isFollowing = !!follow;
        }

        // Get recent posts
        const posts = db.prepare(`
            SELECT p.id, p.caption, p.image, p.likes_count, p.comments_count, p.created_at,
                   m.name as meal_name, m.emoji as meal_emoji
            FROM posts p
            LEFT JOIN meals m ON m.id = p.meal_id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
            LIMIT 12
        `).all(user.id);

        // Get achievements
        const achievements = db.prepare(`
            SELECT a.id, a.name, a.emoji, a.description, a.rarity, ua.unlocked_at
            FROM user_achievements ua
            JOIN achievements a ON a.id = ua.achievement_id
            WHERE ua.user_id = ?
            ORDER BY ua.unlocked_at DESC
            LIMIT 10
        `).all(user.id);

        // Get culinary profile
        const profile = db.prepare(`
            SELECT p.id, p.name, p.emoji, p.description
            FROM user_profiles up
            JOIN profiles p ON p.id = up.profile_id
            WHERE up.user_id = ?
            ORDER BY up.score DESC
            LIMIT 1
        `).get(user.id);

        res.json({
            ...user,
            is_following: isFollowing,
            is_self: req.user?.id === user.id,
            posts,
            achievements,
            culinary_profile: profile
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/users/:userId/follow
router.post('/:userId/follow', authenticateToken, (req, res) => {
    try {
        const { userId } = req.params;
        const db = getDb();

        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Impossible de se suivre soi-même' });
        }

        // Check user exists
        const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
        if (!userExists) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        // Check if already following
        const existing = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
            .get(req.user.id, userId);

        if (existing) {
            // Unfollow
            db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?')
                .run(req.user.id, userId);
            res.json({ following: false, message: 'Désabonné' });
        } else {
            // Follow
            db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)')
                .run(req.user.id, userId);

            // Create notification
            db.prepare(`
                INSERT INTO notifications (id, user_id, type, from_user_id)
                VALUES (?, ?, 'follow', ?)
            `).run(require('uuid').v4(), userId, req.user.id);

            res.json({ following: true, message: 'Abonné' });
        }

    } catch (error) {
        console.error('Follow error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/users/:userId/followers
router.get('/:userId/followers', optionalAuth, (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const db = getDb();
        const offset = (page - 1) * limit;

        const followers = db.prepare(`
            SELECT u.id, u.username, u.avatar, u.bio, u.level,
                   EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
            FROM follows f
            JOIN users u ON u.id = f.follower_id
            WHERE f.following_id = ?
            ORDER BY f.created_at DESC
            LIMIT ? OFFSET ?
        `).all(req.user?.id || '', userId, parseInt(limit), offset);

        const total = db.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?')
            .get(userId);

        res.json({
            followers,
            total: total.count,
            page: parseInt(page),
            pages: Math.ceil(total.count / limit)
        });

    } catch (error) {
        console.error('Get followers error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/users/:userId/following
router.get('/:userId/following', optionalAuth, (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const db = getDb();
        const offset = (page - 1) * limit;

        const following = db.prepare(`
            SELECT u.id, u.username, u.avatar, u.bio, u.level,
                   EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
            FROM follows f
            JOIN users u ON u.id = f.following_id
            WHERE f.follower_id = ?
            ORDER BY f.created_at DESC
            LIMIT ? OFFSET ?
        `).all(req.user?.id || '', userId, parseInt(limit), offset);

        const total = db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?')
            .get(userId);

        res.json({
            following,
            total: total.count,
            page: parseInt(page),
            pages: Math.ceil(total.count / limit)
        });

    } catch (error) {
        console.error('Get following error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/users/:userId/notifications
router.get('/me/notifications', authenticateToken, (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const db = getDb();
        const offset = (page - 1) * limit;

        const notifications = db.prepare(`
            SELECT n.*, 
                   u.username as from_username, u.avatar as from_avatar,
                   p.caption as post_caption
            FROM notifications n
            LEFT JOIN users u ON u.id = n.from_user_id
            LEFT JOIN posts p ON p.id = n.post_id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
            LIMIT ? OFFSET ?
        `).all(req.user.id, parseInt(limit), offset);

        const unread = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0')
            .get(req.user.id);

        res.json({
            notifications,
            unread_count: unread.count
        });

    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/users/notifications/read
router.put('/notifications/read', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
        res.json({ message: 'Notifications marquées comme lues' });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
