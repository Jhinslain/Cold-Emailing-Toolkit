const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const FileService = require('./fileService');

class DeduplicationService {
    constructor() {
        this.fileService = new FileService(path.join(__dirname, '../data'));
        console.log('🚀 Service de déduplication des emails initialisé');
    }

    /**
     * Traite un fichier CSV pour enlever les doublons d'emails
     * @param {string} inputFilePath - Chemin du fichier d'entrée
     * @param {string} outputDir - Dossier de sortie
     * @returns {Promise<Object>} - Résultats de la déduplication
     */
    async processCsvFile(inputFilePath, outputDir = null) {
        const startTime = Date.now();
        console.log(`🔍 Début de la déduplication pour: ${path.basename(inputFilePath)}`);
        
        try {
            // Vérifier que le fichier d'entrée existe
            if (!fs.existsSync(inputFilePath)) {
                throw new Error(`Fichier d'entrée introuvable: ${inputFilePath}`);
            }

            // Remplacer le fichier d'entrée au lieu de créer un nouveau fichier
            const outputFilePath = inputFilePath;
            const outputFileName = path.basename(inputFilePath);

            // Lire le fichier CSV et collecter les données
            const rows = [];
            const emailMap = new Map(); // Pour tracker les emails uniques
            const duplicates = new Map(); // Pour tracker les doublons
            let totalRows = 0;
            let uniqueRows = 0;
            let duplicateCount = 0;

            console.log('📖 Lecture du fichier CSV...');

            return new Promise((resolve, reject) => {
                fs.createReadStream(inputFilePath)
                    .pipe(csv())
                    .on('data', (row) => {
                        totalRows++;
                        
                        // Chercher l'email dans la ligne (colonnes possibles)
                        const email = this.extractEmailFromRow(row);
                        
                        if (email) {
                            // Normaliser l'email (minuscules, espaces)
                            const normalizedEmail = email.toLowerCase().trim();
                            
                            if (emailMap.has(normalizedEmail)) {
                                // Doublon trouvé
                                duplicateCount++;
                                if (!duplicates.has(normalizedEmail)) {
                                    duplicates.set(normalizedEmail, []);
                                }
                                duplicates.get(normalizedEmail).push({
                                    original: emailMap.get(normalizedEmail),
                                    duplicate: row
                                });
                            } else {
                                // Email unique
                                emailMap.set(normalizedEmail, row);
                                rows.push(row);
                                uniqueRows++;
                            }
                        } else {
                            // Ligne sans email valide, la garder
                            rows.push(row);
                            uniqueRows++;
                        }
                    })
                    .on('end', async () => {
                        try {
                            console.log(`📊 Analyse terminée: ${totalRows} lignes traitées`);
                            console.log(`✅ Emails uniques: ${emailMap.size}`);
                            console.log(`❌ Doublons supprimés: ${duplicateCount}`);

                            // Écrire le fichier de sortie (remplace le fichier d'entrée)
                            if (rows.length > 0) {
                                await this.writeCsvFile(rows, outputFilePath);
                                console.log(`💾 Fichier mis à jour: ${outputFilePath}`);
                                
                                // Mettre à jour le registre des fichiers avec le nouveau nombre de lignes
                                try {
                                    const stats = {
                                        duplicateCount,
                                        duration: Math.round((Date.now() - startTime) / 1000)
                                    };
                                    await this.updateFileRegistry(inputFilePath, rows.length, stats);
                                    console.log(`📋 Registre des fichiers mis à jour: ${rows.length} lignes`);
                                } catch (registryError) {
                                    console.warn(`⚠️ Erreur lors de la mise à jour du registre: ${registryError.message}`);
                                }
                            }

                            const endTime = Date.now();
                            const duration = Math.round((endTime - startTime) / 1000);

                            const result = {
                                success: true,
                                inputFile: path.basename(inputFilePath),
                                outputFile: outputFileName,
                                outputPath: outputFilePath,
                                stats: {
                                    totalRows,
                                    uniqueRows,
                                    duplicateCount,
                                    duration
                                },
                                duplicates: Array.from(duplicates.entries()).map(([email, entries]) => ({
                                    email,
                                    count: entries.length + 1, // +1 pour l'original
                                    entries: entries.map(e => ({
                                        original: e.original,
                                        duplicate: e.duplicate
                                    }))
                                }))
                            };

                            console.log(`✅ Déduplication terminée en ${duration}s`);
                            resolve(result);

                        } catch (writeError) {
                            console.error('❌ Erreur lors de l\'écriture du fichier:', writeError);
                            reject(writeError);
                        }
                    })
                    .on('error', (error) => {
                        console.error('❌ Erreur lors de la lecture du fichier:', error);
                        reject(error);
                    });
            });

        } catch (error) {
            console.error('❌ Erreur lors de la déduplication:', error);
            throw error;
        }
    }

    /**
     * Extrait l'email d'une ligne CSV en cherchant dans différentes colonnes
     * @param {Object} row - Ligne CSV
     * @returns {string|null} - Email trouvé ou null
     */
    extractEmailFromRow(row) {
        // Colonnes possibles pour les emails
        const emailColumns = [
            'email', 'Email', 'EMAIL',
            'contact_email', 'Contact_Email', 'CONTACT_EMAIL',
            'best_email', 'Best_Email', 'BEST_EMAIL',
            'email_contact', 'Email_Contact', 'EMAIL_CONTACT',
            'mail', 'Mail', 'MAIL',
            'e_mail', 'E_mail', 'E_MAIL'
        ];

        // Chercher dans les colonnes d'email
        for (const column of emailColumns) {
            if (row[column] && this.isValidEmail(row[column])) {
                return row[column];
            }
        }

        // Chercher dans toutes les colonnes pour un pattern email
        for (const [key, value] of Object.entries(row)) {
            if (value && this.isValidEmail(value)) {
                return value;
            }
        }

        return null;
    }

    /**
     * Vérifie si une chaîne est un email valide
     * @param {string} email - Email à vérifier
     * @returns {boolean} - True si email valide
     */
    isValidEmail(email) {
        if (typeof email !== 'string') return false;
        
        // Pattern simple pour email
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailPattern.test(email.trim());
    }

    /**
     * Écrit un fichier CSV avec les données dédupliquées
     * @param {Array} rows - Lignes à écrire
     * @param {string} outputPath - Chemin de sortie
     * @returns {Promise<void>}
     */
    async writeCsvFile(rows, outputPath) {
        if (rows.length === 0) {
            throw new Error('Aucune ligne à écrire');
        }

        // Créer les en-têtes à partir de la première ligne
        const headers = Object.keys(rows[0]).map(key => ({
            id: key,
            title: key
        }));

        const csvWriter = createCsvWriter({
            path: outputPath,
            header: headers
        });

        await csvWriter.writeRecords(rows);
    }

    /**
     * Met à jour le registre des fichiers avec le nouveau nombre de lignes
     * @param {string} filePath - Chemin du fichier
     * @param {number} lineCount - Nombre de lignes après déduplication
     * @returns {Promise<void>}
     */
    async updateFileRegistry(filePath, lineCount, stats) {
        try {
            const fileName = path.basename(filePath);
            const registry = this.fileService.registryService.loadRegistry();
            
            if (registry[fileName]) {
                // Mettre à jour le nombre de lignes et la date de modification
                registry[fileName].totalLines = lineCount;
                registry[fileName].modified = new Date().toISOString();
                registry[fileName].size = fs.statSync(filePath).size;
                
                // Changer le type du fichier à "deduplicated"
                registry[fileName].type = 'deduplicated';
                
                // Préserver ou créer les statistiques existantes
                if (!registry[fileName].statistiques) {
                    registry[fileName].statistiques = {};
                }
                
                // Préserver les anciennes statistiques et ajouter/mettre à jour la déduplication
                registry[fileName].statistiques = {
                    domain_lignes: registry[fileName].statistiques.domain_lignes || 0,
                    domain_temps: registry[fileName].statistiques.domain_temps || 0,
                    whois_lignes: registry[fileName].statistiques.whois_lignes || 0,
                    whois_temps: registry[fileName].statistiques.whois_temps || 0,
                    verifier_lignes: registry[fileName].statistiques.verifier_lignes || 0,
                    verifier_temps: registry[fileName].statistiques.verifier_temps || 0,
                    dedup_lignes: stats.duplicateCount,
                    dedup_temps: stats.duration
                };
                
                // Sauvegarder le registre mis à jour
                this.fileService.registryService.saveRegistry(registry);
                console.log(`📋 Registre mis à jour pour ${fileName}: ${lineCount} lignes`);
                console.log(`📊 Statistiques déduplication: ${stats.duplicateCount} lignes supprimées en ${stats.duration}s`);
                console.log(`🏷️ Type du fichier changé à: deduplicated`);
            } else {
                console.warn(`⚠️ Fichier ${fileName} non trouvé dans le registre`);
            }
        } catch (error) {
            console.error('❌ Erreur lors de la mise à jour du registre:', error);
            throw error;
        }
    }

    /**
     * Génère un rapport de déduplication détaillé
     * @param {Object} result - Résultat de la déduplication
     * @param {string} outputDir - Dossier de sortie pour le rapport
     * @returns {Promise<string>} - Chemin du rapport
     */
    async generateReport(result, outputDir = null) {
        const reportDir = outputDir || path.dirname(result.outputPath);
        const reportFileName = `deduplication_report_${Date.now()}.txt`;
        const reportPath = path.join(reportDir, reportFileName);

        const report = [
            '=== RAPPORT DE DÉDUPLICATION ===',
            '',
            `Fichier d'entrée: ${result.inputFile}`,
            `Fichier de sortie: ${result.outputFile}`,
            `Date de traitement: ${new Date().toLocaleString('fr-FR')}`,
            '',
            '=== STATISTIQUES ===',
            `Total des lignes traitées: ${result.stats.totalRows}`,
            `Lignes uniques conservées: ${result.stats.uniqueRows}`,
            `Doublons supprimés: ${result.stats.duplicateCount}`,
            `Temps de traitement: ${result.stats.duration}s`,
            '',
            '=== DÉTAIL DES DOUBLONS ==='
        ];

        if (result.duplicates.length > 0) {
            result.duplicates.forEach((dup, index) => {
                report.push(`\n${index + 1}. Email: ${dup.email}`);
                report.push(`   Nombre d'occurrences: ${dup.count}`);
                report.push('   Détails:');
                dup.entries.forEach((entry, entryIndex) => {
                    report.push(`     - Doublon ${entryIndex + 1}: ${JSON.stringify(entry.duplicate)}`);
                });
            });
        } else {
            report.push('Aucun doublon trouvé.');
        }

        report.push('\n=== FIN DU RAPPORT ===');

        try {
            fs.writeFileSync(reportPath, report.join('\n'), 'utf8');
            console.log(`📋 Rapport généré: ${reportPath}`);
            return reportPath;
        } catch (error) {
            console.error('❌ Erreur lors de la génération du rapport:', error);
            throw error;
        }
    }
}

module.exports = DeduplicationService;
