const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const INPUT_FILE = path.join(__dirname, '..', 'data', 'data_extrait.csv');
const OUTPUT_FILE = path.join(__dirname, '..', 'output', 'domaines_valides.csv');
const CHUNK_SIZE = 10000; // Traiter 10k lignes à la fois
const TEMP_DIR = path.join(__dirname, '..', 'temp');

// Créer le dossier temp s'il n'existe pas
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Créer le dossier output s'il n'existe pas
if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
}

async function processDomainesValides() {
    console.log('🚀 Début du traitement des domaines valides...');
    console.log(`📁 Fichier d'entrée: ${INPUT_FILE}`);
    console.log(`📁 Fichier de sortie: ${OUTPUT_FILE}`);
    
    let totalLines = 0;
    let validLines = 0;
    let chunkNumber = 0;
    let header = null;
    let isFirstChunk = true;
    
    try {
        // Compter le nombre total de lignes
        console.log('📊 Comptage des lignes totales...');
        const lineCount = await countLines(INPUT_FILE);
        console.log(`📊 Total des lignes: ${lineCount.toLocaleString()}`);
        
        // Créer le flux de lecture
        const fileStream = fs.createReadStream(INPUT_FILE, { encoding: 'utf8' });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        
        let currentChunk = [];
        
        for await (const line of rl) {
            totalLines++;
            
            // Sauvegarder l'en-tête
            if (totalLines === 1) {
                header = line;
                continue;
            }
            
            // Ajouter la ligne au chunk actuel
            currentChunk.push(line);
            
            // Traiter le chunk quand il atteint la taille définie
            if (currentChunk.length >= CHUNK_SIZE) {
                await processChunk(currentChunk, header, chunkNumber, isFirstChunk);
                validLines += currentChunk.filter(line => isValidDomain(line)).length;
                chunkNumber++;
                isFirstChunk = false;
                currentChunk = [];
                
                // Afficher le progrès
                const progress = ((totalLines / lineCount) * 100).toFixed(2);
                console.log(`📈 Progression: ${progress}% (${totalLines.toLocaleString()}/${lineCount.toLocaleString()} lignes traitées)`);
            }
        }
        
        // Traiter le dernier chunk s'il reste des lignes
        if (currentChunk.length > 0) {
            await processChunk(currentChunk, header, chunkNumber, isFirstChunk);
            validLines += currentChunk.filter(line => isValidDomain(line)).length;
        }
        
        // Fusionner tous les fichiers temporaires
        console.log('🔗 Fusion des fichiers temporaires...');
        await mergeTempFiles(chunkNumber);
        
        // Nettoyer les fichiers temporaires
        console.log('🧹 Nettoyage des fichiers temporaires...');
        await cleanupTempFiles(chunkNumber);
        
        console.log('✅ Traitement terminé avec succès!');
        console.log(`📊 Statistiques:`);
        console.log(`   - Lignes totales traitées: ${totalLines.toLocaleString()}`);
        console.log(`   - Domaines valides conservés: ${validLines.toLocaleString()}`);
        console.log(`   - Domaines supprimés: ${(totalLines - validLines).toLocaleString()}`);
        console.log(`   - Taux de conservation: ${((validLines / totalLines) * 100).toFixed(2)}%`);
        console.log(`📁 Fichier de sortie: ${OUTPUT_FILE}`);
        
    } catch (error) {
        console.error('❌ Erreur lors du traitement:', error);
        process.exit(1);
    }
}

function isValidDomain(line) {
    try {
        // Diviser la ligne par les points-virgules (format CSV)
        const columns = line.split(';');
        
        // La colonne "Date de retrait du WHOIS" est à l'index 11 (12ème colonne)
        const withdrawalDate = columns[11];
        
        // Un domaine est valide si la date de retrait est vide ou null
        return !withdrawalDate || withdrawalDate.trim() === '';
        
    } catch (error) {
        console.warn(`⚠️ Erreur lors de l'analyse de la ligne: ${line.substring(0, 100)}...`);
        return false; // En cas d'erreur, on considère le domaine comme invalide
    }
}

async function processChunk(chunk, header, chunkNumber, isFirstChunk) {
    const tempFile = path.join(TEMP_DIR, `chunk_${chunkNumber.toString().padStart(4, '0')}.csv`);
    
    // Filtrer les domaines valides
    const validDomains = chunk.filter(line => isValidDomain(line));
    
    // Écrire dans le fichier temporaire
    let content = '';
    if (isFirstChunk) {
        content = header + '\n'; // Ajouter l'en-tête seulement pour le premier chunk
    }
    content += validDomains.join('\n');
    
    if (validDomains.length > 0) {
        fs.writeFileSync(tempFile, content, 'utf8');
        console.log(`💾 Chunk ${chunkNumber}: ${validDomains.length}/${chunk.length} domaines valides sauvegardés`);
    }
}

async function mergeTempFiles(totalChunks) {
    const writeStream = fs.createWriteStream(OUTPUT_FILE, { encoding: 'utf8' });
    
    for (let i = 0; i <= totalChunks; i++) {
        const tempFile = path.join(TEMP_DIR, `chunk_${i.toString().padStart(4, '0')}.csv`);
        
        if (fs.existsSync(tempFile)) {
            const content = fs.readFileSync(tempFile, 'utf8');
            writeStream.write(content);
            if (i < totalChunks) {
                writeStream.write('\n'); // Ajouter une nouvelle ligne entre les chunks
            }
        }
    }
    
    writeStream.end();
    
    return new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });
}

async function cleanupTempFiles(totalChunks) {
    for (let i = 0; i <= totalChunks; i++) {
        const tempFile = path.join(TEMP_DIR, `chunk_${i.toString().padStart(4, '0')}.csv`);
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
    }
}

async function countLines(filePath) {
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
    processDomainesValides();
}

module.exports = { processDomainesValides, isValidDomain };
