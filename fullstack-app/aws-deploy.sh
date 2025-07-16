#!/bin/bash

# Script de déploiement AWS pour l'application de traitement de domaines
# Ce script configure et déploie l'application sur AWS EC2

set -e

echo "🚀 Démarrage du déploiement AWS..."

# Configuration
APP_NAME="domain-processor"
EC2_INSTANCE_TYPE="t3.medium"
KEY_NAME="domain-processor-key"
SECURITY_GROUP_NAME="domain-processor-sg"
REGION="eu-west-3"  # Paris

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier que AWS CLI est installé
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    log_error "Docker n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

log_info "Configuration AWS..."

# Créer une clé SSH si elle n'existe pas
if ! aws ec2 describe-key-pairs --key-names $KEY_NAME --region $REGION &> /dev/null; then
    log_info "Création de la clé SSH..."
    aws ec2 create-key-pair --key-name $KEY_NAME --region $REGION --query 'KeyMaterial' --output text > $KEY_NAME.pem
    chmod 400 $KEY_NAME.pem
    log_info "Clé SSH créée: $KEY_NAME.pem"
else
    log_warn "La clé SSH $KEY_NAME existe déjà"
fi

# Créer un groupe de sécurité
if ! aws ec2 describe-security-groups --group-names $SECURITY_GROUP_NAME --region $REGION &> /dev/null; then
    log_info "Création du groupe de sécurité..."
    aws ec2 create-security-group \
        --group-name $SECURITY_GROUP_NAME \
        --description "Security group for domain processor app" \
        --region $REGION

    # Autoriser SSH
    aws ec2 authorize-security-group-ingress \
        --group-name $SECURITY_GROUP_NAME \
        --protocol tcp \
        --port 22 \
        --cidr 0.0.0.0/0 \
        --region $REGION

    # Autoriser HTTP
    aws ec2 authorize-security-group-ingress \
        --group-name $SECURITY_GROUP_NAME \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0 \
        --region $REGION

    # Autoriser HTTPS
    aws ec2 authorize-security-group-ingress \
        --group-name $SECURITY_GROUP_NAME \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0 \
        --region $REGION

    # Autoriser le port de l'application
    aws ec2 authorize-security-group-ingress \
        --group-name $SECURITY_GROUP_NAME \
        --protocol tcp \
        --port 3001 \
        --cidr 0.0.0.0/0 \
        --region $REGION

    log_info "Groupe de sécurité créé"
else
    log_warn "Le groupe de sécurité $SECURITY_GROUP_NAME existe déjà"
fi

# Créer un bucket S3 pour les données
BUCKET_NAME="domain-processor-data-$(date +%s)"
log_info "Création du bucket S3: $BUCKET_NAME"
aws s3 mb s3://$BUCKET_NAME --region $REGION

# Créer l'instance EC2
log_info "Lancement de l'instance EC2..."

INSTANCE_ID=$(aws ec2 run-instances \
    --image-id ami-0a0c8eebcdd6dcbd0 \
    --count 1 \
    --instance-type $EC2_INSTANCE_TYPE \
    --key-name $KEY_NAME \
    --security-groups $SECURITY_GROUP_NAME \
    --region $REGION \
    --user-data file://user-data.sh \
    --query 'Instances[0].InstanceId' \
    --output text)

log_info "Instance EC2 créée: $INSTANCE_ID"

# Attendre que l'instance soit en cours d'exécution
log_info "Attente du démarrage de l'instance..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

# Récupérer l'IP publique
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --region $REGION \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

log_info "IP publique: $PUBLIC_IP"

# Attendre que l'instance soit prête
log_info "Attente que l'instance soit prête..."
sleep 60

# Créer le script de déploiement
cat > deploy-to-instance.sh << EOF
#!/bin/bash

# Se connecter à l'instance et déployer l'application
ssh -i $KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP << 'REMOTE_SCRIPT'

# Mettre à jour le système
sudo apt-get update
sudo apt-get upgrade -y

# Installer Docker et Docker Compose
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker ubuntu

# Cloner le projet (remplacer par votre repo Git)
git clone https://github.com/votre-username/domain-processor.git
cd domain-processor/fullstack-app

# Construire et démarrer l'application
sudo docker-compose up -d --build

# Configurer le redémarrage automatique
sudo systemctl enable docker

echo "Application déployée avec succès!"

REMOTE_SCRIPT
EOF

chmod +x deploy-to-instance.sh

log_info "Déploiement terminé!"
log_info "Instance EC2: $INSTANCE_ID"
log_info "IP publique: $PUBLIC_IP"
log_info "Bucket S3: $BUCKET_NAME"
log_info ""
log_info "Pour vous connecter à l'instance:"
log_info "ssh -i $KEY_NAME.pem ubuntu@$PUBLIC_IP"
log_info ""
log_info "Pour accéder à l'application:"
log_info "http://$PUBLIC_IP:3001"
log_info ""
log_info "Pour déployer l'application, exécutez:"
log_info "./deploy-to-instance.sh"

# Sauvegarder les informations de déploiement
cat > deployment-info.txt << EOF
Déploiement AWS - $(date)
Instance EC2: $INSTANCE_ID
IP publique: $PUBLIC_IP
Bucket S3: $BUCKET_NAME
Clé SSH: $KEY_NAME.pem
Groupe de sécurité: $SECURITY_GROUP_NAME
Région: $REGION
EOF

log_info "Informations de déploiement sauvegardées dans deployment-info.txt" 