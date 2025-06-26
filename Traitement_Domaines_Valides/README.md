# 🌐 Package de Traitement des Domaines Valides

## 📦 Description

Ce package contient tous les scripts nécessaires pour traiter et filtrer une liste de domaines en supprimant ceux qui ont une date de retrait du WHOIS (indiquant qu'ils n'existent plus).

**Optimisé pour traiter efficacement 10+ millions de lignes sans saturer votre ordinateur.**

## 🚀 Installation et Utilisation

### Prérequis
- Node.js (version 14.0.0 ou supérieure)
- Votre fichier CSV de domaines

### Installation rapide

1. **Téléchargez** ce dossier complet
2. **Placez votre fichier CSV** dans le dossier `data/` avec le nom `data_extrait.csv`
3. **Lancez** le traitement :

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

## 📁 Structure du Package

```
Traitement_Domaines_Valides/
├── 📁 scripts/                    # Scripts de traitement
│   ├── run_domaines.cjs          # Interface principale
│   ├── test_domain_valide.cjs    # Test rapide (1000 lignes)
│   ├── domain_valide.cjs         # Traitement complet
│   └── domain_valide_advanced.cjs # Version configurée
├── 📁 config/                     # Configuration
│   └── config_domaines.json      # Paramètres ajustables
├── 📁 data/                       # Données d'entrée
│   └── data_extrait.csv          # Votre fichier CSV ici
├── 📁 output/                     # Résultats
│   ├── domaines_valides.csv      # Domaines filtrés
│   └── test_domaines_valides.csv # Résultat du test
├── 📁 docs/                       # Documentation
│   └── README_domaines_valides.md # Guide détaillé
├── 📁 temp/                       # Fichiers temporaires (auto-créé)
├── lancer_traitement.bat         # Lanceur Windows
├── lancer_traitement.ps1         # Lanceur PowerShell
├── package.json                  # Configuration Node.js
└── README.md                     # Ce fichier
```

## 🎯 Utilisation Rapide

### 1. Préparation
Placez votre fichier CSV dans `data/data_extrait.csv`

### 2. Test rapide
Lancez le script et choisissez l'option **1** pour tester sur 1000 lignes

### 3. Traitement complet
Choisissez l'option **2** ou **3** pour traiter tous vos domaines

### 4. Résultats
Récupérez le fichier filtré dans `output/domaines_valides.csv`

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

### Fichier d'entrée requis
Format CSV avec délimiteur `;` :
```csv
"Nom de domaine";"Pays BE";"Departement BE";"Ville BE";"Nom BE";"Sous domaine";"Type du titulaire";"Pays titulaire";"Departement titulaire";"Domaine IDN";"Date de création";"Date de retrait du WHOIS"
exemple.fr;FR;75;PARIS;GANDI;fr;;;;0;28-01-2022;
exemple-invalide.fr;FR;75;PARIS;GANDI;fr;;;;0;30-06-2023;27-08-2024
```

### Fichier de sortie
Même format, mais sans les domaines ayant une date de retrait.

## 🔧 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm start` | Interface principale |
| `npm test` | Test rapide |
| `npm run process` | Traitement complet |
| `npm run advanced` | Traitement configuré |

## 📈 Performance

**Estimations de temps selon votre machine :**

| Machine | Lignes/sec | Temps pour 10M lignes |
|---------|------------|----------------------|
| Basique (4GB RAM) | ~5,000 | ~33 minutes |
| Standard (8GB RAM) | ~10,000 | ~17 minutes |
| Performante (16GB+ RAM) | ~20,000 | ~8 minutes |

## 🛠️ Dépannage

### Problème : "Out of memory"
**Solution :** Réduire `chunk_size` dans `config/config_domaines.json`

### Problème : Fichier non trouvé
**Vérifiez :** Le fichier `data/data_extrait.csv` existe

### Problème : Erreurs de parsing
**Solution :** Vérifiez le format du CSV (délimiteur `;`)

## 📞 Support

Pour plus de détails, consultez :
- `docs/README_domaines_valides.md` - Documentation complète
- `config/config_domaines.json` - Configuration avancée

## 🎉 Résultat

Le script génère un fichier `output/domaines_valides.csv` contenant uniquement les domaines actifs, prêt pour vos analyses marketing !

---

**Développé avec ❤️ pour traiter efficacement vos données de domaines** 