import { Vector3 } from '../includes/three/three.js'
import LinusTourEditor from './LinusTourEditor.js'
/**
 *  Class to adjust the Linus' settings in a timely scheduled
 *  manner. This class must have access to the original Linus
 *  object and the GUI, since it performs one of the following 
 *  actions: - adjusting a value in the GUI
 *           - setting the camera (in the linus object)
 */
export default class LinusTourController {
    constructor(linus, gui)
    {
        // The items we are working on
        this.linus = linus;
        this.gui = gui;
        this.camera = linus.camera;

        // The timer is the global clock which is used for scheduling. 
        // Must be reset to 0 everytime a tour is started
        this.timer = 0;

        // The actual speed factor, and speed factor as input by the user
        this.timerSpeed = 1.;
        this.timerSpeedInput = 0.;

        // List of tours {tourName:tourString}
        this.tours = {};

        // Tour editor (to create or edit tours)
        this.tourEditor = new LinusTourEditor(linus, gui);
        this.isShowingEditor = false;
    }

    /**
     * Add GUI elements of tour module
     */
    create()
    {
        var editorLinkHolder = document.createElement("div");
        editorLinkHolder.setAttribute("id", "editorLinkHolder");
        var editorLink = document.createElement("a");
        editorLink.innerHTML = "&bull; Open tour editor";
        editorLink.href = "#";
        editorLink.id = "tourEditorButton";
        editorLink.onclick = this.showTourEditor.bind(this);
        this.gui.addChild(editorLink);

        this.gui.addFloat("Tour speed", -10, 10, 0, function (val) { this.setTourSpeed(val) }.bind(this), false)
        var tourList = document.createElement("div");
        tourList.setAttribute("id", "tourList");

        var isAnyTourLoaded = false;

        for (var id in this.tours) {
            console.log("Add tour", id)
            var tourLink = document.createElement("a");
            var p = { context: this, id: id };
            tourLink.onclick = function () { this.context.startOrLoadTour(this.id, false); }.bind(p);
            tourLink.innerHTML = "&bull;  " + id + "<br />";
            tourLink.href = "#";
            tourList.appendChild(tourLink);
            isAnyTourLoaded = true;
        }

        if (isAnyTourLoaded) {
            var editorHeadline = document.createElement("span");
            editorHeadline.innerHTML = "Start a tour:";
            editorHeadline.id = "tourEditorHeadline";
            this.gui.addChild(editorHeadline);
        }

        this.gui.addChild(tourList);
    }

    changeStartTourHeadline(text)
    {
        var e = document.getElementById("tourEditorHeadline")
        if (e !== null)
            e.innerHTML = text;
    }

    /**
     * Remove (destroy) the tour editor button (forever)
     */
    hideTourEditorLink()
    {
        var e = document.getElementById("tourEditorButton");
        e.parentElement.removeChild(e);
    }

    /**
     * Opens the editor for a tour
     */
    showTourEditor()
    {
        if (this.isShowingEditor)
            return;

        this.changeStartTourHeadline("Add tour to editor:");
        this.isShowingEditor = true;
        this.hideTourEditorLink();
        this.tourEditor.create();
    }

    /**
     * Add a tour. Provide the function name as string.
     */
    addTour(name, tourString)
    {
        this.tours[name] = tourString;
        if (this.isShowingEditor) {
            this.tourEditor.loadTour(tourString);
        }
    }

    /**
     * Changes the speed of the tour. Default is 0. Value 1, 2, 3, ...
     * mean 2, 3, 4 times the speed, values -1, -2, -3 mean 1/2, 1/3, 
     * 1/4 times the speed.
     */
    setTourSpeed(v)
    {
        this.timerSpeedInput = v;
    }

    /**
     * Resets the counter for a tour (0 means "now").
     * Always for a new tour, the counter must be set to 0.
     */
    resetTourTimer()
    {
        this.timer = 0;
        var v = this.timerSpeedInput;

        // Input is a number between -10 and 10.
        // 1 should make it twice as quick
        // -1 should make it half as quick
        // 0 no changes
        // ... that's why we do this:
        if (v >= 0) {
            this.timerSpeed = 1. / (v + 1);
        }
        else {
            this.timerSpeed = Math.abs(v - 1);
        }
        console.log("Timer speed:", this.timerSpeed)
    }

    /**
     * Show the tour menu, e.g. after a tour is done
     */
    showMenu()
    {
        setTimeout(function () { this.gui.unhide() }.bind(this), this.timer);
    }

    /**
     * Starts the tour or opens it in editor, depending on the fact
     * whether editor is open or not
     */
    startOrLoadTour(name, repeat = true)
    {
        if (this.isShowingEditor)
            this.tourEditor.loadTour(this.tours[name])
        else
            this.startTour(name, repeat)
    }

    /**
     * Opens a tour from the internal tour list. The tour is compiled
     * line by line. Each line contains the command for one of the following:
     * - change of setting
     * - change of camera
     * - a selection of items
     * - an annotation
     * 
     * If the tour should be repeated, this function will re-call itself.
     */
    startTour(name, repeat = true)
    {
        console.log("Tour", name);
        var tourString = this.tours[name];
        this.resetTourTimer();
        this.gui.hide();
        var tourCommands = tourString.split("\n");
        for (var i = 0; i < tourCommands.length; i++) {
            console.log(tourCommands[i]);
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

                this.moveCameraTo(delay, x, y, z, upX, upY, upZ, duration)
            }
            else if (action === "fade") {
                var setting = c[2];
                var value = c[3];
                var duration = parseFloat(c[4]);
                value = isNaN(value) ? value : parseFloat(value);
                this.fadeParameter(delay, setting, value, duration)
            }
            else if (action === "marker") {
                var coords = c[2].split(",");
                var x = parseFloat(coords[0]);
                var y = parseFloat(coords[1]);
                var z = parseFloat(coords[2]);
                var text = c[3];
                var duration = parseFloat(c[4]);

                this.addMarker(delay, x, y, z, text, duration)
            }
            else if (action === "selection") {
                this.setSelection(delay, JSON.parse(c[2]))
            }
        }
        if (repeat && this.timer > 0) { setTimeout(function () { this.startTour(name) }.bind(this), this.timer) } else { this.showMenu(); }
    }

    /**
     * Tour: add marker showing text at 3D position x/y/z (mapped to 2D)
     */
    addMarker(delay, x, y, z, text, timespan)
    {
        this.timer += delay * 1000. * this.timerSpeed;
        let p = {}
        p.x = x;
        p.y = y;
        p.z = z;
        p.name = Math.random();
        p.text = text;
        p.context = this.linus;
        setTimeout(function (p) { p.context.addAnnotation(p.name, p.x, p.y, p.z, p.text); }, this.timer, p);
        setTimeout(function (p) { p.context.removeAnnotation(p.name); }, this.timer + timespan * 1000. * this.timerSpeed, p);
        this.timer += timespan * 1000 * this.timerSpeed;
    }

    /**
     * Tour: Remove marker with specific name
     */
    removeMarker(delay, name)
    {
        this.timer += delay * 1000. * this.timerSpeed;
        let p = {}
        p.name = name;
        p.context = this
        setTimeout(function (p) { p.context.removeAnnotation(p.name); }, this.timer, p);
    }

    /**
     * Tour: Set a value in the GUI (directly, no transition)
     */
    setParameter(delay, name, to)
    {
        this.timer += delay * 1000 * this.timerSpeed;
        let p = {}
        p["name"] = name;
        p["value"] = to;
        p.gui = this.gui;
        setTimeout(function (p) { p.gui.setValue(p.name, p.value); }, this.timer, p);
    }

    /**
     * Tour: Select items. The selection map contains the IDs of all items
     * to be shown 
     */
    setSelection(delay, selectionMap)
    {
        console.log(selectionMap)
        this.timer += delay * 1000 * this.timerSpeed;
        let p = {}
        p.value = selectionMap;
        p.context = this.linus
        setTimeout(function (p) { p.context.hideAllButSelected(p.value) }, this.timer, p);
    }

    /**
     * Tour: Set a value in the GUI (directly, no transition)
     */
    clearSelection(delay)
    {
        this.timer += delay * 1000 * this.timerSpeed;
        let p = {}
        p.context = this.linus
        setTimeout(function (m) { p.context.makeAllElementsVisible() }, this.timer, p);
    }

    /**
     * Smoother rotations
     */
    moveCameraAroundY(delay, timespan)
    {
        this.timer += delay * 1000 * this.timerSpeed;
        let p = {}
        p.timespan = timespan * this.timerSpeed;
        p.context = this.linus
        setTimeout(function (p) { p.context.moveCameraAroundYHelper(p); }, this.timer, p)
        this.timer += timespan * 1000 * this.timerSpeed;
    }

    /**
     * Tour: helper that gets called after the user-specified delay
     */
    moveCameraAroundYHelper(p)
    {
        var fps = 30;
        var angle = Math.atan(p.context.camera.position.x, p.context.camera.position.z);
        var radius = Math.sqrt(p.context.camera.position.x * p.context.camera.position.x + p.context.camera.position.z * p.context.camera.position.z);
        console.log("Start angle ", angle);
        console.log("Radius, ", radius);
        var numSteps = p.timespan * fps;
        var runningAngle = 0;
        for (var i = 0; i < numSteps; i++) {
            runningAngle = angle + i / numSteps * 2. * 3.142;
            let pp = {}
            pp.name = p.name;
            pp.context = p.context;
            pp.x = radius * Math.sin(runningAngle)
            pp.y = p.context.camera.position.y
            pp.z = radius * Math.cos(runningAngle)
            setTimeout(function (p) { p.context.camera.position.set(p.x, p.y, p.z); p.context.camera.lookAt(new Vector3(0, 0, 0)); }, i * (1000 / fps), pp);
        }
    }

    /**
     * Tour: move the camera to x,y,z (linear interpolation) 
     */
    moveCameraTo(delay, x, y, z, upX, upY, upZ, timespan)
    {
        this.timer += delay * 1000 * this.timerSpeed;
        let p = {}
        p.name = name
        p.x = x
        p.y = y
        p.z = z
        p.upX = upX
        p.upY = upY
        p.upZ = upZ
        p.timespan = timespan * this.timerSpeed;
        p.context = this;
        p.linus = this.linus;
        setTimeout(function (p) { p.context.moveCameraHelper(p); }, this.timer, p)
        this.timer += timespan * 1000 * this.timerSpeed;
    }

    /**
     * Tour: helper that gets called after the user-specified delay
     */
    moveCameraHelper(p)
    {
        var fromX = p.context.camera.position.x
        var fromY = p.context.camera.position.y
        var fromZ = p.context.camera.position.z
        var fromUpX = p.context.camera.up.x
        var fromUpY = p.context.camera.up.y
        var fromUpZ = p.context.camera.up.z
        var fps = 30;
        var numSteps = (fps * p.timespan)
        var x = (p.x - fromX) / numSteps;
        var y = (p.y - fromY) / numSteps;
        var z = (p.z - fromZ) / numSteps;
        var upX = (p.upX - fromUpX) / numSteps;
        var upY = (p.upY - fromUpY) / numSteps;
        var upZ = (p.upZ - fromUpZ) / numSteps;
        console.log("Up:", upX, upY, upZ);

        for (var i = 0; i < fps * p.timespan; i++) {
            let pp = {}
            pp.name = p.name;
            pp.context = p.context;
            pp.linus = p.linus;
            pp.x = fromX + i * x
            pp.y = fromY + i * y
            pp.z = fromZ + i * z
            pp.upX = fromUpX + i * upX
            pp.upY = fromUpY + i * upY
            pp.upZ = fromUpZ + i * upZ
            setTimeout(function (p) {
                p.linus.cameraUpdateCallback = function () {
                    p.linus.camera.position.set(p.x, p.y, p.z);
                    p.linus.camera.up.set(p.upX, p.upY, p.upZ);
                    p.linus.camera.lookAt(new Vector3(0, 0, 0));
                    p.linus.cameraUpdateCallback = function () { } // Self destruction to allow inputs from elsewhere
                }.bind(p)

            }, i * (1000. / fps), pp);
        }
        let pp = {}
        pp.name = p.name;
        pp.context = p.context;
        pp.linus = p.linus;
        pp.value = p.to
        pp.x = p.x
        pp.y = p.y
        pp.z = p.z
        pp.upX = p.upX
        pp.upY = p.upY
        pp.upZ = p.upZ
        setTimeout(function (p) {
            //console.log("set cam",p.x - p.context.camera.position.x, p.y - p.context.camera.position.y, p.z - p.context.camera.position.z);
            p.linus.cameraUpdateCallback = function () {
                p.linus.camera.position.set(p.x, p.y, p.z);
                p.linus.camera.up.set(p.upX, p.upY, p.upZ);
                p.linus.camera.lookAt(new Vector3(0, 0, 0));
                p.linus.cameraUpdateCallback = function () { } // Self destruction to allow inputs from elsewhere
            }.bind(p)

        }, p.timespan, pp);
    }

    /**
     * Tour: Fade a parameter value with the specified speed (change rate per second)
     */
    fadeParameter(delay, name, to, duration)
    {
        this.timer += delay * 1000 * this.timerSpeed;
        let p = {}
        p.name = name
        if (this.gui.types[p.name] == "float") {
            to = parseFloat(to)
        }
        else {
            duration = 0 // For select or colors -> no animation
        }
        p.to = to
        p.duration = duration * this.timerSpeed;
        p.context = this;
        p.gui = this.gui;
        setTimeout(function (p) { p.context.fadeParameterHelper(p); p.context.camera.lookAt(new Vector3(0, 0, 0)) }, this.timer, p)
        this.timer += duration * 1000 * this.timerSpeed;
    }

    /**
     * Tour: helper that gets called after the user-specified delay
     */
    fadeParameterHelper(p)
    {
        var from = p.gui.getValue(p.name);
        if (p.gui.types[p.name] == "float") {
            from = parseFloat(from)
        }
        var fps = 30;
        var numSteps = Math.max(0, (fps * p.duration))
        var stepsize = (p.to - from) / numSteps

        // The next loop should only be executed for fadeable parameters
        for (var i = 0; i < numSteps; i++) {
            let pp = {}
            pp.name = p.name;
            pp.gui = p.gui;
            pp.value = from + i * stepsize;
            setTimeout(function (p) { p.gui.setValue(p.name, p.value); }, i * fps, pp);
        }
        let pp = {}
        pp.name = p.name;
        pp.gui = p.gui;
        pp.value = p.to
        setTimeout(function (p) { p.gui.setValue(p.name, p.value); }, numSteps * fps, pp);
    }
}