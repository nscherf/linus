export default class ScreenCapture {
    constructor(exportHandler) {
        this.isVideoRecording = false;
        this.videoCapturer = null;
        this.videoTime = 0;
        this.videoBitrate = 50000000;
        this.videoFormat = "video/webm";
        this.videoExport = "video/webm";
        this.videoFileType = "webm";
        this.exportHandler = exportHandler;
    }

    /**
     * Creates the GUI element
     */
    init(renderer) {
        this.renderer = renderer;
        var screenshotVideoHolder = document.createElement("div");
        screenshotVideoHolder.id = "screenshotVideoHolder";

        var screenshotLink = document.createElement("span");
        screenshotLink.id = "screenshotButton";
        screenshotLink.innerHTML = "&#128247;";
        screenshotLink.onclick = this.screenshot.bind(this);

        var videoLink = document.createElement("span");
        videoLink.id = "videoButton";
        videoLink.innerHTML = "&#x25cf;";
        videoLink.onclick = this.video.bind(this);
        console.log("Video link", videoLink.onclick);

        screenshotVideoHolder.appendChild(screenshotLink)
        screenshotVideoHolder.appendChild(videoLink)
        document.body.appendChild(screenshotVideoHolder)
    }

    /**
     * Disables Screenshot button in GUI
     */
    disableScreenshotButton() {
        var e = document.getElementById("screenshotButton");
        e.style.opacity = 0.5;
        e.style.cursor = "default";
        e.onclick = 0;
    }

    /**
     * Enables Screenshot button in GUI
     */
    enableScreenshotButton() {
        var e = document.getElementById("screenshotButton");
        e.style.opacity = 1;
        e.style.cursor = "pointer";
        e.onclick = this.screenshot.bind(this);
    }

        /**
     * Disables video button in GUI
     */
    enableVideoButton() {
        var e = document.getElementById("videoButton");
        e.innerHTML = "&#x25cf;";

    }

    /**
     * Enables video button in GUI
     */
    setVideoButtonStatus(time) {
        var e = document.getElementById("videoButton");
        e.innerHTML = "&#x25a0; - " + time + "s";
    }

    /**
     * Download current canvas as png file
     */
    screenshot() {
        console.log("Screenshot");
        this.disableScreenshotButton();
        this.renderer.domElement.toBlob(
            function (blob) {
                this.exportHandler.downloadRaw(
                    "screenshot-" + this.exportHandler.getExportFileName() + ".png",
                    blob
                );
                this.enableScreenshotButton();
            }.bind(this),
            "image/png"
        );
    }

    /**
     * Start and stop video recording
     */
    video() {
        if (this.isVideoRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    /**
     * Start video recording process
     */
    startRecording() {
        this.videoTime = Date.now();
        this.isVideoRecording = true;
        var options = {
            mimeType: this.videoFormat,
            videoBitsPerSecond: parseInt(this.videoBitrate),
        };
        console.log("options", options);
        this.recordedBlobs = [];
        try {
            this.mediaRecorder = new MediaRecorder(
                this.renderer.domElement.captureStream(),
                options
            );
        } catch (e0) {
            console.log(
                "Unable to create MediaRecorder with options Object: ",
                e0
            );
            try {
                this.videoFormat = "video/webm,codecs=vp9";
                options.mimeType = this.videoFormat;
                this.mediaRecorder = new MediaRecorder(
                    this.renderer.domElement.captureStream(),
                    options
                );
            } catch (e1) {
                console.log(
                    "Unable to create MediaRecorder with options Object: ",
                    e1
                );
                try {
                    this.videoFormat = "video/vp8";
                    options = "video/vp8"; // Chrome 47
                    this.mediaRecorder = new MediaRecorder(
                        this.renderer.domElement.captureStream(),
                        options
                    );
                } catch (e2) {
                    alert(
                        "MediaRecorder is not supported by this browser.\n\n" +
                            "Try Firefox 29 or later, or Chrome 47 or later, " +
                            "with Enable experimental Web Platform features enabled from chrome://flags."
                    );
                    console.error(
                        "Exception while creating MediaRecorder:",
                        e2
                    );
                    return;
                }
            }
        }
        console.log(
            "Created MediaRecorder",
            this.mediaRecorder,
            "with options",
            options
        );

        this.mediaRecorder.onstop = this.handleStop.bind(this);
        this.mediaRecorder.ondataavailable = this.handleDataAvailable.bind(
            this
        );
        this.mediaRecorder.start(100); // collect 100ms of data
        console.log("MediaRecorder started", this.mediaRecorder);
    }

    /**
     * Stop the recording
     */
    stopRecording() {
        this.mediaRecorder.stop();
    }

    /**
     * Trigger the download
     */
    handleStop() {
        console.log("Stop");
        this.downloadVideo();
        this.isVideoRecording = false;
    }

    /**
     * Update state whenever a new chunk of video comes in (store and show status)
     */
    handleDataAvailable() {
        console.log("Receive video data...");
        if (event.data && event.data.size > 0) {
            this.recordedBlobs.push(event.data);
        }
        var time = parseInt((Date.now() - this.videoTime) / 1000);
        this.setVideoButtonStatus(time);
    }

    /**
     * Download the actual video
     */
    downloadVideo() {
        const blob = new Blob(this.recordedBlobs, {
            type: this.videoFormatExport,
        });
        let filename = "video-" + this.exportHandler.getExportFileName() + ".webm";
        this.exportHandler.downloadRaw(filename, blob);
        this.enableVideoButton();
    }
}