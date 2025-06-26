const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const INPUT_FILE = path.join(__dirname, '..', 'data', 'data_extrait.csv');

async function examineHeaders() {
    console.log('🔍 Examen des en-têtes du fichier CSV');
    console.log('=====================================\n');
    
    if (!fs.existsSync(INPUT_FILE)) {
        console.log('❌ Fichier d\'entrée non trouvé:', INPUT_FILE);
        return;
    }
    
    try {
        const rl = readline.createInterface({
            input: fs.createReadStream(INPUT_FILE, { encoding: 'utf8' }),
            crlfDelay: Infinity
        });
        
        let lineCount = 0;
        for await (const line of rl) {
            lineCount++;
            
            if (lineCount === 1) {
                console.log('📋 EN-TÊTE DÉTECTÉE:');
                console.log('===================\n');
                
                const columns = line.split(';');
                console.log(`Nombre de colonnes: ${columns.length}\n`);
                
                columns.forEach((col, index) => {
                    console.log(`${String(index).padStart(2, '0')}: "${col}"`);
                });
                
                console.log('\n🔍 ANALYSE DES COLONNES:');
                console.log('=======================\n');
                
                // Chercher des colonnes qui pourraient contenir les fournisseurs
                const possibleProviderColumns = columns.map((col, index) => {
                    const lowerCol = col.toLowerCase();
                    const score = (lowerCol.includes('nom') ? 3 : 0) +
                                (lowerCol.includes('be') ? 2 : 0) +
                                (lowerCol.includes('fournisseur') ? 5 : 0) +
                                (lowerCol.includes('registrar') ? 5 : 0) +
                                (lowerCol.includes('provider') ? 4 : 0) +
                                (lowerCol.includes('hébergeur') ? 4 : 0) +
                                (lowerCol.includes('hosting') ? 3 : 0);
                    
                    return { index, name: col, score };
                }).filter(col => col.score > 0).sort((a, b) => b.score - a.score);
                
                if (possibleProviderColumns.length > 0) {
                    console.log('🏢 Colonnes possibles pour les fournisseurs:');
                    possibleProviderColumns.forEach(col => {
                        console.log(`   Colonne ${col.index}: "${col.name}" (score: ${col.score})`);
                    });
                } else {
                    console.log('❌ Aucune colonne évidente pour les fournisseurs trouvée');
                }
                
                // Chercher des colonnes de dates
                const possibleDateColumns = columns.map((col, index) => {
                    const lowerCol = col.toLowerCase();
                    const score = (lowerCol.includes('date') ? 3 : 0) +
                                (lowerCol.includes('création') ? 2 : 0) +
                                (lowerCol.includes('creation') ? 2 : 0) +
                                (lowerCol.includes('retrait') ? 2 : 0) +
                                (lowerCol.includes('withdrawal') ? 2 : 0);
                    
                    return { index, name: col, score };
                }).filter(col => col.score > 0).sort((a, b) => b.score - a.score);
                
                if (possibleDateColumns.length > 0) {
                    console.log('\n📅 Colonnes possibles pour les dates:');
                    possibleDateColumns.forEach(col => {
                        console.log(`   Colonne ${col.index}: "${col.name}" (score: ${col.score})`);
                    });
                } else {
                    console.log('\n❌ Aucune colonne évidente pour les dates trouvée');
                }
                
                break;
            }
            
            // Afficher aussi quelques lignes de données pour voir le format
            if (lineCount <= 5) {
                console.log(`\n📄 Ligne ${lineCount}:`);
                const columns = line.split(';');
                columns.forEach((col, index) => {
                    console.log(`   ${String(index).padStart(2, '0')}: "${col}"`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'examen:', error);
    }
}

// Lancer l'examen
examineHeaders(); 