const fs = require('fs');
const path = require('path');
const readline = require('readline');
const FileService = require('./fileService');

class PersonalizedMessageService {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.fileService = new FileService();
        this.jobs = {}; // jobId -> { cancel: false }
    }

    // Méthode pour le streaming SSE
    async generatePersonalizedMessages(jobId, inputCsvName, messageTemplate, sendLog) {
        console.log('--- APPEL generatePersonalizedMessages ---', jobId, inputCsvName);
        console.log(`[PERSONALIZED] Démarrage generatePersonalizedMessages jobId=${jobId} fichier=${inputCsvName}`);
        
        const inputCsvPath = path.join(this.dataDir, inputCsvName);
        if (!fs.existsSync(inputCsvPath)) {
            console.log(`[PERSONALIZED] Fichier introuvable: ${inputCsvName}`);
            sendLog('error', `Fichier introuvable: ${inputCsvName}`);
            return;
        }

        // Note: Le service accepte tous les fichiers CSV, mais le bouton n'apparaît que sur les fichiers WHOIS côté frontend

        // Lire le fichier CSV
        const lines = [];
        const rl = readline.createInterface({
            input: fs.createReadStream(inputCsvPath),
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            lines.push(line);
        }
        rl.close();

        if (lines.length === 0) {
            console.log(`[PERSONALIZED] Fichier CSV vide.`);
            sendLog('error', 'Fichier CSV vide.');
            return;
        }

        // Analyser l'en-tête pour trouver la colonne "whois_organisation"
        const header = lines[0].split(',');
        const orgColumnIndex = header.findIndex(col => 
            col.toLowerCase().includes('whois_organisation') || 
            col.toLowerCase().includes('whois_organization')
        );

        if (orgColumnIndex === -1) {
            console.log(`[PERSONALIZED] Colonne "whois_organisation" non trouvée dans le fichier.`);
            sendLog('error', 'Colonne "whois_organisation" non trouvée dans le fichier.');
            return;
        }

        // Préparer le nom du fichier de sortie
        const baseName = inputCsvName.replace(/\.csv$/i, '');
        const outputCsvName = baseName + '_personalized.csv';
        const outputCsvPath = path.join(this.dataDir, outputCsvName);

        // Initialiser les statistiques
        const stats = {
            total: lines.length - 1, // Exclure l'en-tête
            processed: 0,
            messagesGenerated: 0,
            emptyMessages: 0,
            errors: 0,
            startTime: Date.now()
        };

        // Fonction pour afficher les statistiques
        const displayStats = () => {
            const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
            const progress = ((stats.processed / stats.total) * 100).toFixed(1);
            const rate = stats.processed > 0 ? Math.floor(stats.processed / (elapsed / 60)) : 0; // lignes/minute

            const statsText = [
                '\n' + '='.repeat(60),
                `📝 STATISTIQUES MESSAGES PERSONNALISÉS - ${new Date().toLocaleString()}`,
                '='.repeat(60),
                `📈 Progression: ${stats.processed}/${stats.total} (${progress}%)`,
                `⏱️  Temps écoulé: ${elapsed}s | Vitesse: ${rate} lignes/min`,
                `✅ Messages générés: ${stats.messagesGenerated}`,
                `⚪ Messages vides: ${stats.emptyMessages}`,
                `❌ Erreurs: ${stats.errors}`,
                `📊 Taux de succès: ${stats.processed > 0 ? ((stats.messagesGenerated / stats.processed) * 100).toFixed(1) : 0}%`,
                '='.repeat(60) + '\n'
            ].join('\n');

            console.log(statsText);
            sendLog('stats', statsText);
        };

        // Traiter chaque ligne
        const outputLines = [];
        this.jobs[jobId] = { cancel: false };

        console.log(`🚀 Démarrage de la génération de messages personnalisés sur ${stats.total} lignes...`);
        console.log(`📝 Template: "${messageTemplate}"`);
        displayStats();

        // Ajouter l'en-tête avec la nouvelle colonne
        outputLines.push(lines[0] + ',message_organization');

        for (let i = 1; i < lines.length; i++) {
            if (this.jobs[jobId]?.cancel) {
                console.log(`[PERSONALIZED] Annulation demandée pour jobId=${jobId}`);
                sendLog('cancel', "Traitement annulé par l'utilisateur.");
                break;
            }

            stats.processed++;

            try {
                const line = lines[i];
                const columns = line.split(',');
                
                // Récupérer l'organisation
                const organization = columns[orgColumnIndex] || '';
                const cleanOrg = organization.trim();

                let personalizedMessage = '';

                // Générer le message personnalisé
                if (
                    cleanOrg &&
                    cleanOrg.toLowerCase() !== 'n/a' &&
                    cleanOrg !== '' &&
                    !/none/i.test(cleanOrg)
                ) {
                    // Remplacer {organisation} par l'organisation réelle
                    personalizedMessage = messageTemplate.replace(/\{organisation\}/g, cleanOrg);
                    stats.messagesGenerated++;
                    sendLog('success', `✅ [${stats.processed}/${stats.total}] Message généré: "${personalizedMessage}"`);
                    console.log(`[PERSONALIZED] Message généré: "${personalizedMessage}"`);
                } else {
                    // Pas d'organisation, N/A ou None
                    personalizedMessage = '';
                    stats.emptyMessages++;
                    sendLog('warn', `⚪ [${stats.processed}/${stats.total}] Aucune organisation - message vide`);
                    console.log(`[PERSONALIZED] Aucune organisation trouvée - message vide`);
                }

                // Ajouter la ligne avec le message personnalisé
                outputLines.push(line + ',' + personalizedMessage);

            } catch (error) {
                stats.errors++;
                console.log(`[PERSONALIZED] Erreur pour la ligne ${i}: ${error.message}`);
                sendLog('error', `❌ [${stats.processed}/${stats.total}] Erreur: ${error.message}`);
                // En cas d'erreur, ajouter une ligne vide
                outputLines.push(lines[i] + ',');
            }

            // Afficher les statistiques tous les 100 lignes ou à la fin
            if (stats.processed % 100 === 0 || stats.processed === stats.total) {
                displayStats();
            }
        }

        // Générer le CSV de sortie si pas annulé
        if (!this.jobs[jobId]?.cancel) {
            fs.writeFileSync(outputCsvPath, outputLines.join('\n'), 'utf8');
            
            // Supprimer l'ancien fichier
            fs.unlinkSync(inputCsvPath);
            
            // Mettre à jour le registre avec le type "whois" et tous les paramètres
            await this.fileService.updateFileLineCount(outputCsvName);
            await this.fileService.removeFileFromRegistry(inputCsvName);
            
            // Ajouter le nouveau fichier au registre avec le type "whois"
            const fileStats = fs.statSync(outputCsvPath);
            const registryEntry = {
                name: outputCsvName,
                size: fileStats.size,
                totalLines: stats.total + 1, // +1 pour l'en-tête
                category: 'output',
                type: 'whois',
                isWhois: true,
                isPersonalized: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                messageTemplate: messageTemplate,
                messagesGenerated: stats.messagesGenerated,
                emptyMessages: stats.emptyMessages
            };
            
            await this.fileService.addFileToRegistry(registryEntry);

            // Statistiques finales
            console.log('\n' + '🎉 TRAITEMENT TERMINÉ ' + '🎉'.repeat(10));
            displayStats();
            console.log(`📁 Fichier généré: ${outputCsvName}`);
            sendLog('done', `Fichier avec messages personnalisés généré : ${outputCsvName}`);
            console.log(`[PERSONALIZED] Fichier avec messages personnalisés généré : ${outputCsvName}`);
        } else {
            console.log(`[PERSONALIZED] Traitement annulé pour jobId=${jobId}`);
        }

        delete this.jobs[jobId];
        console.log(`[PERSONALIZED] Fin du jobId=${jobId}`);
    }

    // Pour l'annulation
    cancelJob(jobId) {
        if (this.jobs[jobId]) {
            this.jobs[jobId].cancel = true;
        }
    }

    // Méthode pour vérifier si un fichier est éligible pour ce service
    isEligibleFile(fileName) {
        return fileName.includes('_whois.csv');
    }
}

module.exports = PersonalizedMessageService; 