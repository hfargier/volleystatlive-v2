import SftpClient from 'ssh2-sftp-client';

const sftp = new SftpClient();

const CREDENTIALS = {
  host:              'ftp.seme-et-tisse.fr',
  port:              22,
  username:          'seme-2289142',
  password:          'FTPChoune@69',
  keepaliveInterval: 5000,
  keepaliveCountMax: 10,
  readyTimeout:      30000,
};

const LOCAL  = './dist';
const REMOTE = '/htdocs/jsawebapp';

console.log('Déploiement volleystatlive-v2 → /htdocs/jsawebapp/ ...');

try {
  await sftp.connect(CREDENTIALS);
  await sftp.uploadDir(LOCAL, REMOTE);
  console.log('Déploiement terminé ! → https://seme-et-tisse.fr/jsawebapp/');
} catch (err) {
  console.error('Erreur SFTP :', err.message);
  process.exit(1);
} finally {
  await sftp.end();
}
