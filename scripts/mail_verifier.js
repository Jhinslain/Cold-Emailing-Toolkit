const request = require('request');
const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const Bottleneck = require('bottleneck');
require('dotenv').config();

// Configuration
const API_KEY = process.env.API_MILLION_VERIFIER1;

if (!API_KEY) {
    console.error('❌ Erreur: La variable d\'environnement API_MILLION_VERIFIER n\'est pas définie');
    process.exit(1);
}

// Vérification des arguments
if (process.argv.length < 4) {
    console.error('Usage: node mail_verifier.js <input_file.csv> <output_file.csv>');
    process.exit(1);
}

const INPUT_FILE = process.argv[2];
const OUTPUT_FILE = process.argv[3];

// Vérification de l'existence du fichier d'entrée
if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Erreur: Le fichier d'entrée ${INPUT_FILE} n'existe pas`);
    process.exit(1);
}

// ──────────────── Throttled HTTP helpers ────────────────
const limiter = new Bottleneck({ minTime: 1000 }); // 1 requête par seconde
const httpGet = (...a) => limiter.schedule(() => new Promise((resolve, reject) => {
    request(...a, (error, response) => {
        if (error) reject(error);
        else resolve(response);
    });
}));

// ──────────────── Email verification ────────────────
async function verifyEmail(email) {
    const options = {
        'method': 'GET',
        'url': `https://api.millionverifier.com/api/v3/?api=${API_KEY}&email=${email}&timeout=10`,
        'headers': {}
    };

    try {
        const response = await httpGet(options);
        const result = JSON.parse(response.body);
        return {
            quality: result.quality,
            note: result.quality === 'good' ? 'Good' : result.quality === 'risky' ? 'Risky' : 'Bad'
        };
    } catch (error) {
        console.error(`❌ Erreur lors de la vérification de ${email}:`, error.message);
        return { quality: 'error', note: 'Error' };
    }
}

// ──────────────── CSV helpers ────────────────
function readCsv(path) {
    return new Promise((res, rej) => {
        const rows = [];
        fs.createReadStream(path)
            .pipe(csv())
            .on('data', (d) => rows.push(d))
            .on('end', () => res(rows))
            .on('error', rej);
    });
}

async function writeCsv(path, rows) {
    const header = Object.keys(rows[0]).map((id) => ({ id, title: id }));
    return createObjectCsvWriter({ path, header }).writeRecords(rows);
}

async function writeBackup(rows, processedCount) {
    const backupPath = OUTPUT_FILE.replace('.csv', `_backup_${processedCount}.csv`);
    await writeCsv(backupPath, rows.filter(row => row !== undefined));
    console.log(`💾 Sauvegarde créée : ${backupPath}`);
}

// Fonction pour filtrer les résultats et ne garder que les lignes avec Email_note: "Good"
function filterGoodEmails(rows) {
    const goodEmails = rows.filter(row => row.Email_note === 'Good');
    console.log(`📊 ${goodEmails.length} emails valides sur ${rows.length} au total`);
    return goodEmails;
}

// ──────────────── Main batch ────────────────
async function processEmails(rows) {
    const results = new Array(rows.length);
    let processedCount = 0;
    const BACKUP_INTERVAL = 100;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const email = row.Email;
        
        if (!email) {
            row.Email_note = 'No email';
            results[i] = row;
            continue;
        }

        try {
            const verification = await verifyEmail(email);
            row.Email_note = verification.note;
            console.log(`📧 ${i + 1}/${rows.length} - ${email}: ${verification.note}`);
        } catch (error) {
            console.error(`❌ Erreur lors du traitement de ${email}:`, error.message);
            row.Email_note = 'Error';
        }
        
        results[i] = row;
        processedCount++;

        if (processedCount % BACKUP_INTERVAL === 0) {
            await writeBackup(results, processedCount);
        }
    }
    
    return { results, processedCount };
}

// Fonction pour nettoyer les sauvegardes
async function cleanupBackups(outputFile) {
    const backupPattern = outputFile.replace('.csv', '_backup_*.csv');
    const files = fs.readdirSync('.');
    const backupFiles = files.filter(file => file.match(new RegExp(backupPattern.replace('*', '\\d+'))));
    
    for (const file of backupFiles) {
        try {
            fs.unlinkSync(file);
            console.log(`🧹 Sauvegarde supprimée : ${file}`);
        } catch (error) {
            console.error(`⚠️ Erreur lors de la suppression de la sauvegarde ${file}:`, error.message);
        }
    }
}

(async () => {
    console.time('Batch');
    console.log(`📋 Traitement du fichier: ${INPUT_FILE}`);
    console.log(`📤 Fichier de sortie: ${OUTPUT_FILE}`);
    
    const rows = await readCsv(INPUT_FILE);
    console.log(`📊 Chargement de ${rows.length} emails…`);
    
    try {
        const { results, processedCount } = await processEmails(rows);
        
        // Filtrer pour ne garder que les emails valides
        const goodEmails = filterGoodEmails(results);
        
        // Sauvegarder uniquement les emails valides
        await writeCsv(OUTPUT_FILE, goodEmails);
        console.log(`✅ ${goodEmails.length} emails valides sauvegardés dans ${OUTPUT_FILE}`);
        
        await cleanupBackups(OUTPUT_FILE);
    } catch (error) {
        console.error('❌ Erreur lors du traitement :', error);
        if (processedCount > 0) {
            console.log(`⚠️ Tentative de récupération depuis la dernière sauvegarde...`);
            await writeBackup(results, processedCount);
        }
    }
    
    console.timeEnd('Batch');
})().catch(console.error);
