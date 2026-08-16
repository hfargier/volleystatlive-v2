import { readFileSync, existsSync } from 'node:fs';

const CHEMIN = new URL('./deploy.config.json', import.meta.url);

/**
 * Identifiants de déploiement — jamais en dur dans le code, ce fichier étant
 * versionné. Priorité aux variables d'environnement (pratique en CI), repli
 * sur deploy.config.json qui, lui, n'est pas versionné.
 */
export const chargerIdentifiants = () => {
  let fichier = {};

  if (existsSync(CHEMIN)) {
    try {
      fichier = JSON.parse(readFileSync(CHEMIN, 'utf8'));
    } catch (err) {
      console.error('❌ deploy.config.json est illisible :', err.message);
      process.exit(1);
    }
  }

  const ids = {
    host: process.env.FTP_HOST ?? fichier.host,
    user: process.env.FTP_USER ?? fichier.user,
    password: process.env.FTP_PASSWORD ?? fichier.password,
  };

  const manquants = Object.entries(ids)
    .filter(([, valeur]) => !valeur)
    .map(([cle]) => cle);

  if (manquants.length > 0) {
    console.error(
      `❌ Identifiants FTP manquants : ${manquants.join(', ')}.\n` +
        '   Crée deploy.config.json à partir de deploy.config.example.json :\n' +
        '     cp deploy.config.example.json deploy.config.json'
    );
    process.exit(1);
  }

  return ids;
};
