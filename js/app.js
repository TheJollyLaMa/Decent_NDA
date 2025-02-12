async function loadABI() {
    const response = await fetch("/abis/Decent_NDA_000001.json");
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
// Check Authorization
async function checkAuthorization(wallet) {
    try {
        const owner = await contract.methods.owner().call();
        const isSigner = await contract.methods.signatories(wallet).call();

        if (wallet.toLowerCase() === owner.toLowerCase() || isSigner) {
            console.log("User is authorized");

            // Show Contract Address & NDA Hash
            const contractAddressElem = document.getElementById("contract-address");
            if (contractAddressElem) {
                contractAddressElem.style.display = "flex";
            } else {
                console.warn("⚠️ Warning: contract-address element not found.");
            }

            updateContractDisplay(contractAddress);

            // Show NDA Panel
            const ndaPanel = document.getElementById("nda-panel");
            if (ndaPanel) {
                ndaPanel.classList.remove("hidden");
            } else {
                console.warn("⚠️ Warning: nda-panel element not found.");
            }

            // Fetch NDA Data
            getNDAHash();

            const ndaHashContainer = document.getElementById("nda-hash-container");
            if (ndaHashContainer) {
                ndaHashContainer.style.display = "block";
            }
        } else {
            console.warn("User is NOT authorized.");
        }
    } catch (error) {
        console.error("Error checking authorization:", error);
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

        contract = new web3.eth.Contract(contractABI, contractAddress);
        if (!contract) {
            console.error("❌ Error: Contract instance not initialized.");
            return;
        }

        // Show Contract Address & Check Authorization
        document.getElementById("contract-address-text").textContent = contractAddress;
        await checkAuthorization(accounts[0]);

        document.getElementById("connect-wallet").classList.add("wallet-connected");
        document.getElementById("connect-wallet").classList.remove("wallet-disconnected");

        // Now we can safely fetch the NDA hash
        getNDAHash();
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
    try {
        const hash = await contract.methods.ndaHash().call();
        document.getElementById("get-nda-hash-response").textContent = `NDA Hash: ${hash}`;
    } catch (error) {
        console.error("Error retrieving NDA Hash:", error);
    }
}



// Sign NDA
async function signNDA() {
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

// Upload NDA
async function uploadNDA() {
    const ndaJsonElem = document.getElementById("nda-json");
    if (!ndaJsonElem) {
        console.error("❌ Error: nda-json element not found.");
        return;
    }

    const ndaJson = ndaJsonElem.value;
    if (!ndaJson) {
        alert("No NDA data available.");
        return;
    }

    const { cid, keyString } = await uploadToW3UP(ndaJson);

    const responseElem = document.getElementById("upload-nda-response");
    if (responseElem) {
        responseElem.textContent = `NDA Uploaded! CID: ${cid}. Share this Key with Signers: ${keyString}`;
    } else {
        console.warn("⚠️ Warning: upload-nda-response element not found.");
    }
}

// Event Listeners
window.onload = function () {
    document.getElementById("connect-wallet").addEventListener("click", initWeb3);
    document.getElementById("sign-nda").addEventListener("click", signNDA);
    document.getElementById("upload-nda").addEventListener("click", uploadNDA);

    // Convert NDA File to JSON
    document.getElementById("convert-to-json").addEventListener("click", function () {
        const fileInput = document.getElementById("file-input");
        if (!fileInput.files.length) {
            alert("Please select a file first.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            const fileContent = event.target.result;
            const jsonContent = JSON.stringify({ nda: fileContent }, null, 2);
            document.getElementById("nda-json").value = jsonContent;
        };
        reader.readAsText(fileInput.files[0]);
    });

    

    document.getElementById("upload-nda").addEventListener("click", async function () {
        const ndaJson = document.getElementById("nda-json").value;
        if (!ndaJson) {
            alert("No NDA data available.");
            return;
        }
    
        const { cid, keyString } = await uploadToW3UP(ndaJson);
        
        // Show the Encryption Key
        document.getElementById("upload-nda-response").textContent = `NDA Uploaded! CID: ${cid}. 
            Share this Key with Signers: ${keyString}`;
    });
};