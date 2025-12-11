const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'database', 'foodmatchs.db');
const getDb = () => new Database(DB_PATH);

// =====================================================
// GET FEED (posts from followed users)
// =====================================================
router.get('/feed', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { limit = 20, offset = 0 } = req.query;
        
        const posts = db.prepare(`
            SELECT p.*, u.username, u.avatar,
                   (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                   (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
               OR p.user_id = ?
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `).all(userId, userId, userId, parseInt(limit), parseInt(offset));
        
        db.close();
        res.json(posts);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET EXPLORE (trending posts)
// =====================================================
router.get('/explore', optionalAuth, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user?.userId;
        const { limit = 20, offset = 0 } = req.query;
        
        const posts = db.prepare(`
            SELECT p.*, u.username, u.avatar,
                   (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY likes_count DESC, p.created_at DESC
            LIMIT ? OFFSET ?
        `).all(parseInt(limit), parseInt(offset));
        
        db.close();
        res.json(posts);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// CREATE POST
// =====================================================
router.post('/posts', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { caption, image_url, meal_id, recipe_json } = req.body;
        
        const postId = uuidv4();
        
        db.prepare(`
            INSERT INTO posts (id, user_id, caption, image_url, meal_id, recipe_json)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(postId, userId, caption || '', image_url || null, meal_id || null, recipe_json ? JSON.stringify(recipe_json) : null);
        
        // Award XP
        db.prepare('UPDATE users SET total_xp = total_xp + 10 WHERE id = ?').run(userId);
        
        const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
        
        db.close();
        res.status(201).json(post);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET SINGLE POST
// =====================================================
router.get('/posts/:id', optionalAuth, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user?.userId;
        
        const post = db.prepare(`
            SELECT p.*, u.username, u.avatar,
                   (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
        `).get(req.params.id);
        
        if (!post) {
            db.close();
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Get comments
        const comments = db.prepare(`
            SELECT c.*, u.username, u.avatar
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC
        `).all(req.params.id);
        
        post.comments = comments;
        
        db.close();
        res.json(post);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// DELETE POST
// =====================================================
router.delete('/posts/:id', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(req.params.id);
        
        if (!post || post.user_id !== userId) {
            db.close();
            return res.status(403).json({ error: 'Not authorized' });
        }
        
        db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
        db.prepare('DELETE FROM likes WHERE post_id = ?').run(req.params.id);
        db.prepare('DELETE FROM comments WHERE post_id = ?').run(req.params.id);
        
        db.close();
        res.json({ success: true });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// LIKE POST
// =====================================================
router.post('/posts/:id/like', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const postId = req.params.id;
        
        const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND post_id = ?').get(userId, postId);
        
        if (existing) {
            // Unlike
            db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(userId, postId);
            db.close();
            return res.json({ liked: false });
        }
        
        // Like
        db.prepare('INSERT INTO likes (id, user_id, post_id) VALUES (?, ?, ?)').run(uuidv4(), userId, postId);
        
        // Get post owner and notify
        const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId);
        if (post && post.user_id !== userId) {
            db.prepare(`
                INSERT INTO notifications (id, user_id, type, actor_id, post_id)
                VALUES (?, ?, 'like', ?, ?)
            `).run(uuidv4(), post.user_id, userId, postId);
        }
        
        db.close();
        res.json({ liked: true });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// ADD COMMENT
// =====================================================
router.post('/posts/:id/comments', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const postId = req.params.id;
        const { content } = req.body;
        
        if (!content || content.trim().length === 0) {
            db.close();
            return res.status(400).json({ error: 'Content required' });
        }
        
        const commentId = uuidv4();
        db.prepare(`
            INSERT INTO comments (id, post_id, user_id, content)
            VALUES (?, ?, ?, ?)
        `).run(commentId, postId, userId, content.trim());
        
        // Notify post owner
        const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId);
        if (post && post.user_id !== userId) {
            db.prepare(`
                INSERT INTO notifications (id, user_id, type, actor_id, post_id, comment_id)
                VALUES (?, ?, 'comment', ?, ?, ?)
            `).run(uuidv4(), post.user_id, userId, postId, commentId);
        }
        
        const comment = db.prepare(`
            SELECT c.*, u.username, u.avatar
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `).get(commentId);
        
        db.close();
        res.status(201).json(comment);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// FOLLOW USER
// =====================================================
router.post('/follow/:userId', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const followerId = req.user.userId;
        const followingId = req.params.userId;
        
        if (followerId === followingId) {
            db.close();
            return res.status(400).json({ error: 'Cannot follow yourself' });
        }
        
        const existing = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(followerId, followingId);
        
        if (existing) {
            // Unfollow
            db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(followerId, followingId);
            db.close();
            return res.json({ following: false });
        }
        
        // Follow
        db.prepare('INSERT INTO follows (id, follower_id, following_id) VALUES (?, ?, ?)').run(uuidv4(), followerId, followingId);
        
        // Notify
        db.prepare(`
            INSERT INTO notifications (id, user_id, type, actor_id)
            VALUES (?, ?, 'follow', ?)
        `).run(uuidv4(), followingId, followerId);
        
        db.close();
        res.json({ following: true });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET FOLLOWERS / FOLLOWING
// =====================================================
router.get('/followers/:userId', (req, res) => {
    const db = getDb();
    try {
        const followers = db.prepare(`
            SELECT u.id, u.username, u.avatar, u.bio
            FROM follows f
            JOIN users u ON f.follower_id = u.id
            WHERE f.following_id = ?
        `).all(req.params.userId);
        
        db.close();
        res.json(followers);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

router.get('/following/:userId', (req, res) => {
    const db = getDb();
    try {
        const following = db.prepare(`
            SELECT u.id, u.username, u.avatar, u.bio
            FROM follows f
            JOIN users u ON f.following_id = u.id
            WHERE f.follower_id = ?
        `).all(req.params.userId);
        
        db.close();
        res.json(following);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET NOTIFICATIONS
// =====================================================
router.get('/notifications', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        const notifications = db.prepare(`
            SELECT n.*, u.username as actor_username, u.avatar as actor_avatar
            FROM notifications n
            JOIN users u ON n.actor_id = u.id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
            LIMIT 50
        `).all(userId);
        
        db.close();
        res.json(notifications);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// MARK NOTIFICATIONS AS READ
// =====================================================
router.post('/notifications/read', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
        
        db.close();
        res.json({ success: true });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// STORIES
// =====================================================
router.post('/stories', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { image_url, meal_id } = req.body;
        
        const storyId = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        
        db.prepare(`
            INSERT INTO stories (id, user_id, image_url, meal_id, expires_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(storyId, userId, image_url, meal_id || null, expiresAt);
        
        db.close();
        res.status(201).json({ id: storyId, expires_at: expiresAt });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

router.get('/stories', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        // Get stories from followed users (not expired)
        const stories = db.prepare(`
            SELECT s.*, u.username, u.avatar
            FROM stories s
            JOIN users u ON s.user_id = u.id
            WHERE (s.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) OR s.user_id = ?)
              AND s.expires_at > datetime('now')
            ORDER BY s.created_at DESC
        `).all(userId, userId);
        
        db.close();
        res.json(stories);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
