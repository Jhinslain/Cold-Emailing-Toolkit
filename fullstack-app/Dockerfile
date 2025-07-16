# Dockerfile pour l'application fullstack
FROM node:18-alpine

# Définir le répertoire de travail
WORKDIR /app

RUN apk add --no-cache curl

# Copier les fichiers de configuration
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Installer les dépendances
RUN npm run install-all

# Copier le code source
COPY . .

# Construire l'application frontend
RUN npm run build

# Exposer le port
EXPOSE 3001

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3001

# Créer les répertoires nécessaires
RUN mkdir -p /app/backend/data /app/backend/temp /app/backend/logs

# Script de démarrage
CMD ["npm", "start"] 