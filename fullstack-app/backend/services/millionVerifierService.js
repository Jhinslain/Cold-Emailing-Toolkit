const axios = require('axios');
const fs = require('fs').promises;
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');

// Configuration directe du service
const API_KEYS = [
  process.env.API_MILLION_VERIFIER1,
  process.env.API_MILLION_VERIFIER2,
  process.env.API_MILLION_VERIFIER3
].filter(key => key); // Filtrer les clés vides

const MILLION_VERIFIER_URL = 'https://api.millionverifier.com/api/v3/';
const BATCH_SIZE = 3;
const DELAY_BETWEEN_BATCHES = 1000; // 1 seconde
const REQUEST_TIMEOUT = 20000; // 20 secondes
const API_TIMEOUT = 15; // Timeout de l'API MillionVerifier
const MAX_RETRIES = 2;

/**
 * Met à jour le fichier files-registry.json avec les informations du fichier de sortie
 * @param {string} outputFilePath Chemin vers le fichier de sortie
 * @param {number} validRows Nombre de lignes valides écrites
 * @param {number} totalRows Nombre total de lignes traitées
 */
async function updateFilesRegistry(outputFilePath, validRows, totalRows) {
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
      invalidRows: totalRows - validRows
    };
    
    // Écrire le fichier registry mis à jour
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`[SERVICE] Registry mis à jour pour ${fileName}: ${validRows} lignes valides sur ${totalRows} total, taille: ${fileSize} octets`);
    
  } catch (error) {
    console.error('[SERVICE] Erreur lors de la mise à jour du registry:', error.message);
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
    
    // Retry avec une autre clé si possible
    if (retryCount < Math.min(MAX_RETRIES, API_KEYS.length - 1) && error.response?.status !== 400) {
      console.log(`[SERVICE] Retry avec une autre clé API pour ${email}`);
      return verifySingleEmail(email, retryCount + 1);
    }
    
    return { email, error: error.message, result: null };
  }
}

/**
 * Vérifie une liste d'emails via MillionVerifier avec gestion des batches et délais
 * @param {string[]} emails Liste des emails à vérifier
 * @returns {Promise<Array<{email: string, result: any, error?: string}>>}
 */
async function verifyEmailsMillionVerifier(emails) {
  console.log(`[SERVICE] Début de la vérification de ${emails.length} emails`);
  
  if (emails.length === 0) {
    return [];
  }

  const results = [];
  const batchSize = BATCH_SIZE;
  const delayBetweenBatches = DELAY_BETWEEN_BATCHES;

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    console.log(`[SERVICE] Traitement du batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(emails.length/batchSize)} (${batch.length} emails)`);
    
    // Traiter le batch en parallèle
    const batchPromises = batch.map(email => verifySingleEmail(email));
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
 * Traite un fichier CSV et filtre les lignes avec des emails de qualité 'good'
 * @param {string} inputFilePath Chemin vers le fichier CSV d'entrée
 * @returns {Promise<{total: number, valid: number, invalid: number, outputPath: string}>}
 */
async function processCsvFile(inputFilePath) {
  console.log(`[SERVICE] Début du traitement du fichier: ${inputFilePath}`);
  
  try {
    // Vérifier que le fichier existe
    await fs.access(inputFilePath);
    
    // Générer le nom du fichier de sortie avec suffixe _verifier
    const inputDir = path.dirname(inputFilePath);
    const inputFileName = path.basename(inputFilePath, path.extname(inputFilePath));
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
    
    // Mettre à jour le fichier files-registry.json
    await updateFilesRegistry(outputFilePath, validRows.length, dataRows.length);
    
    return {
      total: dataRows.length,
      valid: validCount,
      invalid: invalidCount,
      outputPath: outputFilePath
    };
    
  } catch (error) {
    console.error(`[SERVICE] Erreur lors du traitement du fichier:`, error);
    throw error;
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
  updateFilesRegistry
}; 