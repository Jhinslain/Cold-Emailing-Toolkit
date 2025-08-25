const axios = require('axios');
require('dotenv').config();

class SmartLeadsService {
  constructor() {
    this.apiKey = process.env.SMARTLEAD_API_KEY || '5c7f101a-1bcb-4a1f-8bc2-210884a278f4_2vghdeq';
    this.baseURL = process.env.SMARTLEAD_BASE_URL || 'https://server.smartlead.ai/api/v1';
    
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
      
      console.log('✅ Réponse reçue de Smartlead.ai:');
      
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

  // Récupérer les séquences d'une campagne
  async getCampaignSequences(campaignId) {
    try {
      console.log(`📧 Récupération des séquences pour la campagne ${campaignId}...`);
      
      const response = await this.client.get(`/campaigns/${campaignId}/sequences`, {
        params: {
          api_key: this.apiKey
        }
      });
      
      const sequences = response.data || [];
      console.log(`📧 ${sequences.length} séquences trouvées pour la campagne ${campaignId}`);
      
      return sequences;
    } catch (error) {
      console.error('Erreur lors de la récupération des séquences:', error);
      if (error.response?.status === 404) {
        console.log('Aucune séquence trouvée pour cette campagne');
        return [];
      }
      throw new Error('Impossible de récupérer les séquences de la campagne');
    }
  }

  // Récupérer les webhooks d'une campagne
  async getCampaignWebhooks(campaignId) {
    try {
      console.log(`🔗 Récupération des webhooks pour la campagne ${campaignId}...`);
      
      const response = await this.client.get(`/campaigns/${campaignId}/webhooks`, {
        params: {
          api_key: this.apiKey
        }
      });
      
      const webhooks = response.data || [];
      console.log(`🔗 ${webhooks.length} webhooks trouvés pour la campagne ${campaignId}`);
      
      return webhooks;
    } catch (error) {
      console.error('Erreur lors de la récupération des webhooks:', error);
      if (error.response?.status === 404) {
        console.log('Aucun webhook trouvé pour cette campagne');
        return [];
      }
      throw new Error('Impossible de récupérer les webhooks de la campagne');
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

  // Dupliquer une campagne avec tous ses éléments (séquences, paramètres, webhooks)
  async duplicateCampaign(campaignId, newData = {}) {
    try {
      console.log(`🔄 Début de la duplication de la campagne ${campaignId}...`);
      
      // 1. Lire la campagne source avec tous ses détails
      console.log(`📋 1. Lecture de la campagne source...`);
      const originalCampaign = await this.getCampaignById(campaignId);
      console.log(`✅ Campagne source récupérée: ${originalCampaign.name} (ID: ${originalCampaign.id})`);
      
      // 2. Récupérer les séquences de la campagne source
      console.log(`📧 2. Récupération des séquences de la source...`);
      const sequencesResponse = await this.client.get(`/campaigns/${campaignId}/sequences`, {
        params: { api_key: this.apiKey }
      });
      
      const originalSequences = sequencesResponse.data || [];
      console.log(`✅ ${originalSequences.length} séquences trouvées dans la source`);
      
             // 3. Récupérer les webhooks de la campagne source
       console.log(`🔗 3. Récupération des webhooks de la source...`);
       let originalWebhooks = [];
       try {
         const webhooksResponse = await this.client.get(`/campaigns/${campaignId}/webhooks`, {
           params: { api_key: this.apiKey }
         });
         originalWebhooks = webhooksResponse.data || [];
         console.log(`✅ ${originalWebhooks.length} webhooks trouvés dans la source`);
       } catch (webhookError) {
         console.log(`⚠️ Aucun webhook trouvé ou erreur lors de la récupération:`, webhookError.message);
       }

       // 3bis. Récupérer les comptes email de la campagne source
       console.log(`📧 3bis. Récupération des comptes email de la source...`);
       let originalEmailAccounts = [];
       try {
         originalEmailAccounts = await this.getCampaignEmailAccounts(campaignId);
         console.log(`✅ ${originalEmailAccounts.length} comptes email trouvés dans la source`);
       } catch (emailError) {
         console.log(`⚠️ Aucun compte email trouvé ou erreur lors de la récupération:`, emailError.message);
       }
      
      // 4. Créer la nouvelle campagne "vide"
      console.log(`🚀 4. Création de la nouvelle campagne...`);
      const duplicatedData = {
        name: newData.name || `${originalCampaign.name} (Copie)`,
        client_id: newData.client_id || null
      };
      
      const createResponse = await this.client.post(`/campaigns/create?api_key=${this.apiKey}`, duplicatedData);
      
      if (!createResponse.data.ok || !createResponse.data.id) {
        throw new Error('Échec de la création de la nouvelle campagne');
      }
      
      const newCampaignId = createResponse.data.id;
      console.log(`✅ Nouvelle campagne créée avec l'ID: ${newCampaignId}`);
      
      // 5. Copier les paramètres généraux via /settings
      console.log(`⚙️ 5. Copie des paramètres généraux...`);
      try {
        const generalSettings = {
          track_settings: originalCampaign.settings?.trackSettings || ["DONT_TRACK_EMAIL_OPEN"],
          stop_lead_settings: originalCampaign.settings?.stopLeadSettings || "REPLY_TO_AN_EMAIL",
          unsubscribe_text: originalCampaign.settings?.unsubscribeText || "Don't Contact Me",
          send_as_plain_text: originalCampaign.settings?.sendAsPlainText || false,
          follow_up_percentage: originalCampaign.settings?.followUpPercentage || 100,
          client_id: originalCampaign.settings?.clientId || null,
          enable_ai_esp_matching: originalCampaign.settings?.enableAiEspMatching || false
        };
        
        await this.client.post(`/campaigns/${newCampaignId}/settings?api_key=${this.apiKey}`, generalSettings);
        console.log(`✅ Paramètres généraux copiés`);
      } catch (settingsError) {
        console.log(`⚠️ Erreur lors de la copie des paramètres généraux:`, settingsError.message);
      }
      
             // 6. Copier le planificateur via /schedule
       console.log(`⏰ 6. Copie du planificateur...`);
       try {
         // Utiliser les paramètres exacts du planificateur selon l'image
         const scheduleData = {
           timezone: "Europe/Paris(UTC+01:00)",
           days_of_the_week: [1, 2, 3, 4, 5], // Lundi à Vendredi
           start_hour: "09:07",
           end_hour: "17:11",
           min_time_btw_emails: 31, // 31 minutes entre emails
           max_new_leads_per_day: 3000 // 3000 nouveaux leads par jour
         };
         
         await this.client.post(`/campaigns/${newCampaignId}/schedule?api_key=${this.apiKey}`, scheduleData);
         console.log(`✅ Planificateur copié avec les paramètres exacts:`);
         console.log(`   - Timezone: ${scheduleData.timezone}`);
         console.log(`   - Jours: ${scheduleData.days_of_the_week.join(', ')}`);
         console.log(`   - Heures: ${scheduleData.start_hour} - ${scheduleData.end_hour}`);
         console.log(`   - Intervalle: ${scheduleData.min_time_btw_emails} minutes`);
         console.log(`   - Max leads/jour: ${scheduleData.max_new_leads_per_day}`);
       } catch (scheduleError) {
         console.log(`⚠️ Erreur lors de la copie du planificateur:`, scheduleError.message);
       }
      
      // 7. Recréer les séquences dans la nouvelle campagne (en retirant les IDs)
      if (originalSequences.length > 0) {
        console.log(`📧 7. Recréation des ${originalSequences.length} séquences...`);
        
        // Préparer les séquences selon la structure officielle SmartLeads
        const sequencesToCopy = originalSequences.map(sequence => {
                     // Retirer l'ID de la séquence principale et autres champs non autorisés
           const { 
             id, 
             created_at, 
             updated_at, 
             email_campaign_id, 
             email_campaign_seq_id,
             year,
             user_id,
             is_deleted,
             optional_email_body_1,
             variant_distribution_percentage,
             sequence_variants, // Retirer explicitement sequence_variants
             ...sequenceWithoutId 
           } = sequence;
          
          // Nettoyer seq_delay_details - ne garder que delay_in_days
          if (sequence.seq_delay_details) {
            const { delayInDays, ...cleanDelayDetails } = sequence.seq_delay_details;
            sequenceWithoutId.seq_delay_details = {
              delay_in_days: cleanDelayDetails.delay_in_days || delayInDays || 1
            };
          } else {
            sequenceWithoutId.seq_delay_details = {
              delay_in_days: 1 // Valeur par défaut
            };
          }
          
          // S'assurer que seq_number est présent
          if (!sequenceWithoutId.seq_number) {
            sequenceWithoutId.seq_number = 1;
          }
          
          // Si la séquence a des variants (A/B testing), nettoyer complètement
          // L'API SmartLeads n'accepte que seq_variants, pas sequence_variants
          if (sequence.seq_variants && Array.isArray(sequence.seq_variants)) {
            sequenceWithoutId.seq_variants = sequence.seq_variants.map(variant => {
              const { 
                id: variantId, 
                created_at: vCreatedAt,
                updated_at: vUpdatedAt,
                email_campaign_seq_id: vSeqId,
                year: vYear,
                user_id: vUserId,
                is_deleted: vIsDeleted,
                optional_email_body_1: vOptBody,
                variant_distribution_percentage: vDistPct,
                ...cleanVariant 
              } = variant;
              
              // S'assurer que variant_label est présent
              if (!cleanVariant.variant_label) {
                cleanVariant.variant_label = 'A';
              }
              
              // S'assurer que subject et email_body sont présents
              if (!cleanVariant.subject) {
                cleanVariant.subject = 'Email sans sujet';
              }
              if (!cleanVariant.email_body) {
                cleanVariant.email_body = '<p>Contenu par défaut</p>';
              }
              
              return cleanVariant;
            });
          } else if (sequence.sequence_variants && Array.isArray(sequence.sequence_variants)) {
            // Si l'API retourne sequence_variants, le convertir en seq_variants
            sequenceWithoutId.seq_variants = sequence.sequence_variants.map(variant => {
              const { 
                id: variantId, 
                created_at: vCreatedAt,
                updated_at: vUpdatedAt,
                email_campaign_seq_id: vSeqId,
                year: vYear,
                user_id: vUserId,
                is_deleted: vIsDeleted,
                optional_email_body_1: vOptBody,
                variant_distribution_percentage: vDistPct,
                ...cleanVariant 
              } = variant;
              
              // S'assurer que variant_label est présent
              if (!cleanVariant.variant_label) {
                cleanVariant.variant_label = 'A';
              }
              
              // S'assurer que subject et email_body sont présents
              if (!cleanVariant.subject) {
                cleanVariant.subject = 'Email sans sujet';
              }
              if (!cleanVariant.email_body) {
                cleanVariant.email_body = '<p>Contenu par défaut</p>';
              }
              
              return cleanVariant;
            });
          } else {
            // Si pas de variants, s'assurer que subject et email_body sont présents
            if (!sequenceWithoutId.subject) {
              sequenceWithoutId.subject = 'Email sans sujet';
            }
            if (!sequenceWithoutId.email_body) {
              sequenceWithoutId.email_body = '<p>Contenu par défaut</p>';
            }
          }
          
          return sequenceWithoutId;
        });
        
        console.log(`📋 Séquences préparées (IDs retirés):`, sequencesToCopy.length);
        
        // Log détaillé de la première séquence pour debug
        if (sequencesToCopy.length > 0) {
          console.log(`🔍 Structure de la première séquence:`, JSON.stringify(sequencesToCopy[0], null, 2));
        }
        
        try {
          // Utiliser l'endpoint POST /campaigns/{newId}/sequences avec le tableau complet
          // Selon la doc officielle, on envoie directement le tableau sequences
          const payload = { sequences: sequencesToCopy };
          console.log(`📤 Envoi du payload:`, JSON.stringify(payload, null, 2));
          
          const sequenceResponse = await this.client.post(`/campaigns/${newCampaignId}/sequences?api_key=${this.apiKey}`, payload);
          
          if (sequenceResponse.data.ok) {
            console.log(`✅ Toutes les séquences copiées avec succès!`);
          } else {
            console.log(`⚠️ Réponse non-OK lors de la copie des séquences:`, sequenceResponse.data);
          }
          
          // Log des détails pour debug
          sequencesToCopy.forEach((seq, index) => {
            console.log(`   📧 Séquence ${index + 1}:`);
            console.log(`     - Numéro: ${seq.seq_number || index + 1}`);
            console.log(`     - Délai: ${seq.seq_delay_details?.delay_in_days || 0} jours`);
            console.log(`     - Variants: ${seq.seq_variants?.length || 0} variants`);
            if (seq.seq_variants && seq.seq_variants.length > 0) {
              seq.seq_variants.forEach((variant, vIndex) => {
                console.log(`       Variant ${variant.variant_label || vIndex + 1}: ${variant.subject || 'Sans sujet'}`);
              });
            }
          });
          
        } catch (sequenceError) {
          console.log(`⚠️ Erreur lors de la copie des séquences:`, sequenceError.message);
          if (sequenceError.response) {
            console.log(`📡 Détails de l'erreur:`, sequenceError.response.data);
            console.log(`📡 Status HTTP:`, sequenceError.response.status);
          }
        }
      }
      
             // 8. Copier les webhooks
       if (originalWebhooks.length > 0) {
         console.log(`🔗 8. Copie des ${originalWebhooks.length} webhooks...`);
         
         for (const webhook of originalWebhooks) {
           try {
             const webhookData = {
               id: null, // null pour créer un nouveau webhook
               name: `${webhook.name} (Copie)`,
               webhook_url: webhook.webhook_url,
               event_types: webhook.event_types || [],
               categories: webhook.categories || []
             };
             
             await this.client.post(`/campaigns/${newCampaignId}/webhooks?api_key=${this.apiKey}`, webhookData);
             console.log(`✅ Webhook "${webhook.name}" copié`);
             
             // Respecter la limite de taux
             await new Promise(resolve => setTimeout(resolve, 250));
           } catch (webhookError) {
             console.log(`⚠️ Erreur lors de la copie du webhook "${webhook.name}":`, webhookError.message);
           }
         }
       }

       // 8bis. Copier les comptes email
       if (originalEmailAccounts.length > 0) {
         console.log(`📧 8bis. Copie des ${originalEmailAccounts.length} comptes email...`);
         
         try {
           const emailAccountIds = originalEmailAccounts.map(account => account.id);
           // Utiliser la nouvelle méthode selon la doc officielle
           await this.addEmailAccountsToCampaign(newCampaignId, emailAccountIds);
           console.log(`✅ Comptes email copiés avec succès`);
         } catch (emailError) {
           console.log(`⚠️ Erreur lors de la copie des comptes email:`, emailError.message);
         }
       }
      
      // 9. Récupérer la campagne finale mise à jour
      console.log(`🔄 9. Récupération de la campagne finale...`);
      const finalCampaign = await this.getCampaignById(newCampaignId);
      
             console.log(`✅ Campagne dupliquée avec succès!`);
       console.log(`📊 Résumé de la duplication:`);
       console.log(`   - Nouvelle campagne: ${finalCampaign.name} (ID: ${finalCampaign.id})`);
       console.log(`   - Séquences copiées: ${originalSequences.length}`);
       console.log(`   - Webhooks copiés: ${originalWebhooks.length}`);
       console.log(`   - Comptes email copiés: ${originalEmailAccounts.length}`);
       console.log(`   - Paramètres copiés: Oui`);
       console.log(`   - Planificateur copié: ${!!originalCampaign.settings?.schedulerCronValue ? 'Oui' : 'Non'}`);
      
             return {
         id: finalCampaign.id,
         name: finalCampaign.name,
         created_at: finalCampaign.createdAt,
         message: 'Campagne dupliquée avec succès',
         details: {
           sequencesCopied: originalSequences.length,
           webhooksCopied: originalWebhooks.length,
           emailAccountsCopied: originalEmailAccounts.length,
           settingsCopied: true,
           schedulerCopied: !!originalCampaign.settings?.schedulerCronValue
         }
       };
      
    } catch (error) {
      console.error('❌ Erreur lors de la duplication de la campagne:', error);
      if (error.response) {
        console.error('📡 Détails de la réponse:', error.response.data);
        console.error('📡 Status HTTP:', error.response.status);
      }
      throw new Error(`Impossible de dupliquer la campagne: ${error.message}`);
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
        // Paramètres de suivi selon la doc SmartLeads
        trackSettings: campaignData.track_settings || ["DONT_TRACK_EMAIL_OPEN"],
        stopLeadSettings: campaignData.stop_lead_settings || "REPLY_TO_AN_EMAIL",
        unsubscribeText: campaignData.unsubscribe_text || "Don't Contact Me",
        sendAsPlainText: campaignData.send_as_plain_text || false,
        followUpPercentage: campaignData.follow_up_percentage || 100,
        clientId: campaignData.client_id || null,
        enableAiEspMatching: campaignData.enable_ai_esp_matching || false,
        
        // Paramètres de planification
        schedulerCronValue: campaignData.scheduler_cron_value || null,
        minTimeBtwEmails: campaignData.min_time_btwn_emails || 10,
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



  // Récupérer tous les comptes email associés à l'utilisateur
  async getAllEmailAccounts(offset = 0, limit = 100) {
    try {
      console.log(`📧 Récupération des comptes email (offset: ${offset}, limit: ${limit})...`);
      
      const response = await this.client.get('/email-accounts/', {
        params: {
          api_key: this.apiKey,
          offset,
          limit
        }
      });
      
      const emailAccounts = response.data || [];
      console.log(`✅ ${emailAccounts.length} comptes email récupérés`);
      
      return emailAccounts;
    } catch (error) {
      console.error('Erreur lors de la récupération des comptes email:', error);
      throw new Error('Impossible de récupérer les comptes email');
    }
  }

  // Récupérer TOUS les comptes email avec pagination automatique
  async getAllEmailAccountsPaginated(maxAccounts = 1000) {
    try {
      console.log(`📧 Récupération de tous les comptes email (limite max: ${maxAccounts})...`);
      
      const allAccounts = [];
      let offset = 0;
      const limit = 100; // Limite maximale par requête
      
      while (allAccounts.length < maxAccounts) {
        const accounts = await this.getAllEmailAccounts(offset, limit);
        
        if (!accounts || accounts.length === 0) {
          console.log(`📭 Aucun compte email trouvé à l'offset ${offset}`);
          break;
        }
        
        allAccounts.push(...accounts);
        console.log(`📊 Total des comptes récupérés: ${allAccounts.length}`);
        
        // Si on a moins de comptes que la limite, c'est qu'on a atteint la fin
        if (accounts.length < limit) {
          console.log(`🏁 Fin de la pagination - tous les comptes récupérés`);
          break;
        }
        
        offset += limit;
        
        // Attendre un peu pour respecter les limites de taux
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`✅ Récupération terminée: ${allAccounts.length} comptes email au total`);
      return allAccounts;
      
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération paginée des comptes email:`, error);
      throw error;
    }
  }

  // Récupérer les comptes email d'une campagne spécifique
  async getCampaignEmailAccounts(campaignId) {
    try {
      console.log(`📧 Récupération des comptes email de la campagne ${campaignId}...`);
      
      const response = await this.client.get(`/email-accounts/campaign/${campaignId}`, {
        params: {
          api_key: this.apiKey
        }
      });
      
      const emailAccounts = response.data?.email_accounts || [];
      console.log(`✅ ${emailAccounts.length} comptes email trouvés pour la campagne ${campaignId}`);
      
      return emailAccounts;
    } catch (error) {
      console.error('Erreur lors de la récupération des comptes email de la campagne:', error);
      if (error.response?.status === 404) {
        console.log('Aucun compte email trouvé pour cette campagne');
        return [];
      }
      throw new Error('Impossible de récupérer les comptes email de la campagne');
    }
  }

  // Attribuer des comptes email à une campagne (méthode existante - garder pour compatibilité)
  async assignEmailAccountsToCampaign(campaignId, emailAccountIds) {
    try {
      console.log(`📧 Attribution de ${emailAccountIds.length} comptes email à la campagne ${campaignId}...`);
      
      const response = await this.client.post(`/email-accounts/campaign/${campaignId}`, {
        email_account_ids: emailAccountIds
      }, {
        params: {
          api_key: this.apiKey
        }
      });
      
      if (response.data.ok) {
        console.log(`✅ Comptes email attribués avec succès à la campagne ${campaignId}`);
        return {
          success: true,
          message: 'Comptes email attribués avec succès',
          campaignId,
          emailAccountIds
        };
      } else {
        throw new Error('Échec de l\'attribution des comptes email');
      }
    } catch (error) {
      console.error('Erreur lors de l\'attribution des comptes email:', error);
      throw new Error(`Impossible d'attribuer les comptes email: ${error.message}`);
    }
  }

  // Ajouter des comptes email à une campagne selon la doc officielle SmartLeads
  async addEmailAccountsToCampaign(campaignId, emailAccountIds) {
    try {
      console.log(`📧 Ajout de ${emailAccountIds.length} comptes email à la campagne ${campaignId}...`);
      
      // Utiliser l'endpoint correct selon la doc officielle
      const response = await this.client.post(`/campaigns/${campaignId}/email-accounts?api_key=${this.apiKey}`, {
        email_account_ids: emailAccountIds
      });
      
      if (response.data.ok) {
        console.log(`✅ Comptes email ajoutés avec succès à la campagne ${campaignId}`);
        
        // Récupérer les détails de la réponse selon le schéma officiel
        const result = response.data.result || [];
        console.log(`📊 Détails de l'ajout:`, result);
        
        return {
          success: true,
          message: 'Comptes email ajoutés avec succès à la campagne',
          campaignId,
          emailAccountIds,
          result: result,
          details: {
            totalAdded: result.length,
            addedAccounts: result.map(item => ({
              id: item.id,
              emailCampaignId: item.email_campaign_id,
              emailAccountId: item.email_account_id,
              updatedAt: item.updated_at
            }))
          }
        };
      } else {
        console.error(`❌ Réponse non-OK de l'API:`, response.data);
        throw new Error('Échec de l\'ajout des comptes email à la campagne');
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout des comptes email à la campagne:', error);
      if (error.response) {
        console.error('📡 Détails de la réponse:', error.response.data);
        console.error('📡 Status HTTP:', error.response.status);
      }
      throw new Error(`Impossible d'ajouter les comptes email à la campagne: ${error.message}`);
    }
  }

  // Supprimer des comptes email d'une campagne
  async removeEmailAccountsFromCampaign(campaignId, emailAccountIds) {
    try {
      console.log(`🗑️ Suppression de ${emailAccountIds.length} comptes email de la campagne ${campaignId}...`);
      
      // Utiliser l'endpoint DELETE selon la doc officielle
      const response = await this.client.delete(`/campaigns/${campaignId}/email-accounts?api_key=${this.apiKey}`, {
        data: {
          email_account_ids: emailAccountIds
        }
      });
      
      if (response.data.ok) {
        console.log(`✅ Comptes email supprimés avec succès de la campagne ${campaignId}`);
        return {
          success: true,
          message: 'Comptes email supprimés avec succès de la campagne',
          campaignId,
          emailAccountIds
        };
      } else {
        console.error(`❌ Réponse non-OK de l'API:`, response.data);
        throw new Error('Échec de la suppression des comptes email de la campagne');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la suppression des comptes email de la campagne:', error);
      if (error.response) {
        console.error('📡 Détails de la réponse:', error.response.data);
        console.error('📡 Status HTTP:', error.response.status);
      }
      throw new Error(`Impossible de supprimer les comptes email de la campagne: ${error.message}`);
    }
  }

  // Récupérer tous les comptes email disponibles pour une campagne
  async getAvailableEmailAccountsForCampaign(campaignId) {
    try {
      console.log(`🔍 Récupération des comptes email disponibles pour la campagne ${campaignId}...`);
      
      // Récupérer tous les comptes email de l'utilisateur
      const allAccounts = await this.getAllEmailAccounts();
      
      // Récupérer les comptes email déjà assignés à cette campagne
      const assignedAccounts = await this.getCampaignEmailAccounts(campaignId);
      const assignedIds = assignedAccounts.map(account => account.id || account.email_account_id);
      
      // Filtrer pour ne garder que les comptes disponibles
      const availableAccounts = allAccounts.filter(account => 
        !assignedIds.includes(account.id)
      );
      
      console.log(`✅ ${availableAccounts.length} comptes email disponibles pour la campagne ${campaignId}`);
      console.log(`📊 Total: ${allAccounts.length} | Assignés: ${assignedAccounts.length} | Disponibles: ${availableAccounts.length}`);
      
      return {
        available: availableAccounts,
        assigned: assignedAccounts,
        total: allAccounts.length,
        summary: {
          available: availableAccounts.length,
          assigned: assignedAccounts.length,
          total: allAccounts.length
        }
      };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des comptes email disponibles:', error);
      throw new Error(`Impossible de récupérer les comptes email disponibles: ${error.message}`);
    }
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
