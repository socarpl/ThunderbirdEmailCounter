const accountSelect = document.getElementById("account-select");
const includeSent = document.getElementById("include-sent");
const scanButton = document.getElementById("scan-button");
const statusBox = document.getElementById("status");

let currentRequestId = null;

browser.runtime.onMessage.addListener((message) => {
  if (message?.type !== "scanProgress" || message.requestId !== currentRequestId) {
    return;
  }

  const payload = message.payload || {};
  if (payload.phase === "folder") {
    setStatus(
      `Scanning folder ${payload.current} of ${payload.total}: ${payload.folderName}. ` +
      `Messages processed so far: ${payload.scannedMessages}.`
    );
  } else if (payload.phase === "complete") {
    setStatus(
      `Finished. Scanned ${payload.scannedMessages} messages across ` +
      `${payload.uniqueSenders} sender addresses. Thunderbird opened a save dialog for ${payload.fileName}.`
    );
  }
});

scanButton.addEventListener("click", async () => {
  const accountId = accountSelect.value;
  if (!accountId) {
    setStatus("Select an account before starting the scan.", true);
    return;
  }

  currentRequestId = `scan-${Date.now()}`;
  setBusy(true);
  setStatus("Preparing scan...");

  try {
    const result = await browser.runtime.sendMessage({
      type: "scanAccount",
      accountId,
      options: {
        includeSent: includeSent.checked,
        requestId: currentRequestId
      }
    });

    setStatus(
      `Saved report request created. Scanned ${result.scannedMessages} messages and found ` +
      `${result.uniqueSenders} unique sender addresses.`
    );
  } catch (error) {
    setStatus(error?.message || "The scan failed.", true);
  } finally {
    setBusy(false);
  }
});

async function loadAccounts() {
  setStatus("Loading Thunderbird accounts...");
  try {
    const accounts = await browser.runtime.sendMessage({ type: "listAccounts" });
    accountSelect.textContent = "";

    if (!accounts.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No accounts found";
      accountSelect.append(option);
      scanButton.disabled = true;
      setStatus("No Thunderbird mail accounts are available.");
      return;
    }

    for (const account of accounts) {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = account.email
        ? `${account.name} (${account.email})`
        : account.name;
      accountSelect.append(option);
    }

    setStatus("Choose an account and start the scan.");
  } catch (error) {
    setStatus(error?.message || "Unable to load accounts.", true);
    scanButton.disabled = true;
  }
}

function setBusy(isBusy) {
  scanButton.disabled = isBusy;
  accountSelect.disabled = isBusy;
  includeSent.disabled = isBusy;
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

loadAccounts();
