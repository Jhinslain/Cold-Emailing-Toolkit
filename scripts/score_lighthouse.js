#!/usr/bin/env node
/**
* Batch PageSpeed Insights + persuasive hook (v4 – 26 mai 2025)
* ---------------------------------------------------------------------------
* Changements par rapport à v3 :
*   • Concurrence par défaut = 8 (⇒ ≃ 480 req/min, sous la limite PSI 240 req/min
*     car un seul appel PSI par URL).
*   • Appels PSI avec Fallback : https://, https://www., http://
*   • Seuils de détection élargis → davantage de hooks :
*        - Performance mobile  < 70  (au lieu de < 50)
*        - SEO mobile         < 85  (au lieu de < 70)
*        - LCP P75 terrain    > 3 000 ms (au lieu de 4 000)
*        - INP P75 terrain    > 400 ms  (au lieu de 500)
*        - CLS P75 terrain    > 0,20    (au lieu de 0,25)
*   • custom_hook vide ⇒ filtrage manuel ou exclusion de la campagne.
* ---------------------------------------------------------------------------
* Dépendances : axios csv-parser csv-writer bottleneck yargs dotenv
* Usage :
*   PSI_API_KEY="<google-cloud-key>" node psi_batch_audit.js \
*        --input leads.csv --output results.csv --crux --concurrency 8
*/
const fs = require("fs");
const csv = require("csv-parser");
const { createObjectCsvWriter } = require("csv-writer");
const axios = require("axios");
const Bottleneck = require("bottleneck");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const path = require("path");
require("dotenv").config();
// ──────────────────────────────── CLI ────────────────────────────────
const argv = yargs(hideBin(process.argv))
  .option("input", { 
    alias: "i", 
    type: "string", 
    describe: "Fichier d'entrée CSV"
  })
  .option("output", { 
    alias: "o", 
    type: "string", 
    describe: "Fichier de sortie CSV"
  })
  .option("crux", { 
    describe: "Fetch CrUX field data", 
    type: "boolean", 
    default: false 
  })
  .option("concurrency", { 
    describe: "Requests per second", 
    type: "number", 
    default: 4 
  })
  .help().argv;

// Vérification que les paramètres requis sont présents
if (!argv.input || !argv.output) {
  console.error("❌ Les paramètres --input et --output sont requis");
  process.exit(1);
}

// Vérification que le fichier d'entrée existe
if (!fs.existsSync(argv.input)) {
  console.error(`❌ Le fichier d'entrée n'existe pas: ${argv.input}`);
  process.exit(1);
}

console.log(`📥 Lecture du fichier: ${argv.input}`);

const API_KEYS = [
  process.env.API_KEY_1,
  process.env.API_KEY_2,
  process.env.API_KEY_3,
].filter(Boolean);

if (API_KEYS.length === 0) {
  console.error(":x:  Aucune clé API n'est configurée. Veuillez définir API_KEY_1, API_KEY_2 et API_KEY_3 dans le fichier .env");
  process.exit(1);
}

let currentKeyIndex = 0;

function getNextApiKey() {
  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

// ──────────────── Throttled HTTP helpers ────────────────
const limiter = new Bottleneck({ minTime: Math.ceil(1000 / argv.concurrency) });
const httpGet = (...a) => limiter.schedule(() => axios.get(...a));
const httpPost = (...a) => limiter.schedule(() => axios.post(...a));
// ──────────────── PageSpeed & CrUX fetchers ────────────────
async function fetchPsi(url) {
  const apiKey = getNextApiKey();
  const endpoint =
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
    `?url=${encodeURIComponent(url)}` +
    `&strategy=mobile&category=performance&category=seo&key=${apiKey}`;
  const { data } = await httpGet(endpoint);
  return {
    perf: data.lighthouseResult?.categories?.performance?.score != null
      ? Math.round(data.lighthouseResult.categories.performance.score * 100)
      : null,
    seo: data.lighthouseResult?.categories?.seo?.score != null
      ? Math.round(data.lighthouseResult.categories.seo.score * 100)
      : null,
  };
}
async function fetchCrux(origin) {
  const apiKey = getNextApiKey();
  const body = {
    origin,
    metrics: [
      "largest_contentful_paint",
      "cumulative_layout_shift",
      "interaction_to_next_paint",
    ],
  };
  const url = `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${apiKey}`;
  const { data } = await httpPost(url, body, { headers: { "Content-Type": "application/json" } });
  const m = data.record?.metrics || {};
  const p75 = (metric) => metric?.percentiles?.p75 ?? null;
  return {
    lcp: p75(m.largest_contentful_paint),
    cls: p75(m.cumulative_layout_shift),
    inp: p75(m.interaction_to_next_paint),
  };
}
// ──────────────── CSV helpers ────────────────
function readCsv(path) {
  return new Promise((res, rej) => {
    const rows = [];
    fs.createReadStream(path)
      .pipe(csv())
      .on("data", (d) => rows.push(d))
      .on("end", () => res(rows))
      .on("error", rej);
  });
}
async function writeCsv(path, rows) {
  const header = Object.keys(rows[0]).map((id) => ({ id, title: id }));
  return createObjectCsvWriter({ path, header }).writeRecords(rows);
}

async function writeBackup(rows, processedCount) {
  const backupPath = argv.output.replace('.csv', `_backup_${processedCount}.csv`);
  await writeCsv(backupPath, rows.filter(row => row !== undefined));
  console.log(`:floppy_disk:  Sauvegarde créée : ${backupPath}`);
}

// ──────────────── Hook builder ────────────────
function buildHook(m) {
  const hooks = [];
  if (m.perf != null && m.perf < 80) {
    hooks.push({ sev: 80 - m.perf, txt: `Google évalue votre site mobile à seulement ${m.perf}/100 de performance – chaque seconde de lenteur coûte des clients.` });
  }
  if (m.seo != null && m.seo < 85) {
    hooks.push({ sev: 85 - m.seo, txt: `Google évalue votre SEO mobile à ${m.seo}/100 : vos prospects risquent de ne jamais vous trouver.` });
  }
  if (m.lcp != null && m.lcp > 2000) {
    hooks.push({ sev: (m.lcp - 2000) / 1000, txt: `Le contenu de votre site met ${(m.lcp / 1000).toFixed(1)} s à apparaître (LCP) : beaucoup de visiteurs partent avant de voir votre offre.` });
  }
  if (m.inp != null && m.inp > 400) {
    hooks.push({ sev: (m.inp - 400) / 100, txt: `Votre site réagit en ${(m.inp / 1000).toFixed(1)} s aux clics (INP) : cette latence décourage vos prospects.` });
  }
  if (m.cls != null && m.cls > 0.2) {
    hooks.push({ sev: (m.cls - 0.2) * 100, txt: `Le contenu de votre site bouge à l'écran (CLS ${m.cls}) : cette instabilité nuit à la confiance des clients.` });
  }
  if (!hooks.length) return "";
  return hooks.sort((a, b) => b.sev - a.sev)[0].txt;
}
// ──────────────── Main batch ────────────────
async function processUrls(rows, concurrency = 4) {
  const results = new Array(rows.length);
  let currentIndex = 0;
  let processedCount = 0;
  const BACKUP_INTERVAL = 200;

  async function processUrl(row, index) {
    const website = (row.Website || "").trim();
    if (!website) {
      row.custom_hook = "";
      return row;
    }

    const metrics = { perf: null, seo: null, lcp: null, cls: null, inp: null };
    
    try {
      // Exécuter PSI et CrUX en parallèle si activé
      const [psiResult, cruxResult] = await Promise.all([
        fetchPsi(website).catch(e => ({ 
          perf: null, 
          seo: null, 
          error: e.response?.data?.error?.message || e.message 
        })),
        argv.crux ? fetchCrux(new URL(website).origin).catch(e => ({ 
          lcp: null, 
          cls: null, 
          inp: null, 
          error: e.response?.data?.error?.message || e.message 
        })) : Promise.resolve({ lcp: null, cls: null, inp: null })
      ]);

      // Mise à jour des métriques PSI
      metrics.perf = row.psi_mobile_score = psiResult.perf ?? "N/A";
      metrics.seo = row.psi_seo_score = psiResult.seo ?? "N/A";
      if (psiResult.error) {
        row.psi_error = psiResult.error;
        row.psi_mobile_score = row.psi_seo_score = "ERR";
      }

      // Mise à jour des métriques CrUX
      if (argv.crux) {
        metrics.lcp = row.lcp_p75_ms = cruxResult.lcp ?? "N/A";
        metrics.cls = row.cls_p75 = cruxResult.cls ?? "N/A";
        metrics.inp = row.inp_p75_ms = cruxResult.inp ?? "N/A";
        if (cruxResult.error) {
          row.crux_error = cruxResult.error;
          row.lcp_p75_ms = row.cls_p75 = row.inp_p75_ms = "ERR";
        }
      }

      row.custom_hook = buildHook(metrics);
    } catch (e) {
      console.error(`Erreur lors du traitement de ${website}:`, e.message);
      row.custom_hook = "";
    }
    
    return row;
  }

  async function worker() {
    while (currentIndex < rows.length) {
      const index = currentIndex++;
      if (index < rows.length) {
        results[index] = await processUrl(rows[index], index);
        processedCount++;
        console.log(`${index + 1} / ${rows.length} traités…`);

        // Sauvegarde tous les BACKUP_INTERVAL traitements
        if (processedCount % BACKUP_INTERVAL === 0) {
          await writeBackup(results, processedCount);
        }
      }
    }
  }

  // Lancer les workers en parallèle
  const workers = Array(concurrency).fill().map(() => worker());
  await Promise.all(workers);
  
  return results;
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
  console.time("Batch");
  const rows = await readCsv(argv.input);
  console.log(`Chargement de ${rows.length} leads…`);
  
  try {
    const processedRows = await processUrls(rows, argv.concurrency);
    await writeCsv(argv.output, processedRows);
    console.log(`:coche_blanche:  Résultats écrits dans ${argv.output}`);
    
    // Nettoyage des sauvegardes après un traitement réussi
    await cleanupBackups(argv.output);
  } catch (error) {
    console.error(":x:  Erreur lors du traitement :", error);
    // En cas d'erreur, on sauvegarde l'état actuel
    const lastBackupCount = Math.floor(processedCount / BACKUP_INTERVAL) * BACKUP_INTERVAL;
    if (lastBackupCount > 0) {
      console.log(`:warning:  Tentative de récupération depuis la dernière sauvegarde...`);
      await writeBackup(results, lastBackupCount);
    }
  }
  
  console.timeEnd("Batch");
})().catch(console.error);