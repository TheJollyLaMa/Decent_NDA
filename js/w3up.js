async function initializeW3UP() {
    console.log("🚀 Initializing W3UP...");

    if (typeof window.w3up === "undefined") {
        console.error("❌ W3UP client not found! Retrying in 1 second...");
        setTimeout(initializeW3UP, 1000);
        return;
    }

    try {
        console.log("✅ W3UP client detected, creating instance...");
        const client = await window.w3up.create();
        console.log("✅ W3UP Client Created:", client);

        await client.login();
        console.log("✅ User logged into W3UP.");

        await client.provision();
        console.log("✅ Storage space provisioned.");

        async function uploadToW3UP(encryptedData) {
            if (!client) {
                console.error("❌ Error: W3UP Client is not initialized.");
                return;
            }

            console.log("🆙 Uploading NDA to W3UP...");
            const file = new Blob([JSON.stringify(encryptedData)], { type: "application/json" });

            const cid = await client.uploadFile(file);
            console.log("✅ Encrypted NDA CID:", cid);
            alert(`NDA uploaded! CID: ${cid}`);

            // Store CID on-chain
            const accounts = await web3.eth.getAccounts();
            await contract.methods.updateNDA(cid).send({ from: accounts[0] });
        }

        window.uploadToW3UP = uploadToW3UP;
        console.log("✅ W3UP initialized successfully.");
    } catch (error) {
        console.error("❌ Error initializing W3UP:", error);
    }
}

async function uploadToW3UP(ndaJson) {
    // 1️⃣ Generate Encryption Key
    const encryptionKey = await generateEncryptionKey();
    const encryptedData = await encryptNDA(ndaJson, encryptionKey);

    // 2️⃣ Convert Encrypted Data to JSON
    const encryptedNDA = JSON.stringify(encryptedData);
    const file = new Blob([encryptedNDA], { type: "application/json" });

    // 3️⃣ Upload to W3UP
    const client = await window.w3up.create();
    await client.login();
    await client.provision();

    const cid = await client.uploadFile(file);
    console.log("Encrypted NDA CID:", cid);
    alert(`NDA uploaded! CID: ${cid}`);

    // 4️⃣ Export Encryption Key for Signers
    const keyString = await exportEncryptionKey(encryptionKey);
    console.log("Encryption Key (Share with Signers):", keyString);

    // 5️⃣ Store CID on Smart Contract
    const accounts = await web3.eth.getAccounts();
    await contract.methods.updateNDA(cid).send({ from: accounts[0] });

    return { cid, keyString };
}

window.uploadToW3UP = uploadToW3UP;

window.onload = initializeW3UP;