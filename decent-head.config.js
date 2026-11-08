window.DECENT_CONFIG = {
  version: '2.0.0', appName: 'DecentNDA', subtitle: 'Private agreements · local encryption',
  chain: null, ens: { enabled: false },
  theme: { accent: '#b9a5ff', 'accent-2': '#dbc79c', 'bg-1': '#171728', 'bg-2': '#28223d', 'bg-3': '#34304b' },
  about: { title: 'About DecentNDA', summary: 'Local encrypted agreement preparation with a separately gated legacy contract interface.',
    sections: [{ title: 'Local package and separate delivery', body: 'The private page derives an AES-256-GCM key locally with PBKDF2-SHA-256. Its downloaded package contains salt, IV and ciphertext, not plaintext, key, passphrase or filename. The recipient generates a random passphrase and shares it through a separate secure channel; deliver the package separately and keep a secure passphrase backup. A lost passphrase cannot be recovered.' },
      { title: 'Privacy and legal limits', body: 'No identity, secure key-exchange/recovery service, audit, legal review or trusted-hosting assurance is provided. Encryption is not consent or legal enforceability. A replaced script or browser extension can capture inputs; clearing fields does not guarantee memory erasure. Provider-ready means only authentication/version response, never private hosting, UCAN, backups, retention or upload permission. No agreement upload is available.' },
      { title: 'Contract unavailable gate', body: 'The legacy fixed contract has no independently verified chain configuration here. Wallet identity is not NDA authorization. Contract reads and signatures stay unavailable until the deployment chain is verified.' }] },
  ipfsAdapter: { version: 1, label: 'Private agreement storage gates', capabilities: {},
    getStatus: async () => ({ backup: { state: 'unavailable', detail: 'NDA public backup/upload disabled. No plaintext export or upload hook is installed.' },
      replication: { state: 'unavailable', detail: 'Confidential agreements must never be publicly replicated.' } }) },
  links: [{ label: 'Project source', url: 'https://github.com/TheJollyLaMa/Decent_NDA' }],
};
