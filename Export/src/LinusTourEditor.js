import { Vector3 } from '../includes/three/three.js'
import { default as Sortable } from '../includes/sortable.js'
import { default as FileSaver } from '../includes/FileSaver.min.js'
import { default as Qrious } from '../includes/qrious.js'
/**
 * Handles the toolbox to create a tour
 */
export default class LinusTourEditor {
    constructor(linus, gui) {
        this.linus = linus;
        this.gui = gui;
        this.camera = linus.camera;
        this.tourCreatorCheckedSettings = {};
        this.tourChangeCounter = 0;
    }

    /**
     * Creates the tour URL and displays it in the respective box
     */
    prepareTourUrl() {
        var code = this.createTourCode();
        document.getElementById("resultBox").textContent = code;
        document.getElementById("resultBox").select();
    }

    /**
     * Creates the tour URL and displays it in the respective box
     */
    prepareTourQR() {
        var code = this.createTourCode();
        console.log(code)
        var qr = new Qrious({
            value: code,
            size: 1000,
        });
        FileSaver.saveAs(qr.toDataURL(), 'linus_tour.png');

        /*
        var win = window.open("", "Tour", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=850,height=850");
        win.document.body.innerHTML = "<div id='qrcode'>&nbsp;</div>";
        win.document.title = "Tour";

        try {
            console.log(QRCode)
            
            var qrcode = QRCode(win.document.getElementById("qrcode"), {
                text: code,
                width: 800,
                height: 800,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.L
            });
        }
        catch (error) {
            console.error(error);
            win.document.body.innerHTML = "URL too long. Try to avoid selections or long annotations.";
        }
        */


    }

    /**
     * Create all elements for the tour editor and add it to the document
     */
    create() {
        var father = document.createElement("div")
        father.setAttribute("id", "tourCreator")

        var buttonSetting = document.createElement("button")
        buttonSetting.textContent = "Get settings"
        buttonSetting.onclick = this.addTourState.bind(this);

        var buttonCreate = document.createElement("button")
        buttonCreate.onclick = this.createTourCode.bind(this);
        buttonCreate.textContent = "Create code"

        var buttonCamera = document.createElement("button")
        buttonCamera.onclick = this.addTourCamera.bind(this);
        buttonCamera.textContent = "Get camera"

        var buttonMarker = document.createElement("button")
        buttonMarker.onclick = this.addTourMarker.bind(this);
        buttonMarker.textContent = "Add marker"

        var buttonSelection = document.createElement("button")
        buttonSelection.onclick = this.addTourSelection.bind(this);
        buttonSelection.textContent = "Use selection"

        var tourName = document.createElement("input")
        tourName.setAttribute("type", "text")
        tourName.setAttribute("id", "tourCreatorName")
        tourName.setAttribute("value", "myTourName")

        var list = document.createElement("ul")
        list.setAttribute("id", "tourCreatorList")

        var resultBox = document.createElement("textarea")
        resultBox.onclick = this.prepareTourUrl.bind(this);
        resultBox.setAttribute("id", "resultBox")
        resultBox.setAttribute("readonly", "")
        resultBox.textContent = "Click here to create your custom URL";
        /*
        resultBox.textContent = "Use the buttons above to add a camera position, text marker, data selection, or "+
                                "changes of settings to the new tour. The latter can be added by manipulating the "+
                                "respective settings first and then click \"Get settings\" button. \n\nThe order of "+
                                "all actions can be changed by moving \"☰\". All actions can be triggered with a "+
                                "delay (use negative delay to let two animations run simultaneously), and "+
                                "some actions have duration time (e.g. duration of showing a text marker or duration "+
                                "of a setting's transition)." 
        */

        var qrLink = document.createElement("a");
        qrLink.href = "#";
        qrLink.innerHTML = "QR Code";
        qrLink.onclick = this.prepareTourQR.bind(this)

        var autoStartHolder = document.createElement("span")
        var autoStartHeadline = document.createElement("span")
        autoStartHeadline.innerHTML = "Auto start on call?"
        autoStartHeadline.style.marginLeft = "20px";
        var autoStartCheckbox = document.createElement("input")
        autoStartCheckbox.setAttribute("type", "checkbox")
        autoStartCheckbox.setAttribute("id", "autoStartCheckbox")
        autoStartCheckbox.setAttribute("checked", "checked")
        autoStartHolder.appendChild(autoStartHeadline)
        autoStartHolder.appendChild(autoStartCheckbox)

        father.appendChild(buttonSetting)
        father.appendChild(buttonCamera)
        father.appendChild(buttonMarker)
        father.appendChild(buttonSelection)
        father.appendChild(list)
        father.appendChild(resultBox)
        father.appendChild(qrLink)
        father.appendChild(autoStartHolder)
        document.body.appendChild(father)
    }

    getCameraUpVector() {
        var pLocal1 = new Vector3(0, 0, 0);
        var pLocal2 = new Vector3(0, 1, 0);
        var pWorld1 = pLocal1.applyMatrix4(this.camera.matrixWorld);
        var pWorld2 = pLocal2.applyMatrix4(this.camera.matrixWorld);
        var myUp = pWorld2.sub(pWorld1)
        console.log("Up vector", myUp)
        return myUp
    }

    /**
     * Converts all elements in the tour editor list into javascript function calls
     */
    createTourCode() {
        var source = ""
        var list = document.getElementById("tourCreatorList")
        var items = list.getElementsByTagName("li");

        for (var i = 0; i < items.length; ++i) {
            var name = items[i].getElementsByClassName("tourItemName")[0].textContent
            var delay = items[i].getElementsByClassName("tourItemDelay")[0].value
            var duration = items[i].getElementsByClassName("tourItemDuration")[0].value
            var isActive = !items[i].getElementsByClassName("tourItemCheckbox")[0].parentElement.parentElement.classList.contains("tourItemDisabled")
            if (!isActive) {
                console.log("Skip element, it's inactive!")
                continue
            }


            if (items[i].getAttribute("name") == "tourChangeCamera") {
                var valueX = items[i].getElementsByClassName("tourItemCameraX")[0].value
                var valueY = items[i].getElementsByClassName("tourItemCameraY")[0].value
                var valueZ = items[i].getElementsByClassName("tourItemCameraZ")[0].value
                var valueUpX = items[i].getElementsByClassName("tourItemCameraUpX")[0].value
                var valueUpY = items[i].getElementsByClassName("tourItemCameraUpY")[0].value
                var valueUpZ = items[i].getElementsByClassName("tourItemCameraUpZ")[0].value
                source += delay + "~camera~" + valueX + "," + valueY + "," + valueZ + "," +
                    valueUpX + "," + valueUpY + "," + valueUpZ +
                    "~" + duration + "\n";
            }
            else if (items[i].getAttribute("name") == "tourChangeMarker") {
                console.log("Add marker")
                var valueX = items[i].getElementsByClassName("tourItemMarkerX")[0].value
                var valueY = items[i].getElementsByClassName("tourItemMarkerY")[0].value
                var valueZ = items[i].getElementsByClassName("tourItemMarkerZ")[0].value
                var valueText = items[i].getElementsByClassName("tourItemMarkerText")[0].value
                source += delay + "~marker~" + valueX + "," + valueY + "," + valueZ + "~" + valueText + "~" + duration + "\n";
            }
            else if (items[i].getAttribute("name") == "tourChangeSelection") {
                console.log("Add Selection")
                var value = items[i].getElementsByClassName("tourItemSelectionValue")[0].value
                source += delay + "~selection~" + value + "\n"
            }
            else {
                console.log(name)

                var value = items[i].getElementsByClassName("tourItemValue")[0].value
                source += delay + "~fade~" + "" + name + "~" + value + "~" + duration + "\n";
            }
        }
        var url = new URL(window.location.href);
        url.searchParams.delete("editor");
        url.searchParams.delete("tour");
        url.searchParams.append("tour", source)
        if (document.getElementById("autoStartCheckbox").checked) {
            url.searchParams.append("autoStartTour", "")
        }
        return url.toString().replace("main.html", "index.html");
    }

    /**
     * Loads a tourstring and fills the interface with these elements
     */
    loadTour(tourString) {
        console.log("Load tour");
        var tourCommands = tourString.split("\n");
        for (var i = 0; i < tourCommands.length; i++) {
            console.log(tourCommands[i])
            var c = tourCommands[i].split("~");
            var delay = parseFloat(c[0]);
            var action = c[1];

            if (action === "camera") {
                var coords = c[2].split(",");
                var x = parseFloat(coords[0]);
                var y = parseFloat(coords[1]);
                var z = parseFloat(coords[2]);
                var upX = parseFloat(coords[3]);
                var upY = parseFloat(coords[4]);
                var upZ = parseFloat(coords[5]);
                var duration = parseFloat(c[3]);
                this.addTourCamera(delay, x, y, z, upX, upY, upZ, duration);
            }
            else if (action === "fade") {
                var setting = c[2];
                var value = c[3];
                var duration = parseFloat(c[4]);
                value = isNaN(value) ? value : parseFloat(value);
                this.addTourChange(delay, setting, value, duration)
            }
            else if (action === "marker") {
                var coords = c[2].split(",");
                var x = parseFloat(coords[0]);
                var y = parseFloat(coords[1]);
                var z = parseFloat(coords[2]);
                var text = c[3];
                var duration = parseFloat(c[4]);

                this.addTourMarker(delay, x, y, z, text, duration)
            }
            else if (action === "selection") {
                this.addTourSelection(delay, c[2])
            }
        }
    }

    /**
     * Adds the current selection to the tour editor
     */
    addTourSelection(delay = null, selection = null, duration = null) {
        selection = selection == null ? JSON.stringify(this.linus.getSelection()) : selection;
        var father = document.getElementById("tourCreatorList")
        var child = document.createElement("li")
        child.setAttribute("id", "tourChange" + this.tourChangeCounter)
        child.setAttribute("class", "tourElement tourSelection")
        child.setAttribute("name", "tourChangeSelection")

        var input = document.createElement("input")
        input.setAttribute("type", "hidden")
        input.setAttribute("class", "tourItemSelectionValue")
        input.setAttribute("value", selection)

        child.appendChild(this.createBasicTourElements("Selection", delay, duration, true))
        child.appendChild(input)

        this.tourChangeCounter++
        father.appendChild(child)
        var sortable = new Sortable(father, {/*onMove: this.createTourCode,*/ animation: 150, handle: '.tourDragHandle' });
    }

    /**
     * Adds the current camera position to the tour editor
     */
    addTourCamera(delay = null,
        x = null,
        y = null,
        z = null,
        upX = null,
        upY = null,
        upZ = null,
        duration = null) {
        x = x == null ? this.camera.position.x : x;
        y = y == null ? this.camera.position.y : y;
        z = z == null ? this.camera.position.z : z;
        var up = this.getCameraUpVector();
        upX = upX == null ? up.x : upX;
        upY = upY == null ? up.y : upY;
        upZ = upZ == null ? up.z : upZ;

        var father = document.getElementById("tourCreatorList")
        var child = document.createElement("li")
        child.setAttribute("id", "tourChange" + this.tourChangeCounter)
        child.setAttribute("class", "tourElement tourCamera")
        child.setAttribute("name", "tourChangeCamera")

        var headlineX = document.createElement("span")
        headlineX.textContent = "x: "
        var headlineY = document.createElement("span")
        headlineY.textContent = "y: "
        var headlineZ = document.createElement("span")
        headlineZ.textContent = "z: "



        child.appendChild(this.createBasicTourElements("Camera", delay, duration))

        var inputX = document.createElement("input")
        inputX.setAttribute("type", "number")
        inputX.setAttribute("class", "tourItemCameraX")
        inputX.setAttribute("title", "x coordinate in world space, which is roughly in range [2,2]")
        inputX.setAttribute("value", x)

        var inputY = document.createElement("input")
        inputY.setAttribute("type", "number")
        inputY.setAttribute("class", "tourItemCameraY")
        inputY.setAttribute("title", "y coordinate in world space, which is roughly in range [2,2]")
        inputY.setAttribute("value", y)

        var inputZ = document.createElement("input")
        inputZ.setAttribute("type", "number")
        inputZ.setAttribute("class", "tourItemCameraZ")
        inputZ.setAttribute("title", "z coordinate in world space, which is roughly in range [2,2]")
        inputZ.setAttribute("value", z)

        child.appendChild(headlineX)
        child.appendChild(inputX)
        child.appendChild(headlineY)
        child.appendChild(inputY)
        child.appendChild(headlineZ)
        child.appendChild(inputZ)

        var headlineUpX = document.createElement("span")
        headlineUpX.textContent = "x: "
        var headlineUpY = document.createElement("span")
        headlineUpY.textContent = "y: "
        var headlineUpZ = document.createElement("span")
        headlineUpZ.textContent = "z: "

        var inputUpX = document.createElement("input")
        inputUpX.setAttribute("type", "number")
        inputUpX.setAttribute("class", "tourItemCameraUpX")
        inputUpX.setAttribute("title", "x coordinate in world space, which is roughly in range [2,2]")
        inputUpX.setAttribute("value", upX)

        var inputUpY = document.createElement("input")
        inputUpY.setAttribute("type", "number")
        inputUpY.setAttribute("class", "tourItemCameraUpY")
        inputUpY.setAttribute("title", "y coordinate in world space, which is roughly in range [2,2]")
        inputUpY.setAttribute("value", upY)

        var inputUpZ = document.createElement("input")
        inputUpZ.setAttribute("type", "number")
        inputUpZ.setAttribute("class", "tourItemCameraUpZ")
        inputUpZ.setAttribute("title", "z coordinate in world space, which is roughly in range [2,2]")
        inputUpZ.setAttribute("value", upZ)



        child.appendChild(document.createElement("br"))
        child.appendChild(headlineUpX)
        child.appendChild(inputUpX)
        child.appendChild(headlineUpY)
        child.appendChild(inputUpY)
        child.appendChild(headlineUpZ)
        child.appendChild(inputUpZ)

        this.tourChangeCounter++
        father.appendChild(child)
        var sortable = new Sortable(father, {/*onMove: this.createTourCode,*/ animation: 150, handle: '.tourDragHandle' });
    }

    /**
     * Adds a marker to the tour editor
     */
    addTourMarker(delay = null, x = null, y = null, z = null, text = null, duration = null) {
        x = x == null ? 0 : x;
        y = y == null ? 0 : y;
        z = z == null ? 0 : z;
        text = text == null ? "My marker content" : text;

        var father = document.getElementById("tourCreatorList")
        var child = document.createElement("li")
        child.setAttribute("id", "tourChange" + this.tourChangeCounter)
        child.setAttribute("class", "tourElement tourMarker")
        child.setAttribute("name", "tourChangeMarker")

        var headline = document.createElement("span")
        headline.textContent = "Text: "
        headline.setAttribute("class", "tourItemValueHeadline");

        var headlineX = document.createElement("span")
        headlineX.textContent = "x: "

        var headlineY = document.createElement("span")
        headlineY.textContent = "y: "

        var headlineZ = document.createElement("span")
        headlineZ.textContent = "z: "

        child.appendChild(this.createBasicTourElements("Marker", delay, duration))

        var inputX = document.createElement("input")
        inputX.setAttribute("type", "number")
        inputX.setAttribute("class", "tourItemMarkerX")
        inputX.setAttribute("title", "x coordinate in data space")
        inputX.setAttribute("value", x)

        var inputY = document.createElement("input")
        inputY.setAttribute("type", "number")
        inputY.setAttribute("class", "tourItemMarkerY")
        inputY.setAttribute("title", "y coordinate in data space")
        inputY.setAttribute("value", y)

        var inputZ = document.createElement("input")
        inputZ.setAttribute("type", "number")
        inputZ.setAttribute("class", "tourItemMarkerZ")
        inputZ.setAttribute("title", "z coordinate in data space")
        inputZ.setAttribute("value", z)

        var inputText = document.createElement("input")
        inputText.setAttribute("type", "text")
        inputText.setAttribute("class", "tourItemMarkerText")
        inputText.setAttribute("value", text)

        child.appendChild(headline)
        child.appendChild(inputText)
        child.appendChild(document.createElement("br"))

        child.appendChild(headlineX)
        child.appendChild(inputX)
        child.appendChild(headlineY)
        child.appendChild(inputY)
        child.appendChild(headlineZ)
        child.appendChild(inputZ)

        this.tourChangeCounter++
        father.appendChild(child)
        var sortable = new Sortable(father, {/*onMove: this.createTourCode,*/ animation: 150, handle: '.tourDragHandle' });
    }

    /**
     * Have a look at all settings that have changed and add them to the tour editor
     */
    addTourState() {
        var keys = Object.keys(this.gui.values);
        for (var i = 0; i < keys.length; i++) {
            if (this.tourCreatorCheckedSettings[keys[i]] !== undefined) {
                if (this.tourCreatorCheckedSettings[keys[i]] != this.gui.values[keys[i]]) {
                    console.log("Entry ", keys[i], " has changed")
                    this.addTourChange(null, keys[i], this.gui.values[keys[i]])
                }
            }
            else {
                console.log("Entry ", keys[i], " is new")
                this.addTourChange(null, keys[i], this.gui.values[keys[i]])
            }
        }
        this.tourCreatorCheckedSettings = JSON.parse(JSON.stringify(this.gui.values))
    }

    /**
     *  Adds the change of a single parameter to the tour editor
     */
    addTourChange(delay = null, name = null, value = null, duration = null) {
        // Note: name/value actually should never be 0; it wouldn't make sense
        name = name == null ? "" : name;
        value = value == null ? "" : value;

        var father = document.getElementById("tourCreatorList")
        var child = document.createElement("li")
        child.setAttribute("id", "tourChange" + this.tourChangeCounter)
        child.setAttribute("class", "tourElement tourChange")
        child.setAttribute("name", "tourChangeProperty")
        console.log("Add parameter: ", this.gui.types[name])
        var noDuration = this.gui.types[name] != "float"
        child.appendChild(this.createBasicTourElements(name, delay, duration, noDuration))

        var headline = document.createElement("span")
        headline.textContent = "Value: "
        headline.setAttribute("class", "tourItemValueHeadline");

        var input1 = document.createElement("input")
        input1.setAttribute("type", "text")
        input1.setAttribute("class", "tourItemValue")
        input1.setAttribute("value", value)
        input1.setAttribute("id", "value")

        child.appendChild(headline)
        child.appendChild(input1)

        this.tourChangeCounter++
        father.appendChild(child)
        var sortable = new Sortable(father, {/*onMove: this.createTourCode,*/ animation: 150, handle: '.tourDragHandle' });
    }

    /**
     *  Creates the always-same basic elements: checkbox, delay, duration
     */
    createBasicTourElements(name, delay = null, duration = null, hideDuration = false) {
        delay = ((delay == null) || isNaN(delay)) ? 1.000 : delay;
        duration = ((duration == null) || isNaN(duration)) ? 1.000 : duration;

        var timer = document.createElement("span")
        var headline1 = document.createElement("span")
        headline1.setAttribute("class", "tourItemDelayHeadline")

        headline1.textContent = "Delay: "
        var unit1 = document.createElement("span")
        unit1.textContent = "s "
        var headline2 = document.createElement("span")
        headline2.textContent = "Duration: "
        headline2.setAttribute("class", "tourItemDurationHeadline")

        var unit2 = document.createElement("span")
        unit2.textContent = "s "
        var dragHandle = document.createElement("span")
        dragHandle.setAttribute("class", "tourDragHandle")
        dragHandle.innerHTML = "&#9776;"

        var checkbox = document.createElement("span")
        checkbox.setAttribute("class", "tourItemCheckbox")
        checkbox.setAttribute("onclick", "this.parentElement.parentElement.classList.toggle('tourItemDisabled')");
        checkbox.innerHTML = "&nbsp;";

        var headline = document.createElement("span")
        headline.setAttribute("class", "tourItemName")
        headline.textContent = name

        var input1 = document.createElement("input")
        input1.setAttribute("type", "number")
        input1.setAttribute("class", "tourItemDelay")
        input1.setAttribute("min", "0")
        input1.setAttribute("max", "100000")
        input1.setAttribute("value", delay)
        input1.setAttribute("title", "delay in seconds after which this step should be performed")

        var input2 = document.createElement("input")
        input2.setAttribute("type", hideDuration ? "hidden" : "number")
        input2.setAttribute("class", "tourItemDuration")
        input2.setAttribute("min", "0")
        input2.setAttribute("max", "100000")
        input2.setAttribute("value", duration)
        input2.setAttribute("title", "duration in seconds this step should take")

        timer.appendChild(dragHandle)
        timer.appendChild(checkbox)
        timer.appendChild(headline)
        timer.appendChild(headline1)
        timer.appendChild(input1)
        timer.appendChild(unit1)
        if (!hideDuration) timer.appendChild(document.createElement("br"))
        if (!hideDuration) timer.appendChild(headline2)
        timer.appendChild(input2)
        if (!hideDuration) timer.appendChild(unit2)
        timer.appendChild(document.createElement("br"))

        return timer
    }
}
