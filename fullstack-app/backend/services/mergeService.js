const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const RegistryService = require('./registryService');

class MergeService {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.registryService = new RegistryService(dataDir);
    }

    // Charger le registre des fichiers
    loadFilesRegistry() {
        return this.registryService.loadRegistry();
    }

    // Sauvegarder le registre des fichiers
    saveFilesRegistry(registry) {
        return this.registryService.saveRegistry(registry);
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

    // Générer un nom de fichier fusionné basé sur les dates
    generateMergedFilename(filenames) {
        const allDates = [];
        
        // Extraire toutes les dates des noms de fichiers
        for (const filename of filenames) {
            const dates = this.extractDatesFromFilename(filename);
            allDates.push(...dates);
        }
        
        // Normaliser et trier les dates
        const normalizedDates = [...new Set(allDates.map(d => this.normalizeDate(d)))].sort();
        
        if (normalizedDates.length === 0) {
            // Si aucune date trouvée, utiliser un timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            return `domain_merged_${timestamp}.csv`;
        }
        
        if (normalizedDates.length === 1) {
            return `domain_${normalizedDates[0]}.csv`;
        }
        
        // Prendre la première et la dernière date
        const firstDate = normalizedDates[0];
        const lastDate = normalizedDates[normalizedDates.length - 1];
        
        // Simplifier le format : domain_05-10_05-31.csv
        const firstParts = firstDate.split('-');
        const lastParts = lastDate.split('-');
        
        // Si c'est le même mois, format: domain_05-10_05-31.csv
        if (firstParts.length >= 2 && lastParts.length >= 2) {
            const firstDay = firstParts[0];
            const lastDay = lastParts[0];
            const month = firstParts[1] || lastParts[1];
            return `domain_${firstDay}-${month}_${lastDay}-${month}.csv`;
        }
        
        return `domain_${firstDate}-${lastDate}.csv`;
    }

    // Générer un nom de fichier fusionné basé sur les vraies dates du contenu
    generateMergedFilenameFromDates(contentDates, sourceFiles = []) {
        // Vérifier si les fichiers sources sont filtrés par localisation
        const registry = this.loadFilesRegistry();
        let localisations = [];
        for (const filename of sourceFiles) {
            const fileInfo = registry[filename];
            if (fileInfo && Array.isArray(fileInfo.localisations)) {
                localisations.push(...fileInfo.localisations);
            } else if (fileInfo && fileInfo.localisation) {
                localisations.push(fileInfo.localisation);
            }
        }
        localisations = [...new Set(localisations)].filter(Boolean).sort();
        
        // Si on a des localisations et des dates
        if (localisations.length > 0 && contentDates.length > 0) {
            // Trier les dates du plus ancien au plus récent (ordre croissant)
            const sortedDates = [...new Set(contentDates)].sort((a, b) => {
                // format attendu : DD-MM-YYYY
                const [da, ma, ya] = a.split('-').map(Number);
                const [db, mb, yb] = b.split('-').map(Number);
                // Compare année, puis mois, puis jour
                if (ya !== yb) return ya - yb;
                if (ma !== mb) return ma - mb;
                return da - db;
            });
            const daten = sortedDates[0]; // la plus ancienne
            const date1 = sortedDates[sortedDates.length - 1]; // la plus récente
            const locString = localisations.map(l => l.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()).join('-');
            return `domain_${daten}_${date1}_loc_${locString}.csv`;
        }
        // Si on a que des localisations
        if (localisations.length > 0) {
            const locString = localisations.map(l => l.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()).join('-');
            return `domain_loc_${locString}.csv`;
        }
        // Si on a que des dates
        if (contentDates.length > 0) {
            const sortedDates = [...new Set(contentDates)].sort((a, b) => {
                const [da, ma, ya] = a.split('-').map(Number);
                const [db, mb, yb] = b.split('-').map(Number);
                if (ya !== yb) return ya - yb;
                if (ma !== mb) return ma - mb;
                return da - db;
            });
            const daten = sortedDates[0];
            const date1 = sortedDates[sortedDates.length - 1];
            return `domain_${daten}_${date1}.csv`;
        }
        // Sinon, fallback timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return `domain_merged_${timestamp}.csv`;
    }

    // Mettre à jour le registre avec les informations de fusion
    updateRegistryWithMerge(mergedFilename, sourceFiles, totalLines, contentDates = [], sourceTypes = []) {
        try {
            this.registryService.addMergedFile(mergedFilename, sourceFiles, contentDates, totalLines);
            console.log(`📅 Registre mis à jour pour ${mergedFilename}`);
            return this.registryService.getFileInfo(mergedFilename);
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour du registre:', error.message);
            return null;
        }
    }

    // Fusionner plusieurs fichiers CSV avec gestion des dates
    async mergeFiles(filenames) {
        try {
            const filePaths = [];
            const existingFiles = [];
            const sourceTypes = [];
            const sourceWhoisFlags = [];
            
            // Vérifier l'existence des fichiers et récupérer leurs chemins
            for (const filename of filenames) {
                const filePath = path.join(this.dataDir, filename);
                if (fs.existsSync(filePath)) {
                    filePaths.push(filePath);
                    existingFiles.push(filename);
                    // Déterminer le type du fichier source (plus robuste)
                    const registry = this.loadFilesRegistry();
                    const fileInfo = registry[filename];
                    if (fileInfo && (fileInfo.type === 'whois' || fileInfo.isWhois === true)) {
                        sourceTypes.push('whois');
                    } else {
                        sourceTypes.push('fichier');
                    }
                    sourceWhoisFlags.push(!!(fileInfo && fileInfo.isWhois === true));
                } else {
                    console.warn(`⚠️ Fichier non trouvé: ${filename}`);
                }
            }
            
            if (existingFiles.length < 2) {
                throw new Error('Au moins 2 fichiers valides requis pour la fusion');
            }
            
            // Extraire d'abord les dates du contenu pour générer le bon nom
            const allContentDates = [];
            for (const filePath of filePaths) {
                try {
                    const dates = await this.extractDatesFromContent(filePath);
                    allContentDates.push(...dates);
                } catch (error) {
                    console.warn(`⚠️ Impossible d'extraire les dates de ${path.basename(filePath)}: ${error.message}`);
                }
            }
            
            // Générer un nom de fichier basé sur les vraies dates du contenu et les localisations
            const mergedFileName = this.generateMergedFilenameFromDates(allContentDates, existingFiles);
            const mergedFilePath = path.join(this.dataDir, mergedFileName);
            
            console.log(`🔄 Fusion de ${existingFiles.length} fichiers vers: ${mergedFileName}`);
            console.log(`📅 Fichiers sources: ${existingFiles.join(', ')}`);
            
            // Lire les en-têtes du premier fichier
            const firstFileColumns = await this.getCSVColumns(filePaths[0]);
            if (firstFileColumns.length === 0) {
                throw new Error('Impossible de lire les colonnes du premier fichier');
            }
            
            // Créer le fichier de fusion avec les en-têtes
            const writeStream = fs.createWriteStream(mergedFilePath);
            writeStream.write(firstFileColumns.join(',') + '\n');
            
            let totalLines = 0;
            const processedDomains = new Set(); // Pour éviter les doublons
            
            // Fusionner chaque fichier
            for (const filePath of filePaths) {
                console.log(`📄 Traitement de: ${path.basename(filePath)}`);
                
                const fileLines = await new Promise((resolve, reject) => {
                    let lines = 0;
                    const readStream = fs.createReadStream(filePath)
                        .pipe(csv())
                        .on('data', (row) => {
                            // Utiliser le domaine comme clé pour éviter les doublons
                            const domain = row.domain || row.Domain || row.DOMAIN || row["Nom de domaine"] || row.email?.split('@')[1] || '';
                            
                            if (domain && !processedDomains.has(domain)) {
                                processedDomains.add(domain);
                                
                                // Écrire la ligne dans le fichier de fusion
                                const csvLine = firstFileColumns.map(col => {
                                    const value = row[col] || '';
                                    // Échapper les virgules et guillemets dans les valeurs
                                    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                                        return `"${value.replace(/"/g, '""')}"`;
                                    }
                                    return value;
                                }).join(',');
                                
                                writeStream.write(csvLine + '\n');
                                lines++;
                            }
                        })
                        .on('end', () => {
                            resolve(lines);
                        })
                        .on('error', (error) => {
                            reject(error);
                        });
                });
                
                totalLines += fileLines;
                console.log(`✅ ${fileLines} lignes uniques ajoutées depuis ${path.basename(filePath)}`);
            }
            
            writeStream.end();
            
            // Attendre que l'écriture soit terminée
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
            
            // Extraire les dates du contenu fusionné
            const contentDates = await this.extractDatesFromContent(mergedFilePath);
            
            // Mettre à jour le registre avec les vraies dates du contenu et les types sources
            // Correction : type whois si TOUS les fichiers sources sont whois
            const isAllWhois = sourceWhoisFlags.length > 0 && sourceWhoisFlags.every(Boolean);
            const fileInfo = this.updateRegistryWithMerge(mergedFileName, existingFiles, totalLines, contentDates, isAllWhois ? ['whois'] : ['fichier']);
            
            // Mettre à jour la taille du fichier
            const stats = fs.statSync(mergedFilePath);
            fileInfo.size = stats.size;
            this.saveFilesRegistry(this.loadFilesRegistry());
            
            console.log(`✅ Fusion terminée: ${totalLines} lignes uniques dans ${mergedFileName}`);
            console.log(`📅 Dates du contenu: ${contentDates.join(', ')}`);
            
            return {
                mergedFileName,
                totalLines,
                mergedFiles: existingFiles,
                filePath: mergedFilePath,
                dates: contentDates
            };
            
        } catch (error) {
            console.error('❌ Erreur lors de la fusion des fichiers:', error);
            throw error;
        }
    }

    // Obtenir les colonnes d'un fichier CSV
    async getCSVColumns(filePath) {
        return new Promise((resolve, reject) => {
            const columns = [];
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    if (columns.length === 0) {
                        columns.push(...Object.keys(row));
                    }
                })
                .on('end', () => {
                    resolve(columns);
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    // Extraire les dates du contenu d'un fichier CSV
    async extractDatesFromContent(filePath) {
        return new Promise((resolve, reject) => {
            const dates = new Set();
            const dateColumns = ['Date de création', 'date_creation', 'creation_date', 'date'];
            
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    // Chercher dans les colonnes de date possibles
                    for (const colName of dateColumns) {
                        if (row[colName] && row[colName].trim()) {
                            const dateValue = row[colName].trim();
                            // Normaliser le format de date (DD-MM-YYYY ou YYYY-MM-DD)
                            if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateValue)) {
                                dates.add(dateValue);
                            } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateValue)) {
                                dates.add(dateValue);
                            }
                        }
                    }
                })
                .on('end', () => {
                    resolve([...dates].sort());
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }
}

module.exports = MergeService; 