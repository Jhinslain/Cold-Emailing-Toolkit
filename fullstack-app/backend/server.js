const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Import des routes des campagnes
const campaignRoutes = require('./routes/campaigns');

// Import des routes des comptes email
const emailAccountsRoutes = require('./routes/emailAccounts');

// --- CONFIGURATION CORS ---
const app = express();
const allowedOrigins = [
  'http://localhost:5173',
  'http://domains.majoli.io',
  'https://domains.majoli.io'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-session-id']
}));
app.use(express.json());

// --- SYSTÈME D'AUTHENTIFICATION ---
// Stockage simple des sessions (en production, utilisez Redis ou une base de données)
const sessions = new Map();

// Système de limitation de tentatives de connexion
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5; // Nombre maximum de tentatives
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes en millisecondes

// Mot de passe configuré via variable d'environnement ou par défaut
const HASHED_PASSWORD = process.env.HASHED_PASSWORD || null;

// Middleware d'authentification
const requireAuth = (req, res, next) => {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentification requise',
      requiresAuth: true 
    });
  }
  
  // Vérifier si la session n'a pas expiré (24h)
  const session = sessions.get(sessionId);
  const now = Date.now();
  if (now - session.createdAt > 24 * 60 * 60 * 1000) {
    sessions.delete(sessionId);
    return res.status(401).json({ 
      success: false, 
      error: 'Session expirée',
      requiresAuth: true 
    });
  }
  
  next();
};

// Route de connexion
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Mot de passe requis' 
    });
  }

  // Obtenir l'IP du client pour la limitation de tentatives
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  
  // Vérifier si l'IP est bloquée
  const attemptData = loginAttempts.get(clientIP);
  const now = Date.now();
  
  if (attemptData && attemptData.blockedUntil && now < attemptData.blockedUntil) {
    const remainingTime = Math.ceil((attemptData.blockedUntil - now) / 1000 / 60);
    return res.status(429).json({ 
      success: false, 
      error: `Trop de tentatives échouées. Réessayez dans ${remainingTime} minutes.`,
      blocked: true,
      remainingMinutes: remainingTime
    });
  }
  
  // Vérifier le mot de passe (avec hachage)
  let isValid = false;
  if (HASHED_PASSWORD) {
    // Utiliser le mot de passe hashé
    isValid = await bcrypt.compare(password, HASHED_PASSWORD);
  } else {
    // Aucun mot de passe configuré
    console.error('❌ HASHED_PASSWORD non configuré dans les variables d\'environnement');
    return res.status(500).json({ 
      success: false, 
      error: 'Configuration d\'authentification manquante' 
    });
  }
  
  if (!isValid) {
    // Incrémenter le compteur de tentatives échouées
    const currentAttempts = attemptData ? attemptData.count : 0;
    const newCount = currentAttempts + 1;
    
    if (newCount >= MAX_LOGIN_ATTEMPTS) {
      // Bloquer l'IP
      loginAttempts.set(clientIP, {
        count: newCount,
        blockedUntil: now + LOCKOUT_DURATION,
        lastAttempt: now
      });
      
      console.log(`🚫 IP ${clientIP} bloquée pour ${LOCKOUT_DURATION / 1000 / 60} minutes après ${MAX_LOGIN_ATTEMPTS} tentatives échouées`);
      
      return res.status(429).json({ 
        success: false, 
        error: `Trop de tentatives échouées. Réessayez dans ${LOCKOUT_DURATION / 1000 / 60} minutes.`,
        blocked: true,
        remainingMinutes: LOCKOUT_DURATION / 1000 / 60
      });
    } else {
      // Mettre à jour le compteur
      loginAttempts.set(clientIP, {
        count: newCount,
        blockedUntil: null,
        lastAttempt: now
      });
      
      console.log(`⚠️ Tentative de connexion échouée pour IP ${clientIP} (${newCount}/${MAX_LOGIN_ATTEMPTS})`);
      
      return res.status(401).json({ 
        success: false, 
        error: `Mot de passe incorrect. Tentative ${newCount}/${MAX_LOGIN_ATTEMPTS}`,
        attemptsRemaining: MAX_LOGIN_ATTEMPTS - newCount
      });
    }
  }
  
  // Connexion réussie - réinitialiser le compteur de tentatives
  loginAttempts.delete(clientIP);
  
  // Créer une nouvelle session
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    id: sessionId,
    createdAt: Date.now(),
    authenticated: true
  });
  
  console.log(`✅ Connexion réussie pour IP ${clientIP}`);
  
  res.json({ 
    success: true, 
    message: 'Connexion réussie',
    sessionId: sessionId
  });
});

// Route de déconnexion
app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  
  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
  }
  
  res.json({ 
    success: true, 
    message: 'Déconnexion réussie' 
  });
});

// Route pour vérifier l'état de l'authentification
app.get('/api/auth/status', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId || !sessions.has(sessionId)) {
    return res.json({ 
      authenticated: false 
    });
  }
  
  const session = sessions.get(sessionId);
  const now = Date.now();
  
  if (now - session.createdAt > 24 * 60 * 60 * 1000) {
    sessions.delete(sessionId);
    return res.json({ 
      authenticated: false 
    });
  }
  
  res.json({ 
    authenticated: true 
  });
});

// Route pour vérifier le statut de blocage d'une IP
app.get('/api/auth/block-status', (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  const attemptData = loginAttempts.get(clientIP);
  const now = Date.now();
  
  if (attemptData && attemptData.blockedUntil && now < attemptData.blockedUntil) {
    const remainingTime = Math.ceil((attemptData.blockedUntil - now) / 1000 / 60);
    return res.json({
      blocked: true,
      remainingMinutes: remainingTime,
      attemptsUsed: attemptData.count
    });
  }
  
  res.json({
    blocked: false,
    attemptsUsed: attemptData ? attemptData.count : 0,
    attemptsRemaining: MAX_LOGIN_ATTEMPTS - (attemptData ? attemptData.count : 0)
  });
});

// Route de debug pour vérifier l'état des sessions
app.get('/api/auth/debug-sessions', (req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
    id,
    createdAt: new Date(session.createdAt).toISOString(),
    age: Math.floor((Date.now() - session.createdAt) / 1000 / 60) + ' minutes'
  }));
  
  res.json({
    totalSessions: sessions.size,
    sessions: sessionList
  });
});

// Import des services
const OpendataService = require('./services/opendataService');
const DailyService = require('./services/dailyService');
const FileService = require('./services/fileService');
const WhoisService = require('./services/whoisService');
const PersonalizedMessageService = require('./services/personalizedMessageService');
const { filterByDate } = require('./services/filterByDateService');
const { filterByLocation, getAvailableColumns } = require('./services/filterByLocationService');
const MergeService = require('./services/mergeService');
const UpdateDatesService = require('./services/updateDatesService');
const ImportService = require('./services/importService');
const millionVerifierService = require('./services/millionVerifierService');

// Instanciation des services
const opendataService = new OpendataService();
const dailyService = new DailyService();
const fileService = new FileService();
const whoisService = new WhoisService();
const personalizedMessageService = new PersonalizedMessageService();
const mergeService = new MergeService(path.join(__dirname, 'data'));
const updateDatesService = new UpdateDatesService(path.join(__dirname, 'data'));
const importService = new ImportService(path.join(__dirname, 'data'));

const PORT = process.env.PORT || 3001;

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers CSV sont autorisés'), false);
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max
  }
});

// Route de test
app.get('/api/hello', (req, res) => {
  res.json({ message: "Hello from backend" });
});

// Route pour obtenir les informations sur les scripts disponibles
app.get('/api/scripts/info', requireAuth, (req, res) => {
  const scriptsInfo = {
    opendata: {
      name: "Télécharger l'Opendata Afnic",
      description: "Télécharge et extrait le fichier mensuel des domaines .fr de l'AFNIC",
      options: [
        { id: "auto", name: "Automatique (3 derniers mois)", description: "Essaie automatiquement les 3 derniers mois disponibles" },
        { id: "manual", name: "Manuel", description: "Choisir un mois spécifique (format YYYYMM)" }
      ]
    },
    daily: {
      name: "Télécharger les fichiers quotidiens",
      description: "Récupère les données des 7 derniers jours (sans aujourd'hui)",
      options: [
        { id: "yesterday", name: "Hier uniquement", description: "Télécharge les données d'hier" },
        { id: "last7days", name: "7 derniers jours", description: "Télécharge les 7 derniers jours (sans aujourd'hui)" },
        { id: "specific", name: "Jour spécifique", description: "Choisir un jour spécifique (1-7 jours en arrière)" }
      ]
    },
    dailyDomains: {
      name: "Télécharger les domaines quotidiens",
      description: "Télécharge et convertit automatiquement les fichiers TXT en CSV",
      options: [
        { id: "yesterday", name: "Hier uniquement", description: "Télécharge les domaines d'hier" },
        { id: "week", name: "La semaine", description: "Télécharge les 7 derniers jours" },
        { id: "custom", name: "X derniers jours", description: "Choisir le nombre de jours (1-30)" }
      ]
    },
    process: {
      name: "Traitement des domaines valides",
      description: "Filtre les domaines actifs (sans date de retrait WHOIS)",
      options: [
        { id: "test", name: "Test rapide (1000 lignes)", description: "Teste le processus sur un échantillon" },
        { id: "full", name: "Traitement complet", description: "Traite tous les domaines" },
        { id: "advanced", name: "Traitement avancé", description: "Avec configuration personnalisée" }
      ]
    }
  };
  
  res.json(scriptsInfo);
});

// Route pour télécharger l'Opendata Afnic
app.post('/api/opendata/download', requireAuth, async (req, res) => {
  try {
    const { mode, month } = req.body;
    
    if (mode === 'manual' && !month) {
      return res.status(400).json({ error: 'Le mois est requis en mode manuel' });
    }
    
    console.log(`🔄 Début du téléchargement Opendata - Mode: ${mode}${month ? ', Mois: ' + month : ''}`);
    
    const result = await opendataService.downloadAndExtractOpendata(mode, month);

    // Mise à jour du nombre de lignes dans le registre pour le fichier téléchargé
    if (result && result.file) {
      await fileService.updateFileLineCount(result.file);
      // Si un fichier _valides a été généré, mets aussi à jour son nombre de lignes
      if (result.processResult && result.processResult.outputFile) {
        const validFile = result.processResult.outputFile;
        const validFileName = path.basename(validFile);
        await fileService.updateFileLineCount(validFileName);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Téléchargement terminé avec succès',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du téléchargement Opendata:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour télécharger les fichiers quotidiens
app.post('/api/daily/download', requireAuth, async (req, res) => {
  try {
    const { mode, days } = req.body;
    
    if (mode === 'specific' && (!days || days < 1 || days > 7)) {
      return res.status(400).json({ error: 'Le nombre de jours doit être entre 1 et 7' });
    }
    
    console.log(`🔄 Début du téléchargement quotidien - Mode: ${mode}${days ? ', Jours: ' + days : ''}`);
    
    const result = await dailyService.downloadDailyFiles(mode, days);
    
    res.json({ 
      success: true, 
      message: 'Téléchargement quotidien terminé avec succès',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du téléchargement quotidien:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour télécharger les domaines quotidiens avec conversion automatique
app.post('/api/daily/domains/download', requireAuth, async (req, res) => {
  try {
    const { mode, days } = req.body;
    if (mode === 'custom' && (!days || days < 1 || days > 30)) {
      return res.status(400).json({ error: 'Le nombre de jours doit être entre 1 et 30' });
    }
    console.log(`🔄 Début du téléchargement des domaines quotidiens - Mode: ${mode}${days ? ', Jours: ' + days : ''}`);
    const result = await dailyService.downloadDailyFiles(mode, days);
    res.json({ 
      success: true, 
      message: 'Téléchargement des domaines quotidiens terminé avec succès',
      data: result
    });
  } catch (error) {
    console.error('❌ Erreur lors du téléchargement des domaines quotidiens:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour traiter les domaines valides
app.post('/api/domains/process', requireAuth, async (req, res) => {
  try {
    const { mode } = req.body;
    
    console.log(`🔄 Début du traitement des domaines - Mode: ${mode}`);
    
    const result = await opendataService.processDomains(mode);
    
    res.json({ 
      success: true, 
      message: 'Traitement des domaines terminé avec succès',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du traitement des domaines:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour lister les fichiers disponibles
app.get('/api/files/list', requireAuth, (req, res) => {
  try {
    const dataFiles = fileService.getDataFiles();
    const outputFiles = fileService.getOutputFiles();
    const inputFiles = fileService.getInputFiles();
    
    res.json({
      data: dataFiles,
      output: outputFiles,
      input: inputFiles
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des fichiers:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour obtenir les statistiques
app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const stats = fileService.getAllStats();
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des statistiques:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour obtenir les statistiques détaillées
app.get('/api/stats/detailed', requireAuth, (req, res) => {
  try {
    const stats = fileService.getDetailedStats();
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des statistiques détaillées:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour obtenir les dates disponibles pour les fichiers quotidiens
app.get('/api/daily/dates', requireAuth, (req, res) => {
  try {
    const dates = dailyService.getAvailableDates();
    res.json({ dates });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des dates:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour obtenir les statistiques des fichiers quotidiens
app.get('/api/daily/stats', requireAuth, (req, res) => {
  try {
    const stats = dailyService.getDailyStats();
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des stats quotidiennes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour obtenir un aperçu d'un fichier CSV
app.get('/api/files/preview/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const { lines = 10 } = req.query;
    const possibleDirs = [fileService.dataDir, fileService.outputDir, fileService.inputDir];
    let filePath = null;
    for (const dir of possibleDirs) {
      const testPath = path.join(dir, filename);
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        break;
      }
    }
    if (!filePath) {
      console.log('Fichier non trouvé dans aucun dossier:', filename);
      return res.status(404).json({ success: false, error: 'Fichier non trouvé' });
    }
    const preview = await fileService.getCSVPreview(filePath, parseInt(lines));
    if (!preview) {
      return res.status(500).json({ success: false, error: 'Impossible de lire le fichier' });
    }
    res.json({ success: true, preview });
  } catch (error) {
    console.error('❌ Erreur lors de la lecture du fichier:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route pour obtenir les colonnes d'un fichier CSV
app.get('/api/files/columns/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    
    const filePath = path.join(fileService.dataDir, filename);
    const columns = await fileService.getCSVColumns(filePath);
    
    if (columns.length === 0) {
      return res.status(404).json({ error: 'Fichier non trouvé ou format invalide' });
    }
    
    res.json({ columns });
    
  } catch (error) {
    console.error('❌ Erreur lors de la lecture des colonnes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour obtenir les métadonnées d'un fichier CSV (nombre de lignes, colonnes, etc.)
app.get('/api/files/metadata/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const { basic } = req.query; // Paramètre pour obtenir seulement les métadonnées de base
    
    const filePath = path.join(fileService.dataDir, filename);
    
    // Vérifier d'abord si le fichier existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Fichier non trouvé' 
      });
    }
    
    // Si basic=true, retourner seulement les métadonnées de base (plus rapide)
    if (basic === 'true') {
      const stats = fs.statSync(filePath);
      const registry = fileService.loadFilesRegistry();
      const fileInfo = registry[filename] || {};
      
      const basicMetadata = {
        filename: path.basename(filePath),
        size: stats.size,
        modified: stats.mtime,
        totalLines: fileInfo.totalLines || 0,
        category: fileInfo.category || 'fichier',
        fileType: fileService.getFileType(filename),
        isOpendata: fileService.isOpendataFile(filename),
        isDaily: fileService.isDailyFile(filename),
        isDomains: fileService.isDomainsFile(filename),
        isValides: fileService.isValidesFile(filename),
        isWhois: fileService.isWhoisFile(filename),
        isDateFiltered: fileService.isDateFilteredFile(filename)
      };
      
      return res.json({ success: true, metadata: basicMetadata });
    }
    
    // Timeout pour éviter les blocages
    const metadataPromise = fileService.getFileMetadata(filePath);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 30000)
    );
    
    const metadata = await Promise.race([metadataPromise, timeoutPromise]);
    
    if (!metadata) {
      return res.status(500).json({ 
        success: false, 
        error: 'Impossible de lire les métadonnées' 
      });
    }
    
    res.json({ success: true, metadata });
  } catch (error) {
    console.error('❌ Erreur lors de la lecture des métadonnées:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour importer un fichier CSV
app.post('/api/files/import', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'Aucun fichier n\'a été fourni' 
      });
    }

    console.log(`📁 Import du fichier: ${req.file.originalname}`);
    
    // Importer le fichier
    const result = await importService.importCSVFile(req.file.originalname, req.file.path);
    
    if (result.success) {
      // Ajouter le fichier au registre
      await fileService.updateFileInfo(result.filename, result.fileInfo);
      
      // Nettoyer le fichier temporaire
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('⚠️ Erreur lors du nettoyage du fichier temporaire:', cleanupError.message);
      }
      
      res.json({
        success: true,
        message: 'Fichier importé avec succès',
        filename: result.filename,
        originalName: result.originalName,
        totalLines: result.totalLines,
        detectedType: result.detectedType,
        dates: result.dates
      });
    } else {
      // Nettoyer le fichier temporaire en cas d'erreur
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('⚠️ Erreur lors du nettoyage du fichier temporaire:', cleanupError.message);
      }
      
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'import du fichier:', error.message);
    
    // Nettoyer le fichier temporaire en cas d'erreur
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('⚠️ Erreur lors du nettoyage du fichier temporaire:', cleanupError.message);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour supprimer plusieurs fichiers
app.post('/api/files/delete', requireAuth, async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Liste de fichiers requise' });
    }
    
    console.log(`🗑️ Suppression de ${files.length} fichier(s): ${files.join(', ')}`);
    
    const deletedFiles = [];
    const errors = [];
    
    for (const filename of files) {
      try {
        console.log(`🔍 Recherche du fichier: ${filename}`);
        
        // Chercher le fichier dans les différents dossiers
        const dataPath = path.join(fileService.dataDir, filename);
        const outputPath = path.join(fileService.outputDir, filename);
        const inputPath = path.join(fileService.inputDir, filename);
        
        console.log(`📁 Chemins de recherche:`);
        console.log(`   - Data: ${dataPath}`);
        console.log(`   - Output: ${outputPath}`);
        console.log(`   - Input: ${inputPath}`);
        
        let fileDeleted = false;
        
        if (fs.existsSync(dataPath)) {
          console.log(`✅ Fichier trouvé dans data: ${dataPath}`);
          fs.unlinkSync(dataPath);
          fileDeleted = true;
          console.log(`🗑️ Fichier supprimé: ${dataPath}`);
        }
        
        if (fs.existsSync(outputPath)) {
          console.log(`✅ Fichier trouvé dans output: ${outputPath}`);
          fs.unlinkSync(outputPath);
          fileDeleted = true;
          console.log(`🗑️ Fichier supprimé: ${outputPath}`);
        }
        
        if (fs.existsSync(inputPath)) {
          console.log(`✅ Fichier trouvé dans input: ${inputPath}`);
          fs.unlinkSync(inputPath);
          fileDeleted = true;
          console.log(`🗑️ Fichier supprimé: ${inputPath}`);
        }
        
        if (fileDeleted) {
          deletedFiles.push(filename);
          console.log(`✅ ${filename} supprimé avec succès`);
        } else {
          const errorMsg = `Fichier non trouvé: ${filename}`;
          console.warn(`⚠️ ${errorMsg}`);
          errors.push(errorMsg);
        }
        
      } catch (error) {
        const errorMsg = `Erreur lors de la suppression de ${filename}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    console.log(`📊 Résumé de la suppression:`);
    console.log(`   - Fichiers supprimés: ${deletedFiles.length}`);
    console.log(`   - Erreurs: ${errors.length}`);
    
    res.json({ 
      success: true, 
      message: `${deletedFiles.length} fichier(s) supprimé(s) avec succès`,
      deletedFiles,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des fichiers:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour fusionner plusieurs fichiers
app.post('/api/files/merge', requireAuth, async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length < 2) {
      return res.status(400).json({ error: 'Au moins 2 fichiers requis pour la fusion' });
    }
    
    console.log(`🔄 Fusion de ${files.length} fichier(s): ${files.join(', ')}`);
    
    const result = await mergeService.mergeFiles(files);
    
    res.json({ 
      success: true, 
      message: 'Fichiers fusionnés avec succès',
      mergedFileName: result.mergedFileName,
      totalLines: result.totalLines,
      mergedFiles: files,
      dates: result.dates
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la fusion des fichiers:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour télécharger un fichier
app.get('/api/files/download/:filename', requireAuth, (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(fileService.dataDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Fichier non trouvé');
  }
  res.download(filePath, filename);
});

// Route pour obtenir toutes les catégories
app.get('/api/categories', requireAuth, (req, res) => {
  try {
    const categories = fileService.getAllCategories();
    res.json({ success: true, categories });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des catégories:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour obtenir le registre complet des fichiers
app.get('/api/files/registry', requireAuth, (req, res) => {
  try {
    const registry = fileService.loadFilesRegistry();
    res.json({ success: true, registry });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du registre:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour synchroniser le registre
app.post('/api/files/sync', requireAuth, (req, res) => {
  try {
    const registry = fileService.syncRegistry();
    res.json({ 
      success: true, 
      message: 'Registre synchronisé avec succès',
      registry 
    });
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation du registre:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour mettre à jour les métadonnées d'un fichier
app.post('/api/files/update-metadata/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const success = await fileService.updateFileMetadata(filename);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Métadonnées mises à jour pour ${filename}` 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Fichier non trouvé' 
      });
    }
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des métadonnées:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour définir la catégorie d'un fichier
app.post('/api/files/category', requireAuth, (req, res) => {
  try {
    const { filename, category } = req.body;
    
    if (!filename || !category) {
      return res.status(400).json({ error: 'Nom de fichier et catégorie requis' });
    }
    
    if (!['fichier', 'archive', 'ready'].includes(category)) {
      return res.status(400).json({ error: 'Catégorie invalide' });
    }
    
    const success = fileService.setFileCategory(filename, category);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Catégorie mise à jour pour ${filename}` 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la sauvegarde de la catégorie' 
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de la catégorie:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour obtenir les fichiers par catégorie
app.get('/api/categories/:category', requireAuth, (req, res) => {
  try {
    const { category } = req.params;
    
    if (!['fichier', 'archive', 'ready'].includes(category)) {
      return res.status(400).json({ error: 'Catégorie invalide' });
    }
    
    const files = fileService.getFilesByCategory(category);
    res.json({ success: true, files });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des fichiers par catégorie:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour filtrer par date
app.post('/api/filter/date', requireAuth, async (req, res) => {
  try {
    const { filename, startDate, endDate } = req.body;
    
    if (!filename || !startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nom de fichier, date de début et date de fin requises' 
      });
    }
    
    console.log(`📅 Filtrage par date - Fichier: ${filename}, Période: ${startDate} à ${endDate}`);
    
    // Construire le chemin du fichier d'entrée
    const inputFile = path.join(fileService.dataDir, filename);
    
    if (!fs.existsSync(inputFile)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Fichier d\'entrée non trouvé' 
      });
    }
    
    const result = await filterByDate(inputFile, startDate, endDate);
    
    if (result.success) {
      // Mettre à jour les métadonnées du nouveau fichier
      await fileService.updateFileLineCount(result.outputFile);
      
      res.json({
        success: true,
        message: 'Filtrage par date terminé avec succès',
        ...result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du filtrage par date:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour obtenir les colonnes d'un fichier (diagnostic)
app.get('/api/files/columns/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const inputFile = path.join(fileService.dataDir, filename);
    
    if (!fs.existsSync(inputFile)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Fichier non trouvé' 
      });
    }
    
    const columns = await getAvailableColumns(inputFile);
    
    res.json({
      success: true,
      filename,
      totalColumns: columns.length,
      columns: columns
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la lecture des colonnes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour filtrer par localisation
app.post('/api/filter/location', requireAuth, async (req, res) => {
  try {
    const { filename, filterType, filterValue } = req.body;
    
    console.log('🔍 Données reçues:', { filename, filterType, filterValue });
    console.log('📁 Dossier data:', fileService.dataDir);
    
    if (!filename || !filterType || !filterValue) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nom de fichier, type de filtre et valeur requises' 
      });
    }
    
    if (!['ville', 'departement', 'region'].includes(filterType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Type de filtre invalide. Utilisez: ville, departement, ou region' 
      });
    }
    
    console.log(`🗺️ Filtrage par localisation - Fichier: ${filename}, Type: ${filterType}, Valeur: ${filterValue}`);
    
    // Construire le chemin du fichier d'entrée
    const inputFile = path.join(fileService.dataDir, filename);
    console.log('📂 Chemin complet du fichier:', inputFile);
    
    // Vérifier si le dossier data existe
    if (!fs.existsSync(fileService.dataDir)) {
      console.error('❌ Dossier data non trouvé:', fileService.dataDir);
      return res.status(500).json({ 
        success: false, 
        error: 'Dossier data non trouvé' 
      });
    }
    
    if (!fs.existsSync(inputFile)) {
      console.error('❌ Fichier d\'entrée non trouvé:', inputFile);
      return res.status(404).json({ 
        success: false, 
        error: 'Fichier d\'entrée non trouvé' 
      });
    }
    
    console.log('✅ Fichier trouvé, début du filtrage...');
    const result = await filterByLocation(inputFile, filterType, filterValue);
    
    if (result.success) {
      // Mettre à jour les métadonnées du nouveau fichier
      await fileService.updateFileLineCount(result.outputFile);
      
      res.json({
        success: true,
        message: 'Filtrage par localisation terminé avec succès',
        ...result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        availableColumns: result.availableColumns
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du filtrage par localisation:', error.message);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour analyser un fichier CSV de domaines avec WHOIS
app.post('/api/whois/analyze', requireAuth, async (req, res) => {
  console.log('➡️  Requête WHOIS reçue', req.body);
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Nom de fichier requis' });
    }
    const outputFile = await whoisService.analyzeCsvFile(filename);
    res.json({ success: true, outputFile });
  } catch (error) {
    console.error('❌ Erreur WHOIS:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint SSE pour logs en temps réel du traitement Whois
app.get('/api/whois/analyze/stream', async (req, res) => {
  const { filename, jobId, sessionId } = req.query;
  if (!filename || !jobId) {
    res.status(400).end();
    return;
  }
  
  // Vérifier l'authentification via sessionId dans les paramètres
  console.log(`🔍 Vérification sessionId: ${sessionId}`);
  console.log(`📊 Sessions disponibles: ${sessions.size}`);
  console.log(`🔑 Session existe: ${sessions.has(sessionId)}`);
  
  if (!sessionId || !sessions.has(sessionId)) {
    console.log(`❌ Session invalide ou inexistante: ${sessionId}`);
    res.status(401).end();
    return;
  }
  
  // Vérifier si la session n'a pas expiré (24h)
  const session = sessions.get(sessionId);
  const now = Date.now();
  console.log(`⏰ Session créée: ${new Date(session.createdAt).toISOString()}`);
  console.log(`⏰ Maintenant: ${new Date(now).toISOString()}`);
  console.log(`⏰ Différence: ${(now - session.createdAt) / 1000 / 60} minutes`);
  
  if (now - session.createdAt > 24 * 60 * 60 * 1000) {
    console.log(`❌ Session expirée: ${sessionId}`);
    sessions.delete(sessionId);
    res.status(401).end();
    return;
  }
  
  console.log(`✅ Session valide: ${sessionId}`);
  
  console.log(`🌐 Début SSE WHOIS - filename: ${filename}, jobId: ${jobId}`);
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  const sendLog = (type, message) => {
    try {
      res.write(`event: ${type}\ndata: ${JSON.stringify({ message })}\n\n`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du log SSE:', error);
    }
  };
  
  try {
    await whoisService.analyzeCsvFileStream(jobId, filename, sendLog);
    console.log(`✅ SSE WHOIS terminé avec succès - jobId: ${jobId}`);
  } catch (error) {
    console.error(`❌ Erreur SSE WHOIS - jobId: ${jobId}:`, error.message);
    sendLog('error', `Erreur serveur: ${error.message}`);
  } finally {
    res.end();
  }
});

// Endpoint pour annuler un traitement Whois
app.post('/api/whois/analyze/cancel', (req, res) => {
  const { jobId } = req.body;
  if (!jobId) {
    return res.status(400).json({ success: false, error: 'jobId requis' });
  }
  whoisService.cancelJob(jobId);
  res.json({ success: true });
});

// Route pour générer des messages personnalisés
app.post('/api/personalized-messages/generate', requireAuth, async (req, res) => {
  console.log('➡️  Requête messages personnalisés reçue', req.body);
  try {
    const { filename, messageTemplate } = req.body;
    if (!filename || !messageTemplate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nom de fichier et template de message requis' 
      });
    }

    // Note: Le service accepte tous les fichiers CSV, mais le bouton n'apparaît que sur les fichiers WHOIS côté frontend

    const outputFile = await personalizedMessageService.generatePersonalizedMessages(
      'sync-' + Date.now(), 
      filename, 
      messageTemplate, 
      (type, message) => console.log(`[${type}] ${message}`)
    );
    
    res.json({ success: true, outputFile });
  } catch (error) {
    console.error('❌ Erreur messages personnalisés:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint SSE pour logs en temps réel du traitement des messages personnalisés
app.get('/api/personalized-messages/generate/stream', requireAuth, async (req, res) => {
  const { filename, messageTemplate, jobId } = req.query;
  if (!filename || !messageTemplate || !jobId) {
    res.status(400).end();
    return;
  }
  
  console.log(`🌐 Début SSE messages personnalisés - filename: ${filename}, jobId: ${jobId}`);
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  const sendLog = (type, message) => {
    try {
      res.write(`event: ${type}\ndata: ${JSON.stringify({ message })}\n\n`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du log SSE:', error);
    }
  };
  
  try {
    await personalizedMessageService.generatePersonalizedMessages(jobId, filename, messageTemplate, sendLog);
    console.log(`✅ SSE messages personnalisés terminé avec succès - jobId: ${jobId}`);
  } catch (error) {
    console.error(`❌ Erreur SSE messages personnalisés - jobId: ${jobId}:`, error.message);
    sendLog('error', `Erreur serveur: ${error.message}`);
  } finally {
    res.end();
  }
});

// Endpoint pour annuler un traitement de messages personnalisés
app.post('/api/personalized-messages/generate/cancel', (req, res) => {
  const { jobId } = req.body;
  if (!jobId) {
    return res.status(400).json({ success: false, error: 'jobId requis' });
  }
  personalizedMessageService.cancelJob(jobId);
  res.json({ success: true });
});



// Route pour lancer manuellement le processus complet du scheduler (téléchargement + WHOIS + Million Verifier)
app.post('/api/scheduler/execute-daily-process', requireAuth, async (req, res) => {
  console.log('➡️  Requête exécution manuelle du processus complet du scheduler reçue');
  try {
    await scheduler.executeDailyYesterdayDownloadAndWhois();
    res.json({ 
      success: true, 
      message: 'Processus complet du scheduler exécuté avec succès ! (Téléchargement + WHOIS + Million Verifier)' 
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution du processus du scheduler:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Routes pour la gestion des dates dans le registre
app.post('/api/dates/update-all', (req, res) => {
  try {
    const result = updateDatesService.updateAllDates();
    res.json({ 
      success: true, 
      message: 'Dates mises à jour avec succès',
      ...result
    });
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des dates:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/dates/update/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const result = updateDatesService.updateFileDates(filename);
    res.json({ 
      success: true, 
      message: `Dates mises à jour pour ${filename}`,
      ...result
    });
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des dates:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/dates/stats', (req, res) => {
  try {
    const stats = updateDatesService.getDatesStats();
    res.json({ 
      success: true, 
      stats
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des statistiques des dates:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route pour analyse WHOIS/RDAP d'un seul domaine
app.post('/api/whois/single', requireAuth, async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ success: false, error: 'Domaine requis' });
    }
    const result = await whoisService.analyzeSingleDomain(domain);
    res.json({ success: true, result });
  } catch (error) {
    console.error('❌ Erreur WHOIS single:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route pour vérifier un batch d'emails avec MillionVerifier
app.post('/api/millionverifier/batch', async (req, res) => {
  console.log("[BACKEND] Appel /api/millionverifier/batch, body:", req.body);
  try {
    const { emails, fileName } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      console.log("[BACKEND] Aucun email fourni.");
      return res.status(400).json({ success: false, error: 'Aucun email fourni.' });
    }
    
    const results = await millionVerifierService.verifyEmailsMillionVerifier(emails);
    console.log("[BACKEND] Résultats MillionVerifier:", results);

    // Filtrer les bons emails (good, ok selon les critères MillionVerifier)
    const goodResults = results.filter(r =>
      r.result && (r.result.status === 'good' || r.result.status === 'ok')
    );

    // Générer le nom du fichier de sortie
    const FileService = require('./services/fileService');
    const fileService = new FileService();
    let verifierFileName = 'emails_verifier.csv';
    if (fileName) {
      // Prendre le nom sans extension et ajouter _verifier.csv
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      verifierFileName = baseName + '_verifier.csv';
    }
    const outputDir = path.join(__dirname, 'data');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const verifierFilePath = path.join(outputDir, verifierFileName);
    
    // Supprimer l'ancien fichier s'il existe
    if (fs.existsSync(verifierFilePath)) {
      fs.unlinkSync(verifierFilePath);
    }

    // Utiliser le service MillionVerifier pour traiter le fichier complet et conserver les colonnes
    if (fileName) {
      const originalFilePath = path.join(outputDir, fileName);
      if (fs.existsSync(originalFilePath)) {
        try {
          console.log(`[BACKEND] Utilisation du service MillionVerifier pour traiter le fichier complet`);
          console.log(`🚀 [SERVER] Appel du service MillionVerifier depuis la route /api/millionverifier/verify`);
          
          // Utiliser notre service qui conserve toutes les colonnes
          const result = await millionVerifierService.processCsvFile(originalFilePath);
          
          console.log(`[BACKEND] Fichier traité avec succès: ${result.valid} lignes valides sur ${result.total} total`);
          
          // Mettre à jour le files-registry.json
          await fileService.updateFileInfo(verifierFileName, { 
            type: 'verifier',
            sourceFile: fileName,
            totalRows: result.total,
            validRows: result.valid,
            invalidRows: result.invalid
          });
          
          res.json({
            success: true,
            results,
            goodCount: result.valid,
            totalCount: result.total,
            verifierFile: verifierFileName,
            message: `Fichier filtré créé avec ${result.valid} emails valides sur ${result.total} total`
          });
          return;
          
        } catch (error) {
          console.error(`[BACKEND] Erreur lors du traitement du fichier complet:`, error.message);
          // Continuer avec la méthode fallback
        }
      }
    }
    
    // Fallback : méthode originale si le service échoue
    let header = '';
    let filteredLines = [];
    let writeFallback = false;
    
    if (fileName) {
      const originalFilePath = path.join(outputDir, fileName);
      if (fs.existsSync(originalFilePath)) {
        const fileContent = fs.readFileSync(originalFilePath, 'utf8');
        const lines = fileContent.split(/\r?\n/).filter(l => l.trim() !== '');
        header = lines[0];
        const columns = header.split(',').map(col => col.trim().toLowerCase());
        
        // Chercher la colonne email (insensible à la casse, espaces ignorés)
        let emailColIndex = columns.findIndex(col => col.replace(/\s+/g, '') === 'email');
        if (emailColIndex === -1) {
          // Essayer d'autres variantes
          emailColIndex = columns.findIndex(col => col.includes('email'));
        }
        
        if (emailColIndex !== -1) {
          // Liste des emails "good" ou "ok" (normalisés)
          const goodEmailsSet = new Set(goodResults.map(r => (r.email || '').trim().toLowerCase()));
          
          filteredLines = lines.slice(1).filter(line => {
            if (!line.trim()) return false;
            const cells = line.split(',');
            const email = (cells[emailColIndex] || '').trim().toLowerCase();
            return goodEmailsSet.has(email);
          });
          
          console.log(`[BACKEND] Filtrage fallback: ${lines.length - 1} lignes totales, ${filteredLines.length} lignes valides`);
        } else {
          console.log("[BACKEND] Colonne email non trouvée, utilisation du fallback");
          writeFallback = true;
        }
      } else {
        console.log("[BACKEND] Fichier d'origine non trouvé, utilisation du fallback");
        writeFallback = true;
      }
    } else {
      writeFallback = true;
    }
    
    // Si on a pu lire et filtrer, écrire le fichier avec la même structure
    if (!writeFallback && header && filteredLines.length > 0) {
      fs.writeFileSync(verifierFilePath, [header, ...filteredLines].join('\n'), 'utf8');
      console.log(`[BACKEND] Fichier filtré créé avec succès (fallback): ${verifierFileName}`);
    } else {
      // Fallback : structure simple avec les résultats de vérification
      const fallbackHeader = "email,status,quality,subresult\n";
      const lines = goodResults.map(r =>
        [
          r.email,
          r.result && r.result.result,
          r.result && r.result.quality,
          r.result && r.result.subresult
        ].join(',')
      );
      fs.writeFileSync(verifierFilePath, fallbackHeader + lines.join('\n'), 'utf8');
      console.log("[BACKEND] Fichier fallback créé");
    }
    
    // Mettre à jour le files-registry.json avec type: 'verifier'
    await fileService.updateFileInfo(verifierFileName, { type: 'verifier' });

    res.json({
      success: true,
      results,
      goodCount: goodResults.length,
      totalCount: results.length,
      verifierFile: verifierFileName,
      message: `Fichier filtré créé avec ${goodResults.length} emails valides sur ${results.length} total`
    });
  } catch (error) {
    console.error("[BACKEND] Erreur MillionVerifier:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route pour traiter un fichier CSV complet avec MillionVerifier
app.post('/api/millionverifier/process-file', requireAuth, async (req, res) => {
  console.log("[BACKEND] Appel /api/millionverifier/process-file, body:", req.body);
  try {
    const { inputFileName } = req.body;
    
    if (!inputFileName) {
      return res.status(400).json({ success: false, error: 'Nom du fichier d\'entrée requis.' });
    }
    
    const inputFilePath = path.join(__dirname, 'data', inputFileName);
    
    // Vérifier que le fichier d'entrée existe
    if (!fs.existsSync(inputFilePath)) {
      return res.status(404).json({ success: false, error: 'Fichier d\'entrée non trouvé.' });
    }
    
    console.log(`[BACKEND] Traitement du fichier: ${inputFilePath}`);
    console.log(`🚀 [SERVER] Appel du service MillionVerifier depuis la route /api/millionverifier/process-file`);
    
    // Utiliser le service MillionVerifier pour traiter le fichier complet
    const result = await millionVerifierService.processCsvFile(inputFilePath);
    
    // Extraire le nom du fichier de sortie créé
    const outputFileName = path.basename(result.outputPath);
    
    // Mettre à jour le files-registry.json avec le nouveau fichier de type 'verifier'
    const FileService = require('./services/fileService');
    const fileService = new FileService();
    await fileService.updateFileInfo(outputFileName, { 
      type: 'verifier',
      sourceFile: inputFileName,
      totalRows: result.valid, // Nombre de lignes valides
      validRows: result.valid,
      invalidRows: result.invalid,
      lastUpdated: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: `Fichier traité avec succès`,
      inputFile: inputFileName,
      outputFile: outputFileName,
      stats: result
    });
    
  } catch (error) {
    console.error("[BACKEND] Erreur traitement fichier MillionVerifier:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Routes des campagnes
app.use('/api/campaigns', campaignRoutes);

// Routes des comptes email
app.use('/api/email-accounts', emailAccountsRoutes);

// Démarrer le service de planification
const SchedulerService = require('./services/scheduler');
const scheduler = new SchedulerService();
// scheduler.scheduleOpendataDownload(); // Désactivé - téléchargement automatique de l'opendata
scheduler.scheduleDailyYesterdayDownloadAndWhois();
// scheduler.scheduleWhoisProcessing(); // Désactivé car inclus dans la tâche de 6h
scheduler.scheduleDataCleanup();
console.log('📅 Scheduler activé dans le serveur principal');

// Initialiser le service MillionVerifier
console.log('🚀 Initialisation des services...');
millionVerifierService.initializeService();

if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur backend sur http://0.0.0.0:${PORT} (accessible sur toutes les interfaces)`);
}); 