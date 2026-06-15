const SENT_LIKE_FOLDER_TYPES = new Set(["sent", "drafts", "templates", "outbox"]);

browser.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) {
    return null;
  }

  if (message.type === "listAccounts") {
    return listAccounts();
  }

  if (message.type === "scanAccount") {
    return scanAccount(message.accountId, message.options || {});
  }

  return null;
});

async function listAccounts() {
  const accounts = await browser.accounts.list();
  return accounts.map((account) => {
    const identities = account.identities || [];
    const primaryIdentity = identities[0] || {};
    return {
      id: account.id,
      name: account.name || primaryIdentity.email || `Account ${account.id}`,
      email: primaryIdentity.email || "",
      type: account.type || ""
    };
  });
}

async function scanAccount(accountId, options) {
  const includeSent = Boolean(options.includeSent);
  const requestId = options.requestId || `scan-${Date.now()}`;
  const accounts = await browser.accounts.list();
  const account = accounts.find((item) => item.id === accountId);

  if (!account) {
    throw new Error("Selected account was not found.");
  }

  const folders = flattenFolders(account.folders || []).filter((folder) =>
    shouldScanFolder(folder, includeSent)
  );

  if (!folders.length) {
    throw new Error("No folders were available to scan for this account.");
  }

  const counts = new Map();
  const seenMessageKeys = new Set();
  let scannedMessages = 0;
  let folderIndex = 0;

  for (const folder of folders) {
    folderIndex += 1;
    sendProgress(requestId, {
      phase: "folder",
      current: folderIndex,
      total: folders.length,
      folderName: folder.name || folder.path || "Unknown folder",
      scannedMessages
    });

    let page = await browser.messages.list(folder);
    while (page) {
      for (const message of page.messages || []) {
        const uniqueKey = buildMessageKey(message, folder, account);
        if (seenMessageKeys.has(uniqueKey)) {
          continue;
        }

        seenMessageKeys.add(uniqueKey);
        scannedMessages += 1;

        const sender = normalizeAddress(message.author || "");
        if (sender) {
          counts.set(sender, (counts.get(sender) || 0) + 1);
        }
      }

      if (!page.id) {
        break;
      }

      page = await browser.messages.continueList(page.id);
    }
  }

  const rows = Array.from(counts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });

  const fileName = buildFileName(account);
  const html = renderReport({
    account,
    includeSent,
    rows,
    scannedMessages
  });
  const blob = new Blob([html], { type: "text/html" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    await browser.downloads.download({
      url: objectUrl,
      filename: fileName,
      saveAs: true,
      conflictAction: "uniquify"
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }

  const result = {
    requestId,
    scannedMessages,
    uniqueSenders: rows.length,
    fileName
  };

  sendProgress(requestId, { phase: "complete", ...result });
  return result;
}

function flattenFolders(folders, bucket = []) {
  for (const folder of folders) {
    bucket.push(folder);
    const children = folder.subFolders || folder.folders || [];
    flattenFolders(children, bucket);
  }
  return bucket;
}

function shouldScanFolder(folder, includeSent) {
  if (!folder) {
    return false;
  }

  if (folder.type === "virtual") {
    return false;
  }

  if (!includeSent && SENT_LIKE_FOLDER_TYPES.has(folder.type)) {
    return false;
  }

  return true;
}

function buildMessageKey(message, folder, account) {
  if (message.headerMessageId) {
    return `${account.id}:${message.headerMessageId.toLowerCase()}`;
  }
  return `${account.id}:${folder.path || folder.name}:${message.id}`;
}

function normalizeAddress(value) {
  const match = value.match(/<([^>]+)>/);
  const raw = match ? match[1] : value;
  const normalized = raw.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return "";
  }
  return normalized;
}

function buildFileName(account) {
  const base = sanitizeFilePart(account.name || account.id || "account");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `mailbox-sender-report/${base}-${timestamp}.html`;
}

function sanitizeFilePart(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "account";
}

function sendProgress(requestId, payload) {
  browser.runtime.sendMessage({
    type: "scanProgress",
    requestId,
    payload
  }).catch(() => {});
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderReport({ account, includeSent, rows, scannedMessages }) {
  const accountLabel = account.name || account.id;
  const emailLabel = account.identities?.[0]?.email || "";
  const generatedAt = new Date().toLocaleString();
  const tableRows = rows.length
    ? rows.map(([address, count], index) => {
        const share = scannedMessages ? ((count / scannedMessages) * 100).toFixed(2) : "0.00";
        return [
          "<tr>",
          `<td>${index + 1}</td>`,
          `<td>${escapeHtml(address)}</td>`,
          `<td>${count}</td>`,
          `<td>${share}%</td>`,
          "</tr>"
        ].join("");
      }).join("")
    : '<tr><td colspan="4">No sender addresses were found.</td></tr>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mailbox Sender Report</title>
  <style>
    :root {
      --bg: #f4efe4;
      --panel: #fffdf8;
      --ink: #22313f;
      --muted: #677481;
      --accent: #0f6a57;
      --line: #d9ceb7;
      --shadow: 0 18px 48px rgba(34, 49, 63, 0.14);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(15, 106, 87, 0.16), transparent 28%),
        linear-gradient(135deg, #f8f1df 0%, #eee5d1 55%, #e5dbc8 100%);
    }
    main {
      width: min(1100px, calc(100% - 32px));
      margin: 36px auto;
      background: linear-gradient(180deg, rgba(255, 253, 248, 0.98), rgba(255, 249, 240, 0.98));
      border: 1px solid var(--line);
      border-radius: 24px;
      box-shadow: var(--shadow);
      padding: 32px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1.05;
    }
    .lede, .note {
      color: var(--muted);
      line-height: 1.6;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 14px;
      margin: 24px 0 28px;
    }
    .stat {
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.74);
    }
    .stat span {
      display: block;
      color: var(--muted);
      font-size: 0.92rem;
      margin-bottom: 8px;
    }
    .stat strong {
      font-size: 1.1rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 16px;
    }
    thead th {
      background: #e3f0eb;
      text-align: left;
    }
    th, td {
      padding: 13px 15px;
      border-bottom: 1px solid var(--line);
    }
    tbody tr:nth-child(even) {
      background: rgba(227, 240, 235, 0.4);
    }
    @media (max-width: 640px) {
      main {
        width: calc(100% - 18px);
        margin: 18px auto;
        padding: 20px;
        border-radius: 18px;
      }
      th, td {
        padding: 10px;
        font-size: 0.94rem;
      }
    }
  </style>
</head>
<body>
  <main>
    <h1>Mailbox Sender Report</h1>
    <p class="lede">Account <strong>${escapeHtml(accountLabel)}</strong>${emailLabel ? ` for <strong>${escapeHtml(emailLabel)}</strong>` : ""}</p>
    <div class="stats">
      <div class="stat"><span>Scanned messages</span><strong>${scannedMessages}</strong></div>
      <div class="stat"><span>Unique senders</span><strong>${rows.length}</strong></div>
      <div class="stat"><span>Generated</span><strong>${escapeHtml(generatedAt)}</strong></div>
      <div class="stat"><span>Sent folders included</span><strong>${includeSent ? "Yes" : "No"}</strong></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Sender email</th>
          <th>Messages received</th>
          <th>Share</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p class="note">By default the scan skips Sent, Drafts, Templates, and Outbox folders so the report focuses on received mail.</p>
  </main>
</body>
</html>`;
}
