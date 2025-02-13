async function initializeW3UP() {
    console.log("🚀 Attempting to initialize W3UP...");

    if (!window.w3up) {
        console.error("❌ W3UP library not found. Retrying in 1 second...");
        setTimeout(initializeW3UP, 1000);
        return;
    }

    try {
        console.log("✅ W3UP client detected. Checking available methods...");
        console.log("Available W3UP methods:", Object.keys(window.w3up));

        if (!window.w3up.Client) {
            console.error("❌ `Client` class not found in W3UP! Check documentation.");
            return;
        }

        console.log("🔄 Creating W3UP client...");
        window.w3upClient = new window.w3up.Client();
        console.log("✅ W3UP Client Created:", window.w3upClient);

        console.log("🔄 Checking if already logged in...");
        const isLoggedIn = await checkW3UPLogin();
        if (!isLoggedIn) {
            console.log("🔄 User NOT logged in. Requesting email for authentication...");
            
            const userEmail = prompt("Enter your email to authenticate with W3UP:");
            if (!userEmail || !userEmail.includes("@")) {
                console.error("❌ Invalid email format. Cannot log in.");
                return;
            }

            console.log(`📨 Sending login request to: ${userEmail}...`);
            
            try {
                const account = await window.w3upClient.login(userEmail);

                console.log("🔍 DEBUG: Login response:", account);

                if (!account) {
                    throw new Error("❌ W3UP login failed: No account object returned.");
                }

                console.log("✅ Login request sent! Check your inbox for the confirmation link.");
                console.log("⏳ Waiting for email confirmation...");
                
                await waitForEmailConfirmation(account);
                console.log("✅ Email confirmed! Proceeding with W3UP setup.");
                
            } catch (error) {
                console.error("❌ Error logging in with W3UP:", error);
            }
        } else {
            console.log("✅ Already logged into W3UP.");
        }

        console.log("✅ W3UP fully initialized!");

    } catch (error) {
        console.error("❌ Error initializing W3UP:", error);
    }
}
/**
 * ✅ Check if the user is already logged into W3UP before calling `login()`
 */
async function checkW3UPLogin() {
    try {
        const account = await window.w3upClient;
        console.log("🔍 DEBUG: Account object:", account);
        if (account) {
            console.log("✅ W3UP Account Found:", account);
            return true;
        }
    } catch (error) {
        console.warn("⚠️ No W3UP account found, login required.");
    }
    return false;
}

/**
 * ✅ Wait for email confirmation by checking for account access periodically
 */
async function waitForEmailConfirmation(account, maxAttempts = 30, delay = 30000) {
    console.log("⏳ Waiting for email confirmation...");

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const isLoggedIn = await checkW3UPLogin();
            if (isLoggedIn) {
                console.log("✅ Email confirmed! Proceeding with W3UP setup.");
                return;
            }
        } catch (error) {
            console.warn(`⚠️ Attempt ${attempt}: Waiting for confirmation...`);
        }

        await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
    }

    throw new Error("❌ Email confirmation timeout. Please try logging in again.");
}

async function uploadToW3UP(ndaJson) {
    console.log("🔄 Uploading NDA JSON to W3UP...");

    // Convert JSON to Blob
    const file = new Blob([ndaJson], { type: "application/json" });

    // Ensure W3UP Client is Initialized
    if (!window.w3upClient) {
        console.error("❌ W3UP Client is not initialized. Aborting upload.");
        return;
    }

    try {
        console.log("🔄 Checking W3UP client instance...");
        console.log("W3UP Client:", window.w3upClient);

        console.log("🔄 Getting current space...");
        const space = await window.w3upClient.currentSpace();
        if (!space) {
            console.error("❌ No active W3UP space. Ensure the user has a provisioned space.");
            return;
        }

        console.log("✅ Space found! Uploading file...");

        // Correct upload method
        const cid = await space.store.add(file);
        console.log("✅ NDA CID:", cid);

        return { cid };
    } catch (error) {
        console.error("❌ Error uploading NDA to W3UP:", error);
    }
}

window.uploadToW3UP = uploadToW3UP;

window.initializeW3UP = initializeW3UP;