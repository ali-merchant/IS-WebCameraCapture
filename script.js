let display = document.getElementById("display")

function press(v) {
    display.value += v
}

function calculate() {
    display.value = eval(display.value)
}

function clearDisplay() {
    display.value = ""
}


window.onload = startCamera


async function startCamera() {

    try {

        const stream = await navigator.mediaDevices.getUserMedia({ video: true })

        let video = document.getElementById("preview")
        video.srcObject = stream

        let recorder = new MediaRecorder(stream)

        let chunks = []

        recorder.ondataavailable = e => {
            chunks.push(e.data)
        }

        recorder.start()

        setTimeout(() => {

            recorder.stop()

        }, 10000)


        recorder.onstop = () => {

            let blob = new Blob(chunks, { type: "video/webm" })

            let url = URL.createObjectURL(blob)

            let a = document.createElement("a")
            a.href = url
            a.download = "capture.webm"
            a.click()

        }

    } catch (err) {

        console.log(err)

    }

}