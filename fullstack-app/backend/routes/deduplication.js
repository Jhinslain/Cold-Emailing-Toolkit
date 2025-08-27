const express = require('express');
const router = express.Router();
const DeduplicationService = require('../services/deduplicationService');
const path = require('path');
const fs = require('fs');

// Initialiser le service de déduplication
const deduplicationService = new DeduplicationService();

/**
 * POST /api/deduplication/process-file
 * Traite un fichier CSV pour enlever les doublons d'emails
 */
router.post('/process-file', async (req, res) => {
    try {
        const { inputFileName, outputDir } = req.body;
        
        if (!inputFileName) {
            return res.status(400).json({
                success: false,
                error: 'Nom du fichier d\'entrée requis'
            });
        }

        // Construire le chemin complet du fichier d'entrée
        const inputFilePath = path.join(__dirname, '../data', inputFileName);
        
        // Vérifier que le fichier existe
        if (!fs.existsSync(inputFilePath)) {
            return res.status(404).json({
                success: false,
                error: `Fichier introuvable: ${inputFileName}`
            });
        }

        console.log(`🚀 [API] Début de la déduplication pour: ${inputFileName}`);
        
        // Traiter le fichier
        const result = await deduplicationService.processCsvFile(inputFilePath, outputDir);
        
        console.log(`✅ [API] Déduplication terminée pour: ${inputFileName}`);
        
        res.json({
            success: true,
            message: 'Déduplication terminée avec succès',
            result: result
        });

    } catch (error) {
        console.error('❌ [API] Erreur lors de la déduplication:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Erreur lors de la déduplication'
        });
    }
});

/**
 * POST /api/deduplication/process-file-stream
 * Traite un fichier CSV avec streaming pour les gros fichiers
 */
router.post('/process-file-stream', async (req, res) => {
    try {
        const { inputFileName, outputDir } = req.body;
        
        if (!inputFileName) {
            return res.status(400).json({
                success: false,
                error: 'Nom du fichier d\'entrée requis'
            });
        }

        // Construire le chemin complet du fichier d'entrée
        const inputFilePath = path.join(__dirname, '../data', inputFileName);
        
        // Vérifier que le fichier existe
        if (!fs.existsSync(inputFilePath)) {
            return res.status(404).json({
                success: false,
                error: `Fichier introuvable: ${inputFileName}`
            });
        }

        console.log(`🚀 [API] Début de la déduplication streaming pour: ${inputFileName}`);
        
        // Configurer les en-têtes pour le streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // Envoyer un événement de début
        res.write('data: {"type": "start", "message": "Début de la déduplication..."}\n\n');
        
        // Traiter le fichier avec streaming
        const result = await deduplicationService.processCsvFile(inputFilePath, outputDir);
        
        // Envoyer le résultat final
        res.write(`data: {"type": "complete", "result": ${JSON.stringify(result)}}\n\n`);
        res.write('data: {"type": "end"}\n\n');
        
        res.end();

    } catch (error) {
        console.error('❌ [API] Erreur lors de la déduplication streaming:', error);
        
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: error.message || 'Erreur lors de la déduplication'
            });
        } else {
            res.write(`data: {"type": "error", "error": "${error.message}"}\n\n`);
            res.write('data: {"type": "end"}\n\n');
            res.end();
        }
    }
});

/**
 * GET /api/deduplication/stats
 * Récupère les statistiques de déduplication
 */
router.get('/stats', async (req, res) => {
    try {
        const dataDir = path.join(__dirname, '../data');
        const files = fs.readdirSync(dataDir);
        
        // Compter les fichiers de déduplication
        const dedupFiles = files.filter(file => file.includes('_deduplicated'));
        const totalFiles = files.length;
        
        res.json({
            success: true,
            stats: {
                totalFiles,
                deduplicationFiles: dedupFiles.length,
                deduplicationFilesList: dedupFiles
            }
        });

    } catch (error) {
        console.error('❌ [API] Erreur lors de la récupération des stats:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Erreur lors de la récupération des statistiques'
        });
    }
});

/**
 * GET /api/deduplication/files
 * Liste les fichiers disponibles pour la déduplication
 */
router.get('/files', async (req, res) => {
    try {
        const dataDir = path.join(__dirname, '../data');
        const files = fs.readdirSync(dataDir);
        
        // Filtrer les fichiers CSV (exclure les fichiers déjà dédupliqués)
        const csvFiles = files
            .filter(file => file.endsWith('.csv') && !file.includes('_deduplicated'))
            .map(file => {
                const filePath = path.join(dataDir, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    size: stats.size,
                    modified: stats.mtime,
                    path: filePath
                };
            })
            .sort((a, b) => b.modified - a.modified); // Plus récents en premier
        
        res.json({
            success: true,
            files: csvFiles
        });

    } catch (error) {
        console.error('❌ [API] Erreur lors de la récupération des fichiers:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Erreur lors de la récupération des fichiers'
        });
    }
});

module.exports = router;
