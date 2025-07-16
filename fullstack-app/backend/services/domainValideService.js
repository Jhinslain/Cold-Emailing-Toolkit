const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CHUNK_SIZE = 10000; // Traiter 10k lignes à la fois

async function processDomainesValides(inputFile, outputFile) {
    console.log('🚀 Début du traitement des domaines valides...');
    console.log(`📁 Fichier d'entrée: ${inputFile}`);
    console.log(`📁 Fichier de sortie: ${outputFile}`);
    
    // Créer le dossier de sortie s'il n'existe pas
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Créer le dossier temp
    const tempDir = path.join(outputDir, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    let totalLines = 0;
    let validLines = 0;
    let chunkNumber = 0;
    let header = null;
    let isFirstChunk = true;
    
    try {
        // Compter le nombre total de lignes
        console.log('📊 Comptage des lignes totales...');
        const lineCount = await countLines(inputFile);
        console.log(`📊 Total des lignes: ${lineCount.toLocaleString()}`);
        
        // Créer le flux de lecture
        const fileStream = fs.createReadStream(inputFile, { encoding: 'utf8' });
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
                await processChunk(currentChunk, header, chunkNumber, isFirstChunk, tempDir);
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
            await processChunk(currentChunk, header, chunkNumber, isFirstChunk, tempDir);
            validLines += currentChunk.filter(line => isValidDomain(line)).length;
        }
        
        // Fusionner tous les fichiers temporaires
        console.log('🔗 Fusion des fichiers temporaires...');
        await mergeTempFiles(chunkNumber, outputFile, tempDir);
        
        // Nettoyer les fichiers temporaires
        console.log('🧹 Nettoyage des fichiers temporaires...');
        await cleanupTempFiles(chunkNumber, tempDir);
        // Supprimer le dossier temp
        if (fs.existsSync(tempDir)) {
            fs.rmdirSync(tempDir, { recursive: true });
        }
        // Supprimer l'ancien fichier CSV d'entrée
        if (fs.existsSync(inputFile)) {
            fs.unlinkSync(inputFile);
        }
        
        console.log('✅ Traitement terminé avec succès!');
        console.log(`📊 Statistiques:`);
        console.log(`   - Lignes totales traitées: ${totalLines.toLocaleString()}`);
        console.log(`   - Domaines valides conservés: ${validLines.toLocaleString()}`);
        console.log(`   - Domaines supprimés: ${(totalLines - validLines).toLocaleString()}`);
        console.log(`   - Taux de conservation: ${((validLines / totalLines) * 100).toFixed(2)}%`);
        console.log(`📁 Fichier de sortie: ${outputFile}`);
        
        return {
            success: true,
            totalLines,
            validLines,
            removedLines: totalLines - validLines,
            retentionRate: ((validLines / totalLines) * 100).toFixed(2),
            outputFile
        };
        
    } catch (error) {
        console.error('❌ Erreur lors du traitement:', error);
        return {
            success: false,
            error: error.message
        };
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

async function processChunk(chunk, header, chunkNumber, isFirstChunk, tempDir) {
    const tempFile = path.join(tempDir, `chunk_${chunkNumber.toString().padStart(4, '0')}.csv`);
    
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

async function mergeTempFiles(totalChunks, outputFile, tempDir) {
    const writeStream = fs.createWriteStream(outputFile, { encoding: 'utf8' });
    
    for (let i = 0; i <= totalChunks; i++) {
        const tempFile = path.join(tempDir, `chunk_${i.toString().padStart(4, '0')}.csv`);
        
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

async function cleanupTempFiles(totalChunks, tempDir) {
    for (let i = 0; i <= totalChunks; i++) {
        const tempFile = path.join(tempDir, `chunk_${i.toString().padStart(4, '0')}.csv`);
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

module.exports = { 
    processDomainesValides, 
    isValidDomain 
}; 