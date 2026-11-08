import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const repo = path.basename(root).replace('marathon-', '');
const entries = {
  escrow: ['index.html', 'default/index.html'],
  invoice: ['index.html', 'default/index.html'],
  subscriptions: ['public/index.html', 'default/index.html'],
  nda: ['index.html', 'private-agreement.html'],
  airdrop: ['index.html'],
  ucan: ['index.html', 'modern.html'],
}[repo];
const serveRoot = repo === 'ucan' ? path.join(root, 'dist') : root;
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(serveRoot, `.${pathname}`);
    if (!file.startsWith(serveRoot + path.sep)) { res.writeHead(403).end(); return; }
    if (pathname === '/default/config.json') {
      const config = JSON.parse(await readFile(file, 'utf8'));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ...config, mode: 'wallet', chainId: 10, address: '0x' + '3'.repeat(40) }));
      return;
    }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const entry of entries) {
    const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
    page.setDefaultTimeout(10000);
    const external = [];
    const errors = [];
    const probes = [];
    const requestAudit = [];
    let probeMode = 'unauthorized';
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requestAudit.push({
      url: request.url(), method: request.method(), body: request.postData(), headers: request.headers(),
    }));
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === base) return route.continue();
      if (route.request().url() === 'https://api.pinata.cloud/data/testAuthentication') {
        assert.equal(route.request().method(), 'GET');
        assert.equal(route.request().postData(), null);
        assert.equal(route.request().headers().authorization, 'Bearer synthetic-browser-only');
        probes.push('pinata');
        if (probeMode === 'network-failure') return route.abort('failed');
        return route.fulfill({ status: probeMode === 'authenticated' ? 200 : 401,
          json: probeMode === 'authenticated' ? { message: 'Congratulations! You are communicating with the Pinata API!' } : { error: 'Unauthorized' } });
      }
      if (route.request().url() === 'http://127.0.0.1:5001/api/v0/version') {
        assert.equal(route.request().method(), 'POST');
        assert.equal(route.request().postData(), null);
        assert.equal(route.request().headers().authorization, undefined);
        probes.push('local');
        return route.fulfill({ json: { Version: '0.34.0' } });
      }
      external.push(route.request().url());
      if (route.request().url().includes('ethers.esm.min.js')) {
        return route.fulfill({ contentType: 'text/javascript', body: 'export const ethers = globalThis.ethers;' });
      }
      if (route.request().url().includes('ethers.umd.min.js')) {
        return route.fulfill({ contentType: 'text/javascript', body: '/* Synthetic legacy ethers provided by test fixture. */' });
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      const handlers = new Map(), requests = [];
      let chain = '0xa', accounts = ['0x' + '1'.repeat(40)];
      window.walletTest = { requests, reject: true, emit(name, value) {
        if (name === 'chainChanged') chain = value;
        if (name === 'accountsChanged') accounts = value;
        for (const callback of handlers.get(name) || []) callback(value);
      } };
      window.ethereum = {
        async request({ method }) {
          requests.push(method);
          if (method === 'eth_requestAccounts') {
            if (window.walletTest.reject) throw Object.assign(new Error('Rejected by user'), { code: 4001 });
            return accounts;
          }
          if (method === 'eth_chainId') return chain;
          if (method === 'eth_accounts') return accounts;
          if (method === 'eth_getCode') return '0x';
          throw new Error('Synthetic wallet operation unavailable: ' + method);
        },
        on(name, callback) {
          if (!handlers.has(name)) handlers.set(name, new Set());
          handlers.get(name).add(callback);
        },
        removeListener(name, callback) { handlers.get(name)?.delete(callback); },
      };
      window.ethers = {
        version: 'ethers/5.7.2-synthetic-sentinel',
        providers: { Web3Provider: class {
          constructor(raw) { this.raw = raw; }
          async getNetwork() { return { chainId: Number(BigInt(await this.raw.request({ method: 'eth_chainId' }))) }; }
          async getCode() { return '0x'; }
          getSigner() { return { getAddress: async () => (await this.raw.request({ method: 'eth_accounts' }))[0] }; }
          async send(method) { return this.raw.request({ method }); }
        } },
        Contract: class { async owner() { throw new Error('Synthetic legacy deployment unavailable'); } },
        utils: { formatUnits: value => String(value), formatEther: value => String(value) },
      };
    });
    await page.goto(`${base}/${entry}`);
    let plaintext, passphrase, packageText;
    if (entry === 'private-agreement.html') {
      plaintext = 'Synthetic confidential agreement — café, 雪. Never upload this text.';
      await page.locator('#agreement-file').setInputFiles({
        name: 'synthetic-private-agreement.md', mimeType: 'text/plain', buffer: Buffer.from(plaintext),
      });
      await page.waitForFunction(text => document.getElementById('agreement-text').value === text, plaintext);
      await page.locator('#generate-passphrase').click();
      passphrase = await page.locator('#recipient-passphrase').inputValue();
      assert.match(passphrase, /^[A-Za-z0-9_-]{43}$/);
      await page.locator('#encrypt-passphrase').fill(passphrase);
      await page.locator('#encrypt-agreement').click();
      await page.locator('main #status').getByText(/Encrypted locally/).waitFor();
      packageText = await page.locator('#encrypted-package').inputValue();
      const data = JSON.parse(packageText);
      assert.deepEqual(Object.keys(data).sort(), ['cipher', 'ciphertext', 'format', 'iv', 'kdf', 'salt', 'version']);
      assert.equal(data.kdf.iterations, 310000);
      assert.equal(data.cipher.name, 'AES-GCM');
      for (const secret of [plaintext, passphrase, 'synthetic-private-agreement.md']) assert.equal(packageText.includes(secret), false);
      await page.evaluate(() => {
        window.downloadTest = { payloads: [], clicks: [] };
        const create = URL.createObjectURL.bind(URL);
        URL.createObjectURL = blob => {
          downloadTest.payloads.push(blob.text());
          return create(blob);
        };
        HTMLAnchorElement.prototype.click = function () {
          downloadTest.clicks.push({ filename: this.download, href: this.href });
        };
      });
      await page.locator('#download-package').click();
      assert.equal(await page.evaluate(() => downloadTest.payloads[0]), packageText);
      assert.equal(await page.evaluate(() => downloadTest.clicks[0].filename), 'encrypted-agreement.json');
      await page.locator('#package-file').setInputFiles({
        name: 'encrypted-agreement.json', mimeType: 'application/json', buffer: Buffer.from(packageText),
      });
      await page.waitForFunction(text => document.getElementById('package-text').value === text, packageText);
      await page.locator('#decrypt-passphrase').fill('synthetic-wrong-passphrase-123456789012345');
      await page.locator('#decrypt-agreement').click();
      await page.locator('main #status').getByText(/Unable to decrypt/).waitFor();
      assert.equal(await page.locator('#decrypted-agreement').inputValue(), '');
      assert.equal(await page.locator('#download-plaintext').isDisabled(), true);
      await page.locator('#decrypt-passphrase').fill(passphrase);
      const tampered = JSON.parse(packageText);
      const ciphertext = Buffer.from(tampered.ciphertext, 'base64');
      ciphertext[0] ^= 1;
      tampered.ciphertext = ciphertext.toString('base64');
      await page.locator('#package-text').fill(JSON.stringify(tampered));
      await page.locator('#decrypt-agreement').click();
      await page.locator('main #status').getByText(/Unable to decrypt/).waitFor();
      assert.equal(await page.locator('#decrypted-agreement').inputValue(), '');
      assert.equal(await page.locator('#download-plaintext').isDisabled(), true);
      await page.locator('#package-text').fill(packageText);
      await page.locator('#decrypt-agreement').click();
      await page.locator('main #status').getByText(/Decrypted locally/).waitFor();
      assert.equal(await page.locator('#decrypted-agreement').inputValue(), plaintext);
      await page.locator('#download-plaintext').click();
      assert.equal(await page.evaluate(() => downloadTest.payloads[1]), plaintext);
      assert.equal(await page.evaluate(() => downloadTest.clicks[1].filename), 'decrypted-agreement.txt');
      assert.deepEqual(probes, [], 'local roundtrip contacts no provider');
    }
    const header = page.locator('decent-header');
    await header.getByRole('button', { name: 'Connect wallet', exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => walletTest.requests), [], 'mount and encryption perform no wallet RPC');
    assert.deepEqual(probes, [], 'mount does not contact providers');
    assert.equal(await page.evaluate(() => DecentHead.getIpfs().snapshot().connection.state), 'unverified');
    if (entry === 'index.html') {
      await page.locator('#legacy-status').getByText(/deployment chain is unverified/).waitFor();
      assert.equal(await page.locator('#sign-nda').isDisabled(), true);
      assert.equal(await page.locator('#update-nda').isDisabled(), true);
      await page.evaluate(async () => { await initWeb3(); await getNDAHash(); await signNDA(); await updateNDAHash(); });
      assert.deepEqual(await page.evaluate(() => walletTest.requests), []);
    }
    await header.getByRole('button', { name: 'Connect wallet', exact: true }).click();
    await header.getByText(/Rejected by user/).waitFor();
    assert.equal(await page.evaluate(() => DecentHead.getWallet().snapshot().connected), false);
    await page.evaluate(() => { walletTest.reject = false; });
    await header.getByRole('button', { name: 'Connect wallet', exact: true }).click();
    await header.getByRole('button', { name: 'Disconnect wallet', exact: true }).waitFor();
    await header.locator('wallet-connect').getByText(/Optimism/).waitFor();
    if (entry.includes('default/')) {
      await page.locator('main #connect').click();
      await page.locator('main #status').getByText(/No contract code/).waitFor();
      assert.equal(await page.evaluate(() => walletTest.requests.filter(method => method === 'eth_requestAccounts').length), 2);
      assert.equal(await page.locator('#create-form button').isDisabled(), true);
    }
    assert.equal(await page.evaluate(() => window.ethers.version), 'ethers/5.7.2-synthetic-sentinel');
    await page.evaluate(() => walletTest.emit('accountsChanged', ['0x' + '2'.repeat(40)]));
    assert.equal(await page.evaluate(() => DecentHead.getWallet().snapshot().address), '0x' + '2'.repeat(40));
    await page.evaluate(() => walletTest.emit('chainChanged', '0x270f'));
    assert.equal(await page.evaluate(() => DecentHead.getWallet().snapshot().chainId), '0x270f');
    await header.locator('wallet-connect').getByText(/chain 9999/i).waitFor();
    if (entry.includes('default/')) {
      await page.locator('main #connect').click();
      await page.locator('main #status').getByText(/Wrong chain/).waitFor();
      assert.equal(await page.locator('#create-form button').isDisabled(), true);
    }
    await header.getByRole('button', { name: 'Disconnect wallet', exact: true }).click();
    await header.getByRole('button', { name: 'Connect wallet', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => DecentHead.getWallet().snapshot().connected), false);
    const title = header.locator('app-title').getByRole('button');
    await title.focus();
    await page.keyboard.press('Enter');
    const about = header.locator('about-modal').getByRole('dialog');
    await about.waitFor();
    await about.getByRole('heading', { name: 'About DecentNDA', exact: true }).waitFor();
    await about.getByText(/Local encrypted agreement preparation/).waitFor();
    await about.locator('summary').filter({ hasText: 'Local package and separate delivery' }).click();
    await about.getByText(/recipient generates a random passphrase/).waitFor();
    await about.locator('summary').filter({ hasText: 'Privacy and legal limits' }).click();
    await about.getByText(/never private hosting, UCAN/).waitFor();
    const aboutBox = await about.boundingBox();
    assert.ok(aboutBox.x >= 0 && aboutBox.x + aboutBox.width <= 375, JSON.stringify(aboutBox));
    await page.keyboard.press('Tab');
    assert.equal(await about.evaluate(dialog => dialog.contains(dialog.getRootNode().activeElement)), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await about.evaluate(dialog => dialog.contains(dialog.getRootNode().activeElement)), true);
    await page.keyboard.press('Escape');
    assert.equal(await title.evaluate(button => button.getRootNode().activeElement === button), true);
    await header.getByRole('button', { name: 'Open IPFS controls', exact: true }).click();
    const ipfs = header.locator('ipfs-controls');
    await ipfs.getByRole('dialog').waitFor();
    assert.equal(await ipfs.locator('#community-settings').isVisible(), false);
    assert.equal(await ipfs.locator('#pin').isDisabled(), true);
    assert.equal(await ipfs.locator('#data-controls').isVisible(), false);
    for (const button of await ipfs.locator('[data-capability]').all()) assert.equal(await button.isDisabled(), true);
    await ipfs.locator('#provider-settings > summary').click();
    await ipfs.locator('#provider').selectOption('local');
    await ipfs.getByRole('button', { name: 'Use provider', exact: true }).click();
    await ipfs.getByText(/local selected; not yet verified/).waitFor();
    assert.equal(await page.evaluate(() => DecentHead.getIpfs().snapshot().provider), 'local');
    await ipfs.locator('#provider').selectOption('pinata');
    await ipfs.getByRole('button', { name: 'Use provider', exact: true }).click();
    assert.equal(await page.evaluate(() => DecentHead.getIpfs().snapshot().credentialsConfigured), false);
    assert.deepEqual(probes, []);
    await ipfs.locator('#verify-provider').click();
    await ipfs.locator('#provider-message').filter({ hasText: /personal Pinata JWT/ }).waitFor();
    assert.deepEqual(probes, []);
    await ipfs.locator('#jwt').fill('synthetic-browser-only');
    await ipfs.getByRole('button', { name: 'Use provider', exact: true }).click();
    assert.equal(await page.evaluate(() => DecentHead.getIpfs().snapshot().credentialsConfigured), true);
    assert.equal(await page.evaluate(() => DecentHead.getIpfs().snapshot().connection.state), 'unverified');
    assert.deepEqual(probes, []);
    const providerMessage = ipfs.locator('#provider-message');
    await ipfs.locator('#verify-provider').click();
    await providerMessage.filter({ hasText: /HTTP 401/ }).waitFor();
    assert.equal(await page.evaluate(() => DecentHead.getIpfs().snapshot().connection.state), 'error');
    probeMode = 'network-failure';
    await ipfs.locator('#verify-provider').click();
    await providerMessage.filter({ hasText: /failed or timed out/ }).waitFor();
    assert.equal(await page.evaluate(() => DecentHead.getIpfs().snapshot().connection.state), 'error');
    probeMode = 'authenticated';
    await ipfs.locator('#verify-provider').click();
    await providerMessage.filter({ hasText: /Pinata authenticated/ }).waitFor();
    assert.equal(await page.evaluate(() => DecentHead.getIpfs().snapshot().connection.state), 'ready');
    assert.equal(await header.locator('ipfs-status .orb').getAttribute('data-state'), 'ready');
    await ipfs.locator('#provider').selectOption('local');
    await ipfs.getByRole('button', { name: 'Use provider', exact: true }).click();
    assert.equal(await page.evaluate(() => DecentHead.getIpfs().snapshot().connection.state), 'unverified');
    await ipfs.locator('#verify-provider').click();
    await providerMessage.filter({ hasText: /Local Kubo version endpoint responded/ }).waitFor();
    assert.equal(await page.evaluate(() => DecentHead.getIpfs().snapshot().connection.state), 'ready');
    assert.deepEqual(probes, ['pinata', 'pinata', 'pinata', 'local']);
    for (const button of await ipfs.locator('[data-capability]').all()) assert.equal(await button.isDisabled(), true);
    if (entry === 'modern.html') {
      assert.equal(await page.locator('#pinataJwtInput').inputValue(), '');
      assert.equal(await page.locator('#rememberJwtInput').isChecked(), false);
      await ipfs.getByRole('button', { name: 'Open app backups controls', exact: true }).click();
      assert.equal(await page.locator('#pinataJwtInput').evaluate(input => document.activeElement === input), true);
      await header.getByRole('button', { name: 'Open IPFS controls', exact: true }).click();
    }
    const box = await ipfs.getByRole('dialog').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 375, JSON.stringify(box));
    await page.keyboard.press('Escape');
    assert.equal(await header.getByRole('button', { name: 'Open IPFS controls', exact: true }).evaluate(button => button.getRootNode().activeElement === button), true);
    assert.equal(await page.evaluate(() => walletTest.requests.some(method => /wallet_switch|wallet_add/.test(method))), false);
    const headerBox = await header.boundingBox();
    assert.ok(headerBox.width <= 375, JSON.stringify(headerBox));
    const blocked = await page.evaluate(async () => {
      const results = [];
      for (const operation of ['upload', 'restore', 'pin']) {
        try { await DecentHead.getIpfs()[operation]({ synthetic: true }); results.push(false); }
        catch (error) { results.push(/NDA public upload.*disabled/.test(error.message)); }
      }
      return results;
    });
    assert.deepEqual(blocked, [true, true, true], 'ready provider does not enable NDA upload/restore/pin');
    if (entry === 'private-agreement.html') {
      const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
      assert.ok(csp.includes('connect-src https://api.pinata.cloud/data/testAuthentication http://127.0.0.1:5001/api/v0/version;'));
      assert.equal(csp.includes('pinFileToIPFS'), false);
      assert.equal(await page.locator('#agreement-text').inputValue(), plaintext);
      assert.equal(await page.locator('#decrypted-agreement').inputValue(), plaintext);
      for (const secret of [plaintext, passphrase, packageText, 'synthetic-private-agreement.md']) {
        assert.equal(JSON.stringify(requestAudit).includes(secret), false, 'no private data in any request');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'private page fits 375px');
      await page.locator('#clear-session').click();
      for (const id of ['agreement-text', 'recipient-passphrase', 'encrypt-passphrase', 'encrypted-package',
        'package-text', 'decrypt-passphrase', 'decrypted-agreement']) assert.equal(await page.locator('#' + id).inputValue(), '');
      assert.equal(await page.locator('#download-package').isDisabled(), true);
      assert.equal(await page.locator('#download-plaintext').isDisabled(), true);
    }
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => walletTest.requests.some(method => /sendTransaction|sign|switch|addEthereum/i.test(method))), false);
    assert.deepEqual(external.filter(url => !url.endsWith('/web3.min.js')), [], 'no upload, pin, reward or other external operation');
    console.log(`PASS ${repo}/${entry}: 375px wallet lifecycle, v5 isolation, explicit provider unconfigured/401/network/Pinata-ready/Kubo-ready without uploads, About keyboard/Escape/focus, ${entry === 'private-agreement.html' ? 'local file/package roundtrip, wrong-key/tamper refusal, downloads captured in memory, private request audit' : 'legacy deployment/sign/update gates'}; legacy resources mocked/blocked (${external.length})`);
    await page.close();
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
