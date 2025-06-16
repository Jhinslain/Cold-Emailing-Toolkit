#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const { spawn } = require('child_process');
const path = require('path');
const { stringify } = require('csv-stringify/sync');

// Configuration des clés API
const LIGHTHOUSE_API_KEYS = [
  process.env.API_LIGHTHOUSE1,
  process.env.API_LIGHTHOUSE2,
  process.env.API_LIGHTHOUSE3,
].filter(Boolean);

const VERIFIER_API_KEYS = [
  process.env.API_MILLION_VERIFIER1,
  process.env.API_MILLION_VERIFIER2,
  process.env.API_MILLION_VERIFIER3,
].filter(Boolean);

console.log('🔑 Nombre de clés Lighthouse détectées:', LIGHTHOUSE_API_KEYS.length);
console.log('🔑 Nombre de clés Verifier détectées:', VERIFIER_API_KEYS.length);

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

// Fonction pour diviser un fichier CSV en plusieurs parties
async function splitCSVFile(inputFile, numParts) {
  console.log(`\n📊 Division du fichier ${path.basename(inputFile)} en ${numParts} parties...`);
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(inputFile)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => {
        const partSize = Math.ceil(rows.length / numParts);
        const parts = [];
        
        for (let i = 0; i < numParts; i++) {
          const start = i * partSize;
          const end = Math.min(start + partSize, rows.length);
          parts.push(rows.slice(start, end));
        }
        
        console.log(`✅ Division terminée: ${rows.length} lignes réparties en ${numParts} parties`);
        resolve(parts);
      })
      .on('error', reject);
  });
}

// Fonction pour fusionner les fichiers CSV
async function mergeCSVFiles(inputFiles, outputFile) {
  console.log(`\n🔄 Fusion des fichiers de sortie...`);
  const allRows = [];
  
  for (const file of inputFiles) {
    console.log(`📥 Lecture du fichier: ${path.basename(file)}`);
    const rows = await new Promise((resolve, reject) => {
      const rows = [];
      fs.createReadStream(file)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
    allRows.push(...rows);
  }
  
  const output = stringify(allRows, { header: true });
  fs.writeFileSync(outputFile, output);
  console.log(`✅ Fusion terminée: ${allRows.length} lignes dans ${path.basename(outputFile)}`);
}

// Fonction pour fusionner les résultats de verifier et lighthouse
async function mergeResults(verifierFile, lighthouseFile, outputFile) {
  console.log('\n🔄 Fusion des résultats...');
  
  // Lire les deux fichiers
  const verifierRows = await readCsv(verifierFile);
  const lighthouseRows = await readCsv(lighthouseFile);
  
  // Créer un map des résultats lighthouse par URL
  const lighthouseMap = new Map(lighthouseRows.map(row => [row.Website, row]));
  
  // Fusionner les résultats
  const mergedRows = verifierRows.map(verifierRow => {
    const lighthouseRow = lighthouseMap.get(verifierRow.Website) || {};
    return {
      ...verifierRow,
      ...lighthouseRow
    };
  });
  
  // Filtrer pour ne garder que les lignes avec Email_note = "Good"
  const filteredRows = mergedRows.filter(row => row.Email_note === "Good");
  
  console.log(`📊 ${filteredRows.length} lignes valides sur ${mergedRows.length} au total`);
  
  // Écrire le résultat
  await writeCsv(outputFile, filteredRows);
  console.log(`✅ Résultats fusionnés et filtrés sauvegardés dans ${outputFile}`);
  
  return outputFile;
}

// Fonction pour exécuter tous les scripts en séquence
async function runAllScripts(inputFile, baseOutputFile, outputDir, scriptsDir) {
  console.log('\n🚀 Démarrage du traitement parallèle...');
  
  // Traitement parallèle de verifier et lighthouse
  const parallelResults = await Promise.all([
    // Exécution de verifier
    (async () => {
      const outputFile = path.join(outputDir, `${path.basename(baseOutputFile, '.csv')}_verifier.csv`);
      console.log(`\n📊 Démarrage du traitement verifier...`);
      console.log(`📥 Fichier d'entrée: ${inputFile}`);
      console.log(`📤 Fichier de sortie: ${outputFile}`);
      
      await new Promise((resolve, reject) => {
        const childProcess = spawn('node', [
          path.join(scriptsDir, 'mail_verifier.js'),
          inputFile,
          outputFile
        ], {
          stdio: 'inherit',
          env: {
            ...process.env,
            API_MILLION_VERIFIER1: VERIFIER_API_KEYS[0],
            API_MILLION_VERIFIER2: VERIFIER_API_KEYS[1],
            API_MILLION_VERIFIER3: VERIFIER_API_KEYS[2]
          }
        });

        childProcess.on('error', reject);
        childProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ Script verifier terminé avec succès`);
            resolve(outputFile);
          } else {
            reject(new Error(`Script verifier terminé avec le code ${code}`));
          }
        });
      });
      return outputFile;
    })(),

    // Exécution de lighthouse
    (async () => {
      const outputFile = path.join(outputDir, `${path.basename(baseOutputFile, '.csv')}_lighthouse.csv`);
      console.log(`\n📊 Démarrage du traitement lighthouse...`);
      console.log(`📥 Fichier d'entrée: ${inputFile}`);
      console.log(`📤 Fichier de sortie: ${outputFile}`);
      
      await new Promise((resolve, reject) => {
        const childProcess = spawn('node', [
          path.join(scriptsDir, 'score_lighthouse.js'),
          '--input', inputFile,
          '--output', outputFile
        ], {
          stdio: 'inherit',
          env: {
            ...process.env,
            API_KEY_1: LIGHTHOUSE_API_KEYS[0],
            API_KEY_2: LIGHTHOUSE_API_KEYS[1],
            API_KEY_3: LIGHTHOUSE_API_KEYS[2]
          }
        });

        childProcess.on('error', reject);
        childProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ Script lighthouse terminé avec succès`);
            resolve(outputFile);
          } else {
            reject(new Error(`Script lighthouse terminé avec le code ${code}`));
          }
        });
      });
      return outputFile;
    })()
  ]);

  // Fusionner les résultats et filtrer
  const mergedFile = path.join(outputDir, `${path.basename(baseOutputFile, '.csv')}_merged.csv`);
  const filteredFile = await mergeResults(parallelResults[0], parallelResults[1], mergedFile);

  // Une fois les deux traitements terminés et fusionnés, on lance hook
  console.log('\n🚀 Démarrage du traitement hook...');
  const hookOutputFile = path.join(outputDir, `${path.basename(baseOutputFile, '.csv')}_final.csv`);
  
  console.log(`📥 Fichier d'entrée: ${filteredFile}`);
  console.log(`📤 Fichier de sortie: ${hookOutputFile}`);

  await new Promise((resolve, reject) => {
    const childProcess = spawn('node', [
      path.join(scriptsDir, 'changement_hook.js'),
      filteredFile,
      hookOutputFile
    ], {
      stdio: 'inherit'
    });

    childProcess.on('error', reject);
    childProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Script hook terminé avec succès`);
        resolve();
      } else {
        reject(new Error(`Script hook terminé avec le code ${code}`));
      }
    });
  });
}

// Fonction principale
async function main() {
  let chunks = [];
  try {
    // Vérification des arguments
    if (process.argv.length < 3) {
      console.error('Usage: node master_script.js [hook|verifier|lighthouse|split|all]');
      process.exit(1);
    }

    const scriptType = process.argv[2].toLowerCase();
    const inputDir = path.join(__dirname, 'input');
    const outputDir = path.join(__dirname, 'output');
    const scriptsDir = path.join(__dirname, 'scripts');
    const tempDir = path.join(__dirname, 'temp');

    console.log('\n🚀 Démarrage du script maître');
    console.log(`📁 Type de traitement: ${scriptType}`);
    console.log(`📂 Dossier d'entrée: ${inputDir}`);
    console.log(`📂 Dossier de sortie: ${outputDir}`);

    // Vérification et création des dossiers
    if (!fs.existsSync(inputDir)) {
      console.error('❌ Le dossier "input" n\'existe pas. Création du dossier...');
      fs.mkdirSync(inputDir);
      console.log('📝 Veuillez placer vos fichiers CSV dans le dossier "input"');
      process.exit(1);
    }

    if (!fs.existsSync(outputDir)) {
      console.log('📝 Création du dossier "output"...');
      fs.mkdirSync(outputDir);
    }

    if (!fs.existsSync(tempDir)) {
      console.log('📝 Création du dossier "temp"...');
      fs.mkdirSync(tempDir);
    }

    // Vérification des fichiers dans le dossier input
    const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.csv'));
    if (files.length === 0) {
      console.error('❌ Aucun fichier CSV trouvé dans le dossier "input"');
      process.exit(1);
    }

    console.log(`📊 ${files.length} fichier(s) CSV trouvé(s) dans le dossier input`);

    // Sélection du script à exécuter
    let scriptPath;
    switch (scriptType) {
      case 'hook':
        scriptPath = path.join(scriptsDir, 'changement_hook.js');
        break;
      case 'verifier':
        scriptPath = path.join(scriptsDir, 'mail_verifier.js');
        break;
      case 'lighthouse':
        scriptPath = path.join(scriptsDir, 'score_lighthouse.js');
        break;
      case 'split':
        scriptPath = path.join(scriptsDir, 'split_csv.js');
        break;
      case 'all':
        // Pour 'all', nous n'avons pas besoin de scriptPath spécifique
        break;
      default:
        console.error('❌ Type de script invalide. Utilisez: hook, verifier, lighthouse, split, ou all');
        process.exit(1);
    }

    // Vérification de l'existence du script
    if (scriptType !== 'all' && !fs.existsSync(scriptPath)) {
      console.error(`❌ Le script ${scriptPath} n'existe pas`);
      process.exit(1);
    }

    console.log(`📜 Script sélectionné: ${scriptType === 'all' ? 'Tous les scripts' : scriptPath}`);

    // Exécution du script pour chaque fichier CSV
    async function processFiles() {
      for (const file of files) {
        const inputFile = path.join(inputDir, file);
        const outputFile = path.join(outputDir, `${path.basename(file, '.csv')}_${scriptType}.csv`);
        
        console.log(`\n📋 Traitement du fichier: ${file}`);
        console.log(`📤 Fichier de sortie: ${path.basename(outputFile)}`);

        if (scriptType === 'all') {
          try {
            await runAllScripts(inputFile, file, outputDir, scriptsDir);
            console.log(`\n✨ Traitement complet terminé pour ${file}`);
          } catch (error) {
            console.error(`❌ Erreur lors du traitement de ${file}:`, error);
          }
        } else if (scriptType === 'lighthouse') {
          try {
            // Diviser le fichier en 3 parties
            const parts = await splitCSVFile(inputFile, 3);
            
            // Créer les fichiers temporaires
            const tempFiles = [];
            const tempOutputFiles = [];
            
            for (let i = 0; i < parts.length; i++) {
              const tempInputFile = path.join(tempDir, `temp_input_${i}.csv`);
              const tempOutputFile = path.join(tempDir, `temp_output_${i}.csv`);
              
              // Écrire le fichier temporaire
              const output = stringify(parts[i], { header: true });
              fs.writeFileSync(tempInputFile, output);
              
              tempFiles.push(tempInputFile);
              tempOutputFiles.push(tempOutputFile);
            }

            console.log('\n🚀 Lancement des traitements parallèles...');
            // Exécuter les scripts en parallèle
            const promises = tempFiles.map((tempFile, index) => {
              return new Promise((resolve, reject) => {
                console.log(`\n📊 Traitement partie ${index + 1}/3 avec la clé API ${index + 1}`);
                const script = spawn('node', [
                  scriptPath,
                  '-i', tempFile,
                  '-o', tempOutputFiles[index]
                ], {
                  stdio: 'pipe'
                });

                let processedCount = 0;
                const totalRows = parts[index].length;

                script.stdout.on('data', (data) => {
                  const output = data.toString();
                  // Chercher les lignes de progression dans la sortie
                  const progressMatch = output.match(/(\d+)\s*\/\s*(\d+)\s*traités/);
                  if (progressMatch) {
                    processedCount = parseInt(progressMatch[1]);
                    console.log(`📊 Partie ${index + 1}/3: ${processedCount}/${totalRows} traités (${Math.round(processedCount/totalRows*100)}%)`);
                  }
                });

                script.stderr.on('data', (data) => {
                  console.error(`❌ Erreur partie ${index + 1}/3:`, data.toString());
                });

                script.on('error', reject);
                script.on('close', (code) => {
                  if (code === 0) {
                    console.log(`✅ Partie ${index + 1}/3 terminée avec succès (${totalRows} lignes traitées)`);
                    resolve();
                  } else {
                    reject(new Error(`Partie ${index + 1}/3 terminée avec le code ${code}`));
                  }
                });
              });
            });

            // Attendre que tous les scripts soient terminés
            await Promise.all(promises);

            // Fusionner les résultats
            await mergeCSVFiles(tempOutputFiles, outputFile);

            // Nettoyer les fichiers temporaires
            console.log('\n🧹 Nettoyage des fichiers temporaires...');
            tempFiles.forEach(file => fs.unlinkSync(file));
            tempOutputFiles.forEach(file => fs.unlinkSync(file));
            console.log('✅ Nettoyage terminé');

            console.log(`\n✨ Traitement complet terminé pour ${file}`);
          } catch (error) {
            console.error(`❌ Erreur lors du traitement de ${file}:`, error);
          }
        } else {
          // Pour les autres scripts, traitement normal
          console.log(`\n🚀 Lancement du traitement...`);
          const script = spawn('node', [scriptPath, inputFile, outputFile], {
            stdio: 'inherit'
          });

          await new Promise((resolve, reject) => {
            script.on('error', reject);
            script.on('close', (code) => {
              if (code === 0) {
                console.log(`\n✨ Traitement terminé avec succès pour ${file}`);
                resolve();
              } else {
                reject(new Error(`Script terminé avec le code ${code}`));
              }
            });
          });
        }
      }
    }

    // Exécuter le traitement
    console.log('\n🚀 Démarrage du traitement...');
    processFiles().catch(error => {
      console.error('❌ Erreur lors du traitement:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main(); 