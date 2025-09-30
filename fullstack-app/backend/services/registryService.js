const fs = require('fs');
const path = require('path');

class RegistryService {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.registryPath = path.join(dataDir, 'files-registry.json');
        this.ensureRegistryExists();
    }

    // S'assurer que le registre existe
    ensureRegistryExists() {
        if (!fs.existsSync(this.registryPath)) {
            fs.writeFileSync(this.registryPath, JSON.stringify({}, null, 2));
        }
    }

    // Charger le registre
    loadRegistry() {
        try {
            const data = fs.readFileSync(this.registryPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Erreur lors du chargement du registre:', error);
            return {};
        }
    }

    // Sauvegarder le registre
    saveRegistry(registry) {
        try {
            fs.writeFileSync(this.registryPath, JSON.stringify(registry, null, 2));
            return true;
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du registre:', error);
            return false;
        }
    }

    // Structure standardisée pour un fichier
    createFileEntry(filename, options = {}) {
        const filePath = path.join(this.dataDir, filename);
        const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
        
        return {
            size: stats ? stats.size : 0,
            modified: stats ? stats.mtime.toISOString() : new Date().toISOString(),
            type: options.type || this.determineType(filename),
            totalLines: options.totalLines || 0,
            lastUpdated: new Date().toISOString(),
            dates: options.dates || [],
            localisations: options.localisations || [],
            mergedFrom: options.mergedFrom || [],
            statistiques: options.statistiques || {
                domain_lignes: 0,
                domain_temps: 0,
                whois_lignes: 0,
                whois_temps: 0,
                verifier_lignes: 0,
                verifier_temps: 0
            }
        };
    }

    // Déterminer le type de fichier
    determineType(filename) {
        if (filename.toLowerCase().includes('opendata') || 
            filename.toLowerCase().includes('afnic') ||
            filename.match(/^\d{6}_opendata/)) {
            return 'afnic';
        }
        if (filename.toLowerCase().includes('whois')) {
            return 'whois';
        }
        if (filename.toLowerCase().includes('verifie') || 
            filename.toLowerCase().includes('valid')) {
            return 'verifie';
        }
        if (filename.toLowerCase().includes('daily') ||
            filename.match(/^\d{8}_daily/)) {
            return 'daily';
        }
        if (filename.toLowerCase().includes('domains') ||
            filename.toLowerCase().includes('extracted')) {
            return 'domains';
        }
        return 'classique';
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
        if (dateStr.includes('_')) {
            return dateStr.replace('_', '-');
        }
        
        if (dateStr.includes('mai') || dateStr.includes('Mai')) {
            return dateStr.replace(/\s+(mai|Mai)/, '-05');
        }
        
        if (dateStr.length === 6 && /^\d{6}$/.test(dateStr)) {
            return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}`;
        }
        
        return dateStr;
    }

    // Ajouter un fichier téléchargé (Opendata AFNIC)
    addDownloadedFile(filename, isOpendata = false, totalLines = 0, downloadTime = 0) {
        const registry = this.loadRegistry();
        
        const dates = isOpendata ? ["all"] : this.extractDatesFromFilename(filename);
        const type = isOpendata ? 'afnic' : this.determineType(filename);
        
        registry[filename] = this.createFileEntry(filename, {
            type,
            dates,
            statistiques: {
                domain_lignes: totalLines,
                domain_temps: downloadTime,
                whois_lignes: 0,
                whois_temps: 0,
                verifier_lignes: 0,
                verifier_temps: 0
            }
        });
        
        return this.saveRegistry(registry);
    }

    // Ajouter un fichier avec des informations complètes
    addFile(filename, fileInfo) {
        const registry = this.loadRegistry();
        
        // Fusionner avec les informations de base si nécessaire
        const baseInfo = this.createFileEntry(filename, {
            type: fileInfo.type,
            totalLines: fileInfo.totalLines,
            dates: fileInfo.dates || [],
            localisations: fileInfo.localisations || []
        });
        
        registry[filename] = {
            ...baseInfo,
            ...fileInfo
        };
        
        return this.saveRegistry(registry);
    }

    // Ajouter un fichier filtré par localisation
    addLocationFilteredFile(originalFilename, newFilename, location, filterType) {
        const registry = this.loadRegistry();
        const originalInfo = registry[originalFilename] || {};
        
        // Extraire toutes les dates du fichier original
        const dates = originalInfo.dates && originalInfo.dates.length > 0 
            ? originalInfo.dates 
            : this.extractDatesFromFilename(originalFilename);
        
        // Si le fichier existe déjà, on ajoute la localisation sans doublon
        if (registry[newFilename]) {
            const entry = registry[newFilename];
            if (!entry.localisations) entry.localisations = [];
            if (!entry.localisations.includes(location)) {
                entry.localisations.push(location);
            }
            // Mettre à jour les dates si besoin
            if ((!entry.dates || entry.dates.length === 0) && dates.length > 0) {
                entry.dates = dates;
            }
        } else {
            // Sinon, on crée l'entrée avec la localisation
            registry[newFilename] = this.createFileEntry(newFilename, {
                type: originalInfo.type || this.determineType(newFilename),
                dates,
                localisations: [location]
            });
        }
        
        return this.saveRegistry(registry);
    }

    // Ajouter un fichier fusionné
    addMergedFile(filename, sourceFiles, dates = [], totalLines = 0) {
        const registry = this.loadRegistry();
        
        // Collecter toutes les localisations des fichiers sources
        const localisations = [];
        const mergedFrom = [];
        
        for (const sourceFile of sourceFiles) {
            const sourceInfo = registry[sourceFile];
            if (sourceInfo) {
                if (sourceInfo.localisations) {
                    localisations.push(...sourceInfo.localisations);
                }
                mergedFrom.push(sourceFile);
            }
        }
        
        // Déterminer le type basé sur les fichiers sources
        const sourceTypes = sourceFiles.map(f => {
            const info = registry[f];
            return info ? info.type : this.determineType(f);
        });
        
        let type = 'classique';
        if (sourceTypes.includes('whois')) {
            type = 'whois';
        } else if (sourceTypes.includes('afnic')) {
            type = 'afnic';
        } else if (sourceTypes.includes('domains')) {
            type = 'domains';
        }
        
        registry[filename] = this.createFileEntry(filename, {
            type,
            dates,
            localisations: [...new Set(localisations)],
            mergedFrom,
            totalLines
        });
        
        return this.saveRegistry(registry);
    }

    // Mettre à jour les informations d'un fichier
    updateFileInfo(filename, updates) {
        const registry = this.loadRegistry();
        
        if (registry[filename]) {
            registry[filename] = {
                ...registry[filename],
                ...updates,
                lastUpdated: new Date().toISOString()
            };
        } else {
            registry[filename] = this.createFileEntry(filename, updates);
        }
        
        return this.saveRegistry(registry);
    }

    // Mettre à jour les statistiques d'un fichier
    updateFileStats(filename, statsUpdates) {
        const registry = this.loadRegistry();
        
        if (registry[filename]) {
            // Initialiser la section statistiques si elle n'existe pas
            if (!registry[filename].statistiques) {
                registry[filename].statistiques = {
                    domain_lignes: 0,
                    domain_temps: 0,
                    whois_lignes: 0,
                    whois_temps: 0,
                    verifier_lignes: 0,
                    verifier_temps: 0
                };
            }
            
            // Mettre à jour les statistiques
            registry[filename].statistiques = {
                ...registry[filename].statistiques,
                ...statsUpdates
            };
            
            registry[filename].lastUpdated = new Date().toISOString();
        } else {
            // Créer une nouvelle entrée si le fichier n'existe pas
            registry[filename] = this.createFileEntry(filename, {
                statistiques: {
                    domain_lignes: 0,
                    domain_temps: 0,
                    whois_lignes: 0,
                    whois_temps: 0,
                    verifier_lignes: 0,
                    verifier_temps: 0,
                    ...statsUpdates
                }
            });
        }
        
        return this.saveRegistry(registry);
    }

    // Supprimer un fichier du registre
    removeFile(filename) {
        const registry = this.loadRegistry();
        
        if (registry[filename]) {
            delete registry[filename];
            return this.saveRegistry(registry);
        }
        
        return true;
    }

    // Obtenir les informations d'un fichier
    getFileInfo(filename) {
        const registry = this.loadRegistry();
        return registry[filename] || null;
    }

    // Obtenir tous les fichiers par type
    getFilesByType(type) {
        const registry = this.loadRegistry();
        return Object.entries(registry)
            .filter(([filename, info]) => info.type === type)
            .map(([filename, info]) => ({ filename, ...info }));
    }

    // Obtenir tous les fichiers par catégorie
    getFilesByCategory(category) {
        const registry = this.loadRegistry();
        return Object.entries(registry)
            .filter(([filename, info]) => info.category === category)
            .map(([filename, info]) => ({ filename, ...info }));
    }

    // Synchroniser le registre avec les fichiers physiques
    syncRegistry() {
        const registry = this.loadRegistry();
        const physicalFiles = fs.readdirSync(this.dataDir)
            .filter(file => file.endsWith('.csv') || file.endsWith('.txt'));
        
        // Supprimer les entrées pour les fichiers qui n'existent plus (sauf s'ils sont archivés)
        for (const filename of Object.keys(registry)) {
            const fileInfo = registry[filename];
            if (!physicalFiles.includes(filename) && !fileInfo.archived) {
                delete registry[filename];
                console.log(`🗑️ Fichier ${filename} supprimé du registre (n'existe plus physiquement)`);
            }
        }
        
        // Ajouter les nouveaux fichiers
        for (const filename of physicalFiles) {
            if (!registry[filename]) {
                registry[filename] = this.createFileEntry(filename);
            }
        }
        
        return this.saveRegistry(registry);
    }

    // Générer un nom de fichier pour un filtrage par localisation
    generateLocationFilteredFilename(originalFilename, location) {
        const ext = path.extname(originalFilename);
        const base = path.basename(originalFilename, ext);
        return `${base}_${location}${ext}`;
    }

    // Générer un nom de fichier pour une fusion
    generateMergedFilename(dates, localisations = []) {
        if (dates.length === 0) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            return `domain_merged_${timestamp}.csv`;
        }
        
        const sortedDates = [...new Set(dates)].sort();
        
        if (sortedDates.length === 1) {
            const date = sortedDates[0];
            const [day, month] = date.split('-');
            const datePart = `domain_${day}-${month}`;
            
            if (localisations.length > 0) {
                const locsString = localisations.join('_');
                return `${datePart}_${locsString}.csv`;
            }
            return `${datePart}.csv`;
        }
        
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];
        const [firstDay, firstMonth] = firstDate.split('-');
        const [lastDay, lastMonth] = lastDate.split('-');
        
        let datePart;
        if (firstMonth === lastMonth) {
            datePart = `domain_${firstDay}-${firstMonth}_${lastDay}-${lastMonth}`;
        } else {
            datePart = `domain_${firstDay}-${firstMonth}_${lastDay}-${lastMonth}`;
        }
        
        if (localisations.length > 0) {
            const locsString = localisations.join('_');
            return `${datePart}_${locsString}.csv`;
        }
        
        return `${datePart}.csv`;
    }
}

module.exports = RegistryService; 