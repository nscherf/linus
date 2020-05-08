import Linus from './Linus.js'
import LinusGUI from './LinusGui.js'
import LinusTourController from './LinusTourController.js'


// Start the actuall progress
console.time('time to load data');
var url = new URL(window.location.href);

// Decide whether to load by a HTTP request or as simple "include"
if (window.location.protocol.includes("http")) {
    var dataUrl = url.toString().substring(0, url.toString().lastIndexOf("/")) + "/data/data.json";
    handleLoadingFromServer(dataUrl)
}
else {
    handleLoadingFromLocal()
}

function handleLoadingFromLocal() {
    console.log("This script runs locally")
    var script = document.createElement('script');
    script.onload = loadEverything;
    script.src = "data/data.json";
    document.head.appendChild(script);
}
console.log("hello");

function handleLoadingFromServer(dataUrl) {
    console.log("This script runs on a server. Data:", dataUrl)
    var client = new XMLHttpRequest();
    client.open('GET', dataUrl);
    client.onprogress = function (e) {
        var current = -1;
        var max = 1;
        if (e.lengthComputable) {
            current = e.loaded;
            max = e.total;
        }
        handleProgress(current, max);
    }
    client.onload = function () {
        console.log(client.responseType)
        receiveDataFromServer(client.responseText);
    }
    client.send();
}

function roundMegaBytes(val) {
    return Math.ceil(val / 1024 / 1024)
}

function handleProgress(current, max) {
    var percent = (current / max) * 100.;
    console.log(" Status: ", current, max)
    document.getElementById("loadingBarInner").style.width = percent + "%";
    document.getElementById("loadingBarInnerStatus").innerHTML = current > 0 ?
    roundMegaBytes(current) + "MB of " + roundMegaBytes(max) + "MB" : ""
    
}

    function receiveDataFromServer(receivedData) {
        var receivedData = receivedData.replace("var data = ", "")
        if (receivedData.charAt(0) === "{") {
            console.log("Non-Zipped")
            this.data = JSON.parse(receivedData) // Already
        }
        else {
            console.log("Zipped")
            this.data = receivedData.slice(1, -1) // Zipped; remove surrounding quotes
        }
        loadEverything()
    }

    function loadEverything() {
        console.log("Finished loading of script, now processing data")
        console.timeEnd('time to load data');

        var url = new URL(window.location.href);

        // Create a regular GUI (builds HTML GUI)
        //var gui = new LinusGUI();

        // Create the vis tool, using the GUI
        var gui = new LinusGUI();
        var linus = new Linus(gui);

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

        tours = addMoreTours(tours);
        tours.create();

        // If we want to, we can now auto-start a certain tour. E.g. if "&autoStartTour=[tourName]" is in URL
        if (url.searchParams.get("autoStartTour") !== null) {
            var tourToStart = url.searchParams.get("autoStartTour");
            if (tourToStart === "") tourToStart = "default tour";
            tours.startTour(tourToStart);
        }
    }

    function addMoreTours(tours) {
        console.log("Check for additional tours")
        /*--------------- INCLUDE CODE FOR TOURS AFTER THIS ---------------*/
        // Uncomment the next three lines and paste the URL (within "") to the next line
        // var generatedUrlString = "http://replace.this.url"
        // var urlObject = new URL(generatedUrlString)
        // tours.addTour("my second tour", urlObject.searchParams.get("tour"));
        // ...and more
        /*--------------- INCLUDE CODE FOR TOURS BEFORE THIS ---------------*/
    
        return tours;
    }
