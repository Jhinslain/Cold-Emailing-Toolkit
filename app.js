#!/usr/bin/env node

/**
 * 🎯 APPLICATION PRINCIPALE - Scoring Lighthouse Multi-API + Hook
 * =============================================================
 * 
 * Cette application unifie toutes les fonctionnalités :
 * - Analyse de domaines (DNS, MX, RDAP, CT, scraping)
 * - Scoring Lighthouse (PageSpeed Insights + Core Web Vitals)
 * - Vérification d'emails (Million Verifier)
 * - Génération de hooks personnalisés
 * - Recherche SIRENE et web
 * 
 * Usage :
 *   node app.js --mode <mode> --input <fichier> --output <dossier>
 * 
 * Modes disponibles :
 *   - domain: Analyse complète de domaines
 *   - lighthouse: Scoring des performances web
 *   - email: Vérification d'emails
 *   - hook: Génération de hooks
 *   - full: Pipeline complet
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Import des modules existants
import { probeDomain } from './probe.js';

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// CLI Arguments
const argv = yargs(hideBin(process.argv))
  .option('mode', {
    alias: 'm',
    type: 'string',
    choices: ['domain', 'lighthouse', 'email', 'hook', 'full'],
    describe: 'Mode d\'exécution',
    demandOption: true
  })
  .option('input', {
    alias: 'i',
    type: 'string',
    describe: 'Fichier d\'entrée (CSV ou liste de domaines)',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    describe: 'Dossier de sortie',
    default: './output'
  })
  .option('concurrency', {
    alias: 'c',
    type: 'number',
    describe: 'Nombre de requêtes simultanées',
    default: 4
  })
  .option('crux', {
    type: 'boolean',
    describe: 'Inclure les données CrUX',
    default: false
  })
  .help()
  .argv;

// Classes principales
class DomainAnalyzer {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 4;
    this.results = [];
  }

  async analyzeDomains(domains) {
    console.log(`🔍 Analyse de ${domains.length} domaines...`);
    
    const results = [];
    for (let i = 0; i < domains.length; i += this.concurrency) {
      const batch = domains.slice(i, i + this.concurrency);
      const batchPromises = batch.map(domain => this.analyzeSingleDomain(domain));
      
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`❌ Erreur pour ${batch[index]}: ${result.reason}`);
          results.push({
            domain: batch[index],
            ok: false,
            error: result.reason.message
          });
        }
      });
      
      console.log(`✅ Traité ${Math.min(i + this.concurrency, domains.length)}/${domains.length} domaines`);
    }
    
    return results;
  }

  async analyzeSingleDomain(domain) {
    return await probeDomain(domain);
  }
}

class LighthouseScorer {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 4;
    this.includeCrux = options.crux || false;
  }

  async scoreWebsites(websites) {
    console.log(`📊 Scoring de ${websites.length} sites web...`);
    
    // Utiliser le script existant
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const inputFile = join(argv.output, 'temp_lighthouse_input.csv');
    const outputFile = join(argv.output, 'lighthouse_results.csv');
    
    // Créer le fichier temporaire
    const csvContent = 'Website\n' + websites.map(site => site).join('\n');
    fs.writeFileSync(inputFile, csvContent);
    
    // Exécuter le script Lighthouse
    const cruxFlag = this.includeCrux ? '--crux' : '';
    const command = `node scripts/score_lighthouse.js --input "${inputFile}" --output "${outputFile}" --concurrency ${this.concurrency} ${cruxFlag}`;
    
    try {
      const { stdout, stderr } = await execAsync(command);
      console.log(stdout);
      if (stderr) console.error(stderr);
      
      // Lire les résultats
      if (fs.existsSync(outputFile)) {
        const results = this.readCsvFile(outputFile);
        return results;
      }
    } catch (error) {
      console.error(`❌ Erreur Lighthouse: ${error.message}`);
    }
    
    return [];
  }

  readCsvFile(filePath) {
    const csv = require('csv-parser');
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }
}

class EmailVerifier {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 1; // Million Verifier limite
  }

  async verifyEmails(emails) {
    console.log(`📧 Vérification de ${emails.length} emails...`);
    
    // Utiliser le script existant
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const inputFile = join(argv.output, 'temp_email_input.csv');
    const outputFile = join(argv.output, 'email_results.csv');
    
    // Créer le fichier temporaire
    const csvContent = 'Email\n' + emails.map(email => email).join('\n');
    fs.writeFileSync(inputFile, csvContent);
    
    // Exécuter le script Email Verifier
    const command = `node scripts/mail_verifier.js "${inputFile}" "${outputFile}"`;
    
    try {
      const { stdout, stderr } = await execAsync(command);
      console.log(stdout);
      if (stderr) console.error(stderr);
      
      // Lire les résultats
      if (fs.existsSync(outputFile)) {
        const results = this.readCsvFile(outputFile);
        return results;
      }
    } catch (error) {
      console.error(`❌ Erreur Email Verifier: ${error.message}`);
    }
    
    return [];
  }

  readCsvFile(filePath) {
    const csv = require('csv-parser');
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }
}

class HookGenerator {
  constructor(options = {}) {
    this.options = options;
  }

  async generateHooks(data) {
    console.log(`🎣 Génération de hooks pour ${data.length} entrées...`);
    
    // Utiliser le script existant
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const inputFile = join(argv.output, 'temp_hook_input.csv');
    const outputFile = join(argv.output, 'final_results.csv');
    
    // Créer le fichier temporaire
    const csv = require('csv-writer');
    const createCsvWriter = csv.createObjectCsvWriter;
    
    const csvWriter = createCsvWriter({
      path: inputFile,
      header: Object.keys(data[0]).map(key => ({ id: key, title: key }))
    });
    
    await csvWriter.writeRecords(data);
    
    // Exécuter le script Hook Generator
    const command = `node scripts/changement_hook.js "${inputFile}" "${outputFile}"`;
    
    try {
      const { stdout, stderr } = await execAsync(command);
      console.log(stdout);
      if (stderr) console.error(stderr);
      
      // Lire les résultats
      if (fs.existsSync(outputFile)) {
        const results = this.readCsvFile(outputFile);
        return results;
      }
    } catch (error) {
      console.error(`❌ Erreur Hook Generator: ${error.message}`);
    }
    
    return [];
  }

  readCsvFile(filePath) {
    const csv = require('csv-parser');
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }
}

// Application principale
class ScoringApp {
  constructor() {
    this.outputDir = argv.output;
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async readInputFile() {
    const filePath = argv.input;
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier d'entrée non trouvé: ${filePath}`);
    }

    const ext = filePath.split('.').pop().toLowerCase();
    
    if (ext === 'csv') {
      return this.readCsvFile(filePath);
    } else {
      // Fichier texte avec un domaine par ligne
      const content = fs.readFileSync(filePath, 'utf8');
      return content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(domain => ({ domain }));
    }
  }

  readCsvFile(filePath) {
    const csv = require('csv-parser');
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async runDomainAnalysis() {
    console.log('🔍 MODE: Analyse de domaines');
    
    const inputData = await this.readInputFile();
    const domains = inputData.map(row => row.domain || row.Website || row.website);
    
    const analyzer = new DomainAnalyzer({ concurrency: argv.concurrency });
    const results = await analyzer.analyzeDomains(domains);
    
    // Sauvegarder les résultats
    const outputFile = join(this.outputDir, 'domain_analysis.json');
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    
    console.log(`✅ Analyse terminée. Résultats sauvegardés dans: ${outputFile}`);
    return results;
  }

  async runLighthouseScoring() {
    console.log('📊 MODE: Scoring Lighthouse');
    
    const inputData = await this.readInputFile();
    const websites = inputData.map(row => row.Website || row.website || row.domain);
    
    const scorer = new LighthouseScorer({ 
      concurrency: argv.concurrency,
      crux: argv.crux 
    });
    const results = await scorer.scoreWebsites(websites);
    
    console.log(`✅ Scoring terminé. ${results.length} sites analysés.`);
    return results;
  }

  async runEmailVerification() {
    console.log('📧 MODE: Vérification d\'emails');
    
    const inputData = await this.readInputFile();
    const emails = inputData.map(row => row.Email || row.email);
    
    const verifier = new EmailVerifier({ concurrency: argv.concurrency });
    const results = await verifier.verifyEmails(emails);
    
    console.log(`✅ Vérification terminée. ${results.length} emails traités.`);
    return results;
  }

  async runHookGeneration() {
    console.log('🎣 MODE: Génération de hooks');
    
    const inputData = await this.readInputFile();
    
    const generator = new HookGenerator();
    const results = await generator.generateHooks(inputData);
    
    console.log(`✅ Génération terminée. ${results.length} hooks créés.`);
    return results;
  }

  async runFullPipeline() {
    console.log('🚀 MODE: Pipeline complet');
    
    const inputData = await this.readInputFile();
    const domains = inputData.map(row => row.Website || row.website || row.domain);
    const emails = inputData.map(row => row.Email || row.email);
    
    // 1. Analyse de domaines
    console.log('\n=== ÉTAPE 1: Analyse de domaines ===');
    const domainResults = await this.runDomainAnalysis();
    
    // 2. Scoring Lighthouse
    console.log('\n=== ÉTAPE 2: Scoring Lighthouse ===');
    const lighthouseResults = await this.runLighthouseScoring();
    
    // 3. Vérification d'emails
    console.log('\n=== ÉTAPE 3: Vérification d\'emails ===');
    const emailResults = await this.runEmailVerification();
    
    // 4. Fusion des résultats
    console.log('\n=== ÉTAPE 4: Fusion des résultats ===');
    const mergedResults = this.mergeResults(domainResults, lighthouseResults, emailResults);
    
    // 5. Génération de hooks
    console.log('\n=== ÉTAPE 5: Génération de hooks ===');
    const finalResults = await this.runHookGeneration();
    
    console.log(`\n✅ Pipeline complet terminé !`);
    console.log(`📁 Résultats dans: ${this.outputDir}`);
    
    return finalResults;
  }

  mergeResults(domainResults, lighthouseResults, emailResults) {
    // Logique de fusion des résultats
    const merged = [];
    
    // TODO: Implémenter la logique de fusion
    // Cette fonction devrait combiner les résultats des différentes analyses
    
    return merged;
  }

  async run() {
    console.log('🎯 APPLICATION DE SCORING LIGHTHOUSE MULTI-API + HOOK');
    console.log('='.repeat(60));
    
    try {
      switch (argv.mode) {
        case 'domain':
          await this.runDomainAnalysis();
          break;
        case 'lighthouse':
          await this.runLighthouseScoring();
          break;
        case 'email':
          await this.runEmailVerification();
          break;
        case 'hook':
          await this.runHookGeneration();
          break;
        case 'full':
          await this.runFullPipeline();
          break;
        default:
          console.error('❌ Mode non reconnu');
          process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Erreur: ${error.message}`);
      process.exit(1);
    }
  }
}

// Lancement de l'application
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = new ScoringApp();
  app.run();
}

export { ScoringApp, DomainAnalyzer, LighthouseScorer, EmailVerifier, HookGenerator }; 