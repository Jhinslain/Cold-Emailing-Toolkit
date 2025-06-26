const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Charger la configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'config_domaines.json'), 'utf8'));

// Configuration
const INPUT_FILE = path.join(__dirname, '..', config.input.file);
const OUTPUT_FILE = path.join(__dirname, '..', config.output.file);
const CHUNK_SIZE = config.processing.chunk_size;
const TEMP_DIR = path.join(__dirname, '..', 'temp');

// Créer les dossiers nécessaires
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
}

class DomainProcessor {
    constructor() {
        this.totalLines = 0;
        this.validLines = 0;
        this.invalidLines = 0;
        this.errorLines = 0;
        this.chunkNumber = 0;
        this.header = null;
        this.isFirstChunk = true;
        this.startTime = Date.now();
    }

    async process() {
        console.log('🚀 Début du traitement avancé des domaines valides...');
        console.log(`📁 Fichier d'entrée: ${INPUT_FILE}`);
        console.log(`📁 Fichier de sortie: ${OUTPUT_FILE}`);
        console.log(`⚙️ Taille des chunks: ${CHUNK_SIZE.toLocaleString()}`);
        
        try {
            // Compter le nombre total de lignes
            console.log('📊 Comptage des lignes totales...');
            const lineCount = await this.countLines(INPUT_FILE);
            console.log(`📊 Total des lignes: ${lineCount.toLocaleString()}`);
            
            // Traiter le fichier
            await this.processFile(lineCount);
            
            // Fusionner les fichiers temporaires
            console.log('🔗 Fusion des fichiers temporaires...');
            await this.mergeTempFiles();
            
            // Nettoyer les fichiers temporaires
            if (config.performance.temp_file_cleanup) {
                console.log('🧹 Nettoyage des fichiers temporaires...');
                await this.cleanupTempFiles();
            }
            
            this.printFinalStats();
            
        } catch (error) {
            console.error('❌ Erreur lors du traitement:', error);
            process.exit(1);
        }
    }

    async processFile(totalLines) {
        const fileStream = fs.createReadStream(INPUT_FILE, { encoding: config.input.encoding });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        
        let currentChunk = [];
        
        for await (const line of rl) {
            this.totalLines++;
            
            // Sauvegarder l'en-tête
            if (this.totalLines === 1) {
                this.header = line;
                continue;
            }
            
            // Vérifier si la ligne est vide
            if (config.validation.skip_empty_lines && line.trim() === '') {
                continue;
            }
            
            // Ajouter la ligne au chunk actuel
            currentChunk.push(line);
            
            // Traiter le chunk quand il atteint la taille définie
            if (currentChunk.length >= CHUNK_SIZE) {
                await this.processChunk(currentChunk);
                currentChunk = [];
                
                // Afficher le progrès
                this.printProgress(totalLines);
                
                // Vérifier l'utilisation mémoire
                this.checkMemoryUsage();
            }
        }
        
        // Traiter le dernier chunk s'il reste des lignes
        if (currentChunk.length > 0) {
            await this.processChunk(currentChunk);
            this.printProgress(totalLines);
        }
    }

    async processChunk(chunk) {
        const tempFile = path.join(TEMP_DIR, `chunk_${this.chunkNumber.toString().padStart(4, '0')}.csv`);
        
        const validDomains = [];
        const invalidDomains = [];
        
        // Traiter chaque ligne du chunk
        for (const line of chunk) {
            try {
                if (this.isValidDomain(line)) {
                    validDomains.push(line);
                    this.validLines++;
                } else {
                    invalidDomains.push(line);
                    this.invalidLines++;
                }
            } catch (error) {
                if (config.validation.log_errors) {
                    console.warn(`⚠️ Erreur ligne ${this.totalLines}: ${error.message}`);
                }
                this.errorLines++;
            }
        }
        
        // Écrire dans le fichier temporaire
        if (validDomains.length > 0) {
            let content = '';
            if (this.isFirstChunk) {
                content = this.header + '\n';
                this.isFirstChunk = false;
            }
            content += validDomains.join('\n');
            
            fs.writeFileSync(tempFile, content, config.output.encoding);
            console.log(`💾 Chunk ${this.chunkNumber}: ${validDomains.length}/${chunk.length} domaines valides`);
        }
        
        this.chunkNumber++;
    }

    isValidDomain(line) {
        try {
            // Diviser la ligne par le délimiteur configuré
            const columns = line.split(config.input.delimiter);
            
            // Vérifier que nous avons assez de colonnes
            if (columns.length <= config.columns.withdrawal_date) {
                if (config.validation.skip_malformed_lines) {
                    return false;
                }
                throw new Error('Ligne malformée: pas assez de colonnes');
            }
            
            // La colonne "Date de retrait du WHOIS"
            const withdrawalDate = columns[config.columns.withdrawal_date];
            
            // Un domaine est valide si la date de retrait est vide ou null
            return !withdrawalDate || withdrawalDate.trim() === '';
            
        } catch (error) {
            if (config.validation.skip_malformed_lines) {
                return false;
            }
            throw error;
        }
    }

    printProgress(totalLines) {
        if (config.performance.enable_progress_bar) {
            const progress = ((this.totalLines / totalLines) * 100).toFixed(2);
            const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
            const rate = (this.totalLines / elapsed).toFixed(0);
            
            console.log(`📈 ${progress}% | ${this.totalLines.toLocaleString()}/${totalLines.toLocaleString()} | ${rate} lignes/sec | ${elapsed}s`);
        }
    }

    printFinalStats() {
        const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
        const rate = (this.totalLines / totalTime).toFixed(0);
        
        console.log('\n✅ Traitement terminé avec succès!');
        console.log(`📊 Statistiques finales:`);
        console.log(`   - Temps total: ${totalTime}s (${rate} lignes/sec)`);
        console.log(`   - Lignes totales traitées: ${this.totalLines.toLocaleString()}`);
        console.log(`   - Domaines valides conservés: ${this.validLines.toLocaleString()}`);
        console.log(`   - Domaines supprimés: ${this.invalidLines.toLocaleString()}`);
        console.log(`   - Lignes en erreur: ${this.errorLines.toLocaleString()}`);
        console.log(`   - Taux de conservation: ${((this.validLines / this.totalLines) * 100).toFixed(2)}%`);
        console.log(`📁 Fichier de sortie: ${OUTPUT_FILE}`);
    }

    checkMemoryUsage() {
        const memUsage = process.memoryUsage();
        const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        
        if (memUsageMB > config.processing.memory_limit_mb) {
            console.warn(`⚠️ Utilisation mémoire élevée: ${memUsageMB}MB`);
            global.gc && global.gc(); // Forcer le garbage collection si disponible
        }
    }

    async countLines(filePath) {
        return new Promise((resolve, reject) => {
            let lineCount = 0;
            const rl = readline.createInterface({
                input: fs.createReadStream(filePath, { encoding: config.input.encoding }),
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

    async mergeTempFiles() {
        const writeStream = fs.createWriteStream(OUTPUT_FILE, { encoding: config.output.encoding });
        
        for (let i = 0; i < this.chunkNumber; i++) {
            const tempFile = path.join(TEMP_DIR, `chunk_${i.toString().padStart(4, '0')}.csv`);
            
            if (fs.existsSync(tempFile)) {
                const content = fs.readFileSync(tempFile, config.output.encoding);
                writeStream.write(content);
                if (i < this.chunkNumber - 1) {
                    writeStream.write('\n');
                }
            }
        }
        
        writeStream.end();
        
        return new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
    }

    async cleanupTempFiles() {
        for (let i = 0; i < this.chunkNumber; i++) {
            const tempFile = path.join(TEMP_DIR, `chunk_${i.toString().padStart(4, '0')}.csv`);
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }
}

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    console.error('❌ Erreur non capturée:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesse rejetée non gérée:', reason);
    process.exit(1);
});

// Lancer le traitement
if (require.main === module) {
    const processor = new DomainProcessor();
    processor.process();
}

module.exports = { DomainProcessor }; 