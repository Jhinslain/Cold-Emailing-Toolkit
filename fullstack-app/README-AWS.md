# 🚀 Guide de Déploiement AWS

Ce guide vous explique comment déployer votre application de traitement de domaines sur AWS pour qu'elle fonctionne automatiquement en continu.

## 📋 Prérequis

### 1. Compte AWS
- Un compte AWS actif
- Accès aux services EC2, S3, CloudWatch
- Permissions pour créer des instances, groupes de sécurité, etc.

### 2. Outils locaux
- AWS CLI installé et configuré
- Docker installé
- Git installé

### 3. Configuration AWS CLI
```bash
aws configure
# Entrez vos clés d'accès AWS
```

## 🏗️ Architecture AWS

### Services utilisés :
- **EC2** : Instance serveur pour l'application
- **S3** : Stockage des données et sauvegardes
- **CloudWatch** : Monitoring et logs
- **Nginx** : Reverse proxy et SSL
- **Docker** : Containerisation de l'application

### Planification automatique :
- **Téléchargement Opendata** : 1er du mois à 2h00
- **Téléchargement quotidien** : Tous les jours à 6h00
- **Traitement WHOIS** : Tous les jours à 8h00
- **Nettoyage** : Tous les dimanches à 3h00

## 🚀 Déploiement Rapide

### Option 1 : Script automatique (Recommandé)

1. **Rendre le script exécutable :**
```bash
chmod +x aws-deploy.sh
```

2. **Lancer le déploiement :**
```bash
./aws-deploy.sh
```

3. **Suivre les instructions affichées**

### Option 2 : Déploiement manuel

#### Étape 1 : Préparer l'application
```bash
# Construire l'image Docker
docker build -t domain-processor .

# Tester localement
docker-compose up -d
```

#### Étape 2 : Créer les ressources AWS

1. **Créer une clé SSH :**
```bash
aws ec2 create-key-pair --key-name domain-processor-key --query 'KeyMaterial' --output text > domain-processor-key.pem
chmod 400 domain-processor-key.pem
```

2. **Créer un groupe de sécurité :**
```bash
aws ec2 create-security-group \
    --group-name domain-processor-sg \
    --description "Security group for domain processor"

# Autoriser SSH
aws ec2 authorize-security-group-ingress \
    --group-name domain-processor-sg \
    --protocol tcp --port 22 --cidr 0.0.0.0/0

# Autoriser HTTP/HTTPS
aws ec2 authorize-security-group-ingress \
    --group-name domain-processor-sg \
    --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress \
    --group-name domain-processor-sg \
    --protocol tcp --port 443 --cidr 0.0.0.0/0

# Autoriser le port de l'application
aws ec2 authorize-security-group-ingress \
    --group-name domain-processor-sg \
    --protocol tcp --port 3001 --cidr 0.0.0.0.0/0
```

3. **Lancer l'instance EC2 :**
```bash
aws ec2 run-instances \
    --image-id ami-0a0c8eebcdd6dcbd0 \
    --count 1 \
    --instance-type t3.medium \
    --key-name domain-processor-key \
    --security-groups domain-processor-sg \
    --user-data file://user-data.sh
```

## 📊 Monitoring et Maintenance

### 1. Accès à l'application
- **Interface web** : `http://VOTRE_IP_PUBLIQUE`
- **API** : `http://VOTRE_IP_PUBLIQUE:3001/api/hello`

### 2. Logs et monitoring
- **CloudWatch Logs** : `/aws/ec2/domain-processor`
- **Logs locaux** : `/var/log/domain-processor/`
- **Monitoring** : Vérification automatique toutes les 5 minutes

### 3. Sauvegardes
- **Automatiques** : Tous les jours à 2h00
- **Stockage** : `/opt/backups/`
- **Rétention** : 7 jours

## 🔧 Gestion de l'instance

### Connexion SSH
```bash
ssh -i domain-processor-key.pem ubuntu@VOTRE_IP_PUBLIQUE
```

### Commandes utiles
```bash
# Vérifier le statut de l'application
sudo docker-compose ps

# Voir les logs
sudo docker-compose logs -f

# Redémarrer l'application
sudo docker-compose restart

# Mettre à jour l'application
cd /opt/domain-processor
git pull
sudo docker-compose up -d --build
```

### Monitoring manuel
```bash
# Vérifier l'espace disque
df -h

# Vérifier l'utilisation mémoire
free -h

# Voir les processus
htop

# Vérifier les services
sudo systemctl status domain-processor
sudo systemctl status nginx
```

## 🔄 Automatisation

### Jobs programmés
L'application inclut un service de planification qui exécute automatiquement :

1. **Téléchargement Opendata AFNIC**
   - Fréquence : 1er du mois à 2h00
   - Action : Télécharge les données mensuelles

2. **Téléchargement quotidien**
   - Fréquence : Tous les jours à 6h00
   - Action : Récupère les données des 7 derniers jours

3. **Traitement WHOIS**
   - Fréquence : Tous les jours à 8h00
   - Action : Analyse les nouveaux fichiers pour extraire les contacts

4. **Nettoyage automatique**
   - Fréquence : Tous les dimanches à 3h00
   - Action : Supprime les fichiers de plus de 30 jours

### Déclenchement manuel
```bash
# Se connecter à l'instance
ssh -i domain-processor-key.pem ubuntu@VOTRE_IP_PUBLIQUE

# Déclencher un job manuellement
cd /opt/domain-processor
sudo docker-compose exec app node backend/services/scheduler.js trigger opendata
sudo docker-compose exec app node backend/services/scheduler.js trigger daily
sudo docker-compose exec app node backend/services/scheduler.js trigger whois
```

## 💰 Estimation des coûts

### Instance EC2 (t3.medium)
- **CPU** : 2 vCPUs
- **RAM** : 4 GB
- **Coût mensuel** : ~$30-40

### Stockage S3
- **Standard** : ~$0.023/GB/mois
- **Estimation** : $5-10/mois selon l'usage

### CloudWatch
- **Logs** : $0.50/GB
- **Métriques** : Gratuit (5 métriques personnalisées)
- **Estimation** : $5-15/mois

### Total estimé : $40-65/mois

## 🔒 Sécurité

### Recommandations
1. **Limiter l'accès SSH** à votre IP uniquement
2. **Configurer un certificat SSL** avec Let's Encrypt
3. **Mettre en place des sauvegardes** vers S3
4. **Monitorer les logs** pour détecter les anomalies

### Configuration SSL
```bash
# Installer Let's Encrypt
sudo certbot --nginx -d votre-domaine.com

# Renouvellement automatique
sudo crontab -e
# Ajouter : 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🆘 Dépannage

### Problèmes courants

1. **L'application ne démarre pas**
```bash
# Vérifier les logs Docker
sudo docker-compose logs

# Vérifier l'espace disque
df -h

# Redémarrer Docker
sudo systemctl restart docker
```

2. **Problèmes de mémoire**
```bash
# Augmenter la swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

3. **Problèmes de réseau**
```bash
# Vérifier les groupes de sécurité
aws ec2 describe-security-groups --group-names domain-processor-sg

# Vérifier Nginx
sudo systemctl status nginx
sudo nginx -t
```

## 📞 Support

Pour toute question ou problème :
1. Vérifiez les logs dans CloudWatch
2. Consultez les logs locaux : `/var/log/domain-processor/`
3. Vérifiez le statut des services : `sudo systemctl status`

---

**Note** : Ce déploiement est optimisé pour un usage en production avec automatisation complète. L'application fonctionnera 24/7 avec téléchargement et traitement automatiques des données. 