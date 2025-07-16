# Système de Registre Standardisé

## Vue d'ensemble

Le nouveau système de registre standardisé (`RegistryService`) offre une gestion uniforme et cohérente des métadonnées de tous les fichiers de données dans le projet. Il remplace l'ancien système fragmenté par une approche centralisée et structurée.

## Structure Standardisée

Chaque fichier dans le registre suit maintenant une structure uniforme et simplifiée :

```json
{
  "nom_du_fichier.csv": {
    "size": 0,
    "modified": "2025-07-10T08:21:24.677Z",
    "type": "whois",
    "totalLines": 173,
    "lastUpdated": "2025-07-10T08:21:24.677Z",
    "dates": ["10-05-2025", "11-05-2025", ...],
    "localisations": ["31"],
    "mergedFrom": []
  }
}
```

## Types de Fichiers

### Types Supportés

- **`afnic`** : Fichiers Opendata AFNIC (téléchargés)
- **`whois`** : Fichiers avec données WHOIS
- **`domains`** : Fichiers de domaines extraits
- **`valides`** : Fichiers de domaines validés
- **`daily`** : Fichiers quotidiens
- **`classique`** : Fichiers standards

### Détermination Automatique

Le type est déterminé automatiquement selon ces règles :

1. **AFNIC** : Si le nom contient "opendata", "afnic" ou correspond au pattern `^\d{6}_opendata`
2. **WHOIS** : Si le nom contient "whois"
3. **Valides** : Si le nom contient "valides" ou "valid"
4. **Daily** : Si le nom contient "daily" ou correspond au pattern `^\d{8}_daily`
5. **Domains** : Si le nom contient "domains" ou "extracted"
6. **Classique** : Par défaut

## Structure Simplifiée

Le nouveau format se concentre sur les informations essentielles :

- **`type`** : Le type de fichier (afnic, whois, domains, etc.)
- **`dates`** : Les dates associées au fichier
- **`localisations`** : Les localisations pour les filtres
- **`mergedFrom`** : Les fichiers sources pour les fusions
- **`totalLines`** : Le nombre de lignes
- **`size`**, **`modified`**, **`lastUpdated`** : Métadonnées techniques

## Gestion des Dates

### Règles de Gestion

1. **Fichiers téléchargés (AFNIC)** : `dates: ["all"]`
2. **Fichiers filtrés par localisation** : Toutes les dates du fichier original
3. **Fichiers fusionnés** : Toutes les dates des fichiers sources
4. **Fichiers standards** : Extraction automatique du nom de fichier

### Extraction Automatique

Le système extrait automatiquement les dates des noms de fichiers selon ces patterns :

- `15-19_05` → `["15-19_05"]`
- `24-28 mai` → `["24-28_05"]`
- `05-10_05-14` → `["05-10_05-14"]`
- `2025_05-10_05-14` → `["2025_05-10_05-14"]`
- `202505` → `["2025-05"]`

## Gestion des Localisations

### Règles de Nommage

Quand on filtre par localisation :
- Le nom devient : `nom_original_localisation.csv`
- Exemple : `domain_10-05_31-05.csv` + `Paris` → `domain_10-05_31-05_Paris.csv`

### Stockage

Les localisations sont stockées dans le tableau `localisations` :
```json
"localisations": ["31", "81", "09"]
```

## Gestion des Fusions

### Règles de Nommage

Pour les fusions :
- Format : `domain_date_debut_date_fin_localisations.csv`
- Exemple : `domain_10-05_31-05_Paris_Lyon.csv`

### Traçabilité

Les fichiers sources sont conservés dans `mergedFrom` :
```json
"mergedFrom": [
  "fichier_source_1.csv",
  "fichier_source_2.csv"
]
```

## Services Disponibles

### RegistryService

Service principal pour la gestion du registre.

#### Méthodes Principales

```javascript
// Ajouter un fichier téléchargé
addDownloadedFile(filename, isOpendata = false)

// Ajouter un fichier filtré par localisation
addLocationFilteredFile(originalFilename, newFilename, location, filterType)

// Ajouter un fichier fusionné
addMergedFile(filename, sourceFiles, dates = [])

// Mettre à jour les informations
updateFileInfo(filename, updates)

// Obtenir les informations
getFileInfo(filename)

// Obtenir par type
getFilesByType(type)

// Obtenir par catégorie
getFilesByCategory(category)

// Générer des noms de fichiers
generateLocationFilteredFilename(originalFilename, location)
generateMergedFilename(dates, localisations = [])
```

### MigrationService

Service pour migrer l'ancien registre vers la nouvelle structure.

#### Méthodes Principales

```javascript
// Migrer le registre
migrateRegistry()

// Valider la structure
validateRegistry()

// Générer un rapport
generateMigrationReport()
```

## Utilisation

### Initialisation

```javascript
const RegistryService = require('./services/registryService');
const registryService = new RegistryService(dataDir);
```

### Exemples d'Utilisation

#### 1. Ajouter un fichier Opendata AFNIC

```javascript
registryService.addDownloadedFile('OPENDATA_FR_202506.csv', true);
// Résultat : type: 'afnic', dates: ['all'], category: 'telecharge'
```

#### 2. Ajouter un fichier filtré par localisation

```javascript
registryService.addLocationFilteredFile(
  'domain_10-05_31-05.csv',
  'domain_10-05_31-05_Paris.csv',
  'Paris',
  'ville'
);
// Résultat : type hérité, localisations: ['Paris'], category: 'filtre_loc'
```

#### 3. Ajouter un fichier fusionné

```javascript
registryService.addMergedFile(
  'domain_10-05_31-05_merged.csv',
  ['file1.csv', 'file2.csv'],
  ['10-05-2025', '31-05-2025']
);
// Résultat : type déterminé automatiquement, mergedFrom: [...], category: 'fusion'
```

#### 4. Obtenir des fichiers par type

```javascript
const whoisFiles = registryService.getFilesByType('whois');
console.log(`Fichiers WHOIS: ${whoisFiles.length}`);
```

#### 5. Obtenir des fichiers par catégorie

```javascript
const fusionFiles = registryService.getFilesByCategory('fusion');
console.log(`Fichiers fusionnés: ${fusionFiles.length}`);
```

## Migration

### Migration Automatique

Le système inclut un service de migration automatique :

```javascript
const MigrationService = require('./services/migrationService');
const migrationService = new MigrationService(dataDir);

// Migrer le registre existant
await migrationService.migrateRegistry();

// Valider la structure
const isValid = migrationService.validateRegistry();

// Générer un rapport
migrationService.generateMigrationReport();
```

### Validation

Le système valide automatiquement :
- Présence de tous les champs obligatoires
- Types de données corrects
- Cohérence des types et catégories
- Cohérence des propriétés booléennes

## Avantages

### 1. Uniformité
- Structure identique pour tous les fichiers
- Champs obligatoires garantis
- Types de données cohérents

### 2. Automatisation
- Détermination automatique des types
- Extraction automatique des dates
- Génération automatique des noms

### 3. Traçabilité
- Historique des fusions
- Sources des filtres
- Métadonnées complètes

### 4. Flexibilité
- Extension facile pour nouveaux types
- Support de nouvelles catégories
- Évolutivité du système

### 5. Maintenance
- Validation automatique
- Migration transparente
- Documentation complète

## Compatibilité

Le nouveau système maintient la compatibilité avec l'ancien en conservant les propriétés booléennes (`isOpendata`, `isWhois`, etc.) tout en ajoutant la nouvelle structure standardisée.

## Tests

Pour tester le nouveau système :

```bash
cd fullstack-app/backend
node examples/registryExample.js
```

Ce script démontre toutes les fonctionnalités du nouveau système de registre. 