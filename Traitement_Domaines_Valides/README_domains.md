# 🌐 Package de Traitement des Domaines Valides

## 📦 Description

Ce package complet permet de traiter, filtrer et enrichir des listes de domaines .fr en utilisant les données Opendata de l'Afnic. Il offre 8 fonctionnalités principales pour analyser et extraire des informations marketing précieuses.

**Optimisé pour traiter efficacement 10+ millions de lignes sans saturer votre ordinateur.**

## 🚀 Installation et Utilisation

### Prérequis
- Node.js (version 14.0.0 ou supérieure)
- Connexion Internet (pour télécharger l'Opendata et les requêtes WHOIS)

### Installation rapide

1. **Téléchargez** ce dossier complet
2. **Lancez** le traitement :

#### Option 1 : Interface graphique (Recommandé)
```
Double-cliquez sur lancer_traitement.bat
```

#### Option 2 : PowerShell
```
Double-cliquez sur lancer_traitement.ps1
```

#### Option 3 : Ligne de commande
```bash
cd Traitement_Domaines_Valides
node scripts/run_domaines.cjs
```

## 🎯 Les 8 Options Disponibles

### 0. 📥 Télécharger l'Opendata Afnic et l'extraire
**Fonction :** Télécharge automatiquement le dernier fichier Opendata de l'Afnic (mois précédent) et l'extrait dans le dossier `data/`.

**Ce que ça fait :**
- Télécharge le fichier ZIP depuis le serveur Afnic
- Extrait automatiquement le CSV contenant tous les domaines .fr
- Affiche les statistiques (taille, nombre de lignes)
- Prépare les données pour les traitements suivants

**Résultat :** Fichier `data/data_extrait.csv` prêt pour traitement

---

### 1. 🧪 Test rapide (1000 lignes)
**Fonction :** Teste le processus de filtrage sur un échantillon de 1000 domaines pour valider la configuration.

**Ce que ça fait :**
- Lit les 1000 premières lignes du fichier d'entrée
- Filtre les domaines avec une date de retrait WHOIS
- Valide la configuration et les performances
- Génère un rapport de test

**Résultat :** Fichier `output/test_domaines_valides.csv` avec les domaines valides

---

### 2. 🚀 Traitement complet (tous les domaines)
**Fonction :** Traite l'intégralité du fichier pour filtrer tous les domaines actifs.

**Ce que ça fait :**
- Lit le fichier complet par chunks pour optimiser la mémoire
- Supprime tous les domaines avec une date de retrait WHOIS
- Affiche la progression en temps réel
- Optimisé pour les gros fichiers (10M+ lignes)

**Résultat :** Fichier `output/domaines_valides.csv` avec tous les domaines actifs

---

### 3. ⚙️ Traitement avancé (avec configuration)
**Fonction :** Traitement personnalisé avec paramètres configurables (taille des chunks, limite mémoire).

**Ce que ça fait :**
- Utilise les paramètres de `config/config_domaines.json`
- Permet d'ajuster les performances selon votre machine
- Traitement optimisé selon vos ressources
- Contrôle fin de la mémoire utilisée

**Résultat :** Même résultat que l'option 2 mais avec configuration personnalisée

---

### 4. 📊 Lancement de l'analyse détaillée
**Fonction :** Analyse statistique complète du fichier de domaines.

**Ce que ça fait :**
- Compte les domaines par département, ville, type de titulaire
- Analyse les dates de création et de retrait
- Génère des statistiques détaillées
- Crée des rapports d'analyse

**Résultat :** Rapport d'analyse dans `docs/analyse_YYYY-MM-DD.txt`

---

### 5. 📅 Filtrer par date d'achat
**Fonction :** Filtre les domaines selon une période de création spécifique.

**Ce que ça fait :**
- Demande deux dates (format DD-MM-YYYY)
- Filtre les domaines créés entre ces deux dates
- Permet de cibler des domaines récents ou anciens
- Utile pour le marketing ciblé

**Résultat :** Fichier `output/domaines_filtres_date.csv` avec les domaines de la période

---

### 6. 🔍 Extraction emails + numéros [WHOIS]
**Fonction :** Extrait les informations de contact depuis les données WHOIS uniquement.

**Ce que ça fait :**
- Utilise le fichier filtré par date (option 5)
- Interroge les serveurs WHOIS pour chaque domaine
- Extrait emails et numéros de téléphone
- Pas de scraping de sites web (plus rapide)

**Résultat :** Fichier `output/domaines_filtres_whois_only.csv` avec contacts WHOIS

---

### 7. 🌐 Extraction emails + numéros [WHOIS + Scrap]
**Fonction :** Extraction complète avec WHOIS + scraping des sites web.

**Ce que ça fait :**
- Utilise le fichier filtré par date (option 5)
- Interroge les serveurs WHOIS
- Scrape les sites web pour trouver plus de contacts
- Extraction maximale mais plus lente

**Résultat :** Fichier `output/domaines_filtres_whois_scrap.csv` avec tous les contacts trouvés

---

## 📁 Structure du Package

```
Traitement_Domaines_Valides/
├── 📁 scripts/                    # Scripts de traitement
│   ├── run_domaines.cjs          # Interface principale (8 options)
│   ├── test_domain_valide.cjs    # Test rapide (option 1)
│   ├── domain_valide.cjs         # Traitement complet (option 2)
│   ├── domain_valide_advanced.cjs # Traitement configuré (option 3)
│   ├── analyze_file.cjs          # Analyse détaillée (option 4)
│   ├── filter_by_date.cjs        # Filtrage par date (option 5)
│   └── process_csv_domains.cjs   # Extraction contacts (options 6-7)
├── 📁 config/                     # Configuration
│   └── config_domaines.json      # Paramètres ajustables
├── 📁 data/                       # Données d'entrée
│   └── data_extrait.csv          # Fichier Opendata extrait
├── 📁 output/                     # Résultats
│   ├── domaines_valides.csv      # Domaines filtrés
│   ├── test_domaines_valides.csv # Résultat du test
│   ├── domaines_filtres_date.csv # Filtrage par date
│   ├── domaines_filtres_whois_only.csv # Contacts WHOIS
│   └── domaines_filtres_whois_scrap.csv # Contacts complets
├── 📁 docs/                       # Documentation
│   └── README_domaines_valides.md # Guide détaillé
├── 📁 temp/                       # Fichiers temporaires
├── lancer_traitement.bat         # Lanceur Windows
├── lancer_traitement.ps1         # Lanceur PowerShell
├── package.json                  # Configuration Node.js
└── README.md                     # Ce fichier
```

## 🎯 Workflow Recommandé

### Pour débuter :
1. **Option 0** : Télécharger l'Opendata Afnic
2. **Option 1** : Test rapide pour valider
3. **Option 2** : Traitement complet des domaines

### Pour l'extraction de contacts :
1. **Option 5** : Filtrer par période de création
2. **Option 6** : Extraction WHOIS (rapide)
3. **Option 7** : Extraction complète (si besoin de plus de contacts)

## ⚙️ Configuration

Modifiez `config/config_domaines.json` selon vos ressources :

**Machine avec peu de RAM (4GB) :**
```json
{
  "processing": {
    "chunk_size": 5000,
    "memory_limit_mb": 256
  }
}
```

**Machine performante (8GB+ RAM) :**
```json
{
  "processing": {
    "chunk_size": 20000,
    "memory_limit_mb": 1024
  }
}
```

## 📊 Format des données

### Fichier d'entrée (Opendata Afnic)
Format CSV avec délimiteur `;` :
```csv
"Nom de domaine";"Pays BE";"Departement BE";"Ville BE";"Nom BE";"Sous domaine";"Type du titulaire";"Pays titulaire";"Departement titulaire";"Domaine IDN";"Date de création";"Date de retrait du WHOIS"
exemple.fr;FR;75;PARIS;GANDI;fr;;;;0;28-01-2022;
exemple-invalide.fr;FR;75;PARIS;GANDI;fr;;;;0;30-06-2023;27-08-2024
```

### Fichiers de sortie
- **Domaines valides** : Même format, sans les domaines retirés
- **Contacts extraits** : Ajout des colonnes emails et téléphones

## 📈 Performance

**Estimations de temps selon votre machine :**

| Machine | Lignes/sec | Temps pour 10M lignes |
|---------|------------|----------------------|
| Basique (4GB RAM) | ~5,000 | ~33 minutes |
| Standard (8GB RAM) | ~10,000 | ~17 minutes |
| Performante (16GB+ RAM) | ~20,000 | ~8 minutes |

**Extraction de contacts :**
- WHOIS uniquement : ~100 domaines/minute
- WHOIS + Scrap : ~20 domaines/minute

## 🛠️ Dépannage

### Problème : "Out of memory"
**Solution :** Réduire `chunk_size` dans `config/config_domaines.json`

### Problème : Fichier non trouvé
**Vérifiez :** Le fichier `data/data_extrait.csv` existe (option 0)

### Problème : Erreurs de parsing
**Solution :** Vérifiez le format du CSV (délimiteur `;`)

### Problème : Extraction WHOIS bloquée
**Solution :** Vérifiez votre connexion Internet et les limites de rate

## 📞 Support

Pour plus de détails, consultez :
- `docs/README_domaines_valides.md` - Documentation complète
- `config/config_domaines.json` - Configuration avancée

## 🎉 Résultats

Le package génère plusieurs fichiers selon les options utilisées :
- **Domaines actifs** : Prêts pour vos analyses marketing
- **Contacts extraits** : Emails et téléphones pour prospection
- **Statistiques** : Analyses détaillées de vos données

---
