// Setup script - runs all database initialization
const { execSync } = require('child_process');
const path = require('path');

console.log('🍽️  FoodMatchs - Database Setup\n');

const scripts = [
    'database/init.js',
    'database/seed-meals.js',
    'database/seed-meals-mains.js',
    'database/seed-meals-desserts.js',
    'database/seed-meals-extras.js'
];

scripts.forEach((script, index) => {
    console.log(`[${index + 1}/${scripts.length}] Running ${script}...`);
    try {
        execSync(`node ${script}`, { 
            cwd: __dirname,
            stdio: 'inherit'
        });
        console.log(`✅ ${script} completed\n`);
    } catch (error) {
        console.error(`❌ Error in ${script}:`, error.message);
        process.exit(1);
    }
});

console.log('🎉 Database setup complete!');
