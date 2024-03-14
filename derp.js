import http from 'http';
import httpProxy from 'http-proxy';

httpProxy.createProxyServer({
  target: {
    protocol: 'https:',
    host: 'db-qa.community-boating.org',
    port: 443,
    //pfx: fs.readFileSync('path/to/certificate.p12'),
    //passphrase: 'password',
  },
  changeOrigin: true,
}).listen(5000);