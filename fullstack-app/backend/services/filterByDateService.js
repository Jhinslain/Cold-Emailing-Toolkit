const fs = require('fs');
const path = require('path');
const readline = require('readline');
const csv = require('csv-parser');
const RegistryService = require('./registryService');

// Fonction pour parser une date au format YYYY-MM-DD (format HTML date input)
function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
        return null;
    }
    
    // Format YYYY-MM-DD (format HTML date input)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }
    
    return null;
}

// Fonction pour formater une date en DD-MM-YYYY pour l'affichage
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Fonction pour générer le nom du fichier de sortie basé sur les dates
function generateOutputFileName(startDate, endDate, originalFileName, locationValue = null) {
    // Générer le nom sous la forme domain_dates_date2_loc_[valeur].csv
    const ext = path.extname(originalFileName);
    const base = 'domain';
    const date2 = formatDate(endDate).replace(/\//g, '-');
    
    // Utiliser la valeur de localisation fournie ou une valeur par défaut
    const locValue = locationValue || 'default';
    
    return `${base}_dates_${date2}_loc_${locValue}${ext}`;
}

async function filterByDate(inputFile, startDateStr, endDateStr, locationValue = null) {
    console.log('📅 Filtrage des domaines par période spécifique...');
    console.log(`📁 Fichier d'entrée: ${inputFile}`);
    
    try {
        // Parser les dates d'entrée
        const startDate = parseDate(startDateStr);
        const endDate = parseDate(endDateStr);
        
        if (!startDate || !endDate) {
            throw new Error('Format de date invalide. Utilisez le format YYYY-MM-DD');
        }
        
        // Déterminer la date de début et de fin (peu importe l'ordre d'entrée)
        const actualStartDate = startDate < endDate ? startDate : endDate;
        const actualEndDate = startDate < endDate ? endDate : startDate;
        
        // Vérifier si le fichier d'entrée existe
        if (!fs.existsSync(inputFile)) {
            throw new Error('Fichier d\'entrée non trouvé');
        }
        
        // Générer le nom du fichier de sortie
        const outputFileName = generateOutputFileName(actualStartDate, actualEndDate, path.basename(inputFile), locationValue);
        const outputDir = path.join(__dirname, '..', 'data');
        const outputFile = path.join(outputDir, outputFileName);
        
        console.log(`📁 Fichier de sortie: ${outputFile}`);
        console.log(`✅ Filtrage des domaines créés entre ${formatDate(actualStartDate)} et ${formatDate(actualEndDate)}`);
        if (locationValue) {
            console.log(`📍 Localisation: ${locationValue}`);
        }
        
        // Créer le dossier de sortie s'il n'existe pas
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        console.log('\n🔄 Lecture et filtrage en cours...');
        
        let totalLines = 0;
        let filteredLines = 0;
        let header = null;
        const filteredDomains = [];
        
        // Créer le flux de lecture
        const fileStream = fs.createReadStream(inputFile, { encoding: 'utf8' });
        const fileRl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        
        for await (const line of fileRl) {
            totalLines++;
            
            // Sauvegarder l'en-tête
            if (totalLines === 1) {
                header = line;
                continue;
            }
            
            // Vérifier si le domaine correspond à la période
            const isInPeriod = isDomainInPeriod(line, actualStartDate, actualEndDate);
            
            if (isInPeriod) {
                filteredDomains.push(line);
                filteredLines++;
            }
            
            // Afficher le progrès tous les 1000 lignes
            if (totalLines % 1000 === 0) {
                console.log(`📊 Lignes traitées: ${totalLines.toLocaleString()} | Domaines filtrés: ${filteredLines.toLocaleString()}`);
            }
        }
        
        // Fermer l'interface de lecture du fichier
        fileRl.close();
        
        console.log('\n💾 Écriture du fichier de sortie...');
        
        // Écrire le fichier filtré
        let content = header + '\n';
        content += filteredDomains.join('\n');
        
        fs.writeFileSync(outputFile, content, 'utf8');
        
        console.log('\n✅ Filtrage terminé avec succès!');
        console.log(`📊 Statistiques du filtrage:`);
        console.log(`   - Lignes analysées: ${totalLines.toLocaleString()}`);
        console.log(`   - Domaines filtrés: ${filteredLines.toLocaleString()}`);
        console.log(`   - Domaines exclus: ${(totalLines - filteredLines).toLocaleString()}`);
        console.log(`   - Taux de conservation: ${((filteredLines / totalLines) * 100).toFixed(2)}%`);
        console.log(`📁 Fichier filtré: ${outputFile}`);
        
        // Extraire les dates du contenu filtré et mettre à jour le registre
        const contentDates = await extractDatesFromContent(outputFile);
        await updateRegistryWithDates(outputFileName, contentDates, filteredLines, inputFile);
        
        return {
            success: true,
            totalLines,
            filteredLines,
            excludedLines: totalLines - filteredLines,
            retentionRate: ((filteredLines / totalLines) * 100).toFixed(2),
            outputFile: outputFileName,
            startDate: formatDate(actualStartDate),
            endDate: formatDate(actualEndDate),
            dates: contentDates
        };
        
    } catch (error) {
        console.error('❌ Erreur lors du filtrage:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

function isDomainInPeriod(line, startDate, endDate) {
    try {
        // Diviser la ligne par les points-virgules (format CSV)
        const columns = line.split(';');
        
        // La colonne "Date de création" est à l'index 10 (11ème colonne)
        const creationDateStr = columns[10];
        
        if (!creationDateStr || creationDateStr.trim() === '') {
            return false; // Pas de date = exclu
        }
        
        // Parser la date de création (format DD-MM-YYYY)
        const creationDate = parseCreationDate(creationDateStr);
        
        if (!creationDate) {
            return false; // Date invalide = exclu
        }
        
        // Le domaine est inclus si sa date de création est >= à la date de début ET <= à la date de fin
        return creationDate >= startDate && creationDate <= endDate;
        
    } catch (error) {
        return false; // En cas d'erreur, on exclut le domaine
    }
}

// Fonction pour parser la date de création au format DD-MM-YYYY
function parseCreationDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
        return null;
    }
    
    // Format DD-MM-YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('-');
        const date = new Date(`${year}-${month}-${day}`);
        return isNaN(date.getTime()) ? null : date;
    }
    
    return null;
}

// Extraire les dates du contenu d'un fichier CSV
async function extractDatesFromContent(filePath) {
    return new Promise((resolve, reject) => {
        const dates = new Set();
        
        // Lire le fichier ligne par ligne pour extraire les dates
        const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
        const fileRl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        
        let isFirstLine = true;
        
        fileRl.on('line', (line) => {
            // Ignorer l'en-tête
            if (isFirstLine) {
                isFirstLine = false;
                return;
            }
            
            try {
                // Diviser la ligne par les points-virgules (format CSV)
                const columns = line.split(';');
                
                // La colonne "Date de création" est à l'index 10 (11ème colonne)
                const creationDateStr = columns[10];
                
                if (creationDateStr && creationDateStr.trim() !== '') {
                    // Parser la date de création (format DD-MM-YYYY)
                    const creationDate = parseCreationDate(creationDateStr);
                    if (creationDate) {
                        // Ajouter la date au format DD-MM-YYYY
                        dates.add(formatDate(creationDate));
                    }
                }
            } catch (error) {
                // Ignorer les lignes avec erreur
            }
        });
        
        fileRl.on('close', () => {
            resolve([...dates].sort());
        });
        
        fileRl.on('error', (error) => {
            reject(error);
        });
    });
}

// Mettre à jour le registre avec les dates et le type correct
async function updateRegistryWithDates(filename, dates, totalLines, originalFile) {
    try {
        const registryService = new RegistryService(path.join(__dirname, '..', 'data'));
        
        // Pour les fichiers filtrés par date, le type est toujours "classique"
        const type = 'classique';

        // Mettre à jour le registre avec les bonnes infos
        registryService.updateFileInfo(filename, {
            type,
            totalLines,
            dates,
            localisations: [],
            mergedFrom: []
        });

        console.log(`📅 Registre mis à jour pour ${filename} avec les dates: ${dates.join(', ')}, type: ${type}`);
    } catch (error) {
        console.error('❌ Erreur lors de la mise à jour du registre:', error.message);
    }
}

module.exports = { 
    filterByDate, 
    isDomainInPeriod, 
    parseDate, 
    formatDate,
    generateOutputFileName 
}; 