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

async function encryptNDA(ndaJson) {
    try {
        const key = await generateEncryptionKey();
        const encoder = new TextEncoder();
        const data = encoder.encode(ndaJson);
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Initialization Vector

        const encryptedData = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            data
        );

        // Convert binary buffer to base64 for easy handling
        const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedData)));
        const ivBase64 = btoa(String.fromCharCode(...iv));

        // Export key
        const exportedKey = await window.crypto.subtle.exportKey("raw", key);
        const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));

        return {
            encryptedData: encryptedBase64,
            iv: ivBase64,
            key: keyBase64
        };
    } catch (error) {
        console.error("❌ Error encrypting NDA:", error);
        return null;
    }
}

// Event listener for encrypting JSON
document.getElementById("encrypt-nda").addEventListener("click", async function () {
    const ndaJson = document.getElementById("nda-json").value;
    if (!ndaJson) {
        alert("No NDA data available.");
        return;
    }

    const encryptedResult = await encryptNDA(ndaJson);
    if (!encryptedResult) {
        alert("Encryption failed.");
        return;
    }

    // Display encrypted NDA
    document.getElementById("encrypted-nda").value = JSON.stringify(encryptedResult, null, 2);

    console.log("✅ NDA Encrypted Successfully:", encryptedResult);
});

async function exportEncryptionKey(key) {
    const exported = await window.crypto.subtle.exportKey("raw", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported))); // Base64 encode
}

/**
 * 🔓 Decrypt NDA JSON data
 */
/**
 * 🔓 Decrypt NDA JSON data & Display in Modal
 */
async function decryptNDA() {
    try {
        // Get user inputs for decryption
        const ivBase64 = "qg/WiNqqf4PhTBi/"; //document.getElementById("decrypt-iv").value.trim();
        const keyBase64 = "LLwcu8ZuuPXPCbBK97tnfAGoScg1U/RP4y74AdTwkKM="; //document.getElementById("decrypt-key").value.trim();
        const hash = "bafybeifuij34qakbi7efkmx4t4p4h2bzbkqqr6l6nuw5fdpel4xvfwgqte"; //document.getElementById("decrypt-hash").value.trim();

        if (!ivBase64 || !keyBase64 || !hash) {
            alert("❌ Please enter IV, Key, and Hash.");
            return;
        }

        console.log("🔄 Fetching encrypted NDA from IPFS...");

        // Fetch encrypted Base64 string from IPFS
        const ipfsUrl = `https://${hash}.ipfs.w3s.link/Decent_NDA_000001_Encrypted_JSON.txt`;
        const response = await fetch(ipfsUrl);

        if (!response.ok) {
            throw new Error("❌ Failed to fetch encrypted NDA from IPFS.");
        }

        const encryptedBase64 = await response.text();
        console.log("🔍 Encrypted NDA Base64:", encryptedBase64);

        // Convert Base64 IV and Key to Uint8Array
        const ivBuffer = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
        const keyBuffer = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));

        // Import key for decryption
        const keyImported = await window.crypto.subtle.importKey(
            "raw",
            keyBuffer,
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );

        // Convert encrypted Base64 text into Uint8Array
        const encryptedBuffer = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

        console.log("🔓 Attempting to decrypt NDA...");

        // Perform AES-GCM decryption
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivBuffer },
            keyImported,
            encryptedBuffer
        );

        const decryptedText = new TextDecoder().decode(decrypted);

        // ✅ Show NDA in Modal
        document.getElementById("nda-modal-content").textContent = decryptedText;
        document.getElementById("nda-modal").style.display = "flex";
        console.log("✅ NDA Decrypted Successfully:", decryptedText);
    } catch (error) {
        console.error("❌ Error decrypting NDA:", error);
        alert("❌ Decryption failed. Check IV, Key, and Encrypted Data.");
    }
}

// Attach event listener for the decrypt button
document.getElementById("decrypt-nda").addEventListener("click", decryptNDA);

// Close Modal when clicking "X"
document.querySelector(".close-modal").addEventListener("click", function () {
    document.getElementById("nda-modal").style.display = "none";
});

// Close Modal when clicking outside content
window.addEventListener("click", function (event) {
    const modal = document.getElementById("nda-modal");
    if (event.target === modal) {
        modal.style.display = "none";
    }
});


window.encryptNDA = encryptNDA;
window.decryptNDA = decryptNDA;