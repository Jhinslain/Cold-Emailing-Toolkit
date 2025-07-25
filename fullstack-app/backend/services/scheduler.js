const cron = require('node-cron');
const OpendataService = require('./opendataService');
const DailyService = require('./dailyService');
const WhoisService = require('./whoisService');
const FileService = require('./fileService');
const path = require('path');

class SchedulerService {
    constructor() {
        this.opendataService = new OpendataService();
        this.dailyService = new DailyService();
        this.whoisService = new WhoisService(path.join(__dirname, '../data'));
        this.fileService = new FileService(path.join(__dirname, '../data'));
        
        console.log('🚀 Service de planification démarré');
    }

    // Téléchargement automatique de l'Opendata (tous les 1er du mois à 2h du matin)
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

    // Téléchargement automatique du fichier de la veille + WHOIS (tous les jours à 7h)
    scheduleDailyYesterdayDownloadAndWhois() {
        cron.schedule('0 6 * * *', async () => {
            console.log('🔄 Téléchargement automatique du fichier de la veille (J-1)...');
            try {
                await this.dailyService.downloadDailyFiles('yesterday');
                console.log('✅ Fichier de la veille téléchargé avec succès');

                // Trouver le fichier de la veille
                const yesterdayFile = await this.findYesterdayFile();
                if (yesterdayFile) {
                    console.log(`🔍 Lancement du WHOIS sur le fichier: ${yesterdayFile}`);
                    await this.whoisService.analyzeCsvFile(yesterdayFile);
                    console.log(`✅ WHOIS terminé pour: ${yesterdayFile}`);
                } else {
                    console.log('ℹ️ Aucun fichier de la veille trouvé pour le WHOIS');
                }
            } catch (error) {
                console.error('❌ Erreur lors du téléchargement ou du WHOIS:', error.message);
            }
        }, {
            timezone: "Europe/Paris"
        });
        console.log('📅 Job téléchargement + WHOIS programmé: tous les jours à 7h00');
    }

    // Traitement WHOIS automatique (tous les jours à 8h du matin)
    scheduleWhoisProcessing() {
        cron.schedule('0 7 * * *', async () => {
            console.log('🔄 Démarrage du traitement WHOIS automatique sur le fichier de la veille...');
            try {
                // Trouver le fichier de la veille
                const yesterdayFile = await this.findYesterdayFile();
                
                if (yesterdayFile) {
                    console.log(`🔍 Traitement WHOIS pour le fichier de la veille: ${yesterdayFile}`);
                    await this.whoisService.analyzeCsvFile(yesterdayFile);
                    console.log(`✅ WHOIS terminé pour: ${yesterdayFile}`);
                } else {
                    console.log('ℹ️ Aucun fichier de la veille trouvé à traiter');
                }
                
            } catch (error) {
                console.error('❌ Erreur lors du traitement WHOIS:', error.message);
            }
        }, {
            timezone: "Europe/Paris"
        });
        
        console.log('📅 Job WHOIS programmé: tous les jours à 8h00 (fichier de la veille)');
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
                console.log(`📁 Fichier de la veille trouvé: ${expectedFileName}`);
                return expectedFileName;
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
                    // Téléchargement + WHOIS comme dans la tâche cron
                    await this.dailyService.downloadDailyFiles('yesterday');
                    console.log('✅ Fichier de la veille téléchargé avec succès');
                    const yesterdayFile = await this.findYesterdayFile();
                    if (yesterdayFile) {
                        console.log(`🔍 Lancement du WHOIS sur le fichier: ${yesterdayFile}`);
                        await this.whoisService.analyzeCsvFile(yesterdayFile);
                        console.log(`✅ WHOIS terminé pour: ${yesterdayFile}`);
                    } else {
                        console.log('ℹ️ Aucun fichier de la veille trouvé pour le WHOIS');
                    }
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
    scheduler.scheduleOpendataDownload();
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