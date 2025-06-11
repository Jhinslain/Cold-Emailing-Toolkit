#!/usr/bin/env node

const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const { spawn } = require('child_process');
const path = require('path');

// Configuration des clés API
const API_KEYS = [
  'AIzaSyD0u3W7oJ_CjsZ9pTrdiXcBXrVgTHoyViU',
  'AIzaSyAUFbNE3eaj_KOG3K-3UEEbtiMziKOoChc',
  'AIzaSyD003NPDofDbJH1qLEqwEOSfQk8ZJBde10'
];

// Fonction pour lire le CSV
function readCsv(path) {
  return new Promise((res, rej) => {
    const rows = [];
    fs.createReadStream(path)
      .pipe(csv())
      .on('data', (d) => rows.push(d))
      .on('end', () => res(rows))
      .on('error', rej);
  });
}

// Fonction pour écrire un CSV
async function writeCsv(path, rows) {
  const header = Object.keys(rows[0]).map((id) => ({ id, title: id }));
  return createObjectCsvWriter({ path, header }).writeRecords(rows);
}

// Fonction pour diviser le tableau en parts égales
function splitArray(array, parts) {
  const result = [];
  const chunkSize = Math.ceil(array.length / parts);
  
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  
  return result;
}

// Fonction pour lancer un script avec ses paramètres
function runScript(inputFile, outputFile, apiKey) {
  return new Promise((resolve, reject) => {
    const script = spawn('node', [
      'score_lighthouse.js',
      '--input', inputFile,
      '--output', outputFile,
      '--api-key', apiKey,
      '--concurrency', '4'
    ]);

    script.stdout.on('data', (data) => {
      console.log(`[${path.basename(outputFile)}] ${data.toString().trim()}`);
    });

    script.stderr.on('data', (data) => {
      console.error(`[${path.basename(outputFile)}] ERREUR: ${data.toString().trim()}`);
    });

    script.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Le script s'est terminé avec le code ${code}`));
      }
    });
  });
}

// Fonction pour nettoyer les fichiers temporaires
async function cleanupTempFiles(chunks) {
  for (let i = 0; i < chunks.length; i++) {
    try {
      const tempInputFile = `temp_input_${i}.csv`;
      const tempOutputFile = `temp_output_${i}.csv`;
      
      if (fs.existsSync(tempInputFile)) {
        fs.unlinkSync(tempInputFile);
        console.log(`🧹 Fichier temporaire supprimé: ${tempInputFile}`);
      }
      
      if (fs.existsSync(tempOutputFile)) {
        fs.unlinkSync(tempOutputFile);
        console.log(`🧹 Fichier temporaire supprimé: ${tempOutputFile}`);
      }
    } catch (error) {
      console.error(`⚠️ Erreur lors de la suppression du fichier temporaire: ${error.message}`);
    }
  }
}

// Fonction principale
async function main() {
  let chunks = [];
  try {
    // Lecture du fichier d'entrée
    const inputFile = process.argv[2];
    if (!inputFile) {
      console.error('Usage: node master_script.js <input_file.csv>');
      process.exit(1);
    }

    console.log('📊 Lecture du fichier d\'entrée...');
    const rows = await readCsv(inputFile);
    console.log(`📊 ${rows.length} lignes lues`);

    // Division des données
    chunks = splitArray(rows, API_KEYS.length);
    console.log(`📊 Division en ${chunks.length} parties`);

    // Création des fichiers temporaires et lancement des scripts
    const promises = chunks.map(async (chunk, index) => {
      const tempInputFile = `temp_input_${index}.csv`;
      const tempOutputFile = `temp_output_${index}.csv`;
      
      // Écriture du fichier temporaire d'entrée
      await writeCsv(tempInputFile, chunk);
      console.log(`📝 Fichier temporaire créé: ${tempInputFile}`);

      // Lancement du script
      return runScript(tempInputFile, tempOutputFile, API_KEYS[index]);
    });

    // Attente de la fin de tous les scripts
    await Promise.all(promises);
    console.log('✅ Tous les scripts sont terminés');

    // Fusion des résultats
    const allResults = [];
    for (let i = 0; i < chunks.length; i++) {
      const tempOutputFile = `temp_output_${i}.csv`;
      const results = await readCsv(tempOutputFile);
      allResults.push(...results);
    }

    // Écriture du fichier final
    const finalOutputFile = inputFile.replace('.csv', '_results.csv');
    await writeCsv(finalOutputFile, allResults);
    console.log(`✅ Résultats fusionnés dans ${finalOutputFile}`);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    // Nettoyage des fichiers temporaires dans tous les cas
    await cleanupTempFiles(chunks);
  }
}

main(); 