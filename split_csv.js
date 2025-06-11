const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

const CHUNK_SIZE = 600;

function splitCSV(inputFile) {
    // Lire le fichier CSV
    const fileContent = fs.readFileSync(inputFile, 'utf-8');
    
    // Parser le CSV
    const records = csv.parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });

    // Récupérer les en-têtes
    const headers = Object.keys(records[0]);

    // Calculer le nombre de fichiers nécessaires
    const totalRows = records.length;
    const numFiles = Math.ceil(totalRows / CHUNK_SIZE);

    // Créer le dossier de sortie s'il n'existe pas
    const outputDir = 'output';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    // Diviser et sauvegarder les fichiers
    for (let i = 0; i < numFiles; i++) {
        const startIdx = i * CHUNK_SIZE;
        const endIdx = Math.min((i + 1) * CHUNK_SIZE, totalRows);
        
        // Extraire le chunk
        const chunk = records.slice(startIdx, endIdx);
        
        // Convertir en CSV avec les en-têtes
        const csvOutput = stringify(chunk, {
            header: true,
            columns: headers
        });

        // Sauvegarder dans un nouveau fichier
        const outputFile = path.join(outputDir, `leads${i + 1}.csv`);
        fs.writeFileSync(outputFile, csvOutput);
        console.log(`Fichier créé : ${outputFile}`);
    }
}

// Exécuter le script
const inputFile = 'leadsFull.csv';
splitCSV(inputFile); 