const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'database', 'foodmatchs.db');
const getDb = () => new Database(DB_PATH);

// =====================================================
// GET USER'S CLUBS
// =====================================================
router.get('/', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        
        const clubs = db.prepare(`
            SELECT c.*, cm.role,
                   (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as member_count
            FROM clubs c
            JOIN club_members cm ON c.id = cm.club_id
            WHERE cm.user_id = ?
            ORDER BY c.created_at DESC
        `).all(userId);
        
        db.close();
        res.json(clubs);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// CREATE CLUB
// =====================================================
router.post('/', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { name, description, image_url, is_private } = req.body;
        
        if (!name || name.length < 3) {
            db.close();
            return res.status(400).json({ error: 'Name must be at least 3 characters' });
        }
        
        const clubId = uuidv4();
        
        db.prepare(`
            INSERT INTO clubs (id, name, description, image_url, is_private, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(clubId, name, description || '', image_url || null, is_private ? 1 : 0, userId);
        
        // Add creator as admin
        db.prepare(`
            INSERT INTO club_members (id, club_id, user_id, role)
            VALUES (?, ?, ?, 'admin')
        `).run(uuidv4(), clubId, userId);
        
        // Award achievement if first club
        const clubCount = db.prepare('SELECT COUNT(*) as count FROM club_members WHERE user_id = ? AND role = ?').get(userId, 'admin').count;
        if (clubCount === 1) {
            const achievement = db.prepare('SELECT id FROM achievements WHERE name = ?').get('Club Creator');
            if (achievement) {
                const existing = db.prepare('SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?').get(userId, achievement.id);
                if (!existing) {
                    db.prepare('INSERT INTO user_achievements (id, user_id, achievement_id) VALUES (?, ?, ?)').run(uuidv4(), userId, achievement.id);
                }
            }
        }
        
        db.close();
        res.status(201).json({ id: clubId, name, description, is_private });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET CLUB DETAILS
// =====================================================
router.get('/:id', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const clubId = req.params.id;
        
        const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId);
        
        if (!club) {
            db.close();
            return res.status(404).json({ error: 'Club not found' });
        }
        
        // Check membership
        const membership = db.prepare('SELECT role FROM club_members WHERE club_id = ? AND user_id = ?').get(clubId, userId);
        
        if (club.is_private && !membership) {
            db.close();
            return res.status(403).json({ error: 'Private club' });
        }
        
        // Get members
        const members = db.prepare(`
            SELECT u.id, u.username, u.avatar, cm.role, cm.joined_at
            FROM club_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.club_id = ?
        `).all(clubId);
        
        club.members = members;
        club.is_member = !!membership;
        club.role = membership?.role;
        
        db.close();
        res.json(club);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// JOIN CLUB
// =====================================================
router.post('/:id/join', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const clubId = req.params.id;
        
        const club = db.prepare('SELECT is_private FROM clubs WHERE id = ?').get(clubId);
        
        if (!club) {
            db.close();
            return res.status(404).json({ error: 'Club not found' });
        }
        
        if (club.is_private) {
            db.close();
            return res.status(403).json({ error: 'This is a private club, you need an invitation' });
        }
        
        const existing = db.prepare('SELECT id FROM club_members WHERE club_id = ? AND user_id = ?').get(clubId, userId);
        
        if (existing) {
            db.close();
            return res.status(400).json({ error: 'Already a member' });
        }
        
        db.prepare(`
            INSERT INTO club_members (id, club_id, user_id, role)
            VALUES (?, ?, ?, 'member')
        `).run(uuidv4(), clubId, userId);
        
        db.close();
        res.json({ success: true, message: 'Joined club' });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// LEAVE CLUB
// =====================================================
router.post('/:id/leave', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const clubId = req.params.id;
        
        db.prepare('DELETE FROM club_members WHERE club_id = ? AND user_id = ?').run(clubId, userId);
        
        db.close();
        res.json({ success: true });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// GET CLUB POSTS
// =====================================================
router.get('/:id/posts', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const clubId = req.params.id;
        
        // Check membership
        const membership = db.prepare('SELECT id FROM club_members WHERE club_id = ? AND user_id = ?').get(clubId, userId);
        
        if (!membership) {
            db.close();
            return res.status(403).json({ error: 'Not a member' });
        }
        
        const posts = db.prepare(`
            SELECT cp.*, u.username, u.avatar
            FROM club_posts cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.club_id = ?
            ORDER BY cp.created_at DESC
            LIMIT 50
        `).all(clubId);
        
        db.close();
        res.json(posts);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// CREATE CLUB POST
// =====================================================
router.post('/:id/posts', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const clubId = req.params.id;
        const { content, image_url, is_poll, poll_options } = req.body;
        
        // Check membership
        const membership = db.prepare('SELECT id FROM club_members WHERE club_id = ? AND user_id = ?').get(clubId, userId);
        
        if (!membership) {
            db.close();
            return res.status(403).json({ error: 'Not a member' });
        }
        
        const postId = uuidv4();
        
        db.prepare(`
            INSERT INTO club_posts (id, club_id, user_id, content, image_url, is_poll, poll_options_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(postId, clubId, userId, content, image_url || null, is_poll ? 1 : 0, poll_options ? JSON.stringify(poll_options) : null);
        
        db.close();
        res.status(201).json({ id: postId, content });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// VOTE ON POLL
// =====================================================
router.post('/:id/posts/:postId/vote', authenticateToken, (req, res) => {
    const db = getDb();
    try {
        const userId = req.user.userId;
        const { postId } = req.params;
        const { option_index } = req.body;
        
        const existing = db.prepare('SELECT id FROM club_poll_votes WHERE post_id = ? AND user_id = ?').get(postId, userId);
        
        if (existing) {
            // Update vote
            db.prepare('UPDATE club_poll_votes SET option_index = ? WHERE post_id = ? AND user_id = ?').run(option_index, postId, userId);
        } else {
            db.prepare(`
                INSERT INTO club_poll_votes (id, post_id, user_id, option_index)
                VALUES (?, ?, ?, ?)
            `).run(uuidv4(), postId, userId, option_index);
        }
        
        // Get vote counts
        const votes = db.prepare(`
            SELECT option_index, COUNT(*) as count
            FROM club_poll_votes WHERE post_id = ?
            GROUP BY option_index
        `).all(postId);
        
        db.close();
        res.json({ votes });
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// SEARCH PUBLIC CLUBS
// =====================================================
router.get('/search/public', (req, res) => {
    const db = getDb();
    try {
        const { q } = req.query;
        
        let query = `
            SELECT c.*, (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as member_count
            FROM clubs c WHERE is_private = 0
        `;
        const params = [];
        
        if (q) {
            query += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${q}%`, `%${q}%`);
        }
        
        query += ' ORDER BY member_count DESC LIMIT 20';
        
        const clubs = db.prepare(query).all(...params);
        
        db.close();
        res.json(clubs);
        
    } catch (error) {
        db.close();
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
