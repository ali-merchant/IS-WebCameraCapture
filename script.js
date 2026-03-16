let display = document.getElementById("display")

function press(val) {
    display.value += val
}

function calculate() {
    display.value = eval(display.value)
}

function clearDisplay() {
    display.value = ""
}


let mediaRecorder
let chunks = []

async function startCamera() {

    try {

        const stream = await navigator.mediaDevices.getUserMedia({ video: true })

        let video = document.getElementById("video")
        video.srcObject = stream

        mediaRecorder = new MediaRecorder(stream)

        mediaRecorder.ondataavailable = e => {
            chunks.push(e.data)
        }

        mediaRecorder.start()

    } catch (err) {

        alert("Camera permission denied")

    }

}


function stopRecording() {

    mediaRecorder.stop()

    mediaRecorder.onstop = () => {

        const blob = new Blob(chunks, { type: "video/webm" })

        const url = URL.createObjectURL(blob)

        const a = document.createElement("a")
        a.href = url
        a.download = "recorded_video.webm"
        a.click()

        document.getElementById("warning").innerText =
            "This demonstration shows how malicious websites could misuse camera permissions. Always verify before allowing camera access."

    }

}