# DecentNDA
#ProtectYoNeck

## Local encrypted agreement prototype

The private agreement page is an isolated, browser-only prototype. From the repository root, serve the files locally:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/private-agreement.html`. The recipient generates a new passphrase there, shares it with the sender over a separate secure channel, and keeps a secure backup. The sender enters the same passphrase, encrypts plain text, and downloads `encrypted-agreement.json`; the recipient loads that package and decrypts it on the same page. Only `.txt` and `.md` files up to 10 MiB are supported. The package contains format/algorithm parameters, a random salt and IV, and authenticated ciphertext. It does not contain the passphrase, key, filename, or plaintext.

Encryption uses the browser Web Crypto API with PBKDF2-HMAC-SHA-256 (310,000 iterations) to derive an AES-256-GCM key. For each package, 32 cryptographically random bytes are generated for the passphrase (256 bits of source entropy, represented as 43 unpadded base64url characters), plus a fresh 128-bit salt and 96-bit IV. The app checks a minimum of 32 Unicode characters but cannot establish entropy for a manually entered value; use the generated value. A different passphrase, modified ciphertext, salt, or IV fails decryption. This prototype has no public-key identity, secure key-distribution or recovery service, security audit, or legal review. Anyone who obtains both package and passphrase can decrypt it; a lost passphrase cannot be recovered. The package still reveals its format and ciphertext length.

Package metadata is not supplied as AES-GCM additional authenticated data. Instead, the reader accepts only the exact known format/version, PBKDF2-SHA-256 iteration count, AES-GCM algorithm/key size, and exact field sets; changed or extra metadata is rejected before decryption. The salt feeds key derivation and the IV is the GCM nonce, so changing either also prevents successful decryption. Tests verify rejection of metadata changes, but do not claim cryptographic AAD binding.

The agreement workflow has no blockchain, IPFS, or upload integration and does not send agreement text or passphrases to a service. The separate header offers optional wallet identity and explicit read-only provider authentication/version checks, never agreement export. Use a trusted, reviewed copy: a remote site operator able to replace the page or script could capture browser input. Local browser memory is not guaranteed to be securely erased. Do not put agreement text, secrets, or identifying hashes on-chain or in public storage.

### Legacy contract UI boundary

The existing wallet controls remain separate and the contract ABI was not changed. The current frontend's `signNDA()` signs the fixed string `"Sign this NDA agreement"` and submits that message hash and signature to `signAgreement`; it does not sign the user's document or bind it to a package. The owner-only `updateNDA()` action submits a supplied value to the contract, and `ndaHash()` reads the stored value. These transactions and values should be treated as public. The ABI/frontend inspected here does not establish consent, identity, confidentiality, or legal enforceability.

Status: the local round-trip is testable, but this is not production-ready for real agreements. Secure key exchange/recovery, independent security review, legal review, trusted hosting, and explicit consent/signing design remain approval gates.

### Test coverage

Run `npm test` (`node --test`); `test/agreement-crypto.test.js` uses synthetic text and Node's Web Crypto implementation. It covers:

- UTF-8 encrypt/decrypt round-trip.
- Package exclusion of plaintext, passphrase, raw key, and filename; expected format and KDF/cipher values.
- Fresh salt and IV across two encryptions.
- Rejection of wrong passphrase, changed ciphertext, salt, and IV.
- Rejection of changed format/version/KDF/cipher parameters and unexpected top-level or nested metadata fields. These metadata checks are strict parser rejection, not GCM AAD tests.
- Rejection of passphrases shorter than 32 Unicode characters.

The suite does not test adversarial browser extensions, compromised hosting, key exchange/recovery, recipient identity, contract signing, legal effect, or deployment behavior. A synthetic browser UI round-trip was separately exercised locally; it is not an independent security audit.

### Reuse decision

Need: a local-only encrypted agreement package with recipient-controlled key material and no upload or public-chain path. Donor search was limited to the curated `../DecentCanopy/data/agency-map.json` entry for `id: "nda"` (lines 1287–1327) and the existing NDA source at base `24dacafbc7814d01a512d6c9899d1f1dde22e985`; this is not a whole-library code search. The map lists only the NDA project's own `decentnda-browser-encryption` and `decentnda-w3up-upload` offers, and `needs` is empty. The pinned evidence is [the prior encryption source](https://github.com/TheJollyLaMa/Decent_NDA/blob/6e07ca5c5ec89fc37f500b03d03bff5d6a9c1099/js/encryption.js), [file conversion](https://github.com/TheJollyLaMa/Decent_NDA/blob/6e07ca5c5ec89fc37f500b03d03bff5d6a9c1099/js/fileHandler.js), and [w3up upload](https://github.com/TheJollyLaMa/Decent_NDA/blob/6e07ca5c5ec89fc37f500b03d03bff5d6a9c1099/js/w3up.js). These are same-repository legacy code, not an external donor. They were not reused: the encryption returned its key with ciphertext and the decryption path had hardcoded demo values; the upload path is outside the chosen local-only boundary. No compatible independent key-distribution/recovery donor was identified in this curated lead, so this implementation uses browser Web Crypto and explicit manual out-of-band passphrase delivery; that limitation remains an approval gate.

## Local DecentHeader integration

Entries: `index.html` and `private-agreement.html`. The native purple/gold header
provides click-only wallet identity, project-context About and explicit
Pinata/Kubo connection checks; no DBusk widget. **Legacy contract operations
remain unavailable:** its fixed address lacks independently verified deployment
chain configuration. A connected wallet is not NDA authorization.
The unavailable state is now visible in `#legacy-status` outside the replaced
toolbar. Sign/update buttons are disabled in markup and remain disabled through
wallet changes. Direct calls to legacy initialization/hash/sign/update functions
also stop at that gate without reading accounts, signing or transacting. The old
ABI is retained, not reused for the local package or asserted as a deployment.

Confidentiality is unchanged: no agreement plaintext upload/public backup,
replication, restore or rewards path is installed. `decent-head.js` forcibly
rejects shared `upload`, `restore` and `pin`; generic upload/pinning controls are
disabled. The private page's CSP permits only the exact Pinata
`/data/testAuthentication` and loopback Kubo `/api/v0/version` probe URLs, not
upload endpoints. Header credentials are tab-memory only and never include
agreement text or passphrases. The private page retains self-hosted scripts,
local encryption and separate key-recovery responsibilities.

Reuse/adapt: DecentHead `00691c4fe93fd280f5aec780bdc4fac651bfcdb1`
`js/main.js:DecentHead`, `js/wallet.js:WalletSession`, `Header.js`,
`Header/{WalletConnect,IPFSControls,IPFSStatus,AboutModal}.js` and the
`docs/ADOPTING.md` manifest, with LICENSE/NOTICE/artwork/ethers attribution and
`provenance.json` retained under `vendor/decent-head/2.0.0`. The isolated v6 UMD
wrapper avoids global-version collisions; nullable chain guards avoid a guessed
chain; CSS clips horizontal orbit paint. Read-only probe additions are explicitly
**uncommitted** shared `_wt/header-provider-connect` source based on that commit:
`IPFSSession.verifyConnection()` and `IPFSControls`' verify-provider handler.
Verified authentication/version means connectivity, never backup or retention.
Canopy leads/current receiving worktrees/open issues/PRs were read-only inspected;
the saved private-agreement implementation is preserved.

Validation: `npm test` preserves encryption tests and adds pinned-header/privacy/
provider checks. `node scripts/header-browser-smoke.mjs` with an existing
`PLAYWRIGHT_MODULE` covers both actual entries at 375px: wallet reject/connect/
account/chain/disconnect, explicit unconfigured/401/network/Pinata/Kubo probes
without uploads, forced NDA upload refusal, About Escape/focus and CSP gates.
Mocks use synthetic credentials only. Test helpers self-stop; no deployment,
funds, public backup or publication.

Bounded recovery validation (2026-11-08): `npm test` passed **21 tests** before
and after this slice, preserving all **8** PBKDF2/AES-GCM crypto tests unchanged.
The persisted `scripts/header-browser-smoke.mjs` self-starts a loopback server
and covers both entries: inert mount/no wallet RPC, reject/connect/account/
network/disconnect, unchanged global ethers-v5 sentinel, unconfigured provider,
HTTP401/network failure, explicit Pinata-ready/Kubo-ready responses, unavailable
backup/replication/rewards controls, and upload/restore/pin refusal even when
ready. About is opened by keyboard, checked for separate-passphrase-delivery and
hosting/legal/UCAN limits, checked at 375px, and closed with Escape/focus return.
The private page additionally exercises local `.md` input, generated recipient
passphrase, encryption, JSON package input, wrong-passphrase and tampered-package
refusal, UTF-8 roundtrip, package/plaintext download payloads captured only in
test memory, and clear-fields/download-disable behavior. Requests are audited
for plaintext, passphrase, package and input filename; none is sent. CSP remains
restricted to the two read-only probe URLs. Provider checks do not alter package
fields or enable agreement uploads.

Run from this receiver:
`PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/header-browser-smoke.mjs`.
The existing local Playwright installation is reused; no dependencies changed.
Browser launch failure also closes the helper server. Endpoint/wallet responses
are synthetic, the legacy Web3 CDN is blocked, and download payloads are
intercepted rather than written; this is not live provider, deployment, secure
hosting, legal or security-audit evidence.
The saved vendor wallet/probe/UI/status and isolated ethers wrapper are
byte-identical to accepted Escrow/Invoice adaptations of
Head `00691c4fe93fd280f5aec780bdc4fac651bfcdb1`; tests now verify the exact donor
UMD wrapper and uncommitted `js/ipfs.js`/`IPFSControls.js` hashes. The bounded
reuse scope was Canopy's NDA lead, saved NDA source/tests, its receiving worktree,
and the accepted header donor. No open NDA PR was found; the open Supporter
workflow issue is separate. The removed raw-upload/key-with-ciphertext helpers
remain removed and unreferenced by either page.

## License

Code: [Apache-2.0](LICENSE) · Art and docs: [CC BY 4.0](LICENSES/CC-BY-4.0.txt) · Please keep the [NOTICE](NOTICE) and give The Jolly LaMa / A Decent Agency a head nod when you reuse this work.
Support the work with a [Supporter DNFT](https://thejollylama.github.io/DecentMarket/).
