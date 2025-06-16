const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');

// --- Configuration ---
const inputFile = process.argv[2]; // Fichier d'entrée passé en argument
const outputFile = process.argv[3]; // Fichier de sortie passé en argument

if (!inputFile || !outputFile) {
    console.error('Usage: node changement_hook.js <inputFile> <outputFile>');
    process.exit(1);
}

// --- Seuils (ajustement possible pour SEO) ---
const psiMobilePoor = 49;
const psiMobileNi = 89;
const psiSeoPoor = 79; // Score SEO considéré comme "à améliorer significativement"
const psiSeoNi = 89;   // Score SEO "perfectible"

const lcpPoorMs = 4000;
const lcpNiMs = 2500;
const inpPoorMs = 500;
const inpNiMs = 200;
const clsPoor = 0.25;
const clsNi = 0.1;

// --- Chargement des hooks depuis le fichier JSON ---
const hooks = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'hooks.json'), 'utf8'));

// --- Fonctions Utilitaires ---
function parseMetric(value, isFloat = false) {
    if (value === null || typeof value === 'undefined' || String(value).trim().toUpperCase() === 'ERR' || String(value).trim() === '') {
        return null;
    }
    const num = isFloat ? parseFloat(value) : parseInt(value, 10);
    return isNaN(num) ? null : num;
}

function getPersonalizedTexts(index, hookList, statImpactList, params = {}) {
    let hookTemplate = hookList[index % hookList.length];
    let statImpactTemplate = ""; // Initialiser
    if (statImpactList && statImpactList.length > 0) { // S'assurer que la liste existe
        statImpactTemplate = statImpactList[index % statImpactList.length];
    }
    
    params.company_name = params.company_name || 'votre entreprise'; 

    for (const key in params) {
        let value = params[key];
        if (typeof value === 'number' && !Number.isInteger(value)) {
             if (key === 'lcp_val') value = value.toFixed(1); 
             else if (key === 'cls_val') value = value.toFixed(2); 
             else value = value.toFixed(2); 
        }
        const placeholder = new RegExp(`{${key.replace(/([{}])/g, '\\$1')}}`, 'g');
        hookTemplate = hookTemplate.replace(placeholder, value);
        if (statImpactTemplate) {
            statImpactTemplate = statImpactTemplate.replace(placeholder, value);
        }
    }
    return {
        merged_hook: hookTemplate,
        stat_impact_sentence: statImpactTemplate
    };
}

// --- Logique Principale ---
const rows = [];
let rowIndex = 0;

fs.createReadStream(inputFile)
    .pipe(csv.parse({ headers: true }))
    .on('error', error => console.error("Erreur lors de la lecture du CSV:", error))
    .on('data', (row) => {
        let problemType = ''; // Pour déterminer quel jeu de phrases utiliser
        const companyName = row.company_name || 'votre entreprise';

        const psiMobile = parseMetric(row.psi_mobile_score);
        const psiSeo = parseMetric(row.psi_seo_score);
        const lcpMs = parseMetric(row.lcp_p75_ms);
        const inpMs = parseMetric(row.inp_p75_ms);
        const cls = parseMetric(row.cls_p75, true); 

        let params = { company_name: companyName };

        // Priorisation:
        // 1. Critères "Poor" pour la performance mobile / CrUX
        // 2. Score SEO "Poor" (nouveau seuil psiSeoPoor)
        // 3. Critères "NI" pour la performance mobile / CrUX
        // 4. Score SEO "NI"
        // 5. All Good
        // 6. Fallback

        if (psiMobile !== null && psiMobile <= psiMobilePoor) {
            problemType = 'psi_mobile_poor';
            params.score = psiMobile;
        } else if (lcpMs !== null && lcpMs > lcpPoorMs) {
            problemType = 'lcp_poor';
            params.lcp_val = lcpMs / 1000.0;
        } else if (inpMs !== null && inpMs > inpPoorMs) {
            problemType = 'inp_poor';
            params.inp_val = inpMs;
        } else if (cls !== null && cls > clsPoor) {
            problemType = 'cls_poor';
            params.cls_val = cls;
        } else if (psiSeo !== null && psiSeo <= psiSeoPoor) { // SEO "Poor" priorisé avant perf "NI"
            problemType = 'psi_seo_ni'; // Utilise les phrases SEO NI, adaptées pour être plus fortes
            params.score_seo = psiSeo;
        } else if (psiMobile !== null && psiMobile <= psiMobileNi) {
            problemType = 'psi_mobile_ni';
            params.score = psiMobile;
        } else if (lcpMs !== null && lcpMs > lcpNiMs) {
            problemType = 'lcp_ni';
            params.lcp_val = lcpMs / 1000.0;
        } else if (inpMs !== null && inpMs > inpNiMs) {
            problemType = 'inp_ni';
            params.inp_val = inpMs;
        } else if (cls !== null && cls > clsNi) {
            problemType = 'cls_ni';
            params.cls_val = cls;
        } else if (psiSeo !== null && psiSeo <= psiSeoNi) {
            problemType = 'psi_seo_ni';
            params.score_seo = psiSeo;
        } else if ((psiMobile !== null && psiMobile > psiMobileNi) ||
                   (lcpMs !== null && lcpMs <= lcpNiMs && inpMs !== null && inpMs <= inpNiMs && cls !== null && cls <= clsNi)) {
            problemType = 'all_good';
        } else {
            problemType = 'general_fallback';
        }

        let texts = {}; 

        switch (problemType) {
            case 'psi_mobile_poor':
                texts = getPersonalizedTexts(rowIndex, hooks.mergedHooksPsiMobilePoor, hooks.statImpactSpeedPoorOrNi, params);
                break;
            case 'psi_mobile_ni':
                texts = getPersonalizedTexts(rowIndex, hooks.mergedHooksPsiMobileNi, hooks.statImpactSpeedPoorOrNi, params);
                break;
            case 'lcp_poor':
                texts = getPersonalizedTexts(rowIndex, hooks.mergedHooksLcpPoor, hooks.statImpactSpeedPoorOrNi, params);
                break;
            case 'lcp_ni':
                texts = getPersonalizedTexts(rowIndex, hooks.mergedHooksLcpNi, hooks.statImpactSpeedPoorOrNi, params);
                break;
            case 'inp_poor':
                texts = getPersonalizedTexts(rowIndex, hooks.mergedHooksInpPoor, hooks.statImpactSpeedPoorOrNi, params);
                break;
            case 'inp_ni':
                texts = getPersonalizedTexts(rowIndex, hooks.mergedHooksInpNi, hooks.statImpactSpeedPoorOrNi, params);
                break;
            case 'cls_poor':
                texts = getPersonalizedTexts(rowIndex, hooks.mergedHooksClsPoor, hooks.statImpactClsPoorOrNi, params);
                break;
            case 'cls_ni':
                texts = getPersonalizedTexts(rowIndex, hooks.mergedHooksClsNi, hooks.statImpactClsPoorOrNi, params);
                break;
            case 'psi_seo_ni': 
                texts = getPersonalizedTexts(rowIndex, hooks.mergedHooksPsiSeoNi, hooks.statImpactPsiSeoNi, params);
                break;
            case 'all_good':
                texts = getPersonalizedTexts(rowIndex, hooks.mergedHooksAllGoodOrOnlyPsiOk, hooks.statImpactAllGood, params);
                break;
            default: // general_fallback
                texts = getPersonalizedTexts(rowIndex, hooks.mergedHooksGeneralFallback, hooks.statImpactGeneralFallback, params);
        }
        
        row.generated_merged_hook = texts.merged_hook; 
        row.generated_stat_impact_sentence = texts.stat_impact_sentence;
        // Supprimer les anciennes colonnes si elles étaient là par erreur
        delete row.generated_custom_hook_v3; 
        delete row.generated_second_paragraph;
        rows.push(row);
        rowIndex++;
    })
    .on('end', (rowCount) => {
        console.log(`CSV lu avec succès, ${rowCount} lignes traitées.`);
        if (rows.length > 0) {
            const headers = Object.keys(rows[0]);
            csv.writeToPath(path.resolve(__dirname, outputFile), rows, { headers: headers })
                .on('error', err => console.error("Erreur lors de l'écriture du CSV:", err))
                .on('finish', () => console.log(`Fichier de sortie '${outputFile}' créé avec succès.`));
        } else {
            console.log("Aucune donnée à écrire dans le fichier de sortie.");
        }
    });