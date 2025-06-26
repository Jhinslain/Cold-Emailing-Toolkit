const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// Import des modules nécessaires
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const cheerio = require('cheerio');
const { request } = require('undici');
const dns = require('node:dns/promises');
const net = require('node:net');
require('dotenv').config();

// Configuration API SIRENE
const SIRENE_KEY = process.env.SIRENE_KEY;
const SIRENE_BASE_URL = 'https://api.insee.fr/api-sirene/3.11';

// Configuration optimisée
const CONCURRENT_REQUESTS = 3; 
const BATCH_SIZE = 100; // Plus gros lots

// Pool de requêtes optimisé
class RequestPool {
  constructor(maxConcurrent = CONCURRENT_REQUESTS) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async execute(fn) {
    return new Promise((resolve, reject) => {
      const task = async () => {
        this.running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      };

      if (this.running < this.maxConcurrent) {
        task();
      } else {
        this.queue.push(task);
      }
    });
  }

  processQueue() {
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const task = this.queue.shift();
      task();
    }
  }
}

const requestPool = new RequestPool();

/** Vérifie si un site répond (HEAD), sans suivre la redirection */
async function siteAlive(host, scheme = 'http') {
  return requestPool.execute(async () => {
    try {
      const {statusCode} = await request(`${scheme}://${host}`, {
        method: 'HEAD',
        maxRedirections: 0,
        bodyTimeout: 3000 // Réduit de 5s à 3s
      });
      return statusCode >= 200 && statusCode < 400;
    } catch { return false; }
  });
}

/** Validation rapide e-mail : vérification MX uniquement */
async function smtpValidate(email) {
  return requestPool.execute(async () => {
    const [, dom] = email.split('@');
    try {
      const mxRecords = await dns.resolveMx(dom);
      if (!mxRecords || mxRecords.length === 0) {
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  });
}

/** Nouvelle fonction : Vérification MX uniquement */
async function checkMxAndCommonEmails(domain) {
  return requestPool.execute(async () => {
    try {
      const mxRecords = await dns.resolveMx(domain);
      
      if (!mxRecords || mxRecords.length === 0) {
        return { hasMx: false };
      }
      
      const mx = mxRecords.sort((a,b) => a.priority - b.priority)[0].exchange;
      
      // Détecter le type de service mail
      const mxLower = mx.toLowerCase();
      let mxType = 'other';
      if (mxLower.includes('google') || mxLower.includes('aspmx')) {
        mxType = 'google';
      } else if (mxLower.includes('zimbra')) {
        mxType = 'zimbra';
      } else if (mxLower.includes('ovh')) {
        mxType = 'ovh';
      } else if (mxLower.includes('outlook') || mxLower.includes('office365') || mxLower.includes('microsoft')) {
        mxType = 'office365';
      } else if (mxLower.includes('mail') || mxLower.includes('smtp')) {
        mxType = 'custom';
      }
      
      return {
        hasMx: true,
        mxServer: mx,
        mxType: mxType,
        mxRecords: mxRecords
      };
      
    } catch (err) {
      return { hasMx: false };
    }
  });
}

/* Extraction robuste des contacts */
function extractContacts(html, domain) {
  const $ = cheerio.load(html);
  const txt = $('body').text().replace(/\s|\u00A0|\u202F|\u2009|\u2007|\u2060|\uFEFF/g, ' ');
  
  // Emails : tous les emails, pas seulement ceux du domaine
  const mailRe = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/gi;
  const emails = [...new Set(txt.match(mailRe) ?? [])];

  // Téléphones : tolère points, espaces, tirets, insécables, etc.
  const phoneRe = /(?:\+33|0)[\s.\-\u00A0\u202F\u2009\u2007\u2060\uFEFF]?[1-9](?:[\s.\-\u00A0\u202F\u2009\u2007\u2060\uFEFF]?\d{2}){4}/g;
  const raw = [...new Set(txt.match(phoneRe) ?? [])];
  const phones = raw
      .map(s => parsePhoneNumberFromString(s, 'FR'))
      .filter(p => p?.isValid())
      .map(p => p.format('E.164'));

  return {emails, phones};
}

/* Liste de chemins élargie + HTTP & HTTPS */
const CONTACT_PATHS = [
  '', '/', '/contact', '/contact.html', '/contact.php',
  '/nous-contacter', '/contactez-nous', '/mentions-legales', '/legal'
];

/* Scraping optimisé avec timeout réduit */
async function scrapeSite(domain) {
  return requestPool.execute(async () => {
    for (const host of [domain, `www.${domain}`]) {
      for (const path of CONTACT_PATHS) {
        for (const scheme of ['http', 'https']) {
          try {
            const url = `${scheme}://${host}${path}`;
            const res = await request(url, {
              timeout: 4000, // Réduit de 7s à 4s
              headers: {'user-agent':'Mozilla/5.0'}
            });
            if (res.statusCode >= 400) {
              continue;
            }
            const html = await res.body.text();
            const c = extractContacts(html, domain);
            if (c.emails.length || c.phones.length) return {url, ...c};
          } catch(e){
            // Erreur silencieuse
          }
        }
      }
    }
    return undefined;
  });
}

/** Fonction pour extraire le nom de société du domaine */
function extractCompanyNameFromDomain(domain) {
  const name = domain.split('.')[0];
  const cleanName = name
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleanName.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Recherche SIREN via l'API INSEE - optimisée */
async function searchSirenByName(companyName) {
  if (!SIRENE_KEY) {
    return null;
  }
  
  return requestPool.execute(async () => {
    try {
      const url = `${SIRENE_BASE_URL}/siret?q=denominationUniteLegale:"${encodeURIComponent(companyName)}"&nombre=5`; // Réduit de 10 à 5
      
      const response = await request(url, {
        headers: {
          'Authorization': `Bearer ${SIRENE_KEY}`,
          'Accept': 'application/json'
        },
        timeout: 5000 // Réduit de 10s à 5s
      });
      
      if (response.statusCode !== 200) {
        return null;
      }
      
      const data = await response.body.json();
      
      if (!data.etablissements || data.etablissements.length === 0) {
        return null;
      }
      
      return data.etablissements.map(etab => ({
        siren: etab.siret.substring(0, 9),
        siret: etab.siret,
        denomination: etab.uniteLegale.denominationUniteLegale,
        nom: etab.uniteLegale.nomUniteLegale,
        prenom: etab.uniteLegale.prenom1UniteLegale,
        adresse: {
          numero: etab.adresseEtablissement.numeroVoieEtablissement,
          voie: etab.adresseEtablissement.typeVoieEtablissement + ' ' + etab.adresseEtablissement.libelleVoieEtablissement,
          codePostal: etab.adresseEtablissement.codePostalEtablissement,
          commune: etab.adresseEtablissement.libelleCommuneEtablissement
        },
        activite: etab.uniteLegale.activitePrincipaleUniteLegale,
        dateCreation: etab.uniteLegale.dateCreationUniteLegale,
        statut: etab.uniteLegale.etatAdministratifUniteLegale
      }));
      
    } catch (error) {
      return null;
    }
  });
}

/** Liste des domaines de fournisseurs de messagerie populaires à GARDER */
const POPULAR_EMAIL_PROVIDERS = [
  'gmail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'orange.fr', 'wanadoo.fr', 'laposte.net', 'free.fr', 'sfr.fr',
  'yahoo.com', 'yahoo.fr', 'aol.com', 'icloud.com', 'me.com',
  'protonmail.com', 'tutanota.com', 'yandex.com', 'mail.ru',
  'gmx.com', 'gmx.fr', 'web.de', 't-online.de', 'freenet.de',
  'libero.it', 'virgilio.it', 'alice.it', 'tiscali.it',
  'terra.com.br', 'uol.com.br', 'bol.com.br', 'ig.com.br',
  'naver.com', 'daum.net', 'hanmail.net', 'nate.com',
  'qq.com', '163.com', '126.com', 'sina.com', 'sohu.com',
  'rediffmail.com', 'sify.com', 'indiatimes.com'
];

/** Vérifie si un email provient d'un fournisseur de messagerie populaire */
function isPopularEmailProvider(email) {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  
  // Vérifier si le domaine correspond exactement à un fournisseur populaire
  if (POPULAR_EMAIL_PROVIDERS.includes(domain)) {
    return true;
  }
  
  // Vérifier les sous-domaines des fournisseurs populaires
  const popularSubdomains = [
    'googlemail.com', // Gmail
    'outlook.fr', 'outlook.de', 'outlook.it', 'outlook.es', 'outlook.co.uk',
    'hotmail.fr', 'hotmail.de', 'hotmail.it', 'hotmail.es', 'hotmail.co.uk',
    'live.fr', 'live.de', 'live.it', 'live.es', 'live.co.uk',
    'msn.fr', 'msn.de', 'msn.it', 'msn.es', 'msn.co.uk',
    'yahoo.fr', 'yahoo.de', 'yahoo.it', 'yahoo.es', 'yahoo.co.uk',
    'aol.fr', 'aol.de', 'aol.it', 'aol.es', 'aol.co.uk'
  ];
  
  if (popularSubdomains.includes(domain)) {
    return true;
  }
  
  return false;
}

/** Vérifie si un email provient d'un domaine de protection/privacy (à EXCLURE) */
function isPrivacyEmail(email) {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  
  // Si c'est un fournisseur populaire, on le GARDE (retourne false)
  if (isPopularEmailProvider(email)) {
    return false;
  }
  
  // Sinon, on EXCLUT tous les autres emails (retourne true)
  return true;
}

// Fonctions optimisées avec timeouts réduits
async function probeDomainOptimized(domain, mode = 'full') {
  const result = { domain };

  // WHOIS/RDAP optimisé - collecte complète des informations
  const rdapUrl = `https://rdap.nic.fr/domain/${domain}`;
  try {
    const response = await requestPool.execute(async () => {
      return await request(rdapUrl, { timeout: 3000 }); // Augmenté à 3s
    });
    
    const rd = await response.body.json();
    
    // Debug: afficher les entités trouvées
    if (rd.entities && rd.entities.length > 0) {
      console.log(`🔍 ${domain}`);
    }
    
    for (const role of ['registrant', 'administrative', 'tech']) {
      const ent = rd.entities?.find(e => e.roles?.includes(role));
      if (ent) {
        const v = ent.vcardArray?.[1];
        if (v) {
          const mail = v.find(a => a[0] === 'email')?.[3];
          const tel = v.find(a => a[0] === 'tel')?.[3];
          
          if (mail && !isPrivacyEmail(mail)) {
            // Collecter toutes les informations WHOIS
            const whoisInfo = extractWhoisInfo(ent, v);
            Object.assign(result, { 
              role, 
              mail, 
              tel,
              whois: whoisInfo
            });
            break;
          }
        }
        
        if (ent.email && !isPrivacyEmail(ent.email)) {
          const whoisInfo = extractWhoisInfo(ent);
          Object.assign(result, { 
            role, 
            mail: ent.email,
            whois: whoisInfo
          });
          break;
        }
      }
    }
    
    // Si aucun email trouvé, essayer d'autres sources
    if (!result.mail && rd.entities) {
      for (const ent of rd.entities) {
        // Chercher dans tous les champs possibles
        const possibleEmails = [
          ent.email,
          ent.vcardArray?.[1]?.find(a => a[0] === 'email')?.[3],
          ent.vcardArray?.[1]?.find(a => a[0] === 'EMAIL')?.[3],
          ent.vcardArray?.[1]?.find(a => a[0] === 'Email')?.[3]
        ].filter(Boolean);
        
        for (const email of possibleEmails) {
          if (email && !isPrivacyEmail(email)) {
            console.log(`  ✅ ${domain} - Email trouvé dans entité: ${email}`);
            const whoisInfo = extractWhoisInfo(ent);
            Object.assign(result, { 
              role: ent.roles?.[0] || 'unknown', 
              mail: email,
              whois: whoisInfo
            });
            break;
          }
        }
        if (result.mail) break;
      }
    }
    
  } catch (e) {
    console.log(`  ❌ ${domain} - Erreur RDAP: ${e.message}`);
  }

  if (result.mail) {
    result.ok = true;
    return result;
  }

  if (mode === 'whois-only') {
    result.ok = true;
    return result;
  }

  // DNS et scraping optimisés
  try {
    result.ip = await requestPool.execute(async () => {
      return (await dns.resolve4(domain))[0];
    });
    
    result.scraped = await scrapeSiteOptimized(domain);
  } catch (e) {
    // Erreur silencieuse
  }

  result.ok = true;
  return result;
}

/** Fonction pour extraire toutes les informations WHOIS */
function extractWhoisInfo(entity, vcard = null) {
  const whois = {};
  
  // Informations de base
  whois.organization = entity.vcardArray?.[1]?.find(a => a[0] === 'org')?.[3] || 
                      entity.name || 
                      entity.organization || 
                      'N/A';
  
  whois.type = entity.roles?.[0]?.toUpperCase() || 'N/A';
  
  // Adresse depuis vCard
  if (vcard) {
    const adr = vcard.find(a => a[0] === 'adr')?.[3];
    if (adr && Array.isArray(adr)) {
      // Format vCard: [PO Box, Extended Address, Street, Locality, Region, Postal Code, Country]
      whois.street1 = adr[2] || 'N/A'; // Street
      whois.street2 = adr[1] || 'N/A'; // Extended Address
      whois.locality = adr[3] || 'N/A'; // City
      whois.region = adr[4] || 'N/A'; // Region/State
      whois.postalCode = adr[5] || 'N/A'; // Postal Code
      whois.country = adr[6] || 'N/A'; // Country
      whois.countryCode = adr[6] || 'N/A'; // Country Code
    }
  }
  
  // Adresse depuis les champs directs de l'entité
  if (entity.address) {
    const addr = entity.address;
    whois.street1 = addr.street?.[0] || whois.street1 || 'N/A';
    whois.street2 = addr.street?.[1] || whois.street2 || 'N/A';
    whois.street3 = addr.street?.[2] || 'N/A';
    whois.locality = addr.locality || whois.locality || 'N/A';
    whois.region = addr.region || whois.region || 'N/A';
    whois.postalCode = addr.postalCode || whois.postalCode || 'N/A';
    whois.country = addr.country || whois.country || 'N/A';
    whois.countryCode = addr.countryCode || whois.countryCode || 'N/A';
  }
  
  // Autres informations
  whois.email = entity.email || 'N/A';
  whois.telephone = entity.telephone || 'N/A';
  
  return whois;
}

async function scrapeSiteOptimized(domain) {
  return requestPool.execute(async () => {
    const urls = [
      `https://${domain}/contact`,
      `https://${domain}/`,
      `http://${domain}/contact`,
      `http://${domain}/`
    ];

    for (const url of urls) {
      try {
        const res = await request(url, {
          timeout: 3000,
          headers: { 'user-agent': 'Mozilla/5.0' }
        });
        
        if (res.statusCode >= 400) continue;
        
        const html = await res.body.text();
        const contacts = extractContactsOptimized(html);
        
        if (contacts.emails.length || contacts.phones.length) {
          return { url, ...contacts };
        }
      } catch (e) {
        // Erreur silencieuse
      }
    }
    return undefined;
  });
}

function extractContactsOptimized(html) {
  const $ = cheerio.load(html);
  const txt = $('body').text().replace(/\s+/g, ' ');
  
  const mailRe = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/gi;
  const emails = [...new Set(txt.match(mailRe) ?? [])];

  const phoneRe = /(?:\+33|0)[\s.\-]?[1-9](?:[\s.\-]?\d{2}){4}/g;
  const raw = [...new Set(txt.match(phoneRe) ?? [])];
  const phones = raw
    .map(s => parsePhoneNumberFromString(s, 'FR'))
    .filter(p => p?.isValid())
    .map(p => p.format('E.164'));

  return { emails, phones };
}

/** Compte les fournisseurs d'emails populaires */
function countEmailProviders(emails) {
  const providers = {};
  
  emails.forEach(email => {
    if (isPopularEmailProvider(email)) {
      const domain = email.split('@')[1]?.toLowerCase();
      providers[domain] = (providers[domain] || 0) + 1;
    }
  });
  
  return providers;
}

// Fonction principale optimisée
async function processCSVDomainsOptimized(inputFile, outputFile, domainColumn = 'domain', delay = 200, mode = 'full') {
  console.log(`🚀 TRAITEMENT OPTIMISÉ - ${CONCURRENT_REQUESTS} requêtes simultanées`);
  console.log(`📁 Entrée: ${inputFile}`);
  console.log(`📁 Sortie: ${outputFile}`);
  console.log(`⚡ Délai: ${delay}ms | Mode: ${mode}`);
  console.log(`📧 GARDE UNIQUEMENT les emails populaires: Gmail, Outlook, Orange, Yahoo, etc.`);
  console.log(`❌ EXCLUT tous les autres emails (domaines d'entreprise, protection, etc.)`);
  
  try {
    const fileContent = fs.readFileSync(inputFile, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';'
    });
    
    console.log(`📋 ${records.length} domaines à traiter`);
    
    if (!records[0] || !records[0][domainColumn]) {
      throw new Error(`Colonne "${domainColumn}" non trouvée`);
    }
    
    // Définir les colonnes finales souhaitées
    const finalColumns = [
      'Nom de domaine', 'Pays BE', 'Nom BE', 'Sous domaine', '', 'Date de création',
      'email', 'numero', 'source_contact', 'whois_organization', 'whois_street1', 
      'whois_street23', 'whois_locality', 'whois_region', 'whois_postal_code', 'whois_country'
    ];
    
    const processedRecords = [];
    let stats = { whois: 0, scraping: 0, errors: 0, noContact: 0 };
    const allEmails = []; // Pour compter les fournisseurs
    const startTime = Date.now();
    
    // Traitement par lots optimisé
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, Math.min(i + BATCH_SIZE, records.length));
      console.log(`\n📦 Lot ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(records.length/BATCH_SIZE)} (${batch.length} domaines)`);
      
      const batchPromises = batch.map(async (record, batchIndex) => {
        const domain = record[domainColumn];
        const currentIndex = i + batchIndex + 1; // Index réel dans la liste complète
        
        if (!domain?.trim()) {
          stats.noContact++;
          const successCount = stats.whois + stats.scraping;
          const totalProcessed = currentIndex;
          const successRate = ((successCount / totalProcessed) * 100).toFixed(1);
          console.log(`   🚫 [${currentIndex}/${records.length}] ${domain || 'DOMAINE_VIDE'} - Pas de domaine | 📊 ${successCount}/${totalProcessed} (${successRate}%)`);
          return null;
        }
        
        try {
          const result = await probeDomainOptimized(domain.trim(), mode);
          
          let email = '';
          let numero = '';
          let sourceContact = 'Aucune';
          let whoisData = {};
          
          if (result.mail) {
            email = result.mail;
            numero = result.tel || '';
            sourceContact = 'RDAP/WHOIS';
            stats.whois++;
            
            // Vérifier si c'est un email populaire
            const isPopular = isPopularEmailProvider(email);
            const emailType = isPopular ? '📧 POPULAIRE' : '📧 AUTRE';
            
            allEmails.push(email);
            
            const successCount = stats.whois + stats.scraping;
            const totalProcessed = currentIndex;
            const successRate = ((successCount / totalProcessed) * 100).toFixed(1);
            console.log(`   ✅ [${currentIndex}/${records.length}] ${domain} - ${emailType}: ${email} | 📊 ${successCount}/${totalProcessed} (${successRate}%)`);
            
            // Extraire les données WHOIS
            if (result.whois) {
              // Combiner street2 et street3 en street23
              const street2 = result.whois.street2 || '';
              const street3 = result.whois.street3 || '';
              const street23 = [street2, street3].filter(s => s && s !== 'N/A').join(' ');
              
              whoisData = {
                whois_organization: result.whois.organization || 'N/A',
                whois_street1: result.whois.street1 || 'N/A',
                whois_street23: street23 || 'N/A',
                whois_locality: result.whois.locality || 'N/A',
                whois_region: result.whois.region || 'N/A',
                whois_postal_code: result.whois.postalCode || 'N/A',
                whois_country: result.whois.country || 'N/A'
              };
            }
          } else if (result.scraped?.emails?.length > 0) {
            email = result.scraped.emails[0];
            numero = result.scraped.phones?.[0] || '';
            sourceContact = 'Scraping';
            stats.scraping++;
            
            // Vérifier si c'est un email populaire
            const isPopular = isPopularEmailProvider(email);
            const emailType = isPopular ? '📧 POPULAIRE' : '📧 AUTRE';
            
            allEmails.push(email);
            
            const successCount = stats.whois + stats.scraping;
            const totalProcessed = currentIndex;
            const successRate = ((successCount / totalProcessed) * 100).toFixed(1);
            console.log(`   🕷️  [${currentIndex}/${records.length}] ${domain} - ${emailType} via Scraping: ${email} | 📊 ${successCount}/${totalProcessed} (${successRate}%)`);
            
            // Pas de données WHOIS pour le scraping
            whoisData = {
              whois_organization: 'N/A',
              whois_street1: 'N/A',
              whois_street23: 'N/A',
              whois_locality: 'N/A',
              whois_region: 'N/A',
              whois_postal_code: 'N/A',
              whois_country: 'N/A'
            };
          } else {
            stats.noContact++;
            const successCount = stats.whois + stats.scraping;
            const totalProcessed = currentIndex;
            const successRate = ((successCount / totalProcessed) * 100).toFixed(1);
            console.log(`   ❌ [${currentIndex}/${records.length}] ${domain} - Aucun contact trouvé | 📊 ${successCount}/${totalProcessed} (${successRate}%)`);
            return null;
          }
          
          // Créer l'objet avec seulement les colonnes souhaitées
          const processedRecord = {};
          
          // Mapper les colonnes existantes
          if (record['Nom de domaine']) processedRecord['Nom de domaine'] = record['Nom de domaine'];
          if (record['Pays BE']) processedRecord['Pays BE'] = record['Pays BE'];
          if (record['Nom BE']) processedRecord['Nom BE'] = record['Nom BE'];
          if (record['Sous domaine']) processedRecord['Sous domaine'] = record['Sous domaine'];
          if (record['']) processedRecord[''] = record[''];
          if (record['Date de création']) processedRecord['Date de création'] = record['Date de création'];
          
          // Ajouter les nouvelles données
          processedRecord.email = email;
          processedRecord.numero = numero;
          processedRecord.source_contact = sourceContact;
          processedRecord.whois_organization = whoisData.whois_organization;
          processedRecord.whois_street1 = whoisData.whois_street1;
          processedRecord.whois_street23 = whoisData.whois_street23;
          processedRecord.whois_locality = whoisData.whois_locality;
          processedRecord.whois_region = whoisData.whois_region;
          processedRecord.whois_postal_code = whoisData.whois_postal_code;
          processedRecord.whois_country = whoisData.whois_country;
          
          return processedRecord;
          
        } catch (error) {
          stats.errors++;
          const successCount = stats.whois + stats.scraping;
          const totalProcessed = currentIndex;
          const successRate = ((successCount / totalProcessed) * 100).toFixed(1);
          console.log(`   💥 [${currentIndex}/${records.length}] ${domain} - Erreur: ${error.message} | 📊 ${successCount}/${totalProcessed} (${successRate}%)`);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter(r => r !== null);
      processedRecords.push(...validResults);
      
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = i + batch.length;
      const avgTime = elapsed / progress;
      const remaining = records.length - progress;
      const eta = (remaining * avgTime) / CONCURRENT_REQUESTS;
      const successCount = stats.whois + stats.scraping;
      const successRate = ((successCount / progress) * 100).toFixed(1);
      
      console.log(`\n   📊 PROGRESSION LOT ${Math.floor(i/BATCH_SIZE) + 1}:`);
      console.log(`   ✅ ${validResults.length}/${batch.length} traités avec succès`);
      console.log(`   📈 ${progress}/${records.length} (${(progress/records.length*100).toFixed(1)}%)`);
      console.log(`   🎯 Taux de réussite global: ${successCount}/${progress} (${successRate}%)`);
      console.log(`   ⏱️  ${(elapsed/60).toFixed(1)}min écoulées | ${(eta/60).toFixed(1)}min restantes`);
      console.log(`   📊 WHOIS: ${stats.whois} | Scraping: ${stats.scraping} | Erreurs: ${stats.errors} | Sans contact: ${stats.noContact}`);
      
      // Délai supprimé pour optimiser la vitesse
    }
    
    const csvOutput = stringify(processedRecords, {
      header: true,
      columns: finalColumns,
      delimiter: ';'
    });
    
    fs.writeFileSync(outputFile, csvOutput);
    
    const totalTime = (Date.now() - startTime) / 1000;
    const successCount = stats.whois + stats.scraping;
    const finalSuccessRate = ((successCount / records.length) * 100).toFixed(1);
    
    // Statistiques des fournisseurs d'emails
    const emailProviders = countEmailProviders(allEmails);
    const popularEmails = allEmails.filter(email => isPopularEmailProvider(email));
    const otherEmails = allEmails.filter(email => !isPopularEmailProvider(email));
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 TRAITEMENT TERMINÉ EN ${(totalTime/60).toFixed(1)} MINUTES`);
    console.log(`📊 RÉSULTATS FINAUX:`);
    console.log(`   ✅ Emails trouvés: ${successCount}/${records.length} (${finalSuccessRate}%)`);
    console.log(`   📧 WHOIS/RDAP: ${stats.whois}`);
    console.log(`   🕷️  Scraping: ${stats.scraping}`);
    console.log(`   ❌ Erreurs: ${stats.errors}`);
    console.log(`   🚫 Sans contact: ${stats.noContact}`);
    console.log(`   🚀 Vitesse: ${(records.length/totalTime*60).toFixed(1)} domaines/minute`);
    console.log(`   📈 Taux de réussite final: ${finalSuccessRate}%`);
    
    console.log(`\n📧 STATISTIQUES DES FOURNISSEURS D'EMAILS:`);
    console.log(`   📧 Emails populaires: ${popularEmails.length}/${allEmails.length} (${(popularEmails.length/allEmails.length*100).toFixed(1)}%)`);
    console.log(`   📧 Autres emails: ${otherEmails.length}/${allEmails.length} (${(otherEmails.length/allEmails.length*100).toFixed(1)}%)`);
    
    if (Object.keys(emailProviders).length > 0) {
      console.log(`\n🏆 TOP 10 FOURNISSEURS D'EMAILS:`);
      const sortedProviders = Object.entries(emailProviders)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
      
      sortedProviders.forEach(([provider, count], index) => {
        const percentage = ((count / allEmails.length) * 100).toFixed(1);
        console.log(`   ${index + 1}. ${provider}: ${count} (${percentage}%)`);
      });
    }
    
    console.log(`📁 Sortie: ${outputFile} (${processedRecords.length} lignes)`);
    console.log(`📋 Colonnes finales: ${finalColumns.join(', ')}`);
    console.log(`${'='.repeat(60)}`);
    
  } catch (error) {
    console.error(`❌ Erreur: ${error.message}`);
    throw error;
  }
}

// Fonction principale
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('📖 Usage: node process_csv_domains.cjs [entree.csv] [sortie.csv] [colonne] [delai] [mode]');
    console.log('⚡ Optimisations: 3 requêtes simultanées, cache persistant, timeouts réduits');
    process.exit(1);
  }
  
  const inputFile = args[0];
  const outputFile = args[1];
  const domainColumn = args[2] || 'domain';
  const delay = parseInt(args[3]) || 200;
  const mode = args[4] || 'full';
  
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Fichier non trouvé: ${inputFile}`);
    process.exit(1);
  }
  
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    await processCSVDomainsOptimized(inputFile, outputFile, domainColumn, delay, mode);
  } catch (error) {
    console.error(`❌ Erreur: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { processCSVDomainsOptimized, probeDomainOptimized }; 