const fs = require('fs');
const path = require('path');
const RegistryService = require('./registryService');

class MigrationService {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.registryService = new RegistryService(dataDir);
    }

    // Migrer le registre existant vers la nouvelle structure
    async migrateRegistry() {
        console.log('🔄 Début de la migration du registre...');
        
        try {
            const registryPath = path.join(this.dataDir, 'files-registry.json');
            
            if (!fs.existsSync(registryPath)) {
                console.log('✅ Aucun registre existant trouvé, création d\'un nouveau registre standardisé');
                return;
            }

            const oldRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
            const newRegistry = {};

            console.log(`📊 Migration de ${Object.keys(oldRegistry).length} entrées...`);

            for (const [filename, oldInfo] of Object.entries(oldRegistry)) {
                console.log(`🔄 Migration de: ${filename}`);
                
                // Créer une nouvelle entrée standardisée
                const newEntry = this.registryService.createFileEntry(filename, {
                    type: this.determineTypeFromOldInfo(oldInfo, filename),
                    totalLines: oldInfo.totalLines || 0,
                    dates: this.extractDatesFromOldInfo(oldInfo, filename),
                    localisations: oldInfo.localisations || [],
                    mergedFrom: oldInfo.mergedFrom || []
                });

                newRegistry[filename] = newEntry;
            }

            // Sauvegarder le nouveau registre
            this.registryService.saveRegistry(newRegistry);
            
            console.log('✅ Migration terminée avec succès!');
            console.log(`📊 ${Object.keys(newRegistry).length} entrées migrées`);
            
            return newRegistry;
            
        } catch (error) {
            console.error('❌ Erreur lors de la migration:', error);
            throw error;
        }
    }

    // Déterminer le type à partir des anciennes informations
    determineTypeFromOldInfo(oldInfo, filename) {
        // Si le type est déjà défini et valide
        if (oldInfo.type && ['afnic', 'whois', 'domains', 'valides', 'daily', 'classique'].includes(oldInfo.type)) {
            return oldInfo.type;
        }

        // Déterminer le type basé sur les propriétés booléennes
        if (oldInfo.isOpendata === true) {
            return 'afnic';
        }
        if (oldInfo.isWhois === true) {
            return 'whois';
        }
        if (oldInfo.isValides === true) {
            return 'valides';
        }
        if (oldInfo.isDaily === true) {
            return 'daily';
        }
        if (oldInfo.isDomains === true) {
            return 'domains';
        }

        // Déterminer le type basé sur le nom de fichier
        return this.registryService.determineType(filename);
    }

    // Extraire les dates des anciennes informations
    extractDatesFromOldInfo(oldInfo, filename) {
        // Si les dates sont déjà présentes
        if (oldInfo.dates && Array.isArray(oldInfo.dates)) {
            return oldInfo.dates;
        }

        // Extraire les dates du nom de fichier
        return this.registryService.extractDatesFromFilename(filename);
    }

    // Déterminer la catégorie à partir des anciennes informations
    determineCategoryFromOldInfo(oldInfo) {
        if (oldInfo.category) {
            return oldInfo.category;
        }

        // Déterminer la catégorie basée sur les propriétés
        if (oldInfo.mergedFrom && oldInfo.mergedFrom.length > 0) {
            return 'fusion';
        }
        if (oldInfo.localisations && oldInfo.localisations.length > 0) {
            return 'filtre_loc';
        }
        if (oldInfo.isOpendata === true) {
            return 'telecharge';
        }

        return 'fichier';
    }

    // Valider la structure du registre
    validateRegistry() {
        console.log('🔍 Validation de la structure du registre...');
        
        try {
            const registry = this.registryService.loadRegistry();
            const errors = [];
            const warnings = [];

            for (const [filename, info] of Object.entries(registry)) {
                // Vérifier les champs obligatoires
                const requiredFields = ['type', 'totalLines', 'lastUpdated', 'dates', 'localisations', 'mergedFrom'];
                
                for (const field of requiredFields) {
                    if (!(field in info)) {
                        errors.push(`${filename}: champ manquant '${field}'`);
                    }
                }

                // Vérifier les types de données
                if (!Array.isArray(info.dates)) {
                    errors.push(`${filename}: 'dates' doit être un tableau`);
                }
                if (!Array.isArray(info.localisations)) {
                    errors.push(`${filename}: 'localisations' doit être un tableau`);
                }
                if (!Array.isArray(info.mergedFrom)) {
                    errors.push(`${filename}: 'mergedFrom' doit être un tableau`);
                }

                // Vérifier la cohérence des types
                if (!['afnic', 'whois', 'domains', 'valides', 'daily', 'classique'].includes(info.type)) {
                    errors.push(`${filename}: type invalide '${info.type}'`);
                }
            }

            if (errors.length > 0) {
                console.error('❌ Erreurs de validation:');
                errors.forEach(error => console.error(`   ${error}`));
                return false;
            }

            if (warnings.length > 0) {
                console.warn('⚠️ Avertissements de validation:');
                warnings.forEach(warning => console.warn(`   ${warning}`));
            }

            console.log('✅ Validation terminée avec succès!');
            return true;
            
        } catch (error) {
            console.error('❌ Erreur lors de la validation:', error);
            return false;
        }
    }

    // Générer un rapport de migration
    generateMigrationReport() {
        console.log('📊 Génération du rapport de migration...');
        
        try {
            const registry = this.registryService.loadRegistry();
            const report = {
                totalFiles: Object.keys(registry).length,
                byType: {},
                byDateRange: {},
                summary: {}
            };

            for (const [filename, info] of Object.entries(registry)) {
                // Compter par type
                report.byType[info.type] = (report.byType[info.type] || 0) + 1;

                // Analyser les plages de dates
                if (info.dates && info.dates.length > 0) {
                    if (info.dates.includes('all')) {
                        report.byDateRange['all'] = (report.byDateRange['all'] || 0) + 1;
                    } else {
                        const dateCount = info.dates.length;
                        report.byDateRange[`${dateCount} dates`] = (report.byDateRange[`${dateCount} dates`] || 0) + 1;
                    }
                }
            }

            // Résumé
            report.summary = {
                totalFiles: report.totalFiles,
                typesCount: Object.keys(report.byType).length,
                filesWithDates: Object.values(report.byDateRange).reduce((a, b) => a + b, 0),
                filesWithLocalisations: Object.values(registry).filter(info => info.localisations && info.localisations.length > 0).length,
                filesWithMerges: Object.values(registry).filter(info => info.mergedFrom && info.mergedFrom.length > 0).length
            };

            console.log('📊 Rapport de migration:');
            console.log(`   Total de fichiers: ${report.summary.totalFiles}`);
            console.log(`   Types différents: ${report.summary.typesCount}`);
            console.log(`   Fichiers avec dates: ${report.summary.filesWithDates}`);
            console.log(`   Fichiers avec localisations: ${report.summary.filesWithLocalisations}`);
            console.log(`   Fichiers fusionnés: ${report.summary.filesWithMerges}`);

            console.log('\n📈 Répartition par type:');
            for (const [type, count] of Object.entries(report.byType)) {
                console.log(`   ${type}: ${count}`);
            }

            return report;
            
        } catch (error) {
            console.error('❌ Erreur lors de la génération du rapport:', error);
            return null;
        }
    }
}

module.exports = MigrationService; 