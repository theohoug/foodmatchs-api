const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'foodmatchs.db');

let db;

const getDb = () => {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('foreign_keys = ON');
    }
    return db;
};

// Helper to run queries safely
const run = (sql, params = []) => {
    const stmt = getDb().prepare(sql);
    return stmt.run(...params);
};

const get = (sql, params = []) => {
    const stmt = getDb().prepare(sql);
    return stmt.get(...params);
};

const all = (sql, params = []) => {
    const stmt = getDb().prepare(sql);
    return stmt.all(...params);
};

module.exports = {
    getDb,
    run,
    get,
    all
};
