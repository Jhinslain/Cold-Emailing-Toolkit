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
        console.log('1. 📅 Télécharger les fichiers quotidiens (7 derniers jours)');
        console.log('2. 🚀 Traitement des domaines valides (Opendata Afnic)');
        console.log('3. 📊 Lancement de l\'analyse détaillée');
        console.log('4. 📅 Filtrer par date d\'achat');
        console.log('5. 🗺️ Filtrer par localisation');
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
                console.log('\n📅 Lancement du téléchargement des fichiers quotidiens...\n');
                await downloadDailyFiles();
                break;
                
            case '2':
                console.log('\n🚀 Lancement du traitement des domaines valides...\n');
                console.log('📋 Ce traitement filtre les domaines .fr de l\'opendata AFNIC');
                console.log('📅 Il traite les domaines plus anciens (opendata mensuel)');
                console.log('✅ Il garde seulement les domaines actifs (sans date de retrait)\n');
                runScript('domain_valide.cjs');
                break;
                
            case '3':
                console.log('\n📊 Lancement de l\'analyse détaillée...\n');
                runScript('analyze_file.cjs');
                break;
                
            case '4':
                console.log('\n📅 Lancement du filtrage par date...\n');
                await filterByDateWithPeriod();
                break;
                
            case '5':
                console.log('\n🗺️ Lancement du filtrage par localisation...\n');
                await filterByLocationWithChoice();
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
        
        // Créer le dossier input s'il n'existe pas
        const inputDir = path.join(__dirname, '..', 'input');
        if (!fs.existsSync(inputDir)) {
            fs.mkdirSync(inputDir, { recursive: true });
            console.log('📁 Dossier input créé');
        }
        
        // Lister les fichiers CSV dans le dossier input
        const inputFiles = fs.readdirSync(inputDir)
            .filter(file => file.toLowerCase().endsWith('.csv'))
            .map(file => path.join(inputDir, file));
        
        if (inputFiles.length === 0) {
            console.log('❌ Aucun fichier CSV trouvé dans le dossier input/');
            console.log('💡 Veuillez placer votre fichier CSV dans le dossier input/');
            return;
        }
        
        // Si plusieurs fichiers CSV, demander à l'utilisateur de choisir
        let inputFile;
        if (inputFiles.length === 1) {
            inputFile = inputFiles[0];
            console.log('📁 Fichier d\'entrée détecté:', path.basename(inputFile));
        } else {
            console.log('📁 Fichiers CSV disponibles dans input/:');
            inputFiles.forEach((file, index) => {
                console.log(`${index + 1}. ${path.basename(file)}`);
            });
            
            const choice = await askQuestion(`\nChoisissez le fichier (1-${inputFiles.length}): `);
            const fileIndex = parseInt(choice) - 1;
            
            if (fileIndex < 0 || fileIndex >= inputFiles.length) {
                console.log('❌ Choix invalide');
                return;
            }
            
            inputFile = inputFiles[fileIndex];
            console.log('📁 Fichier d\'entrée sélectionné:', path.basename(inputFile));
        }
        
        // Créer le dossier output s'il n'existe pas
        const outputDir = path.join(__dirname, '..', 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log('📁 Dossier output créé');
        }
        
        // Utiliser le nom du fichier d'entrée avec le suffixe _whois.csv
        const inputFileName = path.basename(inputFile, '.csv');
        const outputFileName = `${inputFileName}_whois.csv`;
        const outputFile = path.join(outputDir, outputFileName);
        console.log('📁 Fichier de sortie utilisé:', outputFileName);
        
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
        
        // Fonction pour calculer un mois spécifique
        function getMonthYYYYMM(monthsAgo = 1) {
            const now = new Date();
            now.setDate(1); // Pour éviter les problèmes de fin de mois
            now.setMonth(now.getMonth() - monthsAgo);
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            return `${y}${m}`;
        }
        
        // Fonction pour essayer de télécharger un mois spécifique
        async function tryDownloadMonth(month) {
            const zipName = `${month}_OPENDATA_A-NomsDeDomaineEnPointFr.zip`;
            const zipPath = path.join(dataDir, zipName);
            
            // Vérifier si le fichier existe déjà
            if (fs.existsSync(zipPath)) {
                console.log('📦 Archive déjà présente →', zipPath);
                return zipPath;
            }
            
            // Télécharger le fichier
            const url = `https://www.afnic.fr/wp-media/ftp/documentsOpenData/${zipName}`;
            console.log(`⬇️ Tentative de téléchargement pour ${month}:`, url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Téléchargement KO (${response.status}) - ${url}`);
            }
            
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(zipPath, buffer);
            console.log('✅ Archive téléchargée →', zipPath);
            return zipPath;
        }
        
        // Créer le dossier data s'il n'existe pas
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('📁 Dossier data créé');
        }
        
        // Demander à l'utilisateur s'il veut choisir manuellement le mois
        console.log('📅 Sélection du mois pour l\'opendata AFNIC');
        console.log('===========================================\n');
        console.log('1. 🔄 Automatique (essai des 3 derniers mois disponibles)');
        console.log('2. 📝 Manuel (choisir le mois)');
        
        const choice = await askQuestion('Votre choix (1-2): ');
        
        let zipPath;
        
        if (choice === '2') {
            // Mode manuel
            const monthInput = await askQuestion('📅 Entrez le mois au format YYYYMM (ex: 202505): ');
            if (!/^\d{6}$/.test(monthInput)) {
                console.log('❌ Format invalide. Utilisez YYYYMM (ex: 202505)');
                return;
            }
            
            try {
                zipPath = await tryDownloadMonth(monthInput);
            } catch (error) {
                console.log(`❌ Impossible de télécharger ${monthInput}: ${error.message}`);
                return;
            }
        } else {
            // Mode automatique - essayer les 3 derniers mois
            console.log('\n🔄 Essai automatique des 3 derniers mois disponibles...\n');
            
            for (let i = 1; i <= 3; i++) {
                const month = getMonthYYYYMM(i);
                console.log(`📅 Tentative ${i}/3: ${month}`);
                
                try {
                    zipPath = await tryDownloadMonth(month);
                    console.log(`✅ Succès avec le mois ${month}`);
                    break;
                } catch (error) {
                    console.log(`❌ Échec pour ${month}: ${error.message}`);
                    if (i === 3) {
                        console.log('\n❌ Aucun des 3 derniers mois n\'est disponible.');
                        console.log('💡 Essayez le mode manuel avec un mois plus ancien (ex: 202504, 202503)');
                        return;
                    }
                }
            }
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

// Fonction pour compter les lignes d'un fichier
async function countLines(filePath) {
    return new Promise((resolve, reject) => {
        let lineCount = 0;
        const rl = readline.createInterface({
            input: fs.createReadStream(filePath),
            crlfDelay: Infinity
        });
        
        rl.on('line', () => {
            lineCount++;
        });
        
        rl.on('close', () => {
            resolve(lineCount);
        });
        
        rl.on('error', reject);
    });
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

// Fonction pour télécharger les fichiers quotidiens des 7 derniers jours
async function downloadDailyFiles() {
    try {
        console.log('📅 Téléchargement des fichiers quotidiens AFNIC');
        console.log('==============================================\n');
        
        // Demander le type de téléchargement
        console.log('Choisissez le type de téléchargement:');
        console.log('1. 📅 Hier uniquement');
        console.log('2. 📊 7 derniers jours (sans aujourd\'hui)');
        console.log('3. 📅 Jour spécifique (1-7 jours en arrière)\n');
        
        const downloadChoice = await askQuestion('Votre choix (1-3): ');
        
        if (!['1', '2', '3'].includes(downloadChoice)) {
            console.log('❌ Choix invalide. Veuillez choisir 1, 2 ou 3.');
            return;
        }
        
        // Créer le dossier data s'il n'existe pas
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('📁 Dossier data créé');
        }
        
        // Fonction pour générer la date au format YYYYMMDD
        function getDateYYYYMMDD(daysAgo = 0) {
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}${month}${day}`;
        }
        
        // Fonction pour télécharger un fichier quotidien
        async function downloadDailyFile(dateYYYYMMDD) {
            const fileName = `${dateYYYYMMDD}_CREA_fr.txt`;
            const filePath = path.join(dataDir, fileName);
            const url = `https://www.afnic.fr/wp-media/ftp/domaineTLD_Afnic/${fileName}`;
            
            // Vérifier si le fichier existe déjà
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const fileSizeKB = (stats.size / 1024).toFixed(2);
                console.log(`📁 Fichier déjà présent: ${fileName} - ${fileSizeKB} KB`);
                return { success: true, fileName, fileSizeKB, alreadyExists: true };
            }
            
            console.log(`⬇️ Téléchargement: ${fileName}`);
            
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const buffer = Buffer.from(await response.arrayBuffer());
                fs.writeFileSync(filePath, buffer);
                
                const fileSizeKB = (buffer.length / 1024).toFixed(2);
                console.log(`✅ Téléchargé: ${fileName} - ${fileSizeKB} KB`);
                
                return { success: true, fileName, fileSizeKB, alreadyExists: false };
            } catch (error) {
                console.log(`❌ Échec: ${fileName} - ${error.message}`);
                return { success: false, fileName, error: error.message };
            }
        }
        
        // Fonction pour extraire les domaines d'un fichier TXT
        async function extractDomainsFromFile(filePath, dateYYYYMMDD) {
            try {
                console.log(`📋 Extraction des domaines de ${dateYYYYMMDD}...`);
                
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                
                const domains = [];
                let inDataSection = false;
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    
                    // Détecter le début des données (après #BOF)
                    if (trimmedLine === '#BOF') {
                        inDataSection = true;
                        continue;
                    }
                    
                    // Détecter la fin des données (avant #EOF)
                    if (trimmedLine === '#EOF') {
                        break;
                    }
                    
                    // Si on est dans la section des données et que la ligne n'est pas vide
                    if (inDataSection && trimmedLine && !trimmedLine.startsWith('#')) {
                        domains.push(trimmedLine);
                    }
                }
                
                // Sauvegarder la liste des domaines dans un fichier CSV
                const domainsFileName = `${dateYYYYMMDD}_domains.csv`;
                const domainsFilePath = path.join(dataDir, domainsFileName);
                
                // Créer le contenu CSV avec en-tête
                const csvContent = 'Nom de domaine\n' + domains.map(domain => domain).join('\n');
                fs.writeFileSync(domainsFilePath, csvContent, 'utf8');
                
                console.log(`✅ ${domains.length.toLocaleString()} domaines extraits → ${domainsFileName}`);
                
                return { 
                    success: true, 
                    domainCount: domains.length, 
                    domainsFileName,
                    domains: domains 
                };
                
            } catch (error) {
                console.log(`❌ Erreur lors de l'extraction des domaines: ${error.message}`);
                return { success: false, error: error.message };
            }
        }
        
        // Déterminer le nombre de jours à télécharger selon le choix
        let daysToDownload = 1; // Par défaut hier uniquement
        let startDay = 1; // Commencer par hier (1 jour en arrière)
        let periodText = 'hier uniquement';
        
        if (downloadChoice === '2') {
            daysToDownload = 7; // 7 derniers jours
            startDay = 1; // Commencer par hier (sans aujourd'hui)
            periodText = '7 derniers jours (sans aujourd\'hui)';
        } else if (downloadChoice === '3') {
            // Jour spécifique (1-7 jours en arrière)
            const customDays = await askQuestion('📅 Combien de jours en arrière (1-7): ');
            const daysNum = parseInt(customDays);
            
            if (isNaN(daysNum) || daysNum < 1 || daysNum > 7) {
                console.log('❌ Nombre de jours invalide. Veuillez choisir entre 1 et 7.');
                return;
            }
            
            daysToDownload = 1; // Un seul jour
            startDay = daysNum; // Le jour spécifique en arrière
            periodText = `jour il y a ${daysNum} jour(s)`;
        }
        
        console.log(`🔄 Téléchargement de ${periodText}...\n`);
        
        const results = [];
        let totalSize = 0;
        let downloadedCount = 0;
        let alreadyExistsCount = 0;
        let failedCount = 0;
        
        // Télécharger selon le choix
        for (let i = startDay; i < startDay + daysToDownload; i++) {
            const dateYYYYMMDD = getDateYYYYMMDD(i);
            const result = await downloadDailyFile(dateYYYYMMDD);
            results.push(result);
            
            if (result.success) {
                if (result.alreadyExists) {
                    alreadyExistsCount++;
                    totalSize += parseFloat(result.fileSizeKB);
                } else {
                    downloadedCount++;
                    totalSize += parseFloat(result.fileSizeKB);
                }
                
                // Extraire les domaines du fichier téléchargé
                const filePath = path.join(dataDir, result.fileName);
                const extractionResult = await extractDomainsFromFile(filePath, dateYYYYMMDD);
                
                if (extractionResult.success) {
                    console.log(`📊 ${extractionResult.domainCount.toLocaleString()} domaines traités pour ${dateYYYYMMDD}`);
                }
            } else {
                failedCount++;
            }
            
            // Petit délai entre les téléchargements pour éviter de surcharger le serveur
            if (i < startDay + daysToDownload - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        console.log('\n📊 Résumé du téléchargement:');
        console.log('============================');
        console.log(`📅 Période: ${periodText}`);
        console.log(`✅ Fichiers téléchargés: ${downloadedCount}`);
        console.log(`📁 Fichiers déjà présents: ${alreadyExistsCount}`);
        console.log(`❌ Échecs: ${failedCount}`);
        console.log(`📏 Taille totale: ${totalSize.toFixed(2)} KB`);
        
        if (downloadedCount > 0 || alreadyExistsCount > 0) {
            console.log('\n📁 Fichiers disponibles dans le dossier data/');
            console.log('💡 Vous pouvez maintenant utiliser ces fichiers pour vos traitements');
        }
        
        if (failedCount > 0) {
            console.log('\n⚠️ Certains fichiers n\'ont pas pu être téléchargés');
            console.log('💡 Cela peut être normal si les fichiers ne sont pas encore disponibles');
        }
        
        console.log('\n🎉 Téléchargement terminé!');
        rl.close();
        
    } catch (error) {
        console.error('❌ Erreur lors du téléchargement:', error.message);
        rl.close();
        process.exit(1);
    }
}

// Nouvelle fonction pour le filtrage par localisation avec choix
async function filterByLocationWithChoice() {
    try {
        console.log('🗺️ Filtrage des domaines par localisation');
        console.log('==========================================\n');
        
        // Créer le dossier input s'il n'existe pas
        const inputDir = path.join(__dirname, '..', 'input');
        if (!fs.existsSync(inputDir)) {
            fs.mkdirSync(inputDir, { recursive: true });
            console.log('📁 Dossier input créé');
        }
        
        // Lister les fichiers CSV dans le dossier input
        const inputFiles = fs.readdirSync(inputDir)
            .filter(file => file.toLowerCase().endsWith('.csv'))
            .map(file => path.join(inputDir, file));
        
        if (inputFiles.length === 0) {
            console.log('❌ Aucun fichier CSV trouvé dans le dossier input/');
            console.log('💡 Veuillez placer votre fichier CSV dans le dossier input/');
            return;
        }
        
        // Si plusieurs fichiers CSV, demander à l'utilisateur de choisir
        let inputFile;
        if (inputFiles.length === 1) {
            inputFile = inputFiles[0];
            console.log('📁 Fichier d\'entrée détecté:', path.basename(inputFile));
        } else {
            console.log('📁 Fichiers CSV disponibles dans input/:');
            inputFiles.forEach((file, index) => {
                console.log(`${index + 1}. ${path.basename(file)}`);
            });
            
            const choice = await askQuestion(`\nChoisissez le fichier (1-${inputFiles.length}): `);
            const fileIndex = parseInt(choice) - 1;
            
            if (fileIndex < 0 || fileIndex >= inputFiles.length) {
                console.log('❌ Choix invalide');
                return;
            }
            
            inputFile = inputFiles[fileIndex];
            console.log('📁 Fichier d\'entrée sélectionné:', path.basename(inputFile));
        }
        
        // Créer le dossier output s'il n'existe pas
        const outputDir = path.join(__dirname, '..', 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log('📁 Dossier output créé');
        }
        
        // Demander le type de filtrage
        console.log('\n🗺️ Choisissez le type de filtrage:');
        console.log('1. 🏢  Ville ');
        console.log('2. 📮  Département ');
        console.log('3. 🌍  Région ');
        
        const filterChoice = await askQuestion('\nVotre choix (1-3): ');
        
        let filterType, filterValue, filterDescription;
        
        switch (filterChoice) {
            case '1':
                filterType = 'ville';
                filterValue = await askQuestion('🏢 Entrez le nom de la ville: ');
                filterDescription = `ville "${filterValue}"`;
                break;
                
            case '2':
                filterType = 'departement';
                filterValue = await askQuestion('📮 Entrez le numéro du département (ex: 13): ');
                if (!/^\d{1,2}$/.test(filterValue)) {
                    console.log('❌ Format invalide. Utilisez un numéro de département (ex: 13, 75, 06)');
                    return;
                }
                filterDescription = `département ${filterValue}`;
                break;
                
            case '3':
                filterType = 'region';
                filterValue = await askQuestion('🌍 Entrez le nom de la région: ');
                filterDescription = `région "${filterValue}"`;
                break;
                
            default:
                console.log('❌ Choix invalide. Veuillez choisir 1, 2 ou 3.');
                return;
        }
        
        if (!filterValue || filterValue.trim() === '') {
            console.log('❌ Valeur de filtrage vide');
            return;
        }
        
        // Générer le nom du fichier de sortie
        const inputFileName = path.basename(inputFile, '.csv');
        const outputFileName = `${inputFileName}_filtre_${filterType}_${filterValue.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
        const outputFile = path.join(outputDir, outputFileName);
        
        console.log(`\n✅ Configuration du filtrage:`);
        console.log(`   📁 Fichier d'entrée: ${path.basename(inputFile)}`);
        console.log(`   🗺️ Type: ${filterDescription}`);
        console.log(`   📁 Fichier de sortie: ${outputFileName}`);
        
        console.log('\n🚀 Lancement du filtrage...\n');
        
        // Lancer le script filter_by_location.cjs
        runScript('filter_by_location.cjs', [inputFile, outputFile, filterType, filterValue]);
        
    } catch (error) {
        console.error('❌ Erreur lors du filtrage par localisation:', error.message);
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