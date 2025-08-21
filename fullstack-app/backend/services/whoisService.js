const fs = require('fs');
const path = require('path');
const readline = require('readline');
const whois = require('whois');
const axios = require('axios');
const { promisify } = require('util');
const whoisLookup = promisify(whois.lookup);
const FileService = require('./fileService');

class WhoisAnalyzer {
    constructor(domain) {
        this.domain = domain.toLowerCase().replace(/^https?:\/\//, '');
        this.results = {
            domain: this.domain,
            timestamp: new Date().toISOString(),
            whois_info: {},
            rdap_info: {},
            registrar_contact: {},
            contacts: {},
            errors: []
        };
    }

    async analyze() {
        console.log(`🔍 Début de l'analyse WHOIS/RDAP du domaine: ${this.domain}`);
        
        try {
            // Analyses parallèles pour optimiser les performances
            await Promise.allSettled([
                this.getWhoisInfo(),
                this.getRDAPInfo()
            ]);

            // Analyser les contacts trouvés
            await this.analyzeContacts();
            
        } catch (error) {
            console.error(`❌ Erreur lors de l'analyse: ${error.message}`);
            this.results.errors.push(error.message);
        }
    }

    async analyzeContacts() {
        try {
            console.log('📞 Analyse des contacts...');
            
            const contacts = {
                whois_rdap: null,
                best_email: null,
                best_phone: null,
                source: 'none'
            };

            // 1. Vérifier les contacts RDAP/WHOIS
            if (this.results.rdap_info) {
                contacts.whois_rdap = this.results.rdap_info;
                if (this.results.rdap_info.email) {
                    contacts.best_email = this.results.rdap_info.email;
                    contacts.best_phone = this._cleanPhoneNumber(this.results.rdap_info.phone);
                    contacts.source = 'RDAP';
                    console.log(`  ✅ Contact trouvé via RDAP: ${contacts.best_email}`);
                }
            }

            // 2. Si pas de contact RDAP, essayer WHOIS
            if (!contacts.best_email && this.results.whois_info.registrar_contact) {
                const whoisContact = this.results.whois_info.registrar_contact;
                if (whoisContact.email && !this.isBlockedEmail(whoisContact.email)) {
                    contacts.best_email = whoisContact.email;
                    contacts.best_phone = this._cleanPhoneNumber(whoisContact.phone);
                    contacts.source = 'WHOIS';
                    console.log(`  ✅ Contact trouvé via WHOIS: ${contacts.best_email}`);
                }
            }

            this.results.contacts = contacts;
            
        } catch (error) {
            this.results.errors.push(`Erreur analyse contacts: ${error.message}`);
        }
    }

    async getWhoisInfo() {
        try {
            console.log('📄 Récupération des informations WHOIS...');
            
            const whoisData = await whoisLookup(this.domain);
            
            // Parser les informations WHOIS
            const parsed = this.parseWhoisData(whoisData);
            
            this.results.whois_info = parsed;
            // Ajout : stocker la date de création
            if (parsed.creation_date) {
                this.results.creation_date = parsed.creation_date;
            }
        } catch (error) {
            this.results.errors.push(`Erreur WHOIS: ${error.message}`);
        }
    }

    async getRDAPInfo() {
        try {
            console.log('🔍 Récupération des informations RDAP...');
            
            const rdapSources = [
                `https://rdap.nic.fr/domain/${this.domain}`,
                `https://rdap.afnic.fr/domain/${this.domain}`,
                `https://rdap.arin.net/registry/domain/${this.domain}`
            ];
            
            for (const rdapUrl of rdapSources) {
                try {
                    console.log(`  🔍 Test: ${rdapUrl.split('/').pop()}`);
                    const response = await axios.get(rdapUrl, {
                        timeout: 10000,
                        headers: {
                            'Accept': 'application/rdap+json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        validateStatus: () => true // Accepter tous les codes de statut
                    });
                    
                    if (response.status !== 200) {
                        console.log(`  ❌ Erreur HTTP: ${response.status}`);
                        continue;
                    }
                    
                    const rdapData = response.data;
                    
                    // Chercher dans tous les rôles
                    for (const role of ['registrant', 'administrative', 'tech', 'registrar']) {
                        const entity = rdapData.entities?.find(e => e.roles?.includes(role));
                        if (entity) {
                            console.log(`    👤 Entité ${role} trouvée`);
                            
                            // VCard
                            const vcard = entity.vcardArray?.[1];
                            if (vcard) {
                                const email = vcard.find(a => a[0] === 'email')?.[3];
                                const tel = vcard.find(a => a[0] === 'tel')?.[3];
                                const org = vcard.find(a => a[0] === 'org')?.[3];
                                const adr = vcard.find(a => a[0] === 'adr')?.[3];
                                
                                if (email || tel || org || adr) {
                                    console.log(`    📧 Email: ${email || 'Non trouvé'}`);
                                    console.log(`    📞 Téléphone: ${tel || 'Non trouvé'}`);
                                    console.log(`    🏢 Organisation: ${org || 'Non trouvé'}`);
                                    console.log(`    📍 Adresse: ${adr || 'Non trouvé'}`);
                                    
                                    // Vérifier si l'email n'est pas un domaine de protection
                                    if (email && !this.isBlockedEmail(email)) {
                                        console.log(`    ✅ Email valide (non-protégé): ${email}`);
                                        this.results.rdap_info = {
                                            role: role,
                                            email: email,
                                            phone: this._cleanPhoneNumber(tel),
                                            organization: org,
                                            address: adr,
                                            source: rdapUrl,
                                            raw_data: rdapData
                                        };
                                        return; // On a trouvé un contact valide, on arrête
                                    } else if (email) {
                                        console.log(`    ⚠️  Email protégé détecté: ${email}`);
                                    }
                                }
                            }
                            
                            // Autres champs possibles
                            if (entity.email && !this.isBlockedEmail(entity.email)) {
                                console.log(`    📧 Email direct valide: ${entity.email}`);
                                this.results.rdap_info = {
                                    role: role,
                                    email: entity.email,
                                    phone: this._cleanPhoneNumber(entity.phone),
                                    organization: entity.organization,
                                    address: entity.address,
                                    source: rdapUrl,
                                    raw_data: rdapData
                                };
                                return; // On a trouvé un contact valide, on arrête
                            } else if (entity.email) {
                                console.log(`    ⚠️  Email direct protégé: ${entity.email}`);
                            }
                        }
                    }
                    
                } catch (error) {
                    console.log(`  ❌ Erreur: ${error.message}`);
                }
            }
            
            console.log('  ⚠️ Aucune information RDAP trouvée');
            
        } catch (error) {
            console.log(`  ❌ Erreur générale RDAP: ${error.message}`);
        }
    }

    // Nouvelle méthode unifiée : blocage des emails de privacy et fournisseurs
    isBlockedEmail(email) {
        if (!email) return false;
        const emailLower = email.toLowerCase();
        const [local, domain] = emailLower.split('@');
        if (!domain) return false;
        // Liste globale des domaines à bloquer (privacy + fournisseurs)
        const BLOCKED_EMAIL_DOMAINS = [
            // Privacy/proxy
            'hostinger.com', 'ovh.com', 'ovh.net', 'planethoster.info', 'ionos.com', '1und1.de',
            'gandi.net', 'o2switch.fr', 'spamfree.bookmyname.com', 'afnic.fr', 'nic.fr',
            'whoisguard.com', 'domainsbyproxy.com', 'privacyprotect.org', 'privatewhois.com',
            'netim.com', 'free.org', 'one.com', 'amen.fr', 'openprovider.com',
            'tldregistrarsolutions.com', 'lws.fr', 'infomaniak.com', 'key-systems.net', 'dsi.cnrs.fr',
            // Fournisseurs/registrars
            'catched.com', 'cliken-web.com', 'bloomup.net', 'domainorder.com', 'incomm.fr',
            'epag.de', 'nameshield.net', 'tool-domains.com', 'nomio24.com', 'info100t.fr',
            'local.fr', 'internetx.com', 'biim-com.com', 'kifcorp.fr', 'casalonga.com',
        ];
        // Mots-clés à bloquer dans l'email (local ou domaine)
        const BLOCKED_KEYWORDS = [
            'ovh', 'ionos', '1und1', 'o2switch', 'histinger', 'whois', 'privacy', 'protect', 'guard', 'proxy',
            'domain', 'dns', 'support', 'info', 'registrar'
        ];
        // Blocage par domaine exact ou sous-domaine
        if (BLOCKED_EMAIL_DOMAINS.some(blockedDomain => 
            domain === blockedDomain || domain.endsWith('.' + blockedDomain)
        )) {
            return true;
        }
        // Blocage par mot-clé dans l'email (local ou domaine)
        if (BLOCKED_KEYWORDS.some(kw => emailLower.includes(kw))) return true;
        return false;
    }

    // Méthode utilitaire pour nettoyer les numéros de téléphone
    _cleanPhoneNumber(phone) {
        if (!phone) return '';
        // Supprimer les préfixes comme "tel:", "phone:", etc.
        const cleaned = phone.toString().replace(/^(tel|phone|telephone):\s*/i, '');
        return cleaned.trim();
    }

    parseWhoisData(whoisData) {
        const lines = whoisData.split('\n');
        const parsed = {};
        
        for (const line of lines) {
            const [key, ...values] = line.split(':').map(s => s.trim());
            if (key && values.length > 0) {
                const value = values.join(':').trim();
                parsed[key.toLowerCase()] = value;
            }
        }
        
        // Recherche de la date de création
        let creationDate = null;
        const creationKeys = [
            'creation date',
            'created',
            'created on',
            'domain registration date',
            'registration date',
            'createdate',
            'domain create date',
            'domain created',
            'date de creation',
            'date création',
            'date de création'
        ];
        for (const key of creationKeys) {
            if (parsed[key]) {
                creationDate = parsed[key];
                break;
            }
        }
        // Recherche des informations de contact du registrar
        const registrarContactPatterns = {
            email: [
                /registrar.*email/i,
                /registrar.*contact.*email/i,
                /registrar.*e-mail/i,
                /registrar.*mail/i
            ],
            phone: [
                /registrar.*phone/i,
                /registrar.*tel/i,
                /registrar.*telephone/i,
                /registrar.*contact.*phone/i
            ],
            address: [
                /registrar.*address/i,
                /registrar.*street/i,
                /registrar.*location/i,
                /registrar.*contact.*address/i
            ],
            website: [
                /registrar.*url/i,
                /registrar.*website/i,
                /registrar.*web/i
            ]
        };
        
        // Recherche du registrar
        const registrarPatterns = [/registrar/i, /registrar name/i, /sponsoring registrar/i];
        for (const pattern of registrarPatterns) {
            for (const [key, value] of Object.entries(parsed)) {
                if (pattern.test(key) && value) {
                    parsed.registrar = value;
                    break;
                }
            }
            if (parsed.registrar) break;
        }
        
        // Recherche des informations de contact du registrar
        const registrarContact = {};
        for (const [contactType, patterns] of Object.entries(registrarContactPatterns)) {
            for (const pattern of patterns) {
                for (const [key, value] of Object.entries(parsed)) {
                    if (pattern.test(key) && value) {
                        registrarContact[contactType] = value;
                        break;
                    }
                }
                if (registrarContact[contactType]) break;
            }
        }
        
        // Recherche d'emails dans les données brutes (pattern général)
        if (!registrarContact.email) {
            const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const emails = whoisData.match(emailPattern);
            if (emails && emails.length > 0) {
                // Filtrer les emails qui semblent être du registrar
                const registrarEmails = emails.filter(email => 
                    email.toLowerCase().includes('registrar') ||
                    email.toLowerCase().includes('whois') ||
                    email.toLowerCase().includes('domain') ||
                    email.toLowerCase().includes('support')
                );
                if (registrarEmails.length > 0) {
                    registrarContact.email = registrarEmails[0];
                }
            }
        }
        
        // Recherche de numéros de téléphone dans les données brutes
        if (!registrarContact.phone) {
            const phonePattern = /[\+]?[1-9][\d]{0,15}/g;
            const phones = whoisData.match(phonePattern);
            if (phones && phones.length > 0) {
                // Chercher des lignes contenant "phone" ou "tel" avec un numéro
                const phoneLines = whoisData.split('\n').filter(line => 
                    (line.toLowerCase().includes('phone') || line.toLowerCase().includes('tel')) &&
                    line.match(/[\+]?[1-9][\d]{0,15}/)
                );
                if (phoneLines.length > 0) {
                    const phoneMatch = phoneLines[0].match(/[\+]?[1-9][\d]{0,15}/);
                    if (phoneMatch) {
                        registrarContact.phone = this._cleanPhoneNumber(phoneMatch[0]);
                    }
                }
            }
        }
        
        return {
            registrar: parsed.registrar || parsed.registrar_name,
            registrar_contact: registrarContact,
            creation_date: creationDate,
            raw_data: whoisData
        };
    }
}

class WhoisService {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.fileService = new FileService();
        this.jobs = {}; // jobId -> { cancel: false }
    }

    // --- Méthodes utilitaires factorisées ---
    async _extractDomainsFromCsv(inputCsvPath) {
        const domains = [];
        const rl = readline.createInterface({
            input: fs.createReadStream(inputCsvPath),
            crlfDelay: Infinity
        });
        let isFirst = true;
        for await (const line of rl) {
            if (isFirst) { isFirst = false; continue; }
            const domain = line.trim();
            if (domain) domains.push(domain);
        }
        rl.close();
        return domains;
    }

    _filterValidResults(results) {
        return results.filter(row => {
            const analyzer = row.analyzer;
            const email = row.email;
            if (!email) return false;
            if (analyzer && analyzer.isBlockedEmail(email)) return false;
            return true;
        });
    }

    _formatDate(dateString) {
        if (!dateString) return '';
        let d = new Date(dateString);
        if (!isNaN(d)) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        }
        return dateString;
    }

    _extractAddress(rdap, whois) {
        let street1 = '', locality = '', region = '', postal = '', country = '';
        if (rdap && rdap.address) {
            if (Array.isArray(rdap.address)) {
                street1 = rdap.address[2] || '';
                locality = rdap.address[3] || '';
                region = rdap.address[4] || '';
                postal = rdap.address[5] || '';
                country = rdap.address[6] || '';
            } else if (typeof rdap.address === 'string') {
                street1 = rdap.address;
            }
        } else if (whois && whois.address) {
            street1 = whois.address;
        }
        return { street1, locality, region, postal, country };
    }

    _generateWhoisCsv(outputCsvPath, results) {
        const csvHeaders = [
            'Nom de domaine',
            'Date de création',
            'email',
            'numero',
            'whois_organization',
            'whois_street1',
            'whois_locality',
            'whois_region',
            'whois_postal_code',
            'whois_country'
        ];
        const csvLines = [csvHeaders.join(',')];
        for (let i = 0; i < results.length; i++) {
            const row = results[i];
            const analyzer = row.analyzer;
            const whois = analyzer?.results.whois_info || {};
            const rdap = analyzer?.results.rdap_info || {};
            let creationDate = this._formatDate(analyzer?.results.creation_date || '');
            const org = rdap.organization || whois.registrar || '';
            const { street1, locality, region, postal, country } = this._extractAddress(rdap, whois);
            csvLines.push([
                row.domain,
                creationDate,
                row.email,
                row.phone,
                org,
                street1,
                locality,
                region,
                postal,
                country
            ].map(v => v ? String(v).replace(/,/g, ' ') : '').join(','));
        }
        fs.writeFileSync(outputCsvPath, csvLines.join('\n'), 'utf8');
    }

    // --- Fin méthodes utilitaires ---

    // Nouvelle méthode pour le streaming SSE
    async analyzeCsvFileStream(jobId, inputCsvName, sendLog) {
        console.log('--- APPEL analyzeCsvFileStream ---', jobId, inputCsvName);
        console.log(`[WHOIS] Démarrage analyseCsvFileStream jobId=${jobId} fichier=${inputCsvName}`);
        const inputCsvPath = path.join(this.dataDir, inputCsvName);
        if (!fs.existsSync(inputCsvPath)) {
            console.log(`[WHOIS] Fichier introuvable: ${inputCsvName}`);
            sendLog('error', `Fichier introuvable: ${inputCsvName}`);
            return;
        }
        await this.fileService.updateFileInfo(inputCsvName, { traitement: 'whois' });
        const domains = await this._extractDomainsFromCsv(inputCsvPath);
        if (domains.length === 0) {
            console.log(`[WHOIS] Aucun domaine trouvé dans le fichier CSV.`);
            sendLog('error', 'Aucun domaine trouvé dans le fichier CSV.');
            return;
        }
        const baseName = inputCsvName.replace(/\.csv$/i, '');
        const outputCsvName = baseName + '_whois.csv';
        const outputCsvPath = path.join(this.dataDir, outputCsvName);
        const stats = {
            total: domains.length,
            processed: 0,
            emailsFound: 0,
            phonesFound: 0,
            contactsFound: 0,
            errors: 0,
            startTime: Date.now()
        };
        const displayStats = () => {
            const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
            const progress = ((stats.processed / stats.total) * 100).toFixed(1);
            const rate = stats.processed > 0 ? Math.floor(stats.processed / (elapsed / 60)) : 0;
            const statsText = [
                '\n' + '='.repeat(60),
                `📊 STATISTIQUES WHOIS - ${new Date().toLocaleString()}`,
                '='.repeat(60),
                `📈 Progression: ${stats.processed}/${stats.total} (${progress}%)`,
                `⏱️  Temps écoulé: ${elapsed}s | Vitesse: ${rate} domaines/min`,
                `📧 Emails trouvés: ${stats.emailsFound}`,
                `📞 Téléphones trouvés: ${stats.phonesFound}`,
                `✅ Contacts trouvés: ${stats.contactsFound}`,
                `❌ Erreurs: ${stats.errors}`,
                `📊 Taux de succès: ${stats.processed > 0 ? ((stats.contactsFound / stats.processed) * 100).toFixed(1) : 0}%`,
                '='.repeat(60) + '\n'
            ].join('\n');
            console.log(statsText);
            sendLog('stats', statsText);
        };
        const results = [];
        this.jobs[jobId] = { cancel: false };
        console.log(`🚀 Démarrage de l'analyse WHOIS sur ${domains.length} domaines...`);
        displayStats();
        for (const domain of domains) {
            if (this.jobs[jobId]?.cancel) {
                console.log(`[WHOIS] Annulation demandée pour jobId=${jobId}`);
                sendLog('cancel', "Traitement annulé par l'utilisateur.");
                break;
            }
            stats.processed++;
            try {
                const analyzer = new WhoisAnalyzer(domain);
                await analyzer.analyze();
                const email = analyzer.results.contacts?.best_email || '';
                const phone = analyzer.results.contacts?.best_phone || '';
                if (email || phone) {
                    stats.contactsFound++;
                    sendLog('success', `✅ [${stats.processed}/${stats.total}] ${domain} - 📧 ${email} | 📞 ${phone}`);
                    console.log(`[WHOIS] Succès: ${domain} - ${email} | ${phone}`);
                } else {
                    sendLog('warn', `❌ [${stats.processed}/${stats.total}] ${domain} - Aucun contact trouvé`);
                    console.log(`[WHOIS] Aucun contact trouvé pour: ${domain}`);
                }
                results.push({ 
                    domain, 
                    email, 
                    phone,
                    analyzer: analyzer
                });
            } catch (error) {
                stats.errors++;
                console.log(`[WHOIS] Erreur pour ${domain}: ${error.message}`);
                results.push({ domain, email: '', phone: '', analyzer: null });
            }
            if (stats.processed % 100 === 0 || stats.processed === stats.total) {
                displayStats();
            }
        }
        if (!this.jobs[jobId]?.cancel) {
            const filteredResults = this._filterValidResults(results);
            this._generateWhoisCsv(outputCsvPath, filteredResults);
            fs.unlinkSync(inputCsvPath);
            await this.fileService.updateFileLineCount(outputCsvName);
            await this.fileService.removeFileFromRegistry(inputCsvName);
            sendLog('refresh', 'Actualisation de la liste des fichiers...');
            console.log('\n' + '🎉 TRAITEMENT TERMINÉ ' + '🎉'.repeat(10));
            displayStats();
            console.log(`📁 Fichier généré: ${outputCsvName}`);
            sendLog('done', `Fichier Whois généré : ${outputCsvName}`);
            console.log(`[WHOIS] Fichier Whois généré : ${outputCsvName}`);
        } else {
            console.log(`[WHOIS] Traitement annulé pour jobId=${jobId}`);
            await this.fileService.updateFileInfo(inputCsvName, { traitement: '' });
        }
        delete this.jobs[jobId];
        console.log(`[WHOIS] Fin du jobId=${jobId}`);
    }

    // Pour l'annulation
    cancelJob(jobId) {
        if (this.jobs[jobId]) {
            this.jobs[jobId].cancel = true;
        }
    }

    // (ancienne méthode inchangée)
    async analyzeCsvFile(inputCsvName) {
        await this.fileService.updateFileInfo(inputCsvName, { traitement: 'whois' });
        try {
            const inputCsvPath = path.join(this.dataDir, inputCsvName);
            if (!fs.existsSync(inputCsvPath)) {
                throw new Error(`Fichier introuvable: ${inputCsvName}`);
            }
            const domains = await this._extractDomainsFromCsv(inputCsvPath);
            if (domains.length === 0) {
                throw new Error('Aucun domaine trouvé dans le fichier CSV.');
            }
            const baseName = inputCsvName.replace(/\.csv$/i, '');
            const outputCsvName = baseName + '_whois.csv';
            const outputCsvPath = path.join(this.dataDir, outputCsvName);
            const results = [];
            for (const domain of domains) {
                const analyzer = new WhoisAnalyzer(domain);
                await analyzer.analyze();
                const email = analyzer.results.contacts?.best_email || '';
                const phone = analyzer.results.contacts?.best_phone || '';
                results.push({ domain, email, phone, analyzer });
            }
            const filteredResults = this._filterValidResults(results);
            this._generateWhoisCsv(outputCsvPath, filteredResults);
            fs.unlinkSync(inputCsvPath);
            await this.fileService.updateFileLineCount(outputCsvName);
            await this.fileService.removeFileFromRegistry(inputCsvName);
            await this.fileService.updateFileInfo(inputCsvName, { traitement: '' });
            return outputCsvName;
        } catch (error) {
            await this.fileService.updateFileInfo(inputCsvName, { traitement: '' });
            throw error;
        }
    }

    // Nouvelle méthode : analyse d'un seul domaine (retourne le résultat structuré)
    async analyzeSingleDomain(domain) {
        const analyzer = new WhoisAnalyzer(domain);
        await analyzer.analyze();
        return analyzer.results;
    }
}

module.exports = WhoisService; 