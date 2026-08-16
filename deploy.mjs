import SftpClient from 'ssh2-sftp-client';
import { chargerIdentifiants } from './deploy.credentials.mjs';

const sftp = new SftpClient();
const { host, user, password } = chargerIdentifiants();

const CREDENTIALS = {
  host,
  port:              22,
  username:          user,
  password,
  keepaliveInterval: 5000,
  keepaliveCountMax: 10,
  readyTimeout:      30000,
};

const LOCAL  = './dist';
// Sous-dossier obligatoire : la racine /htdocs/jsawebapp héberge le portail,
// y déployer l'app l'écraserait (c'est exactement ce qui est arrivé en juillet).
const REMOTE = '/htdocs/jsawebapp/statlive';

console.log('Déploiement volleystatlive-v2 → /htdocs/jsawebapp/statlive/ ...');

try {
  await sftp.connect(CREDENTIALS);
  await sftp.uploadDir(LOCAL, REMOTE);
  console.log('Déploiement terminé ! → https://seme-et-tisse.fr/jsawebapp/statlive/');
} catch (err) {
  console.error('Erreur SFTP :', err.message);
  process.exit(1);
} finally {
  await sftp.end();
}
