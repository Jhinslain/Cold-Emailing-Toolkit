const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

async function filterByLocation(inputFile, outputFile, filterType, filterValue) {
    console.log(`🗺️ Filtrage par localisation: ${filterType}`);
    console.log(`🔍 Critère: ${filterValue}`);
    console.log('=====================================\n');

    const results = [];
    let totalLines = 0;
    let filteredLines = 0;
    let availableColumns = null;

    return new Promise((resolve, reject) => {
        fs.createReadStream(inputFile)
            .pipe(csv({ separator: ';' }))
            .on('data', (row) => {
                totalLines++;
                
                                // Capturer les colonnes disponibles lors de la première ligne
                if (totalLines === 1) {
                    availableColumns = Object.keys(row);
                }
                
                let match = false;
                let searchColumn = '';
                
                switch (filterType) {
                    case 'ville':
                        // Utiliser spécifiquement whois_locality
                        searchColumn = 'whois_locality';
                        const locality = row[searchColumn] || '';
                        if (locality.toLowerCase().includes(filterValue.toLowerCase())) {
                            match = true;
                        }
                        break;
                        
                    case 'departement':
                        // Utiliser spécifiquement whois_postal_code
                        searchColumn = 'whois_postal_code';
                        const postalCode = row[searchColumn] || '';
                        if (postalCode.startsWith(filterValue)) {
                            match = true;
                        }
                        break;
                        
                    case 'region':
                        // Utiliser spécifiquement whois_region
                        searchColumn = 'whois_region';
                        const region = row[searchColumn] || '';
                        if (region.toLowerCase().includes(filterValue.toLowerCase())) {
                            match = true;
                        }
                        break;
                }
                
                if (match) {
                    results.push(row);
                    filteredLines++;
                }
            })
            .on('end', async () => {
                console.log(`📊 Statistiques:`);
                console.log(`   Total de lignes traitées: ${totalLines.toLocaleString()}`);
                console.log(`   Lignes filtrées: ${filteredLines.toLocaleString()}`);
                console.log(`   Taux de filtrage: ${((filteredLines / totalLines) * 100).toFixed(2)}%`);
                
                if (filteredLines === 0) {
                    console.log('\n⚠️ Aucune ligne ne correspond aux critères de filtrage');
                    console.log('💡 Suggestions:');
                    console.log('   - Vérifiez que le fichier contient les colonnes whois_locality, whois_postal_code, whois_region');
                    console.log('   - Essayez une valeur de recherche différente');
                    console.log('   - Vérifiez les colonnes disponibles ci-dessus');
                    
                    // Afficher quelques exemples de valeurs pour aider
                    if (availableColumns) {
                        console.log('\n🔍 Exemples de valeurs dans les colonnes WHOIS:');
                        const sampleData = [];
                        const stream = fs.createReadStream(inputFile).pipe(csv({ separator: ';' }));
                        
                        stream.on('data', (row) => {
                            if (sampleData.length < 5) {
                                const sample = {};
                                // Afficher seulement les colonnes WHOIS spécifiques
                                const whoisColumns = ['whois_locality', 'whois_postal_code', 'whois_region'];
                                whoisColumns.forEach(col => {
                                    if (row[col]) {
                                        sample[col] = row[col];
                                    }
                                });
                                if (Object.keys(sample).length > 0) {
                                    sampleData.push(sample);
                                }
                            }
                        });
                        
                        stream.on('end', () => {
                            if (sampleData.length > 0) {
                                sampleData.forEach((sample, index) => {
                                    console.log(`   Ligne ${index + 1}:`, sample);
                                });
                            } else {
                                console.log('   Aucune donnée trouvée dans les colonnes whois_locality, whois_postal_code, whois_region');
                            }
                            resolve();
                        });
                        
                        stream.on('error', () => {
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                    return;
                }
                
                // Écrire le fichier de sortie
                try {
                    const csvWriter = createCsvWriter({
                        path: outputFile,
                        header: Object.keys(results[0]).map(key => ({
                            id: key,
                            title: key
                        }))
                    });
                    
                    await csvWriter.writeRecords(results);
                    
                    console.log(`\n✅ Fichier filtré sauvegardé: ${path.basename(outputFile)}`);
                    console.log(`📁 Chemin complet: ${outputFile}`);
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// Fonction principale si le script est exécuté directement
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length !== 4) {
        console.log('❌ Usage: node filter_by_location.cjs <inputFile> <outputFile> <filterType> <filterValue>');
        console.log('   filterType: ville, departement, ou region');
        console.log('   filterValue: valeur à rechercher');
        process.exit(1);
    }
    
    const [inputFile, outputFile, filterType, filterValue] = args;
    
    // Vérifier que le fichier d'entrée existe
    if (!fs.existsSync(inputFile)) {
        console.log(`❌ Fichier d'entrée non trouvé: ${inputFile}`);
        process.exit(1);
    }
    
    // Vérifier le type de filtre
    if (!['ville', 'departement', 'region'].includes(filterType)) {
        console.log('❌ Type de filtre invalide. Utilisez: ville, departement, ou region');
        process.exit(1);
    }
    
    try {
        await filterByLocation(inputFile, outputFile, filterType, filterValue);
        console.log('\n🎉 Filtrage terminé avec succès!');
    } catch (error) {
        console.error('❌ Erreur lors du filtrage:', error.message);
        process.exit(1);
    }
}

// Exporter la fonction pour une utilisation externe
module.exports = { filterByLocation };

// Exécuter le script si appelé directement
if (require.main === module) {
    main();
} 