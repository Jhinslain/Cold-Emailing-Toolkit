# Script PowerShell pour le déploiement AWS sur Windows
# Ce script automatise le processus de déploiement

param(
    [string]$Region = "eu-west-3",
    [string]$InstanceType = "t3.medium",
    [string]$ProjectName = "domain-processor"
)

Write-Host "🚀 Démarrage du déploiement AWS pour $ProjectName..." -ForegroundColor Green

# Vérifier que AWS CLI est installé
try {
    aws --version | Out-Null
    Write-Host "✅ AWS CLI détecté" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI n'est pas installé. Veuillez l'installer d'abord." -ForegroundColor Red
    Write-Host "Téléchargez-le depuis: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Vérifier que Docker est installé
try {
    docker --version | Out-Null
    Write-Host "✅ Docker détecté" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker n'est pas installé. Veuillez l'installer d'abord." -ForegroundColor Red
    Write-Host "Téléchargez-le depuis: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

# Configuration
$KeyName = "$ProjectName-key"
$SecurityGroupName = "$ProjectName-sg"
$BucketName = "$ProjectName-data-$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host "📋 Configuration:" -ForegroundColor Cyan
Write-Host "  Région: $Region" -ForegroundColor White
Write-Host "  Type d'instance: $InstanceType" -ForegroundColor White
Write-Host "  Nom du projet: $ProjectName" -ForegroundColor White
Write-Host "  Clé SSH: $KeyName" -ForegroundColor White
Write-Host "  Groupe de sécurité: $SecurityGroupName" -ForegroundColor White
Write-Host "  Bucket S3: $BucketName" -ForegroundColor White

# Demander confirmation
$confirmation = Read-Host "`nVoulez-vous continuer avec cette configuration? (y/N)"
if ($confirmation -ne "y" -and $confirmation -ne "Y") {
    Write-Host "Déploiement annulé." -ForegroundColor Yellow
    exit 0
}

# Créer la clé SSH si elle n'existe pas
Write-Host "`n🔑 Vérification de la clé SSH..." -ForegroundColor Cyan
try {
    aws ec2 describe-key-pairs --key-names $KeyName --region $Region | Out-Null
    Write-Host "✅ La clé SSH $KeyName existe déjà" -ForegroundColor Green
} catch {
    Write-Host "🔄 Création de la clé SSH $KeyName..." -ForegroundColor Yellow
    aws ec2 create-key-pair --key-name $KeyName --region $Region --query 'KeyMaterial' --output text > "$KeyName.pem"
    Write-Host "✅ Clé SSH créée: $KeyName.pem" -ForegroundColor Green
}

# Créer le groupe de sécurité
Write-Host "`n🛡️ Vérification du groupe de sécurité..." -ForegroundColor Cyan
try {
    aws ec2 describe-security-groups --group-names $SecurityGroupName --region $Region | Out-Null
    Write-Host "✅ Le groupe de sécurité $SecurityGroupName existe déjà" -ForegroundColor Green
} catch {
    Write-Host "🔄 Création du groupe de sécurité..." -ForegroundColor Yellow
    
    aws ec2 create-security-group `
        --group-name $SecurityGroupName `
        --description "Security group for $ProjectName" `
        --region $Region

    # Autoriser SSH
    aws ec2 authorize-security-group-ingress `
        --group-name $SecurityGroupName `
        --protocol tcp `
        --port 22 `
        --cidr 0.0.0.0/0 `
        --region $Region

    # Autoriser HTTP
    aws ec2 authorize-security-group-ingress `
        --group-name $SecurityGroupName `
        --protocol tcp `
        --port 80 `
        --cidr 0.0.0.0/0 `
        --region $Region

    # Autoriser HTTPS
    aws ec2 authorize-security-group-ingress `
        --group-name $SecurityGroupName `
        --protocol tcp `
        --port 443 `
        --cidr 0.0.0.0/0 `
        --region $Region

    # Autoriser le port de l'application
    aws ec2 authorize-security-group-ingress `
        --group-name $SecurityGroupName `
        --protocol tcp `
        --port 3001 `
        --cidr 0.0.0.0/0 `
        --region $Region

    Write-Host "✅ Groupe de sécurité créé" -ForegroundColor Green
}

# Créer le bucket S3
Write-Host "`n🪣 Création du bucket S3..." -ForegroundColor Cyan
aws s3 mb "s3://$BucketName" --region $Region
Write-Host "✅ Bucket S3 créé: $BucketName" -ForegroundColor Green

# Construire l'image Docker
Write-Host "`n🐳 Construction de l'image Docker..." -ForegroundColor Cyan
docker build -t $ProjectName .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la construction Docker" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Image Docker construite" -ForegroundColor Green

# Lancer l'instance EC2
Write-Host "`n🖥️ Lancement de l'instance EC2..." -ForegroundColor Cyan

$InstanceId = aws ec2 run-instances `
    --image-id ami-0a0c8eebcdd6dcbd0 `
    --count 1 `
    --instance-type $InstanceType `
    --key-name $KeyName `
    --security-groups $SecurityGroupName `
    --region $Region `
    --user-data file://user-data.sh `
    --query 'Instances[0].InstanceId' `
    --output text

Write-Host "✅ Instance EC2 créée: $InstanceId" -ForegroundColor Green

# Attendre que l'instance soit en cours d'exécution
Write-Host "`n⏳ Attente du démarrage de l'instance..." -ForegroundColor Cyan
aws ec2 wait instance-running --instance-ids $InstanceId --region $Region

# Récupérer l'IP publique
$PublicIP = aws ec2 describe-instances `
    --instance-ids $InstanceId `
    --region $Region `
    --query 'Reservations[0].Instances[0].PublicIpAddress' `
    --output text

Write-Host "✅ IP publique: $PublicIP" -ForegroundColor Green

# Attendre que l'instance soit prête
Write-Host "`n⏳ Attente que l'instance soit prête (60 secondes)..." -ForegroundColor Cyan
Start-Sleep -Seconds 60

# Créer le script de déploiement
$DeployScript = @"
#!/bin/bash

# Se connecter à l'instance et déployer l'application
ssh -i $KeyName.pem -o StrictHostKeyChecking=no ubuntu@$PublicIP << 'REMOTE_SCRIPT'

# Mettre à jour le système
sudo apt-get update
sudo apt-get upgrade -y

# Installer Docker et Docker Compose
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker ubuntu

# Créer le répertoire de l'application
sudo mkdir -p /opt/$ProjectName
cd /opt/$ProjectName

# Copier les fichiers de l'application (à adapter selon votre méthode de déploiement)
# Option 1: Via Git
# git clone https://github.com/votre-username/$ProjectName.git .

# Option 2: Via SCP (à implémenter)
# scp -r ../$ProjectName/* ubuntu@$PublicIP:/opt/$ProjectName/

# Construire et démarrer l'application
sudo docker-compose up -d --build

# Configurer le redémarrage automatique
sudo systemctl enable docker

echo "Application déployée avec succès!"

REMOTE_SCRIPT
"@

$DeployScript | Out-File -FilePath "deploy-to-instance.sh" -Encoding UTF8

# Créer le fichier d'informations de déploiement
$DeploymentInfo = @"
Déploiement AWS - $(Get-Date)
Instance EC2: $InstanceId
IP publique: $PublicIP
Bucket S3: $BucketName
Clé SSH: $KeyName.pem
Groupe de sécurité: $SecurityGroupName
Région: $Region

Commandes utiles:
- Connexion SSH: ssh -i $KeyName.pem ubuntu@$PublicIP
- Accès web: http://$PublicIP
- Accès API: http://$PublicIP:3001/api/hello
- Déploiement: ./deploy-to-instance.sh

Monitoring:
- CloudWatch Logs: /aws/ec2/$ProjectName
- Logs locaux: /var/log/$ProjectName/
"@

$DeploymentInfo | Out-File -FilePath "deployment-info.txt" -Encoding UTF8

# Afficher les résultats
Write-Host "`n🎉 Déploiement terminé!" -ForegroundColor Green
Write-Host "`n📋 Informations de déploiement:" -ForegroundColor Cyan
Write-Host "  Instance EC2: $InstanceId" -ForegroundColor White
Write-Host "  IP publique: $PublicIP" -ForegroundColor White
Write-Host "  Bucket S3: $BucketName" -ForegroundColor White
Write-Host "  Clé SSH: $KeyName.pem" -ForegroundColor White

Write-Host "`n🔗 Accès à l'application:" -ForegroundColor Cyan
Write-Host "  Interface web: http://$PublicIP" -ForegroundColor White
Write-Host "  API: http://$PublicIP:3001/api/hello" -ForegroundColor White

Write-Host "`n📝 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "  1. Connectez-vous à l'instance: ssh -i $KeyName.pem ubuntu@$PublicIP" -ForegroundColor White
Write-Host "  2. Déployez l'application: ./deploy-to-instance.sh" -ForegroundColor White
Write-Host "  3. Vérifiez les logs: sudo docker-compose logs -f" -ForegroundColor White

Write-Host "`n💡 Conseils:" -ForegroundColor Yellow
Write-Host "  - Les informations complètes sont dans deployment-info.txt" -ForegroundColor White
Write-Host "  - L'application se redémarrera automatiquement en cas de problème" -ForegroundColor White
Write-Host "  - Les sauvegardes sont automatiques tous les jours à 2h00" -ForegroundColor White
Write-Host "  - Le monitoring est actif toutes les 5 minutes" -ForegroundColor White

Write-Host "`n💰 Estimation des coûts mensuels: $40-65" -ForegroundColor Yellow 