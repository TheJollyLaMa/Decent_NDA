document.getElementById("convert-to-json").addEventListener("click", async function () {
    const fileInput = document.getElementById("file-input").files[0];

    if (!fileInput) {
        alert("Please select a file.");
        return;
    }

    const reader = new FileReader();

    reader.onload = async function (event) {
        const fileContent = event.target.result;

        const ndaJSON = {
            nda_content: fileContent,
            filename: fileInput.name,
            created_at: new Date().toISOString(),
        };

        document.getElementById("nda-json").value = JSON.stringify(ndaJSON, null, 2);
    };

    reader.readAsText(fileInput);
});