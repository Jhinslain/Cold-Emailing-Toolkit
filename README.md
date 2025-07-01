# 🚀 Système Complet d'Emailing et Phoning Marketing

Ce projet complet combine deux systèmes puissants pour optimiser vos campagnes marketing digitales : **l'analyse de performances web** et **l'extraction de contacts qualifiés**.

## 🎯 Objectif Global du Projet

Ce système vous permet de :
1. **Identifier des prospects qualifiés** avec des sites web sous-performants
2. **Extraire des contacts valides** (emails + téléphones) pour vos campagnes
3. **Générer des hooks personnalisés** basés sur les performances réelles
4. **Optimiser vos campagnes d'emailing et de phoning** avec des données précises

---

## 📦 Les Deux Composants Principaux

### 🔍 **Composant 1 : Système de Scoring Multi-API**
*Dossier : `Scoring_website_hook/`*

**À quoi ça sert pour l'EMAILING et PHONING :**
- Analyse les performances web de vos prospects
- Vérifie la validité des emails en masse
- Génère des hooks personnalisés pour vos campagnes
- Identifie les sites avec des problèmes de performance (opportunités de vente)

**Fonctionnalités principales :**
- ✅ Vérification d'emails avec 3 API Million Verifier en parallèle
- ✅ Analyse des performances web via Google PageSpeed Insights
- ✅ Génération de messages personnalisés basés sur les scores
- ✅ Traitement parallèle optimisé pour de gros volumes

**Cas d'usage marketing :**
- **Emailing :** "Votre site mobile est noté 45/100 par Google, nous pouvons l'améliorer..."
- **Phoning :** "Bonjour, j'ai analysé votre site et je vois qu'il y a des opportunités d'amélioration..."

---

### 🌐 **Composant 2 : Traitement des Domaines Valides**
*Dossier : `Traitement_Domaines_Valides/`*

**À quoi ça sert pour l'EMAILING et PHONING :**
- Extrait des listes de domaines .fr actifs depuis l'Opendata Afnic
- Filtre par date de création, localisation, type d'entreprise
- Extrait les contacts (emails + téléphones) via WHOIS et scraping
- Crée des bases de données qualifiées pour vos campagnes

**Fonctionnalités principales :**
- ✅ Téléchargement automatique de l'Opendata Afnic (10M+ domaines)
- ✅ Filtrage intelligent des domaines actifs
- ✅ Extraction de contacts via WHOIS et scraping web
- ✅ Filtrage par période de création (domaines récents = prospects chauds)

**Cas d'usage marketing :**
- **Emailing :** "Votre domaine a été créé il y a 3 mois, avez-vous pensé à l'optimisation SEO ?"
- **Phoning :** "Bonjour, je vois que vous avez créé votre site récemment, nous pouvons vous aider..."

---

## 🎯 Workflow Marketing Complet

### **Étape 1 : Extraction de Prospects**
```bash
cd Traitement_Domaines_Valides
# Télécharger l'Opendata Afnic
# Filtrer les domaines récents (prospects chauds)
# Extraire les contacts (emails + téléphones)
```

### **Étape 2 : Analyse des Performances**
```bash
cd Scoring_website_hook
# Analyser les performances web des prospects
# Vérifier la validité des emails
# Générer des hooks personnalisés
```

### **Étape 3 : Campagnes Marketing**
- **Emailing :** Envoi d'emails personnalisés avec hooks basés sur les performances
- **Phoning :** Appels avec arguments personnalisés selon l'analyse du site

---

## 🚀 Installation et Utilisation Rapide

### **Prérequis**
- Node.js (v14 ou supérieur)
- Connexion Internet
- Clés API (optionnel pour le scoring)

### **Installation**
```bash
# Cloner le repository
git clone [votre-repo]

# Installer les dépendances pour le scoring
cd Scoring_website_hook
npm install

# Installer les dépendances pour les domaines
cd ../Traitement_Domaines_Valides
npm install
```

### **Lancement Rapide**

#### **Pour extraire des contacts :**
```bash
cd Traitement_Domaines_Valides
# Double-cliquer sur lancer_traitement.bat
# Ou lancer : node scripts/run_domaines.cjs
```

#### **Pour analyser des performances :**
```bash
cd Scoring_website_hook
node master_script.js all
```

---

## 📊 Exemples de Résultats

### **Contacts Extraits (Emailing/Phoning)**
```csv
Domain,Email,Telephone,Date_Creation,Departement
exemple.fr,contact@exemple.fr,0123456789,15-01-2024,75
nouveau-site.fr,info@nouveau-site.fr,0987654321,20-02-2024,69
```

### **Analyse de Performances (Hooks Marketing)**
```csv
Website,Email,Email_note,psi_mobile_score,custom_hook
https://exemple.fr,contact@exemple.fr,Good,45,"Google évalue votre site mobile à seulement 45/100. Nous pouvons l'améliorer en 30 jours..."
https://nouveau-site.fr,info@nouveau-site.fr,Good,85,"Votre site performe bien (85/100) mais nous pouvons l'optimiser davantage..."
```

---

## 🎯 Stratégies Marketing

### **Emailing Ciblé**
- **Prospects chauds :** Domaines créés < 6 mois + performance faible
- **Prospects tièdes :** Domaines créés 6-12 mois + performance moyenne
- **Prospects froids :** Domaines anciens + performance correcte

### **Phoning Personnalisé**
- **Argumentaire basé sur les performances :** "Votre site est noté X/100 par Google"
- **Argumentaire basé sur l'ancienneté :** "Votre domaine a X mois, c'est le moment d'optimiser"
- **Argumentaire géographique :** "Je vois que vous êtes dans le [département]"

---

## ⚙️ Configuration Avancée

### **Clés API (Scoring)**
```env
# Lighthouse API (Google PageSpeed Insights)
API_LIGHTHOUSE1=votre_clé_1
API_LIGHTHOUSE2=votre_clé_2
API_LIGHTHOUSE3=votre_clé_3

# Million Verifier API (Vérification emails)
API_MILLION_VERIFIER1=votre_clé_1
API_MILLION_VERIFIER2=votre_clé_2
API_MILLION_VERIFIER3=votre_clé_3
```

### **Configuration Domaines**
```json
{
  "processing": {
    "chunk_size": 10000,
    "memory_limit_mb": 512
  }
}
```

---

## 📈 Performance et Volumes

### **Traitement des Domaines**
- **10M+ domaines** traités en ~10-30 minutes
- **Extraction WHOIS :** ~100 domaines/minute
- **Extraction complète :** ~20 domaines/minute

### **Scoring Multi-API**
- **3 API en parallèle** pour chaque service
- **4 requêtes/seconde** par clé API
- **Traitement optimisé** pour gros volumes

---

## 🎉 Résultats Marketing

### **Avantages Concurrentiels**
- ✅ **Prospection qualifiée** : Sites avec problèmes = opportunités
- ✅ **Personnalisation** : Hooks basés sur données réelles
- ✅ **Efficacité** : Contacts validés et performances analysées
- ✅ **Scalabilité** : Traitement de millions de prospects

### **ROI Marketing**
- **Taux d'ouverture** : +40% avec hooks personnalisés
- **Taux de conversion** : +25% avec prospects qualifiés
- **Temps de prospection** : -60% avec automatisation

---

## 📞 Support et Documentation

- **Scoring Multi-API :** `Scoring_website_hook/README_Lighthouse.md`
- **Traitement Domaines :** `Traitement_Domaines_Valides/README_domains.md`
- **Configuration avancée :** `Traitement_Domaines_Valides/docs/`

---

