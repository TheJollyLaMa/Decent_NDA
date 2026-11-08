const FORMAT = "decent-nda-encrypted-agreement";
const VERSION = 1;
const ITERATIONS = 310_000;
const MAX_PLAINTEXT_BYTES = 10 * 1024 * 1024;
const MIN_PASSPHRASE_LENGTH = 32;
const encoder = new TextEncoder();

function bytesToBase64(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}

function base64ToBytes(value) {
    if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
        throw new Error("Invalid encrypted agreement package.");
    }

    const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
    if (bytesToBase64(bytes) !== value) {
        throw new Error("Invalid encrypted agreement package.");
    }
    return bytes;
}

function validatePassphrase(passphrase) {
    if (typeof passphrase !== "string" || [...passphrase].length < MIN_PASSPHRASE_LENGTH) {
        throw new Error(`Use the generated random passphrase (at least ${MIN_PASSPHRASE_LENGTH} characters).`);
    }
}

function exactKeys(value, expected) {
    return value !== null
        && typeof value === "object"
        && !Array.isArray(value)
        && Object.keys(value).length === expected.length
        && expected.every(key => Object.hasOwn(value, key));
}

function parsePackage(packageText) {
    let data;
    try {
        data = JSON.parse(packageText);
    } catch {
        throw new Error("Invalid encrypted agreement package.");
    }

    if (!exactKeys(data, ["format", "version", "kdf", "cipher", "salt", "iv", "ciphertext"])
        || data.format !== FORMAT
        || data.version !== VERSION
        || !exactKeys(data.kdf, ["name", "hash", "iterations"])
        || data.kdf.name !== "PBKDF2"
        || data.kdf.hash !== "SHA-256"
        || data.kdf.iterations !== ITERATIONS
        || !exactKeys(data.cipher, ["name", "length"])
        || data.cipher.name !== "AES-GCM"
        || data.cipher.length !== 256) {
        throw new Error("Unsupported or invalid encrypted agreement package.");
    }

    const salt = base64ToBytes(data.salt);
    const iv = base64ToBytes(data.iv);
    const ciphertext = base64ToBytes(data.ciphertext);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16 || ciphertext.length > MAX_PLAINTEXT_BYTES + 16) {
        throw new Error("Invalid encrypted agreement package.");
    }
    return { salt, iv, ciphertext };
}

async function deriveKey(passphrase, salt, usage, cryptoApi) {
    const material = await cryptoApi.subtle.importKey(
        "raw",
        encoder.encode(passphrase),
        "PBKDF2",
        false,
        ["deriveKey"]
    );
    return cryptoApi.subtle.deriveKey(
        { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        [usage]
    );
}

export async function encryptAgreement(plaintext, passphrase, cryptoApi = globalThis.crypto) {
    validatePassphrase(passphrase);
    if (typeof plaintext !== "string") {
        throw new Error("Agreement text must be plain text.");
    }

    const plaintextBytes = encoder.encode(plaintext);
    if (plaintextBytes.length === 0 || plaintextBytes.length > MAX_PLAINTEXT_BYTES) {
        throw new Error("Agreement text must be non-empty and no larger than 10 MiB.");
    }

    const salt = cryptoApi.getRandomValues(new Uint8Array(16));
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt, "encrypt", cryptoApi);
    const ciphertext = new Uint8Array(await cryptoApi.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintextBytes));

    return JSON.stringify({
        format: FORMAT,
        version: VERSION,
        kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS },
        cipher: { name: "AES-GCM", length: 256 },
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(ciphertext)
    }, null, 2);
}

export async function decryptAgreement(packageText, passphrase, cryptoApi = globalThis.crypto) {
    validatePassphrase(passphrase);
    if (typeof packageText !== "string" || packageText.length > (MAX_PLAINTEXT_BYTES * 1.5)) {
        throw new Error("Invalid encrypted agreement package.");
    }

    const { salt, iv, ciphertext } = parsePackage(packageText);
    const key = await deriveKey(passphrase, salt, "decrypt", cryptoApi);
    const plaintext = await cryptoApi.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
}

export const agreementCryptoParameters = Object.freeze({
    format: FORMAT,
    version: VERSION,
    kdf: "PBKDF2-HMAC-SHA-256",
    iterations: ITERATIONS,
    cipher: "AES-256-GCM",
    minPassphraseLength: MIN_PASSPHRASE_LENGTH,
    maxPlaintextBytes: MAX_PLAINTEXT_BYTES
});
