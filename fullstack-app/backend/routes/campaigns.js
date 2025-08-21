const express = require('express');
const router = express.Router();
const smartLeadsService = require('../services/smartLeadsService');

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

module.exports = router;
