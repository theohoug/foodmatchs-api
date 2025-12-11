# FoodMatchs 🍽️

Application de recommandation de menus personnalisés avec système de gamification.

## Déploiement

### Backend (Railway)

1. Crée un repo GitHub avec le contenu du dossier `backend/`
2. Va sur [railway.app](https://railway.app) et connecte ton GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Sélectionne ton repo
5. Railway détecte automatiquement Node.js
6. Dans Settings → ajoute la variable d'environnement :
   - `JWT_SECRET` = (génère un truc random, ex: `monSuperSecret123!`)
7. Une fois déployé, récupère l'URL (ex: `https://fim-app-production.up.railway.app`)

### Frontend (Netlify)

1. Dans `app.js`, change l'URL :
   ```javascript
   const API_URL = 'https://TON-URL-RAILWAY.up.railway.app/api';
   ```
2. Déploie le dossier `frontend/` sur Netlify

### Initialisation de la base de données

Après le premier déploiement sur Railway, lance dans le terminal Railway :
```bash
npm run setup
```

Cela crée toutes les tables et ajoute les 274 recettes, 50 questions, 24 profils et 30 achievements.

## Structure

```
backend/
├── server.js          # Point d'entrée
├── setup.js           # Script d'init DB
├── database/
│   ├── schema.sql     # Structure tables
│   ├── init.js        # Création DB
│   └── seed-*.js      # Données
├── routes/            # 9 modules API
└── middleware/        # Auth JWT

frontend/
├── index.html
├── styles.css
└── app.js
```

## API Endpoints

- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil utilisateur
- `GET /api/quiz/questions` - Questions quiz
- `POST /api/quiz/submit` - Soumettre réponses
- `POST /api/quiz/daily` - Générer menu du jour
- `GET /api/meals` - Liste recettes
- `GET /api/meals/:id` - Détail recette
- `GET /api/fridge` - Contenu frigo
- `POST /api/fridge` - Ajouter ingrédient
- `GET /api/gamification/stats` - Stats joueur
- ... et plein d'autres !

## Tech Stack

- **Backend**: Node.js, Express, SQLite, JWT
- **Frontend**: Vanilla JS, CSS moderne
- **Hébergement**: Railway (API) + Netlify (frontend)
