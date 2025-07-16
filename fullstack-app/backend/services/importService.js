const fs = require('fs');
const path = require('path');
const readline = require('readline');

class ImportService {
    constructor(dataDir) {
        this.dataDir = dataDir;
    }

    // Fonction pour parser une ligne CSV en tenant compte des virgules dans les champs
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        // Ajouter le dernier champ
        result.push(current.trim());
        
        return result;
    }

    // Détecter le type de fichier basé sur le nom
    detectFileType(filename) {
        const lowerName = filename.toLowerCase();
        
        if (lowerName.includes('opendata') || lowerName.includes('afnic')) {
            return 'afnic';
        }
        if (lowerName.includes('whois')) {
            return 'whois';
        }
        if (lowerName.includes('valides') || lowerName.includes('valid')) {
            return 'valides';
        }
        if (lowerName.includes('daily')) {
            return 'daily';
        }
        if (lowerName.includes('domains') || lowerName.includes('extracted')) {
            return 'domains';
        }
        if (lowerName.includes('filtre') || lowerName.includes('filter')) {
            return 'classique';
        }
        
        return 'classique';
    }

    // Extraire les dates du nom de fichier
    extractDatesFromFilename(filename) {
        const dates = [];
        const datePattern = /(\d{1,2})-(\d{1,2})-(\d{4})/g;
        let match;
        
        while ((match = datePattern.exec(filename)) !== null) {
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];
            dates.push(`${day}-${month}-${year}`);
        }
        
        return dates;
    }

    // Analyser le contenu du fichier pour détecter les dates
    async analyzeFileContent(filePath) {
        const dates = new Set();
        const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
        const fileRl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let lineCount = 0;
        let header = null;
        let dateColumnIndex = -1;

        for await (const line of fileRl) {
            lineCount++;
            
            if (lineCount === 1) {
                header = this.parseCSVLine(line);
                // Chercher une colonne de date
                dateColumnIndex = header.findIndex(col => 
                    col.toLowerCase().includes('date') || 
                    col.toLowerCase().includes('création') ||
                    col.toLowerCase().includes('creation')
                );
                continue;
            }

            if (dateColumnIndex !== -1) {
                const columns = this.parseCSVLine(line);
                if (columns[dateColumnIndex]) {
                    const dateValue = columns[dateColumnIndex];
                    // Extraire la date si elle est au format DD-MM-YYYY
                    const dateMatch = dateValue.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
                    if (dateMatch) {
                        const day = dateMatch[1].padStart(2, '0');
                        const month = dateMatch[2].padStart(2, '0');
                        const year = dateMatch[3];
                        dates.add(`${day}-${month}-${year}`);
                    }
                }
            }

            // Limiter l'analyse aux 1000 premières lignes pour la performance
            if (lineCount > 1000) break;
        }

        fileRl.close();
        return Array.from(dates).sort();
    }

    // Compter le nombre de lignes dans le fichier
    async countLines(filePath) {
        return new Promise((resolve, reject) => {
            let lineCount = 0;
            const rl = readline.createInterface({
                input: fs.createReadStream(filePath, { encoding: 'utf8' }),
                crlfDelay: Infinity
            });
            
            rl.on('line', () => {
                lineCount++;
            });
            
            rl.on('close', () => {
                resolve(lineCount);
            });
            
            rl.on('error', reject);
        });
    }

    // Importer un fichier CSV
    async importCSVFile(originalFilename, tempFilePath) {
        try {
            console.log(`📁 Import du fichier: ${originalFilename}`);
            
            // Générer un nom de fichier unique
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const extension = path.extname(originalFilename);
            const baseName = path.basename(originalFilename, extension);
            const newFilename = `${baseName}_${timestamp}${extension}`;
            const finalPath = path.join(this.dataDir, newFilename);
            
            // Copier le fichier vers le dossier data
            fs.copyFileSync(tempFilePath, finalPath);
            
            // Analyser le fichier
            const fileType = this.detectFileType(originalFilename);
            const filenameDates = this.extractDatesFromFilename(originalFilename);
            const contentDates = await this.analyzeFileContent(finalPath);
            const totalLines = await this.countLines(finalPath);
            
            // Combiner les dates du nom et du contenu
            const allDates = [...new Set([...filenameDates, ...contentDates])].sort();
            
            console.log(`📊 Analyse du fichier:`);
            console.log(`   Type détecté: ${fileType}`);
            console.log(`   Dates dans le nom: ${filenameDates.length}`);
            console.log(`   Dates dans le contenu: ${contentDates.length}`);
            console.log(`   Total de lignes: ${totalLines.toLocaleString()}`);
            
            // Créer les métadonnées pour le registre
            const fileInfo = {
                size: fs.statSync(finalPath).size,
                modified: new Date().toISOString(),
                type: fileType,
                totalLines: totalLines,
                lastUpdated: new Date().toISOString(),
                dates: allDates,
                localisations: [],
                mergedFrom: []
            };
            
            return {
                success: true,
                filename: newFilename,
                originalName: originalFilename,
                fileInfo: fileInfo,
                totalLines: totalLines,
                detectedType: fileType,
                dates: allDates
            };
            
        } catch (error) {
            console.error('❌ Erreur lors de l\'import:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = ImportService; 