/**
 * Déploie l'API PHP de VolleyStat Live.
 *
 * La source de vérité est src/api/api_volleystatlive.php — la copie à la racine
 * du dépôt est une ancienne version, à ne pas utiliser.
 *
 * config.php n'est jamais envoyé : il ne vit que sur le serveur.
 * Usage : node deploy-api.mjs
 */

import SftpClient from 'ssh2-sftp-client';
import { chargerIdentifiants } from './deploy.credentials.mjs';

const sftp = new SftpClient();
const { host, user, password } = chargerIdentifiants();

const LOCAL  = './src/api/api_volleystatlive.php';
const REMOTE = '/htdocs/API/VolleyStatLive/api_volleystatlive.php';

console.log(`Déploiement API VolleyStat Live → ${REMOTE} ...`);

try {
  await sftp.connect({ host, port: 22, username: user, password });
  await sftp.put(LOCAL, REMOTE);
  console.log('API déployée → https://seme-et-tisse.fr/API/VolleyStatLive/api_volleystatlive.php');
} catch (err) {
  console.error('Erreur SFTP :', err.message);
  process.exit(1);
} finally {
  await sftp.end();
}
