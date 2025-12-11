const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'foodmatchs.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

console.log('🗄️  Initializing FoodMatchs database...');

// Create or open database
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Read and execute schema
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

console.log('✅ Schema created successfully');

// Insert default achievements
const achievements = [
    // Cooking achievements
    { id: 'first_meal', name: 'Premier Plat', emoji: '🥇', description: 'Cuisiner sa première recette', category: 'cooking', condition_type: 'meals_cooked', condition_value: 1, xp_reward: 50, rarity: 'common' },
    { id: 'cook_10', name: 'Apprenti Cuisinier', emoji: '👨‍🍳', description: 'Cuisiner 10 recettes', category: 'cooking', condition_type: 'meals_cooked', condition_value: 10, xp_reward: 100, rarity: 'common' },
    { id: 'cook_50', name: 'Chef Amateur', emoji: '🍳', description: 'Cuisiner 50 recettes', category: 'cooking', condition_type: 'meals_cooked', condition_value: 50, xp_reward: 250, rarity: 'uncommon' },
    { id: 'cook_100', name: 'Chef Confirmé', emoji: '⭐', description: 'Cuisiner 100 recettes', category: 'cooking', condition_type: 'meals_cooked', condition_value: 100, xp_reward: 500, rarity: 'rare' },
    { id: 'cook_500', name: 'Chef Étoilé', emoji: '🌟', description: 'Cuisiner 500 recettes', category: 'cooking', condition_type: 'meals_cooked', condition_value: 500, xp_reward: 1000, rarity: 'epic' },
    { id: 'bocuse', name: 'Paul Bocuse', emoji: '👑', description: 'Cuisiner 1000 recettes', category: 'cooking', condition_type: 'meals_cooked', condition_value: 1000, xp_reward: 2500, rarity: 'legendary' },

    // Streak achievements
    { id: 'streak_3', name: 'Régulier', emoji: '🔥', description: 'Streak de 3 jours', category: 'streak', condition_type: 'streak', condition_value: 3, xp_reward: 50, rarity: 'common' },
    { id: 'streak_7', name: 'Semaine Parfaite', emoji: '🔥', description: 'Streak de 7 jours', category: 'streak', condition_type: 'streak', condition_value: 7, xp_reward: 150, rarity: 'uncommon' },
    { id: 'streak_30', name: 'Mois de Feu', emoji: '🔥', description: 'Streak de 30 jours', category: 'streak', condition_type: 'streak', condition_value: 30, xp_reward: 500, rarity: 'rare' },
    { id: 'streak_100', name: 'Centenaire', emoji: '💯', description: 'Streak de 100 jours', category: 'streak', condition_type: 'streak', condition_value: 100, xp_reward: 1500, rarity: 'epic' },
    { id: 'streak_365', name: 'Année Culinaire', emoji: '🏆', description: 'Streak de 365 jours', category: 'streak', condition_type: 'streak', condition_value: 365, xp_reward: 5000, rarity: 'legendary' },

    // Social achievements
    { id: 'followers_10', name: 'Influenceur Débutant', emoji: '👥', description: 'Avoir 10 abonnés', category: 'social', condition_type: 'followers', condition_value: 10, xp_reward: 50, rarity: 'common' },
    { id: 'followers_100', name: 'Micro-Influenceur', emoji: '📢', description: 'Avoir 100 abonnés', category: 'social', condition_type: 'followers', condition_value: 100, xp_reward: 200, rarity: 'uncommon' },
    { id: 'followers_1000', name: 'Food Influenceur', emoji: '🌟', description: 'Avoir 1000 abonnés', category: 'social', condition_type: 'followers', condition_value: 1000, xp_reward: 750, rarity: 'rare' },
    { id: 'followers_10000', name: 'Food Star', emoji: '⭐', description: 'Avoir 10000 abonnés', category: 'social', condition_type: 'followers', condition_value: 10000, xp_reward: 2000, rarity: 'epic' },
    { id: 'viral_post', name: 'Viral', emoji: '🚀', description: 'Post avec 100+ likes', category: 'social', condition_type: 'post_likes', condition_value: 100, xp_reward: 300, rarity: 'rare' },
    { id: 'first_post', name: 'Premier Post', emoji: '📝', description: 'Publier sa première recette', category: 'social', condition_type: 'posts', condition_value: 1, xp_reward: 25, rarity: 'common' },

    // Exploration achievements
    { id: 'globe_trotter', name: 'Globe-Trotter', emoji: '🌍', description: 'Cuisiner 10 cuisines différentes', category: 'exploration', condition_type: 'cuisines', condition_value: 10, xp_reward: 300, rarity: 'uncommon' },
    { id: 'world_chef', name: 'Chef du Monde', emoji: '🗺️', description: 'Cuisiner 20 cuisines différentes', category: 'exploration', condition_type: 'cuisines', condition_value: 20, xp_reward: 750, rarity: 'rare' },
    { id: 'sommelier', name: 'Sommelier', emoji: '🍷', description: '50 accords mets-vins', category: 'exploration', condition_type: 'wine_pairings', condition_value: 50, xp_reward: 400, rarity: 'uncommon' },
    { id: 'cheese_master', name: 'Maître Fromager', emoji: '🧀', description: '30 plateaux fromages', category: 'exploration', condition_type: 'cheese_plates', condition_value: 30, xp_reward: 300, rarity: 'uncommon' },

    // Special achievements
    { id: 'veggie_week', name: 'Veggie Week', emoji: '🌱', description: '7 jours végétarien', category: 'special', condition_type: 'veggie_streak', condition_value: 7, xp_reward: 200, rarity: 'uncommon' },
    { id: 'budget_master', name: 'Budget Master', emoji: '💰', description: '10 repas économiques', category: 'special', condition_type: 'budget_meals', condition_value: 10, xp_reward: 150, rarity: 'common' },
    { id: 'quick_chef', name: 'Speed Chef', emoji: '⚡', description: '20 recettes en moins de 20min', category: 'special', condition_type: 'quick_meals', condition_value: 20, xp_reward: 200, rarity: 'uncommon' },
    { id: 'meal_prep_pro', name: 'Meal Prep Pro', emoji: '📦', description: 'Créer 5 meal preps', category: 'special', condition_type: 'meal_preps', condition_value: 5, xp_reward: 250, rarity: 'uncommon' },
    { id: 'club_creator', name: 'Leader Culinaire', emoji: '👑', description: 'Créer un club', category: 'social', condition_type: 'clubs_created', condition_value: 1, xp_reward: 100, rarity: 'common' },
    { id: 'club_popular', name: 'Club Populaire', emoji: '🏠', description: 'Club avec 50 membres', category: 'social', condition_type: 'club_members', condition_value: 50, xp_reward: 500, rarity: 'rare' },
];

const insertAchievement = db.prepare(`
    INSERT OR REPLACE INTO achievements (id, name, emoji, description, category, condition_type, condition_value, xp_reward, rarity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const a of achievements) {
    insertAchievement.run(a.id, a.name, a.emoji, a.description, a.category, a.condition_type, a.condition_value, a.xp_reward, a.rarity);
}

console.log(`✅ ${achievements.length} achievements inserted`);

// Insert culinary profiles (20+)
const profiles = [
    { id: 'epicurien', name: "L'Épicurien Audacieux", emoji: '🌶️', description: "Tu adores les saveurs intenses et les cuisines du monde. Épices, piment et découvertes sont tes maîtres-mots ! Tu n'as pas peur d'explorer des territoires gustatifs inconnus.", tags: 'spicy,indian,thai,mexican,korean,adventurous,exotic', traits: 'aventurier,épicé,exotique,curieux', rarity: 'common' },
    { id: 'gourmet', name: 'Le Gourmet Classique', emoji: '🍷', description: "Tu apprécies les valeurs sûres et les saveurs raffinées. Fromage, vin et sauces crémeuses te font fondre. La gastronomie française n'a pas de secret pour toi.", tags: 'cheese,wine_red,sauce,creamy,french,classic', traits: 'classique,raffiné,traditionnel,élégant', rarity: 'common' },
    { id: 'healthy', name: 'Le Healthy Gourmand', emoji: '🥗', description: "Tu privilégies la fraîcheur et l'équilibre sans sacrifier le goût. Légumes, poisson et saveurs légères composent ton quotidien avec bonheur.", tags: 'healthy,avocado,salmon,herbs,lemon,fruit,fresh,light', traits: 'frais,équilibré,léger,conscient', rarity: 'common' },
    { id: 'comfort', name: "L'Amateur de Comfort Food", emoji: '🍝', description: "Tu aimes les plats réconfortants et généreux qui réchauffent le cœur. Fromage fondant, pâtes et gourmandises te rendent heureux.", tags: 'cheese,italian,comfort,creamy,pastry,cozy', traits: 'gourmand,réconfortant,généreux,nostalgique', rarity: 'common' },
    { id: 'asian_lover', name: "L'Asiatique dans l'Âme", emoji: '🥢', description: "Umami, gingembre, sauce soja... Les saveurs d'Asie te transportent. Du japonais au thaï, tu maîtrises les baguettes comme personne.", tags: 'asian,japanese,thai,korean,chinese,vietnamese,umami', traits: 'zen,umami,précis,voyageur', rarity: 'uncommon' },
    { id: 'mediterranean', name: 'Le Méditerranéen', emoji: '🫒', description: "Huile d'olive, tomates gorgées de soleil, herbes de Provence... Tu vis au rythme de la Méditerranée et de ses saveurs ensoleillées.", tags: 'italian,greek,spanish,tomato,olive,herbs,fresh', traits: 'solaire,simple,authentique,convivial', rarity: 'common' },
    { id: 'carnivore', name: 'Le Carnivore Assumé', emoji: '🥩', description: "Pour toi, un repas sans viande n'est pas vraiment un repas. Steak, côtelettes, rôti... Tu connais toutes les cuissons sur le bout des doigts.", tags: 'meat,steak,bbq,grill,smoky,protein', traits: 'puissant,généreux,traditionnel,robuste', rarity: 'common' },
    { id: 'pescetarian', name: 'Le Pescétarien', emoji: '🐟', description: "Les trésors de la mer sont ta passion. Poissons, fruits de mer et crustacés composent tes plus beaux repas, toujours avec fraîcheur.", tags: 'fish,seafood,salmon,shrimp,fresh,iodine', traits: 'marin,frais,délicat,raffiné', rarity: 'uncommon' },
    { id: 'sweet_tooth', name: 'Le Bec Sucré', emoji: '🍰', description: "Desserts, pâtisseries, chocolat... Tu termines toujours par une note sucrée. La vie est trop courte pour sauter le dessert !", tags: 'sweet,chocolate,pastry,dessert,fruit,sugar', traits: 'gourmand,joyeux,créatif,indulgent', rarity: 'common' },
    { id: 'street_food', name: 'Le Street Foodie', emoji: '🌯', description: "Tu préfères manger sur le pouce des saveurs du monde entier. Tacos, kebabs, banh mi... La cuisine de rue est ton terrain de jeu.", tags: 'street,tacos,burger,kebab,casual,fast', traits: 'urbain,décontracté,curieux,nomade', rarity: 'uncommon' },
    { id: 'chef_patissier', name: 'Le Chef Pâtissier', emoji: '🥐', description: "Croissants, macarons, entremets... Tu maîtrises l'art délicat de la pâtisserie française et tu adores créer des desserts d'exception.", tags: 'pastry,french,baking,sweet,delicate,technical', traits: 'précis,patient,créatif,perfectionniste', rarity: 'rare' },
    { id: 'vegan_warrior', name: 'Le Vegan Engagé', emoji: '🌱', description: "Tu as fait le choix du 100% végétal et tu prouves chaque jour que la cuisine vegan peut être incroyablement savoureuse et variée.", tags: 'vegan,plant,tofu,vegetables,healthy,ethical', traits: 'engagé,créatif,conscient,innovant', rarity: 'uncommon' },
    { id: 'bbq_master', name: 'Le Maître du BBQ', emoji: '🔥', description: "Été comme hiver, le barbecue est ton royaume. Marinades, fumages, grillades... Tu maîtrises l'art du feu comme personne.", tags: 'bbq,grill,smoky,meat,outdoor,summer', traits: 'convivial,patient,technique,festif', rarity: 'uncommon' },
    { id: 'brunch_addict', name: 'Le Brunch Addict', emoji: '🥞', description: "Pancakes, œufs Benedict, avocado toast... Le brunch du dimanche est ton moment préféré de la semaine, à savourer longuement.", tags: 'brunch,eggs,pancakes,avocado,morning,relaxed', traits: 'détendu,social,gourmand,matinal', rarity: 'common' },
    { id: 'wine_expert', name: "L'Expert en Vins", emoji: '🍷', description: "Tu ne choisis jamais un plat sans penser à son accord parfait. Rouge, blanc, rosé... Tu connais les cépages et les terroirs.", tags: 'wine_red,wine_white,wine_rose,pairing,french,refined', traits: 'cultivé,raffiné,connaisseur,élégant', rarity: 'rare' },
    { id: 'cheese_lover', name: 'Le Fromager Passionné', emoji: '🧀', description: "De l'Époisses au Comté, tu connais tous les fromages français. Un repas sans plateau de fromages te semble incomplet.", tags: 'cheese,french,traditional,creamy,strong', traits: 'traditionnel,connaisseur,patient,épicurien', rarity: 'uncommon' },
    { id: 'home_chef', name: 'Le Chef Maison', emoji: '👨‍🍳', description: "Tu adores passer des heures en cuisine pour créer des plats élaborés. La cuisine est ton art et ta passion.", tags: 'homemade,elaborate,technique,passion,creative', traits: 'passionné,méticuleux,créatif,généreux', rarity: 'uncommon' },
    { id: 'quick_cook', name: 'Le Speed Chef', emoji: '⚡', description: "Tu prouves qu'on peut manger bien en 15 minutes. Efficacité et saveur sont tes maîtres-mots pour le quotidien.", tags: 'quick,easy,simple,practical,weeknight', traits: 'efficace,pragmatique,organisé,malin', rarity: 'common' },
    { id: 'world_explorer', name: "L'Explorateur Culinaire", emoji: '🗺️', description: "Tu as goûté des plats des 5 continents et tu continues d'explorer. Chaque cuisine du monde est une aventure.", tags: 'world,exotic,diverse,adventurous,cultural', traits: 'curieux,ouvert,aventurier,cultivé', rarity: 'rare' },
    { id: 'seasonal', name: 'Le Locavore', emoji: '🍂', description: "Tu cuisines selon les saisons et privilégies le local. Les marchés sont ton terrain de chasse préféré.", tags: 'seasonal,local,fresh,market,organic,sustainable', traits: 'responsable,authentique,proche,conscient', rarity: 'uncommon' },
    { id: 'fusion', name: 'Le Fusion Master', emoji: '🔀', description: "Tu mélanges les cuisines avec audace. Tacos au kimchi ? Risotto au miso ? Pour toi, la créativité n'a pas de frontières.", tags: 'fusion,creative,modern,innovative,mixed', traits: 'innovant,audacieux,créatif,moderne', rarity: 'rare' },
    { id: 'instagrammer', name: 'Le Food Instagrammer', emoji: '📸', description: "Un plat n'est bon que s'il est beau. Tu soignes la présentation autant que le goût et tu adores partager tes créations.", tags: 'aesthetic,presentation,social,trendy,visual', traits: 'esthète,social,tendance,créatif', rarity: 'uncommon' },
    { id: 'grandma', name: "L'Héritier de Grand-Mère", emoji: '👵', description: "Tu perpétues les recettes familiales avec amour. Pot-au-feu, blanquette, tarte aux pommes... Les classiques sont éternels.", tags: 'traditional,family,homemade,classic,french,nostalgic', traits: 'nostalgique,traditionnel,aimant,patient', rarity: 'common' },
    { id: 'spice_king', name: 'Le Roi des Épices', emoji: '🌿', description: "Cumin, coriandre, curcuma, piment... Tu connais toutes les épices du monde et tu sais les marier à la perfection.", tags: 'spicy,herbs,aromatic,indian,moroccan,complex', traits: 'expert,olfactif,précis,voyageur', rarity: 'rare' },
];

const insertProfile = db.prepare(`
    INSERT OR REPLACE INTO profiles (id, name, emoji, description, tags, traits, rarity)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const p of profiles) {
    insertProfile.run(p.id, p.name, p.emoji, p.description, p.tags, p.traits, p.rarity);
}

console.log(`✅ ${profiles.length} profiles inserted`);

db.close();
console.log('🎉 Database initialization complete!');
