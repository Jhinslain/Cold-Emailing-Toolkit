const express = require('express');
const router = express.Router();
const SmartLeadsService = require('../services/smartLeadsService');

// GET /api/email-accounts - Récupérer tous les comptes email
router.get('/', async (req, res) => {
  try {
    const { offset = 0, limit = 100 } = req.query;
    
    console.log(`📧 Récupération des comptes email (offset: ${offset}, limit: ${limit})`);
    
    const emailAccounts = await SmartLeadsService.getAllEmailAccounts(
      parseInt(offset), 
      parseInt(limit)
    );
    
    res.json(emailAccounts);
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des comptes email:', error);
    res.status(500).json({ 
      error: 'Impossible de récupérer les comptes email',
      message: error.message 
    });
  }
});

// GET /api/campaigns/:campaignId/email-accounts - Récupérer les comptes email d'une campagne
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    console.log(`📧 Récupération des comptes email de la campagne ${campaignId}`);
    
    const emailAccounts = await SmartLeadsService.getCampaignEmailAccounts(campaignId);
    
    res.json(emailAccounts);
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des comptes email de la campagne:', error);
    res.status(500).json({ 
      error: 'Impossible de récupérer les comptes email de la campagne',
      message: error.message 
    });
  }
});

// POST /api/campaigns/:campaignId/email-accounts - Attribuer des comptes email à une campagne
router.post('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { email_account_ids } = req.body;
    
    if (!email_account_ids || !Array.isArray(email_account_ids)) {
      return res.status(400).json({ 
        error: 'email_account_ids doit être un tableau' 
      });
    }
    
    console.log(`📧 Attribution de ${email_account_ids.length} comptes email à la campagne ${campaignId}`);
    
    const result = await SmartLeadsService.assignEmailAccountsToCampaign(campaignId, email_account_ids);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Erreur lors de l\'attribution des comptes email:', error);
    res.status(500).json({ 
      error: 'Impossible d\'attribuer les comptes email',
      message: error.message 
    });
  }
});

module.exports = router;
