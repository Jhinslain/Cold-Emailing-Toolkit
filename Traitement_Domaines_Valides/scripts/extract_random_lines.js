const fs = require('fs');
const path = require('path');

// Obtenir le répertoire courant pour ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin vers le fichier source (corrigé)
const inputFile = path.join(__dirname, '..', 'output', 'domaines_filtres_date.csv');
const outputFile = path.join(__dirname, '..', 'output', 'domaines_filtres_100_lignes.csv');

// Fonction pour lire le fichier et extraire 100 lignes aléatoires
function extractRandomLines(inputPath, outputPath, numLines = 100) {
    try {
        console.log('Lecture du fichier source...');
        console.log(`📁 Fichier source: ${inputPath}`);
        
        // Vérifier que le fichier source existe
        if (!fs.existsSync(inputPath)) {
            console.error(`❌ Fichier source non trouvé: ${inputPath}`);
            return;
        }
        
        // Lire tout le fichier
        const fileContent = fs.readFileSync(inputPath, 'utf8');
        const lines = fileContent.split('\n');
        
        console.log(`Fichier lu: ${lines.length} lignes au total`);
        
        // Séparer l'en-tête du reste des données
        const header = lines[0];
        const dataLines = lines.slice(1).filter(line => line.trim() !== '');
        
        console.log(`Données (sans en-tête): ${dataLines.length} lignes`);
        
        // Mélanger les lignes de données
        const shuffledLines = [...dataLines].sort(() => Math.random() - 0.5);
        
        // Prendre les 100 premières lignes (ou moins si le fichier a moins de 100 lignes)
        const selectedLines = shuffledLines.slice(0, Math.min(numLines, shuffledLines.length));
        
        // Combiner l'en-tête avec les lignes sélectionnées
        const outputContent = [header, ...selectedLines].join('\n');
        
        // Créer le dossier output s'il n'existe pas
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Écrire le fichier de sortie
        fs.writeFileSync(outputPath, outputContent, 'utf8');
        
        console.log(`✅ Fichier créé avec succès: ${outputPath}`);
        console.log(`📊 Statistiques:`);
        console.log(`   - En-tête: 1 ligne`);
        console.log(`   - Données extraites: ${selectedLines.length} lignes`);
        console.log(`   - Total: ${selectedLines.length + 1} lignes`);
        
        // Afficher un aperçu des premières lignes
        console.log('\n📋 Aperçu des premières lignes:');
        const previewLines = outputContent.split('\n').slice(0, 5);
        previewLines.forEach((line, index) => {
            console.log(`${index + 1}: ${line}`);
        });
        
    } catch (error) {
        console.error('❌ Erreur lors du traitement:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Exécuter l'extraction
console.log('🚀 Début de l\'extraction de 100 lignes aléatoires...');
extractRandomLines(inputFile, outputFile, 100); 