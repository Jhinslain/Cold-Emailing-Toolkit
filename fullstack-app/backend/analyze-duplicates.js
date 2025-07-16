const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

async function analyzeDuplicates() {
    console.log('🔍 Analyse des doublons dans les fichiers...\n');
    
    const dataDir = path.join(__dirname, 'data');
    
    // Fichiers à analyser (ceux qui ont été fusionnés)
    const filesToAnalyze = [
        'domaines_filtres_date_whois_15-19_05_OK_ONLY_MILLIONVERIFIER.COM.csv',
        'Emailing - Domaines_filtres_whois-29-31_05_verifier.csv'
    ];
    
    const allDomains = new Set();
    const fileStats = {};
    
    for (const filename of filesToAnalyze) {
        const filePath = path.join(dataDir, filename);
        
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ Fichier non trouvé: ${filename}`);
            continue;
        }
        
        console.log(`📄 Analyse de ${filename}...`);
        
        const domains = new Set();
        let lineCount = 0;
        
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    lineCount++;
                    const domain = row.domain || row.Domain || row.DOMAIN || row["Nom de domaine"] || row.email?.split('@')[1] || '';
                    
                    if (domain && domain.trim()) {
                        domains.add(domain.trim());
                        allDomains.add(domain.trim());
                    }
                })
                .on('end', () => {
                    fileStats[filename] = {
                        totalLines: lineCount,
                        uniqueDomains: domains.size,
                        duplicateLines: lineCount - domains.size
                    };
                    resolve();
                })
                .on('error', reject);
        });
        
        console.log(`   📊 Lignes totales: ${lineCount.toLocaleString()}`);
        console.log(`   📊 Domaines uniques: ${domains.size.toLocaleString()}`);
        console.log(`   📊 Doublons internes: ${(lineCount - domains.size).toLocaleString()}`);
    }
    
    console.log('\n📊 Statistiques globales:');
    console.log(`📊 Total domaines uniques: ${allDomains.size.toLocaleString()}`);
    
    let totalLines = 0;
    Object.entries(fileStats).forEach(([filename, stats]) => {
        totalLines += stats.totalLines;
        console.log(`📄 ${filename}: ${stats.totalLines.toLocaleString()} lignes → ${stats.uniqueDomains.toLocaleString()} domaines uniques`);
    });
    
    console.log(`\n📊 Résumé:`);
    console.log(`📊 Lignes totales: ${totalLines.toLocaleString()}`);
    console.log(`📊 Domaines uniques après fusion: ${allDomains.size.toLocaleString()}`);
    console.log(`📊 Doublons entre fichiers: ${(totalLines - allDomains.size).toLocaleString()}`);
    
    // Analyser quelques exemples de doublons
    console.log('\n🔍 Recherche d\'exemples de doublons...');
    const domainCounts = {};
    
    for (const filename of filesToAnalyze) {
        const filePath = path.join(dataDir, filename);
        
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    const domain = row.domain || row.Domain || row.DOMAIN || row["Nom de domaine"] || row.email?.split('@')[1] || '';
                    
                    if (domain && domain.trim()) {
                        domainCounts[domain.trim()] = (domainCounts[domain.trim()] || 0) + 1;
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });
    }
    
    const duplicates = Object.entries(domainCounts)
        .filter(([_, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (duplicates.length > 0) {
        console.log(`📋 Top 10 domaines en doublon:`);
        duplicates.forEach(([domain, count]) => {
            console.log(`   ${domain}: ${count} fois`);
        });
    }
}

analyzeDuplicates().catch(console.error); 