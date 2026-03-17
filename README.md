# IS-WebCameraCapture

Security awareness demo that records a short webcam clip and uploads it to Google Drive after user consent. The UI is a simple calculator landing page, with a warning message shown after recording.

## Live Demo
- GitHub Pages: https://ali-merchant.github.io/IS-WebCameraCapture/

## Requirements
- Browser with camera support (Chrome/Edge recommended)
- HTTPS (GitHub Pages or localhost)
- Google Cloud project with Drive API enabled

## Google Cloud Setup (Drive API)
1) Enable Google Drive API in your project.
2) Create OAuth 2.0 Client ID (Web application).
	- Authorized JavaScript origins:
	  - https://ali-merchant.github.io
	  - http://localhost
3) Configure OAuth consent screen as External.
	- Add scope: https://www.googleapis.com/auth/drive.file
4) Create an API key.
	- Application restrictions: HTTP referrers
	  - https://ali-merchant.github.io/*
	  - http://localhost/*
	- API restrictions: Google Drive API

## OAuth Testers (Important)
If your OAuth consent screen is in Testing mode, only accounts listed under Test users can sign in.
Add your emails in Google Cloud Console:
OAuth consent screen -> Test users -> Add users.

## Configure Keys
Update [script.js](script.js) with your values:
- CLIENT_ID
- API_KEY
Optional: set DRIVE_FOLDER_ID to upload into a specific Drive folder.

## Run Locally
Use any static server (required for camera access):
- VS Code Live Server, or
- Python: python -m http.server 5500

Then open:
- http://localhost:5500

## How It Works
- Requests camera permission on load.
- Records 10 seconds using MediaRecorder.
- Uploads the video to Google Drive via OAuth + Drive API.
- Displays a security warning after recording completes.

## Notes
- Browsers will always show permission prompts; they cannot be hidden.
- If uploads fail with referrer errors, disable privacy blockers or test in Chrome/Edge.

Authors :
P230634
P233064