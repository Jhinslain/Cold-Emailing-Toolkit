const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const INPUT_FILE = path.join(__dirname, '..', 'data', 'data_extrait.csv');

async function analyzeFile() {
    console.log('📊 Analyse détaillée du fichier de domaines');
    console.log('==========================================\n');
    
    if (!fs.existsSync(INPUT_FILE)) {
        console.log('❌ Fichier d\'entrée non trouvé:', INPUT_FILE);
        console.log('📁 Placez votre fichier CSV dans le dossier "data" avec le nom "data_extrait.csv"');
        return;
    }
    
    try {
        const stats = fs.statSync(INPUT_FILE);
        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
        
        console.log(`📁 Fichier: ${INPUT_FILE}`);
        console.log(`📏 Taille: ${fileSizeMB} MB\n`);
        
        // Analyser le fichier
        const analysis = await performAnalysis(INPUT_FILE);
        
        // Afficher les résultats
        displayResults(analysis);
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'analyse:', error);
    }
}

// Fonction pour parser une date au format dd-mm-yyyy
function parseDate(dateString) {
    if (!dateString || dateString.trim() === '') {
        return null;
    }
    
    // Nettoyer la chaîne
    const cleanDate = dateString.trim();
    
    // Vérifier le format dd-mm-yyyy
    const dateRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
    const match = cleanDate.match(dateRegex);
    
    if (match) {
        const [, day, month, year] = match;
        // Créer la date (attention: mois est 0-indexé en JavaScript)
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        // Vérifier que la date est valide
        if (date.getFullYear() === parseInt(year) && 
            date.getMonth() === parseInt(month) - 1 && 
            date.getDate() === parseInt(day)) {
            return date;
        }
    }
    
    return null;
}

async function performAnalysis(filePath) {
    console.log('🔍 Analyse en cours...\n');
    
    const analysis = {
        totalLines: 0,
        validDomains: 0,
        invalidDomains: 0,
        providers: new Map(),
        monthlyStats: new Map(),
        dailyStats: new Map(),
        columns: [],
        providerColumnIndex: -1,
        creationDateColumnIndex: -1,
        withdrawalDateColumnIndex: -1
    };
    
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: 'utf8' }),
        crlfDelay: Infinity
    });
    
    for await (const line of rl) {
        analysis.totalLines++;
        
        if (analysis.totalLines === 1) {
            // Analyser l'en-tête
            analysis.columns = line.split(';').map(col => col.replace(/^"|"$/g, ''));
            console.log('📋 Colonnes détectées:');
            analysis.columns.forEach((col, index) => {
                console.log(`   ${index}: ${col}`);
            });
            console.log('');
            
            // Trouver les indices des colonnes importantes
            analysis.providerColumnIndex = analysis.columns.findIndex(col => 
                col.toLowerCase().includes('nom be') || 
                col.toLowerCase().includes('fournisseur') ||
                col.toLowerCase().includes('registrar') ||
                col.toLowerCase().includes('provider') ||
                col.toLowerCase().includes('hébergeur') ||
                col.toLowerCase().includes('hosting') ||
                col.toLowerCase().includes('nom') && col.toLowerCase().includes('be')
            );
            
            analysis.creationDateColumnIndex = analysis.columns.findIndex(col => 
                col.toLowerCase().includes('date de création') ||
                col.toLowerCase().includes('creation date')
            );
            
            analysis.withdrawalDateColumnIndex = analysis.columns.findIndex(col => 
                col.toLowerCase().includes('date de retrait') ||
                col.toLowerCase().includes('withdrawal date')
            );
            
            console.log('🔍 Colonnes identifiées:');
            console.log(`   Fournisseur: colonne ${analysis.providerColumnIndex} (${analysis.columns[analysis.providerColumnIndex] || 'Non trouvée'})`);
            console.log(`   Date de création: colonne ${analysis.creationDateColumnIndex} (${analysis.columns[analysis.creationDateColumnIndex] || 'Non trouvée'})`);
            console.log(`   Date de retrait: colonne ${analysis.withdrawalDateColumnIndex} (${analysis.columns[analysis.withdrawalDateColumnIndex] || 'Non trouvée'})`);
            console.log('');
            
            continue;
        }
        
        // Analyser chaque ligne
        const columns = line.split(';').map(col => col.replace(/^"|"$/g, ''));
        
        // Vérifier la validité du domaine (date de retrait)
        const withdrawalDate = analysis.withdrawalDateColumnIndex >= 0 ? 
            columns[analysis.withdrawalDateColumnIndex] : columns[11];
        if (!withdrawalDate || withdrawalDate.trim() === '') {
            analysis.validDomains++;
        } else {
            analysis.invalidDomains++;
        }
        
        // Analyser le fournisseur
        const provider = analysis.providerColumnIndex >= 0 ? 
            (columns[analysis.providerColumnIndex] || 'Inconnu') : 
            (columns[8] || 'Inconnu');
        analysis.providers.set(provider, (analysis.providers.get(provider) || 0) + 1);
        
        // Analyser la date de création
        const creationDate = analysis.creationDateColumnIndex >= 0 ? 
            columns[analysis.creationDateColumnIndex] : columns[9];
        
        if (creationDate && creationDate.trim() !== '') {
            const parsedDate = parseDate(creationDate);
            if (parsedDate) {
                // Statistiques par mois (YYYY-MM)
                const monthKey = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
                analysis.monthlyStats.set(monthKey, (analysis.monthlyStats.get(monthKey) || 0) + 1);
                
                // Statistiques par jour (YYYY-MM-DD)
                const dayKey = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
                analysis.dailyStats.set(dayKey, (analysis.dailyStats.get(dayKey) || 0) + 1);
            }
        }
        
        // Afficher le progrès tous les 100k lignes
        if (analysis.totalLines % 1000000 === 0) {
            console.log(`📈 ${analysis.totalLines.toLocaleString()} lignes analysées...`);
        }
    }
    
    return analysis;
}

function displayResults(analysis) {
    console.log('📊 RÉSULTATS DE L\'ANALYSE');
    console.log('==========================\n');
    
    // Statistiques générales
    console.log('📈 STATISTIQUES GÉNÉRALES');
    console.log('--------------------------');
    console.log(`📊 Nombre total de lignes: ${analysis.totalLines.toLocaleString()}`);
    console.log(`✅ Domaines valides: ${analysis.validDomains.toLocaleString()} (${((analysis.validDomains / analysis.totalLines) * 100).toFixed(2)}%)`);
    console.log(`❌ Domaines invalides: ${analysis.invalidDomains.toLocaleString()} (${((analysis.invalidDomains / analysis.totalLines) * 100).toFixed(2)}%)`);
    console.log('');
    
    // Top 10 des fournisseurs
    console.log('🏢 TOP 10 DES FOURNISSEURS');
    console.log('---------------------------');
    const sortedProviders = Array.from(analysis.providers.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    sortedProviders.forEach(([provider, count], index) => {
        const percentage = ((count / analysis.totalLines) * 100).toFixed(2);
        console.log(`${index + 1}. ${provider}: ${count.toLocaleString()} domaines (${percentage}%)`);
    });
    console.log('');
    
    // Statistiques par mois (top 12)
    console.log('📅 STATISTIQUES PAR MOIS (TOP 12)');
    console.log('----------------------------------');
    const sortedMonths = Array.from(analysis.monthlyStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);
    
    sortedMonths.forEach(([month, count], index) => {
        const [year, monthNum] = month.split('-');
        const monthName = new Date(year, monthNum - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        console.log(`${index + 1}. ${monthName}: ${count.toLocaleString()} domaines`);
    });
    console.log('');
    
    // Statistiques par jour (top 10)
    console.log('📅 STATISTIQUES PAR JOUR (TOP 10)');
    console.log('----------------------------------');
    const sortedDays = Array.from(analysis.dailyStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    sortedDays.forEach(([day, count], index) => {
        const [year, month, dayNum] = day.split('-');
        const date = new Date(year, month - 1, dayNum);
        const formattedDate = date.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        console.log(`${index + 1}. ${formattedDate}: ${count.toLocaleString()} domaines`);
    });
    console.log('');
    
    // Statistiques complètes par fournisseur
    console.log('📋 STATISTIQUES COMPLÈTES PAR FOURNISSEUR');
    console.log('------------------------------------------');
    const allProviders = Array.from(analysis.providers.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    console.log(`Total: ${analysis.providers.size} fournisseurs différents (affichage des 10 premiers)\n`);
    
    allProviders.forEach(([provider, count], index) => {
        const percentage = ((count / analysis.totalLines) * 100).toFixed(2);
        console.log(`${String(index + 1).padStart(3, '0')}. ${provider.padEnd(30)} | ${count.toString().padStart(8)} | ${percentage.padStart(6)}%`);
    });
    console.log('');
    
    // Calculer et afficher les statistiques moyennes
    displayAverageStats(analysis);
    
    // Sauvegarder les résultats dans un fichier
    saveResultsToFile(analysis);
}

function displayAverageStats(analysis) {
    console.log('📊 STATISTIQUES MOYENNES');
    console.log('========================\n');
    
    // Calculer les moyennes
    const totalDomainsWithDate = Array.from(analysis.dailyStats.values()).reduce((sum, count) => sum + count, 0);
    const totalDays = analysis.dailyStats.size;
    const totalMonths = analysis.monthlyStats.size;
    const totalYears = new Set(Array.from(analysis.monthlyStats.keys()).map(month => month.split('-')[0])).size;
    
    // Moyennes
    const avgPerDay = totalDays > 0 ? (totalDomainsWithDate / totalDays).toFixed(2) : '0.00';
    const avgPerMonth = totalMonths > 0 ? (totalDomainsWithDate / totalMonths).toFixed(2) : '0.00';
    const avgPerYear = totalYears > 0 ? (totalDomainsWithDate / totalYears).toFixed(2) : '0.00';
    
    // Période couverte
    const allDates = Array.from(analysis.dailyStats.keys()).sort();
    const firstDate = allDates[0];
    const lastDate = allDates[allDates.length - 1];
    
    let periodInfo = '';
    if (firstDate && lastDate) {
        const [firstYear, firstMonth, firstDay] = firstDate.split('-');
        const [lastYear, lastMonth, lastDay] = lastDate.split('-');
        const startDate = new Date(firstYear, firstMonth - 1, firstDay);
        const endDate = new Date(lastYear, lastMonth - 1, lastDay);
        
        const startFormatted = startDate.toLocaleDateString('fr-FR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const endFormatted = endDate.toLocaleDateString('fr-FR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        periodInfo = ` (du ${startFormatted} au ${endFormatted})`;
    }
    
    console.log('📅 PÉRIODE ANALYSÉE');
    console.log('-------------------');
    console.log(`📊 Domaines avec date de création: ${totalDomainsWithDate.toLocaleString()}`);
    console.log(`📅 Période couverte: ${totalDays} jours${periodInfo}`);
    console.log(`📅 Nombre de mois: ${totalMonths}`);
    console.log(`📅 Nombre d'années: ${totalYears}`);
    console.log('');
    
    console.log('📈 MOYENNES');
    console.log('-----------');
    console.log(`📊 Moyenne par jour: ${avgPerDay} domaines`);
    console.log(`📊 Moyenne par mois: ${avgPerMonth} domaines`);
    console.log(`📊 Moyenne par année: ${avgPerYear} domaines`);
    console.log('');
    
    // Statistiques détaillées par année
    if (totalYears > 0) {
        console.log('📅 STATISTIQUES PAR ANNÉE');
        console.log('-------------------------');
        
        const yearlyStats = new Map();
        Array.from(analysis.monthlyStats.entries()).forEach(([month, count]) => {
            const year = month.split('-')[0];
            yearlyStats.set(year, (yearlyStats.get(year) || 0) + count);
        });
        
        const sortedYears = Array.from(yearlyStats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        
        sortedYears.forEach(([year, count]) => {
            const avgPerMonthInYear = (count / 12).toFixed(2);
            const avgPerDayInYear = (count / 365).toFixed(2);
            console.log(`${year}: ${count.toLocaleString()} domaines (${avgPerMonthInYear}/mois, ${avgPerDayInYear}/jour)`);
        });
        console.log('');
    }
    
    // Top 5 des jours les plus actifs
    if (totalDays > 0) {
        console.log('🔥 TOP 5 DES JOURS LES PLUS ACTIFS');
        console.log('----------------------------------');
        const topDays = Array.from(analysis.dailyStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        topDays.forEach(([day, count], index) => {
            const [year, month, dayNum] = day.split('-');
            const date = new Date(year, month - 1, dayNum);
            const formattedDate = date.toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const timesAboveAverage = (count / parseFloat(avgPerDay)).toFixed(1);
            console.log(`${index + 1}. ${formattedDate}: ${count.toLocaleString()} domaines (${timesAboveAverage}x la moyenne)`);
        });
        console.log('');
    }
}

function saveResultsToFile(analysis) {
    const outputDir = path.join(__dirname, '..', 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const outputFile = path.join(outputDir, `analyse_${timestamp}.txt`);
    
    let content = '📊 ANALYSE DÉTAILLÉE DU FICHIER DE DOMAINES\n';
    content += '=============================================\n\n';
    
    // Statistiques générales
    content += '📈 STATISTIQUES GÉNÉRALES\n';
    content += '--------------------------\n';
    content += `📊 Nombre total de lignes: ${analysis.totalLines.toLocaleString()}\n`;
    content += `✅ Domaines valides: ${analysis.validDomains.toLocaleString()} (${((analysis.validDomains / analysis.totalLines) * 100).toFixed(2)}%)\n`;
    content += `❌ Domaines invalides: ${analysis.invalidDomains.toLocaleString()} (${((analysis.invalidDomains / analysis.totalLines) * 100).toFixed(2)}%)\n\n`;
    
    // Tous les fournisseurs
    content += '🏢 STATISTIQUES COMPLÈTES PAR FOURNISSEUR\n';
    content += '------------------------------------------\n';
    const allProviders = Array.from(analysis.providers.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    content += `Total: ${analysis.providers.size} fournisseurs différents (affichage des 10 premiers)\n\n`;
    
    allProviders.forEach(([provider, count], index) => {
        const percentage = ((count / analysis.totalLines) * 100).toFixed(2);
        content += `${String(index + 1).padStart(3, '0')}. ${provider.padEnd(30)} | ${count.toString().padStart(8)} | ${percentage.padStart(6)}%\n`;
    });
    content += '\n';
    
    // Statistiques par mois
    content += '📅 STATISTIQUES PAR MOIS\n';
    content += '------------------------\n';
    const sortedMonths = Array.from(analysis.monthlyStats.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    sortedMonths.forEach(([month, count]) => {
        const [year, monthNum] = month.split('-');
        const monthName = new Date(year, monthNum - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        content += `${monthName}: ${count.toLocaleString()} domaines\n`;
    });
    content += '\n';
    
    // Statistiques par jour (top 50)
    content += '📅 STATISTIQUES PAR JOUR (TOP 50)\n';
    content += '---------------------------------\n';
    const sortedDays = Array.from(analysis.dailyStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50);
    
    sortedDays.forEach(([day, count], index) => {
        const [year, month, dayNum] = day.split('-');
        const date = new Date(year, month - 1, dayNum);
        const formattedDate = date.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        content += `${index + 1}. ${formattedDate}: ${count.toLocaleString()} domaines\n`;
    });
    
    // Ajouter les statistiques moyennes au fichier
    content += '\n📊 STATISTIQUES MOYENNES\n';
    content += '========================\n\n';
    
    // Calculer les moyennes
    const totalDomainsWithDate = Array.from(analysis.dailyStats.values()).reduce((sum, count) => sum + count, 0);
    const totalDays = analysis.dailyStats.size;
    const totalMonths = analysis.monthlyStats.size;
    const totalYears = new Set(Array.from(analysis.monthlyStats.keys()).map(month => month.split('-')[0])).size;
    
    // Moyennes
    const avgPerDay = totalDays > 0 ? (totalDomainsWithDate / totalDays).toFixed(2) : '0.00';
    const avgPerMonth = totalMonths > 0 ? (totalDomainsWithDate / totalMonths).toFixed(2) : '0.00';
    const avgPerYear = totalYears > 0 ? (totalDomainsWithDate / totalYears).toFixed(2) : '0.00';
    
    // Période couverte
    const allDates = Array.from(analysis.dailyStats.keys()).sort();
    const firstDate = allDates[0];
    const lastDate = allDates[allDates.length - 1];
    
    let periodInfo = '';
    if (firstDate && lastDate) {
        const [firstYear, firstMonth, firstDay] = firstDate.split('-');
        const [lastYear, lastMonth, lastDay] = lastDate.split('-');
        const startDate = new Date(firstYear, firstMonth - 1, firstDay);
        const endDate = new Date(lastYear, lastMonth - 1, lastDay);
        
        const startFormatted = startDate.toLocaleDateString('fr-FR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const endFormatted = endDate.toLocaleDateString('fr-FR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        periodInfo = ` (du ${startFormatted} au ${endFormatted})`;
    }
    
    content += '📅 PÉRIODE ANALYSÉE\n';
    content += '-------------------\n';
    content += `📊 Domaines avec date de création: ${totalDomainsWithDate.toLocaleString()}\n`;
    content += `📅 Période couverte: ${totalDays} jours${periodInfo}\n`;
    content += `📅 Nombre de mois: ${totalMonths}\n`;
    content += `📅 Nombre d'années: ${totalYears}\n\n`;
    
    content += '📈 MOYENNES\n';
    content += '-----------\n';
    content += `📊 Moyenne par jour: ${avgPerDay} domaines\n`;
    content += `📊 Moyenne par mois: ${avgPerMonth} domaines\n`;
    content += `📊 Moyenne par année: ${avgPerYear} domaines\n\n`;
    
    // Statistiques détaillées par année
    if (totalYears > 0) {
        content += '📅 STATISTIQUES PAR ANNÉE\n';
        content += '-------------------------\n';
        
        const yearlyStats = new Map();
        Array.from(analysis.monthlyStats.entries()).forEach(([month, count]) => {
            const year = month.split('-')[0];
            yearlyStats.set(year, (yearlyStats.get(year) || 0) + count);
        });
        
        const sortedYears = Array.from(yearlyStats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        
        sortedYears.forEach(([year, count]) => {
            const avgPerMonthInYear = (count / 12).toFixed(2);
            const avgPerDayInYear = (count / 365).toFixed(2);
            content += `${year}: ${count.toLocaleString()} domaines (${avgPerMonthInYear}/mois, ${avgPerDayInYear}/jour)\n`;
        });
        content += '\n';
    }
    
    // Top 10 des jours les plus actifs
    if (totalDays > 0) {
        content += '🔥 TOP 10 DES JOURS LES PLUS ACTIFS\n';
        content += '-----------------------------------\n';
        const topDays = Array.from(analysis.dailyStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        topDays.forEach(([day, count], index) => {
            const [year, month, dayNum] = day.split('-');
            const date = new Date(year, month - 1, dayNum);
            const formattedDate = date.toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const timesAboveAverage = (count / parseFloat(avgPerDay)).toFixed(1);
            content += `${index + 1}. ${formattedDate}: ${count.toLocaleString()} domaines (${timesAboveAverage}x la moyenne)\n`;
        });
    }
    
    fs.writeFileSync(outputFile, content, 'utf8');
    console.log(`💾 Résultats sauvegardés dans: ${outputFile}`);
}

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    console.error('❌ Erreur non capturée:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesse rejetée non gérée:', reason);
    process.exit(1);
});

// Lancer l'analyse
analyzeFile(); 