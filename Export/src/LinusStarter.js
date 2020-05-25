import Linus from './Linus.js'
import LinusGUI from './LinusGui.js'
import LinusTourController from './LinusTourController.js'


export class LinusStarter {

    /**
     * Triggers the start of linus. Requires a lis of tours (which can be 
     * an empty array if you do not want to load any tours). Tours are 
     * defined by objects with "name" and "code" strings.
     */
    constructor(tourList) {
        this.tourList = tourList;
        // Start the actuall progress
        console.time('time to load data');
        let url = new URL(window.location.href);

        // Decide whether to load by a HTTP request or as simple "include"
        if (window.location.protocol.includes("http")) {
            let dataUrl = url.toString().substring(0, url.toString().lastIndexOf("/")) + "/data/data.json";
            this.handleLoadingFromServer(dataUrl)
        }
        else {
            this.handleLoadingFromLocal()
        }
    }

    /**
     * Opening the tool from the file system, we can simply include it.
     * That way we cannot have a progress bar (but we don't need it since
     * loading time should be close to 0).
     */
    handleLoadingFromLocal() {
        console.log("This script runs locally")
        let script = document.createElement('script');
        script.onload = () => { this.loadData(data) };
        script.src = "data/data.json";
        document.head.appendChild(script);
    }

    /**
     * Load the data in the background from the server. This allows us
     * to monitor progress of loading, but it is not possible on local
     * filesystems.
     */
    handleLoadingFromServer(dataUrl) {
        console.log("This script runs on a server. ")
        let client = new XMLHttpRequest();
        client.open('GET', dataUrl);
        client.onprogress = (e) => {
            let current = -1;
            let max = 1;
            if (e.lengthComputable) {
                current = e.loaded;
                max = e.total;
            }
            this.handleProgress(current, max);
        }
        client.onload = () => {
            console.log(client.responseType)
            this.receiveDataFromServer(client.responseText);
        }
        client.send();
    }

    /**
     * Data volume, for user output
     */
    roundMegaBytes(val) {
        return Math.ceil(val / 1024 / 1024)
    }

    /**
     * Updates the progress bar
     */
    handleProgress(current, max) {
        let percent = (current / max) * 100.;
        document.getElementById("loadingBarInner").style.width = percent + "%";
        document.getElementById("loadingBarInnerStatus").innerHTML = current > 0 ?
            this.roundMegaBytes(current) + "MB of " + this.roundMegaBytes(max) + "MB" : ""

    }

    /**
     * Prepare data that was loaded from a server
     */
    receiveDataFromServer(receivedDataRaw) {
        let receivedData = receivedDataRaw.replace("var data = ", "")
        let data = null
        if (receivedData.charAt(0) === "{") {
            console.log("Non-Zipped")
            data = JSON.parse(receivedData) // Already usable as it is
        }
        else {
            console.log("Zipped")
            data = receivedData.slice(1, -1) // Zipped - remove surrounding quotes
        }
        this.loadData(data)
    }

    /**
     * Handles the loading of linus and its components.
     */
    loadData(data) {
        console.timeEnd('time to load data');

        // Create the GUI and vis tool
        let gui = new LinusGUI();
        let linus = new Linus(gui);

        // Now set data and parameters. Must be done first in order to prepare geometry etc.
        linus.setData(data);

        // Get URL parameters
        let url = new URL(window.location.href);
        linus.setAA((url.searchParams.get("aa") !== null));
        linus.setShowFps((url.searchParams.get("fps") !== null));
        linus.disableGUI((url.searchParams.get("nogui") !== null));
        linus.setLOD(url.searchParams.get("lod") ? url.searchParams.get("lod") : 1);
        linus.setVr((url.searchParams.get("vr") !== null));

        // Connect mouse events to linus
        onmousedown = linus.onmousedown.bind(linus);
        onmousemove = linus.onmousemove.bind(linus);
        onmouseup = linus.onmouseup.bind(linus);
        ondblclick = linus.ondblclick.bind(linus);

        // Now let the program do everything (prepare geometry etc.)
        linus.start();

        // The tour module, manipulating GUI and the vis tool (e.g. camera)
        // (Must be performed after linus was started!)
        let tours = new LinusTourController(linus, gui);
        if (url.searchParams.get("editor") !== null) tours.showTourEditor();
        if (url.searchParams.get("tour") !== null) tours.addTour("Default tour", url.searchParams.get("tour"));
        tours = this.addMoreTours(tours);
        tours.create();

        // If we want to, we can now auto-start a certain tour. E.g. if "&autoStartTour=[tourName]" is in URL
        if (url.searchParams.get("autoStartTour") !== null) {
            let tourToStart = url.searchParams.get("autoStartTour");
            if (tourToStart === "") tourToStart = "Default tour";
            tours.startTour(tourToStart);
        }
    }

    /**
     * List of tours, each item must be an object consisting of fields "name" and "code"
     */
    addMoreTours(tours) {
        console.log("Check for additional tours - found", this.tourList.length)
        for (let i = 0; i < this.tourList.length; i++) {
            tours.addTour(this.tourList[i].name, this.tourList[i].code)
        }

        return tours;
    }
}