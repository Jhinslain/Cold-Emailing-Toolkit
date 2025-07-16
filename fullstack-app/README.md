# Application Fullstack React + Express

## 🚀 Installation et lancement

### 1. Installation des dépendances
```bash
# À la racine du projet
npm run install-all
```

### 2. Développement (hot reload)
```bash
# À la racine du projet
npm run dev
```
- Frontend : http://localhost:5173
- Backend : http://localhost:3001/api/hello

### 3. Production
```bash
# À la racine du projet
npm run start
```
- Application complète : http://localhost:3001

## 📁 Structure
```
fullstack-app/
├── backend/
│   ├── server.js          # Serveur Express
│   └── package.json       # Dépendances backend
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Composant principal
│   │   ├── main.jsx       # Point d'entrée React
│   │   └── index.css      # Styles Tailwind
│   ├── index.html         # Template HTML
│   ├── vite.config.js     # Config Vite
│   └── package.json       # Dépendances frontend
└── package.json           # Scripts globaux
```

## 🔧 Scripts disponibles
- `npm run dev` : Lance backend + frontend en développement
- `npm run build` : Build le frontend
- `npm run start` : Build + lance en production
- `npm run install-all` : Installe toutes les dépendances 