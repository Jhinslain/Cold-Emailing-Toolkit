const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Fonction pour parser une ligne CSV en tenant compte des virgules dans les champs
function parseCSVLine(line) {
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

// Fonction pour générer le nom du fichier de sortie basé sur le type de filtre et la valeur
function generateOutputFileName(originalFileName, filterType, filterValues) {
    // Extraire le nom de base du fichier original
    const baseName = path.basename(originalFileName, path.extname(originalFileName));
    
    // Nettoyer les valeurs de filtre pour le nom de fichier (remplacer les caractères spéciaux)
    const cleanFilterValues = filterValues.split(',').map(v => 
        v.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
    ).join('_');
    
    // Format: [nom_fichier_entrée]_loc_[valeurs].csv
    return `${baseName}_loc_${cleanFilterValues}.csv`;
}

async function filterByLocation(inputFile, filterType, filterValue) {
    console.log(`🗺️ Filtrage par localisation: ${filterType}`);
    console.log(`🔍 Critère: ${filterValue}`);
    console.log(`📁 Fichier d'entrée: ${inputFile}`);
    console.log('=====================================\n');

    try {
        // Vérifier si le fichier d'entrée existe
        if (!fs.existsSync(inputFile)) {
            throw new Error('Fichier d\'entrée non trouvé');
        }

        // Vérifier le type de filtre
        if (!['ville', 'departement', 'region'].includes(filterType)) {
            throw new Error('Type de filtre invalide. Utilisez: ville, departement, ou region');
        }

        // Diviser les valeurs de filtre par virgules et nettoyer
        const filterValues = filterValue.split(',').map(v => v.trim()).filter(v => v.length > 0);
        if (filterValues.length === 0) {
            throw new Error('Aucune valeur de filtre valide fournie');
        }

        console.log(`🎯 Filtres appliqués: ${filterValues.join(', ')}`);

        // Générer le nom du fichier de sortie avec toutes les valeurs
        const outputFileName = generateOutputFileName(path.basename(inputFile), filterType, filterValues.join('_'));
        const outputDir = path.join(__dirname, '..', 'data');
        const outputFile = path.join(outputDir, outputFileName);

        // Créer le dossier de sortie s'il n'existe pas
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log(`📁 Fichier de sortie: ${outputFile}`);

        const results = [];
        let totalLines = 0;
        let filteredLines = 0;
        let header = null;
        let availableColumns = null;

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
                // Utiliser le parser CSV pour l'en-tête
                availableColumns = parseCSVLine(line);
                continue;
            }
            
            // Utiliser le parser CSV pour diviser la ligne
            const columns = parseCSVLine(line);
            
            let match = false;
            let searchColumn = '';
            let matchedValue = '';
            
            // Nouvelle logique : parcourir toutes les colonnes candidates
            switch (filterType) {
                case 'ville':
                    // Chercher dans toutes les colonnes dont le nom contient 'locality', 'ville' ou 'city'
                    for (let i = 0; i < availableColumns.length; i++) {
                        const colName = availableColumns[i].toLowerCase();
                        if (colName.includes('locality') || colName.includes('ville') || colName.includes('city')) {
                            const value = (columns[i] || '').toLowerCase();
                            // Vérifier si la valeur correspond à l'un des filtres
                            for (const filterVal of filterValues) {
                                if (value.includes(filterVal.toLowerCase())) {
                                    match = true;
                                    searchColumn = availableColumns[i];
                                    matchedValue = filterVal;
                                    break;
                                }
                            }
                            if (match) break;
                        }
                    }
                    break;
                case 'departement':
                    // Chercher dans toutes les colonnes dont le nom contient 'postal', 'departement', 'dept', 'code'
                    for (let i = 0; i < availableColumns.length; i++) {
                        const colName = availableColumns[i].toLowerCase();
                        if (colName.includes('postal') || colName.includes('departement') || colName.includes('dept') || colName.includes('code')) {
                            const value = (columns[i] || '').toString().trim();
                            
                            // Vérifier que c'est un code postal français valide (5 chiffres)
                            // et qu'il commence par l'un des départements spécifiés
                            if (/^\d{5}$/.test(value)) {
                                for (const filterVal of filterValues) {
                                    if (value.startsWith(filterVal)) {
                                        match = true;
                                        searchColumn = availableColumns[i];
                                        matchedValue = filterVal;
                                        break;
                                    }
                                }
                                if (match) break;
                            }
                        }
                    }
                    break;
                case 'region':
                    // Chercher dans toutes les colonnes dont le nom contient 'region' ou 'state'
                    for (let i = 0; i < availableColumns.length; i++) {
                        const colName = availableColumns[i].toLowerCase();
                        if (colName.includes('region') || colName.includes('state')) {
                            const value = (columns[i] || '').toLowerCase();
                            // Vérifier si la valeur correspond à l'un des filtres
                            for (const filterVal of filterValues) {
                                if (value.includes(filterVal.toLowerCase())) {
                                    match = true;
                                    searchColumn = availableColumns[i];
                                    matchedValue = filterVal;
                                    break;
                                }
                            }
                            if (match) break;
                        }
                    }
                    break;
            }
            
            if (match) {
                results.push(line);
                filteredLines++;
            }
            
            // Afficher le progrès tous les 1000 lignes
            if (totalLines % 1000 === 0) {
                console.log(`📊 Lignes traitées: ${totalLines.toLocaleString()} | Lignes filtrées: ${filteredLines.toLocaleString()}`);
            }
        }
        
        // Fermer l'interface de lecture du fichier
        fileRl.close();

        console.log(`\n📊 Statistiques:`);
        console.log(`   Total de lignes traitées: ${totalLines.toLocaleString()}`);
        console.log(`   Lignes filtrées: ${filteredLines.toLocaleString()}`);
        console.log(`   Taux de filtrage: ${((filteredLines / totalLines) * 100).toFixed(2)}%`);
        console.log(`   Filtres appliqués: ${filterValues.join(', ')}`);
        
        if (filteredLines === 0) {
            console.log('\n⚠️ Aucune ligne ne correspond aux critères de filtrage');
            console.log('💡 Suggestions:');
            console.log('   - Vérifiez que le fichier contient des colonnes de localisation');
            console.log('   - Essayez des valeurs de recherche différentes');
            
            // Afficher toutes les colonnes disponibles pour aider
            if (availableColumns) {
                console.log('\n🔍 Toutes les colonnes disponibles dans le fichier:');
                availableColumns.forEach((col, index) => {
                    console.log(`   ${index}: ${col}`);
                });
            }
            
            // Afficher quelques exemples de données pour diagnostiquer
            console.log('\n🔍 Exemples de données dans les colonnes de localisation:');
            const fileStream2 = fs.createReadStream(inputFile, { encoding: 'utf8' });
            const fileRl2 = readline.createInterface({
                input: fileStream2,
                crlfDelay: Infinity
            });
            
            let lineCount = 0;
            for await (const line of fileRl2) {
                lineCount++;
                if (lineCount > 1 && lineCount <= 6) { // Afficher les 5 premières lignes de données
                    const columns = parseCSVLine(line);
                    const localityIndex = availableColumns.indexOf('whois_locality');
                    const postalIndex = availableColumns.indexOf('whois_postal_code');
                    const regionIndex = availableColumns.indexOf('whois_region');
                    
                    console.log(`   Ligne ${lineCount}:`);
                    if (localityIndex !== -1) console.log(`     Ville: "${columns[localityIndex]}"`);
                    if (postalIndex !== -1) console.log(`     Code postal: "${columns[postalIndex]}"`);
                    if (regionIndex !== -1) console.log(`     Région: "${columns[regionIndex]}"`);
                }
                if (lineCount > 6) break;
            }
            fileRl2.close();
            
            return {
                success: false,
                error: 'Aucune ligne ne correspond aux critères de filtrage',
                totalLines,
                filteredLines: 0,
                availableColumns: availableColumns || [],
                filterType,
                filterValue: filterValues.join(', '),
                filterValues
            };
        }
        
        // Écrire le fichier de sortie
        console.log('\n💾 Écriture du fichier de sortie...');
        let content = header + '\n';
        content += results.join('\n');
        
        fs.writeFileSync(outputFile, content, 'utf8');
        
        // Mettre à jour le registre des fichiers avec la localisation
        const RegistryService = require('./registryService');
        const registryService = new RegistryService(path.join(__dirname, '..', 'data'));
        
        registryService.addLocationFilteredFile(
            path.basename(inputFile), 
            outputFileName, 
            filterValues.join(', '), 
            filterType
        );
        
        console.log(`\n✅ Fichier filtré sauvegardé: ${outputFileName}`);
        console.log(`📁 Chemin complet: ${outputFile}`);
        console.log(`📍 Localisations enregistrées: ${filterValues.join(', ')}`);
        console.log('\n🎉 Filtrage terminé avec succès!');
        
        return {
            success: true,
            totalLines,
            filteredLines,
            excludedLines: totalLines - filteredLines,
            retentionRate: ((filteredLines / totalLines) * 100).toFixed(2),
            outputFile: outputFileName,
            filterType,
            filterValue: filterValues.join(', '),
            filterValues,
            localisation: filterValues.join(', ')
        };
        
    } catch (error) {
        console.error('❌ Erreur lors du filtrage:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Fonction pour obtenir les colonnes disponibles dans un fichier
async function getAvailableColumns(inputFile) {
    try {
        if (!fs.existsSync(inputFile)) {
            throw new Error('Fichier non trouvé');
        }

        const fileStream = fs.createReadStream(inputFile, { encoding: 'utf8' });
        const fileRl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let firstLine = null;
        for await (const line of fileRl) {
            firstLine = line;
            break;
        }
        
        fileRl.close();

        if (firstLine) {
            const columns = parseCSVLine(firstLine);
            return columns;
        }

        return [];
    } catch (error) {
        console.error('Erreur lors de la lecture des colonnes:', error.message);
        return [];
    }
}

module.exports = { 
    filterByLocation, 
    generateOutputFileName,
    getAvailableColumns
}; 