const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const StreamZip = require('node-stream-zip');
const { processDomainesValides } = require('./domainValideService');

class OpendataService {
    constructor() {
        // Chemins vers les dossiers dans fullstack-app
        this.dataDir = path.join(__dirname, '../data');
        this.tempDir = path.join(__dirname, '../temp');
        
        // Créer les dossiers s'ils n'existent pas
        this.ensureDirectories();
    }

    // Créer les dossiers nécessaires
    ensureDirectories() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
            console.log(`📁 Dossier créé: ${path.basename(this.dataDir)}`);
        }
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
            console.log(`📁 Dossier créé: ${path.basename(this.tempDir)}`);
        }
    }

      // Télécharger et extraire l'Opendata Afnic
  async downloadAndExtractOpendata(mode = 'auto', month = null) {
    console.log(`🔄 Début du téléchargement Opendata - Mode: ${mode}`);
    
    let result;
    if (mode === 'auto') {
      result = await this.downloadAuto();
    } else if (mode === 'manual' && month) {
      result = await this.tryDownloadMonth(month);
    } else {
      throw new Error('Mode invalide ou mois manquant');
    }
    
    // Traitement automatique après téléchargement
    if (result.success && result.file) {
      const inputFile = path.join(this.dataDir, result.file);
      const ext = path.extname(result.file);
      let monthStr = month;
      if (!monthStr) {
        const match = result.file.match(/(\d{6})/);
        if (match) monthStr = match[1];
      }
      const outputFile = path.join(this.dataDir, `OPENDATA_FR_${monthStr}${ext}`);
      try {
        const processResult = await processDomainesValides(inputFile, outputFile);
        result.processResult = processResult;
        result.processResult.outputFile = outputFile;
        result.message += ' et traitement automatique terminé';
      } catch (error) {
        result.processError = error.message;
      }
    }
    
    return result;
  }

      // Téléchargement automatique (essaie les 3 derniers mois)
  async downloadAuto() {
    // Fonction pour calculer un mois spécifique (inspirée du script original)
    function getMonthYYYYMM(monthsAgo = 1) {
      const now = new Date();
      now.setDate(1); // Pour éviter les problèmes de fin de mois
      now.setMonth(now.getMonth() - monthsAgo);
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      return `${y}${m}`;
    }
    
    console.log('\n🔄 Essai automatique des 3 derniers mois disponibles...\n');
    
    for (let i = 1; i <= 3; i++) {
      const monthToTry = getMonthYYYYMM(i);
      console.log(`📅 Tentative ${i}/3: ${monthToTry}`);
      
      try {
        const result = await this.tryDownloadMonth(monthToTry);
        if (result.success) {
          console.log(`✅ Succès avec le mois ${monthToTry}`);
          return result;
        }
      } catch (error) {
        console.log(`❌ Échec pour ${monthToTry}: ${error.message}`);
        if (i === 3) {
          throw new Error('Aucun des 3 derniers mois n\'est disponible. Essayez le mode manuel avec un mois plus ancien.');
        }
      }
    }
  }

    // Fonction pour essayer de télécharger un mois spécifique
    async tryDownloadMonth(month) {
        const zipName = `${month}_OPENDATA_A-NomsDeDomaineEnPointFr.zip`;
        const zipPath = path.join(this.dataDir, zipName);
        const csvName = `${month}_OPENDATA_A-NomsDeDomaineEnPointFr.csv`;
        const csvPath = path.join(this.dataDir, csvName);
        
        // Toujours forcer le téléchargement (supprimer l'ancien fichier s'il existe)
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
        }
        if (fs.existsSync(csvPath)) {
            fs.unlinkSync(csvPath);
        }
        
        // URL de téléchargement (inspirée du script original)
        const url = `https://www.afnic.fr/wp-media/ftp/documentsOpenData/${zipName}`;
        
        try {
            console.log(`📥 Téléchargement de ${zipName}...`);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Sauvegarder le fichier ZIP
            const fileStream = fs.createWriteStream(zipPath);
            await new Promise((resolve, reject) => {
                response.body.pipe(fileStream);
                response.body.on('error', reject);
                fileStream.on('finish', resolve);
            });
            
            console.log(`✅ ZIP téléchargé: ${zipName}`);
            
            // Extraire le CSV
            console.log('📂 Extraction du CSV...');
            const zip = new StreamZip.async({ file: zipPath });
            const entries = await zip.entries();
            
            // Chercher le fichier CSV dans l'archive
            const csvEntry = Object.values(entries).find(entry => 
                entry.name.toLowerCase().endsWith('.csv')
            );
            
            if (!csvEntry) {
                throw new Error('Aucun fichier CSV trouvé dans l\'archive');
            }
            
            // Extraire le CSV
            await zip.extract(csvEntry, this.dataDir);
            await zip.close();
            
            // Renommer le fichier extrait
            const extractedPath = path.join(this.dataDir, csvEntry.name);
            if (fs.existsSync(extractedPath) && extractedPath !== csvPath) {
                fs.renameSync(extractedPath, csvPath);
            }
            
            // Supprimer le ZIP
            fs.unlinkSync(zipPath);
            
            console.log(`✅ Extraction terminée: ${csvName}`);
            
            // Mettre à jour le registre avec les informations du fichier
            await this.updateRegistryWithOpendata(csvName);
            
            return {
                success: true,
                message: `Fichier ${csvName} téléchargé et extrait avec succès`,
                file: csvName,
                path: csvPath
            };
            
        } catch (error) {
            // Nettoyer en cas d'erreur
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
            }
            throw error;
        }
    }

    // Traiter les domaines (utiliser le service intégré)
    async processDomains(mode = 'test') {
        console.log(`🔄 Début du traitement des domaines - Mode: ${mode}`);
        
        try {
            // Chercher le fichier CSV le plus récent dans le dossier data
            const dataFiles = fs.readdirSync(this.dataDir)
                .filter(file => file.endsWith('.csv') && !file.includes('_valides'))
                .map(file => ({
                    name: file,
                    path: path.join(this.dataDir, file),
                    stats: fs.statSync(path.join(this.dataDir, file))
                }))
                .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
            
            if (dataFiles.length === 0) {
                throw new Error('Aucun fichier CSV trouvé dans le dossier data');
            }
            
            const inputFile = dataFiles[0].path;
            const ext = path.extname(inputFile);
            const base = path.basename(inputFile, ext);
            const outputFile = path.join(this.dataDir, `${base}_valides${ext}`);
            
            console.log(`📁 Fichier d'entrée: ${dataFiles[0].name}`);
            console.log(`📁 Fichier de sortie: ${path.basename(outputFile)}`);
            
            // Utiliser le service de traitement des domaines
            const result = await processDomainesValides(inputFile, outputFile);
            
            if (result.success) {
                console.log('✅ Traitement terminé avec succès');
                return {
                    success: true,
                    message: 'Traitement des domaines terminé avec succès',
                    data: result
                };
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('❌ Erreur lors du traitement des domaines:', error);
            throw error;
        }
    }

    // Mettre à jour le registre avec les informations du fichier Opendata
    async updateRegistryWithOpendata(filename) {
        try {
            const RegistryService = require('./registryService');
            const registryService = new RegistryService(this.dataDir);
            
            registryService.addDownloadedFile(filename, true); // true pour Opendata AFNIC
            console.log(`📅 Registre mis à jour pour ${filename} avec dates: ["all"]`);
            
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour du registre:', error.message);
        }
    }
}

module.exports = OpendataService; 