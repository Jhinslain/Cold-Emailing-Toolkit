const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FileService = require('./fileService');

class DailyService {
    constructor() {
        // Chemins vers les dossiers dans fullstack-app
        this.dataDir = path.join(__dirname, '../data');
        
        // Créer les dossiers s'ils n'existent pas
        this.ensureDirectories();

        this.fileService = new FileService();
    }

    // Créer les dossiers nécessaires
    ensureDirectories() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
            console.log(`📁 Dossier créé: ${path.basename(this.dataDir)}`);
        }
    }

    // Télécharger les fichiers quotidiens
    async downloadDailyFiles(mode = 'last7days', days = 1) {
        console.log(`🔄 Début du téléchargement quotidien - Mode: ${mode}, Jours: ${days}`);
        
        const dates = this.getDatesToDownload(mode, days);
        const results = [];
        
        for (const date of dates) {
            try {
                const result = await this.downloadDailyFile(date);
                results.push(result);
            } catch (error) {
                console.error(`❌ Erreur pour ${date}: ${error.message}`);
                results.push({
                    date,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        console.log(`✅ Téléchargement terminé: ${successCount}/${dates.length} fichiers`);
        
        return {
            success: successCount > 0,
            message: `${successCount} fichiers téléchargés et convertis sur ${dates.length} demandés`,
            results
        };
    }

    // Obtenir les dates à télécharger selon le mode
    getDatesToDownload(mode, days) {
        const dates = [];
        
        // Fonction pour générer la date au format YYYYMMDD (inspirée du script original)
        function getDateYYYYMMDD(daysAgo = 0) {
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}${month}${day}`;
        }
        
        switch (mode) {
            case 'yesterday':
                dates.push(getDateYYYYMMDD(1));
                break;
                
            case 'last7days':
                for (let i = 1; i <= 7; i++) {
                    dates.push(getDateYYYYMMDD(i));
                }
                break;
                
            case 'specific':
                if (days < 1 || days > 7) {
                    throw new Error('Le nombre de jours doit être entre 1 et 7');
                }
                dates.push(getDateYYYYMMDD(days));
                break;
                
            default:
                throw new Error('Mode invalide');
        }
        
        return dates;
    }

    // Télécharger un fichier quotidien spécifique et le convertir en CSV (une colonne)
    async downloadDailyFile(date) {
        const txtFileName = `${date}_CREA_fr.txt`;
        const csvFileName = `${date}_domains.csv`;
        const txtFilePath = path.join(this.dataDir, txtFileName);
        const csvFilePath = path.join(this.dataDir, csvFileName);
        
        // Vérifier si le fichier CSV existe déjà
        if (fs.existsSync(csvFilePath)) {
            // Mettre à jour le nombre de lignes même si le fichier existe déjà
            await this.fileService.updateFileLineCount(csvFileName);
            console.log(`✅ Fichier CSV déjà présent: ${csvFileName}`);
            return {
                date,
                success: true,
                message: `Fichier ${csvFileName} déjà présent`,
                file: csvFileName,
                path: csvFilePath,
                converted: true
            };
        }
        
        // URL de téléchargement
        const url = `https://www.afnic.fr/wp-media/ftp/domaineTLD_Afnic/${txtFileName}`;
        
        try {
            console.log(`📥 Téléchargement de ${txtFileName}...`);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Sauvegarder le fichier TXT
            const fileStream = fs.createWriteStream(txtFilePath);
            await new Promise((resolve, reject) => {
                response.body.pipe(fileStream);
                response.body.on('error', reject);
                fileStream.on('finish', resolve);
            });
            
            console.log(`✅ Fichier TXT téléchargé: ${txtFileName}`);
            
            // Convertir le fichier TXT en CSV (une colonne, entre #BOF et #EOF uniquement)
            console.log(`🔄 Conversion de ${txtFileName} vers ${csvFileName}...`);
            const conversionResult = await this.convertTxtToCsv(txtFilePath, csvFilePath);
            
            if (conversionResult.success) {
                // Supprimer le fichier TXT après conversion réussie
                fs.unlinkSync(txtFilePath);
                console.log(`🗑️ Fichier TXT supprimé: ${txtFileName}`);
                // Mettre à jour le nombre de lignes dans le registre
                await this.fileService.updateFileLineCount(csvFileName);
                return {
                    date,
                    success: true,
                    message: `Fichier ${csvFileName} téléchargé et converti avec succès`,
                    file: csvFileName,
                    path: csvFilePath,
                    converted: true,
                    lines: conversionResult.lines
                };
            } else {
                throw new Error(`Erreur de conversion: ${conversionResult.error}`);
            }
            
        } catch (error) {
            // Nettoyer en cas d'erreur
            if (fs.existsSync(txtFilePath)) {
                fs.unlinkSync(txtFilePath);
            }
            if (fs.existsSync(csvFilePath)) {
                fs.unlinkSync(csvFilePath);
            }
            throw error;
        }
    }

    // Convertir un fichier TXT en CSV (une colonne, entre #BOF et #EOF uniquement)
    async convertTxtToCsv(txtFilePath, csvFilePath) {
        return new Promise((resolve, reject) => {
            try {
                const content = fs.readFileSync(txtFilePath, 'utf8');
                const lines = content.split('\n');
                const domains = [];
                let inDataSection = false;
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine === '#BOF') {
                        inDataSection = true;
                        continue;
                    }
                    if (trimmedLine === '#EOF') {
                        break;
                    }
                    if (inDataSection && trimmedLine && !trimmedLine.startsWith('#')) {
                        domains.push(trimmedLine);
                    }
                }
                const csvContent = 'Nom de domaine\n' + domains.join('\n');
                fs.writeFileSync(csvFilePath, csvContent, 'utf8');
                console.log(`✅ ${domains.length.toLocaleString()} domaines extraits → ${path.basename(csvFilePath)}`);
                resolve({ success: true, lines: domains.length });
            } catch (error) {
                reject({ success: false, error: error.message });
            }
        });
    }

    // Obtenir les dates disponibles pour les fichiers quotidiens
    getAvailableDates() {
        const dates = [];
        const today = new Date();
        
        // Générer les 30 derniers jours
        for (let i = 1; i <= 30; i++) {
            dates.push(this.formatDate(today.getTime() - i * 24 * 60 * 60 * 1000));
        }
        
        return dates;
    }

    // Obtenir les statistiques des fichiers quotidiens
    getDailyStats() {
        const stats = {
            totalFiles: 0,
            totalSize: 0,
            files: []
        };
        
        if (fs.existsSync(this.dataDir)) {
            const files = fs.readdirSync(this.dataDir)
                .filter(file => file.endsWith('_CREA_fr.csv'))
                .map(file => {
                    const filePath = path.join(this.dataDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file,
                        size: stats.size,
                        modified: stats.mtime,
                        date: file.split('_')[0]
                    };
                })
                .sort((a, b) => b.modified - a.modified);
            
            stats.totalFiles = files.length;
            stats.totalSize = files.reduce((sum, file) => sum + file.size, 0);
            stats.files = files;
        }
        
        return stats;
    }
}

module.exports = DailyService; 