#!/bin/bash

# Script de configuration automatique pour l'instance EC2
# Ce script s'exécute au premier démarrage de l'instance

set -e

# Mettre à jour le système
apt-get update
apt-get upgrade -y

# Installer les dépendances
apt-get install -y \
    docker.io \
    docker-compose \
    git \
    curl \
    wget \
    unzip \
    htop \
    nginx \
    certbot \
    python3-certbot-nginx

# Démarrer et activer Docker
systemctl start docker
systemctl enable docker

# Ajouter l'utilisateur ubuntu au groupe docker
usermod -aG docker ubuntu

# Créer les répertoires nécessaires
mkdir -p /opt/domain-processor
mkdir -p /var/log/domain-processor
mkdir -p /etc/domain-processor

# Configurer Nginx comme reverse proxy
cat > /etc/nginx/sites-available/domain-processor << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Configuration pour les logs SSE
    location /api/whois/analyze/stream {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

# Activer le site
ln -sf /etc/nginx/sites-available/domain-processor /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Redémarrer Nginx
systemctl restart nginx
systemctl enable nginx

# Créer un script de démarrage automatique
cat > /etc/systemd/system/domain-processor.service << 'EOF'
[Unit]
Description=Domain Processor Application
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/domain-processor
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Activer le service
systemctl enable domain-processor.service

# Créer un script de monitoring
cat > /opt/monitor.sh << 'EOF'
#!/bin/bash

# Script de monitoring pour l'application
LOG_FILE="/var/log/domain-processor/monitor.log"

echo "$(date): Vérification de l'application..." >> $LOG_FILE

# Vérifier si l'application répond
if curl -f http://localhost:3001/api/hello > /dev/null 2>&1; then
    echo "$(date): Application OK" >> $LOG_FILE
else
    echo "$(date): Application ne répond pas, redémarrage..." >> $LOG_FILE
    cd /opt/domain-processor && docker-compose restart
fi

# Vérifier l'espace disque
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): ATTENTION - Espace disque faible: ${DISK_USAGE}%" >> $LOG_FILE
fi

# Nettoyer les anciens logs
find /var/log/domain-processor -name "*.log" -mtime +7 -delete
EOF

chmod +x /opt/monitor.sh

# Ajouter le monitoring au cron
echo "*/5 * * * * /opt/monitor.sh" | crontab -

# Créer un script de sauvegarde
cat > /opt/backup.sh << 'EOF'
#!/bin/bash

# Script de sauvegarde des données
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Sauvegarder les données de l'application
if [ -d "/opt/domain-processor/backend/data" ]; then
    tar -czf $BACKUP_DIR/data_$DATE.tar.gz -C /opt/domain-processor/backend data/
    echo "Sauvegarde des données créée: data_$DATE.tar.gz"
fi

# Nettoyer les anciennes sauvegardes (garder 7 jours)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /opt/backup.sh

# Ajouter la sauvegarde au cron (tous les jours à 2h du matin)
echo "0 2 * * * /opt/backup.sh" | crontab -

# Installer CloudWatch Agent pour le monitoring
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb

# Configurer CloudWatch
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/domain-processor/*.log",
                        "log_group_name": "/aws/ec2/domain-processor",
                        "log_stream_name": "{instance_id}",
                        "timezone": "UTC"
                    }
                ]
            }
        }
    },
    "metrics": {
        "metrics_collected": {
            "disk": {
                "measurement": ["used_percent"],
                "metrics_collection_interval": 60,
                "resources": ["*"]
            },
            "mem": {
                "measurement": ["mem_used_percent"],
                "metrics_collection_interval": 60
            }
        }
    }
}
EOF

# Démarrer CloudWatch Agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Créer un fichier de configuration pour l'application
cat > /etc/domain-processor/config.env << 'EOF'
NODE_ENV=production
PORT=3001
AWS_REGION=eu-west-3
LOG_LEVEL=info
EOF

echo "Configuration de l'instance terminée!" 