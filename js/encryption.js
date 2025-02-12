async function generateEncryptionKey() {
    const key = await window.crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );

    return key;
}

async function encryptNDA(ndaJson, key) {
    const encoder = new TextEncoder();
    const data = encoder.encode(ndaJson);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Initialization vector

    const encryptedData = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        data
    );

    return {
        encrypted: Array.from(new Uint8Array(encryptedData)), // Convert to array
        iv: Array.from(iv), // Store IV for decryption
    };
}

async function exportEncryptionKey(key) {
    const exported = await window.crypto.subtle.exportKey("raw", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported))); // Base64 encode
}

async function decryptNDA(encryptedData, iv, secretKey) {
    const key = await window.crypto.subtle.importKey(
        "raw",
        Uint8Array.from(atob(secretKey), c => c.charCodeAt(0)),
        { name: "AES-CBC", length: 256 },
        false,
        ["decrypt"]
    );

    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-CBC", iv: Uint8Array.from(atob(iv), c => c.charCodeAt(0)) },
        key,
        Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
    );

    return new TextDecoder().decode(decrypted);
}

window.encryptNDA = encryptNDA;
window.decryptNDA = decryptNDA;