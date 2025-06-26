const fs = require('fs');
const path = require('path');
const whois = require('whois');
const axios = require('axios');
const { promisify } = require('util');
const whoisLookup = promisify(whois.lookup);

class DomainAnalyzer {
    constructor(domain) {
        this.domain = domain.toLowerCase().replace(/^https?:\/\//, '');
        this.results = {
            domain: this.domain,
            timestamp: new Date().toISOString(),
            whois_info: {},
            rdap_info: {},
            registrar_contact: {},
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

            this.printResults();
            this.saveResults();
            
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
                    contacts.best_phone = this.results.rdap_info.phone;
                    contacts.source = 'RDAP';
                    console.log(`  ✅ Contact trouvé via RDAP: ${contacts.best_email}`);
                }
            }

            // 2. Si pas de contact RDAP, essayer WHOIS
            if (!contacts.best_email && this.results.whois_info.registrar_contact) {
                const whoisContact = this.results.whois_info.registrar_contact;
                if (whoisContact.email && !this.isPrivacyEmail(whoisContact.email)) {
                    contacts.best_email = whoisContact.email;
                    contacts.best_phone = whoisContact.phone;
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
                                    if (email && !this.isPrivacyEmail(email)) {
                                        console.log(`    ✅ Email valide (non-protégé): ${email}`);
                                        this.results.rdap_info = {
                                            role: role,
                                            email: email,
                                            phone: tel,
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
                            if (entity.email && !this.isPrivacyEmail(entity.email)) {
                                console.log(`    📧 Email direct valide: ${entity.email}`);
                                this.results.rdap_info = {
                                    role: role,
                                    email: entity.email,
                                    phone: entity.phone,
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

    // Méthode pour détecter les emails protégés (inspirée de process_csv_domains.cjs)
    isPrivacyEmail(email) {
        if (!email) return false;
        const domain = email.split('@')[1]?.toLowerCase();
        
        // Liste des domaines de protection/privacy connus
        const PRIVACY_DOMAINS = [
            'hostinger.com',
            'ovh.com',
            'ovh.net',
            'planethoster.info',
            'ionos.com',
            '1und1.de',
            'gandi.net',
            'o2switch.fr',
            'spamfree.bookmyname.com',
            'afnic.fr',
            'nic.fr',
            'whoisguard.com',
            'domainsbyproxy.com',
            'privacyprotect.org',
            'privatewhois.com',
            'netim.com',
            'free.org',
            'one.com',
            'amen.fr',
            'openprovider.com',
            'tldregistrarsolutions.com',
            'lws.fr',
            'infomaniak.com',
            'key-systems.net',
            'dsi.cnrs.fr'
        ];
        
        // Vérifier les domaines exacts
        if (PRIVACY_DOMAINS.some(privacyDomain => 
            domain === privacyDomain || domain.endsWith('.' + privacyDomain)
        )) {
            return true;
        }
        
        // Vérifier les mots-clés dans le domaine
        const privacyKeywords = ['ovh', 'ionos', '1und1', 'o2switch', 'histinger', 'whois', 'privacy', 'protect', 'guard', 'proxy'];
        return privacyKeywords.some(keyword => domain.includes(keyword));
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
        
        // Recherche plus approfondie des dates et informations
        const creationDatePatterns = [
            /creation date/i,
            /created/i,
            /registration date/i,
            /registered/i,
            /domain registration date/i
        ];
        
        const expirationDatePatterns = [
            /expiration date/i,
            /expires/i,
            /expiry date/i,
            /registry expiry date/i,
            /domain expiration date/i
        ];
        
        const updatedDatePatterns = [
            /updated date/i,
            /last updated/i,
            /modified/i,
            /last modified/i
        ];
        
        const registrarPatterns = [
            /registrar/i,
            /registrar name/i,
            /sponsoring registrar/i
        ];
        
        const statusPatterns = [
            /status/i,
            /domain status/i
        ];
        
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
        
        // Recherche des dates de création
        for (const pattern of creationDatePatterns) {
            for (const [key, value] of Object.entries(parsed)) {
                if (pattern.test(key) && value) {
                    parsed.creation_date = value;
                    break;
                }
            }
            if (parsed.creation_date) break;
        }
        
        // Recherche des dates d'expiration
        for (const pattern of expirationDatePatterns) {
            for (const [key, value] of Object.entries(parsed)) {
                if (pattern.test(key) && value) {
                    parsed.expiration_date = value;
                    break;
                }
            }
            if (parsed.expiration_date) break;
        }
        
        // Recherche des dates de mise à jour
        for (const pattern of updatedDatePatterns) {
            for (const [key, value] of Object.entries(parsed)) {
                if (pattern.test(key) && value) {
                    parsed.updated_date = value;
                    break;
                }
            }
            if (parsed.updated_date) break;
        }
        
        // Recherche du registrar
        for (const pattern of registrarPatterns) {
            for (const [key, value] of Object.entries(parsed)) {
                if (pattern.test(key) && value) {
                    parsed.registrar = value;
                    break;
                }
            }
            if (parsed.registrar) break;
        }
        
        // Recherche du statut
        for (const pattern of statusPatterns) {
            for (const [key, value] of Object.entries(parsed)) {
                if (pattern.test(key) && value) {
                    parsed.status = value;
                    break;
                }
            }
            if (parsed.status) break;
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
                        registrarContact.phone = phoneMatch[0];
                    }
                }
            }
        }
        
        return {
            registrar: parsed.registrar || parsed.registrar_name,
            creation_date: parsed.creation_date || parsed.created,
            expiration_date: parsed.expiration_date || parsed.expires,
            updated_date: parsed.updated_date || parsed.last_updated,
            status: parsed.status,
            name_servers: parsed.name_server || parsed.nameservers,
            admin_email: parsed.admin_email || parsed.admin_contact,
            tech_email: parsed.tech_email || parsed.tech_contact,
            registrar_contact: registrarContact,
            raw_data: whoisData
        };
    }

    printResults() {
        console.log('\n' + '='.repeat(80));
        console.log(`📊 RÉSULTATS DE L'ANALYSE WHOIS/RDAP POUR: ${this.domain.toUpperCase()}`);
        console.log('='.repeat(80));
        
        // WHOIS - Informations détaillées
        if (this.results.whois_info && Object.keys(this.results.whois_info).length > 0) {
            console.log('\n📄 INFORMATIONS WHOIS:');
            if (this.results.whois_info.registrar) {
                console.log(`   • Registrar: ${this.results.whois_info.registrar}`);
            }
            if (this.results.whois_info.creation_date) {
                console.log(`   • Date de création: ${this.results.whois_info.creation_date}`);
            }
            if (this.results.whois_info.expiration_date) {
                console.log(`   • Date d'expiration: ${this.results.whois_info.expiration_date}`);
            }
            if (this.results.whois_info.updated_date) {
                console.log(`   • Dernière mise à jour: ${this.results.whois_info.updated_date}`);
            }
            if (this.results.whois_info.status) {
                console.log(`   • Statut: ${this.results.whois_info.status}`);
            }
            if (this.results.whois_info.name_servers) {
                console.log(`   • Serveurs de noms: ${this.results.whois_info.name_servers}`);
            }
            if (this.results.whois_info.admin_email) {
                console.log(`   • Email admin: ${this.results.whois_info.admin_email}`);
            }
            if (this.results.whois_info.tech_email) {
                console.log(`   • Email technique: ${this.results.whois_info.tech_email}`);
            }
            
            // Informations de contact du registrar
            if (this.results.whois_info.registrar_contact && Object.keys(this.results.whois_info.registrar_contact).length > 0) {
                console.log('\n📞 CONTACT DU REGISTRAR (WHOIS):');
                if (this.results.whois_info.registrar_contact.email) {
                    console.log(`   • Email: ${this.results.whois_info.registrar_contact.email}`);
                }
                if (this.results.whois_info.registrar_contact.phone) {
                    console.log(`   • Téléphone: ${this.results.whois_info.registrar_contact.phone}`);
                }
                if (this.results.whois_info.registrar_contact.address) {
                    console.log(`   • Adresse: ${this.results.whois_info.registrar_contact.address}`);
                }
                if (this.results.whois_info.registrar_contact.website) {
                    console.log(`   • Site web: ${this.results.whois_info.registrar_contact.website}`);
                }
            }
        }
        
        // Informations RDAP
        if (this.results.rdap_info) {
            console.log('\n🔍 INFORMATIONS RDAP:');
            console.log(`   • Rôle: ${this.results.rdap_info.role}`);
            if (this.results.rdap_info.email) {
                console.log(`   • Email: ${this.results.rdap_info.email}`);
            }
            if (this.results.rdap_info.phone) {
                console.log(`   • Téléphone: ${this.results.rdap_info.phone}`);
            }
            if (this.results.rdap_info.organization) {
                console.log(`   • Organisation: ${this.results.rdap_info.organization}`);
            }
            if (this.results.rdap_info.address) {
                console.log(`   • Adresse: ${this.results.rdap_info.address}`);
            }
            console.log(`   • Source: ${this.results.rdap_info.source}`);
        }
        
        // Contacts trouvés
        if (this.results.contacts && this.results.contacts.best_email) {
            console.log('\n📞 CONTACTS TROUVÉS:');
            console.log(`   • Meilleur email: ${this.results.contacts.best_email}`);
            if (this.results.contacts.best_phone) {
                console.log(`   • Téléphone: ${this.results.contacts.best_phone}`);
            }
            console.log(`   • Source: ${this.results.contacts.source}`);
        } else {
            console.log('\n📞 CONTACTS:');
            console.log(`   • Aucun contact valide trouvé`);
        }
        
        // Erreurs
        if (this.results.errors.length > 0) {
            console.log('\n⚠️ ERREURS:');
            this.results.errors.forEach(error => {
                console.log(`   • ${error}`);
            });
        }
        
        console.log('\n' + '='.repeat(80));
    }

    saveResults() {
        const outputDir = path.join(__dirname, '..', 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const filename = `whois_analysis_${this.domain}_${new Date().toISOString().split('T')[0]}.json`;
        const filepath = path.join(outputDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2), 'utf8');
        console.log(`💾 Résultats sauvegardés dans: ${filepath}`);
    }
}

// Fonction principale
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node analyze_domain.cjs <domaine>');
        console.log('Exemple: node analyze_domain.cjs example.com');
        process.exit(1);
    }
    
    const domain = args[0];
    
    if (!domain || domain.trim() === '') {
        console.error('❌ Veuillez fournir un nom de domaine valide');
        process.exit(1);
    }
    
    const analyzer = new DomainAnalyzer(domain);
    await analyzer.analyze();
}

// Exécuter si appelé directement
if (require.main === module) {
    main().catch(console.error);
}

module.exports = DomainAnalyzer; 