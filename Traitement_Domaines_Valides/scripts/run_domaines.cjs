const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

console.log('🌐 Traitement des domaines valides');
console.log('==================================\n');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.toLowerCase());
        });
    });
}

async function main() {
    try {
        console.log('Choisissez une option:');
        console.log('0. 📥 Télécharger l\'Opendata Afnic et l\'extraire');
        console.log('1. 🧪 Test rapide (1000 lignes)');
        console.log('2. 🚀 Traitement complet (tous les domaines)');
        console.log('3. ⚙️ Traitement avancé (avec configuration)');
        console.log('4. 📊 Lancement de l\'analyse détaillée');
        console.log('5. 📅 Filtrer par date d\'achat');
        console.log('6. 🔍 Extraction emails + numéros [WHOIS]');
        console.log('7. 🌐 Extraction emails + numéros [WHOIS + Scrap]');
        console.log('8. ❌ Quitter\n');

        const choice = await askQuestion('Votre choix (0-8): ');

        switch (choice) {
            case '0':
                console.log('\n📥 Lancement du téléchargement de l\'Opendata...\n');
                await downloadAndExtractOpendata();
                break;
                
            case '1':
                console.log('\n🧪 Lancement du test rapide...\n');
                runScript('test_domain_valide.cjs');
                break;
                
            case '2':
                console.log('\n🚀 Lancement du traitement complet...\n');
                runScript('domain_valide.cjs');
                break;
                
            case '3':
                console.log('\n⚙️ Lancement du traitement avancé...\n');
                runScript('domain_valide_advanced.cjs');
                break;
                
            case '4':
                console.log('\n📊 Lancement de l\'analyse détaillée...\n');
                runScript('analyze_file.cjs');
                break;
                
            case '5':
                console.log('\n📅 Lancement du filtrage par date...\n');
                await filterByDateWithPeriod();
                break;
                
            case '6':
                console.log('\n🔍 Lancement de l\'extraction emails WHOIS uniquement...\n');
                await processDomainsWHOISOnly();
                break;
                
            case '7':
                console.log('\n🌐 Lancement de l\'extraction WHOIS + Scrap...\n');
                await processDomainsWHOISAndScrap();
                break;
                
            case '8':
                console.log('👋 Au revoir!');
                rl.close();
                process.exit(0);
                break;
                
            default:
                console.log('❌ Choix invalide. Veuillez choisir 0, 1, 2, 3, 4, 5, 6, 7 ou 8.');
                main();
                break;
        }
    } catch (error) {
        console.error('❌ Erreur:', error);
        rl.close();
        process.exit(1);
    }
}

// Nouvelle fonction pour l'extraction WHOIS uniquement
async function processDomainsWHOISOnly() {
    try {
        console.log('🔍 Extraction des emails WHOIS uniquement');
        console.log('========================================\n');
        
        // Utiliser automatiquement le fichier domaines_filtres_lignes.csv
        const inputFile = path.join(__dirname, '..', 'output', 'domaines_filtres_date.csv');
        
        if (!fs.existsSync(inputFile)) {
            console.log('❌ Fichier d\'entrée non trouvé:', inputFile);
            console.log('Veuillez d\'abord exécuter le filtrage par date (option 5)');
            return;
        }
        
        console.log('📁 Fichier d\'entrée utilisé:', inputFile);
        
        // Utiliser automatiquement le fichier de sortie domaines_filtres_whois_only.csv
        const outputFile = path.join(__dirname, '..', 'output', 'domaines_filtres_whois_only.csv');
        console.log('📁 Fichier de sortie utilisé:', outputFile);
        
        // Utiliser automatiquement "Nom de domaine" comme colonne par défaut
        const domainColumn = 'Nom de domaine';
        console.log('📋 Colonne des domaines utilisée:', domainColumn);
        
        console.log('\n🚀 Lancement du traitement WHOIS uniquement...\n');
        
        // Lancer le script process_csv_domains.cjs avec le mode WHOIS uniquement (délai = 0)
        runScript('process_csv_domains.cjs', [inputFile, outputFile, domainColumn, '0', 'whois-only']);
        
    } catch (error) {
        console.error('❌ Erreur lors du traitement:', error.message);
        rl.close();
        process.exit(1);
    }
}

// Nouvelle fonction pour l'extraction WHOIS + Scrap
async function processDomainsWHOISAndScrap() {
    try {
        console.log('🌐 Extraction WHOIS + Scrap des domaines');
        console.log('=======================================\n');
        
        // Utiliser automatiquement le fichier domaines_filtres_100_lignes.csv
        const inputFile = path.join(__dirname, '..', 'output', 'domaines_filtres_100_lignes.csv');
        
        if (!fs.existsSync(inputFile)) {
            console.log('❌ Fichier d\'entrée non trouvé:', inputFile);
            console.log('Veuillez d\'abord exécuter le filtrage par date (option 5)');
            return;
        }
        
        console.log('📁 Fichier d\'entrée utilisé:', inputFile);
        
        // Utiliser automatiquement le fichier de sortie domaines_filtres_whois_scrap.csv
        const outputFile = path.join(__dirname, '..', 'output', 'domaines_filtres_whois_scrap.csv');
        console.log('📁 Fichier de sortie utilisé:', outputFile);
        
        // Utiliser automatiquement "Nom de domaine" comme colonne par défaut
        const domainColumn = 'Nom de domaine';
        console.log('📋 Colonne des domaines utilisée:', domainColumn);
        
        console.log('\n🚀 Lancement du traitement WHOIS + Scrap...\n');
        
        // Lancer le script process_csv_domains.cjs avec le mode WHOIS + Scrap (délai = 0)
        runScript('process_csv_domains.cjs', [inputFile, outputFile, domainColumn, '0', 'full']);
        
    } catch (error) {
        console.error('❌ Erreur lors du traitement:', error.message);
        rl.close();
        process.exit(1);
    }
}

function runScript(scriptName, args = []) {
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn('node', [scriptPath, ...args], {
        stdio: 'inherit',
        cwd: path.dirname(__dirname)
    });

    child.on('close', (code) => {
        console.log(`\n✅ Script ${scriptName} terminé avec le code: ${code}`);
        rl.close();
        process.exit(code);
    });

    child.on('error', (error) => {
        console.error(`❌ Erreur lors de l'exécution de ${scriptName}:`, error);
        rl.close();
        process.exit(1);
    });
}

// Fonction pour télécharger et extraire l'Opendata Afnic
async function downloadAndExtractOpendata() {
    try {
        const StreamZip = require('node-stream-zip');
        
        // Calcul automatique du mois précédent (N-1)
        function getPreviousMonthYYYYMM() {
            const now = new Date();
            now.setDate(1); // Pour éviter les problèmes de fin de mois
            now.setMonth(now.getMonth() - 1);
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            return `${y}${m}`;
        }

        const MONTH = getPreviousMonthYYYYMM();
        console.log(`📅 Utilisation du mois précédent : ${MONTH}`);
        
        // Créer le dossier data s'il n'existe pas
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('📁 Dossier data créé');
        }
        
        // Nom du fichier ZIP
        const zipName = `${MONTH}_OPENDATA_A-NomsDeDomaineEnPointFr.zip`;
        const zipPath = path.join(dataDir, zipName);
        
        // Vérifier si le fichier existe déjà
        if (fs.existsSync(zipPath)) {
            console.log('📦 Archive déjà présente →', zipPath);
        } else {
            // Télécharger le fichier
            const url = `https://www.afnic.fr/wp-media/ftp/documentsOpenData/${zipName}`;
            console.log('⬇️ Téléchargement', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Téléchargement KO (${response.status}) - ${url}`);
            }
            
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(zipPath, buffer);
            console.log('✅ Archive téléchargée →', zipPath);
        }
        
        // Extraire le CSV
        console.log('📂 Extraction du CSV...');
        const zip = new StreamZip.async({ file: zipPath });
        const entries = await zip.entries();
        
        // Chercher le fichier CSV dans l'archive
        const csvEntry = Object.values(entries).find((e) => /\.csv$/i.test(e.name));
        if (!csvEntry) {
            throw new Error('CSV introuvable dans l\'archive');
        }
        
        // Extraire le CSV sous le nom data_extrait.csv
        const csvExtractPath = path.join(dataDir, 'data_extrait.csv');
        await zip.extract(csvEntry.name, csvExtractPath);
        await zip.close();
        
        console.log('✅ CSV extrait →', csvExtractPath);
        
        // Afficher les statistiques du fichier extrait
        const stats = fs.statSync(csvExtractPath);
        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`📏 Taille du fichier extrait: ${fileSizeMB} MB`);
        
        // Compter les lignes
        console.log('📊 Comptage des lignes...');
        const lineCount = await countLines(csvExtractPath);
        console.log(`📊 Nombre de lignes: ${lineCount.toLocaleString()}`);
        
        console.log('🎉 Téléchargement et extraction terminés avec succès!');
        rl.close();
        
    } catch (error) {
        console.error('❌ Erreur lors du téléchargement/extraction:', error.message);
        rl.close();
        process.exit(1);
    }
}

// Nouvelle fonction pour le filtrage par date avec choix de période
async function filterByDateWithPeriod() {
    try {
        console.log('📅 Filtrage des domaines par période spécifique');
        console.log('===============================================\n');
        
        console.log('📅 Format des dates: DD-MM-YYYY (ex: 26-05-2025)');
        console.log('💡 L\'ordre des dates n\'importe pas\n');
        
        // Demander la première date
        const firstDate = await askQuestion('📅 Première date (DD-MM-YYYY): ');
        
        if (!firstDate || !/^\d{2}-\d{2}-\d{4}$/.test(firstDate)) {
            console.log('❌ Format de date invalide. Utilisez DD-MM-YYYY (ex: 26-05-2025)');
            return;
        }
        
        // Demander la deuxième date
        const secondDate = await askQuestion('📅 Deuxième date (DD-MM-YYYY): ');
        
        if (!secondDate || !/^\d{2}-\d{2}-\d{4}$/.test(secondDate)) {
            console.log('❌ Format de date invalide. Utilisez DD-MM-YYYY (ex: 30-05-2025)');
            return;
        }
        
        console.log(`\n✅ Filtrage configuré entre ${firstDate} et ${secondDate}`);
        console.log('🔄 Lancement du filtrage...\n');
        
        // Lancer le script filter_by_date.cjs avec les deux dates
        runScript('filter_by_date.cjs', [firstDate, secondDate]);
        
    } catch (error) {
        console.error('❌ Erreur lors de la configuration du filtrage:', error.message);
        rl.close();
        process.exit(1);
    }
}

// Gestion de l'interruption
process.on('SIGINT', () => {
    console.log('\n👋 Interruption détectée. Au revoir!');
    rl.close();
    process.exit(0);
});

// Lancer le programme
main(); 