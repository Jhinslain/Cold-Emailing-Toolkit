# Application Fullstack React + Express

## 🚀 Déploiement complet sur AWS EC2

### 📝 Historique des tâches réalisées

1. **Création et configuration du serveur AWS**
   - Création d’une instance EC2 Ubuntu sur AWS
   - Génération et gestion d’une clé SSH pour se connecter au serveur
   - Ouverture des ports nécessaires (22, 80, 443, 3001) dans le groupe de sécurité AWS
   - Connexion SSH à l’instance EC2

2. **Installation de l’environnement serveur**
   - Installation de Docker, Docker Compose, Node.js, npm et utilitaires
   - Nettoyage et gestion de l’espace disque

3. **Déploiement de l’application**
   - Transfert du dossier `fullstack-app` sur le serveur (sans les dossiers `node_modules`)
   - Installation des dépendances backend et frontend avec `npm install`
   - Construction et lancement de l’application avec Docker Compose
   - Résolution des problèmes de build Docker (ex : installation de curl dans le conteneur)

4. **Configuration du backend et du frontend**
   - Backend modifié pour écouter sur `0.0.0.0` (et non `localhost`)
   - Mise en place de la variable d’environnement `VITE_API_URL` dans le frontend pour différencier dev/prod
   - Modification de tous les appels API dans le frontend pour utiliser cette variable

5. **Mise en ligne et accès**
   - Vérification de l’accessibilité du backend et du frontend
   - Résolution des problèmes de connexion (CORS, localhost, etc.)

6. **Mise en place d’un sous-domaine**
   - Création du sous-domaine `domains.majoli.io` chez IONOS
   - Ajout d’un enregistrement DNS de type A pointant vers l’IP du serveur AWS
   - Configuration de Nginx pour servir l’application sur ce sous-domaine

7. **Activation du HTTPS**
   - Installation et configuration de Certbot (Let’s Encrypt) pour obtenir un certificat SSL gratuit
   - Activation du HTTPS sur `domains.majoli.io` via Nginx
   - Test d’accès sécurisé à l’application via https://domains.majoli.io

---


## 💻 Commandes utiles AWS/EC2

### Connexion SSH
```bash
ssh -i "C:\Users\levre\Documents\domainMajoli.pem" ubuntu@13.60.29.161
```

### Transfert du projet (méthode recommandée avec exclusions)
```bash
# Créer une archive tar en excluant les node_modules et data spécifiques
tar --exclude='fullstack-app/backend/node_modules' --exclude='fullstack-app/backend/data' --exclude='fullstack-app/frontend/node_modules' --exclude='fullstack-app/temp' --exclude='fullstack-app/.git' -czf fullstack-app-clean.tar.gz -C "C:\Users\levre\Majoli\Marketing\SCRIPTS EMAILING PHONING" fullstack-app

# Transférer l'archive
scp -i "C:\Users\levre\Documents\domainMajoli.pem" fullstack-app-clean.tar.gz ubuntu@13.60.29.161:~/

# Sur le serveur, extraire l'archive
ssh -i "C:\Users\levre\Documents\domainMajoli.pem" ubuntu@13.60.29.161 "cd ~ && tar -xzf fullstack-app-clean.tar.gz"
```

### Transfert du projet (méthode simple - inclut tout)
```bash
scp -i "C:\Users\levre\Documents\domainMajoli.pem" -r "C:\Users\levre\Majoli\Marketing\SCRIPTS EMAILING PHONING\fullstack-app" ubuntu@13.60.29.161:~/
```

### Installation des dépendances (sur le serveur)
```bash
cd ~/fullstack-app/backend && npm install
cd ~/fullstack-app/frontend && npm install
```

### Docker Compose (build & lancement)
```bash
cd ~/fullstack-app
sudo docker-compose down
sudo docker-compose build --no-cache
sudo docker-compose up -d
sudo docker-compose ps
```

### Logs Docker
```bash
sudo docker-compose logs -f
```

// ... existing code ...

### Vérification de l’espace disque

```bash
watch -n 2 df -h
df -h
```

### Nettoyage Docker (si besoin d’espace)
```bash
sudo docker system prune -a
sudo docker volume prune -f
```

```bash
sudo rm -rf ~/.local/share/Trash/*
sudo rm -rf /tmp/*
```


```bash
cat /etc/nginx/sites-available/domain-processor
```

### Configuration Nginx (extrait)
- Fichier : `/etc/nginx/sites-available/domain-processor`
- Redirection HTTP → HTTPS et proxy vers le backend

### Activation HTTPS avec Certbot
```bash
sudo certbot --nginx -d domains.majoli.io
```

---

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