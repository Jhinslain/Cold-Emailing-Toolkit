const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');

class SmartleadImportService {
    constructor(apiKey, baseUrl = 'https://server.smartlead.ai/api/v1') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.rateLimitDelay = 200; // 10 requests per 2 seconds = 200ms delay
    }

    // Attendre pour respecter les limites de taux
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Configuration des paramètres d'import de la campagne
    async configureCampaignImport(campaignId, importSettings = {}) {
        const defaultSettings = {
            track_settings: ["DONT_TRACK_EMAIL_OPEN"],
            stop_lead_settings: "REPLY_TO_AN_EMAIL",
            unsubscribe_text: "Ne plus me contacter",
            send_as_plain_text: false,
            follow_up_percentage: 100,
            client_id: null,
            enable_ai_esp_matching: true
        };

        const settings = { ...defaultSettings, ...importSettings };

        try {
            const response = await axios.post(
                `${this.baseUrl}/campaigns/${campaignId}/settings?api_key=${this.apiKey}`,
                settings
            );
            
            console.log(`✅ Configuration d'import configurée pour la campagne ${campaignId}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Erreur lors de la configuration d'import:`, error.response?.data || error.message);
            throw error;
        }
    }

    // Configuration de l'intégration Hubspot
    async configureHubspotIntegration(campaignId, hubspotConfig) {
        try {
            const webhookData = {
                name: hubspotConfig.name || "Webhook Hubspot",
                webhook_url: hubspotConfig.webhookUrl,
                event_types: hubspotConfig.eventTypes || [
                    "LEAD_CATEGORY_UPDATED",
                    "EMAIL_SENT",
                    "EMAIL_OPEN",
                    "EMAIL_REPLY"
                ],
                categories: hubspotConfig.categories || ["Interested", "Not Interested", "Qualified"]
            };

            const response = await axios.post(
                `${this.baseUrl}/campaigns/${campaignId}/webhooks?api_key=${this.apiKey}`,
                webhookData
            );

            console.log(`✅ Intégration Hubspot configurée pour la campagne ${campaignId}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Erreur lors de la configuration Hubspot:`, error.response?.data || error.message);
            throw error;
        }
    }

    // Mapping des champs CSV vers Smartlead
    mapCsvToSmartlead(row) {
        return {
            first_name: this.extractFirstName(row.email) || "Contact",
            last_name: this.extractLastName(row.email) || "Lead",
            email: row.email,
            phone_number: this.cleanPhoneNumber(row.numero),
            company_name: row.whois_organization || row['Nom de domaine'],
            website: row['Nom de domaine'],
            location: row.whois_locality || row.whois_region || "France",
            custom_fields: {
                "Nom de domaine": row['Nom de domaine'],
                "Date de création": row['Date de création'],
                "Organisation": row.whois_organization || "N/A",
                "Adresse": row.whois_street1 || "N/A",
                "Ville": row.whois_locality || "N/A",
                "Région": row.whois_region || "N/A",
                "Code postal": row.whois_postal_code || "N/A",
                "Pays": row.whois_country || "FR"
            },
            linkedin_profile: "",
            company_url: row['Nom de domaine']
        };
    }

    // Extraction du prénom depuis l'email
    extractFirstName(email) {
        if (!email) return null;
        const namePart = email.split('@')[0];
        return namePart.split('.')[0] || namePart.split('_')[0] || namePart;
    }

    // Extraction du nom depuis l'email
    extractLastName(email) {
        if (!email) return null;
        const namePart = email.split('@')[0];
        const parts = namePart.split('.');
        return parts.length > 1 ? parts[1] : parts[0].split('_')[1] || parts[0];
    }

    // Nettoyage du numéro de téléphone
    cleanPhoneNumber(phone) {
        if (!phone) return null;
        // Supprimer les préfixes comme "tel:" et nettoyer le format
        return phone.replace(/^tel:/, '').replace(/[^\d+]/g, '');
    }

    // Import des leads depuis un fichier CSV
    async importLeadsFromCsv(campaignId, csvFilePath, batchSize = 50, maxLeads = null) {
        const leads = [];
        
        return new Promise((resolve, reject) => {
            fs.createReadStream(csvFilePath)
                .pipe(csv())
                .on('data', (row) => {
                    // Limiter le nombre de leads si maxLeads est défini
                    if (maxLeads && leads.length >= maxLeads) {
                        return; // Ignorer les lignes supplémentaires
                    }
                    
                    const lead = this.mapCsvToSmartlead(row);
                    leads.push(lead);
                })
                .on('end', async () => {
                    try {
                        const actualLeads = maxLeads ? Math.min(leads.length, maxLeads) : leads.length;
                        console.log(`📊 ${actualLeads} leads chargés depuis ${csvFilePath}${maxLeads ? ` (limité à ${maxLeads})` : ''}`);
                        
                        // Import par lots pour respecter les limites de taux
                        const results = await this.importLeadsInBatches(campaignId, leads.slice(0, maxLeads || leads.length), batchSize);
                        resolve(results);
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', reject);
        });
    }

    // Import des leads par lots
    async importLeadsInBatches(campaignId, leads, batchSize) {
        const results = {
            total: leads.length,
            success: 0,
            failed: 0,
            errors: []
        };

        console.log(`🚀 ===== DÉBUT DE L'IMPORT SMARTLEAD.AI =====`);
        console.log(`📊 Nombre total de leads: ${leads.length}`);
        console.log(`📦 Taille des lots: ${batchSize} leads`);
        console.log(`⏱️ Délai entre requêtes: ${this.rateLimitDelay}ms`);
        console.log(`🕐 Heure de début: ${new Date().toLocaleString()}`);
        console.log(`🎯 Campagne Smartlead.ai ID: ${campaignId}`);
        console.log(`📋 Structure des leads: ${Object.keys(leads[0] || {}).join(', ')}`);
        console.log(`\n📦 ===== DÉBUT DU TRAITEMENT =====`);
        
        const startTime = Date.now();

        for (let i = 0; i < leads.length; i += batchSize) {
            const batch = leads.slice(i, i + batchSize);
            const batchNumber = Math.floor(i/batchSize) + 1;
            const totalBatches = Math.ceil(leads.length/batchSize);
            
            console.log(`\n📦 ===== LOT ${batchNumber}/${totalBatches} =====`);
            console.log(`📤 Début de l'import du lot ${batchNumber}/${totalBatches} (${batch.length} leads)`);
            console.log(`📊 Progression globale: ${Math.round((i/leads.length)*100)}% | Leads restants: ${leads.length - i}`);
            console.log(`⏱️ Début du lot: ${new Date().toLocaleTimeString()}`);
            
            const batchStartTime = Date.now();
            let batchSuccess = 0;
            let batchFailed = 0;
            
            try {
                // Utiliser l'endpoint correct avec lead_list
                const response = await this.addLeadsBatchToCampaign(campaignId, batch);
                
                if (response && response.ok) {
                    batchSuccess = batch.length;
                    results.success += batch.length;
                    console.log(`✅ [${batchNumber}/${totalBatches}] Lot importé avec succès (${batch.length} leads)`);
                } else {
                    throw new Error('Réponse invalide de l\'API');
                }
                
                // Attendre pour respecter les limites de taux
                await this.delay(this.rateLimitDelay);
                
            } catch (error) {
                batchFailed = batch.length;
                results.failed += batch.length;
                
                // Extraire le message d'erreur de manière plus robuste
                let errorMsg = 'Erreur inconnue';
                let errorDetails = {};
                
                if (error.response) {
                    // Erreur de réponse HTTP
                    errorDetails = {
                        status: error.response.status,
                        statusText: error.response.statusText,
                        data: error.response.data
                    };
                    
                    if (typeof error.response.data === 'string') {
                        errorMsg = error.response.data;
                    } else if (error.response.data && typeof error.response.data === 'object') {
                        errorMsg = error.response.data.message || error.response.data.error || JSON.stringify(error.response.data);
                    } else {
                        errorMsg = `HTTP ${error.response.status}: ${error.response.statusText}`;
                    }
                } else if (error.request) {
                    // Erreur de requête (pas de réponse)
                    errorMsg = 'Pas de réponse du serveur Smartlead.ai';
                    errorDetails = { request: 'Request sent but no response received' };
                } else {
                    // Autre type d'erreur
                    errorMsg = error.message || 'Erreur inconnue';
                    errorDetails = { error: error.toString() };
                }
                
                results.errors.push({
                    batch: batchNumber,
                    leads: batch.map(l => l.email),
                    error: errorMsg,
                    details: errorDetails
                });
                
                console.error(`❌ [${batchNumber}/${totalBatches}] Erreur pour le lot ${batchNumber}:`);
                console.error(`   🚫 Type d'erreur: ${errorDetails.status || 'Unknown'}`);
                console.error(`   📝 Message: ${errorMsg}`);
                if (Object.keys(errorDetails).length > 0) {
                    console.error(`   🔍 Détails:`, errorDetails);
                }
                
                // Gestion des erreurs critiques
                const isCriticalError = typeof errorMsg === 'string' && (
                    errorMsg.toLowerCase().includes('rate limit') || 
                    errorMsg.toLowerCase().includes('quota exceeded') ||
                    errorMsg.toLowerCase().includes('credit limit') ||
                    errorMsg.toLowerCase().includes('limit reached') ||
                    errorMsg.toLowerCase().includes('insufficient credits') ||
                    errorMsg.toLowerCase().includes('campaign not found') ||
                    errorMsg.toLowerCase().includes('invalid campaign')
                );
                
                if (isCriticalError) {
                    console.error(`🛑 Arrêt de l'import suite à une erreur critique:`, errorMsg);
                    console.error(`   💡 Suggestion: Vérifiez vos crédits Smartlead.ai ou l'ID de campagne`);
                    break;
                }
                
                // Pour les erreurs non critiques, on continue mais on log
                if (errorDetails.status === 400) {
                    console.warn(`⚠️ Erreur 400 (Bad Request) - Vérifiez le format des données`);
                } else if (errorDetails.status === 401) {
                    console.error(`🔐 Erreur 401 (Unauthorized) - Vérifiez votre clé API`);
                    break;
                } else if (errorDetails.status === 403) {
                    console.error(`🚫 Erreur 403 (Forbidden) - Permissions insuffisantes`);
                    break;
                } else if (errorDetails.status >= 500) {
                    console.warn(`⚠️ Erreur serveur (${errorDetails.status}) - Problème temporaire, on continue`);
                }
            }
            
            // Log de fin de lot avec résumé
            const batchTime = Math.round((Date.now() - batchStartTime) / 1000);
            const batchSuccessRate = Math.round((batchSuccess / batch.length) * 100);
            console.log(`\n📦 ===== FIN DU LOT ${batchNumber}/${totalBatches} =====`);
            console.log(`⏱️ Durée du lot: ${batchTime}s | ⏰ Fin: ${new Date().toLocaleTimeString()}`);
            console.log(`📊 Résumé du lot: ${batchSuccess}/${batch.length} succès (${batchSuccessRate}%) | ${batchFailed} échecs`);
            
            // Log de progression globale
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const estimatedTotal = Math.round((elapsed / (i + batch.length)) * leads.length);
            console.log(`📈 Progression globale: ${i + batch.length}/${leads.length} (${Math.round(((i + batch.length)/leads.length)*100)}%)`);
            console.log(`⏱️ Temps écoulé: ${elapsed}s | 🎯 Temps estimé total: ${estimatedTotal}s`);
        }

        const totalTime = Math.round((Date.now() - startTime) / 1000);
        const successRate = Math.round((results.success / results.total) * 100);
        const avgTimePerLead = Math.round(totalTime / results.total);
        
        console.log(`\n🎯 ===== IMPORT TERMINÉ =====`);
        console.log(`⏱️ Durée totale: ${totalTime}s (${Math.round(totalTime/60)}min ${totalTime%60}s)`);
        console.log(`📊 Résultats finaux: ${results.success}/${results.total} leads importés (${successRate}%)`);
        console.log(`❌ Échecs: ${results.failed} | ⏱️ Temps moyen par lead: ${avgTimePerLead}s`);
        console.log(`📈 Taux de succès: ${successRate}%`);
        
        if (results.errors.length > 0) {
            console.log(`\n🚨 Détail des erreurs:`);
            results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. Lot ${error.batch}: ${error.error}`);
                console.log(`      Leads: ${error.leads.join(', ')}`);
            });
        }
        
        console.log(`\n✨ Import Smartlead.ai terminé à ${new Date().toLocaleString()}`);
        
        return results;
    }

    // Ajouter un lot de leads à une campagne (nouvelle méthode)
    async addLeadsBatchToCampaign(campaignId, leads) {
        try {
            const payload = {
                lead_list: leads
            };
            
            const response = await axios.post(
                `${this.baseUrl}/campaigns/${campaignId}/leads?api_key=${this.apiKey}`,
                payload
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    // Ajouter un lead à une campagne (méthode existante - garder pour compatibilité)
    async addLeadToCampaign(campaignId, lead) {
        try {
            const payload = {
                lead_list: [lead]
            };
            
            const response = await axios.post(
                `${this.baseUrl}/campaigns/${campaignId}/leads?api_key=${this.apiKey}`,
                payload
            );
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    // Vérifier les crédits disponibles
    async checkCredits() {
        try {
            const response = await axios.get(`${this.baseUrl}/account/credits?api_key=${this.apiKey}`);
            return response.data;
        } catch (error) {
            console.error('❌ Erreur lors de la vérification des crédits:', error.response?.data || error.message);
            return null;
        }
    }

    // Vérifier le statut d'une campagne
    async checkCampaignStatus(campaignId) {
        try {
            const response = await axios.get(`${this.baseUrl}/campaigns/${campaignId}?api_key=${this.apiKey}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Erreur lors de la vérification de la campagne ${campaignId}:`, error.response?.data || error.message);
            return null;
        }
    }

    // Récupérer tous les comptes email associés au compte utilisateur
    async getAllEmailAccounts(offset = 0, limit = 100) {
        try {
            console.log(`📧 Récupération des comptes email (offset: ${offset}, limit: ${limit})...`);
            
            const response = await axios.get(
                `${this.baseUrl}/email-accounts/?api_key=${this.apiKey}&offset=${offset}&limit=${limit}`
            );
            
            const emailAccounts = response.data;
            console.log(`✅ ${emailAccounts.length} comptes email récupérés avec succès`);
            
            // Log des informations de base pour chaque compte
            emailAccounts.forEach((account, index) => {
                console.log(`   ${index + 1}. ${account.from_name || 'Sans nom'} (${account.from_email}) - Type: ${account.type || 'N/A'}`);
                if (account.warmup_details) {
                    console.log(`      Warmup: ${account.warmup_details.warmup_reputation || 'N/A'} | Statut: ${account.warmup_details.status || 'N/A'}`);
                }
                console.log(`      SMTP: ${account.is_smtp_success ? '✅' : '❌'} | IMAP: ${account.is_imap_success ? '✅' : '❌'}`);
            });
            
            return emailAccounts;
        } catch (error) {
            console.error(`❌ Erreur lors de la récupération des comptes email:`, error.response?.data || error.message);
            
            // Gestion des erreurs spécifiques
            if (error.response) {
                if (error.response.status === 401) {
                    throw new Error('Clé API invalide ou expirée');
                } else if (error.response.status === 403) {
                    throw new Error('Permissions insuffisantes pour accéder aux comptes email');
                } else if (error.response.status === 429) {
                    throw new Error('Limite de taux dépassée, veuillez réessayer plus tard');
                } else if (error.response.status >= 500) {
                    throw new Error('Erreur serveur SmartLeads, veuillez réessayer plus tard');
                }
            }
            
            throw new Error(`Erreur lors de la récupération des comptes email: ${error.message}`);
        }
    }

    // Récupérer tous les comptes email avec pagination automatique
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
                await this.delay(100);
            }
            
            console.log(`✅ Récupération terminée: ${allAccounts.length} comptes email au total`);
            return allAccounts;
            
        } catch (error) {
            console.error(`❌ Erreur lors de la récupération paginée des comptes email:`, error);
            throw error;
        }
    }

    // Import simple des leads vers une campagne existante
    async importLeadsToCampaign(campaignId, config) {
        console.log(`🚀 Import des leads vers la campagne ${campaignId}...`);
        
        try {
            // Vérifications préalables
            console.log(`🔍 Vérifications préalables...`);
            
            // 1. Vérifier le statut de la campagne
            const campaignStatus = await this.checkCampaignStatus(campaignId);
            if (!campaignStatus) {
                throw new Error(`Impossible de récupérer le statut de la campagne ${campaignId}`);
            }
            
            if (campaignStatus.status && campaignStatus.status !== 'DRAFTED') {
                console.warn(`⚠️ Attention: La campagne est en statut "${campaignStatus.status}" (recommandé: DRAFTED)`);
            }
            
            // 2. Vérifier les crédits disponibles
            const credits = await this.checkCredits();
            if (credits) {
                console.log(`💰 Crédits disponibles:`, credits);
                if (credits.remaining_leads && credits.remaining_leads < config.maxLeads) {
                    console.warn(`⚠️ Attention: Seulement ${credits.remaining_leads} crédits restants pour ${config.maxLeads} leads demandés`);
                }
            } else {
                console.warn(`⚠️ Impossible de vérifier les crédits disponibles`);
            }
            
            // Import des leads depuis le CSV
            if (config.csvFile) {
                // Construire le chemin complet vers le fichier CSV
                const path = require('path');
                const dataDirectory = path.join(__dirname, '../data');
                const csvFilePath = path.join(dataDirectory, config.csvFile);
                
                console.log(`📁 Répertoire des données: ${dataDirectory}`);
                console.log(`📄 Fichier CSV: ${config.csvFile}`);
                console.log(`🔗 Chemin complet: ${csvFilePath}`);
                
                // Vérifier que le fichier existe
                if (!fs.existsSync(csvFilePath)) {
                    throw new Error(`Fichier CSV non trouvé: ${csvFilePath}`);
                }
                
                const importResults = await this.importLeadsFromCsv(
                    campaignId, 
                    csvFilePath, 
                    config.batchSize || 50,
                    config.maxLeads || null
                );
                console.log(`📈 Import terminé: ${importResults.success}/${importResults.total} leads importés avec succès`);
                return importResults;
            }

            throw new Error('Aucun fichier CSV spécifié pour l\'import');
        } catch (error) {
            console.error(`❌ Erreur lors de l'import des leads:`, error);
            throw error;
        }
    }

    // Lister les fichiers CSV disponibles
    listAvailableCsvFiles(dataDirectory) {
        try {
            const files = fs.readdirSync(dataDirectory);
            return files.filter(file => file.endsWith('.csv'));
        } catch (error) {
            console.error(`❌ Erreur lors de la lecture du répertoire ${dataDirectory}:`, error);
            return [];
        }
    }

    // Validation des données CSV
    validateCsvData(csvFilePath) {
        const requiredFields = ['email', 'Nom de domaine'];
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        return new Promise((resolve) => {
            const rows = [];
            fs.createReadStream(csvFilePath)
                .pipe(csv())
                .on('data', (row) => {
                    rows.push(row);
                    
                    // Vérifier les champs requis
                    requiredFields.forEach(field => {
                        if (!row[field] || row[field].trim() === '') {
                            validation.errors.push(`Champ requis manquant: ${field}`);
                            validation.isValid = false;
                        }
                    });

                    // Vérifier la validité des emails
                    if (row.email && !this.isValidEmail(row.email)) {
                        validation.warnings.push(`Email invalide: ${row.email}`);
                    }
                })
                .on('end', () => {
                    validation.totalRows = rows.length;
                    validation.validRows = rows.filter(row => 
                        requiredFields.every(field => row[field] && row[field].trim() !== '')
                    ).length;
                    resolve(validation);
                });
        });
    }

    // Validation d'email simple
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}

module.exports = SmartleadImportService;
