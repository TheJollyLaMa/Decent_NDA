import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { decryptAgreement, encryptAgreement } from "../js/agreement-crypto.js";

const passphrase = "test-only-random-style-passphrase-9F2A";

test("encrypts and decrypts UTF-8 agreement text", async () => {
    const agreement = "Synthetic agreement only — café, naïve, and 雪.";
    const packageText = await encryptAgreement(agreement, passphrase, webcrypto);

    assert.equal(await decryptAgreement(packageText, passphrase, webcrypto), agreement);
});

test("stores no passphrase, key, filename, or plaintext in the package", async () => {
    const agreement = "synthetic-secret-body";
    const packageText = await encryptAgreement(agreement, passphrase, webcrypto);
    const data = JSON.parse(packageText);

    assert.equal(data.format, "decent-nda-encrypted-agreement");
    assert.equal(data.kdf.iterations, 310_000);
    assert.equal(data.cipher.name, "AES-GCM");
    assert.equal("key" in data, false);
    assert.equal("passphrase" in data, false);
    assert.equal("filename" in data, false);
    assert.equal(packageText.includes(agreement), false);
    assert.equal(packageText.includes(passphrase), false);
});

test("generates a distinct salt and IV for each package", async () => {
    const first = JSON.parse(await encryptAgreement("synthetic agreement", passphrase, webcrypto));
    const second = JSON.parse(await encryptAgreement("synthetic agreement", passphrase, webcrypto));

    assert.notEqual(first.salt, second.salt);
    assert.notEqual(first.iv, second.iv);
});

test("rejects a wrong passphrase", async () => {
    const packageText = await encryptAgreement("synthetic agreement", passphrase, webcrypto);
    await assert.rejects(decryptAgreement(packageText, "wrong passphrase value 1234567890", webcrypto));
});

test("rejects modified ciphertext", async () => {
    const data = JSON.parse(await encryptAgreement("synthetic agreement", passphrase, webcrypto));
    const ciphertext = Buffer.from(data.ciphertext, "base64");
    ciphertext[0] ^= 1;
    data.ciphertext = ciphertext.toString("base64");

    await assert.rejects(decryptAgreement(JSON.stringify(data), passphrase, webcrypto));
});

test("rejects modified salt and IV", async () => {
    const original = JSON.parse(await encryptAgreement("synthetic agreement", passphrase, webcrypto));
    const changedSalt = structuredClone(original);
    const salt = Buffer.from(changedSalt.salt, "base64");
    salt[0] ^= 1;
    changedSalt.salt = salt.toString("base64");
    await assert.rejects(decryptAgreement(JSON.stringify(changedSalt), passphrase, webcrypto));

    const changedIv = structuredClone(original);
    const iv = Buffer.from(changedIv.iv, "base64");
    iv[0] ^= 1;
    changedIv.iv = iv.toString("base64");
    await assert.rejects(decryptAgreement(JSON.stringify(changedIv), passphrase, webcrypto));
});

test("rejects changed or unexpected package metadata", async () => {
    const original = JSON.parse(await encryptAgreement("synthetic agreement", passphrase, webcrypto));
    const mutations = [
        data => { data.format = "other-format"; },
        data => { data.version += 1; },
        data => { data.kdf.name = "other-kdf"; },
        data => { data.kdf.hash = "SHA-512"; },
        data => { data.kdf.iterations += 1; },
        data => { data.cipher.name = "other-cipher"; },
        data => { data.cipher.length = 128; },
        data => { data.extra = "unexpected"; },
        data => { data.kdf.extra = "unexpected"; },
        data => { data.cipher.extra = "unexpected"; }
    ];

    for (const mutate of mutations) {
        const data = structuredClone(original);
        mutate(data);
        await assert.rejects(
            decryptAgreement(JSON.stringify(data), passphrase, webcrypto),
            /Unsupported or invalid/
        );
    }
});

test("rejects weak passphrases", async () => {
    await assert.rejects(
        encryptAgreement("synthetic agreement", "short", webcrypto),
        /at least 32 characters/
    );
});
