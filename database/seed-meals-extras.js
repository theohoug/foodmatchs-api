const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'foodmatchs.db');
const db = new Database(DB_PATH);

console.log('🧀🍷 Seeding cheeses and wines...');

const insertMeal = db.prepare(`
    INSERT OR REPLACE INTO meals (id, type, name, emoji, description, tags, cuisine, prep_time, cook_time, difficulty, budget, calories, servings, wine_pairing, cheese_pairing, season, is_vegetarian, is_vegan, is_gluten_free, recipe_json, ingredients_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// =====================================================
// CHEESES (50+)
// =====================================================
const cheeses = [
    // SOFT CHEESES
    { id: 'camembert', name: 'Camembert de Normandie', emoji: '🧀', description: 'Fromage à pâte molle et croûte fleurie, onctueux et typé', tags: 'french,soft,normandy,creamy,strong', cuisine: 'french', calories: 300, wine_pairing: 'Cidre ou Bourgogne rouge' },
    { id: 'brie', name: 'Brie de Meaux', emoji: '🧀', description: 'Roi des fromages, pâte crémeuse, croûte fleurie', tags: 'french,soft,ile_de_france,creamy,mild', cuisine: 'french', calories: 330, wine_pairing: 'Champagne ou Bourgogne' },
    { id: 'saint_marcellin', name: 'Saint-Marcellin', emoji: '🧀', description: 'Petit fromage du Dauphiné, crémeux et fondant', tags: 'french,soft,rhone,creamy,mild', cuisine: 'french', calories: 290, wine_pairing: 'Côtes du Rhône rouge' },
    { id: 'reblochon', name: 'Reblochon', emoji: '🧀', description: 'Fromage savoyard, pâte pressée non cuite, onctueux', tags: 'french,soft,savoie,creamy,mild,mountain', cuisine: 'french', calories: 320, wine_pairing: 'Vin de Savoie blanc' },
    { id: 'munster', name: 'Munster', emoji: '🧀', description: 'Fromage alsacien, pâte molle, odeur forte, goût doux', tags: 'french,soft,alsace,strong,washed_rind', cuisine: 'french', calories: 310, wine_pairing: 'Gewürztraminer' },
    { id: 'epoisses', name: 'Époisses', emoji: '🧀', description: 'Fromage bourguignon, croûte lavée au marc, très parfumé', tags: 'french,soft,burgundy,strong,washed_rind', cuisine: 'french', calories: 300, wine_pairing: 'Marc de Bourgogne ou Gevrey-Chambertin' },
    { id: 'pont_leveque', name: 'Pont-l\'Évêque', emoji: '🧀', description: 'Fromage normand carré, pâte molle, saveur douce', tags: 'french,soft,normandy,mild,washed_rind', cuisine: 'french', calories: 320, wine_pairing: 'Pommeau ou Côtes du Rhône' },
    { id: 'chaource', name: 'Chaource', emoji: '🧀', description: 'Fromage champenois, croûte fleurie, cœur coulant', tags: 'french,soft,champagne,creamy,mild', cuisine: 'french', calories: 290, wine_pairing: 'Champagne rosé' },
    { id: 'mont_dor', name: 'Mont d\'Or', emoji: '🧀', description: 'Fromage du Jura, cerclé d\'épicéa, fondant et boisé', tags: 'french,soft,jura,creamy,seasonal,winter', cuisine: 'french', calories: 330, wine_pairing: 'Vin jaune du Jura', season: 'winter' },
    { id: 'livarot', name: 'Livarot', emoji: '🧀', description: 'Fromage normand cerclé, croûte lavée orangée', tags: 'french,soft,normandy,strong,washed_rind', cuisine: 'french', calories: 310, wine_pairing: 'Cidre bouché ou Côtes du Rhône' },

    // HARD & SEMI-HARD CHEESES
    { id: 'comte', name: 'Comté', emoji: '🧀', description: 'Fromage du Jura, pâte pressée cuite, fruité et long', tags: 'french,hard,jura,aged,fruity,mountain', cuisine: 'french', calories: 410, wine_pairing: 'Vin jaune ou Savagnin' },
    { id: 'beaufort', name: 'Beaufort', emoji: '🧀', description: 'Prince des gruyères, saveur florale et fruitée', tags: 'french,hard,savoie,aged,fruity,mountain', cuisine: 'french', calories: 400, wine_pairing: 'Roussette de Savoie' },
    { id: 'gruyere', name: 'Gruyère Suisse', emoji: '🧀', description: 'Fromage suisse, pâte ferme, saveur corsée', tags: 'swiss,hard,aged,strong,mountain', cuisine: 'swiss', calories: 420, wine_pairing: 'Chasselas ou Pinot Noir' },
    { id: 'emmental', name: 'Emmental', emoji: '🧀', description: 'Fromage à gros trous, doux et fruité', tags: 'swiss,hard,mild,fruity,mountain', cuisine: 'swiss', calories: 380, wine_pairing: 'Riesling ou Pinot Blanc' },
    { id: 'parmesan', name: 'Parmigiano Reggiano', emoji: '🧀', description: 'Roi des fromages italiens, granuleux et umami', tags: 'italian,hard,aged,umami,strong', cuisine: 'italian', calories: 430, wine_pairing: 'Lambrusco ou Barolo' },
    { id: 'pecorino', name: 'Pecorino Romano', emoji: '🧀', description: 'Fromage de brebis italien, salé et piquant', tags: 'italian,hard,sheep,aged,strong,salty', cuisine: 'italian', calories: 390, wine_pairing: 'Chianti ou Brunello' },
    { id: 'manchego', name: 'Manchego', emoji: '🧀', description: 'Fromage espagnol de brebis, saveur noisetée', tags: 'spanish,hard,sheep,aged,nutty', cuisine: 'spanish', calories: 380, wine_pairing: 'Rioja ou Tempranillo' },
    { id: 'cantal', name: 'Cantal', emoji: '🧀', description: 'Fromage auvergnat, pâte pressée, goût puissant', tags: 'french,hard,auvergne,strong,aged', cuisine: 'french', calories: 370, wine_pairing: 'Saint-Pourçain ou Côtes d\'Auvergne' },
    { id: 'ossau_iraty', name: 'Ossau-Iraty', emoji: '🧀', description: 'Fromage basque de brebis, saveur douce et noisetée', tags: 'french,hard,basque,sheep,mild,nutty', cuisine: 'french', calories: 360, wine_pairing: 'Irouléguy ou Jurançon sec' },
    { id: 'tomme_savoie', name: 'Tomme de Savoie', emoji: '🧀', description: 'Fromage savoyard, croûte grise, saveur de terroir', tags: 'french,semi_hard,savoie,mild,mountain', cuisine: 'french', calories: 340, wine_pairing: 'Mondeuse ou Apremont' },
    { id: 'morbier', name: 'Morbier', emoji: '🧀', description: 'Fromage franc-comtois, raie de cendre caractéristique', tags: 'french,semi_hard,jura,mild,distinctive', cuisine: 'french', calories: 350, wine_pairing: 'Arbois blanc ou Côtes du Jura' },
    { id: 'saint_nectaire', name: 'Saint-Nectaire', emoji: '🧀', description: 'Fromage auvergnat, croûte grise, saveur noisetée', tags: 'french,semi_hard,auvergne,mild,nutty', cuisine: 'french', calories: 340, wine_pairing: 'Saint-Pourçain rouge' },
    { id: 'abondance', name: 'Abondance', emoji: '🧀', description: 'Fromage savoyard, pâte souple, goût fruité', tags: 'french,semi_hard,savoie,fruity,mountain', cuisine: 'french', calories: 380, wine_pairing: 'Crépy ou Ripaille' },

    // BLUE CHEESES
    { id: 'roquefort', name: 'Roquefort', emoji: '🧀', description: 'Roi des bleus, brebis, persillé intense et crémeux', tags: 'french,blue,sheep,strong,creamy', cuisine: 'french', calories: 370, wine_pairing: 'Sauternes ou Porto' },
    { id: 'bleu_auvergne', name: 'Bleu d\'Auvergne', emoji: '🧀', description: 'Fromage bleu vache, saveur prononcée', tags: 'french,blue,strong,creamy', cuisine: 'french', calories: 350, wine_pairing: 'Côtes du Rhône ou Banyuls' },
    { id: 'fourme_ambert', name: 'Fourme d\'Ambert', emoji: '🧀', description: 'Bleu cylindrique, doux et crémeux', tags: 'french,blue,mild,creamy', cuisine: 'french', calories: 340, wine_pairing: 'Monbazillac ou Gewürztraminer VT' },
    { id: 'gorgonzola', name: 'Gorgonzola', emoji: '🧀', description: 'Bleu italien, version dolce ou piccante', tags: 'italian,blue,creamy,strong', cuisine: 'italian', calories: 360, wine_pairing: 'Recioto ou Amarone' },
    { id: 'stilton', name: 'Stilton', emoji: '🧀', description: 'Bleu anglais, croûte naturelle, saveur complexe', tags: 'british,blue,strong,aged', cuisine: 'british', calories: 380, wine_pairing: 'Porto vintage' },
    { id: 'bleu_causses', name: 'Bleu des Causses', emoji: '🧀', description: 'Bleu du Sud, affiné en caves naturelles', tags: 'french,blue,strong,aged', cuisine: 'french', calories: 350, wine_pairing: 'Rivesaltes ou Maury' },

    // GOAT CHEESES
    { id: 'chevre_frais', name: 'Chèvre frais', emoji: '🐐', description: 'Fromage de chèvre frais, texture crémeuse', tags: 'french,goat,fresh,mild,creamy', cuisine: 'french', calories: 280, wine_pairing: 'Sancerre ou Muscadet' },
    { id: 'sainte_maure', name: 'Sainte-Maure de Touraine', emoji: '🐐', description: 'Bûche de chèvre cendrée, affinée', tags: 'french,goat,loire,aged,distinctive', cuisine: 'french', calories: 300, wine_pairing: 'Vouvray sec ou Chinon blanc' },
    { id: 'crottin_chavignol', name: 'Crottin de Chavignol', emoji: '🐐', description: 'Petit fromage de chèvre du Berry, sec ou frais', tags: 'french,goat,loire,aged,strong', cuisine: 'french', calories: 320, wine_pairing: 'Sancerre blanc' },
    { id: 'picodon', name: 'Picodon', emoji: '🐐', description: 'Petit fromage de chèvre ardéchois', tags: 'french,goat,rhone,aged,strong', cuisine: 'french', calories: 310, wine_pairing: 'Saint-Joseph blanc' },
    { id: 'valençay', name: 'Valençay', emoji: '🐐', description: 'Pyramide tronquée cendrée, saveur noisetée', tags: 'french,goat,loire,aged,nutty', cuisine: 'french', calories: 290, wine_pairing: 'Valençay blanc' },
    { id: 'rocamadour', name: 'Rocamadour', emoji: '🐐', description: 'Petit cabécou du Quercy, crémeux', tags: 'french,goat,southwest,mild,creamy', cuisine: 'french', calories: 280, wine_pairing: 'Cahors ou Bergerac sec' },
    { id: 'selles_sur_cher', name: 'Selles-sur-Cher', emoji: '🐐', description: 'Fromage de chèvre cendré du Loir-et-Cher', tags: 'french,goat,loire,mild,distinctive', cuisine: 'french', calories: 290, wine_pairing: 'Touraine blanc' },
    { id: 'pouligny', name: 'Pouligny-Saint-Pierre', emoji: '🐐', description: 'Pyramide de chèvre du Berry, texture fine', tags: 'french,goat,loire,aged,delicate', cuisine: 'french', calories: 300, wine_pairing: 'Reuilly blanc' },

    // FRESH & SPECIAL CHEESES
    { id: 'mozzarella', name: 'Mozzarella di Bufala', emoji: '🧀', description: 'Fromage frais italien de bufflonne', tags: 'italian,fresh,buffalo,mild,creamy', cuisine: 'italian', calories: 280, wine_pairing: 'Greco di Tufo ou Prosecco' },
    { id: 'burrata_cheese', name: 'Burrata', emoji: '🧀', description: 'Mozzarella garnie de crème et stracciatella', tags: 'italian,fresh,creamy,mild,indulgent', cuisine: 'italian', calories: 320, wine_pairing: 'Vermentino ou Fiano' },
    { id: 'ricotta', name: 'Ricotta', emoji: '🧀', description: 'Fromage frais italien, texture légère', tags: 'italian,fresh,light,mild,versatile', cuisine: 'italian', calories: 170, wine_pairing: 'Orvieto ou Frascati' },
    { id: 'feta', name: 'Feta', emoji: '🧀', description: 'Fromage grec de brebis, salé et friable', tags: 'greek,fresh,sheep,salty,tangy', cuisine: 'greek', calories: 260, wine_pairing: 'Assyrtiko ou Retsina' },
    { id: 'halloumi', name: 'Halloumi', emoji: '🧀', description: 'Fromage chypriote grillable', tags: 'cypriot,grilling,sheep,salty,firm', cuisine: 'cypriot', calories: 320, wine_pairing: 'Xynisteri ou rosé' },
    { id: 'mascarpone', name: 'Mascarpone', emoji: '🧀', description: 'Fromage frais crémeux italien, base du tiramisu', tags: 'italian,fresh,creamy,mild,dessert', cuisine: 'italian', calories: 400, wine_pairing: 'Moscato d\'Asti' },
];

// =====================================================
// WINES (50+)
// =====================================================
const wines = [
    // RED WINES - BORDEAUX
    { id: 'bordeaux_rouge', name: 'Bordeaux rouge', emoji: '🍷', description: 'Assemblage classique Merlot-Cabernet, fruité et structuré', tags: 'french,red,bordeaux,merlot,cabernet', cuisine: 'french', cheese_pairing: 'Comté, Cantal' },
    { id: 'saint_emilion', name: 'Saint-Émilion', emoji: '🍷', description: 'Vin rouge charpenté, dominante Merlot, notes de fruits mûrs', tags: 'french,red,bordeaux,merlot,aged,premium', cuisine: 'french', cheese_pairing: 'Époisses, Brie' },
    { id: 'pauillac', name: 'Pauillac', emoji: '🍷', description: 'Grand vin du Médoc, Cabernet dominant, tanins nobles', tags: 'french,red,bordeaux,cabernet,aged,premium', cuisine: 'french', cheese_pairing: 'Comté vieux, Roquefort' },
    { id: 'medoc', name: 'Médoc', emoji: '🍷', description: 'Vin rouge structuré, classique bordelais', tags: 'french,red,bordeaux,cabernet,structured', cuisine: 'french', cheese_pairing: 'Saint-Nectaire, Tomme' },

    // RED WINES - BOURGOGNE
    { id: 'bourgogne_rouge', name: 'Bourgogne rouge', emoji: '🍷', description: 'Pinot Noir élégant, fruits rouges et finesse', tags: 'french,red,burgundy,pinot_noir,elegant', cuisine: 'french', cheese_pairing: 'Époisses, Cîteaux' },
    { id: 'gevrey_chambertin', name: 'Gevrey-Chambertin', emoji: '🍷', description: 'Grand Pinot Noir, puissance et complexité', tags: 'french,red,burgundy,pinot_noir,premium,aged', cuisine: 'french', cheese_pairing: 'Époisses, Ami du Chambertin' },
    { id: 'pommard', name: 'Pommard', emoji: '🍷', description: 'Vin rouge charpenté de la Côte de Beaune', tags: 'french,red,burgundy,pinot_noir,structured', cuisine: 'french', cheese_pairing: 'Brillat-Savarin, Soumaintrain' },
    { id: 'nuits_st_georges', name: 'Nuits-Saint-Georges', emoji: '🍷', description: 'Pinot Noir robuste, notes épicées', tags: 'french,red,burgundy,pinot_noir,structured', cuisine: 'french', cheese_pairing: 'Époisses, Langres' },

    // RED WINES - RHÔNE
    { id: 'cotes_rhone', name: 'Côtes du Rhône', emoji: '🍷', description: 'Assemblage Grenache-Syrah, fruité et épicé', tags: 'french,red,rhone,grenache,syrah,fruity', cuisine: 'french', cheese_pairing: 'Picodon, Saint-Marcellin' },
    { id: 'chateauneuf', name: 'Châteauneuf-du-Pape', emoji: '🍷', description: 'Grand vin du Rhône, complexe et généreux', tags: 'french,red,rhone,grenache,premium,complex', cuisine: 'french', cheese_pairing: 'Banon, Pélardon' },
    { id: 'gigondas', name: 'Gigondas', emoji: '🍷', description: 'Vin puissant et épicé du sud Rhône', tags: 'french,red,rhone,grenache,powerful', cuisine: 'french', cheese_pairing: 'Tomme de chèvre, Roquefort' },
    { id: 'hermitage', name: 'Hermitage rouge', emoji: '🍷', description: 'Syrah noble, vin de garde prestigieux', tags: 'french,red,rhone,syrah,premium,aged', cuisine: 'french', cheese_pairing: 'Fourme d\'Ambert, Bleu' },
    { id: 'crozes_hermitage', name: 'Crozes-Hermitage', emoji: '🍷', description: 'Syrah accessible, fruits noirs et épices', tags: 'french,red,rhone,syrah,accessible', cuisine: 'french', cheese_pairing: 'Saint-Félicien, Rigotte' },

    // RED WINES - OTHER FRENCH
    { id: 'cahors', name: 'Cahors', emoji: '🍷', description: 'Vin noir du Lot, Malbec puissant', tags: 'french,red,southwest,malbec,powerful', cuisine: 'french', cheese_pairing: 'Rocamadour, Roquefort' },
    { id: 'madiran', name: 'Madiran', emoji: '🍷', description: 'Vin tannique du Sud-Ouest, Tannat dominant', tags: 'french,red,southwest,tannat,powerful', cuisine: 'french', cheese_pairing: 'Ossau-Iraty, Brebis' },
    { id: 'beaujolais', name: 'Beaujolais', emoji: '🍷', description: 'Gamay fruité et gouleyant, à servir frais', tags: 'french,red,beaujolais,gamay,light,fruity', cuisine: 'french', cheese_pairing: 'Saint-Marcellin, Cervelle de Canut' },
    { id: 'chinon', name: 'Chinon', emoji: '🍷', description: 'Cabernet Franc de Loire, notes de violette', tags: 'french,red,loire,cabernet_franc,elegant', cuisine: 'french', cheese_pairing: 'Sainte-Maure, Valençay' },

    // RED WINES - INTERNATIONAL
    { id: 'chianti', name: 'Chianti Classico', emoji: '🍷', description: 'Sangiovese toscan, cerise et épices', tags: 'italian,red,tuscany,sangiovese,classic', cuisine: 'italian', cheese_pairing: 'Pecorino, Parmigiano' },
    { id: 'barolo', name: 'Barolo', emoji: '🍷', description: 'Roi des vins italiens, Nebbiolo noble', tags: 'italian,red,piedmont,nebbiolo,premium,aged', cuisine: 'italian', cheese_pairing: 'Gorgonzola, Castelmagno' },
    { id: 'rioja', name: 'Rioja Reserva', emoji: '🍷', description: 'Tempranillo espagnol, élevage en barrique', tags: 'spanish,red,rioja,tempranillo,aged', cuisine: 'spanish', cheese_pairing: 'Manchego, Idiazábal' },
    { id: 'malbec', name: 'Malbec argentin', emoji: '🍷', description: 'Malbec fruité et rond de Mendoza', tags: 'argentinian,red,mendoza,malbec,fruity', cuisine: 'argentinian', cheese_pairing: 'Gouda, Mimolette' },
    { id: 'pinot_noir', name: 'Pinot Noir', emoji: '🍷', description: 'Cépage noble, fruits rouges et finesse', tags: 'international,red,pinot_noir,elegant,light', cuisine: 'international', cheese_pairing: 'Brie, Camembert' },

    // WHITE WINES - BOURGOGNE
    { id: 'bourgogne_blanc', name: 'Bourgogne blanc', emoji: '🥂', description: 'Chardonnay fin, notes beurrées et minérales', tags: 'french,white,burgundy,chardonnay,elegant', cuisine: 'french', cheese_pairing: 'Comté jeune, Beaufort' },
    { id: 'chablis', name: 'Chablis', emoji: '🥂', description: 'Chardonnay minéral et vif, iodé', tags: 'french,white,burgundy,chardonnay,mineral,dry', cuisine: 'french', cheese_pairing: 'Huîtres, Époisses jeune' },
    { id: 'meursault', name: 'Meursault', emoji: '🥂', description: 'Grand Chardonnay, onctueux et complexe', tags: 'french,white,burgundy,chardonnay,premium,rich', cuisine: 'french', cheese_pairing: 'Comté 24 mois, Beaufort' },
    { id: 'pouilly_fuisse', name: 'Pouilly-Fuissé', emoji: '🥂', description: 'Chardonnay du Mâconnais, fruité et élégant', tags: 'french,white,burgundy,chardonnay,fruity', cuisine: 'french', cheese_pairing: 'Mâconnais, Charolais' },

    // WHITE WINES - LOIRE
    { id: 'sancerre', name: 'Sancerre', emoji: '🥂', description: 'Sauvignon Blanc vif, agrumes et silex', tags: 'french,white,loire,sauvignon,mineral,dry', cuisine: 'french', cheese_pairing: 'Crottin de Chavignol' },
    { id: 'muscadet', name: 'Muscadet', emoji: '🥂', description: 'Vin sec et léger, parfait avec fruits de mer', tags: 'french,white,loire,melon,light,dry', cuisine: 'french', cheese_pairing: 'Curé Nantais' },
    { id: 'vouvray', name: 'Vouvray', emoji: '🥂', description: 'Chenin Blanc, sec à moelleux, notes de miel', tags: 'french,white,loire,chenin,versatile', cuisine: 'french', cheese_pairing: 'Sainte-Maure, Valençay' },
    { id: 'pouilly_fume', name: 'Pouilly-Fumé', emoji: '🥂', description: 'Sauvignon de la Loire, fumé et minéral', tags: 'french,white,loire,sauvignon,mineral,dry', cuisine: 'french', cheese_pairing: 'Crottin, Selles-sur-Cher' },

    // WHITE WINES - ALSACE
    { id: 'riesling', name: 'Riesling d\'Alsace', emoji: '🥂', description: 'Vin sec et minéral, agrumes et pétrole', tags: 'french,white,alsace,riesling,dry,mineral', cuisine: 'french', cheese_pairing: 'Munster' },
    { id: 'gewurztraminer', name: 'Gewurztraminer', emoji: '🥂', description: 'Vin aromatique, litchi et rose', tags: 'french,white,alsace,gewurztraminer,aromatic', cuisine: 'french', cheese_pairing: 'Munster, Roquefort' },
    { id: 'pinot_gris', name: 'Pinot Gris d\'Alsace', emoji: '🥂', description: 'Vin riche et épicé, notes fumées', tags: 'french,white,alsace,pinot_gris,rich', cuisine: 'french', cheese_pairing: 'Maroilles, Munster' },

    // WHITE WINES - INTERNATIONAL
    { id: 'sauvignon_blanc', name: 'Sauvignon Blanc', emoji: '🥂', description: 'Vin frais et vif, agrumes et herbes', tags: 'international,white,sauvignon,fresh,dry', cuisine: 'international', cheese_pairing: 'Chèvre frais, Feta' },
    { id: 'pinot_grigio', name: 'Pinot Grigio', emoji: '🥂', description: 'Vin italien léger et frais', tags: 'italian,white,pinot_grigio,light,dry', cuisine: 'italian', cheese_pairing: 'Mozzarella, Burrata' },
    { id: 'albarino', name: 'Albariño', emoji: '🥂', description: 'Vin espagnol de Galice, salin et fruité', tags: 'spanish,white,albarino,fresh,mineral', cuisine: 'spanish', cheese_pairing: 'Tetilla, Arzúa' },

    // ROSÉ WINES
    { id: 'provence_rose', name: 'Côtes de Provence rosé', emoji: '🌸', description: 'Rosé élégant, pêche et agrumes', tags: 'french,rose,provence,dry,elegant', cuisine: 'french', cheese_pairing: 'Banon, Brousse', season: 'summer' },
    { id: 'tavel', name: 'Tavel', emoji: '🌸', description: 'Rosé de gastronomie, puissant et vineux', tags: 'french,rose,rhone,powerful,gastronomic', cuisine: 'french', cheese_pairing: 'Picodon, Pélardon', season: 'summer' },
    { id: 'bandol_rose', name: 'Bandol rosé', emoji: '🌸', description: 'Rosé structuré, Mourvèdre dominant', tags: 'french,rose,provence,structured,premium', cuisine: 'french', cheese_pairing: 'Brousse, Tomme', season: 'summer' },

    // SWEET WINES
    { id: 'sauternes', name: 'Sauternes', emoji: '🍯', description: 'Grand vin liquoreux, botrytis noble', tags: 'french,sweet,bordeaux,botrytis,premium', cuisine: 'french', cheese_pairing: 'Roquefort, Foie gras' },
    { id: 'banyuls', name: 'Banyuls', emoji: '🍯', description: 'Vin doux naturel, chocolat et fruits noirs', tags: 'french,sweet,roussillon,vdn,chocolate', cuisine: 'french', cheese_pairing: 'Roquefort, Chocolat noir' },
    { id: 'muscat', name: 'Muscat de Beaumes-de-Venise', emoji: '🍯', description: 'Vin doux musqué, floral et fruité', tags: 'french,sweet,rhone,muscat,aromatic', cuisine: 'french', cheese_pairing: 'Fourme d\'Ambert, Fruits' },
    { id: 'porto', name: 'Porto', emoji: '🍯', description: 'Vin muté portugais, ruby ou tawny', tags: 'portuguese,sweet,porto,fortified', cuisine: 'portuguese', cheese_pairing: 'Stilton, Roquefort' },

    // SPARKLING WINES
    { id: 'champagne', name: 'Champagne', emoji: '🍾', description: 'Vin effervescent de prestige, finesse et bulles', tags: 'french,sparkling,champagne,premium,celebration', cuisine: 'french', cheese_pairing: 'Chaource, Langres' },
    { id: 'cremant', name: 'Crémant', emoji: '🍾', description: 'Effervescent méthode traditionnelle', tags: 'french,sparkling,cremant,festive', cuisine: 'french', cheese_pairing: 'Brie, Comté jeune' },
    { id: 'prosecco', name: 'Prosecco', emoji: '🍾', description: 'Effervescent italien, frais et fruité', tags: 'italian,sparkling,prosecco,fresh,aperitif', cuisine: 'italian', cheese_pairing: 'Burrata, Asiago' },
    { id: 'cava', name: 'Cava', emoji: '🍾', description: 'Effervescent espagnol, rapport qualité-prix', tags: 'spanish,sparkling,cava,festive', cuisine: 'spanish', cheese_pairing: 'Manchego, Mahón' },
];

// Insert cheeses
for (const c of cheeses) {
    insertMeal.run(
        c.id, 'cheese', c.name, c.emoji, c.description, c.tags, c.cuisine || 'french',
        0, 0, 1, 'medium', c.calories || 350, 1, c.wine_pairing || null, null,
        c.season || 'all', 1, 0, 1,
        JSON.stringify({ steps: ['Sortir le fromage 1h avant dégustation', 'Servir à température ambiante', 'Accompagner de pain frais'] }),
        JSON.stringify([{ name: c.name, qty: '200g', cat: 'fromage' }])
    );
}

// Insert wines
for (const w of wines) {
    insertMeal.run(
        w.id, 'wine', w.name, w.emoji, w.description, w.tags, w.cuisine || 'french',
        0, 0, 1, 'medium', 80, 1, null, w.cheese_pairing || null,
        w.season || 'all', 1, 1, 1,
        JSON.stringify({ steps: ['Servir à la bonne température', 'Carafer si nécessaire', 'Déguster avec modération'] }),
        JSON.stringify([{ name: w.name, qty: '75cl', cat: 'vin' }])
    );
}

console.log(`✅ ${cheeses.length} cheeses inserted`);
console.log(`✅ ${wines.length} wines inserted`);

db.close();
console.log('🎉 All meals seeded successfully!');
