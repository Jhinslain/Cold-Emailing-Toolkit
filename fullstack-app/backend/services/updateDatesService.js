const fs = require('fs');
const path = require('path');

class UpdateDatesService {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.filesRegistryPath = path.join(dataDir, 'files-registry.json');
    }

    // Charger le registre des fichiers
    loadFilesRegistry() {
        try {
            if (fs.existsSync(this.filesRegistryPath)) {
                const data = fs.readFileSync(this.filesRegistryPath, 'utf8');
                return JSON.parse(data);
            }
            return {};
        } catch (error) {
            console.error('Erreur lors du chargement du registre:', error);
            return {};
        }
    }

    // Sauvegarder le registre des fichiers
    saveFilesRegistry(registry) {
        try {
            fs.writeFileSync(this.filesRegistryPath, JSON.stringify(registry, null, 2));
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du registre:', error);
        }
    }

    // Extraire les dates d'un nom de fichier
    extractDatesFromFilename(filename) {
        const dates = [];
        
        // Patterns pour extraire les dates
        const patterns = [
            // Format: 15-19_05, 20-23_05, 29-31_05
            /(\d{1,2}-\d{1,2}_\d{2})/g,
            // Format: 24-28 mai
            /(\d{1,2}-\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre))/gi,
            // Format: 05-10_05-14
            /(\d{2}-\d{2}_\d{2}-\d{2})/g,
            // Format: 2025_05-10_05-14
            /(\d{4}_\d{2}-\d{2}_\d{2}-\d{2})/g,
            // Format: 202505 (année + mois)
            /(\d{6})/g
        ];

        for (const pattern of patterns) {
            const matches = filename.match(pattern);
            if (matches) {
                dates.push(...matches);
            }
        }

        return dates;
    }

    // Normaliser une date extraite
    normalizeDate(dateStr) {
        // Convertir les formats de date en format standard
        if (dateStr.includes('_')) {
            // Format: 15-19_05 -> 15-19-05
            return dateStr.replace('_', '-');
        }
        
        if (dateStr.includes('mai') || dateStr.includes('Mai')) {
            // Format: 24-28 mai -> 24-28-05
            return dateStr.replace(/\s+(mai|Mai)/, '-05');
        }
        
        if (dateStr.length === 6 && /^\d{6}$/.test(dateStr)) {
            // Format: 202505 -> 2025-05
            return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}`;
        }
        
        return dateStr;
    }

    // Mettre à jour les dates pour tous les fichiers du registre
    updateAllDates() {
        const registry = this.loadFilesRegistry();
        let updatedCount = 0;
        
        console.log('🔄 Mise à jour des dates dans le registre...');
        
        for (const [filename, fileInfo] of Object.entries(registry)) {
            const dates = this.extractDatesFromFilename(filename);
            const normalizedDates = [...new Set(dates.map(d => this.normalizeDate(d)))].sort();
            
            if (normalizedDates.length > 0) {
                // Mettre à jour ou ajouter le champ dates
                registry[filename] = {
                    ...fileInfo,
                    dates: normalizedDates
                };
                updatedCount++;
                console.log(`✅ ${filename}: ${normalizedDates.join(', ')}`);
            } else {
                console.log(`⚠️ ${filename}: Aucune date trouvée`);
            }
        }
        
        this.saveFilesRegistry(registry);
        console.log(`✅ Mise à jour terminée: ${updatedCount} fichiers mis à jour`);
        
        return {
            totalFiles: Object.keys(registry).length,
            updatedFiles: updatedCount
        };
    }

    // Mettre à jour les dates pour un fichier spécifique
    updateFileDates(filename) {
        const registry = this.loadFilesRegistry();
        
        if (!registry[filename]) {
            throw new Error(`Fichier ${filename} non trouvé dans le registre`);
        }
        
        const dates = this.extractDatesFromFilename(filename);
        const normalizedDates = [...new Set(dates.map(d => this.normalizeDate(d)))].sort();
        
        registry[filename] = {
            ...registry[filename],
            dates: normalizedDates
        };
        
        this.saveFilesRegistry(registry);
        
        return {
            filename,
            dates: normalizedDates
        };
    }

    // Obtenir les statistiques des dates
    getDatesStats() {
        const registry = this.loadFilesRegistry();
        const stats = {
            totalFiles: Object.keys(registry).length,
            filesWithDates: 0,
            filesWithoutDates: 0,
            dateFormats: {},
            dateRanges: []
        };
        
        for (const [filename, fileInfo] of Object.entries(registry)) {
            if (fileInfo.dates && fileInfo.dates.length > 0) {
                stats.filesWithDates++;
                
                // Compter les formats de dates
                fileInfo.dates.forEach(date => {
                    const format = this.getDateFormat(date);
                    stats.dateFormats[format] = (stats.dateFormats[format] || 0) + 1;
                });
                
                // Ajouter la plage de dates
                if (fileInfo.dates.length > 1) {
                    stats.dateRanges.push({
                        filename,
                        range: `${fileInfo.dates[0]} - ${fileInfo.dates[fileInfo.dates.length - 1]}`,
                        dates: fileInfo.dates
                    });
                }
            } else {
                stats.filesWithoutDates++;
            }
        }
        
        return stats;
    }

    // Déterminer le format d'une date
    getDateFormat(dateStr) {
        if (dateStr.includes('/')) return 'day-month';
        if (dateStr.includes('-') && dateStr.length === 7) return 'year-month';
        if (dateStr.includes('-') && dateStr.length > 7) return 'day-day-month';
        return 'other';
    }
}

module.exports = UpdateDatesService; 