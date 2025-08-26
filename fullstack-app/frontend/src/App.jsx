import React, { useState, useEffect } from 'react';
import { 
  CloudArrowDownIcon, 
  DocumentTextIcon, 
  Cog6ToothIcon, 
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  DocumentArrowDownIcon,
  ArrowsPointingInIcon,
  EyeIcon,
  TrashIcon,
  SparklesIcon,
  GlobeAltIcon,
  ServerIcon,
  FolderIcon,
  CheckIcon,
  ArrowPathRoundedSquareIcon,
  ArrowUpTrayIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  DocumentDuplicateIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { v4 as uuidv4 } from 'uuid';
import Login from './Login.jsx';

function App() {
  const [scriptsInfo, setScriptsInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [opendataLoading, setOpendataLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [message, setMessage] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);

  // États pour les formulaires
  const [opendataForm, setOpendataForm] = useState({ mode: 'auto', month: '' });
  const [dailyForm, setDailyForm] = useState({ mode: 'last7days', days: 1 });
  const [dailyDomainsForm, setDailyDomainsForm] = useState({ mode: 'yesterday', days: 1 });
  
  // États pour les nouveaux filtres
  const [dateFilterForm, setDateFilterForm] = useState({ startDate: '', endDate: '' });
  const [locationFilterForm, setLocationFilterForm] = useState({ type: 'ville', value: '' });

  // Ajouter l'état pour l'aperçu CSV
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvPreviewLoading, setCsvPreviewLoading] = useState(false);
  const [fileMetadata, setFileMetadata] = useState({});
  const [metadataLoading, setMetadataLoading] = useState({});

  // États pour la sélection multiple
  const [selectedFiles, setSelectedFiles] = useState(new Set());

  // Ajout d'un état pour la suppression (nom du fichier à supprimer)
  const [fileToDelete, setFileToDelete] = useState(null);
  
  // État pour la confirmation d'arrêt de campagne
  const [campaignToStop, setCampaignToStop] = useState(null);

  // État pour les jobs Whois (par fichier)
  const [whoisJobs, setWhoisJobs] = useState({});

  const [processFile, setProcessFile] = useState(null);

  // États pour la gestion des dates
  const [datesLoading, setDatesLoading] = useState(false);
  const [datesStats, setDatesStats] = useState(null);

  // État pour l'import de fichiers
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(null);

  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  // Ajouter l'état pour la modale d'aperçu
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewFileName, setPreviewFileName] = useState(null);

  // État pour la recherche Whois/RDAP sur un domaine
  const [whoisInput, setWhoisInput] = useState("");
  const [whoisLoading, setWhoisLoading] = useState(false);
  const [whoisResult, setWhoisResult] = useState(null);

  // États pour la modale des statistiques
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedFileForStats, setSelectedFileForStats] = useState(null);

  // États pour MillionVerifier
  const [millionVerifierLoading, setMillionVerifierLoading] = useState(false);
  const [millionVerifierResults, setMillionVerifierResults] = useState(null);
  const [millionVerifierFile, setMillionVerifierFile] = useState(null);

  // États pour le Scheduler
  const [schedulerLoading, setSchedulerLoading] = useState(false);

  // États pour afficher plus de fichiers
  const [filesToShow, setFilesToShow] = useState(9);
  const [loadingMore, setLoadingMore] = useState(false);

  // Nouvel état pour les onglets
  const [activeTab, setActiveTab] = useState('domains');

  // États pour les campagnes SmartLeads
  const [campaigns, setCampaigns] = useState([]);
  const [campaignStats, setCampaignStats] = useState(null);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [campaignActionLoading, setCampaignActionLoading] = useState({});

  // États pour l'import des leads
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedCampaignForImport, setSelectedCampaignForImport] = useState(null);

  // États pour la modal des comptes email
  const [emailAccountsModalOpen, setEmailAccountsModalOpen] = useState(false);
  const [selectedCampaignForEmailAccounts, setSelectedCampaignForEmailAccounts] = useState(null);
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [emailAccountsLoading, setEmailAccountsLoading] = useState(false);
  const [emailAccountsSaving, setEmailAccountsSaving] = useState(false);
  const [selectedEmailAccounts, setSelectedEmailAccounts] = useState(new Set());
  const [emailAccountsSearchTerm, setEmailAccountsSearchTerm] = useState('');
  
  // États pour les fichiers CSV
  const [csvFiles, setCsvFiles] = useState([]);
  const [csvFilesLoading, setCsvFilesLoading] = useState(false);
  const [selectedCsvFile, setSelectedCsvFile] = useState(null);

  // Ajout de la vérification d'authentification au chargement
  useEffect(() => {
    const checkAuth = async () => {
      const sessionId = localStorage.getItem('sessionId');
      if (!sessionId) {
        setAuthenticated(false);
        setCheckingAuth(false);
        return;
      }
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/status`, {
          headers: { 'x-session-id': sessionId }
        });
        const data = await res.json();
        setAuthenticated(!!data.authenticated);
      } catch {
        setAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  // Wrapper fetch pour ajouter le sessionId automatiquement
  const authFetch = (url, options = {}) => {
    const sessionId = localStorage.getItem('sessionId');
    const headers = { ...(options.headers || {}), 'x-session-id': sessionId };
    return fetch(url, { ...options, headers });
  };

  // Gestion de la déconnexion
  const handleLogout = async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'x-session-id': sessionId }
      });
      localStorage.removeItem('sessionId');
    }
    setAuthenticated(false);
  };

  // Effet pour charger les données de l'app quand authentifié
  useEffect(() => {
    if (authenticated) {
      fetchScriptsInfo();
      fetchStats();
      fetchFiles();
      fetchDatesStats();
      fetchCampaigns();
    }
  }, [authenticated]);

  // Effet pour charger les métadonnées des fichiers quand la liste change (seulement si nécessaire)
  // DÉSACTIVÉ : Les métadonnées sont déjà disponibles dans le registre files-registry.json
  // useEffect(() => {
  //   if (authenticated && files.length > 0 && files.length <= 10) {
  //     // Vérifier si certains fichiers n'ont pas totalLines dans le registre
  //     const filesWithoutLines = files.filter(file => !file.totalLines);
  //     if (filesWithoutLines.length > 0) {
  //       const timeoutId = setTimeout(() => {
  //         fetchFileMetadata();
  //       }, 500);
  //       
  //       return () => clearTimeout(timeoutId);
  //     }
  //   }
  // }, [files, authenticated]);

  // Effet pour le timer des jobs Whois
  useEffect(() => {
    // Calcul dynamique des stats à partir des logs
    let processed = 0, total = 0, emails = 0;
    let isWhoisTerminal = false;
    let whoisJob = null;
    
    if (Array.isArray(files)) {
      files.forEach(file => {
        const job = whoisJobs[file.name];
        if (job && (job.inProgress || (job.logs && job.logs.length > 0))) {
          isWhoisTerminal = true;
          whoisJob = job;
        }
      });
    }
    
    let timer;
    if (isWhoisTerminal && whoisJob?.inProgress) {
      timer = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(timer);
  }, [files, whoisJobs]);

  // Si non authentifié, afficher la page de connexion
  if (checkingAuth) {
    return <div className="flex items-center justify-center min-h-screen text-white text-lg">Chargement...</div>;
  }
  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  const fetchScriptsInfo = async () => {
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/scripts/info`); 
      const data = await response.json();
      setScriptsInfo(data);
    } catch (error) {
      console.error('Erreur lors du chargement des informations:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    }
  };

  const fetchFiles = async () => {
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/files/list`);
      const data = await response.json();
      // Fusionner sans doublons (par nom de fichier)
      const allFiles = [...data.data, ...data.output];
      const uniqueFiles = allFiles.filter(
        (file, index, self) =>
          index === self.findIndex(f => f.name === file.name)
      );
      
      // Les fichiers contiennent déjà totalLines depuis le registre
      setFiles(uniqueFiles);
      
      // Réinitialiser l'affichage des fichiers quand de nouveaux fichiers sont chargés
      setFilesToShow(9);
      
      // Pré-remplir les métadonnées avec les données du registre
      const initialMetadata = {};
      uniqueFiles.forEach(file => {
        if (file.totalLines !== undefined) {
          initialMetadata[file.name] = {
            totalLines: file.totalLines,
            category: file.category,
            fileType: file.type,
            isOpendata: file.isOpendata,
            isDaily: file.isDaily,
            isDomains: file.isDomains,
            isValides: file.isValides,
            isWhois: file.isWhois,
            isDateFiltered: file.isDateFiltered
          };
        }
      });
      setFileMetadata(prev => ({ ...prev, ...initialMetadata }));
      
    } catch (error) {
      console.error('Erreur lors du chargement des fichiers:', error);
    }
  };

  // Fonctions pour les campagnes SmartLeads
  const fetchCampaigns = async () => {
    try {
      setCampaignsLoading(true);
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/campaigns`);
      const data = await response.json();
      
      // L'API retourne directement un tableau de campagnes
      if (Array.isArray(data)) {
        setCampaigns(data);
        // Calculer les stats à partir des campagnes
        const stats = {
          totalCampaigns: data.length,
          draftedCampaigns: data.filter(c => c.status === 'DRAFTED').length,
          activeCampaigns: data.filter(c => c.status === 'ACTIVE').length,
          pausedCampaigns: data.filter(c => c.status === 'PAUSED').length,
          stoppedCampaigns: data.filter(c => c.status === 'STOPPED').length,
          completedCampaigns: data.filter(c => c.status === 'COMPLETED').length,
        };
        setCampaignStats(stats);
      } else {
        console.error('Format de données inattendu:', data);
        setCampaigns([]);
        setCampaignStats(null);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des campagnes:', error);
      setCampaigns([]);
      setCampaignStats(null);
    } finally {
      setCampaignsLoading(false);
    }
  };



  const updateCampaignStatus = async (campaignId, newStatus) => {
    try {
      setCampaignActionLoading(prev => ({ ...prev, [campaignId]: true }));
      
      // Utiliser les nouvelles routes spécifiques selon le statut
      let endpoint = '';
      let method = 'POST';
      
      switch (newStatus) {
        case 'paused':
          endpoint = `${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}/pause`;
          break;
        case 'active':
        case 'start':
          endpoint = `${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}/start`;
          break;
        case 'stopped':
          endpoint = `${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}/stop`;
          break;
        default:
          // Pour les autres statuts, utiliser la route générique
          endpoint = `${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}/status`;
          method = 'POST';
          break;
      }
      
      const response = await authFetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({ status: newStatus }) : undefined
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          // Mettre à jour la campagne dans l'état local immédiatement
          setCampaigns(prev => prev.map(c => 
            c.id === campaignId 
              ? { ...c, status: newStatus }
              : c
          ));
          
          setMessage({ type: 'success', text: result.message || `Statut de la campagne mis à jour: ${newStatus}` });
          
          // Attendre un peu avant de recharger pour laisser l'API se synchroniser
          setTimeout(() => {
            fetchCampaigns(); // Recharger pour avoir les stats à jour
          }, 1000);
        } else {
          setMessage({ type: 'error', text: result.error || 'Erreur lors de la mise à jour' });
        }
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Erreur lors de la mise à jour' });
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      setMessage({ type: 'error', text: 'Erreur de connexion' });
    } finally {
      setCampaignActionLoading(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  const deleteCampaign = async (campaignId) => {
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setCampaigns(prev => prev.filter(c => c.id !== campaignId));
        setCampaignToDelete(null);
        setMessage({ type: 'success', text: 'Campagne supprimée avec succès' });
        fetchCampaigns(); // Recharger pour avoir les stats à jour
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Erreur lors de la suppression' });
      }
    } catch (error) {
      console.error('Erreur lors de la suppression de la campagne:', error);
      setMessage({ type: 'error', text: 'Erreur de connexion' });
    }
  };

  const duplicateCampaign = async (campaignId, newData = {}) => {
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      });
      
      if (response.ok) {
        const duplicatedCampaign = await response.json();
        setCampaigns(prev => [...prev, duplicatedCampaign]);
        setMessage({ type: 'success', text: 'Campagne dupliquée avec succès' });
        fetchCampaigns(); // Recharger pour avoir les stats à jour
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Erreur lors de la duplication' });
      }
    } catch (error) {
      console.error('Erreur lors de la duplication de la campagne:', error);
      setMessage({ type: 'error', text: 'Erreur de connexion' });
    }
  };

  // Fonctions pour l'import des leads
  const handleImportLeads = (campaign) => {
    setSelectedCampaignForImport(campaign);
    setImportModalOpen(true);
    // Récupérer la liste des fichiers CSV quand la modale s'ouvre
    fetchCsvFiles();
  };

  const handleImportComplete = (result) => {
    // Rafraîchir la liste des campagnes
    fetchCampaigns();
    
    // Afficher une notification de succès
    setMessage({ type: 'success', text: `Import terminé avec succès ! ${result.success}/${result.total} leads importés.` });
    
    // Fermer le modal
    setImportModalOpen(false);
    setSelectedCampaignForImport(null);
  };

  // Fonction pour gérer l'ouverture de la modal des comptes email
  const handleEmailAccounts = (campaign) => {
    setSelectedCampaignForEmailAccounts(campaign);
    setEmailAccountsModalOpen(true);
    // Récupérer les comptes email quand la modal s'ouvre
    fetchEmailAccounts();
  };

  // Fonction pour gérer la fermeture de la modal des comptes email
  const handleEmailAccountsClose = () => {
    setEmailAccountsModalOpen(false);
    setSelectedCampaignForEmailAccounts(null);
    setSelectedEmailAccounts(new Set());
  };

  // Fonction pour récupérer tous les comptes email depuis SmartLeads
  const fetchEmailAccounts = async () => {
    try {
      setEmailAccountsLoading(true);
      console.log('📧 Récupération de tous les comptes email depuis SmartLeads...');
      
      // Récupérer tous les comptes email avec pagination automatique
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/campaigns/email-accounts/all?limit=1000`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Comptes email récupérés:', data.emailAccounts?.length || 0);
        setEmailAccounts(data.emailAccounts || []);
      } else {
        console.error('❌ Erreur lors de la récupération des comptes email:', response.status);
        setMessage({ type: 'error', text: 'Impossible de récupérer les comptes email depuis SmartLeads' });
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des comptes email:', error);
      setMessage({ type: 'error', text: 'Erreur de connexion au serveur' });
    } finally {
      setEmailAccountsLoading(false);
    }
  };

  // Fonction pour récupérer la liste des fichiers CSV disponibles
  const fetchCsvFiles = async () => {
    try {
      setCsvFilesLoading(true);
      setSelectedCsvFile(null); // Réinitialiser la sélection
      console.log('📁 Récupération de la liste des fichiers CSV...');
      
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/campaigns/smartlead/csv-files`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Fichiers CSV récupérés:', data.files?.length || 0);
        const files = data.files || [];
        setCsvFiles(files);
        
        // Pré-sélectionner le fichier le plus récent
        if (files.length > 0) {
          const mostRecentFile = files[0]; // Les fichiers sont déjà triés par date (plus récent en premier)
          setSelectedCsvFile(mostRecentFile);
          // Mettre à jour la valeur du select
          setTimeout(() => {
            const select = document.getElementById('csvFileSelect');
            if (select) {
              select.value = mostRecentFile.name;
            }
          }, 100);
        }
      } else {
        console.error('❌ Erreur lors de la récupération des fichiers CSV:', response.status);
        setMessage({ type: 'error', text: 'Impossible de récupérer la liste des fichiers CSV' });
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des fichiers CSV:', error);
      setMessage({ type: 'error', text: 'Erreur de connexion au serveur' });
    } finally {
      setCsvFilesLoading(false);
    }
  };

  // Fonction pour gérer la sélection/désélection d'un compte email
  const toggleEmailAccountSelection = (accountId) => {
    setSelectedEmailAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  // Fonction pour sauvegarder les comptes email sélectionnés à la campagne
  const handleSaveEmailAccounts = async () => {
    if (selectedEmailAccounts.size === 0) {
      setMessage({ type: 'warning', text: 'Aucun compte email sélectionné' });
      return;
    }

    if (!selectedCampaignForEmailAccounts) {
      setMessage({ type: 'error', text: 'Aucune campagne sélectionnée' });
      return;
    }

    try {
      setEmailAccountsSaving(true);
      setMessage({ type: 'info', text: 'Ajout des comptes email à la campagne...' });
      
      const emailAccountIds = Array.from(selectedEmailAccounts);
      
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${selectedCampaignForEmailAccounts.id}/email-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_account_ids: emailAccountIds
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Comptes email ajoutés avec succès:', result);
        
        setMessage({ 
          type: 'success', 
          text: `${emailAccountIds.length} compte(s) email ajouté(s) avec succès à la campagne "${selectedCampaignForEmailAccounts.name}"` 
        });
        
        // Fermer la modale et réinitialiser la sélection
        handleEmailAccountsClose();
        
        // Optionnel : rafraîchir la liste des campagnes pour voir les changements
        // fetchCampaigns();
        
      } else {
        const errorData = await response.json();
        console.error('❌ Erreur lors de l\'ajout des comptes email:', errorData);
        setMessage({ 
          type: 'error', 
          text: `Erreur lors de l'ajout des comptes email: ${errorData.error || 'Erreur serveur'}` 
        });
      }
          } catch (error) {
        console.error('❌ Erreur lors de l\'ajout des comptes email:', error);
        setMessage({ 
          type: 'error', 
          text: 'Erreur de connexion lors de l\'ajout des comptes email' 
        });
      } finally {
        setEmailAccountsSaving(false);
      }
    };

  // Fonction pour sélectionner/désélectionner tous les comptes
  const toggleAllEmailAccounts = () => {
    if (selectedEmailAccounts.size === emailAccounts.length) {
      setSelectedEmailAccounts(new Set());
    } else {
      setSelectedEmailAccounts(new Set(emailAccounts.map(account => account.id)));
    }
  };

  // Fonction pour charger les métadonnées à la demande
  const loadMetadataOnDemand = async (filename) => {
    if (fileMetadata[filename] || metadataLoading[filename]) {
      return; // Déjà chargé ou en cours
    }
    
    try {
      setMetadataLoading(prev => ({ ...prev, [filename]: true }));
      
      // D'abord essayer de récupérer les métadonnées de base
      const basicResponse = await authFetch(`${import.meta.env.VITE_API_URL}/api/files/metadata/${encodeURIComponent(filename)}?basic=true`);
      const basicData = await basicResponse.json();
      
      if (basicData.success) {
        setFileMetadata(prev => ({ ...prev, [filename]: basicData.metadata }));
        
        // Si le nombre de lignes n'est pas disponible, faire un appel complet
        if (!basicData.metadata.totalLines || basicData.metadata.totalLines === 0) {
          const fullResponse = await authFetch(`${import.meta.env.VITE_API_URL}/api/files/metadata/${encodeURIComponent(filename)}`);
          const fullData = await fullResponse.json();
          
          if (fullData.success) {
            setFileMetadata(prev => ({ ...prev, [filename]: fullData.metadata }));
            
            // Mettre à jour la liste des fichiers pour refléter le nouveau nombre de lignes
            setFiles(prevFiles => 
              prevFiles.map(file => 
                file.name === filename 
                  ? { ...file, totalLines: fullData.metadata.totalLines }
                  : file
              )
            );
          }
        }
      }
    } catch (error) {
      console.warn(`Erreur lors du chargement des métadonnées pour ${filename}:`, error);
    } finally {
      setMetadataLoading(prev => ({ ...prev, [filename]: false }));
    }
  };

  // Fonction pour charger les métadonnées complètes (avec comptage des lignes)
  const loadFullMetadata = async (filename) => {
    if (metadataLoading[filename]) {
      return; // Déjà en cours
    }
    
    try {
      setMetadataLoading(prev => ({ ...prev, [filename]: true }));
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/files/metadata/${encodeURIComponent(filename)}`);
      const data = await response.json();
      
      if (data.success) {
        setFileMetadata(prev => ({ ...prev, [filename]: data.metadata }));
        
        // Mettre à jour la liste des fichiers pour refléter le nouveau nombre de lignes
        setFiles(prevFiles => 
          prevFiles.map(file => 
            file.name === filename 
              ? { ...file, totalLines: data.metadata.totalLines }
              : file
          )
        );
      }
    } catch (error) {
      console.warn(`Erreur lors du chargement des métadonnées complètes pour ${filename}:`, error);
    } finally {
      setMetadataLoading(prev => ({ ...prev, [filename]: false }));
    }
  };

  // FONCTION DÉSACTIVÉE : Les métadonnées sont déjà disponibles dans le registre files-registry.json
  // const fetchFileMetadata = async () => {
  //   // Utilitaire pour fetch avec timeout plus long
  //   function fetchWithTimeout(resource, options = {}, timeout = 15000) {
  //     return Promise.race([
  //       fetch(resource, options),
  //       new Promise((_, reject) =>
  //         setTimeout(() => reject(new Error('Timeout')), timeout)
  //       )
  //     ]);
  //   }

  //   // Limite le nombre de requêtes simultanées (réduit de 3 à 2)
  //   async function poolFetch(files, poolSize = 2) {
  //     let i = 0;
  //     let results = [];
  //     let errors = 0;
  //     const total = files.length;
  //     const maxErrors = Math.ceil(total * 0.7); // Plus tolérant : 70% d'échecs autorisés
      
  //     const next = async () => {
  //       if (i >= files.length) return null;
  //       const file = files[i++];
  //       try {
  //           const response = await fetchWithTimeout(
  //             `${import.meta.env.VITE_API_URL}/api/files/metadata/${encodeURIComponent(file.name)}?basic=true`,
  //             {},
  //             15s
  //           );
  //           const data = await response.json();
  //           if (data.success) {
  //             return { [file.name]: data.metadata };
  //           } else {
  //             errors++;
  //             console.warn(`Métadonnées non disponibles pour ${file.name}`);
  //             return null;
  //           }
  //         } catch (error) {
  //           errors++;
  //           console.warn(`Erreur lors du chargement des métadonnées pour ${file.name}:`, error.message);
  //           return null;
  //         }
  //       };
      
  //       const workers = Array(poolSize).fill(0).map(async () => {
  //         let res;
  //         let out = [];
  //         while ((res = await next()) !== null) {
  //           if (res) out.push(res);
  //           if (errors > maxErrors) break;
  //         }
  //         return out;
  //       });
      
  //       const all = (await Promise.all(workers)).flat();
      
  //       // Afficher un message d'avertissement seulement si vraiment trop d'erreurs
  //       if (errors > maxErrors) {
  //         console.warn(`⚠️ ${errors}/${total} fichiers n'ont pas pu être chargés. L'interface reste fonctionnelle.`);
  //       }
      
  //       return all;
  //     }

  //     try {
  //       // Marquer tous les fichiers comme en cours de chargement
  //       const loadingState = {};
  //       files.forEach(file => {
  //         loadingState[file.name] = true;
  //       });
  //       setMetadataLoading(loadingState);

  //       // Utiliser le pool pour limiter les requêtes
  //       const results = await poolFetch(files, 2); // Réduit à 2 requêtes simultanées
  //       const newMetadata = {};
  //       results.forEach(result => {
  //         if (result) {
  //           Object.assign(newMetadata, result);
  //       });
  //       setFileMetadata(prev => ({ ...prev, ...newMetadata }));

  //       // Marquer tous les fichiers comme chargés
  //       const loadedState = {};
  //       files.forEach(file => {
  //         loadedState[file.name] = false;
  //       });
  //       setMetadataLoading(loadedState);
  //     } catch (error) {
  //       console.error('Erreur lors du chargement des métadonnées:', error);
  //       // On ne bloque pas l'UI - on continue sans métadonnées
  //       const loadedState = {};
  //       files.forEach(file => {
  //         loadedState[file.name] = false;
  //       });
  //       setMetadataLoading(loadedState);
  //     }
  //   };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleOpendataDownload = async () => {
    if (opendataLoading) return;
    setOpendataLoading(true);
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/opendata/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opendataForm)
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', 'Téléchargement de l\'Opendata terminé avec succès !');
        fetchStats();
        fetchFiles();
      } else {
        showMessage('error', `Erreur: ${data.error}`);
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      setOpendataLoading(false);
      setSelectedAction(null);
    }
  };

  const handleDailyDownload = async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/daily/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dailyForm)
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', 'Téléchargement quotidien terminé avec succès !');
        fetchStats();
        fetchFiles();
      } else {
        showMessage('error', `Erreur: ${data.error}`);
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
      setSelectedAction(null);
    }
  };

  const handleDailyDomainsDownload = async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/daily/domains/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dailyDomainsForm)
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', 'Téléchargement des domaines quotidiens terminé avec succès !');
        fetchStats();
        fetchFiles();
      } else {
        showMessage('error', `Erreur: ${data.error}`);
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
      setSelectedAction(null);
    }
  };

  // Fonction pour lancer le scheduler manuellement
  const handleSchedulerLaunch = async () => {
    setSchedulerLoading(true);
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/scheduler/execute-daily-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', 'Processus complet du scheduler lancé avec succès ! (Téléchargement + WHOIS + Million Verifier)');
        // Rafraîchir les fichiers après un délai pour laisser le temps au traitement
        setTimeout(() => {
          fetchFiles();
          fetchStats();
        }, 10000); // Délai plus long car le processus est plus complet
      } else {
        showMessage('error', `Erreur: ${data.error}`);
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      setSchedulerLoading(false);
    }
  };

  // Fonction pour gérer l'import de fichiers CSV
  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Vérifier que c'est un fichier CSV
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showMessage('error', 'Veuillez sélectionner un fichier CSV');
      return;
    }

    setImportLoading(true);
    setImportProgress('Préparation de l\'import...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/files/import`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        showMessage('success', `Fichier importé avec succès ! ${data.totalLines} lignes détectées`);
        setImportProgress(null);
        fetchStats();
        fetchFiles();
      } else {
        showMessage('error', `Erreur lors de l'import: ${data.error}`);
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      setImportLoading(false);
      setImportProgress(null);
      // Réinitialiser l'input file
      event.target.value = '';
    }
  };


  const handleDateFilter = async () => {
    if (!dateFilterForm.startDate || !dateFilterForm.endDate) {
      showMessage('error', 'Veuillez sélectionner les deux dates');
      return;
    }
    
    setLoading(true);
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/filter/date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: processFile.name,
          startDate: dateFilterForm.startDate,
          endDate: dateFilterForm.endDate
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', `Filtrage par date terminé ! ${data.filteredLines} domaines trouvés`);
        setSelectedAction(null);
        setProcessFile(null);
        setDateFilterForm({ startDate: '', endDate: '' });
        fetchStats();
        fetchFiles();
      } else {
        showMessage('error', `Erreur: ${data.error}`);
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationFilter = async () => {
    if (!locationFilterForm.value.trim()) {
      showMessage('error', 'Veuillez saisir une valeur de recherche');
      return;
    }
    
    setLoading(true);
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/filter/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: processFile.name,
          filterType: locationFilterForm.type,
          filterValue: locationFilterForm.value.trim()
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', `Filtrage par localisation terminé ! ${data.filteredLines} domaines trouvés`);
        setSelectedAction(null);
        setProcessFile(null);
        setLocationFilterForm({ type: 'ville', value: '' });
        fetchStats();
        fetchFiles();
      } else {
        showMessage('error', `Erreur: ${data.error}`);
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeColor = (file) => {
    // Utiliser le nouveau champ type du registre
    switch (file.type) {
      case 'afnic':
        return 'from-blue-600 to-cyan-600 border-blue-500'; // Bleu pour AFNIC
      case 'whois':
        return 'from-purple-600 to-indigo-600 border-purple-500'; // Violet pour WHOIS
      case 'domains':
        return 'from-emerald-600 to-teal-600 border-emerald-500'; // Vert pour domaines
      case 'valides':
        return 'from-green-600 to-emerald-600 border-green-500'; // Vert foncé pour valides
      case 'daily':
        return 'from-orange-600 to-red-600 border-orange-500'; // Orange pour daily
      case 'verifier':
        return 'from-yellow-500 to-amber-500 border-yellow-400'; // Jaune pour Verifier
      case 'classique':
      default:
        return 'from-neutral-500 to-slate-500 border-neutral-400'; // Gris pour classique
    }
  };

  const getFileTypeIcon = (file) => {
    // Utiliser le nouveau champ type du registre
    switch (file.type) {
      case 'afnic':
        return GlobeAltIcon; // Globe pour AFNIC
      case 'whois':
        return InformationCircleIcon; // Info pour WHOIS
      case 'domains':
        return DocumentTextIcon; // Document pour domaines
      case 'valides':
        return CheckCircleIcon; // Check pour valides
      case 'daily':
        return ChartBarIcon; // Graphique pour daily
      case 'verifier':
        return SparklesIcon; // Étincelles pour Verifier
      case 'classique':
      default:
        return DocumentTextIcon; // Document par défaut
    }
  };

  const getFileTypeName = (file) => {
    // Utiliser le nouveau champ type du registre
    switch (file.type) {
      case 'afnic':
        return 'AFNIC';
      case 'whois':
        return 'WHOIS';
      case 'domains':
        return 'Domaines';
      case 'valides':
        return 'Valides';
      case 'daily':
        return 'Daily';
      case 'verifier':
        return 'Verifier';
      case 'classique':
      default:
        return 'Classique';
    }
  };

  const getButtonColor = (file, action) => {
    // Couleurs des boutons basées sur le type de fichier
    switch (file.type) {
      case 'afnic':
        return 'bg-blue-600 hover:bg-blue-700 border-blue-500'; // Bleu pour AFNIC
      case 'whois':
        return 'bg-purple-600 hover:bg-purple-700 border-purple-500'; // Violet pour WHOIS
      case 'domains':
        return 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500'; // Vert pour domaines
      case 'valides':
        return 'bg-green-600 hover:bg-green-700 border-green-500'; // Vert foncé pour valides
      case 'daily':
        return 'bg-orange-600 hover:bg-orange-700 border-orange-500'; // Orange pour daily
      case 'verifier':
        return 'bg-yellow-500 hover:bg-yellow-600 border-yellow-400'; // Jaune pour Verifier
      case 'classique':
      default:
        return 'bg-neutral-600 hover:bg-neutral-700 border-neutral-500'; // Gris pour classique
    }
  };



  const handlePreview = async (file) => {
    setCsvPreviewLoading(true);
    setSelectedAction(`preview-${file.name}`);
    setPreviewFileName(file.name);
    setShowPreviewModal(true);
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/files/preview/${encodeURIComponent(file.name)}`);
      const data = await response.json();
      console.log('Réponse API preview:', data); // AJOUTE CE LOG
      if (data.success) {
        setCsvPreview(data.preview.preview); // <-- c'est ici qu'il faut corriger
      } else {
        setCsvPreview(null);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'aperçu:', error);
      setCsvPreview(null);
    } finally {
      setCsvPreviewLoading(false);
    }
  };

  // Fonctions pour la sélection multiple
  const toggleFileSelection = (fileName) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileName)) {
      newSelected.delete(fileName);
    } else {
      newSelected.add(fileName);
    }
    setSelectedFiles(newSelected);
  };

  const selectAllFiles = () => {
    setSelectedFiles(new Set(files.map(file => file.name)));
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  // Calcul des fichiers à afficher (plus utilisé, supprimé)

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    
    setLoading(true);
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/files/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: Array.from(selectedFiles) })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', `${selectedFiles.size} fichier(s) supprimé(s) avec succès !`);
        setSelectedFiles(new Set());
        fetchStats();
        fetchFiles();
      } else {
        showMessage('error', `Erreur: ${data.error}`);
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleMergeSelected = async () => {
    if (selectedFiles.size < 2) {
      showMessage('error', 'Sélectionnez au moins 2 fichiers pour les fusionner');
      return;
    }
    
    setLoading(true);
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/files/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: Array.from(selectedFiles) })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const datesInfo = data.dates && data.dates.length > 0 ? ` (Dates: ${data.dates.join(', ')})` : '';
        showMessage('success', `Fichiers fusionnés avec succès ! Nouveau fichier: ${data.mergedFileName}${datesInfo}`);
        setSelectedFiles(new Set());
        fetchStats();
        fetchFiles();
      } else {
        showMessage('error', `Erreur: ${data.error}`);
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour télécharger un fichier
  const handleExport = async (file) => {
    const sessionId = localStorage.getItem('sessionId');
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/files/download/${encodeURIComponent(file.name)}`,
        {
          method: 'GET',
          headers: { 'x-session-id': sessionId }
        }
      );
      if (!response.ok) {
        showMessage('error', "Erreur lors du téléchargement du fichier");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showMessage('error', "Erreur lors du téléchargement");
    }
  };



  // Fonction pour ouvrir la modale de suppression
  const openDeleteModal = (file) => {
    setFileToDelete(file);
  };

  // Fonction pour confirmer la suppression
  const confirmDelete = async () => {
    if (!fileToDelete || deleteLoading) return;
    setDeleteLoading(true);
    try {
      console.log('Suppression en cours pour', fileToDelete.name);
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/files/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [fileToDelete.name] })
      });
      const data = await response.json();
      console.log('Réponse API:', data);
      if (data.success) {
        showMessage('success', `Fichier supprimé avec succès !`);
        fetchStats();
        fetchFiles();
      } else {
        showMessage('error', `Erreur: ${data.error}`);
      }
    } catch (error) {
      console.error('Erreur JS:', error);
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      console.log('On passe dans finally');
      setDeleteLoading(false);
      setFileToDelete(null);
    }
  };

  // Fonction pour lancer l'analyse WHOIS sur un fichier (version SSE streaming)
  const handleWhoisAnalyze = (file) => {
    console.log('🚀 Démarrage analyse WHOIS (SSE) pour:', file.name);
    setSelectedAction(null);
    const jobId = uuidv4();
    // On stockera l'eventSource dans le state
    let eventSource = null;
    setWhoisJobs(prev => ({
      ...prev,
      [file.name]: { jobId, logs: ["🚀 Démarrage de l'analyse WHOIS..."], inProgress: true, eventSource: null }
    }));

    // Ouvre la connexion SSE
    const sessionId = localStorage.getItem('sessionId');
    const url = `${import.meta.env.VITE_API_URL}/api/whois/analyze/stream?filename=${encodeURIComponent(file.name)}&jobId=${jobId}&sessionId=${sessionId}`;
    eventSource = new window.EventSource(url);

    // On met à jour le state pour stocker l'eventSource
    setWhoisJobs(prev => ({
      ...prev,
      [file.name]: { ...prev[file.name], eventSource }
    }));

    eventSource.onopen = () => {
      console.log('🟢 Connexion SSE ouverte');
    };

    eventSource.onerror = (err) => {
      console.error('❌ Erreur SSE:', err);
      setWhoisJobs(prev => ({
        ...prev,
        [file.name]: {
          ...prev[file.name],
          logs: [...prev[file.name].logs, '❌ Connexion SSE perdue ou fermée.'],
          inProgress: false
        }
      }));
      eventSource.close();
    };

    // Gestion des différents types de logs
    const addLog = (type, message) => {
      setWhoisJobs(prev => {
        const prevLogs = prev[file.name]?.logs || [];
        let logMsg = message;
        if (typeof message === 'object' && message.message) logMsg = message.message;
        if (type === 'stats') logMsg = '\n' + logMsg;
        return {
          ...prev,
          [file.name]: {
            ...prev[file.name],
            logs: [...prevLogs, logMsg],
            inProgress: type !== 'done' && type !== 'error',
            eventSource: prev[file.name]?.eventSource
          }
        };
      });
    };

    eventSource.addEventListener('info', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog('info', data);
      } catch (error) {
        console.error('Erreur parsing JSON info:', error, e.data);
        addLog('error', { message: 'Erreur de parsing des données' });
      }
    });
    eventSource.addEventListener('success', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog('success', data);
      } catch (error) {
        console.error('Erreur parsing JSON success:', error, e.data);
        addLog('error', { message: 'Erreur de parsing des données' });
      }
    });
    eventSource.addEventListener('warn', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog('warn', data);
      } catch (error) {
        console.error('Erreur parsing JSON warn:', error, e.data);
        addLog('error', { message: 'Erreur de parsing des données' });
      }
    });
    eventSource.addEventListener('error', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog('error', data);
      } catch (error) {
        console.error('Erreur parsing JSON error:', error, e.data);
        addLog('error', { message: 'Erreur de parsing des données' });
      }
      eventSource.close();
    });
    eventSource.addEventListener('stats', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog('stats', data);
      } catch (error) {
        console.error('Erreur parsing JSON stats:', error, e.data);
        addLog('error', { message: 'Erreur de parsing des données' });
      }
    });
    eventSource.addEventListener('done', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog('done', data);
      } catch (error) {
        console.error('Erreur parsing JSON done:', error, e.data);
        addLog('error', { message: 'Erreur de parsing des données' });
      }
      eventSource.close();
    });
    eventSource.addEventListener('refresh', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog('refresh', data);
        // Actualiser la liste des fichiers
        fetchFiles();
      } catch (error) {
        console.error('Erreur parsing JSON refresh:', error, e.data);
        addLog('error', { message: 'Erreur de parsing des données' });
      }
    });
  };

  // Fonction pour annuler un job Whois ou Messages personnalisés
  const handleCancelWhois = async (fileOrName) => {
    let fileName = typeof fileOrName === 'string' ? fileOrName : fileOrName?.name;
    let job = whoisJobs[fileName];
    if (!job) {
      // Si on est dans le terminal, trouver le job courant
      const current = Object.entries(whoisJobs).find(([_, j]) => j.inProgress);
      if (current) {
        fileName = current[0];
        job = current[1];
      }
    }
    if (!job) return;
    // Ferme explicitement l'EventSource si présent
    if (job.eventSource) {
      try { job.eventSource.close(); } catch (e) {}
    }
    
    // Déterminer le type d'API à appeler selon le type de job
    const isPersonalizedJob = job.logs && job.logs.some(log => log.includes('MESSAGES PERSONNALISÉS'));
    const apiEndpoint = isPersonalizedJob ? 'personalized-messages/generate/cancel' : 'whois/analyze/cancel';
    
    await authFetch(`${import.meta.env.VITE_API_URL}/api/${apiEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.jobId })
    });
    // Supprime immédiatement le job du state pour réafficher la card de base
    setWhoisJobs(prev => {
      const newJobs = { ...prev };
      delete newJobs[fileName];
      return newJobs;
    });
  };

  // Fonction pour générer des messages personnalisés
  const handlePersonalizedMessages = async (file) => {
    const messageTemplate = prompt('Entrez votre template de message (utilisez {organisation} pour l\'organisation):', 'Bonjour {organisation}');
    if (!messageTemplate) return;
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/personalized-messages/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, messageTemplate })
      });
      const data = await response.json();
      if (data.success) {
        showMessage('success', 'Fichier généré avec succès !');
        fetchFiles();
      } else {
        showMessage('error', data.error || 'Erreur lors de la génération du fichier');
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    }
  };

  const handleProcessYesterdayFile = async () => {
    console.log('➡️  Requête traitement WHOIS fichier de la veille reçue');
    try {
      setLoading(true);
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/whois/process-yesterday`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        showMessage('success', data.message);
        fetchFiles();
      } else {
        const errorData = await response.json();
        showMessage('error', `Erreur: ${errorData.error}`);
      }
    } catch (error) {
      console.error('❌ Erreur traitement WHOIS fichier de la veille:', error);
      showMessage('error', `Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour mettre à jour toutes les dates dans le registre
  const handleUpdateAllDates = async () => {
    setDatesLoading(true);
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/dates/update-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', `Dates mises à jour avec succès ! ${data.updatedFiles} fichiers mis à jour`);
        fetchFiles(); // Recharger la liste des fichiers
        fetchDatesStats(); // Recharger les statistiques
      } else {
        showMessage('error', `Erreur: ${data.error}`);
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      setDatesLoading(false);
    }
  };

  // Fonction pour récupérer les statistiques des dates
  const fetchDatesStats = async () => {
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/dates/stats`);
      const data = await response.json();
      
      if (data.success) {
        setDatesStats(data.stats);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques des dates:', error);
    }
  };

  // Fonction pour mettre à jour les dates d'un fichier spécifique
  const handleUpdateFileDates = async (filename) => {
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/dates/update/${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', `Dates mises à jour pour ${filename}: ${data.dates.join(', ')}`);
        fetchFiles(); // Recharger la liste des fichiers
      } else {
        showMessage('error', `Erreur: ${data.error}`);
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    }
  };

  // Fonction utilitaire pour filtrer les emails privacy/registrar/support (même logique que backend)
  function isPrivacyEmailFront(email) {
    if (!email) return false;
    const domain = email.split('@')[1]?.toLowerCase();
    const PRIVACY_DOMAINS = [
      'hostinger.com', 'ovh.com', 'ovh.net', 'planethoster.info', 'ionos.com', '1und1.de', 'gandi.net',
      'o2switch.fr', 'spamfree.bookmyname.com', 'afnic.fr', 'nic.fr', 'whoisguard.com', 'domainsbyproxy.com',
      'privacyprotect.org', 'privatewhois.com', 'netim.com', 'free.org', 'one.com', 'amen.fr',
      'openprovider.com', 'tldregistrarsolutions.com', 'lws.fr', 'infomaniak.com', 'key-systems.net', 'dsi.cnrs.fr'
    ];
    if (PRIVACY_DOMAINS.some(privacyDomain => domain === privacyDomain || domain.endsWith('.' + privacyDomain))) {
      return true;
    }
    const privacyKeywords = ['ovh', 'ionos', '1und1', 'o2switch', 'histinger', 'whois', 'privacy', 'protect', 'guard', 'proxy'];
    if (privacyKeywords.some(keyword => domain.includes(keyword))) {
      return true;
    }
    if (email.toLowerCase().includes('support')) return true;
    return false;
  }

  // Calcul dynamique des stats à partir des logs pour l'affichage
  let processed = 0, total = 0, emails = 0;
  let isWhoisTerminal = false;
  let whoisJob = null;
  
  if (Array.isArray(files)) {
    files.forEach(file => {
      const job = whoisJobs[file.name];
      if (job && (job.inProgress || (job.logs && job.logs.length > 0))) {
        isWhoisTerminal = true;
        whoisJob = job;
      }
    });
  }
  
  if (isWhoisTerminal && whoisJob?.logs) {
    whoisJob.logs.forEach(l => {
      const m = l.match(/\[(\d+)[/|\\](\d+)\]/);
      if (m) {
        processed = Math.max(processed, parseInt(m[1]));
        total = Math.max(total, parseInt(m[2]));
      }
      // Filtrage des emails privacy/support
      if (l.startsWith('✅')) {
        // Extraire l'email du log (pattern simple)
        const emailMatch = l.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch && !isPrivacyEmailFront(emailMatch[0])) emails++;
      }
    });
  }
  const success = processed > 0 ? ((emails / processed) * 100).toFixed(1) : 0;

  // Fonction pour lancer la vérification MillionVerifier
  const handleMillionVerifier = async (file) => {
    // Met à jour le champ traitement à 'verifier' pour ce fichier
    setFiles(prevFiles => prevFiles.map(f => f.name === file.name ? { ...f, traitement: 'verifier' } : f));
    setMillionVerifierLoading(true);
    setMillionVerifierResults(null);
    setMillionVerifierFile(file.name);
    
    try {
      // Appel de l'API qui traite le fichier CSV complet
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/api/millionverifier/process-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inputFileName: file.name
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        showMessage('success', `Fichier traité avec succès ! ${data.stats.valid} emails valides sur ${data.stats.total} total`);
        setMillionVerifierResults(data.stats);
        // Recharger la liste des fichiers pour voir le nouveau fichier créé
        fetchFiles();
      } else {
        showMessage('error', data.error || 'Erreur lors du traitement MillionVerifier');
      }
    } catch (error) {
      console.error('Erreur MillionVerifier:', error);
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      setMillionVerifierLoading(false);
      // Remet le champ traitement à vide
      setFiles(prevFiles => prevFiles.map(f => f.name === file.name ? { ...f, traitement: '' } : f));
    }
  };


  return (
    <div className="min-h-screen relative">
             {/* Header moderne avec effet de verre */}
       <header className="glass-card border-b border-glass-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <img 
                  src="/domainAppLogo.png" 
                  alt="Logo Domain App" 
                  className="h-12 w-auto floating-animation"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                DomainScope
                </h1>
                <p className="text-glass-300 mt-1">
                  Interface moderne pour le traitement des domaines .fr et des campagnes SmartLeads
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="glass-button px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-neutral-600 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Message de succès/erreur en fixed discret */}
      {message && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 animate-fade-in
            ${message.type === 'success' ? 'bg-green-600/90 text-white' : 'bg-red-600/90 text-white'}`}
          style={{ minWidth: '180px', maxWidth: '320px', pointerEvents: 'none' }}
        >
          {message.type === 'success' ? (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Stats modernes sans box */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-600/20 backdrop-blur-sm border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300 hover:scale-105 animate-fade-in">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg">
                  <FolderIcon className="h-8 w-8 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-purple-200">Fichiers de données</p>
                  <p className="text-3xl font-bold text-white">{stats.dataFiles}</p>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-violet-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
            
            <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-600/20 backdrop-blur-sm border border-yellow-400/30 hover:border-yellow-400/50 transition-all duration-300 hover:scale-105 animate-fade-in" style={{animationDelay: '0.1s'}}>
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl shadow-lg">
                  <ChartBarIcon className="h-8 w-8 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-yellow-200">Fichiers traités</p>
                  <p className="text-3xl font-bold text-white">{stats.outputFiles}</p>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-amber-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
            
            <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 backdrop-blur-sm border border-green-400/30 hover:border-green-400/50 transition-all duration-300 hover:scale-105 animate-fade-in" style={{animationDelay: '0.2s'}}>
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                  <CloudArrowDownIcon className="h-8 w-8 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-green-200">Taille des données</p>
                  <p className="text-3xl font-bold text-white">{formatFileSize(stats.totalDataSize)}</p>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
            
            <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-600/20 backdrop-blur-sm border border-blue-400/30 hover:border-blue-400/50 transition-all duration-300 hover:scale-105 animate-fade-in" style={{animationDelay: '0.3s'}}>
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
                  <UserGroupIcon className="h-8 w-8 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-blue-200">Campagnes lancées</p>
                  <p className="text-3xl font-bold text-white">{campaigns.length}</p>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
          </div>
        </div>
      )}

      {/* Barre d'onglets moderne */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex justify-center space-x-6">
          <button
            onClick={() => setActiveTab('domains')}
            className={`group relative px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 hover:scale-105 ${
              activeTab === 'domains'
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-2xl shadow-blue-500/25'
                : 'bg-glass-200 text-glass-300 hover:bg-glass-300 hover:text-white backdrop-blur-sm'
            }`}
          >
            <div className="flex items-center space-x-3">
              <GlobeAltIcon className="h-6 w-6" />
              <span>Domaines AFNIC</span>
            </div>
            {activeTab === 'domains' && (
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-white rounded-full"></div>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`group relative px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 hover:scale-105 ${
              activeTab === 'dashboard'
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-2xl shadow-blue-500/25'
                : 'bg-glass-200 text-glass-300 hover:bg-glass-300 hover:text-white backdrop-blur-sm'
            }`}
          >
            <div className="flex items-center space-x-3">
              <ChartBarIcon className="h-6 w-6" />
              <span>Dashboard</span>
            </div>
            {activeTab === 'dashboard' && (
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-white rounded-full"></div>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`group relative px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 hover:scale-105 ${
              activeTab === 'campaigns'
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-2xl shadow-blue-500/25'
                : 'bg-glass-200 text-glass-300 hover:bg-glass-300 hover:text-white backdrop-blur-sm'
            }`}
          >
            <div className="flex items-center space-x-3">
              <UserGroupIcon className="h-6 w-6" />
              <span>Campagnes SmartLeads</span>
            </div>
            {activeTab === 'campaigns' && (
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-white rounded-full"></div>
            )}
          </button>
        </div>
      </div>

      {/* Contenu de l'onglet Domaines AFNIC */}
      {activeTab === 'domains' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="glass-card p-8 rounded-2xl">
            {/* Section Outils */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <CloudArrowDownIcon className="h-6 w-6 mr-3 text-blue-300" />
                Outils
              </h2>
          {/* Première ligne : boutons de téléchargement */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex gap-4">
              {/* Bouton Opendata */}
              {(() => {
                const opendataExists = files.some(file => file.isOpendata);
                return (
                  <button
                    onClick={handleOpendataDownload}
                    disabled={opendataLoading || deleteLoading}
                    className="glass-button-primary flex items-center justify-center px-6 py-3 rounded-lg text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CloudArrowDownIcon className="h-6 w-6 mr-3" />
                    {opendataLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        {opendataExists ? "Actualisation..." : "Téléchargement..."}
                      </>
                    ) : (
                      opendataExists ? "Actualiser l'Opendata" : "Télécharger Opendata"
                    )}
                  </button>
                );
              })()}
              <button
                onClick={() => setSelectedAction('daily-download')}
                className="glass-button-primary flex items-center justify-center px-6 py-3 rounded-lg text-base font-medium"
              >
                <GlobeAltIcon className="h-6 w-6 mr-3" />
                Télécharger Quotidien
              </button>
            </div>
            {/* Bouton Import CSV à droite */}
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileImport}
                className="hidden"
                id="csv-import"
                disabled={importLoading}
              />
              <label
                htmlFor="csv-import"
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold cursor-pointer transition-all duration-200
                  bg-gradient-to-r from-emerald-500 to-blue-500 shadow-lg
                  text-white
                  ${importLoading ? 'opacity-50 cursor-not-allowed' : 'hover:from-emerald-600 hover:to-blue-600 hover:scale-105'}
                `}
                style={{ minWidth: 180, letterSpacing: 0.5 }}
              >
                {importLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Import...
                  </>
                ) : (
                  <>
                    <ArrowUpTrayIcon className="h-7 w-7 mr-2 text-white" />
                    Importer CSV
                  </>
                )}
              </label>
            </div>
          </div>
          {/* Deuxième ligne : bouton Whois/RDAP sur 1 domaine */}
          <div className="flex flex-row gap-4 mt-6">
            {selectedAction !== 'whois-rdap-single' ? (
              <button
                className="glass-button-primary flex items-center justify-center px-6 py-3 rounded-lg text-base font-medium"
                onClick={() => setSelectedAction('whois-rdap-single')}
              >
                <MagnifyingGlassIcon className="h-6 w-6 mr-3" />
                Recherche Whois/RDAP
              </button>
            ) : (
              <form
                className="flex items-center gap-2 w-full max-w-md"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!whoisInput.trim()) return;
                  setWhoisLoading(true);
                  setWhoisResult(null);
                  try {
                    const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/whois/single`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ domain: whoisInput.trim() })
                    });
                    const data = await response.json();
                    if (data.success) {
                      setWhoisResult(data.result);
                    } else {
                      setWhoisResult({ domain: whoisInput, error: data.error || 'Erreur lors de la recherche' });
                    }
                  } catch (error) {
                    setWhoisResult({ domain: whoisInput, error: 'Erreur de connexion au serveur' });
                  } finally {
                    setWhoisLoading(false);
                  }
                }}
              >
                {/* Plus de bouton 'Lancer', la loupe à gauche sert de submit */}
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-3 bg-glass-200 rounded-l-lg h-12 hover:bg-blue-100 focus:bg-blue-200 disabled:opacity-50"
                  disabled={whoisLoading || !whoisInput.trim()}
                  style={{ border: 0 }}
                  tabIndex={0}
                  title="Lancer la recherche"
                >
                  <MagnifyingGlassIcon className="h-6 w-6 text-blue-400" />
                </button>
                <input
                  type="text"
                  className="flex-1 px-6 py-3 h-12 rounded-r-lg bg-neutral-700 text-white border-t border-b border-r border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  placeholder="Entrer un domaine .fr"
                  value={whoisInput}
                  onChange={e => setWhoisInput(e.target.value)}
                  autoFocus
                  disabled={whoisLoading}
                  style={{ minWidth: 0 }}
                />
                <button
                  type="button"
                  className="ml-2 text-neutral-400 hover:text-white"
                  onClick={() => { setSelectedAction(null); setWhoisInput(""); setWhoisResult(null); }}
                  title="Fermer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </form>
            )}
          </div>
          {/* Affichage du résultat fictif (à remplacer par l'appel réel) */}
          {whoisLoading && (
            <div className="mt-2 bg-neutral-700 border border-neutral-600 rounded-lg p-4 text-blue-300 max-w-md">
              <span>Recherche en cours...</span>
            </div>
          )}
          {whoisResult && !whoisLoading && (
            <div className="mt-2 bg-neutral-700 border border-neutral-600 rounded-lg p-4 text-white max-w-md">
              <div className="font-bold text-blue-300 mb-1">{whoisResult.domain}</div>
              {whoisResult.error ? (
                <div className="text-red-400">{whoisResult.error}</div>
              ) : (
                <div className="space-y-1 text-sm">
                  <div><span className="font-semibold text-blue-200">Email :</span> {whoisResult.contacts?.best_email || <span className="text-glass-400 italic">Non trouvé</span>}</div>
                  <div><span className="font-semibold text-blue-200">Numéro :</span> {whoisResult.contacts?.best_phone || <span className="text-glass-400 italic">Non trouvé</span>}</div>
                  <div><span className="font-semibold text-blue-200">Organisation :</span> {whoisResult.rdap_info?.organization || whoisResult.whois_info?.registrar || <span className="text-glass-400 italic">Non trouvé</span>}</div>
                  <div><span className="font-semibold text-blue-200">Adresse :</span> {(() => {
                    const adr = whoisResult.rdap_info?.address;
                    if (Array.isArray(adr)) return adr.filter(Boolean).join(', ');
                    if (typeof adr === 'string') return adr;
                    return <span className="text-glass-400 italic">Non trouvée</span>;
                  })()}</div>
                </div>
              )}
            </div>
          )}
          
          {/* Affichage du progrès d'import */}
          {importProgress && (
            <div className="mt-4 p-3 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <div className="flex items-center text-blue-300">
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span className="text-sm">{importProgress}</span>
              </div>
            </div>
          )}

          {/* Troisième ligne : bouton Scheduler */}
          <div className="flex flex-row gap-4 mt-6">
            <button
              onClick={handleSchedulerLaunch}
              disabled={schedulerLoading}
              className="glass-button-primary flex items-center justify-center px-6 py-3 rounded-lg text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {schedulerLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Lancement...
                </>
              ) : (
                                  <>
                    <ClockIcon className="h-6 w-6 mr-3" />
                    Lancer le Processus Complet
                  </>
              )}
            </button>
          </div>
            </div>

  

            {/* Section Fichiers */}
            <div className="mt-8 pt-8 border-t border-glass-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <DocumentTextIcon className="h-6 w-6 mr-3 text-blue-300" />
            Fichiers ({files.length})
          </h2>
          {/* BOUTON METTRE À JOUR LES DATES SUPPRIMÉ */}
        </div>

        {/* Barre d'actions pour les fichiers sélectionnés - Position sticky pour suivre l'écran */}
        {selectedFiles.size > 0 && (
          <div className="glass-card p-4 mb-6 rounded-xl animate-slide-up sticky-selection-bar">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-white font-medium">
                  {selectedFiles.size} fichier(s) sélectionné(s)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllFiles}
                    className="glass-button text-xs px-2.5 py-1 rounded-md"
                  >
                    Tout sélectionner
                  </button>
                  <button
                    onClick={clearSelection}
                    className="glass-button text-xs px-2.5 py-1 rounded-md"
                  >
                    Effacer
                  </button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {/* Boutons d'actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleMergeSelected}
                    disabled={selectedFiles.size < 2 || loading}
                    className="glass-button-primary flex items-center px-3 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowPathRoundedSquareIcon className="h-4 w-4 mr-2" />
                    Fusionner ({selectedFiles.size})
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={selectedFiles.size === 0 || loading}
                    className="glass-button flex items-center px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <TrashIcon className="h-4 w-4 mr-2" />
                    Supprimer ({selectedFiles.size})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {files.length === 0 ? (
          <div className="glass-card text-center py-16 rounded-2xl">
            <DocumentTextIcon className="h-16 w-16 text-glass-300 mx-auto mb-4" />
            <p className="text-glass-300 text-lg mb-2">
              Aucun fichier trouvé
            </p>
            <p className="text-glass-400">
              Téléchargez des fichiers pour commencer
            </p>
          </div>
        ) : (
          // Tri : OPENDATA_FR_202505.csv en premier, puis par date de modification (plus récents en premier)
          (() => {
            const sortedFiles = [...files].sort((a, b) => {
              // OPENDATA_FR_202505.csv toujours en premier
              if (a.name === "OPENDATA_FR_202505.csv") return -1;
              if (b.name === "OPENDATA_FR_202505.csv") return 1;
              if (a.type === "afnic" && b.type !== "afnic") return -1;
              if (a.type !== "afnic" && b.type === "afnic") return 1;

  
              // Pour le reste, tri par date de modification (plus récents en premier)
              const dateA = new Date(a.modified);
              const dateB = new Date(b.modified);
              return dateB - dateA;
            });
            // Prendre seulement le nombre de fichiers à afficher
            const filesToDisplay = sortedFiles.slice(0, filesToShow);
            const hasMoreFiles = filesToShow < sortedFiles.length;
            
            return (
              <div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filesToDisplay.map((file, index) => {
                  const IconComponent = getFileTypeIcon(file);
                  const isSelected = selectedFiles.has(file.name);
                  const whoisJob = whoisJobs[file.name];
                  const isWhoisTerminal = whoisJob && (whoisJob.inProgress || (whoisJob.logs && whoisJob.logs.length > 0));
                  
                  return (
                    <div 
                      key={index}
                      className={`glass-card glass-card-hover p-6 rounded-2xl bg-gradient-to-br ${getFileTypeColor(file)} animate-fade-in relative transition-all duration-200 ${isSelected ? 'ring-2 ring-accent-400 ring-offset-2 ring-offset-dark-600' : ''}`}
                      style={{animationDelay: `${index * 0.1}s`}}
                    >
                      {/* Affichage du statut de traitement WHOIS (ou autre) */}
                      {file.traitement && file.traitement !== '' && (
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="animate-spin h-5 w-5 text-blue-200" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          <span className="text-blue-100 font-semibold text-sm tracking-wide">Traitement : {file.traitement.toUpperCase()}</span>
                        </div>
                      )}
                      {!isWhoisTerminal && (
                        <>
                          {/* Indicateur de sélection - toujours visible */}
                          <div 
                            className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-110 ${
                              isSelected 
                                ? 'bg-accent-500 border-accent-500' 
                                : 'bg-glass-200 border-glass-300 hover:bg-glass-300'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFileSelection(file.name);
                            }}
                          >
                            {isSelected && <CheckIcon className="h-4 w-4 text-white" />}
                          </div>
                          <div className="flex items-center mb-4">
                            <div className="p-3 bg-glass-200 rounded-xl">
                              <IconComponent className="h-8 w-8 text-white" />
                            </div>
                            <div className="ml-4 flex-1 min-w-0">
                              <h3
                                className="text-lg font-semibold text-white truncate block w-full"
                                title={file.name}
                              >
                                {file.name}
                              </h3>
                              <div className="flex items-center gap-2">
                                <p className="text-neutral-200 text-sm">
                                  {getFileTypeName(file)}
                                </p>

                              </div>
                            </div>
                          </div>
                          <div className="glass-card p-4 mb-4 rounded-xl bg-glass-100">
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-neutral-200">Taille</span>
                              <span className="font-medium text-white">{formatFileSize(file.size)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-neutral-200">Modifié</span>
                              <span className="font-medium text-white">{new Date(file.modified).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-neutral-200">Lignes</span>
                              <span className="font-medium text-white">
                                {(() => {
                                  if (typeof file.totalLines === 'number' && file.totalLines > 0) {
                                    return file.totalLines.toLocaleString();
                                  }
                                  const metadata = fileMetadata[file.name];
                                  if (metadataLoading[file.name]) {
                                    return <span className="text-blue-300">Chargement...</span>;
                                  }
                                  if (metadata && typeof metadata.totalLines === 'number' && metadata.totalLines > 0) {
                                    return metadata.totalLines.toLocaleString();
                                  }
                                  if (files.length > 10) {
                                    return (
                                      <button
                                        onClick={() => loadMetadataOnDemand(file.name)}
                                        className="text-blue-300 hover:text-blue-200 text-xs underline"
                                      >
                                        Charger
                                      </button>
                                    );
                                  }
                                  return <span className="italic text-glass-300">N/A</span>;
                                })()}
                              </span>
                            </div>
                            {/* Affichage du template de message personnalisé si présent */}
                            {file.messageTemplate && (
                              <div className="flex justify-between text-xs mt-2">
                                <span className="text-purple-200 italic">Message</span>
                                <span className="text-purple-100 italic text-right truncate max-w-[60%]" title={file.messageTemplate}>{file.messageTemplate}</span>
                              </div>
                            )}
                            {/* Affichage des dates si disponibles */}
                            {file.dates && file.dates.length > 0 && (
                              <div className="flex justify-between text-sm mt-2">
                                <span className="text-neutral-200">Dates</span>
                                <span className="font-medium text-white text-xs">
                                  {file.dates.length === 1
                                    ? file.dates[0]
                                    : `${file.dates[0]} — ${file.dates[file.dates.length - 1]}`}
                                </span>
                              </div>
                            )}
                            {/* Affichage des localisations si disponibles */}
                            {file.localisations && file.localisations.length > 0 && (
                              <div className="flex justify-between text-sm mt-2">
                                <span className="text-neutral-200">Localisation{file.localisations.length > 1 ? 's' : ''}</span>
                                <span className="font-medium text-white text-xs">
                                  {file.localisations.join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Actions des fichiers - masquées si le fichier est sélectionné */}
                          {!isSelected && (
                                          <div className="flex flex-wrap gap-1.5">
                {/* Bouton Filtrer par date - seulement pour les fichiers AFNIC */}
                {file.type === 'afnic' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setProcessFile(file); setSelectedAction('date-filter'); }}
                    className={`flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 text-white ${getButtonColor(file, 'date-filter')}`}
                  >
                    <ChartBarIcon className="h-3 w-3 mr-1" />
                    Trier par date
                  </button>
                )}
                
                {/* Bouton WHOIS - pour tous les fichiers sauf les fichiers WHOIS et Verifier */}
                {file.type !== 'whois' && file.type !== 'verifier' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleWhoisAnalyze(file); }}
                    className="flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 text-white bg-purple-600 hover:bg-purple-700"
                  >
                    <InformationCircleIcon className="h-3 w-3 mr-1" />
                    WHOIS
                  </button>
                )}

                {/* Bouton MillionVerifier - pour tous les fichiers sauf les fichiers Verifier */}
                {file.type !== 'verifier' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMillionVerifier(file); }}
                    className="flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 text-white bg-yellow-500 hover:bg-yellow-600"
                  >
                    <SparklesIcon className="h-3 w-3 mr-1" />
                    MillionVerifier
                  </button>
                )}

                {/* Bouton Filtrer par localisation - pour les fichiers WHOIS et Verifier */}
                {(file.type === 'whois' || file.type === 'verifier') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setProcessFile(file); setSelectedAction('location-filter'); }}
                    className="glass-button flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
                  >
                    <GlobeAltIcon className="h-3 w-3 mr-1" />
                    Trier par loc
                  </button>
                )}

                {/* Bouton Messages personnalisés - seulement pour les fichiers WHOIS */}
                {/* {file.type === 'whois' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePersonalizedMessages(file); }}
                    className="flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 text-white bg-purple-600 hover:bg-purple-700"
                  >
                    <ChatBubbleLeftRightIcon className="h-3 w-3 mr-1" />
                    Messages
                  </button>
                )} */}

                <button
                  onClick={(e) => { e.stopPropagation(); handlePreview(file); }}
                  className="glass-button flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
                >
                  <EyeIcon className="h-3 w-3 mr-1" />
                  Aperçu
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedFileForStats(file); setShowStatsModal(true); }}
                  className="glass-button flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
                >
                  <ChartBarIcon className="h-3 w-3 mr-1" />
                  Statistiques
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); handleExport(file); }}
                  className="glass-button flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
                >
                  <DocumentArrowDownIcon className="h-3 w-3 mr-1" />
                  Exporter
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); openDeleteModal(file); }}
                  className="glass-button flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200"
                >
                  <TrashIcon className="h-3 w-3 mr-1" />
                  Supprimer
                </button>
              </div>
                          )}
                        </>
                      )}

                      {/* Terminal WHOIS modernisé (remplace l'ancien bloc) */}
                      {isWhoisTerminal && whoisJob && files.find(f => whoisJobs[f.name] === whoisJob) && (
                        <div className="glass-card p-6 mt-4 rounded-2xl shadow-lg max-w-2xl mx-auto relative">
                          {/* Header identique à la card de base */}
                          <div className="flex items-center gap-3 mb-4">
                            <span className="bg-white/10 p-2 rounded-full">
                              <svg className="h-6 w-6 text-white opacity-80" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" /></svg>
                            </span>
                            <div>
                              <div className="text-xl font-bold text-white">{files.find(f => whoisJobs[f.name] === whoisJob)?.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-glass-200">Domaines Extraits</span>
                                <span className="bg-emerald-500/90 text-white text-xs font-bold px-2 py-0.5 rounded">Ready</span>
                              </div>
                            </div>
                            {/* Bouton Annuler en absolu, plus petit */}
                            <button
                              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-2 py-0.5 rounded-md transition shadow absolute top-3 right-3 z-10 text-xs h-7 min-w-[60px]"
                              onClick={() => handleCancelWhois(files.find(f => whoisJobs[f.name] === whoisJob))}
                              disabled={!whoisJob.inProgress}
                            >Annuler</button>
                          </div>
                          {/* Terminal/logs sans card interne */}
                          <div className="bg-black/90 rounded-xl p-4 text-green-200 font-mono text-sm h-64 overflow-y-auto border border-glass-700 shadow-inner mb-4">
                            {whoisJob.logs
                              .filter(l => l.trim().startsWith('✅') || l.trim().startsWith('❌'))
                              .map((log, i) => {
                                let isValid = false;
                                if (log.startsWith('✅')) {
                                  const emailMatch = log.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                                  isValid = emailMatch && !isPrivacyEmailFront(emailMatch[0]);
                                }
                                return (
                                  <div key={i} className={log.startsWith('✅') && isValid ? 'text-green-400' : 'text-red-400'}>{log}</div>
                                );
                              })}
                          </div>
                          {/* Footer : stats compactes uniquement */}
                          <div className="flex justify-center mt-4">
                            <div className="flex gap-6 items-center justify-center text-base font-mono">
                              {/* SUPPRIMER le compteur ici */}
                              <span title="Temps écoulé" className="flex items-center gap-1 text-white">
                                <span role="img" aria-label="timer" style={{ fontSize: '1.2em' }}>⏱️</span>
                                <span className="font-bold">{elapsed}s</span>
                              </span>
                              <span title="Emails trouvés" className="flex items-center gap-1 text-sky-300">
                                <span role="img" aria-label="email" style={{ fontSize: '1.2em' }}>📧</span>
                                <span className="font-bold">{emails}</span>
                              </span>
                              <span title="Taux de succès" className="flex items-center gap-1 text-emerald-400">
                                <span role="img" aria-label="succès" style={{ fontSize: '1.2em' }}>✅</span>
                                <span className="font-bold">{success}%</span>
                              </span>
                            </div>
                          </div>
                          {/* Barre de progression fine en bas */}
                          <div className="flex items-center w-full mt-6">
                            <div className="flex-1 h-2 bg-glass-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-blue-500 transition-all duration-300"
                                style={{ width: total > 0 ? `${(processed / total) * 100}%` : '0%' }}
                              ></div>
                            </div>
                            <span
                              className="ml-4 text-xs font-bold text-white drop-shadow"
                              style={{ background: 'rgba(0,0,0,0.15)', padding: '0 8px', borderRadius: '8px' }}
                            >
                              {processed}/{total}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Bouton "Voir plus" simple */}
              {hasMoreFiles && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => {
                      setLoadingMore(true);
                      setFilesToShow(prev => prev + 9);
                      setTimeout(() => setLoadingMore(false), 300);
                    }}
                    className="glass-button flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white hover:scale-105 transition-all duration-200"
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        <span>Chargement...</span>
                      </>
                    ) : (
                      <>
                        <span>Voir plus</span>
                        <ArrowPathRoundedSquareIcon className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {/* Affichage simple du nombre de fichiers */}
              <div className="flex justify-center mt-4 text-sm text-neutral-300">
                <span>
                  Affichage de {filesToDisplay.length} sur {sortedFiles.length} fichiers
                </span>
              </div>
              </div>
            );
          })()
        )}
            </div>
          </div>
        </div>
      )}

      {/* Onglet Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-12">
          <div className="glass-card p-8 rounded-2xl">
            <h2 className="text-2xl font-bold text-white mb-8 flex items-center">
              <ChartBarIcon className="h-6 w-6 mr-3 text-blue-300" />
              Dashboard des Statistiques
            </h2>

            {/* Statistiques des fichiers */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                <FolderIcon className="h-5 w-5 mr-2 text-green-300" />
                Statistiques des Fichiers
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total des fichiers */}
                <div className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-600 rounded-xl p-6 hover:border-neutral-500 transition-all duration-300">
                  <div className="flex items-center">
                    <div className="p-3 bg-neutral-700 rounded-xl shadow-lg">
                      <FolderIcon className="h-8 w-8 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-neutral-300">Total des fichiers</p>
                      <p className="text-3xl font-bold text-white">{files.length}</p>
                    </div>
                  </div>
                </div>

                {/* Fichiers par type */}
                <div className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-600 rounded-xl p-6 hover:border-neutral-500 transition-all duration-300">
                  <div className="flex items-center">
                    <div className="p-3 bg-neutral-700 rounded-xl shadow-lg">
                      <DocumentTextIcon className="h-8 w-8 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-neutral-300">Fichiers WHOIS</p>
                      <p className="text-3xl font-bold text-white">
                        {files.filter(f => f.type === 'whois').length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fichiers verifier */}
                <div className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-600 rounded-xl p-6 hover:border-neutral-500 transition-all duration-300">
                  <div className="flex items-center">
                    <div className="p-3 bg-neutral-700 rounded-xl shadow-lg">
                      <SparklesIcon className="h-8 w-8 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-neutral-300">Fichiers Verifier</p>
                      <p className="text-3xl font-bold text-white">
                        {files.filter(f => f.type === 'verifier').length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fichiers classiques */}
                <div className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-600 rounded-xl p-6 hover:border-neutral-500 transition-all duration-300">
                  <div className="flex items-center">
                    <div className="p-3 bg-neutral-700 rounded-xl shadow-lg">
                      <DocumentTextIcon className="h-8 w-8 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-neutral-300">Fichiers Classiques</p>
                      <p className="text-3xl font-bold text-white">
                        {files.filter(f => f.type === 'classique').length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistiques des campagnes */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                <UserGroupIcon className="h-5 w-5 mr-2 text-blue-300" />
                Statistiques des Campagnes
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total des campagnes */}
                <div className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-600 rounded-xl p-6 hover:border-neutral-500 transition-all duration-300">
                  <div className="flex items-center">
                    <div className="p-3 bg-neutral-700 rounded-xl shadow-lg">
                      <UserGroupIcon className="h-8 w-8 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-neutral-300">Total des campagnes</p>
                      <p className="text-3xl font-bold text-white">{campaigns.length}</p>
                    </div>
                  </div>
                </div>

                {/* Campagnes actives */}
                <div className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-600 rounded-xl p-6 hover:border-neutral-500 transition-all duration-300">
                  <div className="flex items-center">
                    <div className="p-3 bg-neutral-700 rounded-xl shadow-lg">
                      <PlayIcon className="h-8 w-8 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-neutral-300">Campagnes actives</p>
                      <p className="text-3xl font-bold text-white">
                        {campaigns.filter(c => c.status === 'ACTIVE').length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Campagnes en pause */}
                <div className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-600 rounded-xl p-6 hover:border-neutral-500 transition-all duration-300">
                  <div className="flex items-center">
                    <div className="p-3 bg-neutral-700 rounded-xl shadow-lg">
                      <PauseIcon className="h-8 w-8 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-neutral-300">Campagnes en pause</p>
                      <p className="text-3xl font-bold text-white">
                        {campaigns.filter(c => c.status === 'PAUSED').length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Campagnes arrêtées */}
                <div className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-600 rounded-xl p-6 hover:border-neutral-500 transition-all duration-300">
                  <div className="flex items-center">
                    <div className="p-3 bg-neutral-700 rounded-xl shadow-lg">
                      <StopIcon className="h-8 w-8 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-neutral-300">Campagnes arrêtées</p>
                      <p className="text-3xl font-bold text-white">
                        {campaigns.filter(c => c.status === 'STOPPED').length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistiques détaillées des fichiers */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                <ChartBarIcon className="h-5 w-5 mr-2 text-purple-300" />
                Statistiques Détaillées des Fichiers
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Totaux des lignes */}
                <div className="bg-neutral-700/50 rounded-xl p-6 border border-neutral-600">
                  <h4 className="text-lg font-semibold text-white mb-4">Nombre de Lignes Total</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-300">Domaines :</span>
                      <span className="text-white font-semibold">
                        {files.reduce((sum, f) => sum + (f.statistiques?.domain_lignes || 0), 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-300">WHOIS :</span>
                      <span className="text-white font-semibold">
                        {files.reduce((sum, f) => sum + (f.statistiques?.whois_lignes || 0), 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-300">Vérifier :</span>
                      <span className="text-white font-semibold">
                        {files.reduce((sum, f) => sum + (f.statistiques?.verifier_lignes || 0), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Moyennes des lignes */}
                <div className="bg-neutral-700/50 rounded-xl p-6 border border-neutral-600">
                  <h4 className="text-lg font-semibold text-white mb-4">Moyennes</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-300">Lignes domaines moyennes :</span>
                      <span className="text-white font-semibold">
                        {(() => {
                          const totalDomainLines = files.reduce((sum, f) => sum + (f.statistiques?.domain_lignes || 0), 0);
                          const filesWithDomainLines = files.filter(f => f.statistiques?.domain_lignes > 0).length;
                          return filesWithDomainLines > 0 ? Math.round(totalDomainLines / filesWithDomainLines).toLocaleString() : '0';
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-300">Lignes WHOIS moyennes :</span>
                      <span className="text-white font-semibold">
                        {(() => {
                          const totalWhoisLines = files.reduce((sum, f) => sum + (f.statistiques?.whois_lignes || 0), 0);
                          const filesWithWhoisLines = files.filter(f => f.statistiques?.whois_lignes > 0).length;
                          return filesWithWhoisLines > 0 ? Math.round(totalWhoisLines / filesWithWhoisLines).toLocaleString() : '0';
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-300">Lignes vérifier moyennes :</span>
                      <span className="text-white font-semibold">
                        {(() => {
                          const totalVerifierLines = files.reduce((sum, f) => sum + (f.statistiques?.verifier_lignes || 0), 0);
                          const filesWithVerifierLines = files.filter(f => f.statistiques?.verifier_lignes > 0).length;
                          return filesWithVerifierLines > 0 ? Math.round(totalVerifierLines / filesWithVerifierLines).toLocaleString() : '0';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Graphique des performances */}
            <div>
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                <ArrowPathIcon className="h-5 w-5 mr-2 text-green-300" />
                Performance des Services
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Performance WHOIS */}
                <div className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-600 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 text-center">Service WHOIS</h4>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-2">
                      {files.filter(f => f.type === 'whois' && f.statistiques?.whois_lignes > 0).length}
                    </div>
                    <div className="text-sm text-neutral-300">Fichiers traités</div>
                  </div>
                </div>

                {/* Performance MillionVerifier */}
                <div className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-600 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 text-center">Service MillionVerifier</h4>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-2">
                      {files.filter(f => f.type === 'verifier' && f.statistiques?.verifier_lignes > 0).length}
                    </div>
                    <div className="text-sm text-neutral-300">Fichiers traités</div>
                  </div>
                </div>

                {/* Performance générale */}
                <div className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-600 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 text-center">Performance Générale</h4>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-2">
                      {Math.round((files.filter(f => f.statistiques && (f.statistiques.whois_lignes > 0 || f.statistiques.verifier_lignes > 0)).length / Math.max(files.length, 1)) * 100)}%
                    </div>
                    <div className="text-sm text-neutral-300">Taux de traitement</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onglet Campagnes SmartLeads */}
      {activeTab === 'campaigns' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-12">
          <div className="glass-card p-8 rounded-2xl">




            {/* Liste des campagnes */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <UserGroupIcon className="h-6 w-6 mr-3 text-blue-300" />
                Campagnes
              </h2>
              {campaignsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-300 mx-auto"></div>
                  <p className="text-glass-300 mt-4">Chargement des campagnes...</p>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-16">
                  <UserGroupIcon className="h-16 w-16 text-glass-300 mx-auto mb-4" />
                  <p className="text-glass-300 text-lg mb-2">Aucune campagne</p>
                  <p className="text-glass-400">Créez votre première campagne pour commencer</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {campaigns
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // Trier par date de création (plus récentes en premier)
                    .slice(0, 4) // Prendre seulement les 4 dernières
                    .map((campaign) => (
                    <div key={campaign.id} className="glass-card p-6 rounded-xl">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h4 className="text-lg font-semibold text-white">{campaign.name}</h4>
                            <span className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                              campaign.status === 'DRAFTED' ? 'bg-gray-500/20 text-gray-300 border-gray-400/30' :
                              campaign.status === 'ACTIVE' ? 'bg-green-500/20 text-green-300 border-green-400/30' :
                              campaign.status === 'START' ? 'bg-blue-500/20 text-blue-300 border-blue-400/30' :
                              campaign.status === 'PAUSED' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30' :
                              campaign.status === 'STOPPED' ? 'bg-red-500/20 text-red-300 border-red-400/30' :
                              campaign.status === 'COMPLETED' ? 'bg-purple-500/20 text-purple-300 border-purple-400/30' :
                              'bg-gray-500/20 text-gray-300 border-gray-400/30'
                            }`}>
                              {campaign.status === 'DRAFTED' ? 'Brouillon' :
                               campaign.status === 'ACTIVE' ? 'Active' :
                               campaign.status === 'START' ? 'Démarrée' :
                               campaign.status === 'PAUSED' ? 'En pause' :
                               campaign.status === 'STOPPED' ? 'Arrêtée' :
                               campaign.status === 'COMPLETED' ? 'Terminée' : 'Inconnu'}
                            </span>
                          </div>
                          
                          {campaign.smartLeadsId && (
                            <p className="text-xs text-blue-300 font-mono mb-3">ID: {campaign.smartLeadsId}</p>
                          )}
                          
                          {campaign.description && (
                            <p className="text-glass-300 text-sm mb-4">{campaign.description}</p>
                          )}
                          
                          {/* Boutons d'action avec le style des domaines */}
                          <div className="flex gap-2 mb-4">
                            {/* Bouton d'import pour les campagnes en brouillon */}
                            {campaign.status === 'DRAFTED' && (
                              <button
                                onClick={() => handleImportLeads(campaign)}
                                className="glass-button flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-green-400 hover:bg-green-500 hover:text-white transition-all duration-200"
                              >
                                📥 Importer
                              </button>
                            )}

                            {/* Bouton Sender Accounts pour les campagnes en brouillon */}
                            {campaign.status === 'DRAFTED' && (
                              <button
                                onClick={() => handleEmailAccounts(campaign)}
                                className="glass-button flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:bg-gray-500 hover:text-white transition-all duration-200"
                                title="Gérer les comptes email de la campagne"
                              >
                                📧 Sender Accounts
                              </button>
                            )}

                            {/* Bouton pour les campagnes en brouillon */}
                            {campaign.status === 'DRAFTED' && (
                              <button
                                onClick={() => updateCampaignStatus(campaign.id, 'START')}
                                disabled={campaignActionLoading[campaign.id]}
                                className="glass-button-primary flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <PlayIcon className="h-3 w-3 mr-1" />
                                {campaignActionLoading[campaign.id] ? '...' : 'Lancer'}
                              </button>
                            )}
                            
                            {/* Bouton Pause pour les campagnes actives */}
                            {campaign.status === 'ACTIVE' && (
                              <button
                                onClick={() => updateCampaignStatus(campaign.id, 'PAUSED')}
                                disabled={campaignActionLoading[campaign.id]}
                                className="glass-button flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-yellow-400 hover:bg-yellow-500 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <PauseIcon className="h-3 w-3 mr-1" />
                                {campaignActionLoading[campaign.id] ? '...' : 'Pause'}
                              </button>
                            )}
                            
                            {/* Bouton Relancer pour les campagnes en pause */}
                            {campaign.status === 'PAUSED' && (
                              <button
                                onClick={() => updateCampaignStatus(campaign.id, 'START')}
                                disabled={campaignActionLoading[campaign.id]}
                                className="glass-button-primary flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <PlayIcon className="h-3 w-3 mr-1" />
                                {campaignActionLoading[campaign.id] ? '...' : 'Relancer'}
                              </button>
                            )}
                            
                            {/* Bouton Stop pour les campagnes actives ou en pause */}
                            {(campaign.status === 'ACTIVE' || campaign.status === 'PAUSED') && (
                              <button
                                onClick={() => setCampaignToStop(campaign)}
                                disabled={campaignActionLoading[campaign.id]}
                                className="glass-button flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <StopIcon className="h-3 w-3 mr-1" />
                                {campaignActionLoading[campaign.id] ? '...' : 'Stop'}
                              </button>
                            )}
                          </div>
                          
                          {/* Informations de date */}
                          <div className="text-sm text-glass-400">
                            <span>Créée le {new Date(campaign.createdAt).toLocaleDateString('fr-FR')}</span>
                            {campaign.endDate && (
                              <span className="ml-4">Fin prévue: {new Date(campaign.endDate).toLocaleDateString('fr-FR')}</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Boutons secondaires à droite avec le style des domaines */}
                        <div className="flex flex-col gap-2 ml-6">
                          <button
                            onClick={() => duplicateCampaign(campaign.id, {
                              name: `${campaign.name} (Copie)`,
                              description: `${campaign.description} - Copie créée le ${new Date().toLocaleDateString('fr-FR')}`
                            })}
                            className="glass-button flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
                          >
                            <DocumentDuplicateIcon className="h-3 w-3 mr-1" />
                            Dupliquer
                          </button>
                          <button
                            onClick={() => setCampaignToDelete(campaign)}
                            className="glass-button flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200"
                          >
                            <TrashIcon className="h-3 w-3 mr-1" />
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Indicateur s'il y a plus de campagnes */}
                  {campaigns.length > 4 && (
                    <div className="text-center py-4">
                      <p className="text-glass-400 text-sm">
                        Affichage des 4 dernières campagnes sur {campaigns.length} au total
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale de confirmation de suppression */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-neutral-800 border border-neutral-600 rounded-2xl p-8 max-w-md w-full mx-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                Supprimer le fichier ?
              </h3>
              <button
                onClick={() => setFileToDelete(null)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-neutral-300 mb-6">Êtes-vous sûr de vouloir supprimer <span className="text-white font-semibold">{fileToDelete.name}</span> ?</p>
            <div className="flex space-x-3">
              <button
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {deleteLoading ? 'Suppression...' : 'Oui, supprimer'}
              </button>
              <button
                onClick={() => setFileToDelete(null)}
                className="flex-1 bg-neutral-600 hover:bg-neutral-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 shadow-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de confirmation d'arrêt de campagne */}
      {campaignToStop && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-neutral-800 border border-neutral-600 rounded-2xl p-8 max-w-md w-full mx-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                Arrêter la campagne ?
              </h3>
              <button
                onClick={() => setCampaignToStop(null)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-neutral-300 mb-6">Êtes-vous sûr de vouloir arrêter la campagne <span className="text-white font-semibold">{campaignToStop.name}</span> ?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  updateCampaignStatus(campaignToStop.id, 'STOPPED');
                  setCampaignToStop(null);
                }}
                disabled={campaignActionLoading[campaignToStop.id]}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {campaignActionLoading[campaignToStop.id] ? 'Arrêt...' : 'Oui, arrêter'}
              </button>
              <button
                onClick={() => setCampaignToStop(null)}
                className="flex-1 bg-neutral-600 hover:bg-neutral-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 shadow-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de confirmation de suppression de campagne */}
      {campaignToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-neutral-800 border border-neutral-600 rounded-2xl p-8 max-w-md w-full mx-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                Supprimer la campagne ?
              </h3>
              <button
                onClick={() => setCampaignToDelete(null)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-neutral-300 mb-6">Êtes-vous sûr de vouloir supprimer la campagne <span className="text-white font-semibold">{campaignToDelete.name}</span> ?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => deleteCampaign(campaignToDelete.id)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 shadow-sm"
              >
                Oui, supprimer
              </button>
              <button
                onClick={() => setCampaignToDelete(null)}
                className="flex-1 bg-neutral-600 hover:bg-neutral-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 shadow-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Modal moderne pour téléchargement quotidiens */}
      {selectedAction === 'daily-download' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-neutral-800 border border-neutral-600 rounded-2xl p-8 max-w-md w-full mx-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                Télécharger & Convertir les fichiers quotidiens
              </h3>
              <button
                onClick={() => setSelectedAction(null)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <button
                className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${dailyForm.mode === 'yesterday' ? 'bg-accent-600 text-white' : 'bg-neutral-700 text-neutral-200 hover:bg-accent-700'}`}
                onClick={() => setDailyForm({ mode: 'yesterday', days: 1 })}
              >
                Hier uniquement
              </button>
              <button
                className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${dailyForm.mode === 'last7days' ? 'bg-accent-600 text-white' : 'bg-neutral-700 text-neutral-200 hover:bg-accent-700'}`}
                onClick={() => setDailyForm({ mode: 'last7days', days: 7 })}
              >
                Les 7 derniers jours
              </button>
              <div className="flex items-center gap-2">
                <button
                  className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${dailyForm.mode === 'specific' ? 'bg-accent-600 text-white' : 'bg-neutral-700 text-neutral-200 hover:bg-accent-700'}`}
                  onClick={() => setDailyForm({ ...dailyForm, mode: 'specific' })}
                >
                  Jour spécifique
                </button>
                {dailyForm.mode === 'specific' && (
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={dailyForm.days}
                    onChange={e => setDailyForm({ ...dailyForm, days: Math.max(1, Math.min(7, Number(e.target.value))) })}
                    className="w-20 py-2 px-2 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    placeholder="1-7"
                  />
                )}
              </div>
              <button
                onClick={handleDailyDownload}
                disabled={loading}
                className="w-full bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.01] shadow-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Téléchargement...' : 'Lancer le téléchargement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pour filtrage par date */}
      {selectedAction === 'date-filter' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-neutral-800 border border-neutral-600 rounded-2xl p-8 max-w-md w-full mx-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                Filtrer par période de création
              </h3>
              <button
                onClick={() => { setSelectedAction(null); setProcessFile(null); setDateFilterForm({ startDate: '', endDate: '' }); }}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Date de début
                </label>
                <input
                  type="date"
                  value={dateFilterForm.startDate}
                  onChange={e => setDateFilterForm({ ...dateFilterForm, startDate: e.target.value })}
                  className="w-full py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Date de fin
                </label>
                <input
                  type="date"
                  value={dateFilterForm.endDate}
                  onChange={e => setDateFilterForm({ ...dateFilterForm, endDate: e.target.value })}
                  className="w-full py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>
              <div className="text-xs text-neutral-400 mt-2">
                💡 L'ordre des dates n'importe pas, l'intervalle sera automatiquement ajusté
              </div>
              <button
                onClick={handleDateFilter}
                disabled={loading || !dateFilterForm.startDate || !dateFilterForm.endDate}
                className="w-full bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.01] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Filtrage...' : 'Lancer le filtrage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pour filtrage par localisation */}
      {selectedAction === 'location-filter' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-neutral-800 border border-neutral-600 rounded-2xl p-8 max-w-md w-full mx-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                Filtrer par localisation
              </h3>
              <button
                onClick={() => { setSelectedAction(null); setProcessFile(null); setLocationFilterForm({ type: 'ville', value: '' }); }}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Type de localisation
                </label>
                <select
                  value={locationFilterForm.type}
                  onChange={e => setLocationFilterForm({ ...locationFilterForm, type: e.target.value })}
                  className="w-full py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="ville">Ville</option>
                  <option value="departement">Département (code postal)</option>
                  <option value="region">Région</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Valeur à rechercher
                </label>
                <input
                  type="text"
                  value={locationFilterForm.value}
                  onChange={e => setLocationFilterForm({ ...locationFilterForm, value: e.target.value })}
                  placeholder={locationFilterForm.type === 'departement' ? 'Ex: 75, 13, 69...' : 'Ex: Paris, Lyon, Marseille...'}
                  className="w-full py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>
              <div className="text-xs text-neutral-400 mt-2">
                💡 La recherche est insensible à la casse et recherche les correspondances partielles
              </div>
              <button
                onClick={handleLocationFilter}
                disabled={loading || !locationFilterForm.value.trim()}
                className="w-full bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.01] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Filtrage...' : 'Lancer le filtrage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale d'aperçu CSV */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-neutral-800 border border-neutral-600 rounded-2xl p-8 max-w-2xl w-full mx-4 animate-slide-up shadow-2xl relative">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                Aperçu du fichier&nbsp;
                <span className="text-blue-300 text-base font-mono">{previewFileName}</span>
              </h3>
              <button
                onClick={() => { setShowPreviewModal(false); setCsvPreview(null); setPreviewFileName(null); setSelectedAction(null); }}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {csvPreviewLoading ? (
              <div className="flex items-center justify-center h-32 text-blue-300">
                <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Chargement de l'aperçu...
              </div>
            ) : Array.isArray(csvPreview) && csvPreview.length > 0 ? (
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="min-w-full text-sm text-left text-white border border-neutral-700 rounded-lg overflow-hidden">
                  <thead className="bg-neutral-700">
                    <tr>
                      {Object.keys(csvPreview[0]).map((col, idx) => (
                        <th key={idx} className="px-3 py-2 font-semibold border-b border-neutral-600">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr key={i} className="border-b border-neutral-700 hover:bg-neutral-700/40">
                        {Object.keys(csvPreview[0]).map((col, j) => (
                          <td key={j} className="px-3 py-1 whitespace-nowrap">{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-xs text-neutral-400 mt-2">(Aperçu des 10 premières lignes)</div>
              </div>
            ) : (
              <div className="text-red-400">Impossible de charger l'aperçu du fichier.</div>
            )}
          </div>
        </div>
      )}

      {/* Modale d'import des leads */}
      {importModalOpen && selectedCampaignForImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-neutral-800 border border-neutral-600 rounded-2xl p-8 max-w-2xl w-full mx-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                Importer des leads
              </h3>
              <button
                onClick={() => {
                  setImportModalOpen(false);
                  setSelectedCampaignForImport(null);
                }}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="mb-2">
                  <label className="block text-sm font-medium text-neutral-300">
                    Fichier CSV à importer
                  </label>
                </div>
                <div className="relative">
                  <select 
                    id="csvFileSelect"
                    size="6"
                    className="w-full p-3 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500 overflow-y-auto resize-none csv-file-select"
                    style={{ 
                      height: 'auto', 
                      minHeight: '120px',
                      maxHeight: '180px'
                    }}
                    onChange={(e) => {
                      // Stocker le fichier sélectionné pour afficher les détails
                      const selectedFile = csvFiles.find(f => f.name === e.target.value);
                      if (selectedFile) {
                        setSelectedCsvFile(selectedFile);
                      }
                    }}
                  >
                    {csvFilesLoading ? (
                      <option value="" disabled className="py-2 px-1 text-neutral-500">
                        ⏳ Chargement des fichiers...
                      </option>
                    ) : csvFiles.length === 0 ? (
                      <option value="" disabled className="py-2 px-1 text-neutral-500">
                        ❌ Aucun fichier CSV disponible
                      </option>
                    ) : (
                      csvFiles.map((file) => (
                        <option 
                          key={file.name} 
                          value={file.name} 
                          className="py-2 px-1 hover:bg-neutral-600 border-b border-neutral-600 last:border-b-0"
                        >
                          📄 {file.name}
                        </option>
                      ))
                    )}
                  </select>
                  
                  {/* Affichage des détails du fichier sélectionné */}
                  {selectedCsvFile && (
                    <div className="mt-3 p-3 bg-neutral-600/50 rounded-lg border border-neutral-500">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white">
                          📄 {selectedCsvFile.name}
                        </h4>
                        <span className="text-xs px-2 py-1 bg-neutral-500 rounded-full text-neutral-200">
                          {selectedCsvFile.type || 'unknown'}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-3 text-xs text-neutral-300">
                        <div>
                          <span className="text-neutral-400">📊 Taille:</span>
                          <br />
                          <span className="font-medium">{(selectedCsvFile.size / 1024).toFixed(1)} KB</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">📈 Lignes:</span>
                          <br />
                          <span className="font-medium">{selectedCsvFile.totalRows || selectedCsvFile.totalLines || 0}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">📅 Modifié:</span>
                          <br />
                          <span className="font-medium">
                            {selectedCsvFile.modified ? new Date(selectedCsvFile.modified).toLocaleDateString('fr-FR') : 'N/A'}
                          </span>
                        </div>
                      </div>
                      {selectedCsvFile.validRows !== undefined && (
                        <div className="mt-2 pt-2 border-t border-neutral-500">
                          <div className="flex justify-between text-xs">
                            <span className="text-green-400">✅ Lignes valides: {selectedCsvFile.validRows}</span>
                            {selectedCsvFile.invalidRows > 0 && (
                              <span className="text-red-400">❌ Lignes invalides: {selectedCsvFile.invalidRows}</span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="mt-2 pt-2 border-t border-neutral-500">
                        <div className="text-xs text-neutral-400">
                          ⚙️ Taille des lots: <span className="text-blue-400 font-medium">50 leads par lot</span> (optimisé pour la fiabilité)
                        </div>
                      </div>
                    </div>
                  )}
                  
    
                </div>
                {csvFiles.length > 0 && (
                  <p className="text-xs text-neutral-500 mt-1">
                    {csvFiles.length} fichier(s) CSV disponible(s) dans le registre
                  </p>
                )}
              </div>
              

              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setImportModalOpen(false);
                    setSelectedCampaignForImport(null);
                    setSelectedCsvFile(null); // Réinitialiser la sélection du fichier
                  }}
                  className="flex-1 bg-neutral-600 hover:bg-neutral-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200"
                >
                  Annuler
                </button>
                <button
                  id="importButton"
                  onClick={async () => {
                    const csvFile = document.getElementById('csvFileSelect').value;
                    
                    if (!csvFile) {
                      setMessage({ type: 'error', text: 'Veuillez sélectionner un fichier CSV' });
                      return;
                    }
                    
                    try {
                      // Appeler l'API d'import avec le nom du fichier et une taille de lot fixe (50)
                      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${selectedCampaignForImport.id}/import-leads`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          csvFile: csvFile,
                          batchSize: 50 // Taille de lot fixe optimisée
                        })
                      });
                      
                      if (response.ok) {
                        const result = await response.json();
                        if (result.success) {
                          setMessage({ type: 'success', text: `Import terminé avec succès ! ${result.result.success}/${result.result.total} leads importés.` });
                          setImportModalOpen(false);
                          setSelectedCampaignForImport(null);
                          setSelectedCsvFile(null); // Réinitialiser la sélection du fichier
                          // Rafraîchir la liste des campagnes
                          fetchCampaigns();
                        } else {
                          setMessage({ type: 'error', text: result.error || 'Erreur lors de l\'import' });
                        }
                      } else {
                        const error = await response.json();
                        setMessage({ type: 'error', text: error.error || 'Erreur lors de l\'import' });
                      }
                    } catch (error) {
                      console.error('Erreur lors de l\'import:', error);
                      setMessage({ type: 'error', text: 'Erreur de connexion au serveur' });
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.01] shadow-sm"
                >
                  Importer les leads
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale des comptes email */}
      {emailAccountsModalOpen && selectedCampaignForEmailAccounts && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-neutral-800 border border-neutral-600 rounded-2xl max-w-6xl w-full mx-4 animate-slide-up shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header fixe de la modale */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-600 flex-shrink-0">
              <div className="flex items-center space-x-4">
                <h3 className="text-2xl font-bold text-white">
                  📧 Gérer les comptes email
                </h3>
                <div className="h-6 w-px bg-neutral-600"></div>
                <p className="text-lg text-blue-300 font-semibold">
                  Campagne : {selectedCampaignForEmailAccounts.name}
                </p>
              </div>
              <button
                onClick={handleEmailAccountsClose}
                className="text-neutral-400 hover:text-white transition-colors p-2 hover:bg-neutral-700 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Contenu principal avec scroll */}
            <div className="flex-1 overflow-hidden p-6">
              
              {/* Section de recherche et filtres */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-white mb-4">
                  🔍 Recherche et sélection
                </h4>
                <div className="flex items-center justify-between p-4 bg-neutral-700/50 rounded-lg border border-neutral-600">
                  <span className="text-white font-medium">
                    Total des comptes : <span className="text-blue-300">{emailAccounts.length}</span>
                    {emailAccounts.length > 0 && (
                      <span className="text-sm text-neutral-400 ml-2">
                        (Tous les comptes ont été chargés)
                      </span>
                    )}
                  </span>
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      placeholder="Rechercher un compte email..."
                      value={emailAccountsSearchTerm}
                      onChange={(e) => setEmailAccountsSearchTerm(e.target.value)}
                      className="px-4 py-2 border rounded-lg bg-neutral-600 text-white border-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-600 rounded-lg transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Section du tableau avec hauteur fixe et scroll */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-white mb-4">
                  📋 Liste des comptes email disponibles
                </h4>
                
                {emailAccountsLoading ? (
                  <div className="flex flex-col items-center justify-center h-32 text-blue-300 bg-neutral-700/30 rounded-lg">
                    <svg className="animate-spin h-8 w-8 mb-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    <div className="text-center">
                      <div className="font-medium">Chargement des comptes email...</div>
                      <div className="text-sm text-neutral-400 mt-1">Récupération de tous les comptes depuis SmartLeads</div>
                    </div>
                  </div>
                ) : emailAccounts.length === 0 ? (
                  <div className="text-center py-16 text-neutral-400 bg-neutral-700/30 rounded-lg">
                    <p className="text-lg mb-2">Aucun compte email trouvé</p>
                    <p className="text-sm">Vérifiez votre configuration SmartLeads</p>
                  </div>
                ) : (
                  <div className="bg-neutral-700/30 rounded-lg border border-neutral-600 overflow-hidden">
                    {/* Tableau avec hauteur fixe et scroll */}
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm text-left text-white">
                        <thead className="bg-neutral-700 sticky top-0 z-10">
                          <tr>
                            <th className="px-6 py-4 text-left font-semibold">
                              <input
                                type="checkbox"
                                checked={selectedEmailAccounts.size === emailAccounts.length && emailAccounts.length > 0}
                                onChange={toggleAllEmailAccounts}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                              />
                            </th>
                            <th className="px-6 py-4 text-left font-semibold">👤 Nom & Email</th>
                            <th className="px-6 py-4 text-left font-semibold">🔧 Type</th>
                            <th className="px-6 py-4 text-left font-semibold">📈 Réputation</th>
                            <th className="px-6 py-4 text-left font-semibold">⏰ Limite/jour</th>
                            <th className="px-6 py-4 text-left font-semibold">🟢 Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emailAccounts
                            .filter(account => 
                              account.from_name?.toLowerCase().includes(emailAccountsSearchTerm.toLowerCase()) ||
                              account.from_email?.toLowerCase().includes(emailAccountsSearchTerm.toLowerCase())
                            )
                                                    .map((account) => (
                        <tr 
                          key={account.id} 
                          className={`border-b border-neutral-600 hover:bg-neutral-600/40 transition-colors cursor-pointer ${
                            selectedEmailAccounts.has(account.id) ? 'bg-blue-600/20 border-blue-500/50' : ''
                          }`}
                          onClick={() => toggleEmailAccountSelection(account.id)}
                        >
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedEmailAccounts.has(account.id)}
                              onChange={() => toggleEmailAccountSelection(account.id)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-white">{account.from_name || 'Sans nom'}</div>
                              <div className="text-sm text-neutral-400 flex items-center">
                                {account.from_email}
                                <svg className="w-4 h-4 ml-1 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-400">
                            {account.type || 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              account.warmup_details?.warmup_reputation === '100%' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {account.warmup_details?.warmup_reputation || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-400">
                            {account.daily_sent_count || 0} / {account.message_per_day || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              account.is_smtp_success && account.is_imap_success
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {account.is_smtp_success && account.is_imap_success ? 'Connecté' : 'Erreur'}
                            </span>
                          </td>
                        </tr>
                      ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer fixe avec bouton toujours visible */}
            <div className="flex justify-between items-center p-6 border-t border-neutral-600 bg-neutral-800 flex-shrink-0">
              <div className="text-sm text-neutral-400">
                {selectedEmailAccounts.size > 0 
                  ? `✅ ${selectedEmailAccounts.size} compte(s) sélectionné(s)`
                  : '⚠️ Aucun compte sélectionné'
                }
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleEmailAccountsClose}
                  className="px-4 py-2 text-neutral-400 hover:text-white transition-colors border border-neutral-600 rounded-lg hover:bg-neutral-700"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveEmailAccounts}
                  disabled={emailAccountsSaving}
                  className={`px-6 py-2 rounded-lg transition-colors duration-200 font-medium ${
                    emailAccountsSaving 
                      ? 'bg-blue-400 text-white cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {emailAccountsSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Sauvegarde...
                    </>
                  ) : (
                    `💾 Sauvegarder (${selectedEmailAccounts.size})`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale des statistiques */}
      {showStatsModal && selectedFileForStats && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-neutral-800 border border-neutral-600 rounded-2xl p-8 max-w-2xl w-full mx-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                📊 Statistiques du fichier
              </h3>
              <button
                onClick={() => { setShowStatsModal(false); setSelectedFileForStats(null); }}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-white mb-2">
                📁 {selectedFileForStats.name}
              </h4>
              <div className="text-sm text-neutral-400">
                Type: <span className="text-blue-300">{getFileTypeName(selectedFileForStats)}</span> | 
                Taille: <span className="text-green-300">{formatFileSize(selectedFileForStats.size)}</span>
              </div>
            </div>

            <div className="space-y-6">
              {/* Section Domaines */}
              <div className="bg-neutral-700/50 rounded-lg p-4 border-2 border-green-500">
                <h5 className="text-md font-semibold text-white mb-3">
                  Téléchargement des domaines
                </h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {selectedFileForStats.statistiques?.domain_lignes || 0}
                    </div>
                    <div className="text-sm text-neutral-400">Lignes téléchargées</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {selectedFileForStats.statistiques?.domain_temps || 0}s
                    </div>
                    <div className="text-sm text-neutral-400">Temps de téléchargement</div>
                  </div>
                </div>
              </div>

              {/* Section WHOIS */}
              <div className="bg-neutral-700/50 rounded-lg p-4 border-2 border-purple-500">
                <h5 className="text-md font-semibold text-white mb-3">
                  Traitement WHOIS
                </h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {selectedFileForStats.statistiques?.whois_lignes || 0}
                    </div>
                    <div className="text-sm text-neutral-400">Lignes traitées</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {selectedFileForStats.statistiques?.whois_temps || 0}s
                    </div>
                    <div className="text-sm text-neutral-400">Temps de traitement</div>
                  </div>
                </div>
              </div>

              {/* Section MillionVerifier */}
              <div className="bg-neutral-700/50 rounded-lg p-4 border-2 border-yellow-500">
                <h5 className="text-md font-semibold text-white mb-3">
                  Traitement MillionVerifier
                </h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {selectedFileForStats.statistiques?.verifier_lignes || 0}
                    </div>
                    <div className="text-sm text-neutral-400">Lignes traitées</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {selectedFileForStats.statistiques?.verifier_temps || 0}s
                    </div>
                    <div className="text-sm text-neutral-400">Temps de traitement</div>
                  </div>
                </div>
              </div>

              {/* Résumé des performances */}
              <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg p-4 border border-blue-500/30">
                <h5 className="text-md font-semibold text-white mb-3">
                  📈 Résumé des performances
                </h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-neutral-400">Total des lignes traitées :</span>
                    <div className="text-lg font-bold text-white">
                      {Math.max(
                        selectedFileForStats.statistiques?.domain_lignes || 0,
                        selectedFileForStats.statistiques?.whois_lignes || 0,
                        selectedFileForStats.statistiques?.verifier_lignes || 0
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-400">Temps total :</span>
                    <div className="text-lg font-bold text-white">
                      {(
                        (selectedFileForStats.statistiques?.domain_temps || 0) +
                        (selectedFileForStats.statistiques?.whois_temps || 0) +
                        (selectedFileForStats.statistiques?.verifier_temps || 0)
                      )}s
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => { setShowStatsModal(false); setSelectedFileForStats(null); }}
                className="px-6 py-2 bg-neutral-600 hover:bg-neutral-700 text-white font-medium rounded-lg transition-all duration-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Composant pour créer une nouvelle campagne
function CreateCampaignForm({ onSubmit, onCancel, availableFiles }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    totalLeads: '',
    maxLeadsPerDay: '100',
    retryAttempts: '3',
    delayBetweenRequests: '2000',
    targetLocations: [],
    targetIndustries: [],
    files: []
  });

  const [locationInput, setLocationInput] = useState('');
  const [industryInput, setIndustryInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Le nom de la campagne est requis');
      return;
    }

    if (!formData.totalLeads || parseInt(formData.totalLeads) <= 0) {
      alert('Le nombre de leads doit être supérieur à 0');
      return;
    }

    onSubmit({
      ...formData,
      totalLeads: parseInt(formData.totalLeads),
      maxLeadsPerDay: parseInt(formData.maxLeadsPerDay),
      retryAttempts: parseInt(formData.retryAttempts),
      delayBetweenRequests: parseInt(formData.delayBetweenRequests)
    });
  };

  const addLocation = () => {
    if (locationInput.trim() && !formData.targetLocations.includes(locationInput.trim())) {
      setFormData(prev => ({
        ...prev,
        targetLocations: [...prev.targetLocations, locationInput.trim()]
      }));
      setLocationInput('');
    }
  };

  const removeLocation = (location) => {
    setFormData(prev => ({
      ...prev,
      targetLocations: prev.targetLocations.filter(l => l !== location)
    }));
  };

  const addIndustry = () => {
    if (industryInput.trim() && !formData.targetIndustries.includes(industryInput.trim())) {
      setFormData(prev => ({
        ...prev,
        targetIndustries: [...prev.targetIndustries, industryInput.trim()]
      }));
      setIndustryInput('');
    }
  };

  const removeIndustry = (industry) => {
    setFormData(prev => ({
      ...prev,
      targetIndustries: prev.targetIndustries.filter(i => i !== industry)
    }));
  };

  const toggleFile = (fileName) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.includes(fileName)
        ? prev.files.filter(f => f !== fileName)
        : [...prev.files, fileName]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informations de base */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Nom de la campagne *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
            placeholder="Ex: Campagne Q4 2025"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Description
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
            placeholder="Description de la campagne"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Date de début
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-full py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Date de fin (optionnel)
          </label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
            className="w-full py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>
      </div>

      {/* Configuration des leads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Nombre total de leads *
          </label>
          <input
            type="number"
            value={formData.totalLeads}
            onChange={(e) => setFormData(prev => ({ ...prev, totalLeads: e.target.value }))}
            className="w-full py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
            placeholder="1000"
            min="1"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Leads maximum par jour
          </label>
          <input
            type="number"
            value={formData.maxLeadsPerDay}
            onChange={(e) => setFormData(prev => ({ ...prev, maxLeadsPerDay: e.target.value }))}
            className="w-full py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
            placeholder="100"
            min="1"
          />
        </div>
      </div>

      {/* Configuration technique */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Tentatives de retry
          </label>
          <input
            type="number"
            value={formData.retryAttempts}
            onChange={(e) => setFormData(prev => ({ ...prev, retryAttempts: e.target.value }))}
            className="w-full py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
            placeholder="3"
            min="1"
            max="10"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Délai entre requêtes (ms)
          </label>
          <input
            type="number"
            value={formData.delayBetweenRequests}
            onChange={(e) => setFormData(prev => ({ ...prev, delayBetweenRequests: e.target.value }))}
            className="w-full py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
            placeholder="2000"
            min="500"
            step="100"
          />
        </div>
      </div>

      {/* Localisations cibles */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Localisations cibles (codes département)
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            className="flex-1 py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
            placeholder="Ex: 75, 13, 69..."
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
          />
          <button
            type="button"
            onClick={addLocation}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Ajouter
          </button>
        </div>
        {formData.targetLocations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.targetLocations.map((location, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm"
              >
                {location}
                <button
                  type="button"
                  onClick={() => removeLocation(location)}
                  className="text-blue-300 hover:text-blue-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Industries cibles */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Industries cibles
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={industryInput}
            onChange={(e) => setIndustryInput(e.target.value)}
            className="flex-1 py-2.5 px-4 rounded-lg bg-neutral-700 text-white border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
            placeholder="Ex: tech, finance, consulting..."
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addIndustry())}
          />
          <button
            type="button"
            onClick={addIndustry}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Ajouter
          </button>
        </div>
        {formData.targetIndustries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.targetIndustries.map((industry, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm"
              >
                {industry}
                <button
                  type="button"
                  onClick={() => removeIndustry(industry)}
                  className="text-green-300 hover:text-green-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Fichiers à traiter */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Fichiers à traiter
        </label>
        <div className="max-h-32 overflow-y-auto space-y-2">
          {availableFiles.map((file) => (
            <label key={file.name} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.files.includes(file.name)}
                onChange={() => toggleFile(file.name)}
                className="rounded border-neutral-600 bg-neutral-700 text-accent-500 focus:ring-accent-500"
              />
              <span className="text-sm text-neutral-300">{file.name}</span>
              <span className="text-xs text-neutral-500">({file.totalLines || 0} lignes)</span>
            </label>
          ))}
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          className="flex-1 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.01] shadow-sm"
        >
          Créer la campagne
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 border border-neutral-600"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}export default App; 

