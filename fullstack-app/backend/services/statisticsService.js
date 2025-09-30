const fs = require('fs');
const path = require('path');
const RegistryService = require('./registryService');

class StatisticsService {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.registryService = new RegistryService(this.dataDir);
        console.log('📊 Service de statistiques initialisé');
    }

    /**
     * Récupère les statistiques existantes d'un fichier
     * @param {string} fileName - Nom du fichier
     * @returns {Object} Statistiques existantes
     */
    getExistingStats(fileName) {
        try {
            const registry = this.registryService.loadRegistry();
            return registry[fileName]?.statistiques || {};
        } catch (error) {
            console.warn(`⚠️ Erreur lors de la lecture des statistiques pour ${fileName}:`, error.message);
            return {};
        }
    }

    /**
     * Récupère les statistiques de téléchargement manquantes en analysant le fichier source
     * @param {string} fileName - Nom du fichier à analyser
     * @returns {Object} Statistiques de téléchargement calculées
     */
    recoverDomainStats(fileName) {
        try {
            const filePath = path.join(this.dataDir, fileName);
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ Fichier introuvable pour récupération des statistiques: ${fileName}`);
                return { domain_lignes: 0, domain_temps: 0 };
            }

            // Compter les lignes du fichier
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim()).length - 1; // -1 pour l'en-tête
            
            console.log(`📊 Récupération des statistiques de téléchargement pour ${fileName}: ${lines} lignes`);
            
            return {
                domain_lignes: lines,
                domain_temps: 0 // Temps inconnu pour les fichiers existants
            };
        } catch (error) {
            console.warn(`⚠️ Erreur lors de la récupération des statistiques pour ${fileName}:`, error.message);
            return { domain_lignes: 0, domain_temps: 0 };
        }
    }

    /**
     * Met à jour les statistiques d'un fichier en préservant les anciennes
     * @param {string} fileName - Nom du fichier
     * @param {Object} newStats - Nouvelles statistiques à ajouter
     * @param {Object} fileInfo - Informations générales du fichier
     */
    updateFileStats(fileName, newStats, fileInfo = {}) {
        try {
            const registry = this.registryService.loadRegistry();
            
            // Récupérer les statistiques existantes
            const existingStats = registry[fileName]?.statistiques || {};
            
            // Fusionner les statistiques (préserver l'existant + ajouter le nouveau)
            const mergedStats = {
                // Préserver toutes les statistiques existantes
                domain_lignes: existingStats.domain_lignes || 0,
                domain_temps: existingStats.domain_temps || 0,
                whois_lignes: existingStats.whois_lignes || 0,
                whois_temps: existingStats.whois_temps || 0,
                dedup_lignes: existingStats.dedup_lignes || 0,
                dedup_temps: existingStats.dedup_temps || 0,
                verifier_lignes: existingStats.verifier_lignes || 0,
                verifier_temps: existingStats.verifier_temps || 0,
                // Ajouter/mettre à jour les nouvelles statistiques
                ...newStats
            };

            // Créer ou mettre à jour l'entrée du fichier
            registry[fileName] = {
                ...registry[fileName], // Préserver les données existantes
                ...fileInfo, // Ajouter les nouvelles informations
                size: fileInfo.size || this.getFileSize(fileName),
                modified: fileInfo.modified || new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                statistiques: mergedStats
            };

            this.registryService.saveRegistry(registry);
            
            console.log(`📊 Statistiques mises à jour pour ${fileName}:`);
            console.log(`   - Domain: ${mergedStats.domain_lignes} lignes (${this.formatTime(mergedStats.domain_temps)})`);
            console.log(`   - WHOIS: ${mergedStats.whois_lignes} lignes (${this.formatTime(mergedStats.whois_temps)})`);
            console.log(`   - Déduplication: ${mergedStats.dedup_lignes} lignes (${this.formatTime(mergedStats.dedup_temps)})`);
            console.log(`   - Verifier: ${mergedStats.verifier_lignes} lignes (${this.formatTime(mergedStats.verifier_temps)})`);
            
            return mergedStats;
        } catch (error) {
            console.error(`❌ Erreur lors de la mise à jour des statistiques pour ${fileName}:`, error.message);
            throw error;
        }
    }

    /**
     * Transfère les statistiques d'un fichier source vers un fichier de destination
     * @param {string} sourceFileName - Nom du fichier source
     * @param {string} destFileName - Nom du fichier de destination
     * @param {Object} additionalStats - Statistiques supplémentaires à ajouter
     * @param {Object} fileInfo - Informations générales du fichier de destination
     */
    transferStats(sourceFileName, destFileName, additionalStats = {}, fileInfo = {}) {
        try {
            const registry = this.registryService.loadRegistry();
            
            // Récupérer les statistiques du fichier source
            const sourceStats = registry[sourceFileName]?.statistiques || {};
            const sourceFileInfo = registry[sourceFileName] || {};
            
            console.log(`📊 Transfert des statistiques de ${sourceFileName} vers ${destFileName}`);
            console.log(`📊 Statistiques source:`, sourceStats);
            
            // Vérifier si les statistiques de téléchargement sont présentes
            let finalDomainStats = {
                domain_lignes: sourceStats.domain_lignes || 0,
                domain_temps: sourceStats.domain_temps || 0
            };
            
            const hasDomainStats = sourceStats.domain_lignes > 0 || sourceStats.domain_temps > 0;
            if (!hasDomainStats) {
                console.warn(`⚠️ ATTENTION: Le fichier source ${sourceFileName} n'a pas de statistiques de téléchargement`);
                console.log(`🔍 Tentative de récupération des statistiques en analysant le fichier source...`);
                
                // Essayer de récupérer les statistiques en analysant le fichier source
                const recoveredStats = this.recoverDomainStats(sourceFileName);
                if (recoveredStats.domain_lignes > 0) {
                    console.log(`✅ Statistiques de téléchargement récupérées: ${recoveredStats.domain_lignes} lignes`);
                    finalDomainStats = recoveredStats;
                } else {
                    console.warn(`⚠️ Impossible de récupérer les statistiques de téléchargement pour ${sourceFileName}`);
                }
            }
            
            // Fusionner avec les nouvelles statistiques
            const mergedStats = {
                // Utiliser les statistiques de téléchargement récupérées ou existantes
                domain_lignes: finalDomainStats.domain_lignes,
                domain_temps: finalDomainStats.domain_temps,
                whois_lignes: sourceStats.whois_lignes || 0,
                whois_temps: sourceStats.whois_temps || 0,
                dedup_lignes: sourceStats.dedup_lignes || 0,
                dedup_temps: sourceStats.dedup_temps || 0,
                verifier_lignes: sourceStats.verifier_lignes || 0,
                verifier_temps: sourceStats.verifier_temps || 0,
                // Ajouter les nouvelles statistiques
                ...additionalStats
            };

            // Créer l'entrée pour le fichier de destination en préservant les informations du fichier source
            registry[destFileName] = {
                // Préserver les informations générales du fichier source
                ...sourceFileInfo,
                // Ajouter les nouvelles informations
                ...fileInfo,
                // Mettre à jour les champs spécifiques
                size: fileInfo.size || this.getFileSize(destFileName),
                modified: fileInfo.modified || new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                statistiques: mergedStats
            };

            this.registryService.saveRegistry(registry);
            
            // Supprimer l'ancienne entrée du registre après le transfert (sauf si c'est le même fichier)
            if (sourceFileName !== destFileName) {
                delete registry[sourceFileName];
                this.registryService.saveRegistry(registry);
                console.log(`🗑️ Ancienne entrée supprimée du registre: ${sourceFileName}`);
            }
            
            console.log(`📊 Statistiques transférées de ${sourceFileName} vers ${destFileName}:`);
            console.log(`   - Domain: ${mergedStats.domain_lignes} lignes (${this.formatTime(mergedStats.domain_temps)})`);
            console.log(`   - WHOIS: ${mergedStats.whois_lignes} lignes (${this.formatTime(mergedStats.whois_temps)})`);
            console.log(`   - Déduplication: ${mergedStats.dedup_lignes} lignes (${this.formatTime(mergedStats.dedup_temps)})`);
            console.log(`   - Verifier: ${mergedStats.verifier_lignes} lignes (${this.formatTime(mergedStats.verifier_temps)})`);
            
            // Avertissement si les statistiques de téléchargement sont nulles
            if (mergedStats.domain_lignes === 0 && mergedStats.domain_temps === 0) {
                console.warn(`⚠️ ATTENTION: Le fichier ${destFileName} a des statistiques de téléchargement nulles`);
                console.warn(`⚠️ Cela peut indiquer que le fichier source n'a pas été téléchargé via le dailyService`);
            }
            
            return mergedStats;
        } catch (error) {
            console.error(`❌ Erreur lors du transfert des statistiques de ${sourceFileName} vers ${destFileName}:`, error.message);
            throw error;
        }
    }

    /**
     * Récupère la taille d'un fichier
     * @param {string} fileName - Nom du fichier
     * @returns {number} Taille en octets
     */
    getFileSize(fileName) {
        try {
            const filePath = path.join(this.dataDir, fileName);
            if (fs.existsSync(filePath)) {
                return fs.statSync(filePath).size;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Obtient les statistiques complètes d'un fichier
     * @param {string} fileName - Nom du fichier
     * @returns {Object} Statistiques complètes
     */
    getFileStats(fileName) {
        try {
            const registry = this.registryService.loadRegistry();
            return registry[fileName]?.statistiques || {};
        } catch (error) {
            console.warn(`⚠️ Erreur lors de la récupération des statistiques pour ${fileName}:`, error.message);
            return {};
        }
    }

    /**
     * Corrige les statistiques de téléchargement manquantes d'un fichier existant
     * @param {string} fileName - Nom du fichier à corriger
     * @returns {Object} Statistiques corrigées
     */
    fixMissingDomainStats(fileName) {
        try {
            const registry = this.registryService.loadRegistry();
            const fileStats = registry[fileName]?.statistiques || {};
            
            // Vérifier si les statistiques de téléchargement sont manquantes
            if (fileStats.domain_lignes === 0 && fileStats.domain_temps === 0) {
                console.log(`🔧 Correction des statistiques de téléchargement pour ${fileName}...`);
                
                // Essayer de récupérer les statistiques en analysant le fichier
                const recoveredStats = this.recoverDomainStats(fileName);
                if (recoveredStats.domain_lignes > 0) {
                    // Mettre à jour les statistiques
                    const updatedStats = {
                        ...fileStats,
                        domain_lignes: recoveredStats.domain_lignes,
                        domain_temps: recoveredStats.domain_temps
                    };
                    
                    registry[fileName].statistiques = updatedStats;
                    registry[fileName].lastUpdated = new Date().toISOString();
                    
                    this.registryService.saveRegistry(registry);
                    
                    console.log(`✅ Statistiques de téléchargement corrigées pour ${fileName}: ${recoveredStats.domain_lignes} lignes`);
                    return updatedStats;
                } else {
                    console.warn(`⚠️ Impossible de corriger les statistiques pour ${fileName}`);
                    return fileStats;
                }
            } else {
                console.log(`ℹ️ Les statistiques de téléchargement pour ${fileName} sont déjà présentes`);
                return fileStats;
            }
        } catch (error) {
            console.error(`❌ Erreur lors de la correction des statistiques pour ${fileName}:`, error.message);
            return {};
        }
    }

    /**
     * Supprime les statistiques d'un fichier
     * @param {string} fileName - Nom du fichier
     */
    removeFileStats(fileName) {
        try {
            const registry = this.registryService.loadRegistry();
            if (registry[fileName]) {
                delete registry[fileName];
                this.registryService.saveRegistry(registry);
                console.log(`🗑️ Statistiques supprimées pour ${fileName}`);
            }
        } catch (error) {
            console.warn(`⚠️ Erreur lors de la suppression des statistiques pour ${fileName}:`, error.message);
        }
    }

    /**
     * Formate un temps en secondes vers un format lisible (heures, minutes, secondes)
     * @param {number} seconds - Temps en secondes
     * @returns {string} Temps formaté
     */
    formatTime(seconds) {
        if (!seconds || seconds === 0) return '0s';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        
        let result = '';
        
        if (hours > 0) {
            result += `${hours}h `;
        }
        
        if (minutes > 0) {
            result += `${minutes}m `;
        }
        
        if (remainingSeconds > 0 || result === '') {
            result += `${remainingSeconds}s`;
        }
        
        return result.trim();
    }

    /**
     * Obtient un résumé des statistiques de tous les fichiers
     * @returns {Object} Résumé des statistiques
     */
    getAllStatsSummary() {
        try {
            const registry = this.registryService.loadRegistry();
            const summary = {
                totalFiles: 0,
                totalDomainLines: 0,
                totalWhoisLines: 0,
                totalDedupLines: 0,
                totalVerifierLines: 0,
                totalDomainTime: 0,
                totalWhoisTime: 0,
                totalDedupTime: 0,
                totalVerifierTime: 0
            };

            Object.values(registry).forEach(fileInfo => {
                if (fileInfo.statistiques) {
                    summary.totalFiles++;
                    summary.totalDomainLines += fileInfo.statistiques.domain_lignes || 0;
                    summary.totalWhoisLines += fileInfo.statistiques.whois_lignes || 0;
                    summary.totalDedupLines += fileInfo.statistiques.dedup_lignes || 0;
                    summary.totalVerifierLines += fileInfo.statistiques.verifier_lignes || 0;
                    summary.totalDomainTime += fileInfo.statistiques.domain_temps || 0;
                    summary.totalWhoisTime += fileInfo.statistiques.whois_temps || 0;
                    summary.totalDedupTime += fileInfo.statistiques.dedup_temps || 0;
                    summary.totalVerifierTime += fileInfo.statistiques.verifier_temps || 0;
                }
            });

            return summary;
        } catch (error) {
            console.warn('⚠️ Erreur lors du calcul du résumé des statistiques:', error.message);
            return {};
        }
    }

    /**
     * Obtient un résumé formaté des statistiques avec temps lisibles
     * @returns {Object} Résumé formaté des statistiques
     */
    getFormattedStatsSummary() {
        const summary = this.getAllStatsSummary();
        
        return {
            ...summary,
            formattedTimes: {
                domain: this.formatTime(summary.totalDomainTime),
                whois: this.formatTime(summary.totalWhoisTime),
                dedup: this.formatTime(summary.totalDedupTime),
                verifier: this.formatTime(summary.totalVerifierTime),
                total: this.formatTime(summary.totalDomainTime + summary.totalWhoisTime + summary.totalDedupTime + summary.totalVerifierTime)
            }
        };
    }
}

module.exports = StatisticsService;
