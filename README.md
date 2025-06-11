# Système de Scoring Lighthouse Multi-API

Ce système permet d'analyser en masse les performances web de sites en utilisant l'API Google PageSpeed Insights avec plusieurs clés API en parallèle.

## 🚀 Fonctionnalités

- Analyse des performances mobiles et SEO via Lighthouse
- Support des métriques CrUX (Core Web Vitals)
- Traitement parallèle avec 3 clés API
- Sauvegardes automatiques tous les 100 traitements
- Gestion robuste des erreurs
- Fusion automatique des résultats

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

Le système utilise 3 clés API Google PageSpeed Insights :
- `AIzaSyD0u3W7oJ_CjsZ9pTrdiXcBXrVgTHoyViU`
- `AIzaSyAUFbNE3eaj_KOG3K-3UEEbtiMziKOoChc`
- `AIzaSyD003NPDofDbJH1qLEqwEOSfQk8ZJBde10`

## 📊 Utilisation

### Format du fichier d'entrée

Le fichier CSV d'entrée doit contenir une colonne `Website` avec les URLs à analyser.

### Lancer l'analyse

```bash
node master_script.js leads.csv
```

Le script va :
1. Diviser le fichier en 3 parties
2. Lancer 3 instances en parallèle
3. Générer un fichier `leads_results.csv`

### Options du script principal (score_lighthouse.js)

```bash
node score_lighthouse.js --input <fichier> --output <fichier> --api-key <clé> [options]

Options :
  --input, -i     Fichier CSV d'entrée (obligatoire)
  --output, -o    Fichier CSV de sortie (obligatoire)
  --api-key       Clé API Google (obligatoire)
  --crux          Activer l'analyse CrUX
  --concurrency   Nombre de requêtes simultanées (défaut: 4)
```

## 📈 Métriques analysées

### Lighthouse
- Performance mobile (score 0-100)
- SEO mobile (score 0-100)

### Core Web Vitals (si --crux activé)
- LCP (Largest Contentful Paint)
- CLS (Cumulative Layout Shift)
- INP (Interaction to Next Paint)

## 💾 Sauvegardes

- Sauvegardes automatiques tous les 100 traitements
- Format : `results_backup_XXX.csv`
- En cas d'erreur, le script tente de sauvegarder l'état actuel

## ⚠️ Limitations

- Maximum 4 requêtes par seconde par clé API
- Les URLs doivent être valides et accessibles
- Format CSV requis pour l'entrée/sortie

## 🔍 Détails techniques

### Structure des fichiers
- `master_script.js` : Script principal de distribution
- `score_lighthouse.js` : Script d'analyse individuel
- Fichiers temporaires : `temp_input_X.csv`, `temp_output_X.csv`

### Gestion des erreurs
- Logs détaillés pour chaque instance
- Sauvegardes automatiques
- Nettoyage des fichiers temporaires

## 📝 Exemple de sortie

```csv
Website,psi_mobile_score,psi_seo_score,lcp_p75_ms,cls_p75,inp_p75_ms,custom_hook
https://example.com,85,90,1200,0.1,200,""
https://slow-site.com,45,75,3500,0.3,450,"Google évalue votre site mobile à seulement 45/100 de performance..."
```

## 🔄 Reprise après erreur

En cas d'erreur :
1. Le script crée une sauvegarde de l'état actuel
2. Les fichiers temporaires sont conservés
3. Relancer le script avec le dernier fichier de sauvegarde

## 📊 Monitoring

Les logs incluent :
- Progression en temps réel
- Erreurs détaillées
- Statistiques de traitement
- État des sauvegardes

# Script de Division de Fichier CSV

Ce script permet de diviser un fichier CSV volumineux en plusieurs fichiers plus petits, tout en conservant les en-têtes dans chaque fichier.

## Prérequis

- Node.js installé sur votre système
- Les dépendances npm installées

## Installation

1. Installez les dépendances nécessaires :
```bash
npm install
```

## Utilisation

1. Placez votre fichier CSV à diviser (nommé `leadsFull.csv`) dans le même dossier que le script
2. Exécutez le script :
```bash
node split_csv.js
```

## Fonctionnement

Le script va :
- Lire le fichier `leadsFull.csv`
- Créer un dossier `output`
- Diviser le fichier en morceaux de 600 lignes
- Générer des fichiers `leads1.csv`, `leads2.csv`, etc. dans le dossier `output`
- Conserver les en-têtes du fichier original dans chaque nouveau fichier

## Personnalisation

Si vous souhaitez modifier la taille des morceaux, vous pouvez modifier la constante `CHUNK_SIZE` dans le fichier `split_csv.js` (par défaut : 600 lignes). 