# Système de Scoring Multi-API

Ce système permet d'analyser en masse les performances web et la validité des emails en utilisant plusieurs API en parallèle.

## 🎯 Objectif du Projet

Le système est composé d'un script principal qui orchestre quatre scripts spécialisés :

1. **Script Principal** (`master_script.js`)
2. **Vérification d'emails** (`mail_verifier.js`)
3. **Analyse des performances** (`score_lighthouse.js`)
4. **Génération de hooks** (`changement_hook.js`)
5. **Division des données** (`split_csv.js`)

## 📋 Description des Scripts

### 1. Script Principal (`master_script.js`)
- Orchestre l'exécution des différents scripts
- Gère le traitement parallèle avec 3 clés API pour chaque service
- Fonctionnalités :
  - Exécution parallèle de verifier et lighthouse
  - Fusion des résultats
  - Filtrage des emails valides
  - Génération des hooks personnalisés
- Modes d'exécution :
  ```bash
  node master_script.js [hook|verifier|lighthouse|split|all]
  ```

### 2. Vérification d'Emails (`mail_verifier.js`)
- Vérifie la validité des adresses email
- Utilise 3 clés API Million Verifier en parallèle
- Génère un score de validité pour chaque email
- Filtre les emails invalides

### 3. Analyse des Performances (`score_lighthouse.js`)
- Analyse les performances web via Google PageSpeed Insights
- Utilise 3 clés API Lighthouse en parallèle
- Métriques analysées :
  - Performance mobile
  - SEO
  - Core Web Vitals (LCP, CLS, INP)
- Options configurables :
  ```bash
  node score_lighthouse.js --input <fichier> --output <fichier> [--crux] [--concurrency <nombre>]
  ```

### 4. Génération de Hooks (`changement_hook.js`)
- Génère des messages personnalisés basés sur les scores
- Analyse les métriques suivantes :
  - Performance mobile (PSI)
  - SEO
  - Core Web Vitals (LCP, CLS, INP)
- Seuils de performance :
  - Performance mobile : Poor < 49, NI < 89
  - SEO : Poor < 79, NI < 89
  - LCP : Poor > 4000ms, NI > 2500ms
  - INP : Poor > 500ms, NI > 200ms
  - CLS : Poor > 0.25, NI > 0.1

### 5. Division des Données (`split_csv.js`)
- Divise les fichiers CSV volumineux
- Crée des morceaux de 600 lignes
- Conserve les en-têtes
- Génère des fichiers numérotés

## 🚀 Fonctionnalités Principales

- Traitement parallèle avec 3 clés API par service
- Vérification d'emails en masse
- Analyse complète des performances web
- Génération de hooks personnalisés
- Fusion et filtrage automatique des résultats
- Sauvegardes automatiques
- Gestion robuste des erreurs

## 📋 Prérequis

- Node.js (v14 ou supérieur)
- Les dépendances npm listées dans `package.json`

## 📦 Installation

1. Cloner le repository
2. Installer les dépendances :
```bash
npm install
```

## 🔑 Configuration des Clés API

Le système utilise deux ensembles de clés API :

### Lighthouse API
```env
API_LIGHTHOUSE1=votre_clé_1
API_LIGHTHOUSE2=votre_clé_2
API_LIGHTHOUSE3=votre_clé_3
```

### Million Verifier API
```env
API_MILLION_VERIFIER1=votre_clé_1
API_MILLION_VERIFIER2=votre_clé_2
API_MILLION_VERIFIER3=votre_clé_3
```

## 📝 Utilisation

### Format du fichier d'entrée
Le fichier CSV d'entrée doit contenir :
- Une colonne `Website` avec les URLs à analyser
- Une colonne `Email` avec les adresses à vérifier

### Lancer l'analyse complète
```bash
node master_script.js all
```

### Lancer un script spécifique
```bash
node master_script.js [hook|verifier|lighthouse|split]
```

## 📊 Exemple de sortie

```csv
Website,Email,Email_note,psi_mobile_score,psi_seo_score,lcp_p75_ms,cls_p75,inp_p75_ms,custom_hook
https://example.com,contact@example.com,Good,85,90,1200,0.1,200,""
https://slow-site.com,info@slow-site.com,Good,45,75,3500,0.3,450,"Google évalue votre site mobile à seulement 45/100 de performance..."
```

## ⚠️ Limitations

- Maximum 4 requêtes par seconde par clé API
- Les URLs doivent être valides et accessibles
- Format CSV requis pour l'entrée/sortie
- Nécessite des clés API valides pour chaque service
