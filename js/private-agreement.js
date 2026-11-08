import { decryptAgreement, encryptAgreement } from "./agreement-crypto.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const byId = id => document.getElementById(id);
const status = byId("status");

function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
}

function downloadText(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function clearFields() {
    for (const id of [
        "agreement-file",
        "agreement-text",
        "recipient-passphrase",
        "encrypt-passphrase",
        "encrypted-package",
        "package-file",
        "package-text",
        "decrypt-passphrase",
        "decrypted-agreement"
    ]) {
        byId(id).value = "";
    }
    byId("download-package").disabled = true;
    byId("download-plaintext").disabled = true;
}

byId("agreement-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES || !/\.(txt|md)$/i.test(file.name)) {
        event.target.value = "";
        setStatus("Choose a .txt or .md file no larger than 10 MiB.", true);
        return;
    }

    try {
        byId("agreement-text").value = await file.text();
        setStatus("Plain text loaded locally. The filename is not included in the encrypted package.");
    } catch {
        setStatus("Could not read that local text file.", true);
    }
});

byId("generate-passphrase").addEventListener("click", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const phrase = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    byId("recipient-passphrase").value = phrase;
    setStatus("Generated in this browser. The recipient must share it through a separate secure channel.");
});

byId("encrypt-agreement").addEventListener("click", async () => {
    byId("encrypted-package").value = "";
    byId("download-package").disabled = true;
    try {
        byId("encrypted-package").value = await encryptAgreement(
            byId("agreement-text").value,
            byId("encrypt-passphrase").value
        );
        byId("download-package").disabled = false;
        setStatus("Encrypted locally. Download the package and deliver it separately from the passphrase.");
    } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not encrypt this agreement.", true);
    }
});

byId("download-package").addEventListener("click", () => {
    const packageText = byId("encrypted-package").value;
    if (packageText) downloadText("encrypted-agreement.json", packageText, "application/json");
});

byId("package-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES * 1.5 || !/\.json$/i.test(file.name)) {
        event.target.value = "";
        setStatus("Choose a JSON package no larger than 15 MiB.", true);
        return;
    }
    try {
        byId("package-text").value = await file.text();
        setStatus("Encrypted package loaded locally.");
    } catch {
        setStatus("Could not read that local package.", true);
    }
});

byId("decrypt-agreement").addEventListener("click", async () => {
    byId("decrypted-agreement").value = "";
    byId("download-plaintext").disabled = true;
    try {
        byId("decrypted-agreement").value = await decryptAgreement(
            byId("package-text").value,
            byId("decrypt-passphrase").value
        );
        byId("download-plaintext").disabled = false;
        setStatus("Decrypted locally. Handle the plaintext as sensitive and do not upload it.");
    } catch {
        setStatus("Unable to decrypt: the passphrase may be wrong or the package may be damaged or unsupported.", true);
    }
});

byId("download-plaintext").addEventListener("click", () => {
    const plaintext = byId("decrypted-agreement").value;
    if (plaintext) downloadText("decrypted-agreement.txt", plaintext, "text/plain;charset=utf-8");
});

byId("clear-session").addEventListener("click", () => {
    clearFields();
    setStatus("Page fields cleared. Browser memory may still retain data.");
});

if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    for (const id of ["generate-passphrase", "encrypt-agreement", "decrypt-agreement"]) {
        byId(id).disabled = true;
    }
    setStatus("Web Crypto is unavailable. Use a current browser in a secure context (for local testing, use localhost).", true);
}
