const express = require('express');
const router = express.Router();
const smartLeadsService = require('../services/smartLeadsService');
const SchedulerService = require('../services/scheduler');
const SmartleadImportService = require('../services/smartleadImportService');

// Middleware d'authentification
const authenticateSession = (req, res, next) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) {
    return res.status(401).json({ error: 'Session ID requis' });
  }
  // Ici vous pouvez ajouter une vérification plus poussée de la session
  next();
};

// Appliquer l'authentification à toutes les routes
router.use(authenticateSession);

// Route de test pour vérifier la connexion SmartLeads
router.get('/test-connection', async (req, res) => {
  try {
    console.log('🧪 Test de connexion à l\'API SmartLeads...');
    
    // Test simple de connexion
    const testResponse = await smartLeadsService.getAllCampaigns();
    
    res.json({
      success: true,
      message: 'Connexion à SmartLeads réussie',
      campaignsCount: testResponse.length,
      sampleCampaign: testResponse[0] || null
    });
  } catch (error) {
    console.error('❌ Test de connexion échoué:', error.message);
    res.status(500).json({
      success: false,
      error: 'Connexion à SmartLeads échouée',
      details: error.message
    });
  }
});

// GET /api/campaigns - Récupérer toutes les campagnes
router.get('/', async (req, res) => {
  try {
    const campaigns = await smartLeadsService.getAllCampaigns();
    res.json(campaigns);
  } catch (error) {
    console.error('Erreur lors de la récupération des campagnes:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
 });

// GET /api/campaigns/stats - Récupérer les statistiques globales
router.get('/stats', async (req, res) => {
  try {
    const stats = await smartLeadsService.getCampaignStats();
    res.json(stats);
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
 });

// GET /api/campaigns/:id - Récupérer une campagne par ID
router.get('/:id', async (req, res) => {
  try {
    const campaign = await smartLeadsService.getCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    res.json(campaign);
  } catch (error) {
    console.error('Erreur lors de la récupération de la campagne:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
 });

// POST /api/campaigns/:id/duplicate - Dupliquer une campagne
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, client_id } = req.body;
    
    console.log(`🔄 Demande de duplication de la campagne ${id}...`);
    
    // Vérifier que la campagne existe
    const originalCampaign = await smartLeadsService.getCampaignById(id);
    if (!originalCampaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    
    // Préparer les données pour la duplication
    const duplicationData = {
      name: name || `${originalCampaign.name} (Copie)`,
      client_id: client_id || null
    };
    
    console.log(`📋 Données de duplication:`, duplicationData);
    
    // Lancer la duplication
    const duplicatedCampaign = await smartLeadsService.duplicateCampaign(id, duplicationData);
    
    console.log(`✅ Campagne ${id} dupliquée avec succès vers ${duplicatedCampaign.id}`);
    
    res.status(201).json({
      success: true,
      message: 'Campagne dupliquée avec succès',
      originalCampaign: {
        id: originalCampaign.id,
        name: originalCampaign.name
      },
      duplicatedCampaign: duplicatedCampaign
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors de la duplication de la campagne ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de la duplication de la campagne',
      details: error.message
    });
  }
});

// POST /api/scheduler/trigger-daily-job - Déclencher manuellement le job dailyAndWhois
router.post('/scheduler/trigger-daily-job', async (req, res) => {
  try {
    console.log('🚀 Déclenchement manuel du job dailyAndWhois...');
    
    // Créer une instance du scheduler
    const scheduler = new SchedulerService();
    
    // Déclencher le job
    await scheduler.triggerJob('dailyAndWhois');
    
    res.json({
      success: true,
      message: 'Job dailyAndWhois déclenché avec succès',
      timestamp: new Date().toISOString(),
      jobType: 'dailyAndWhois'
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du déclenchement du job:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du déclenchement du job',
      details: error.message
    });
  }
});

// POST /api/campaigns - Créer une nouvelle campagne
router.post('/', async (req, res) => {
  try {
    const { name, description, startDate, endDate, totalLeads, maxLeadsPerDay, retryAttempts, delayBetweenRequests, targetLocations, targetIndustries, files } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Le nom de la campagne est requis' });
    }

    const campaignData = {
      name,
      description,
      startDate,
      endDate,
      totalLeads: parseInt(totalLeads) || 0,
      maxLeadsPerDay: parseInt(maxLeadsPerDay) || 100,
      retryAttempts: parseInt(retryAttempts) || 3,
      delayBetweenRequests: parseInt(delayBetweenRequests) || 2000,
      targetLocations: Array.isArray(targetLocations) ? targetLocations : [],
      targetIndustries: Array.isArray(targetIndustries) ? targetIndustries : [],
      files: Array.isArray(files) ? files : []
    };

    const newCampaign = await smartLeadsService.createCampaign(campaignData);
    res.status(201).json(newCampaign);
  } catch (error) {
    console.error('Erreur lors de la création de la campagne:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
 });

// PUT /api/campaigns/:id - Mettre à jour une campagne
router.put('/:id', async (req, res) => {
  try {
    const campaignId = req.params.id;
    const updateData = req.body;
    
    // Supprimer les champs qui ne doivent pas être modifiés
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.lastUpdated;
    
    const updatedCampaign = await smartLeadsService.updateCampaign(campaignId, updateData);
    res.json(updatedCampaign);
  } catch (error) {
    if (error.message === 'Campagne non trouvée') {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    console.error('Erreur lors de la mise à jour de la campagne:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
 });

// PATCH /api/campaigns/:id/progress - Mettre à jour le progrès d'une campagne
router.patch('/:id/progress', async (req, res) => {
  try {
    const { processedLeads, successfulLeads, failedLeads, dailyProgress } = req.body;
    
    const progressData = {
      processedLeads: parseInt(processedLeads),
      successfulLeads: parseInt(successfulLeads),
      failedLeads: parseInt(failedLeads),
      dailyProgress: parseInt(dailyProgress)
    };

    const updatedCampaign = await smartLeadsService.updateCampaign(campaignId, progressData);
    res.json(updatedCampaign);
  } catch (error) {
    if (error.message === 'Campagne non trouvée') {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    console.error('Erreur lors de la mise à jour du progrès:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
 });

// DELETE /api/campaigns/:id - Supprimer une campagne
router.delete('/:id', async (req, res) => {
  try {
    const result = await smartLeadsService.deleteCampaign(req.params.id);
    res.json(result);
  } catch (error) {
    if (error.message === 'Campagne non trouvée') {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    console.error('Erreur lors de la suppression de la campagne:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
 });

// GET /api/campaigns/search?q=query - Rechercher des campagnes
router.get('/search', async (req, res) => {
  try {
    const { q: query } = req.query;
    const campaigns = await smartLeadsService.searchCampaigns(query);
    res.json(campaigns);
  } catch (error) {
    console.error('Erreur lors de la recherche des campagnes:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
 });

// GET /api/campaigns/status/:status - Récupérer les campagnes par statut
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const campaigns = await smartLeadsService.getCampaignsByStatus(status);
    res.json(campaigns);
  } catch (error) {
    console.error('Erreur lors de la récupération des campagnes par statut:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
 });

// POST /api/campaigns/:id/duplicate - Dupliquer une campagne
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, files, settings } = req.body;
    
    const duplicatedCampaign = await smartLeadsService.duplicateCampaign(id, {
      name,
      description,
      files,
      settings
    });
    
    res.status(201).json(duplicatedCampaign);
  } catch (error) {
    if (error.message === 'Campagne originale non trouvée') {
      return res.status(404).json({ error: 'Campagne originale non trouvée' });
    }
    console.error('Erreur lors de la duplication de la campagne:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// POST /api/campaigns/:id/pause - Mettre en pause une campagne
router.post('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔄 Tentative de mise en pause de la campagne ${id}...`);
    
    const result = await smartLeadsService.pauseCampaign(id);
    console.log(`✅ Campagne ${id} mise en pause avec succès`);
    
    res.json({
      success: true,
      message: 'Campagne mise en pause avec succès',
      campaignId: id,
      result
    });
  } catch (error) {
    console.error(`❌ Erreur lors de la mise en pause de la campagne ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise en pause de la campagne',
      details: error.message 
    });
  }
});

// POST /api/campaigns/:id/stop - Arrêter une campagne
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🛑 Tentative d'arrêt de la campagne ${id}...`);
    
    const result = await smartLeadsService.stopCampaign(id);
    console.log(`✅ Campagne ${id} arrêtée avec succès`);
    
    res.json({
      success: true,
      message: 'Campagne arrêtée avec succès',
      campaignId: id,
      result
    });
  } catch (error) {
    console.error(`❌ Erreur lors de l'arrêt de la campagne ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'arrêt de la campagne',
      details: error.message 
    });
  }
});

// POST /api/campaigns/:id/start - Démarrer une campagne
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`▶️ Tentative de démarrage de la campagne ${id}...`);
    
    const result = await smartLeadsService.startCampaign(id);
    console.log(`✅ Campagne ${id} démarrée avec succès`);
    
    res.json({
      success: true,
      message: 'Campagne démarrée avec succès',
      campaignId: id,
      result
    });
  } catch (error) {
    console.error(`❌ Erreur lors du démarrage de la campagne ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors du démarrage de la campagne',
      details: error.message 
    });
  }
});

// POST /api/campaigns/:id/status - Mettre à jour le statut d'une campagne
router.post('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Le statut est requis' });
    }
    
    console.log(`🔄 Tentative de mise à jour du statut de la campagne ${id} vers ${status}...`);
    
    const result = await smartLeadsService.updateCampaignStatus(id, status);
    console.log(`✅ Statut de la campagne ${id} mis à jour vers ${status} avec succès`);
    
    res.json({
      success: true,
      message: `Statut de la campagne mis à jour vers ${status}`,
      campaignId: id,
      status,
      result
    });
  } catch (error) {
    console.error(`❌ Erreur lors de la mise à jour du statut de la campagne ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour du statut',
      details: error.message 
    });
  }
});

// GET /api/campaigns/smartleads/:smartLeadsId - Récupérer une campagne par ID SmartLeads
router.get('/smartleads/:smartLeadsId', async (req, res) => {
  try {
    const { smartLeadsId } = req.params;
    const campaign = await smartLeadsService.getCampaignBySmartLeadsId(smartLeadsId);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    
    res.json(campaign);
  } catch (error) {
    console.error('Erreur lors de la récupération de la campagne par ID SmartLeads:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ===== ROUTES SMARTLEAD.AI IMPORT =====

// POST /api/campaigns/:id/smartlead/import - Importer des leads depuis un CSV vers Smartlead.ai
router.post('/:id/smartlead/import', async (req, res) => {
  try {
    const { id } = req.params;
    const { csvFile, batchSize, maxLeads } = req.body;
    
    console.log(`🚀 Import Smartlead.ai pour la campagne ${id}...`);
    
    // Vérifier que la campagne existe
    const campaign = await smartLeadsService.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    
    // Vérifier que la campagne a un ID Smartlead
    if (!campaign.smartLeadsId) {
      return res.status(400).json({ error: 'Cette campagne n\'a pas d\'ID Smartlead.ai' });
    }
    
    // Initialiser le service Smartlead
    const apiKey = process.env.SMARTLEAD_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Clé API Smartlead.ai non configurée' });
    }
    
    const smartleadService = new SmartleadImportService(apiKey);
    
    // Configuration de l'import
    const config = {
      csvFile: csvFile,
      batchSize: batchSize || 50,
      maxLeads: maxLeads || null
    };
    
    // Timeout global de 10 minutes pour l'ensemble de l'import
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout: import trop long (10 minutes dépassées)')), 600000)
    );
    
    // Lancer l'import avec timeout
    const importPromise = smartleadService.importLeadsToCampaign(campaign.smartLeadsId, config);
    const result = await Promise.race([importPromise, timeoutPromise]);
    
    res.json({
      success: true,
      message: 'Import Smartlead.ai terminé avec succès',
      campaignId: id,
      smartleadId: campaign.smartLeadsId,
      result
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors de l'import Smartlead.ai pour la campagne ${req.params.id}:`, error);
    
    // Message d'erreur plus spécifique selon le type d'erreur
    let errorMessage = 'Erreur lors de l\'import Smartlead.ai';
    if (error.message.includes('Timeout')) {
      errorMessage = 'Import interrompu car trop long. Vérifiez les logs pour plus de détails.';
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Limite de taux dépassée. L\'import sera repris automatiquement.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// GET /api/campaigns/:id/smartlead/status - Vérifier le statut de l'import Smartlead.ai
router.get('/:id/smartlead/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier que la campagne existe
    const campaign = await smartLeadsService.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    
    // Vérifier que la campagne a un ID Smartlead
    if (!campaign.smartLeadsId) {
      return res.status(400).json({ error: 'Cette campagne n\'a pas d\'ID Smartlead.ai' });
    }
    
    // Récupérer les informations de la campagne depuis Smartlead.ai
    const apiKey = process.env.SMARTLEAD_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Clé API Smartlead.ai non configurée' });
    }
    
    const smartleadService = new SmartleadImportService(apiKey);
    
    try {
      // Récupérer les informations de la campagne Smartlead
      const response = await fetch(`https://server.smartlead.ai/api/v1/campaigns/${campaign.smartLeadsId}?api_key=${apiKey}`);
      const smartleadData = await response.json();
      
      res.json({
        success: true,
        campaignId: id,
        smartleadId: campaign.smartLeadsId,
        smartleadData: smartleadData,
        status: smartleadData.status || 'UNKNOWN'
      });
      
    } catch (smartleadError) {
      res.json({
        success: false,
        campaignId: id,
        smartleadId: campaign.smartLeadsId,
        error: 'Impossible de récupérer les informations Smartlead.ai',
        details: smartleadError.message
      });
    }
    
  } catch (error) {
    console.error(`❌ Erreur lors de la vérification du statut Smartlead.ai pour la campagne ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de la vérification du statut',
      details: error.message 
    });
  }
});

// POST /api/campaigns/:id/smartlead/configure - Configurer les paramètres d'import Smartlead.ai
router.post('/:id/smartlead/configure', async (req, res) => {
  try {
    const { id } = req.params;
    const { importSettings, hubspot } = req.body;
    
    console.log(`⚙️ Configuration Smartlead.ai pour la campagne ${id}...`);
    
    // Vérifier que la campagne existe
    const campaign = await smartLeadsService.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    
    // Vérifier que la campagne a un ID Smartlead
    if (!campaign.smartLeadsId) {
      return res.status(400).json({ error: 'Cette campagne n\'a pas d\'ID Smartlead.ai' });
    }
    
    // Initialiser le service Smartlead
    const apiKey = process.env.SMARTLEAD_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Clé API Smartlead.ai non configurée' });
    }
    
    const smartleadService = new SmartleadImportService(apiKey);
    
    // Configuration des paramètres d'import
    if (importSettings) {
      await smartleadService.configureCampaignImport(campaign.smartLeadsId, importSettings);
    }
    
    // Configuration de l'intégration Hubspot
    if (hubspot) {
      await smartleadService.configureHubspotIntegration(campaign.smartLeadsId, hubspot);
    }
    
    res.json({
      success: true,
      message: 'Configuration Smartlead.ai mise à jour avec succès',
      campaignId: id,
      smartleadId: campaign.smartLeadsId
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors de la configuration Smartlead.ai pour la campagne ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de la configuration Smartlead.ai',
      details: error.message 
    });
  }
});

// GET /api/campaigns/smartlead/csv-files - Lister les fichiers CSV disponibles pour l'import
router.get('/smartlead/csv-files', async (req, res) => {
  try {
    const smartleadService = new SmartleadImportService('dummy'); // Pas besoin de vraie clé pour lister les fichiers
    
    // Répertoire des données
    const dataDirectory = require('path').join(__dirname, '../data');
    const csvFiles = smartleadService.listAvailableCsvFiles(dataDirectory);
    
    // Ajouter des informations sur chaque fichier
    const fs = require('fs');
    const fileDetails = csvFiles.map(filename => {
      const filePath = require('path').join(dataDirectory, filename);
      const stats = fs.statSync(filePath);
      return {
        name: filename,
        size: stats.size,
        modified: stats.mtime,
        path: filePath
      };
    }).sort((a, b) => new Date(b.modified) - new Date(a.modified)); // Plus récents en premier
    
    res.json({
      success: true,
      files: fileDetails
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des fichiers CSV:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des fichiers CSV',
      details: error.message 
    });
  }
});

// POST /api/campaigns/smartlead/test-connection - Tester la connexion à l'API Smartlead.ai
router.post('/smartlead/test-connection', async (req, res) => {
  try {
    const apiKey = process.env.SMARTLEAD_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'Clé API Smartlead.ai non configurée' });
    }
    
    const smartleadService = new SmartleadImportService(apiKey);
    
    // Test simple de connexion
    const response = await fetch(`https://server.smartlead.ai/api/v1/campaigns?api_key=${apiKey}`);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    res.json({
      success: true,
      message: 'Connexion à Smartlead.ai réussie',
      campaignsCount: Array.isArray(data) ? data.length : 0,
      sampleCampaign: Array.isArray(data) && data.length > 0 ? data[0] : null
    });
    
  } catch (error) {
    console.error('❌ Test de connexion Smartlead.ai échoué:', error.message);
    res.status(500).json({
      success: false,
      error: 'Connexion à Smartlead.ai échouée',
      details: error.message
    });
  }
});

// POST /api/campaigns/:id/import-leads - Importer des leads depuis un fichier CSV
router.post('/:id/import-leads', async (req, res) => {
  try {
    const { id } = req.params;
    const { csvFile, batchSize = 100 } = req.body;
    
    console.log(`🚀 Import de leads pour la campagne ${id}...`);
    
    // Vérifier que la campagne existe
    const campaign = await smartLeadsService.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    console.log(1);
    // Vérifier que la campagne a un ID Smartlead
    if (!campaign.smartLeadsId) {
      return res.status(400).json({ error: 'Cette campagne n\'a pas d\'ID Smartlead.ai' });
    }
    console.log(2);
    
    // Vérifier que la campagne est en statut DRAFTED
    if (campaign.status !== 'DRAFTED') {
      return res.status(400).json({ error: 'L\'import n\'est possible que pour les campagnes en statut DRAFTED' });
    }
    console.log(3);
    
    // Initialiser le service Smartlead
    const apiKey = process.env.SMARTLEAD_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Clé API Smartlead.ai non configurée' });
    }
    console.log(4);
    console.log(apiKey);
    
    const smartleadService = new SmartleadImportService(apiKey);
    
    // Configuration de l'import
    const config = {
      csvFile: csvFile,
      batchSize: Math.min(parseInt(batchSize), 100), // Max 100 par lot selon l'API
      maxLeads: null // Pas de limite
    };
    
    // Timeout global de 15 minutes pour l'ensemble de l'import
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout: import trop long (15 minutes dépassées)')), 900000)
    );
    
    // Lancer l'import avec timeout
    const importPromise = smartleadService.importLeadsToCampaign(campaign.smartLeadsId, config);
    const result = await Promise.race([importPromise, timeoutPromise]);
    
    res.json({
      success: true,
      message: 'Import des leads terminé avec succès',
      campaignId: id,
      smartleadId: campaign.smartLeadsId,
      result: {
        total: result.total,
        success: result.success,
        failed: result.failed,
        errors: result.errors
      }
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors de l'import des leads pour la campagne ${req.params.id}:`, error);
    
    // Message d'erreur plus spécifique selon le type d'erreur
    let errorMessage = 'Erreur lors de l\'import des leads';
    if (error.message.includes('Timeout')) {
      errorMessage = 'Import interrompu car trop long. Vérifiez les logs pour plus de détails.';
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Limite de taux dépassée. L\'import sera repris automatiquement.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// GET /api/campaigns/:id/import-status - Vérifier le statut de l'import
router.get('/:id/import-status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier que la campagne existe
    const campaign = await smartLeadsService.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    
    // Récupérer les informations de la campagne depuis Smartlead.ai
    const apiKey = process.env.SMARTLEAD_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Clé API Smartlead.ai non configurée' });
    }
    
    try {
      // Récupérer les informations de la campagne Smartlead
      const response = await fetch(`https://server.smartlead.ai/api/v1/campaigns/${campaign.smartLeadsId}?api_key=${apiKey}`);
      const smartleadData = await response.json();
      
      // Récupérer le nombre de leads dans la campagne
      const leadsResponse = await fetch(`https://server.smartlead.ai/api/v1/campaigns/${campaign.smartLeadsId}/leads?api_key=${apiKey}`);
      const leadsData = await leadsResponse.json();
      
      res.json({
        success: true,
        campaignId: id,
        smartleadId: campaign.smartLeadsId,
        smartleadData: smartleadData,
        leadsCount: Array.isArray(leadsData) ? leadsData.length : 0,
        status: smartleadData.status || 'UNKNOWN'
      });
      
    } catch (smartleadError) {
      res.json({
        success: false,
        campaignId: id,
        smartleadId: campaign.smartLeadsId,
        error: 'Impossible de récupérer les informations Smartlead.ai',
        details: smartleadError.message
      });
    }
    
  } catch (error) {
    console.error(`❌ Erreur lors de la vérification du statut d'import pour la campagne ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de la vérification du statut',
      details: error.message 
    });
  }
});

// ===== ROUTES POUR LA GESTION DES COMPTES EMAIL DES CAMPAGNES =====

// GET /api/campaigns/:id/email-accounts - Récupérer les comptes email d'une campagne
router.get('/:id/email-accounts', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📧 Récupération des comptes email de la campagne ${id}...`);
    
    // Vérifier que la campagne existe
    const campaign = await smartLeadsService.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    
    // Récupérer les comptes email de la campagne
    const emailAccounts = await smartLeadsService.getCampaignEmailAccounts(campaign.smartLeadsId);
    
    res.json({
      success: true,
      campaignId: id,
      smartleadId: campaign.smartLeadsId,
      emailAccounts: emailAccounts,
      count: emailAccounts.length
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des comptes email de la campagne ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des comptes email',
      details: error.message 
    });
  }
});

// GET /api/campaigns/:id/email-accounts/available - Récupérer les comptes email disponibles pour une campagne
router.get('/:id/email-accounts/available', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Récupération des comptes email disponibles pour la campagne ${id}...`);
    
    // Vérifier que la campagne existe
    const campaign = await smartLeadsService.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    
    // Récupérer les comptes email disponibles
    const availableAccounts = await smartLeadsService.getAvailableEmailAccountsForCampaign(campaign.smartLeadsId);
    
    res.json({
      success: true,
      campaignId: id,
      smartleadId: campaign.smartLeadsId,
      ...availableAccounts
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des comptes email disponibles pour la campagne ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des comptes email disponibles',
      details: error.message 
    });
  }
});

// POST /api/campaigns/:id/email-accounts - Ajouter des comptes email à une campagne
router.post('/:id/email-accounts', async (req, res) => {
  try {
    const { id } = req.params;
    const { email_account_ids } = req.body;
    
    if (!email_account_ids || !Array.isArray(email_account_ids) || email_account_ids.length === 0) {
      return res.status(400).json({ 
        error: 'Liste des IDs des comptes email requise et doit être un tableau non vide' 
      });
    }
    
    console.log(`📧 Ajout de ${email_account_ids.length} comptes email à la campagne ${id}...`);
    
    // Vérifier que la campagne existe
    const campaign = await smartLeadsService.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    
    // Ajouter les comptes email à la campagne
    const result = await smartLeadsService.addEmailAccountsToCampaign(campaign.smartLeadsId, email_account_ids);
    
    res.json({
      success: true,
      message: 'Comptes email ajoutés avec succès à la campagne',
      campaignId: id,
      smartleadId: campaign.smartLeadsId,
      result: result
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors de l'ajout des comptes email à la campagne ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'ajout des comptes email',
      details: error.message 
    });
  }
});

// DELETE /api/campaigns/:id/email-accounts - Supprimer des comptes email d'une campagne
router.delete('/:id/email-accounts', async (req, res) => {
  try {
    const { id } = req.params;
    const { email_account_ids } = req.body;
    
    if (!email_account_ids || !Array.isArray(email_account_ids) || email_account_ids.length === 0) {
      return res.status(400).json({ 
        error: 'Liste des IDs des comptes email requise et doit être un tableau non vide' 
      });
    }
    
    console.log(`🗑️ Suppression de ${email_account_ids.length} comptes email de la campagne ${id}...`);
    
    // Vérifier que la campagne existe
    const campaign = await smartLeadsService.getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }
    
    // Supprimer les comptes email de la campagne
    const result = await smartLeadsService.removeEmailAccountsFromCampaign(campaign.smartLeadsId, email_account_ids);
    
    res.json({
      success: true,
      message: 'Comptes email supprimés avec succès de la campagne',
      campaignId: id,
      smartleadId: campaign.smartLeadsId,
      result: result
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors de la suppression des comptes email de la campagne ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de la suppression des comptes email',
      details: error.message 
    });
  }
});

// GET /api/email-accounts - Récupérer tous les comptes email disponibles
router.get('/email-accounts/all', async (req, res) => {
  try {
    const { maxAccounts = 1000 } = req.query;
    
    console.log(`📧 Récupération de TOUS les comptes email (limite max: ${maxAccounts})...`);
    
    // Utiliser la méthode avec pagination automatique
    const emailAccounts = await smartLeadsService.getAllEmailAccountsPaginated(parseInt(maxAccounts));
    
    res.json({
      success: true,
      emailAccounts: emailAccounts,
      count: emailAccounts.length,
      totalRetrieved: emailAccounts.length,
      message: `Tous les comptes email ont été récupérés (${emailAccounts.length} au total)`
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des comptes email:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des comptes email',
      details: error.message 
    });
  }
});

module.exports = router;
