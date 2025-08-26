const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const RegistryService = require('./registryService');

class FileService {
    constructor() {
        // Chemin vers le dossier data dans fullstack-app
        this.dataDir = path.join(__dirname, '../data');
        // Ajouter les autres dossiers pour compatibilité
        this.outputDir = path.join(__dirname, '../data');
        this.inputDir = path.join(__dirname, '../data');
        
        // Initialiser le service de registre
        this.registryService = new RegistryService(this.dataDir);
        this.ensureDirectoryExists(this.dataDir);
    }

    // Vérifier si un dossier existe, sinon le créer
    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    // Obtenir la liste des fichiers avec informations enrichies
    getDataFiles() {
        this.ensureDirectoryExists(this.dataDir);
        
        try {
            // Synchroniser le registre avec les fichiers physiques
            this.registryService.syncRegistry();
            
            const registry = this.registryService.loadRegistry();
            const files = [];
            
            for (const [filename, fileInfo] of Object.entries(registry)) {
                const filePath = path.join(this.dataDir, filename);
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    
                    files.push({
                        name: filename,
                        size: stats.size,
                        modified: stats.mtime,
                        path: filePath,
                        ...fileInfo // Inclure tous les champs du registre
                    });
                }
            }
            
            return files.sort((a, b) => b.modified - a.modified); // Plus récent en premier
        } catch (error) {
            console.error('Erreur lors de la lecture du dossier data:', error);
            return [];
        }
    }

    // Obtenir les fichiers par type (pour compatibilité avec l'interface)
    getOutputFiles() {
        const allFiles = this.getDataFiles();
        return allFiles.filter(file => file.isValides || file.isWhois);
    }

    getInputFiles() {
        const allFiles = this.getDataFiles();
        return allFiles.filter(file => !file.isValides && !file.isWhois);
    }

    // Identifier le type de fichier
    getFileType(filename) {
        if (this.isOpendataFile(filename)) return 'opendata';
        if (this.isDailyFile(filename)) return 'daily';
        if (this.isDomainsFile(filename)) return 'domains';
        if (this.isValidesFile(filename)) return 'valides';
        if (this.isWhoisFile(filename)) return 'whois';
        return 'unknown';
    }

    // Vérifier si c'est un fichier Opendata
    isOpendataFile(filename) {
        return filename.toLowerCase().includes('opendata') || 
               filename.toLowerCase().includes('afnic') ||
               filename.match(/^\d{6}_opendata/);
    }

    // Vérifier si c'est un fichier quotidien
    isDailyFile(filename) {
        return filename.toLowerCase().includes('daily') ||
               filename.match(/^\d{8}_daily/) ||
               filename.match(/^\d{4}-\d{2}-\d{2}/) ||
               filename.match(/^\d{8}_CREA_fr\.(txt|csv)$/);
    }

    // Vérifier si c'est un fichier de domaines extraits
    isDomainsFile(filename) {
        return filename.toLowerCase().includes('domains') ||
               filename.toLowerCase().includes('extracted') ||
               filename.match(/^\d{8}_domains/);
    }

    // Vérifier si c'est un fichier de domaines valides
    isValidesFile(filename) {
        return filename.toLowerCase().includes('valides') ||
               filename.toLowerCase().includes('valid') ||
               filename.match(/^\d{8}_valides/);
    }

    // Vérifier si c'est un fichier WHOIS
    isWhoisFile(filename) {
        return filename.toLowerCase().includes('whois') ||
               filename.toLowerCase().includes('contacts');
    }

    // Vérifier si c'est un fichier filtré par date
    isDateFilteredFile(filename) {
        return filename.includes('_filtered.csv') && filename.includes('_20');
    }

    // Charger le registre des fichiers depuis le fichier JSON
    loadFilesRegistry() {
        return this.registryService.loadRegistry();
    }

    // Sauvegarder le registre des fichiers dans le fichier JSON
    saveFilesRegistry(registry) {
        return this.registryService.saveRegistry(registry);
    }

    // Obtenir les informations d'un fichier depuis le registre
    getFileInfo(filename) {
        return this.registryService.getFileInfo(filename);
    }

    // Ajouter ou mettre à jour un fichier dans le registre
    updateFileInfo(filename, fileInfo) {
        return this.registryService.updateFileInfo(filename, fileInfo);
    }

    // Mettre à jour les statistiques d'un fichier
    updateFileStats(filename, statsUpdates) {
        return this.registryService.updateFileStats(filename, statsUpdates);
    }

    // Obtenir les statistiques d'un fichier
    getFileStats(filename) {
        const fileInfo = this.registryService.getFileInfo(filename);
        return fileInfo ? fileInfo.statistiques : null;
    }

    // Supprimer un fichier du registre
    removeFileFromRegistry(filename) {
        return this.registryService.removeFile(filename);
    }

    // Ajouter un fichier au registre
    async addFileToRegistry(fileInfo) {
        return this.registryService.addFile(fileInfo.name, fileInfo);
    }

    // Obtenir la catégorie d'un fichier
    getFileCategory(filename) {
        const fileInfo = this.getFileInfo(filename);
        return fileInfo ? fileInfo.category || 'fichier' : 'fichier';
    }

    // Définir la catégorie d'un fichier
    setFileCategory(filename, category) {
        return this.updateFileInfo(filename, { category });
    }

    // Obtenir les fichiers par catégorie
    getFilesByCategory(category) {
        const registry = this.loadFilesRegistry();
        const files = [];
        
        for (const [filename, fileInfo] of Object.entries(registry)) {
            if (fileInfo.category === category) {
                const filePath = path.join(this.dataDir, filename);
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    files.push({
                        name: filename,
                        size: stats.size,
                        modified: stats.mtime,
                        path: filePath,
                        ...fileInfo
                    });
                }
            }
        }
        
        return files.sort((a, b) => b.modified - a.modified);
    }

    // Obtenir toutes les catégories avec leurs fichiers
    getAllCategories() {
        const registry = this.loadFilesRegistry();
        const result = {
            fichier: [],
            archive: [],
            ready: []
        };
        
        for (const [filename, fileInfo] of Object.entries(registry)) {
            const filePath = path.join(this.dataDir, filename);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const category = fileInfo.category || 'fichier';
                if (result[category]) {
                    result[category].push({
                        name: filename,
                        size: stats.size,
                        modified: stats.mtime,
                        path: filePath,
                        ...fileInfo
                    });
                }
            }
        }
        
        // Trier chaque catégorie par date de modification
        Object.keys(result).forEach(category => {
            result[category].sort((a, b) => b.modified - a.modified);
        });
        
        return result;
    }

    // Synchroniser le registre avec les fichiers physiques
    syncRegistry() {
        const registry = this.loadFilesRegistry();
        const physicalFiles = fs.readdirSync(this.dataDir)
            .filter(file => {
                const filePath = path.join(this.dataDir, file);
                // Exclure les dossiers, fichiers cachés, fichiers .json, temp, etc.
                return (
                    fs.statSync(filePath).isFile() &&
                    !file.startsWith('.') &&
                    !file.endsWith('.json') &&
                    file !== 'temp'
                );
            });
        
        let updated = false;
        
        // Ajouter les nouveaux fichiers
        physicalFiles.forEach(filename => {
            if (!registry[filename]) {
                const filePath = path.join(this.dataDir, filename);
                const stats = fs.statSync(filePath);
                
                registry[filename] = {
                    size: stats.size,
                    modified: stats.mtime,
                    category: 'fichier',
                    type: this.getFileType(filename),
                    isOpendata: this.isOpendataFile(filename),
                    isDaily: this.isDailyFile(filename),
                    isDomains: this.isDomainsFile(filename),
                    isValides: this.isValidesFile(filename),
                    isWhois: this.isWhoisFile(filename),
                    isDateFiltered: this.isDateFilteredFile(filename),
                    totalLines: 0, // Sera mis à jour lors du prochain scan
                    lastUpdated: new Date().toISOString()
                };
                updated = true;
            }
        });
        
        // Supprimer les fichiers qui n'existent plus
        Object.keys(registry).forEach(filename => {
            const filePath = path.join(this.dataDir, filename);
            if (!fs.existsSync(filePath)) {
                delete registry[filename];
                updated = true;
            }
        });
        
        if (updated) {
            this.saveFilesRegistry(registry);
        }
        
        return registry;
    }

    // Mettre à jour le nombre de lignes d'un fichier
    async updateFileLineCount(filename) {
        try {
            const filePath = path.join(this.dataDir, filename);
            if (!fs.existsSync(filePath)) {
                return false;
            }
            
            // Vérifier d'abord si le nombre de lignes est déjà dans le registre
            const registry = this.loadFilesRegistry();
            if (registry[filename] && typeof registry[filename].totalLines === 'number' && registry[filename].totalLines > 0) {
                // Le nombre de lignes est déjà calculé, pas besoin de le recalculer
                return true;
            }
            
            // Calculer le nombre de lignes seulement si pas déjà présent
            const lineCount = await this.getCSVLineCount(filePath);
            this.updateFileInfo(filename, { totalLines: lineCount });
            return true;
        } catch (error) {
            console.error(`Erreur lors de la mise à jour du nombre de lignes pour ${filename}:`, error);
            return false;
        }
    }

    // Mettre à jour les métadonnées d'un fichier
    async updateFileMetadata(filename) {
        try {
            const filePath = path.join(this.dataDir, filename);
            if (!fs.existsSync(filePath)) {
                return false;
            }
            
            const stats = fs.statSync(filePath);
            const metadata = await this.getFileMetadata(filePath);
            
            this.updateFileInfo(filename, {
                size: stats.size,
                modified: stats.mtime,
                totalLines: metadata.totalLines,
                columns: metadata.columns
            });
            
            return true;
        } catch (error) {
            console.error(`Erreur lors de la mise à jour des métadonnées pour ${filename}:`, error);
            return false;
        }
    }

    // Obtenir les statistiques globales
    getAllStats() {
        const dataFiles = this.getDataFiles();
        
        const totalDataSize = dataFiles.reduce((sum, file) => sum + file.size, 0);
        
        return {
            dataFiles: dataFiles.length,
            outputFiles: dataFiles.filter(f => f.isValides || f.isWhois).length,
            totalDataSize,
            totalOutputSize: dataFiles.filter(f => f.isValides || f.isWhois).reduce((sum, file) => sum + file.size, 0),
            opendataFiles: dataFiles.filter(f => f.isOpendata).length,
            dailyFiles: dataFiles.filter(f => f.isDaily).length,
            domainFiles: dataFiles.filter(f => f.isDomains).length,
            validesFiles: dataFiles.filter(f => f.isValides).length,
            whoisFiles: dataFiles.filter(f => f.isWhois).length
        };
    }

    // Obtenir les statistiques détaillées
    getDetailedStats() {
        const dataFiles = this.getDataFiles();
        
        const stats = {
            data: {
                total: dataFiles.length,
                byType: {
                    opendata: dataFiles.filter(f => f.isOpendata),
                    daily: dataFiles.filter(f => f.isDaily),
                    domains: dataFiles.filter(f => f.isDomains),
                    valides: dataFiles.filter(f => f.isValides),
                    whois: dataFiles.filter(f => f.isWhois),
                    other: dataFiles.filter(f => !f.isOpendata && !f.isDaily && !f.isDomains && !f.isValides && !f.isWhois)
                },
                totalSize: dataFiles.reduce((sum, file) => sum + file.size, 0)
            }
        };
        
        return stats;
    }

    // Obtenir un aperçu d'un fichier CSV
    async getCSVPreview(filePath, lines = 10) {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const preview = [];
            let previewCount = 0;
            let totalLines = 0;

            return new Promise((resolve, reject) => {
                const stream = fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row) => {
                        if (previewCount < lines) {
                            preview.push(row);
                            previewCount++;
                        }
                        totalLines++;
                    })
                    .on('end', () => {
                        resolve({
                            preview,
                            totalLines,
                            hasMore: totalLines > lines
                        });
                    })
                    .on('error', (error) => {
                        reject(error);
                    });
            });
        } catch (error) {
            console.error('Erreur lors de la lecture du fichier CSV:', error);
            return null;
        }
    }

    // Obtenir les colonnes d'un fichier CSV
    async getCSVColumns(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return [];
            }

            return new Promise((resolve, reject) => {
                const columns = [];
                let firstRow = true;
                
                const stream = fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row) => {
                        if (firstRow) {
                            columns.push(...Object.keys(row));
                            firstRow = false;
                            stream.destroy();
                        }
                    })
                    .on('end', () => {
                        resolve(columns);
                    })
                    .on('error', (error) => {
                        reject(error);
                    });
            });
        } catch (error) {
            console.error('Erreur lors de la lecture des colonnes CSV:', error);
            return [];
        }
    }

    // Supprimer un fichier
    deleteFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const filename = path.basename(filePath);
                fs.unlinkSync(filePath);
                // Supprimer aussi du registre
                this.removeFileFromRegistry(filename);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Erreur lors de la suppression du fichier:', error);
            return false;
        }
    }

    // Obtenir la taille d'un fichier
    getFileSize(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                return stats.size;
            }
            return 0;
        } catch (error) {
            console.error('Erreur lors de la lecture de la taille du fichier:', error);
            return 0;
        }
    }

    // Vérifier si un fichier existe
    fileExists(filePath) {
        return fs.existsSync(filePath);
    }

    // Obtenir les métadonnées complètes d'un fichier CSV
    async getFileMetadata(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const stats = fs.statSync(filePath);
            const columns = await this.getCSVColumns(filePath);
            
            // Compter le nombre de lignes
            const lineCount = await this.getCSVLineCount(filePath);
            
            return {
                filename: path.basename(filePath),
                size: stats.size,
                modified: stats.mtime,
                columns: columns,
                totalLines: lineCount,
                fileType: this.getFileType(path.basename(filePath)),
                isOpendata: this.isOpendataFile(path.basename(filePath)),
                isDaily: this.isDailyFile(path.basename(filePath)),
                isDomains: this.isDomainsFile(path.basename(filePath)),
                isValides: this.isValidesFile(path.basename(filePath)),
                isWhois: this.isWhoisFile(path.basename(filePath))
            };
        } catch (error) {
            console.error('Erreur lors de la lecture des métadonnées du fichier:', error);
            return null;
        }
    }

    // Compter le nombre de lignes d'un fichier CSV (optimisé)
    async getCSVLineCount(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return 0;
            }

            const filename = path.basename(filePath);
            const registry = this.loadFilesRegistry();
            
            // Utiliser la valeur du registre si elle existe et est > 0
            if (registry[filename] && typeof registry[filename].totalLines === 'number' && registry[filename].totalLines > 0) {
                return registry[filename].totalLines;
            }

            // Calculer le nombre de lignes seulement si pas déjà dans le registre
            return new Promise((resolve, reject) => {
                let lineCount = 0;
                let isFirstLine = true;
                const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
                    .on('data', (chunk) => {
                        const lines = chunk.split('\n');
                        for (let i = 0; i < lines.length; i++) {
                            if (i === 0 && isFirstLine) {
                                isFirstLine = false;
                                continue;
                            }
                            if (lines[i].trim()) {
                                lineCount++;
                            }
                        }
                    })
                    .on('end', () => {
                        // Mettre à jour le registre seulement si le nombre de lignes n'était pas déjà présent
                        if (!registry[filename] || typeof registry[filename].totalLines !== 'number' || registry[filename].totalLines === 0) {
                            this.updateFileInfo(filename, { totalLines: lineCount });
                        }
                        resolve(lineCount);
                    })
                    .on('error', (error) => {
                        reject(error);
                    });
            });
        } catch (error) {
            console.error('Erreur lors du comptage des lignes CSV:', error);
            return 0;
        }
    }

    // Fusionner plusieurs fichiers CSV
    async mergeFiles(filenames) {
        try {
            const filePaths = [];
            const existingFiles = [];
            
            // Vérifier l'existence des fichiers et récupérer leurs chemins
            for (const filename of filenames) {
                const filePath = path.join(this.dataDir, filename);
                if (fs.existsSync(filePath)) {
                    filePaths.push(filePath);
                    existingFiles.push(filename);
                } else {
                    console.warn(`⚠️ Fichier non trouvé: ${filename}`);
                }
            }
            
            if (existingFiles.length < 2) {
                throw new Error('Au moins 2 fichiers valides requis pour la fusion');
            }
            
            // Générer un nom de fichier pour la fusion
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const mergedFileName = `merged_${timestamp}.csv`;
            const mergedFilePath = path.join(this.dataDir, mergedFileName);
            
            console.log(`🔄 Fusion de ${existingFiles.length} fichiers vers: ${mergedFileName}`);
            
            // Lire les en-têtes du premier fichier
            const firstFileColumns = await this.getCSVColumns(filePaths[0]);
            if (firstFileColumns.length === 0) {
                throw new Error('Impossible de lire les colonnes du premier fichier');
            }
            
            // Créer le fichier de fusion avec les en-têtes
            const writeStream = fs.createWriteStream(mergedFilePath);
            writeStream.write(firstFileColumns.join(',') + '\n');
            
            let totalLines = 0;
            
            // Fusionner chaque fichier
            for (const filePath of filePaths) {
                console.log(`📄 Traitement de: ${path.basename(filePath)}`);
                
                const fileLines = await new Promise((resolve, reject) => {
                    let lines = 0;
                    const readStream = fs.createReadStream(filePath)
                        .pipe(csv())
                        .on('data', (row) => {
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
                        })
                        .on('end', () => {
                            resolve(lines);
                        })
                        .on('error', (error) => {
                            reject(error);
                        });
                });
                
                totalLines += fileLines;
                console.log(`✅ ${fileLines} lignes ajoutées depuis ${path.basename(filePath)}`);
            }
            
            writeStream.end();
            
            // Attendre que l'écriture soit terminée
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
            
            console.log(`✅ Fusion terminée: ${totalLines} lignes dans ${mergedFileName}`);
            
            return {
                mergedFileName,
                totalLines,
                mergedFiles: existingFiles,
                filePath: mergedFilePath
            };
            
        } catch (error) {
            console.error('❌ Erreur lors de la fusion des fichiers:', error);
            throw error;
        }
    }
}

module.exports = FileService; 