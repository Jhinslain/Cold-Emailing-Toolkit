const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration pour le test
const INPUT_FILE = path.join(__dirname, '..', 'data', 'data_extrait.csv');
const OUTPUT_FILE = path.join(__dirname, '..', 'output', 'test_domaines_valides.csv');
const TEST_LINES = 1000; // Tester seulement 1000 lignes

async function testDomainesValides() {
    console.log('🧪 Test du traitement des domaines valides...');
    console.log(`📁 Fichier d'entrée: ${INPUT_FILE}`);
    console.log(`📁 Fichier de sortie: ${OUTPUT_FILE}`);
    console.log(`📊 Lignes à tester: ${TEST_LINES}`);
    
    let totalLines = 0;
    let validLines = 0;
    let header = null;
    const validDomains = [];
    
    try {
        // Créer le flux de lecture
        const fileStream = fs.createReadStream(INPUT_FILE, { encoding: 'utf8' });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        
        for await (const line of rl) {
            totalLines++;
            
            // Sauvegarder l'en-tête
            if (totalLines === 1) {
                header = line;
                continue;
            }
            
            // Vérifier si le domaine est valide
            if (isValidDomain(line)) {
                validDomains.push(line);
                validLines++;
            }
            
            // Arrêter après le nombre de lignes de test
            if (totalLines >= TEST_LINES) {
                break;
            }
        }
        
        // Écrire le fichier de test
        let content = header + '\n';
        content += validDomains.join('\n');
        
        // Créer le dossier output s'il n'existe pas
        if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
            fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
        }
        
        fs.writeFileSync(OUTPUT_FILE, content, 'utf8');
        
        console.log('✅ Test terminé avec succès!');
        console.log(`📊 Statistiques du test:`);
        console.log(`   - Lignes testées: ${totalLines.toLocaleString()}`);
        console.log(`   - Domaines valides: ${validLines.toLocaleString()}`);
        console.log(`   - Domaines supprimés: ${(totalLines - validLines).toLocaleString()}`);
        console.log(`   - Taux de conservation: ${((validLines / totalLines) * 100).toFixed(2)}%`);
        console.log(`📁 Fichier de test: ${OUTPUT_FILE}`);
        
    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
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

// Lancer le test
if (require.main === module) {
    testDomainesValides();
}

module.exports = { testDomainesValides, isValidDomain }; 