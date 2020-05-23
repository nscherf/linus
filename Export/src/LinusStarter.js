import Linus from './Linus.js'
import LinusGUI from './LinusGui.js'
import LinusTourController from './LinusTourController.js'


export class LinusStarter {

    constructor(tourList) {
        this.tourList = tourList;
        // Start the actuall progress
        console.time('time to load data');
        var url = new URL(window.location.href);

        // Decide whether to load by a HTTP request or as simple "include"
        if (window.location.protocol.includes("http")) {
            var dataUrl = url.toString().substring(0, url.toString().lastIndexOf("/")) + "/data/data.json";
            this.handleLoadingFromServer(dataUrl)
        }
        else {
            this.handleLoadingFromLocal()
        }
    }

    handleLoadingFromLocal() {
        console.log("This script runs locally")
        var script = document.createElement('script');
        script.onload = () => { this.loadEverything(data) };
        script.src = "data/data.json";
        document.head.appendChild(script);
    }

    handleLoadingFromServer(dataUrl) {
        console.log("This script runs on a server. Data:", dataUrl)
        var client = new XMLHttpRequest();
        client.open('GET', dataUrl);
        client.onprogress = (e) => {
            var current = -1;
            var max = 1;
            if (e.lengthComputable) {
                current = e.loaded;
                max = e.total;
            }
            handleProgress(current, max);
        }
        client.onload = () => {
            console.log(client.responseType)
            this.receiveDataFromServer(client.responseText);
        }
        client.send();
    }

    roundMegaBytes(val) {
        return Math.ceil(val / 1024 / 1024)
    }

    handleProgress(current, max) {
        var percent = (current / max) * 100.;
        console.log(" Status: ", current, max)
        document.getElementById("loadingBarInner").style.width = percent + "%";
        document.getElementById("loadingBarInnerStatus").innerHTML = current > 0 ?
            this.roundMegaBytes(current) + "MB of " + this.roundMegaBytes(max) + "MB" : ""

    }

    receiveDataFromServer(receivedData) {
        var receivedData = receivedData.replace("var data = ", "")
        var data = null
        if (receivedData.charAt(0) === "{") {
            console.log("Non-Zipped")
            data = JSON.parse(receivedData) // Already
        }
        else {
            console.log("Zipped")
            data = receivedData.slice(1, -1) // Zipped; remove surrounding quotes
        }
        this.loadEverything(data)
    }

    loadEverything(data) {
        console.log("Finished loading of script, now processing data")
        console.timeEnd('time to load data');

        var url = new URL(window.location.href);

        // Create a regular GUI (builds HTML GUI)
        //var gui = new LinusGUI();

        // Create the vis tool, using the GUI
        var gui = new LinusGUI();
        var linus = new Linus(gui);
        console.log(data)
        // Now set data and parameters. Must be done first in order to prepare geometry etc.
        linus.setData(data);
        linus.setAA((url.searchParams.get("aa") !== null));
        linus.setShowFps((url.searchParams.get("fps") !== null));
        linus.disableGUI((url.searchParams.get("nogui") !== null));
        linus.setLOD(url.searchParams.get("lod") ? url.searchParams.get("lod") : 1);
        linus.setVr((url.searchParams.get("vr") !== null));

        // TODO: avoid this (doesn't look too nice)
        onmousedown = linus.onmousedown.bind(linus);
        //onclick = linus.onmousedown.bind(linus);
        onmousemove = linus.onmousemove.bind(linus);
        onmouseup = linus.onmouseup.bind(linus);
        ondblclick = linus.ondblclick.bind(linus);

        // Now let the program do everything (prepare geometry etc.)
        linus.start();

        // The tour module, manipulating GUI and the vis tool (e.g. camera)
        var tours = new LinusTourController(linus, gui);

        // Get settings first, then create the controller module
        if (url.searchParams.get("editor") !== null) tours.showTourEditor();
        if (url.searchParams.get("tour") !== null) tours.addTour("default tour", url.searchParams.get("tour"));

        tours = this.addMoreTours(tours);
        tours.create();

        // If we want to, we can now auto-start a certain tour. E.g. if "&autoStartTour=[tourName]" is in URL
        if (url.searchParams.get("autoStartTour") !== null) {
            var tourToStart = url.searchParams.get("autoStartTour");
            if (tourToStart === "") tourToStart = "default tour";
            tours.startTour(tourToStart);
        }
    }

    addMoreTours(tours) {
        console.log("Check for additional tours - found", this.tourList.length)
        for(var i = 0; i < this.tourList.length; i++) {
            tours.addTour(this.tourList[i].name, this.tourList[i].code)
        }

        return tours;
    }
}