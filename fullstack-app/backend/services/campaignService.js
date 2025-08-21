const fs = require('fs').promises;
const path = require('path');

class CampaignService {
  constructor() {
    this.registryPath = path.join(__dirname, '../data/campaign-registry.json');
  }

  async loadRegistry() {
    try {
      const data = await fs.readFile(this.registryPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Fichier n'existe pas, créer la structure par défaut
        const defaultRegistry = {
          campaigns: {},
          metadata: {
            lastUpdated: new Date().toISOString(),
            totalCampaigns: 0,
            activeCampaigns: 0,
            pausedCampaigns: 0,
            completedCampaigns: 0,
            totalLeads: 0,
            totalProcessed: 0,
            totalSuccessful: 0,
            totalFailed: 0
          }
        };
        await this.saveRegistry(defaultRegistry);
        return defaultRegistry;
      }
      throw error;
    }
  }

  async saveRegistry(registry) {
    registry.metadata.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.registryPath, JSON.stringify(registry, null, 2));
  }

  async getAllCampaigns() {
    const registry = await this.loadRegistry();
    return registry;
  }

  async getCampaignById(campaignId) {
    const registry = await this.loadRegistry();
    return registry.campaigns[campaignId] || null;
  }

  async createCampaign(campaignData) {
    const registry = await this.loadRegistry();
    
    const campaignId = `campaign_${Date.now()}`;
    const now = new Date().toISOString();
    
    const newCampaign = {
      id: campaignId,
      name: campaignData.name,
      description: campaignData.description || '',
      status: 'active',
      createdAt: now,
      startDate: campaignData.startDate || now,
      endDate: campaignData.endDate || null,
      lastUpdated: now,
      totalLeads: campaignData.totalLeads || 0,
      processedLeads: 0,
      successfulLeads: 0,
      failedLeads: 0,
      pendingLeads: campaignData.totalLeads || 0,
      settings: {
        maxLeadsPerDay: campaignData.maxLeadsPerDay || 100,
        retryAttempts: campaignData.retryAttempts || 3,
        delayBetweenRequests: campaignData.delayBetweenRequests || 2000,
        targetLocations: campaignData.targetLocations || [],
        targetIndustries: campaignData.targetIndustries || []
      },
      files: campaignData.files || [],
      stats: {
        dailyProgress: {},
        conversionRate: 0,
        averageResponseTime: 0
      }
    };

    registry.campaigns[campaignId] = newCampaign;
    await this.updateMetadata(registry);
    await this.saveRegistry(registry);
    
    return newCampaign;
  }

  async updateCampaign(campaignId, updateData) {
    const registry = await this.loadRegistry();
    
    if (!registry.campaigns[campaignId]) {
      throw new Error('Campagne non trouvée');
    }

    const campaign = registry.campaigns[campaignId];
    const updatedCampaign = {
      ...campaign,
      ...updateData,
      lastUpdated: new Date().toISOString()
    };

    registry.campaigns[campaignId] = updatedCampaign;
    await this.updateMetadata(registry);
    await this.saveRegistry(registry);
    
    return updatedCampaign;
  }

  async deleteCampaign(campaignId) {
    const registry = await this.loadRegistry();
    
    if (!registry.campaigns[campaignId]) {
      throw new Error('Campagne non trouvée');
    }

    delete registry.campaigns[campaignId];
    await this.updateMetadata(registry);
    await this.saveRegistry(registry);
    
    return { success: true, message: 'Campagne supprimée avec succès' };
  }

  async updateCampaignStatus(campaignId, newStatus) {
    const validStatuses = ['active', 'paused', 'completed'];
    
    if (!validStatuses.includes(newStatus)) {
      throw new Error('Statut invalide');
    }

    return await this.updateCampaign(campaignId, { status: newStatus });
  }

  async updateCampaignProgress(campaignId, progressData) {
    const registry = await this.loadRegistry();
    const campaign = registry.campaigns[campaignId];
    
    if (!campaign) {
      throw new Error('Campagne non trouvée');
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Mettre à jour les statistiques
    campaign.processedLeads = progressData.processedLeads || campaign.processedLeads;
    campaign.successfulLeads = progressData.successfulLeads || campaign.successfulLeads;
    campaign.failedLeads = progressData.failedLeads || campaign.failedLeads;
    campaign.pendingLeads = campaign.totalLeads - campaign.processedLeads;
    
    // Mettre à jour le progrès quotidien
    if (progressData.dailyProgress) {
      campaign.stats.dailyProgress[today] = progressData.dailyProgress;
    }
    
    // Calculer le taux de conversion
    if (campaign.processedLeads > 0) {
      campaign.stats.conversionRate = campaign.successfulLeads / campaign.processedLeads;
    }
    
    campaign.lastUpdated = new Date().toISOString();
    
    await this.updateMetadata(registry);
    await this.saveRegistry(registry);
    
    return campaign;
  }

  async updateMetadata(registry) {
    const campaigns = Object.values(registry.campaigns);
    
    registry.metadata = {
      lastUpdated: new Date().toISOString(),
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      pausedCampaigns: campaigns.filter(c => c.status === 'paused').length,
      completedCampaigns: campaigns.filter(c => c.status === 'completed').length,
      totalLeads: campaigns.reduce((sum, c) => sum + c.totalLeads, 0),
      totalProcessed: campaigns.reduce((sum, c) => sum + c.processedLeads, 0),
      totalSuccessful: campaigns.reduce((sum, c) => sum + c.successfulLeads, 0),
      totalFailed: campaigns.reduce((sum, c) => sum + c.failedLeads, 0)
    };
  }

  async getCampaignStats() {
    const registry = await this.loadRegistry();
    return registry.metadata;
  }

  async getCampaignsByStatus(status) {
    const registry = await this.loadRegistry();
    return Object.values(registry.campaigns).filter(campaign => campaign.status === status);
  }

  async searchCampaigns(query) {
    const registry = await this.loadRegistry();
    const campaigns = Object.values(registry.campaigns);
    
    if (!query) return campaigns;
    
    const searchTerm = query.toLowerCase();
    return campaigns.filter(campaign => 
      campaign.name.toLowerCase().includes(searchTerm) ||
      campaign.description.toLowerCase().includes(searchTerm)
    );
  }

  async duplicateCampaign(campaignId, newData = {}) {
    const registry = await this.loadRegistry();
    const originalCampaign = registry.campaigns[campaignId];
    
    if (!originalCampaign) {
      throw new Error('Campagne originale non trouvée');
    }

    const newCampaignId = `campaign_${Date.now()}`;
    const now = new Date().toISOString();
    
    // Créer une copie de la campagne avec de nouveaux paramètres
    const duplicatedCampaign = {
      ...originalCampaign,
      id: newCampaignId,
      smartLeadsId: `sl_${Date.now()}`, // Nouvel ID SmartLeads
      name: newData.name || `${originalCampaign.name} (Copie)`,
      description: newData.description || `${originalCampaign.description} - Copie créée le ${new Date().toLocaleDateString('fr-FR')}`,
      status: 'active', // Nouvelle campagne toujours active
      createdAt: now,
      startDate: newData.startDate || now,
      endDate: newData.endDate || null,
      lastUpdated: now,
      totalLeads: newData.totalLeads || originalCampaign.totalLeads,
      processedLeads: 0, // Réinitialiser les compteurs
      successfulLeads: 0,
      failedLeads: 0,
      pendingLeads: newData.totalLeads || originalCampaign.totalLeads,
      files: newData.files || originalCampaign.files, // Garder ou changer les fichiers
      settings: {
        ...originalCampaign.settings,
        ...newData.settings // Permettre de modifier les paramètres
      },
      stats: {
        dailyProgress: {}, // Réinitialiser les statistiques
        conversionRate: 0,
        averageResponseTime: 0
      }
    };

    registry.campaigns[newCampaignId] = duplicatedCampaign;
    await this.updateMetadata(registry);
    await this.saveRegistry(registry);
    
    return duplicatedCampaign;
  }

  async getCampaignBySmartLeadsId(smartLeadsId) {
    const registry = await this.loadRegistry();
    return Object.values(registry.campaigns).find(campaign => 
      campaign.smartLeadsId === smartLeadsId
    ) || null;
  }
}

module.exports = new CampaignService();
