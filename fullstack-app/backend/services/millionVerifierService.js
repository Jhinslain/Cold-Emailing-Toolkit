const axios = require('axios');
const fs = require('fs').promises;
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');

// Configuration dynamique du service
let API_KEYS = [
  process.env.API_MILLION_VERIFIER1,
  process.env.API_MILLION_VERIFIER2,
  process.env.API_MILLION_VERIFIER3
].filter(key => key); // Filtrer les clés vides

// Mécanisme de verrouillage pour éviter les appels multiples
let isProcessing = false;
let currentProcessingFile = null;

// Fonction pour mettre à jour les clés API
function updateApiKeys() {
  API_KEYS = [
    process.env.API_MILLION_VERIFIER1,
    process.env.API_MILLION_VERIFIER2,
    process.env.API_MILLION_VERIFIER3
  ].filter(key => key);
  console.log(`[SERVICE] Clés API mises à jour: ${API_KEYS.length} clé(s) configurée(s)`);
}

const MILLION_VERIFIER_URL = 'https://api.millionverifier.com/api/v3/';
const BATCH_SIZE = 3; // Taille de base par clé API
const DELAY_BETWEEN_BATCHES = 500; // Réduire le délai entre batches pour accélérer
const REQUEST_TIMEOUT = 20000; // 20 secondes
const API_TIMEOUT = 15; // Timeout de l'API MillionVerifier
const MAX_RETRIES = 2;

/**
 * Met à jour le registre du fichier d'entrée pour indiquer son statut de traitement
 * @param {string} inputFileName Nom du fichier d'entrée
 * @param {number} processingTime Temps de traitement en secondes
 * @param {string} traitement Type de traitement ("verifier" pour MillionVerifier)
 */
async function updateInputFileRegistry(inputFileName, processingTime = 0, traitement = "verifier") {
  try {
    const registryPath = path.join(__dirname, '../data/files-registry.json');
    
    // Lire le fichier registry existant
    let registry = {};
    try {
      const registryContent = await fs.readFile(registryPath, 'utf-8');
      registry = JSON.parse(registryContent);
    } catch (error) {
      console.warn('[SERVICE] Fichier registry non trouvé, création d\'un nouveau');
    }
    
    // Mettre à jour l'entrée du fichier d'entrée
    if (registry[inputFileName]) {
      // Préserver toutes les données existantes et ajouter seulement le nouveau traitement
      registry[inputFileName] = {
        ...registry[inputFileName], // Garder toutes les données existantes
        traitement: traitement,     // Mettre à jour le traitement
        lastUpdated: new Date().toISOString()
      };
      
      // Mettre à jour les statistiques verifier en préservant les autres
      if (!registry[inputFileName].statistiques) {
        registry[inputFileName].statistiques = {
          domain_lignes: 0,
          domain_temps: 0,
          whois_lignes: 0,
          whois_temps: 0,
          verifier_lignes: 0,
          verifier_temps: 0
        };
      } else {
        // Préserver les statistiques existantes et mettre à jour seulement verifier
        registry[inputFileName].statistiques = {
          ...registry[inputFileName].statistiques, // Garder toutes les stats existantes
          verifier_lignes: registry[inputFileName].statistiques.verifier_lignes || 0,
          verifier_temps: processingTime > 0 ? processingTime : registry[inputFileName].statistiques.verifier_temps
        };
      }
    }
    
    // Écrire le fichier registry mis à jour
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`[SERVICE] Registry mis à jour pour ${inputFileName}: traitement = ${traitement}`);
    
  } catch (error) {
    console.error('[SERVICE] Erreur lors de la mise à jour du registry du fichier d\'entrée:', error.message);
  }
}

/**
 * Met à jour le fichier files-registry.json avec les informations du fichier de sortie
 * @param {string} outputFilePath Chemin vers le fichier de sortie
 * @param {number} validRows Nombre de lignes valides écrites
 * @param {number} totalRows Nombre total de lignes traitées
 * @param {number} processingTime Temps de traitement en secondes
 */
async function updateFilesRegistry(outputFilePath, validRows, totalRows, processingTime = 0) {
  try {
    const registryPath = path.join(__dirname, '../data/files-registry.json');
    
    // Lire le fichier registry existant
    let registry = {};
    try {
      const registryContent = await fs.readFile(registryPath, 'utf-8');
      registry = JSON.parse(registryContent);
    } catch (error) {
      console.warn('[SERVICE] Fichier registry non trouvé, création d\'un nouveau');
    }
    
    // Extraire le nom du fichier de sortie
    const fileName = path.basename(outputFilePath);
    
    // Calculer la taille du fichier de sortie
    let fileSize = 0;
    try {
      const stats = await fs.stat(outputFilePath);
      fileSize = stats.size;
    } catch (error) {
      console.warn(`[SERVICE] Impossible de récupérer la taille du fichier ${outputFilePath}:`, error.message);
    }
    
    // Mettre à jour ou créer l'entrée pour ce fichier
    if (registry[fileName]) {
      // Préserver les données existantes et mettre à jour seulement les champs nécessaires
      registry[fileName] = {
        ...registry[fileName], // Garder toutes les données existantes
        size: fileSize,
        modified: new Date().toISOString(),
        type: "verifier",
        totalLines: validRows,
        lastUpdated: new Date().toISOString(),
        totalRows: totalRows,
        validRows: validRows,
        invalidRows: totalRows - validRows,
        traitement: "verifier", // Indiquer que le fichier a été traité par MillionVerifier
        statistiques: {
          ...registry[fileName].statistiques, // Préserver les stats existantes
          verifier_lignes: validRows,
          verifier_temps: processingTime
        }
      };
    } else {
      // Créer une nouvelle entrée avec des statistiques par défaut
      registry[fileName] = {
        size: fileSize,
        modified: new Date().toISOString(),
        type: "verifier",
        totalLines: validRows,
        lastUpdated: new Date().toISOString(),
        dates: [],
        localisations: [],
        mergedFrom: [],
        totalRows: totalRows,
        validRows: validRows,
        invalidRows: totalRows - validRows,
        traitement: "verifier", // Indiquer que le fichier a été traité par MillionVerifier
        statistiques: {
          domain_lignes: 0,
          domain_temps: 0,
          whois_lignes: 0,
          whois_temps: 0,
          verifier_lignes: validRows,
          verifier_temps: processingTime
        }
      };
    }
    
    // Écrire le fichier registry mis à jour
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`[SERVICE] Registry mis à jour pour ${fileName}: ${validRows} lignes valides sur ${totalRows} total, taille: ${fileSize} octets, temps: ${processingTime}s`);
    
  } catch (error) {
    console.error('[SERVICE] Erreur lors de la mise à jour du registry:', error.message);
  }
}

/**
 * Vérifie une liste d'emails via MillionVerifier avec gestion des batches et délais
 * @param {string[]} emails Liste des emails à vérifier
 * @returns {Promise<Array<{email: string, result: any, error?: string}>>}
 */
async function verifyEmailsMillionVerifier(emails) {
  console.log(`[SERVICE] Début de la vérification de ${emails.length} emails avec ${API_KEYS.length} clé(s) API`);
  
  if (emails.length === 0) {
    console.log(`[SERVICE] Aucun email à traiter, arrêt de la vérification`);
    return [];
  }

  const results = [];
  const batchSize = Math.max(1, BATCH_SIZE * API_KEYS.length); // Éviter batchSize = 0
  const delayBetweenBatches = DELAY_BETWEEN_BATCHES;
  
  console.log(`[SERVICE] Configuration: batchSize=${batchSize}, totalEmails=${emails.length}, totalBatches=${Math.ceil(emails.length/batchSize)}`);

  // Protection contre les emails vides
  if (emails.length === 0 || batchSize === 0) {
    console.warn(`[SERVICE] ⚠️ Configuration invalide: emails=${emails.length}, batchSize=${batchSize}`);
    return [];
  }

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const currentBatch = Math.floor(i/batchSize) + 1;
    const totalBatches = Math.ceil(emails.length/batchSize);
    
    console.log(`[SERVICE] Traitement du batch ${currentBatch}/${totalBatches} (${batch.length} emails)`);
    
    // Vérifier que le batch n'est pas vide
    if (batch.length === 0) {
      console.warn(`[SERVICE] Batch vide détecté, arrêt de la boucle`);
      break; // Arrêter la boucle au lieu de continuer
    }
    
    // Distribuer les emails entre les différentes clés API pour traiter en parallèle
    const batchPromises = batch.map((email, index) => {
      const apiKeyIndex = index % API_KEYS.length;
      const apiKey = API_KEYS[apiKeyIndex];
      console.log(`[SERVICE] Email ${email} assigné à la clé API ${apiKeyIndex + 1} (${apiKey.substring(0, 8)}...)`);
      return verifySingleEmailWithKey(email, apiKey);
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Attendre entre les batches pour éviter de surcharger l'API
    if (i + batchSize < emails.length) {
      console.log(`[SERVICE] Attente de ${delayBetweenBatches}ms avant le prochain batch...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  console.log(`[SERVICE] Vérification terminée pour ${results.length} emails`);
  return results;
}

/**
 * Vérifie un email avec une clé API spécifique
 * @param {string} email Email à vérifier
 * @param {string} apiKey Clé API à utiliser
 * @returns {Promise<{email: string, result: any, error?: string}>}
 */
async function verifySingleEmailWithKey(email, apiKey) {
  const url = `${MILLION_VERIFIER_URL}?api=${apiKey}&email=${encodeURIComponent(email)}&timeout=${API_TIMEOUT}`;

  try {
    console.log(`[SERVICE] Vérification de ${email} avec clé ${apiKey.substring(0, 8)}...`);
    
    const response = await axios.get(url, { timeout: REQUEST_TIMEOUT });
    const result = response.data;
    
    // Vérifier que la réponse contient des données valides
    if (!result || typeof result !== 'object') {
      throw new Error('Réponse API invalide');
    }
    
    return { email, result };
  } catch (error) {
    console.warn(`[SERVICE] Erreur lors de la vérification de ${email}:`, error.message);
    return { email, error: error.message, result: null };
  }
}

/**
 * Vérifie un email via MillionVerifier avec retry et rotation des clés
 * @param {string} email Email à vérifier
 * @param {number} retryCount Nombre de tentatives
 * @returns {Promise<{email: string, result: any, error?: string}>}
 */
async function verifySingleEmail(email, retryCount = 0) {
  if (API_KEYS.length === 0) {
    throw new Error('Aucune clé API MillionVerifier configurée');
  }

  const apiKey = API_KEYS[retryCount % API_KEYS.length];
  return verifySingleEmailWithKey(email, apiKey);
}

/**
 * Traite un fichier CSV et filtre les lignes avec des emails de qualité 'good'
 * @param {string} inputFilePath Chemin vers le fichier CSV d'entrée
 * @returns {Promise<{total: number, valid: number, invalid: number, outputPath: string}>}
 */
async function processCsvFile(inputFilePath) {
  console.log(`[SERVICE] 🔍 APPEL processCsvFile - Fichier: ${inputFilePath}`);
  console.log(`[SERVICE] 📍 Stack trace:`, new Error().stack.split('\n').slice(1, 4).join('\n'));
  
  // Vérifier si un traitement est déjà en cours
  if (isProcessing) {
    console.warn(`[SERVICE] ⚠️ Un traitement est déjà en cours pour: ${currentProcessingFile}`);
    console.warn(`[SERVICE] Fichier demandé: ${inputFilePath}`);
    throw new Error('Un traitement est déjà en cours');
  }
  
  // Vérifier si le même fichier est déjà en cours de traitement
  if (currentProcessingFile === inputFilePath) {
    console.warn(`[SERVICE] ⚠️ Le fichier ${inputFilePath} est déjà en cours de traitement`);
    throw new Error('Fichier déjà en cours de traitement');
  }
  
  try {
    // Marquer le début du traitement
    isProcessing = true;
    currentProcessingFile = inputFilePath;
    const startTime = Date.now();
    console.log(`[SERVICE] 🔒 Verrou de traitement activé pour: ${inputFilePath}`);
    
    // Vérifier que le fichier existe
    await fs.access(inputFilePath);
    
    // Mettre à jour le registre du fichier d'entrée pour indiquer qu'il est en cours de traitement par MillionVerifier
    const inputFileName = path.basename(inputFilePath, path.extname(inputFilePath));
    await updateInputFileRegistry(inputFileName + path.extname(inputFilePath), 0, "verifier");
    
    // Générer le nom du fichier de sortie avec suffixe _verifier
    const inputDir = path.dirname(inputFilePath);
    const outputFilePath = path.join(inputDir, `${inputFileName}_verifier.csv`);
    
    console.log(`[SERVICE] Fichier de sortie: ${outputFilePath}`);
    
    // Lire le fichier CSV ligne par ligne
    const fileContent = await fs.readFile(inputFilePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('Le fichier CSV doit contenir au moins une ligne d\'en-tête et une ligne de données');
    }
    
    console.log(`[SERVICE] ${lines.length} lignes lues dans le fichier`);
    
    // Parser l'en-tête
    const headers = parseCsvLine(lines[0]).map(h => h.trim());
    console.log(`[SERVICE] Colonnes détectées: ${headers.join(', ')}`);
    
    // Trouver l'index de la colonne email
    const emailColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('email') || h.toLowerCase().includes('mail')
    );
    
    if (emailColumnIndex === -1) {
      throw new Error('Aucune colonne email trouvée dans le fichier CSV');
    }
    
    console.log(`[SERVICE] Colonne email trouvée à l'index ${emailColumnIndex}: "${headers[emailColumnIndex]}"`);
        
    // Extraire les données et emails
    const dataRows = [];
    const emails = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parser la ligne en tenant compte des virgules dans les champs
      const values = parseCsvLine(line);
      
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] ? values[index].trim() : '';
        });
        
        dataRows.push(row);
        
        const email = values[emailColumnIndex];
        if (email && email.trim()) {
          emails.push(email.trim());
        }
      } else {
        console.warn(`[SERVICE] Ligne ${i + 1} ignorée: nombre de colonnes incorrect (${values.length} vs ${headers.length})`);
      }
    }
    
    console.log(`[SERVICE] ${dataRows.length} lignes de données extraites, ${emails.length} emails trouvés`);
        
    if (emails.length === 0) {
      throw new Error('Aucun email trouvé dans le fichier');
    }
    
    // Vérifier les emails via MillionVerifier
    console.log(`[SERVICE] Début de la vérification des emails via MillionVerifier...`);
    const verificationResults = await verifyEmailsMillionVerifier(emails);
    
    // Analyser les résultats et créer un map des emails valides
    const validEmails = new Set();
    let validCount = 0;
    let invalidCount = 0;
    
    verificationResults.forEach((result, index) => {
      if (result.error) {
        console.warn(`[SERVICE] Email ${result.email} en erreur: ${result.error}`);
        invalidCount++;
        return;
      }
      
      if (result.result) {
        // Vérifier si l'email est de qualité 'good' - logique flexible
        const isGoodQuality = result.result.quality === 'good' || 
                             result.result.result === 'ok' || 
                             result.result.status === 'good' ||
                             result.result.status === 'ok' ||
                             result.result.resultcode === 1 || // Code pour email valide
                             result.result.resultcode === 2 || // Code pour email valide
                             result.result.resultcode === 3;   // Code pour email valide
        
        if (isGoodQuality) {
          validEmails.add(result.email);
          validCount++;
          console.log(`[SERVICE] ✅ Email valide: ${result.email} (${result.result.quality}/${result.result.result})`);
        } else {
          invalidCount++;
          console.log(`[SERVICE] ❌ Email invalide: ${result.email} (code: ${result.result.resultcode})`);
        }
      } else {
        invalidCount++;
        console.log(`[SERVICE] ❌ Email sans résultat: ${result.email}`);
      }
    });
    
    console.log(`[SERVICE] Résultats de vérification: ${validCount} valides, ${invalidCount} invalides`);
    
    // Filtrer les lignes avec des emails valides
    const validRows = dataRows.filter(row => {
      const email = row[headers[emailColumnIndex]];
      return validEmails.has(email);
    });
    
    console.log(`[SERVICE] ${validRows.length} lignes valides à écrire dans le fichier de sortie`);
        
    // Écrire le fichier de sortie avec les mêmes colonnes que l'original
    if (validRows.length > 0) {
      const csvWriter = createCsvWriter({
        path: outputFilePath,
        header: headers.map(header => ({ id: header, title: header }))
      });
      
      await csvWriter.writeRecords(validRows);
      console.log(`[SERVICE] Fichier de sortie créé avec succès: ${outputFilePath}`);
    } else {
      console.warn(`[SERVICE] Aucune ligne valide trouvée, fichier de sortie vide créé`);
      // Créer un fichier vide avec juste l'en-tête pour éviter les erreurs
      const csvWriter = createCsvWriter({
        path: outputFilePath,
        header: headers.map(header => ({ id: header, title: header }))
      });
      await csvWriter.writeRecords([]);
      console.log(`[SERVICE] Fichier de sortie vide créé avec l'en-tête: ${outputFilePath}`);
    }
    
    // Mettre à jour le fichier files-registry.json avec les statistiques
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    await updateFilesRegistry(outputFilePath, validRows.length, dataRows.length, totalTime);
    
    // Mettre à jour le registre du fichier d'entrée pour indiquer qu'il a été traité par MillionVerifier
    await updateInputFileRegistry(inputFileName + path.extname(inputFilePath), totalTime, "verifier");
    
    // Remettre le traitement à vide une fois terminé
    await updateInputFileRegistry(inputFileName + path.extname(inputFilePath), totalTime, "");
    
    // Supprimer le fichier d'entrée après traitement réussi (remplacement)
    try {
      await fs.unlink(inputFilePath);
      console.log(`[SERVICE] Fichier d'entrée supprimé: ${inputFilePath}`);
    } catch (error) {
      console.warn(`[SERVICE] Impossible de supprimer le fichier d'entrée ${inputFilePath}:`, error.message);
    }
    
    return {
      total: dataRows.length,
      valid: validCount,
      invalid: invalidCount,
      outputPath: outputFilePath
    };
     
   } catch (error) {
     console.error(`[SERVICE] Erreur lors du traitement du fichier:`, error);
     throw error;
   } finally {
     // Libérer le verrou de traitement
     isProcessing = false;
     currentProcessingFile = null;
     console.log(`[SERVICE] 🔓 Verrou de traitement libéré pour: ${inputFilePath}`);
   }
 }

/**
 * Parse une ligne CSV en tenant compte des virgules dans les champs
 * @param {string} line Ligne CSV à parser
 * @returns {string[]} Tableau des valeurs
 */
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values;
}

/**
 * Fonction principale pour traiter un fichier avec nommage automatique
 * @param {string} inputFilePath Chemin vers le fichier d'entrée
 * @returns {Promise<{total: number, valid: number, invalid: number, outputPath: string}>}
 */
async function processFile(inputFilePath) {
  console.log(`[SERVICE] ===== DÉBUT TRAITEMENT MILLION VERIFIER =====`);
  console.log(`[SERVICE] Fichier d'entrée: ${inputFilePath}`);
  
  try {
    const result = await processCsvFile(inputFilePath);
    
    console.log(`[SERVICE] ===== TRAITEMENT TERMINÉ =====`);
    console.log(`[SERVICE] Total: ${result.total} lignes`);
    console.log(`[SERVICE] Valides: ${result.valid} emails`);
    console.log(`[SERVICE] Invalides: ${result.invalid} emails`);
    console.log(`[SERVICE] Fichier de sortie créé: ${result.outputPath}`);
    console.log(`[SERVICE] Fichier d'entrée supprimé (remplacement effectué)`);
    
    return result;
  } catch (error) {
    console.error(`[SERVICE] ===== ERREUR LORS DU TRAITEMENT =====`);
    console.error(`[SERVICE] ${error.message}`);
    throw error;
  }
}

// Fonction d'initialisation pour vérifier la configuration
function initializeService() {
  console.log('[SERVICE] Initialisation du service MillionVerifier...');
  
  // Mettre à jour les clés API depuis les variables d'environnement
  updateApiKeys();
  
  if (API_KEYS.length === 0) {
    console.warn('[SERVICE] ⚠️  Service MillionVerifier initialisé sans clés API - certaines fonctionnalités ne fonctionneront pas');
    console.warn('[SERVICE] Définissez les variables d\'environnement :');
    console.warn('[SERVICE] - API_MILLION_VERIFIER1');
    console.warn('[SERVICE] - API_MILLION_VERIFIER2');
    console.warn('[SERVICE] - API_MILLION_VERIFIER3');
    return false;
  } else {
    console.log(`[SERVICE] ✅ Service MillionVerifier initialisé avec ${API_KEYS.length} clé(s) API`);
    return true;
  }
}

module.exports = {
  verifyEmailsMillionVerifier,
  processCsvFile,
  processFile,
  verifySingleEmail,
  initializeService,
  updateApiKeys,
  updateFilesRegistry,
  updateInputFileRegistry
}; 