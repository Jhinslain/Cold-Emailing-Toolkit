const axios = require('axios');
require('dotenv').config();

class SmartLeadsService {
  constructor() {
    this.apiKey = process.env.SMARTLEADS_API_KEY || '5c7f101a-1bcb-4a1f-8bc2-210884a278f4_2vghdeq';
    this.baseURL = process.env.SMARTLEADS_BASE_URL || 'https://server.smartlead.ai/api/v1';
    
    // Créer le client avec la bonne configuration selon la doc officielle
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'SmartLeads-API-Client/1.0'
      },
      timeout: 15000
    });
    
    console.log('🔧 SmartLeads Service initialisé avec:', {
      apiKey: this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'Non configurée',
      baseURL: this.baseURL
    });
  }



  // Récupérer toutes les campagnes selon la doc officielle
  async getAllCampaigns() {
    try {
      console.log('🔍 Tentative de récupération des campagnes depuis Smartlead.ai...');
      
      // Utiliser le bon format d'authentification avec api_key comme paramètre
      const response = await this.client.get('/campaigns', {
        params: {
          api_key: this.apiKey
        }
      });
      
      console.log('✅ Réponse reçue de Smartlead.ai:', {
        status: response.status,
        dataLength: response.data ? (Array.isArray(response.data) ? response.data.length : 'Non-array') : 'No data',
        dataType: typeof response.data,
        sampleData: response.data ? (Array.isArray(response.data) ? response.data.slice(0, 2) : response.data) : 'No data'
      });
      
      const transformedCampaigns = this.transformCampaigns(response.data);
      console.log('🔄 Campagnes transformées:', transformedCampaigns.length);
      
      return transformedCampaigns;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des campagnes Smartlead.ai:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data ? (typeof error.response.data === 'string' ? error.response.data.substring(0, 200) + '...' : error.response.data) : 'No data',
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
      
      throw new Error(`Impossible de récupérer les campagnes depuis Smartlead.ai: ${error.message}`);
    }
  }

  // Récupérer une campagne par ID
  async getCampaignById(campaignId) {
    try {
      const response = await this.client.get(`/campaigns/${campaignId}`, {
        params: {
          api_key: this.apiKey
        }
      });
      return this.transformCampaign(response.data);
    } catch (error) {
      console.error('Erreur lors de la récupération de la campagne:', error);
      throw new Error('Campagne non trouvée');
    }
  }

  // Récupérer les campagnes par statut
  async getCampaignsByStatus(status) {
    try {
      const response = await this.client.get('/campaigns', {
        params: { 
          status,
          api_key: this.apiKey
        }
      });
      return this.transformCampaigns(response.data);
    } catch (error) {
      console.error('Erreur lors de la récupération des campagnes par statut:', error);
      throw new Error('Impossible de récupérer les campagnes par statut');
    }
  }

  // Créer une nouvelle campagne
  async createCampaign(campaignData) {
    try {
      const response = await this.client.post(`/campaigns/create?api_key=${this.apiKey}`, campaignData);
      return this.transformCampaign(response.data);
    } catch (error) {
      console.error('Erreur lors de la création de la campagne:', error);
      throw new Error('Impossible de créer la campagne');
    }
  }

  // Mettre à jour une campagne
  async updateCampaign(campaignId, updateData) {
    try {
      const response = await this.client.post(`/campaigns/${campaignId}/settings?api_key=${this.apiKey}`, updateData);
      return this.transformCampaign(response.data);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la campagne:', error);
      throw new Error('Impossible de mettre à jour la campagne');
    }
  }

  // Mettre à jour le statut d'une campagne via l'endpoint status
  async updateCampaignStatus(campaignId, status) {
    try {
      console.log(`🔄 Tentative de mise à jour du statut de la campagne ${campaignId} vers: ${status}`);
      
      // Si on essaie de démarrer une campagne, utiliser startCampaign qui gère le planificateur
      if (status.toUpperCase() === 'START') {
        console.log(`🚀 Redirection vers startCampaign pour gérer le planificateur...`);
        return this.startCampaign(campaignId);
      }
      
      // D'après la doc officielle, utiliser l'endpoint /status
      const response = await this.client.post(`/campaigns/${campaignId}/status?api_key=${this.apiKey}`, { 
        status: status.toUpperCase() // SmartLeads attend PAUSED, STOPPED, START
      });
      
      console.log(`📡 Réponse de l'API SmartLead:`, response.data);
      
      if (response.data.ok) {
        console.log(`✅ Statut mis à jour avec succès, récupération de la campagne mise à jour...`);
        // Récupérer la campagne mise à jour
        const updatedCampaign = await this.getCampaignById(campaignId);
        console.log(`✅ Campagne mise à jour récupérée:`, updatedCampaign);
        return updatedCampaign;
      } else {
        console.error(`❌ Réponse non-OK de l'API:`, response.data);
        throw new Error('Échec de la mise à jour du statut');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du statut:', error);
      if (error.response) {
        console.error('📡 Détails de la réponse:', error.response.data);
        console.error('📡 Status HTTP:', error.response.status);
      }
      throw new Error('Impossible de mettre à jour le statut');
    }
  }

  // Mettre en pause une campagne
  async pauseCampaign(campaignId) {
    return this.updateCampaignStatus(campaignId, 'PAUSED');
  }

  // Arrêter une campagne
  async stopCampaign(campaignId) {
    return this.updateCampaignStatus(campaignId, 'STOPPED');
  }

  // Démarrer une campagne
  async startCampaign(campaignId) {
    try {
      console.log(`🚀 Tentative de démarrage de la campagne ${campaignId}...`);
      
      // D'abord, configurer le planificateur avec des valeurs par défaut
      const defaultSchedule = {
        timezone: "Europe/Paris",
        days_of_the_week: [1, 2, 3, 4, 5], // Lundi à Vendredi
        start_hour: "09:00",
        end_hour: "18:00",
        min_time_btw_emails: 10, // 10 minutes entre emails
        max_new_leads_per_day: 50 // 50 nouveaux leads par jour
      };
      
      console.log(`⏰ Configuration du planificateur par défaut:`, defaultSchedule);
      
      // Configurer le planificateur selon la doc officielle
      const scheduleResponse = await this.client.post(`/campaigns/${campaignId}/schedule?api_key=${this.apiKey}`, defaultSchedule);
      
      if (scheduleResponse.data.ok) {
        console.log(`✅ Planificateur configuré avec succès, démarrage de la campagne...`);
        
        // Maintenant on peut démarrer la campagne DIRECTEMENT sans passer par updateCampaignStatus
        const response = await this.client.post(`/campaigns/${campaignId}/status?api_key=${this.apiKey}`, { 
          status: 'START'
        });
        
        if (response.data.ok) {
          console.log(`✅ Campagne démarrée avec succès, récupération de la campagne mise à jour...`);
          const updatedCampaign = await this.getCampaignById(campaignId);
          console.log(`✅ Campagne mise à jour récupérée:`, updatedCampaign);
          return updatedCampaign;
        } else {
          throw new Error('Échec du démarrage de la campagne');
        }
      } else {
        console.error(`❌ Échec de la configuration du planificateur:`, scheduleResponse.data);
        throw new Error('Impossible de configurer le planificateur de la campagne');
      }
    } catch (error) {
      console.error('❌ Erreur lors du démarrage de la campagne:', error);
      if (error.response) {
        console.error('📡 Détails de la réponse:', error.response.data);
        console.error('📡 Status HTTP:', error.response.status);
      }
      throw new Error('Impossible de démarrer la campagne');
    }
  }

  // Supprimer une campagne (vraie suppression selon la doc)
  async deleteCampaign(campaignId) {
    try {
      // Selon la doc SmartLeads, utiliser DELETE avec api_key en paramètre
      const response = await this.client.delete(`/campaigns/${campaignId}?api_key=${this.apiKey}`);
      
      console.log(`✅ Campagne ${campaignId} supprimée avec succès`);
      return { 
        success: true, 
        message: 'Campagne supprimée avec succès',
        campaignId: campaignId
      };
    } catch (error) {
      console.error('Erreur lors de la suppression de la campagne:', error);
      throw new Error('Impossible de supprimer la campagne');
    }
  }

  // Dupliquer une campagne
  async duplicateCampaign(campaignId, newData = {}) {
    try {
      // Récupérer la campagne originale
      const originalCampaign = await this.getCampaignById(campaignId);
      
      // Préparer les données pour la nouvelle campagne
      const duplicatedData = {
        name: newData.name || `${originalCampaign.name} (Copie)`,
        client_id: newData.client_id || null // Selon la doc, client_id est optionnel
      };

      // Créer la nouvelle campagne avec l'endpoint correct
      const response = await this.client.post(`/campaigns/create?api_key=${this.apiKey}`, duplicatedData);
      
      // Si la création réussit, on peut copier les séquences et autres paramètres
      if (response.data.ok && response.data.id) {
        console.log(`✅ Campagne dupliquée avec succès. Nouvel ID: ${response.data.id}`);
        return {
          id: response.data.id,
          name: response.data.name,
          created_at: response.data.created_at,
          message: 'Campagne dupliquée avec succès'
        };
      }
      
      throw new Error('Réponse invalide de l\'API lors de la duplication');
    } catch (error) {
      console.error('Erreur lors de la duplication de la campagne:', error);
      throw new Error('Impossible de dupliquer la campagne');
    }
  }

  // Récupérer les statistiques globales
  async getCampaignStats() {
    try {
      const campaigns = await this.getAllCampaigns();
      
      const stats = {
        lastUpdated: new Date().toISOString(),
        totalCampaigns: campaigns.length,
        draftedCampaigns: campaigns.filter(c => c.status === 'DRAFTED').length,
        activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
        pausedCampaigns: campaigns.filter(c => c.status === 'PAUSED').length,
        stoppedCampaigns: campaigns.filter(c => c.status === 'STOPPED').length,
        completedCampaigns: campaigns.filter(c => c.status === 'COMPLETED').length,
        totalLeads: campaigns.reduce((sum, c) => sum + (c.totalLeads || 0), 0),
        totalProcessed: campaigns.reduce((sum, c) => sum + (c.processedLeads || 0), 0),
        totalSuccessful: campaigns.reduce((sum, c) => sum + (c.successfulLeads || 0), 0),
        totalFailed: campaigns.reduce((sum, c) => sum + (c.failedLeads || 0), 0)
      };

      return stats;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      throw new Error('Impossible de calculer les statistiques');
    }
  }

  // Transformer les données de l'API SmartLeads vers notre format
  transformCampaign(campaignData) {
    return {
      id: campaignData.id || campaignData.campaign_id,
      smartLeadsId: campaignData.smart_leads_id || campaignData.id,
      name: campaignData.name || campaignData.campaign_name,
      description: campaignData.description || '',
      status: this.mapStatus(campaignData.status || campaignData.campaign_status),
      createdAt: campaignData.created_at || campaignData.created_date,
      startDate: campaignData.start_date || campaignData.start_at,
      endDate: campaignData.end_date || campaignData.end_at,
      lastUpdated: campaignData.updated_at || campaignData.last_updated,
      totalLeads: campaignData.total_leads || campaignData.leads_count || 0,
      processedLeads: campaignData.processed_leads || campaignData.processed_count || 0,
      successfulLeads: campaignData.successful_leads || campaignData.success_count || 0,
      failedLeads: campaignData.failed_leads || campaignData.failed_count || 0,
      pendingLeads: campaignData.pending_leads || campaignData.pending_count || 0,
      settings: {
        maxLeadsPerDay: campaignData.settings?.max_leads_per_day || campaignData.max_leads_per_day || 100,
        retryAttempts: campaignData.settings?.retry_attempts || campaignData.retry_attempts || 3,
        delayBetweenRequests: campaignData.settings?.delay_between_requests || campaignData.delay_between_requests || 2000,
        targetLocations: campaignData.settings?.target_locations || campaignData.target_locations || [],
        targetIndustries: campaignData.settings?.target_industries || campaignData.target_industries || []
      },
      files: campaignData.files || campaignData.data_sources || [],
      stats: {
        dailyProgress: campaignData.stats?.daily_progress || campaignData.daily_progress || {},
        conversionRate: campaignData.stats?.conversion_rate || campaignData.conversion_rate || 0,
        averageResponseTime: campaignData.stats?.average_response_time || campaignData.avg_response_time || 0
      }
    };
  }

  // Transformer une liste de campagnes
  transformCampaigns(campaignsData) {
    if (Array.isArray(campaignsData)) {
      return campaignsData.map(campaign => this.transformCampaign(campaign));
    } else if (campaignsData.campaigns || campaignsData.data) {
      // Si l'API retourne un objet avec une propriété campaigns ou data
      const campaigns = campaignsData.campaigns || campaignsData.data || [];
      return campaigns.map(campaign => this.transformCampaign(campaign));
    }
    return [];
  }

  // Mapper les statuts de SmartLeads vers nos statuts
  mapStatus(smartLeadsStatus) {
    if (!smartLeadsStatus) return 'DRAFTED';
    
    // Convertir en majuscules pour la comparaison
    const status = smartLeadsStatus.toUpperCase();
    
    const statusMapping = {
      'ACTIVE': 'ACTIVE',
      'RUNNING': 'ACTIVE',
      'STARTED': 'ACTIVE',
      'START': 'START',  // Garder START séparé de ACTIVE
      'PAUSED': 'PAUSED',
      'STOPPED': 'STOPPED',
      'COMPLETED': 'COMPLETED',
      'FINISHED': 'COMPLETED',
      'ENDED': 'COMPLETED',
      'DRAFTED': 'DRAFTED',
      'DRAFT': 'DRAFTED',
      'CREATED': 'DRAFTED',
      'NEW': 'DRAFTED'
    };
    
    return statusMapping[status] || 'DRAFTED';
  }



  // Rechercher des campagnes
  async searchCampaigns(query) {
    try {
      const response = await this.client.get('/campaigns/search', {
        params: { q: query }
      });
      return this.transformCampaigns(response.data);
    } catch (error) {
      // Si l'API ne supporte pas la recherche, faire une recherche locale
      const allCampaigns = await this.getAllCampaigns();
      const searchTerm = query.toLowerCase();
      return allCampaigns.filter(campaign => 
        campaign.name.toLowerCase().includes(searchTerm) ||
        campaign.description.toLowerCase().includes(searchTerm)
      );
    }
  }
}

module.exports = new SmartLeadsService();
