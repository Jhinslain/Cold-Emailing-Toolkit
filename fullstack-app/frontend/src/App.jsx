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
  ChatBubbleLeftRightIcon
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
      case 'classique':
      default:
        return 'bg-neutral-600 hover:bg-neutral-700 border-neutral-500'; // Gris pour classique
    }
  };



  const handlePreview = async (file) => {
    setCsvPreviewLoading(true);
    setSelectedAction(`preview-${file.name}`);
    
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/files/preview/${encodeURIComponent(file.name)}`);
      const data = await response.json();
      
      if (data.success) {
        setCsvPreview(data.preview);
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
  const handleExport = (file) => {
    // Lien direct vers l'API de téléchargement (à adapter si besoin)
    window.open(`${import.meta.env.VITE_API_URL}/api/files/download/${encodeURIComponent(file.name)}`, '_blank');
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

  const handleForceDailyAndWhois = async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${import.meta.env.VITE_API_URL}/api/schedule/daily-whois`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        showMessage('success', data.message || 'Téléchargement + WHOIS lancé avec succès !');
        fetchFiles();
      } else {
        showMessage('error', data.error || 'Erreur lors du lancement du job');
      }
    } catch (error) {
      showMessage('error', 'Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Header moderne avec effet de verre */}
      <header className="glass-card sticky top-0 z-40 border-b border-glass-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <GlobeAltIcon className="h-10 w-10 text-white floating-animation" />
                <SparklesIcon className="h-4 w-4 text-yellow-300 absolute -top-1 -right-1 pulse-glow" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Traitement Domaines AFNIC
                </h1>
                <p className="text-glass-300 mt-1">
                  Interface moderne pour le traitement des domaines .fr
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

      {/* Stats Cards avec effet de verre */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card glass-card-hover p-6 rounded-2xl animate-fade-in">
              <div className="flex items-center">
                <div className="p-3 bg-blue-500 rounded-xl">
                  <FolderIcon className="h-8 w-8 text-blue-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-glass-300">Fichiers de données</p>
                  <p className="text-2xl font-bold text-white">{stats.dataFiles}</p>
                </div>
              </div>
            </div>
            
            <div className="glass-card glass-card-hover p-6 rounded-2xl animate-fade-in" style={{animationDelay: '0.1s'}}>
              <div className="flex items-center">
                <div className="p-3 bg-emerald-500 rounded-xl">
                  <ChartBarIcon className="h-8 w-8 text-emerald-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-glass-300">Fichiers traités</p>
                  <p className="text-2xl font-bold text-white">{stats.outputFiles}</p>
                </div>
              </div>
            </div>
            
            <div className="glass-card glass-card-hover p-6 rounded-2xl animate-fade-in" style={{animationDelay: '0.2s'}}>
              <div className="flex items-center">
                <div className="p-3 bg-purple-500 rounded-xl">
                  <CloudArrowDownIcon className="h-8 w-8 text-purple-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-glass-300">Taille données</p>
                  <p className="text-2xl font-bold text-white">{formatFileSize(stats.totalDataSize)}</p>
                </div>
              </div>
            </div>
            
            <div className="glass-card glass-card-hover p-6 rounded-2xl animate-fade-in" style={{animationDelay: '0.3s'}}>
              <div className="flex items-center">
                <div className="p-3 bg-orange-500 rounded-xl">
                  <ServerIcon className="h-8 w-8 text-orange-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-glass-300">Taille traités</p>
                  <p className="text-2xl font-bold text-white">{formatFileSize(stats.totalOutputSize)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions de téléchargement avec design moderne */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="glass-card p-8 rounded-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <CloudArrowDownIcon className="h-6 w-6 mr-3 text-blue-300" />
            Téléchargements
          </h2>
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
              <button
                onClick={handleForceDailyAndWhois}
                disabled={loading}
                className="glass-button-primary flex items-center justify-center px-6 py-3 rounded-lg text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <InformationCircleIcon className="h-6 w-6 mr-3" />
                {loading ? 'Traitement...' : 'Forcer Schedule'}
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
        </div>
      </div>

      {/* Files Cards Section avec design moderne */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <DocumentTextIcon className="h-6 w-6 mr-3 text-blue-300" />
            Fichiers ({files.length})
          </h2>
          {/* BOUTON METTRE À JOUR LES DATES SUPPRIMÉ */}
        </div>

        {/* Barre d'actions pour les fichiers sélectionnés */}
        {selectedFiles.size > 0 && (
          <div className="glass-card p-4 mb-6 rounded-xl animate-slide-up">
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
          // Tri personnalisé : OPENDATA_FR_202505.csv d'abord, puis AFNIC, puis le reste
          (() => {
            const sortedFiles = [...files].sort((a, b) => {
              if (a.name === "OPENDATA_FR_202505.csv") return -1;
              if (b.name === "OPENDATA_FR_202505.csv") return 1;
              if (a.type === "afnic" && b.type !== "afnic") return -1;
              if (a.type !== "afnic" && b.type === "afnic") return 1;
              return 0;
            });
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {sortedFiles.map((file, index) => {
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
                
                {/* Bouton Filtrer par localisation - seulement pour les fichiers WHOIS */}
                {file.type === 'whois' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setProcessFile(file); setSelectedAction('location-filter'); }}
                    className={`flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 text-white ${getButtonColor(file, 'location-filter')}`}
                  >
                    <GlobeAltIcon className="h-3 w-3 mr-1" />
                    Trier par loc
                  </button>
                )}
                
                {/* Bouton WHOIS - pour tous les fichiers sauf les fichiers WHOIS */}
                {file.type !== 'whois' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleWhoisAnalyze(file); }}
                    className={`flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 text-white ${getButtonColor(file, 'whois')}`}
                  >
                    <InformationCircleIcon className="h-3 w-3 mr-1" />
                    WHOIS
                  </button>
                )}

                {/* Bouton Messages personnalisés - seulement pour les fichiers WHOIS */}
                {file.type === 'whois' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePersonalizedMessages(file); }}
                    className="flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 text-white bg-purple-600 hover:bg-purple-700"
                  >
                    <ChatBubbleLeftRightIcon className="h-3 w-3 mr-1" />
                    Messages
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleExport(file); }}
                  className={`flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 text-white ${getButtonColor(file, 'export')}`}
                >
                  <DocumentArrowDownIcon className="h-3 w-3 mr-1" />
                  Exporter
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePreview(file); }}
                  className="glass-button flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
                >
                  <EyeIcon className="h-3 w-3 mr-1" />
                  Aperçu
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
            );
          })()
        )}
      </div>



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
                className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 border border-neutral-600"
              >
                Non, annuler
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
    </div>
  );
}

export default App; 