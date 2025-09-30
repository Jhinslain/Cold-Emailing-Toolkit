const cron = require('node-cron');
const OpendataService = require('./opendataService');
const DailyService = require('./dailyService');
const WhoisService = require('./whoisService');
const MillionVerifierService = require('./millionVerifierService');
const DeduplicationService = require('./deduplicationService');
const FileService = require('./fileService');
const StatisticsService = require('./statisticsService');
const path = require('path');

class SchedulerService {
    constructor() {
        this.opendataService = new OpendataService();
        this.dailyService = new DailyService();
        this.whoisService = new WhoisService(path.join(__dirname, '../data'));
        this.millionVerifierService = MillionVerifierService;
        this.deduplicationService = new DeduplicationService();
        this.fileService = new FileService(path.join(__dirname, '../data'));
        this.statisticsService = new StatisticsService();
        
        // Vérifier l'initialisation du service MillionVerifier
        if (this.millionVerifierService.initializeService) {
            this.millionVerifierService.initializeService();
        }
        
        console.log('🚀 Service de planification démarré');
    }

    // Téléchargement automatique de l'Opendata (tous les 1er du mois à 2h du matin) - DÉSACTIVÉ
    /*
    scheduleOpendataDownload() {
        cron.schedule('0 2 1 * *', async () => {
            console.log('🔄 Démarrage du téléchargement automatique Opendata...');
            try {
                await this.opendataService.downloadAndExtractOpendata('auto');
                console.log('✅ Téléchargement Opendata terminé avec succès');
            } catch (error) {
                console.error('❌ Erreur lors du téléchargement Opendata:', error.message);
            }
        }, {
            timezone: "Europe/Paris"
        });
            
        console.log('📅 Job Opendata programmé: 1er du mois à 2h00');
    }
    */

    // Téléchargement automatique du fichier de la veille + WHOIS + Million Verifier (tous les jours 6h avec retry)
    scheduleDailyYesterdayDownloadAndWhois() {
        // Programmer les 4 tentatives : 6h, 6h30, 7h, 7h30
        const retryTimes = [
            { cron: '0 6 * * *', name: '6h00' },
            { cron: '30 6 * * *', name: '6h30' },
            { cron: '0 7 * * *', name: '7h00' },
            { cron: '30 7 * * *', name: '7h30' }
        ];

        retryTimes.forEach((retryTime, index) => {
            cron.schedule(retryTime.cron, async () => {
                await this.executeDailyYesterdayDownloadAndWhoisWithRetry(index + 1, retryTime.name);
            }, {
                timezone: "Europe/Paris"
            });
        });
        
        console.log('📅 Jobs téléchargement + WHOIS + Million Verifier programmés:');
        console.log('   - 6h00 (tentative principale)');
        console.log('   - 6h30 (retry 1)');
        console.log('   - 7h00 (retry 2)');
        console.log('   - 7h30 (retry 3)');
    }

    // Exécution avec retry horaire (vérifie si le processus est déjà en cours)
    async executeDailyYesterdayDownloadAndWhoisWithRetry(attemptNumber, timeName) {
        const currentTime = new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });
        console.log(`🕐 Tentative ${attemptNumber} à ${timeName} (${currentTime})`);
        
        // Vérifier si le fichier de la veille existe déjà (succès d'une tentative précédente)
        const yesterdayFile = await this.findYesterdayFile();
        if (yesterdayFile) {
            console.log(`✅ Fichier de la veille déjà disponible: ${yesterdayFile} - Arrêt des tentatives`);
            return;
        }
        
        try {
            // Téléchargement simple (le retry se fait via les tâches cron)
            const downloadSuccess = await this.downloadOnce();
            
            if (downloadSuccess) {
                console.log(`✅ Téléchargement réussi à la tentative ${attemptNumber} (${timeName})`);
                
                // Continuer avec le processus WHOIS + Million Verifier
                await this.continueWithWhoisAndMillionVerifier();
                return;
            } else {
                console.warn(`⚠️ Téléchargement échoué à la tentative ${attemptNumber} (${timeName})`);
                if (attemptNumber === 4) {
                    console.error(`❌ Échec complet après 4 tentatives. Prochaine tentative demain à 6h.`);
                } else {
                    console.log(`⏳ Prochaine tentative dans 30 minutes...`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Erreur à la tentative ${attemptNumber} (${timeName}):`, error.message);
            if (attemptNumber === 4) {
                console.error(`❌ Échec complet après 4 tentatives. Prochaine tentative demain à 6h.`);
            }
        }
    }

    // Traitement complet : WHOIS + Déduplication + Million Verifier avec statistiques centralisées
    async processWhoisDedupAndMillionVerifier(yesterdayFile) {
        if (!yesterdayFile) {
            console.log('ℹ️ Aucun fichier de la veille trouvé pour le WHOIS');
            return;
        }

        console.log(`🔍 Lancement du WHOIS sur le fichier: ${yesterdayFile}`);
        console.log(`📁 Vérification de l'existence du fichier d'entrée...`);
        
        // Vérifier que le fichier d'entrée existe avant de lancer le WHOIS
        const fs = require('fs');
        const inputFilePath = path.join(__dirname, '../data', yesterdayFile);
        if (!fs.existsSync(inputFilePath)) {
            console.error(`❌ Fichier d'entrée introuvable: ${inputFilePath}`);
            console.warn(`📋 Fichiers disponibles dans le dossier data:`);
            const files = fs.readdirSync(path.join(__dirname, '../data'));
            files.forEach(file => console.log(`   - ${file}`));
            return;
        }
        
        console.log(`✅ Fichier d'entrée trouvé: ${inputFilePath}`);
        
        // === ÉTAPE 1: WHOIS ===
        const whoisStartTime = Date.now();
        const whoisFileName = await this.whoisService.analyzeCsvFile(yesterdayFile);
        const whoisEndTime = Date.now();
        const whoisDuration = Math.round((whoisEndTime - whoisStartTime) / 1000);
        
        console.log(`✅ WHOIS terminé pour: ${yesterdayFile}, fichier de sortie: ${whoisFileName} (${whoisDuration}s)`);
        
        // Obtenir le nombre de lignes après WHOIS
        const whoisFilePath = path.join(__dirname, '../data', whoisFileName);
        let whoisLineCount = 0;
        if (fs.existsSync(whoisFilePath)) {
            const content = fs.readFileSync(whoisFilePath, 'utf-8');
            whoisLineCount = content.split('\n').filter(line => line.trim()).length - 1; // -1 pour l'en-tête
        }
        
        // Transférer les statistiques du fichier source vers le fichier WHOIS
        // Le service WHOIS ne supprime plus l'ancien fichier du registre,
        // donc on peut utiliser transferStats pour préserver toutes les statistiques
        this.statisticsService.transferStats(yesterdayFile, whoisFileName, {
            whois_lignes: whoisLineCount,
            whois_temps: whoisDuration
        }, {
            type: 'whois',
            traitement: 'whois'
        });

        // === ÉTAPE 2: DÉDUPLICATION ===
        console.log(`🔍 Lancement de la déduplication sur le fichier WHOIS: ${whoisFileName}`);
        console.log(`⏰ Heure de lancement déduplication: ${new Date().toISOString()}`);
        
        try {
            console.log(`📁 Chemin complet du fichier WHOIS: ${whoisFilePath}`);
            
            // Vérifier si le fichier WHOIS existe
            if (fs.existsSync(whoisFilePath)) {
                // Vérifier la taille du fichier
                const stats = fs.statSync(whoisFilePath);
                const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
                console.log(`📊 Taille du fichier WHOIS: ${fileSizeInMB} MB`);
                
                console.log(`✅ Fichier WHOIS trouvé, lancement de la déduplication...`);
                console.log(`🚀 [SCHEDULER] Appel du service Deduplication`);
                const dedupStartTime = Date.now();
                
                await this.deduplicationService.processCsvFile(whoisFilePath);
                
                const dedupEndTime = Date.now();
                const dedupDuration = Math.round((dedupEndTime - dedupStartTime) / 1000);
                console.log(`✅ Déduplication terminée en ${dedupDuration}s pour: ${whoisFileName}`);
                console.log(`⏰ Heure de fin déduplication: ${new Date().toISOString()}`);
                
                // Obtenir le nombre de lignes après déduplication
                let dedupLineCount = 0;
                if (fs.existsSync(whoisFilePath)) {
                    const content = fs.readFileSync(whoisFilePath, 'utf-8');
                    dedupLineCount = content.split('\n').filter(line => line.trim()).length - 1; // -1 pour l'en-tête
                }
                
                // Mettre à jour les statistiques de déduplication
                this.statisticsService.updateFileStats(whoisFileName, {
                    dedup_lignes: dedupLineCount,
                    dedup_temps: dedupDuration
                }, {
                    type: 'deduplicated',
                    traitement: 'dedup'
                });

                // === ÉTAPE 3: MILLION VERIFIER ===
                console.log(`🔍 Lancement du Million Verifier sur le fichier dédupliqué...`);
                console.log(`⏰ Heure de lancement Million Verifier: ${new Date().toISOString()}`);
                
                try {
                    const mvStartTime = Date.now();
                    
                    await this.millionVerifierService.processCsvFile(whoisFilePath);
                    
                    const mvEndTime = Date.now();
                    const mvDuration = Math.round((mvEndTime - mvStartTime) / 1000);
                    console.log(`✅ Million Verifier terminé en ${mvDuration}s pour: ${whoisFileName}`);
                    console.log(`⏰ Heure de fin Million Verifier: ${new Date().toISOString()}`);
                    
                    // Le fichier final sera renommé avec le suffixe _verifier
                    const finalFileName = whoisFileName.replace('.csv', '_verifier.csv');
                    const finalFilePath = path.join(__dirname, '../data', finalFileName);
                    
                    // Obtenir le nombre de lignes après Million Verifier
                    let verifierLineCount = 0;
                    if (fs.existsSync(finalFilePath)) {
                        const content = fs.readFileSync(finalFilePath, 'utf-8');
                        verifierLineCount = content.split('\n').filter(line => line.trim()).length - 1; // -1 pour l'en-tête
                    }
                    
                    // Transférer toutes les statistiques vers le fichier final
                    this.statisticsService.transferStats(whoisFileName, finalFileName, {
                        verifier_lignes: verifierLineCount,
                        verifier_temps: mvDuration
                    }, {
                        type: 'verifier',
                        traitement: 'verifier'
                    });
                    
                } catch (mvError) {
                    console.error(`❌ Erreur lors du Million Verifier:`, mvError.message);
                    console.error(`📋 Stack trace:`, mvError.stack);
                    console.error(`⏰ Heure de l'erreur Million Verifier: ${new Date().toISOString()}`);
                }
            } else {
                console.error(`❌ Fichier WHOIS non trouvé: ${whoisFilePath}`);
                console.warn(`📋 Fichiers disponibles dans le dossier data:`);
                const files = fs.readdirSync(path.join(__dirname, '../data'));
                files.forEach(file => console.log(`   - ${file}`));
            }
        } catch (dedupError) {
            console.error(`❌ Erreur lors de la déduplication:`, dedupError.message);
            console.error(`📋 Stack trace:`, dedupError.stack);
            console.error(`⏰ Heure de l'erreur déduplication: ${new Date().toISOString()}`);
        }
    }

    // Continuer avec WHOIS + Million Verifier (utilise la méthode commune)
    async continueWithWhoisAndMillionVerifier() {
        console.log('✅ Fichier de la veille téléchargé avec succès');
        const yesterdayFile = await this.findYesterdayFile();
        await this.processWhoisDedupAndMillionVerifier(yesterdayFile);
    }


    // Téléchargement simple (une seule tentative par heure)
    async downloadOnce() {
        console.log(`📥 Tentative de téléchargement...`);
        
        try {
            await this.dailyService.downloadDailyFiles('yesterday');
            console.log(`✅ Téléchargement effectué`);
            
            // Utiliser findYesterdayFile pour vérifier que le fichier a bien été téléchargé
            const yesterdayFile = await this.findYesterdayFile();
            
            if (yesterdayFile) {
                console.log(`✅ Fichier téléchargé avec succès: ${yesterdayFile}`);
                return true;
            } else {
                console.warn(`⚠️ Fichier de la veille non trouvé après téléchargement`);
                return false;
            }
            
        } catch (downloadError) {
            console.error(`❌ Erreur lors du téléchargement:`, downloadError.message);
            return false;
        }
    }

    // Méthode publique pour exécuter manuellement le processus complet (téléchargement + WHOIS + Million Verifier)
    // Cette fonction lance directement le processus sans passer par les tâches cron programmées
    async executeDailyYesterdayDownloadAndWhois() {
        console.log('🔄 EXÉCUTION MANUELLE - Lancement du processus complet (téléchargement + WHOIS + Million Verifier)...');
        console.log('⚠️ Mode test : exécution directe sans attendre les tâches cron programmées');
        
        try {
            // Vérifier d'abord si le fichier existe déjà
            const existingFile = await this.findYesterdayFile();
            if (existingFile) {
                console.log(`✅ Fichier de la veille déjà disponible: ${existingFile}`);
                console.log('🔄 Lancement direct du traitement WHOIS + Déduplication + Million Verifier...');
                await this.processWhoisDedupAndMillionVerifier(existingFile);
                return;
            }
            
            console.log('📥 Fichier de la veille non trouvé, démarrage du téléchargement...');
            
            // Téléchargement avec retry interne pour les tests manuels
            const downloadSuccess = await this.downloadWithRetryForManual(3, 10000);
            
            if (!downloadSuccess) {
                console.error('❌ Impossible de télécharger le fichier après plusieurs tentatives. Arrêt du processus.');
                throw new Error('Échec du téléchargement du fichier de la veille');
            }
            
            console.log('✅ Fichier de la veille téléchargé avec succès');
            
            // Utiliser la méthode commune pour le traitement
            const yesterdayFile = await this.findYesterdayFile();
            await this.processWhoisDedupAndMillionVerifier(yesterdayFile);
            
            console.log('🎉 PROCESSUS MANUEL TERMINÉ AVEC SUCCÈS !');
        } catch (error) {
            console.error('❌ Erreur lors du processus manuel:', error.message);
            throw error; // Propager l'erreur pour la gestion côté serveur
        }
    }

    // Téléchargement avec retry pour les tests manuels (délais plus courts)
    async downloadWithRetryForManual(maxRetries = 3, delayMs = 10000) {
        console.log(`🔄 Téléchargement manuel avec retry (max ${maxRetries} tentatives, délai ${delayMs/1000}s)...`);
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`📥 Tentative de téléchargement ${attempt}/${maxRetries}...`);
            
            try {
                await this.dailyService.downloadDailyFiles('yesterday');
                console.log(`✅ Téléchargement effectué (tentative ${attempt})`);
                
                // Vérifier que le fichier a bien été téléchargé
                const yesterdayFile = await this.findYesterdayFile();
                
                if (yesterdayFile) {
                    console.log(`✅ Fichier téléchargé avec succès: ${yesterdayFile} (tentative ${attempt})`);
                    return true;
                } else {
                    console.warn(`⚠️ Fichier de la veille non trouvé après téléchargement (tentative ${attempt}/${maxRetries})`);
                }
                
            } catch (downloadError) {
                console.error(`❌ Erreur lors du téléchargement (tentative ${attempt}/${maxRetries}):`, downloadError.message);
            }
            
            if (attempt < maxRetries) {
                console.log(`⏳ Attente de ${delayMs/1000}s avant nouvelle tentative...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        
        console.error(`❌ Échec du téléchargement après ${maxRetries} tentatives`);
        return false;
    }


    // Trouver le fichier de la veille
    async findYesterdayFile() {
        try {
            // Calculer la date d'hier au format YYYYMMDD
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const year = yesterday.getFullYear();
            const month = String(yesterday.getMonth() + 1).padStart(2, '0');
            const day = String(yesterday.getDate()).padStart(2, '0');
            const yesterdayDate = `${year}${month}${day}`;
            
            // Nom du fichier attendu
            const expectedFileName = `${yesterdayDate}_domains.csv`;
            const expectedFilePath = path.join(__dirname, '../data', expectedFileName);
            
            // Vérifier si le fichier existe
            if (require('fs').existsSync(expectedFilePath)) {
                // Vérifier que le fichier n'est pas vide
                const stats = require('fs').statSync(expectedFilePath);
                if (stats.size > 1024) {
                    console.log(`📁 Fichier de la veille trouvé: ${expectedFileName} (${(stats.size / 1024).toFixed(2)} KB)`);
                return expectedFileName;
                } else {
                    console.warn(`⚠️ Fichier de la veille trouvé mais trop petit: ${expectedFileName} (${(stats.size / 1024).toFixed(2)} KB)`);
                }
            }
            
            // Si le fichier exact n'existe pas, chercher dans le registre
            const files = await this.fileService.getFilesRegistry();
            const yesterdayFiles = Object.keys(files).filter(filename => {
                const fileInfo = files[filename];
                // Vérifier si le nom du fichier contient la date d'hier
                const containsYesterdayDate = filename.includes(yesterdayDate);
                // Vérifier que c'est un fichier CSV de domaines (pas déjà traité par whois)
                const isDomainsFile = filename.includes('_domains.csv') && !filename.includes('_whois');
                // Vérifier que le fichier a été modifié hier
                const fileDate = new Date(fileInfo.modified);
                const isFromYesterday = fileDate.toDateString() === yesterday.toDateString();
                
                return containsYesterdayDate && isDomainsFile && isFromYesterday;
            });
            
            if (yesterdayFiles.length > 0) {
                console.log(`📁 Fichier de la veille trouvé dans le registre: ${yesterdayFiles[0]}`);
                return yesterdayFiles[0];
            }
            
            console.log(`ℹ️ Aucun fichier trouvé pour la date: ${yesterdayDate}`);
            console.log(`🔄 Tentative de retéléchargement automatique...`);
            
            // Essayer de retélécharger le fichier
            const retrySuccess = await this.downloadOnce();
            if (retrySuccess) {
                // Vérifier à nouveau après le retéléchargement
                if (require('fs').existsSync(expectedFilePath)) {
                    const stats = require('fs').statSync(expectedFilePath);
                    if (stats.size > 1024) {
                        console.log(`✅ Fichier retéléchargé avec succès: ${expectedFileName} (${(stats.size / 1024).toFixed(2)} KB)`);
                        return expectedFileName;
                    }
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Erreur lors de la recherche du fichier de la veille:', error.message);
            return null;
        }
    }

    // Nettoyage automatique des anciens fichiers (tous les dimanches à 3h du matin)
    scheduleDataCleanup() {
        cron.schedule('0 3 * * 0', async () => {
            console.log('🧹 Démarrage du nettoyage automatique...');
            try {
                await this.cleanupOldFiles();
                console.log('✅ Nettoyage terminé avec succès');
            } catch (error) {
                console.error('❌ Erreur lors du nettoyage:', error.message);
            }
        }, {
            timezone: "Europe/Paris"
        });
        
        console.log('📅 Job de nettoyage programmé: tous les dimanches à 3h00');
    }

    // Nettoyer les anciens fichiers (garder 30 jours)
    async cleanupOldFiles() {
        const fs = require('fs');
        const dataDir = path.join(__dirname, '../data');
        const tempDir = path.join(__dirname, '../temp');
        
        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 jours
        
        // Nettoyer le dossier data
        if (fs.existsSync(dataDir)) {
            const files = fs.readdirSync(dataDir);
            for (const file of files) {
                const filePath = path.join(dataDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Fichier supprimé: ${file}`);
                }
            }
        }
        
        // Nettoyer le dossier temp
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Fichier temporaire supprimé: ${file}`);
                }
            }
        }
    }

    // Méthode pour déclencher manuellement un job
    async triggerJob(jobType, options = {}) {
        console.log(`🚀 Déclenchement manuel du job: ${jobType}`);
        try {
            switch (jobType) {
                case 'opendata':
                    await this.opendataService.downloadAndExtractOpendata(options.mode || 'auto', options.month);
                    break;
                case 'daily':
                    await this.dailyService.downloadDailyFiles(options.mode || 'last7days', options.days);
                    break;
                case 'dailyAndWhois':
                    // Téléchargement + WHOIS + Million Verifier comme dans la tâche cron
                    const downloadSuccess = await this.downloadOnce();
                    
                    if (!downloadSuccess) {
                        console.error('❌ Impossible de télécharger le fichier après plusieurs tentatives. Arrêt du processus.');
                        throw new Error('Échec du téléchargement du fichier de la veille');
                    }
                    
                    console.log('✅ Fichier de la veille téléchargé avec succès');
                    
                    // Utiliser la méthode commune pour le traitement
                    const yesterdayFile = await this.findYesterdayFile();
                    await this.processWhoisDedupAndMillionVerifier(yesterdayFile);
                    break;
                case 'whois':
                    if (options.filename) {
                        await this.whoisService.analyzeCsvFile(options.filename);
                    } else if (options.yesterday) {
                        // Traitement automatique du fichier de la veille
                        const yesterdayFile = await this.findYesterdayFile();
                        if (yesterdayFile) {
                            console.log(`🔍 Traitement WHOIS manuel pour le fichier de la veille: ${yesterdayFile}`);
                            await this.whoisService.analyzeCsvFile(yesterdayFile);
                            console.log(`✅ WHOIS terminé pour: ${yesterdayFile}`);
                        } else {
                            console.log('ℹ️ Aucun fichier de la veille trouvé à traiter');
                        }
                    } else {
                        console.log('⚠️ Nom de fichier requis ou option "yesterday" pour le traitement WHOIS');
                    }
                    break;
                case 'cleanup':
                    await this.cleanupOldFiles();
                    break;
                default:
                    throw new Error(`Type de job inconnu: ${jobType}`);
            }
            console.log(`✅ Job ${jobType} terminé avec succès`);
        } catch (error) {
            console.error(`❌ Erreur lors du job ${jobType}:`, error.message);
            throw error;
        }
    }
}

// Démarrer le service si ce fichier est exécuté directement
if (require.main === module) {
    const scheduler = new SchedulerService();
    // scheduler.scheduleOpendataDownload(); // Désactivé - téléchargement automatique de l'opendata
    scheduler.scheduleDailyYesterdayDownloadAndWhois();
    // scheduler.scheduleWhoisProcessing(); // Désactivé car inclus dans la tâche de 7h
    scheduler.scheduleDataCleanup();
    // Garder le processus en vie
    process.on('SIGINT', () => {
        console.log('🛑 Arrêt du service de planification...');
        process.exit(0);
    });
}

module.exports = SchedulerService; 