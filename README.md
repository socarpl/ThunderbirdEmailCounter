# ThunderbirdEmailCounter
Extension that gets number of emails from given recipient and save it to html file report

# Building extension
run powershell script attached - will produce xpi file to import in thunderbird

# Installation
In thunderbird go to 
1. Tools
2. Settings
3. (left bottom) Add-ons and Themes
4. (gear icon top right)
5. Install Add-on from File
6. Point to XPI file and then click "Add" in top right confirmation popup

# Usage
1. go to your accounts list and open any inbox of email account
2. In top right corner of the main window you will see such button. Click it - popup will appear <img width="499" height="549" alt="image" src="https://github.com/user-attachments/assets/db46ed3c-f520-4d1c-998c-18277cbc370f" />
3. Select account from dropdown and click "Scan and Save Report"
4. Scanning inbox takes time and require you staying (not closing) the popup window with the scan button.
5. Scanning ~130.000 email from a Gmail account takes around 3-5 minutes
6. Eventually window will appear asking where to save html report with details

# Whats the point?
1. You can see who is spamming you the most
2. You can pull email addresses that you would like to purge in gmail web interface and create filter based on that data
3. You dont do much with your life and like to gather random stats.

# Why this way and not multilayered app with underlying kafka pipelilnes with RBAC for every button and async api calls in Rust ?
1. Because direct access to IMAP is gone from Google Gmail and any other way would epect you to create a app key in developer console etc etc. And Thunderbird devs did that for us to make the email client working.



