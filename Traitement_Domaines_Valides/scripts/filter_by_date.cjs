const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const INPUT_FILE = path.join(__dirname, '..', 'output', 'domaines_valides.csv');
const OUTPUT_FILE = path.join(__dirname, '..', 'output', 'domaines_filtres_date.csv');

// Fonction pour parser une date au format DD-MM-YYYY
function parseDate(dateStr) {
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

// Fonction pour formater une date en DD-MM-YYYY
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

async function filterByDate(startDateStr, endDateStr) {
    console.log('📅 Filtrage des domaines par période spécifique...');
    console.log(`📁 Fichier d'entrée: ${INPUT_FILE}`);
    console.log(`📁 Fichier de sortie: ${OUTPUT_FILE}`);
    
    try {
        // Parser les dates d'entrée
        const startDate = parseDate(startDateStr);
        const endDate = parseDate(endDateStr);
        
        if (!startDate || !endDate) {
            console.log('❌ Format de date invalide. Utilisez le format DD-MM-YYYY (ex: 26-05-2025)');
            return;
        }
        
        // Déterminer la date de début et de fin (peu importe l'ordre d'entrée)
        const actualStartDate = startDate < endDate ? startDate : endDate;
        const actualEndDate = startDate < endDate ? endDate : startDate;
        
        console.log(`✅ Filtrage des domaines créés entre ${formatDate(actualStartDate)} et ${formatDate(actualEndDate)}`);
        console.log(`📅 Date de début: ${formatDate(actualStartDate)}`);
        console.log(`📅 Date de fin: ${formatDate(actualEndDate)}`);
        
        // Vérifier si le fichier d'entrée existe
        if (!fs.existsSync(INPUT_FILE)) {
            console.log('❌ Fichier d\'entrée non trouvé. Veuillez d\'abord exécuter le traitement complet (option 2).');
            return;
        }
        
        console.log('\n🔄 Lecture et filtrage en cours...');
        
        let totalLines = 0;
        let filteredLines = 0;
        let header = null;
        const filteredDomains = [];
        
        // Créer le flux de lecture
        const fileStream = fs.createReadStream(INPUT_FILE, { encoding: 'utf8' });
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
                process.stdout.write(`\r📊 Lignes traitées: ${totalLines.toLocaleString()} | Domaines filtrés: ${filteredLines.toLocaleString()}`);
            }
        }
        
        // Fermer l'interface de lecture du fichier
        fileRl.close();
        
        console.log('\n💾 Écriture du fichier de sortie...');
        
        // Écrire le fichier filtré
        let content = header + '\n';
        content += filteredDomains.join('\n');
        
        // Créer le dossier output s'il n'existe pas
        if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
            fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
        }
        
        fs.writeFileSync(OUTPUT_FILE, content, 'utf8');
        
        console.log('\n✅ Filtrage terminé avec succès!');
        console.log(`📊 Statistiques du filtrage:`);
        console.log(`   - Lignes analysées: ${totalLines.toLocaleString()}`);
        console.log(`   - Domaines filtrés: ${filteredLines.toLocaleString()}`);
        console.log(`   - Domaines exclus: ${(totalLines - filteredLines).toLocaleString()}`);
        console.log(`   - Taux de conservation: ${((filteredLines / totalLines) * 100).toFixed(2)}%`);
        console.log(`📁 Fichier filtré: ${OUTPUT_FILE}`);
        
    } catch (error) {
        console.error('❌ Erreur lors du filtrage:', error.message);
        process.exit(1);
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
        
        // Parser la date de création
        const creationDate = parseDate(creationDateStr);
        
        if (!creationDate) {
            return false; // Date invalide = exclu
        }
        
        // Le domaine est inclus si sa date de création est >= à la date de début ET <= à la date de fin
        return creationDate >= startDate && creationDate <= endDate;
        
    } catch (error) {
        return false; // En cas d'erreur, on exclut le domaine
    }
}

// Lancer le filtrage
if (require.main === module) {
    // Récupérer les arguments de ligne de commande
    const startDateStr = process.argv[2];
    const endDateStr = process.argv[3];
    
    if (!startDateStr || !endDateStr) {
        console.log('❌ Usage: node filter_by_date.cjs <date_debut> <date_fin>');
        console.log('📅 Format des dates: DD-MM-YYYY (ex: 26-05-2025)');
        console.log('💡 Exemple: node filter_by_date.cjs 26-05-2025 30-05-2025');
        console.log('💡 L\'ordre des dates n\'importe pas: node filter_by_date.cjs 30-05-2025 26-05-2025');
        process.exit(1);
    }
    
    filterByDate(startDateStr, endDateStr);
}

module.exports = { filterByDate, isDomainInPeriod, parseDate, formatDate }; 