const bcrypt = require('bcrypt');

// Script pour générer un mot de passe hashé
const generateHashedPassword = async (password) => {
  const saltRounds = 12; // Coût de hachage (plus élevé = plus sécurisé mais plus lent)
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  
  console.log('🔐 Mot de passe hashé généré :');
  console.log('=====================================');
  console.log(`Mot de passe original: ${password}`);
  console.log(`Mot de passe hashé: ${hashedPassword}`);
  console.log('=====================================');
  console.log('');
  console.log('📝 Pour utiliser ce hash, ajoutez cette variable d\'environnement :');
  console.log(`HASHED_PASSWORD="${hashedPassword}"`);
  console.log('');
  console.log('⚠️  IMPORTANT : Supprimez APP_PASSWORD de vos variables d\'environnement');
  console.log('   pour utiliser uniquement le mot de passe hashé.');
};

// Utiliser le mot de passe fourni en argument ou un mot de passe par défaut
const password = process.argv[2] || 'majoli2024';

generateHashedPassword(password)
  .then(() => {
    console.log('✅ Génération terminée !');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur lors de la génération:', error);
    process.exit(1);
  }); 