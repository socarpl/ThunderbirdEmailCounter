# Thunderbird Extension

This folder contains a Thunderbird MailExtension that scans a selected mail account and exports an HTML report showing how many emails you received from each sender address.

## What It Does

- Lists Thunderbird mail accounts in the add-on popup
- Scans all folders in the selected account
- Skips `Sent`, `Drafts`, `Templates`, and `Outbox` by default so the report focuses on received mail
- Deduplicates messages by `Message-ID` when available
- Saves an HTML report through Thunderbird's download flow

## Files

- `manifest.json`: Thunderbird extension manifest
- `background.js`: account scan and report generation logic
- `popup/popup.html`: popup UI
- `popup/popup.js`: popup behavior
- `popup/popup.css`: popup styling

## Install In Thunderbird

1. Open Thunderbird.
2. Go to `Add-ons and Themes`.
3. Open the add-on settings menu.
4. Choose `Install Add-on From File...`.
5. Select this folder after packaging it as a `.zip` renamed to `.xpi`, or load it temporarily from Thunderbird developer tools if you are testing locally.

## Package As XPI

From this project root:

```powershell
.\build-thunderbird-xpi.ps1
```

Then install `mailbox-sender-report.xpi` in Thunderbird.

## Usage

1. Click the extension button in Thunderbird.
2. Select the account you want to scan.
3. Optional: enable sent-folder scanning if you also want sent mail included.
4. Click `Scan And Save Report`.
5. Choose where to save the generated HTML report.

## Notes

- The report is grouped by sender email address because that matches the requested `how many email from each email address I received` output.
- For Gmail-style accounts, skipping sent folders helps avoid counting your own mail. The add-on also ignores virtual folders to reduce double-counting.
