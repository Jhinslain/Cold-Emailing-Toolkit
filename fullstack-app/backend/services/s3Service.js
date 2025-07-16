const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

class S3Service {
    constructor() {
        // Configuration AWS S3
        this.s3 = new AWS.S3({
            region: process.env.AWS_REGION || 'eu-west-3',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
        
        this.bucketName = process.env.S3_BUCKET_NAME || 'domain-processor-data';
        this.dataDir = path.join(__dirname, '../data');
        
        console.log('🔗 Service S3 initialisé');
    }

    // Vérifier si le bucket existe, sinon le créer
    async ensureBucketExists() {
        try {
            await this.s3.headBucket({ Bucket: this.bucketName }).promise();
            console.log(`✅ Bucket S3 ${this.bucketName} existe déjà`);
        } catch (error) {
            if (error.statusCode === 404) {
                console.log(`🔄 Création du bucket S3 ${this.bucketName}...`);
                await this.s3.createBucket({
                    Bucket: this.bucketName,
                    CreateBucketConfiguration: {
                        LocationConstraint: process.env.AWS_REGION || 'eu-west-3'
                    }
                }).promise();
                console.log(`✅ Bucket S3 ${this.bucketName} créé`);
            } else {
                throw error;
            }
        }
    }

    // Uploader un fichier vers S3
    async uploadFile(localFilePath, s3Key) {
        try {
            const fileContent = fs.readFileSync(localFilePath);
            
            const params = {
                Bucket: this.bucketName,
                Key: s3Key,
                Body: fileContent,
                ContentType: this.getContentType(localFilePath),
                Metadata: {
                    'upload-date': new Date().toISOString(),
                    'file-size': fileContent.length.toString()
                }
            };

            const result = await this.s3.upload(params).promise();
            console.log(`📤 Fichier uploadé vers S3: ${s3Key}`);
            return result.Location;
            
        } catch (error) {
            console.error(`❌ Erreur lors de l'upload vers S3: ${error.message}`);
            throw error;
        }
    }

    // Télécharger un fichier depuis S3
    async downloadFile(s3Key, localFilePath) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: s3Key
            };

            const result = await this.s3.getObject(params).promise();
            fs.writeFileSync(localFilePath, result.Body);
            console.log(`📥 Fichier téléchargé depuis S3: ${s3Key}`);
            
        } catch (error) {
            console.error(`❌ Erreur lors du téléchargement depuis S3: ${error.message}`);
            throw error;
        }
    }

    // Lister les fichiers dans S3
    async listFiles(prefix = '') {
        try {
            const params = {
                Bucket: this.bucketName,
                Prefix: prefix
            };

            const result = await this.s3.listObjectsV2(params).promise();
            return result.Contents || [];
            
        } catch (error) {
            console.error(`❌ Erreur lors de la liste des fichiers S3: ${error.message}`);
            throw error;
        }
    }

    // Supprimer un fichier de S3
    async deleteFile(s3Key) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: s3Key
            };

            await this.s3.deleteObject(params).promise();
            console.log(`🗑️ Fichier supprimé de S3: ${s3Key}`);
            
        } catch (error) {
            console.error(`❌ Erreur lors de la suppression S3: ${error.message}`);
            throw error;
        }
    }

    // Synchroniser un dossier local avec S3
    async syncDirectory(localDir, s3Prefix = '') {
        try {
            console.log(`🔄 Synchronisation du dossier ${localDir} avec S3...`);
            
            if (!fs.existsSync(localDir)) {
                console.log(`⚠️ Le dossier local ${localDir} n'existe pas`);
                return;
            }

            const files = fs.readdirSync(localDir);
            let uploadedCount = 0;

            for (const file of files) {
                const localFilePath = path.join(localDir, file);
                const stats = fs.statSync(localFilePath);
                
                if (stats.isFile()) {
                    const s3Key = s3Prefix ? `${s3Prefix}/${file}` : file;
                    await this.uploadFile(localFilePath, s3Key);
                    uploadedCount++;
                }
            }

            console.log(`✅ Synchronisation terminée: ${uploadedCount} fichiers uploadés`);
            
        } catch (error) {
            console.error(`❌ Erreur lors de la synchronisation: ${error.message}`);
            throw error;
        }
    }

    // Sauvegarder automatiquement les données
    async backupData() {
        try {
            console.log('💾 Démarrage de la sauvegarde automatique...');
            
            await this.ensureBucketExists();
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPrefix = `backups/${timestamp}`;
            
            // Sauvegarder les données
            await this.syncDirectory(this.dataDir, backupPrefix);
            
            // Sauvegarder le registre des fichiers
            const registryPath = path.join(this.dataDir, 'files_registry.json');
            if (fs.existsSync(registryPath)) {
                await this.uploadFile(registryPath, `${backupPrefix}/files_registry.json`);
            }
            
            console.log('✅ Sauvegarde automatique terminée');
            
        } catch (error) {
            console.error(`❌ Erreur lors de la sauvegarde: ${error.message}`);
            throw error;
        }
    }

    // Restaurer les données depuis S3
    async restoreData(backupTimestamp) {
        try {
            console.log(`🔄 Restauration depuis la sauvegarde ${backupTimestamp}...`);
            
            const backupPrefix = `backups/${backupTimestamp}`;
            const files = await this.listFiles(backupPrefix);
            
            // Créer le dossier de restauration
            const restoreDir = path.join(this.dataDir, 'restore');
            if (!fs.existsSync(restoreDir)) {
                fs.mkdirSync(restoreDir, { recursive: true });
            }
            
            let restoredCount = 0;
            
            for (const file of files) {
                const fileName = file.Key.replace(`${backupPrefix}/`, '');
                const localFilePath = path.join(restoreDir, fileName);
                
                await this.downloadFile(file.Key, localFilePath);
                restoredCount++;
            }
            
            console.log(`✅ Restauration terminée: ${restoredCount} fichiers restaurés dans ${restoreDir}`);
            
        } catch (error) {
            console.error(`❌ Erreur lors de la restauration: ${error.message}`);
            throw error;
        }
    }

    // Nettoyer les anciennes sauvegardes (garder 7 jours)
    async cleanupOldBackups() {
        try {
            console.log('🧹 Nettoyage des anciennes sauvegardes...');
            
            const backups = await this.listFiles('backups/');
            const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 jours
            
            let deletedCount = 0;
            
            for (const backup of backups) {
                const backupDate = new Date(backup.LastModified);
                
                if (backupDate < cutoffDate) {
                    await this.deleteFile(backup.Key);
                    deletedCount++;
                }
            }
            
            console.log(`✅ Nettoyage terminé: ${deletedCount} sauvegardes supprimées`);
            
        } catch (error) {
            console.error(`❌ Erreur lors du nettoyage: ${error.message}`);
            throw error;
        }
    }

    // Obtenir le type MIME d'un fichier
    getContentType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.csv': 'text/csv',
            '.json': 'application/json',
            '.txt': 'text/plain',
            '.zip': 'application/zip',
            '.gz': 'application/gzip'
        };
        
        return mimeTypes[ext] || 'application/octet-stream';
    }

    // Vérifier l'espace utilisé dans S3
    async getStorageUsage() {
        try {
            const files = await this.listFiles();
            let totalSize = 0;
            
            for (const file of files) {
                totalSize += file.Size || 0;
            }
            
            return {
                totalSize,
                totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
                fileCount: files.length
            };
            
        } catch (error) {
            console.error(`❌ Erreur lors du calcul de l'usage: ${error.message}`);
            throw error;
        }
    }
}

module.exports = S3Service; 