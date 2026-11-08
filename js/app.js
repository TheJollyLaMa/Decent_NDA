async function loadABI() {
    const response = await fetch("abis/Decent_NDA_000001.json");
    return response.json();
}

let web3;
let contract;
let contractABI;
const contractAddress = "0xFfeA57921C2C4c4aaE900D3530D786cb95804686";
const chainIcons = {
    1: "Ethereum.png",
    137: "Polygon.png",
    10: "Optimism.png",
    56: "BinanceSmartChain.png"
};
function legacyUnavailable() {
    contract = null;
    web3 = null;
    const detail = 'Legacy contract unavailable: deployment chain is unverified. Wallet identity does not authorize an NDA.';
    document.getElementById('legacy-status').textContent = detail;
    document.getElementById('get-nda-hash-response').textContent = detail;
    document.getElementById('nda-panel').classList.add('hidden');
    document.getElementById('contract-address').style.display = 'none';
    for (const id of ['sign-nda', 'update-nda']) document.getElementById(id).disabled = true;
    return detail;
}
// Check Authorization
async function checkAuthorization(wallet) {
    try {
        const owner = await contract.methods.owner().call();
        const isSigner = await contract.methods.signatories(wallet).call();

        const ndaHashContainer = document.getElementById("get-nda-hash-response");
        const ndaPanel = document.getElementById("nda-panel");

        if (wallet.toLowerCase() === owner.toLowerCase() || isSigner) {
            console.log("✅ User is authorized");
            // Show NDA and Contract Address
            document.getElementById("contract-address").style.display = "block";
            ndaPanel.classList.remove("hidden");

            // Fetch NDA Hash
            getNDAHash();
        } else {
            console.warn("🚫 User is NOT authorized. Hiding NDA.");
            
            // Hide NDA Hash & NDA Panel
            ndaHashContainer.textContent = "NDA Hash: ❌ Not Authorized";
            ndaPanel.classList.add("hidden");

            document.getElementById("contract-address").style.display = "none";

            
        }

        return wallet.toLowerCase() === owner.toLowerCase() || isSigner;
    } catch (error) {
        console.error("❌ Error checking authorization:", error);
        return false;
    }
}

// Update Contract Address Display with Icons
function updateContractDisplay(contractAddress) {
    const start = contractAddress.substring(0, 6);
    const end = contractAddress.substring(contractAddress.length - 4);
    const polygonScanLink = `https://polygonscan.com/address/${contractAddress}`;

    document.getElementById("contract-address-text").innerHTML = `
        <a href="${polygonScanLink}" target="_blank">
            ${start} 
            <img src="./assets/SecretPyramid.png" class="icon">
            <img src="./assets/Eth.gif" class="icon">
            <img src="./assets/Polygon.png" class="icon">
            <img src="./assets/Eth.gif" class="icon">
            <img src="./assets/SecretPyramid.png" class="icon">
            ${end}
        </a>
    `;
}
// Initialize Web3 and Smart Contract
async function initWeb3() {
    legacyUnavailable();
    return;
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });

        const accounts = await web3.eth.getAccounts();
        const chainId = await web3.eth.getChainId();
        updateWalletDisplay(accounts[0], chainId);

        contractABI = await loadABI();
        if (!contractABI) {
            console.error("❌ Error: Failed to load ABI.");
            return;
        }

        window.addEventListener('decenthead:wallet', () => {
            contract = null;
            document.getElementById('nda-panel').classList.add('hidden');
            document.getElementById('contract-address').style.display = 'none';
            document.getElementById('get-nda-hash-response').textContent =
                'Legacy contract unavailable: wallet identity is not NDA authorization; deployment chain is unverified.';
        });

        contract = new web3.eth.Contract(contractABI, contractAddress);
        if (!contract) {
            console.error("❌ Error: Contract instance not initialized.");
            return;
        }

        // Show Contract Address & Check Authorization
        document.getElementById("contract-address-text").textContent = contractAddress;

        await checkAuthorization(accounts[0]);
        updateContractDisplay(contractAddress);
        document.getElementById("connect-wallet").classList.add("wallet-connected");
        document.getElementById("connect-wallet").classList.remove("wallet-disconnected");



        // ✅ Handle Wallet Changes
        window.ethereum.on("accountsChanged", async (newAccounts) => {
            console.log("🔄 Wallet switched to:", newAccounts[0]);

            // Update UI
            updateWalletDisplay(newAccounts[0], chainId);

            // Re-check authorization
            const isAuthorized = await checkAuthorization(newAccounts[0]);
            if (!isAuthorized) {
                console.log("🚫 Hiding NDA because new wallet is not authorized.");
                document.getElementById("nda-panel").classList.add("hidden");
                document.getElementById("get-nda-hash-response").textContent = "NDA Hash: ❌ Not Authorized";
            } else {
                getNDAHash();
            }
        });
    } else {
        alert("Please install MetaMask.");
    }
}

// Update Wallet Display
function updateWalletDisplay(wallet, chainId) {
    const start = wallet.substring(0, 6);
    const end = wallet.substring(wallet.length - 4);
    const chainIcon = chainIcons[chainId] || "UnknownChain.png";

    document.getElementById("wallet-display").innerHTML = `
        ${start} 
        <img src="./assets/SecretPyramid.png" class="icon">
        <img src="./assets/Eth.gif" class="icon">
        <img src="./assets/${chainIcon}" class="icon">
        <img src="./assets/Eth.gif" class="icon">
        <img src="./assets/SecretPyramid.png" class="icon">
        ${end}
    `;
}

// Get NDA Hash
async function getNDAHash() {
    legacyUnavailable();
    return;
    try {
        const hash = await contract.methods.ndaHash().call();
        document.getElementById("get-nda-hash-response").textContent = `NDA Hash: ${hash}`;
        document.getElementById("hash-info").classList.remove("hidden");
    } catch (error) {
        console.error("Error retrieving NDA Hash:", error);
    }
}



// Sign NDA
async function signNDA() {
    document.getElementById('sign-nda-response').textContent = legacyUnavailable();
    return;
    try {
        const accounts = await web3.eth.getAccounts();
        const messageHash = web3.utils.sha3("Sign this NDA agreement");
        const signature = await web3.eth.personal.sign(messageHash, accounts[0]);

        const sigParams = web3.eth.accounts.decodeSignature(signature);
        await contract.methods.signAgreement(messageHash, sigParams.v, sigParams.r, sigParams.s).send({ from: accounts[0] });

        alert("NDA Signed!");
    } catch (error) {
        console.error("Error signing NDA:", error);
    }
}

// ✅ Update NDA Hash (Owner Only)
async function updateNDAHash() {
    document.getElementById('update-nda-hash-response').textContent = legacyUnavailable();
    return;
    try {
        if (!contract) {
            console.error("❌ Contract instance not found.");
            return;
        }

        const accounts = await web3.eth.getAccounts();
        if (!accounts.length) {
            alert("❌ No accounts detected. Please connect your wallet.");
            return;
        }

        const owner = await contract.methods.owner().call();
        console.log("👤 Contract Owner:", owner);
        console.log("🔑 Sender Address:", accounts[0]);

        if (accounts[0].toLowerCase() !== owner.toLowerCase()) {
            alert("❌ Only the contract owner can update the NDA hash.");
            return;
        }

        const newHash = document.getElementById("new-nda-hash").value.trim();
        if (!newHash) {
            alert("❌ Please enter a valid NDA hash.");
            return;
        }

        console.log("🔄 Fetching current gas price...");
        const gasPrice = await web3.eth.getGasPrice();
        console.log(`⛽ Current Gas Price: ${web3.utils.fromWei(gasPrice, 'gwei')} Gwei`);

        console.log("🔄 Sending transaction to update NDA Hash...");
        const receipt = await contract.methods.updateNDA(newHash).send({
            from: accounts[0],
            gas: 500000, // Adjust if necessary
            gasPrice: gasPrice * 2
        });

        console.log("✅ NDA Hash Successfully Updated! Transaction Receipt:", receipt);
        document.getElementById("update-nda-hash-response").textContent = `✅ NDA Hash Updated: ${newHash}`;

        // Refresh NDA Hash Display
        getNDAHash();
    } catch (error) {
        console.error("❌ Error updating NDA Hash:", error);
        document.getElementById("update-nda-hash-response").textContent = "❌ Error updating NDA Hash.";
    }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", function () {
    legacyUnavailable();
    window.addEventListener('decenthead:wallet', legacyUnavailable);
    console.log("✅ DOM fully loaded. Initializing app...");

    // Check if elements exist before attaching event listeners
    const connectWalletButton = document.getElementById("connect-wallet");
    const signNDAButton = document.getElementById("sign-nda");
    const updateNDAButton = document.getElementById("update-nda");

    if (connectWalletButton) {
        connectWalletButton.addEventListener("click", initWeb3);
    } else {
        console.warn("⚠️ connect-wallet button not found.");
    }

    if (signNDAButton) {
        signNDAButton.addEventListener("click", signNDA);
    } else {
        console.warn("⚠️ sign-nda button not found.");
    }

    if (updateNDAButton) {
        updateNDAButton.addEventListener("click", updateNDAHash);
    } else {
        console.warn("⚠️ update-nda button not found.");
    }
});