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

    // Démarrer tous les jobs programmés
    startAllJobs() {
        this.scheduleOpendataDownload();
        this.scheduleDailyDownload();
        this.scheduleWhoisProcessing();
        this.scheduleDataCleanup();
        
        console.log('✅ Tous les jobs programmés ont été démarrés');
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

    // Téléchargement quotidien (tous les jours à 6h du matin)
    scheduleDailyDownload() {
        cron.schedule('0 6 * * *', async () => {
            console.log('🔄 Démarrage du téléchargement quotidien...');
            try {
                await this.dailyService.downloadDailyFiles('last7days');
                console.log('✅ Téléchargement quotidien terminé avec succès');
            } catch (error) {
                console.error('❌ Erreur lors du téléchargement quotidien:', error.message);
            }
        }, {
            timezone: "Europe/Paris"
        });
        
        console.log('📅 Job quotidien programmé: tous les jours à 6h00');
    }

    // Traitement WHOIS automatique (tous les jours à 8h du matin)
    scheduleWhoisProcessing() {
        cron.schedule('0 8 * * *', async () => {
            console.log('🔄 Démarrage du traitement WHOIS automatique...');
            try {
                // Récupérer les fichiers récents qui n'ont pas encore été traités
                const files = await this.fileService.getFilesRegistry();
                const recentFiles = Object.keys(files).filter(filename => {
                    const fileInfo = files[filename];
                    const isRecent = new Date(fileInfo.modified) > new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h
                    const notProcessed = !filename.includes('_whois');
                    const isCsv = filename.endsWith('.csv');
                    return isRecent && notProcessed && isCsv;
                });

                if (recentFiles.length > 0) {
                    console.log(`📁 ${recentFiles.length} fichiers récents trouvés pour traitement WHOIS`);
                    
                    for (const filename of recentFiles) {
                        console.log(`🔍 Traitement WHOIS pour: ${filename}`);
                        await this.whoisService.analyzeCsvFile(filename);
                        console.log(`✅ WHOIS terminé pour: ${filename}`);
                    }
                } else {
                    console.log('ℹ️ Aucun nouveau fichier à traiter');
                }
                
            } catch (error) {
                console.error('❌ Erreur lors du traitement WHOIS:', error.message);
            }
        }, {
            timezone: "Europe/Paris"
        });
        
        console.log('📅 Job WHOIS programmé: tous les jours à 8h00');
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
                    
                case 'whois':
                    if (options.filename) {
                        await this.whoisService.analyzeCsvFile(options.filename);
                    } else {
                        console.log('⚠️ Nom de fichier requis pour le traitement WHOIS');
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
    scheduler.startAllJobs();
    
    // Garder le processus en vie
    process.on('SIGINT', () => {
        console.log('🛑 Arrêt du service de planification...');
        process.exit(0);
    });
}

module.exports = SchedulerService; 