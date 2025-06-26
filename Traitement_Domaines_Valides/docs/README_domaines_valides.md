# 🌐 Traitement des Domaines Valides

Ce projet contient des scripts pour filtrer et nettoyer une liste de domaines en supprimant ceux qui ont une date de retrait du WHOIS (indiquant qu'ils n'existent plus).

## 📋 Fonctionnalités

- ✅ **Traitement par chunks** : Gestion efficace de fichiers volumineux (10M+ lignes)
- ✅ **Filtrage intelligent** : Suppression des domaines avec date de retrait WHOIS
- ✅ **Gestion mémoire optimisée** : Évite les problèmes de mémoire
- ✅ **Interface utilisateur** : Menu interactif pour choisir les options
- ✅ **Configuration flexible** : Paramètres ajustables selon vos ressources
- ✅ **Suivi en temps réel** : Barre de progression et statistiques

## 🚀 Démarrage rapide

### 1. Lancement interactif (Recommandé)
```bash
node run_domaines.cjs
```

### 2. Test rapide (1000 lignes)
```bash
node test_domain_valide.cjs
```

### 3. Traitement complet
```bash
node domain_valide.cjs
```

### 4. Traitement avancé (avec configuration)
```bash
node domain_valide_advanced.cjs
```

## 📁 Structure des fichiers

```
├── run_domaines.cjs              # Interface utilisateur principale
├── test_domain_valide.cjs        # Script de test (1000 lignes)
├── domain_valide.cjs             # Script de traitement complet
├── domain_valide_advanced.cjs    # Script avancé avec configuration
├── config_domaines.json          # Configuration des paramètres
├── domaines/
│   └── data_extrait.csv          # Fichier d'entrée (10M+ lignes)
├── output/
│   ├── domaines_valides.csv      # Fichier de sortie principal
│   └── test_domaines_valides.csv # Fichier de test
└── temp/                         # Fichiers temporaires (auto-nettoyés)
```

## ⚙️ Configuration

Le fichier `config_domaines.json` permet d'ajuster les paramètres :

```json
{
  "processing": {
    "chunk_size": 10000,        // Lignes par chunk (réduire si mémoire limitée)
    "memory_limit_mb": 512,     // Limite mémoire en MB
    "max_concurrent_chunks": 1  // Chunks simultanés
  },
  "validation": {
    "skip_empty_lines": true,   // Ignorer les lignes vides
    "skip_malformed_lines": true, // Ignorer les lignes malformées
    "log_errors": true          // Logger les erreurs
  }
}
```

### Ajustements recommandés selon votre machine :

**Machine avec 4GB RAM :**
```json
{
  "processing": {
    "chunk_size": 5000,
    "memory_limit_mb": 256
  }
}
```

**Machine avec 8GB+ RAM :**
```json
{
  "processing": {
    "chunk_size": 20000,
    "memory_limit_mb": 1024
  }
}
```

## 📊 Format des données

### Fichier d'entrée (`data_extrait.csv`)
Format CSV avec délimiteur `;` :
```csv
"Nom de domaine";"Pays BE";"Departement BE";"Ville BE";"Nom BE";"Sous domaine";"Type du titulaire";"Pays titulaire";"Departement titulaire";"Domaine IDN";"Date de création";"Date de retrait du WHOIS"
aaaaaaaaaaaaaaaaaa.fr;FR;59;ROUBAIX;OVH;fr;;;;0;28-01-2022;
aaaaaaaaaaaaaaaaaed.fr;FR;75;PARIS;GANDI;fr;;;;0;30-06-2023;27-08-2024
```

### Fichier de sortie (`domaines_valides.csv`)
Même format, mais sans les domaines ayant une date de retrait.

## 🔍 Logique de filtrage

Un domaine est considéré comme **valide** si :
- La colonne "Date de retrait du WHOIS" est **vide** ou **null**
- La ligne n'est pas malformée

Un domaine est considéré comme **invalide** si :
- La colonne "Date de retrait du WHOIS" contient une date
- La ligne est malformée ou vide

## 📈 Performance

### Estimations de temps (selon votre machine) :

| Machine | Lignes/sec | Temps pour 10M lignes |
|---------|------------|----------------------|
| Basique (4GB RAM) | ~5,000 | ~33 minutes |
| Standard (8GB RAM) | ~10,000 | ~17 minutes |
| Performante (16GB+ RAM) | ~20,000 | ~8 minutes |

### Optimisations incluses :
- ✅ Traitement par chunks pour éviter les problèmes mémoire
- ✅ Garbage collection automatique
- ✅ Fichiers temporaires pour éviter la perte de données
- ✅ Suivi de progression en temps réel
- ✅ Gestion d'erreurs robuste

## 🛠️ Dépannage

### Problème : "Out of memory"
**Solution :** Réduire `chunk_size` dans `config_domaines.json`

### Problème : Traitement très lent
**Solution :** Augmenter `chunk_size` si vous avez plus de RAM

### Problème : Fichier non trouvé
**Vérifiez :** Le fichier `domaines/data_extrait.csv` existe

### Problème : Erreurs de parsing
**Solution :** Vérifiez le format du CSV (délimiteur `;`)

## 📋 Exemples d'utilisation

### 1. Test rapide pour vérifier le fonctionnement
```bash
node run_domaines.cjs
# Choisir option 1 (Test rapide)
```

### 2. Analyser les statistiques du fichier
```bash
node run_domaines.cjs
# Choisir option 4 (Statistiques)
```

### 3. Traitement complet avec configuration personnalisée
```bash
# Modifier config_domaines.json selon vos besoins
node run_domaines.cjs
# Choisir option 3 (Traitement avancé)
```

## 🔧 Scripts disponibles

| Script | Description | Utilisation |
|--------|-------------|-------------|
| `run_domaines.cjs` | Interface principale | `node run_domaines.cjs` |
| `test_domain_valide.cjs` | Test rapide | `node test_domain_valide.cjs` |
| `domain_valide.cjs` | Traitement complet | `node domain_valide.cjs` |
| `domain_valide_advanced.cjs` | Traitement configuré | `node domain_valide_advanced.cjs` |

## 📊 Sortie attendue

```
🚀 Début du traitement des domaines valides...
📁 Fichier d'entrée: domaines/data_extrait.csv
📁 Fichier de sortie: output/domaines_valides.csv
📊 Total des lignes: 10,000,000
📈 10.00% | 1,000,000/10,000,000 | 15000 lignes/sec | 67s
💾 Chunk 0: 8,500/10,000 domaines valides sauvegardés
...
✅ Traitement terminé avec succès!
📊 Statistiques:
   - Lignes totales traitées: 10,000,000
   - Domaines valides conservés: 8,500,000
   - Domaines supprimés: 1,500,000
   - Taux de conservation: 85.00%
```

## 🎯 Résultat final

Le script génère un fichier `output/domaines_valides.csv` contenant uniquement les domaines actifs (sans date de retrait WHOIS), prêt pour vos analyses marketing.

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez que Node.js est installé
2. Vérifiez le format du fichier d'entrée
3. Ajustez la configuration selon vos ressources
4. Consultez les logs d'erreur pour plus de détails 