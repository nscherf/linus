/**
 * Handles the toolbox to create a tour
 */
function LinusTourEditor(linus, gui)
{
    this.linus = linus;
    this.gui = gui;
    this.camera = linus.camera;
    this.tourCreatorCheckedSettings = {};
    this.tourChangeCounter = 0;
    
    /**
     * Creates the tour URL and displays it in the respective box
     */
    this.prepareTourUrl = function() 
    {
        var code = this.createTourCode();
        document.getElementById("resultBox").textContent = code;
        document.getElementById("resultBox").select();
    }

    /**
     * Creates the tour URL and displays it in the respective box
     */
    this.prepareTourQR = function() 
    {
        var code = this.createTourCode();
        var win = window.open("", "Tour", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=850,height=850");
        win.document.body.innerHTML = "<div id='qrcode'>&nbsp;</div>";
        win.document.title = "Tour";
        try {
            var qrcode = new QRCode(win.document.getElementById("qrcode"), {
                text: code,
                width: 800,
                height: 800,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.L
            });
        }
        catch(error) {
          console.error(error);
          win.document.body.innerHTML = "URL too long. Try to avoid selections or long annotations.";
        }    
    }

    /**
     * Create all elements for the tour editor and add it to the document
     */
    this.create = function() 
    {
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
        qrLink.href="#";
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

    /**
     * Converts all elements in the tour editor list into javascript function calls
     */
    this.createTourCode = function()
    {
        var source = ""
        var list = document.getElementById("tourCreatorList")
        var items = list.getElementsByTagName("li");
 
        for (var i = 0; i < items.length; ++i) 
        {
            var name = items[i].getElementsByClassName("tourItemName")[0].textContent
            var delay = items[i].getElementsByClassName("tourItemDelay")[0].value
            var duration = items[i].getElementsByClassName("tourItemDuration")[0].value
            var isActive = !items[i].getElementsByClassName("tourItemCheckbox")[0].parentElement.parentElement.classList.contains("tourItemDisabled")
            if(!isActive)
            {
                console.log("Skip element, it's inactive!")
                continue
            }
            

            if(items[i].getAttribute("name") == "tourChangeCamera")
            {
                var valueX = items[i].getElementsByClassName("tourItemCameraX")[0].value
                var valueY = items[i].getElementsByClassName("tourItemCameraY")[0].value
                var valueZ = items[i].getElementsByClassName("tourItemCameraZ")[0].value
                source += delay + "~camera~" + valueX + "," + valueY + "," + valueZ + "~" + duration + "\n";
            }
            else if(items[i].getAttribute("name") == "tourChangeMarker")
            {
                console.log("Add marker")
                var valueX = items[i].getElementsByClassName("tourItemMarkerX")[0].value
                var valueY = items[i].getElementsByClassName("tourItemMarkerY")[0].value
                var valueZ = items[i].getElementsByClassName("tourItemMarkerZ")[0].value
                var valueText = items[i].getElementsByClassName("tourItemMarkerText")[0].value
                source += delay + "~marker~" + valueX + "," + valueY + "," + valueZ + "~" + valueText + "~" + duration + "\n";
            }
            else if(items[i].getAttribute("name") == "tourChangeSelection")
            {
                console.log("Add Selection")
                var value = items[i].getElementsByClassName("tourItemSelectionValue")[0].value
                source += delay + "~selection~" + value + "\n"
            }
            else 
            {
                console.log(name)

                var value = items[i].getElementsByClassName("tourItemValue")[0].value
                source += delay + "~fade~" + "" + name + "~" + value + "~" + duration + "\n";
            }
        }
        var url = new URL(window.location.href);
        url.searchParams.delete("editor");
        url.searchParams.delete("tour");
        url.searchParams.append("tour", source)
        if(document.getElementById("autoStartCheckbox").checked) {
            url.searchParams.append("autoStartTour", "")
        }
        return url.toString();
    }

    /**
     * Loads a tourstring and fills the interface with these elements
     */
    this.loadTour = function(tourString) 
    {
        console.log("Load tour");
        var tourCommands = tourString.split("\n");
        for(var i = 0; i < tourCommands.length; i++)
        {
            console.log(tourCommands[i])
            var c = tourCommands[i].split("~");
            var delay = parseFloat(c[0]);
            var action = c[1];

            if(action === "camera")
            {
                var coords = c[2].split(",");
                var x = parseFloat(coords[0]);
                var y = parseFloat(coords[1]);
                var z = parseFloat(coords[2]);
                var duration = parseFloat(c[3]);
                this.addTourCamera(delay, x, y, z, duration);
            }
            else if(action === "fade")
            {
                var setting = c[2];
                var value = c[3];
                var duration = parseFloat(c[4]);
                value = isNaN(value) ? value : parseFloat(value);
                this.addTourChange(delay, setting, value, duration)
            }
            else if(action === "marker")
            {
                var coords = c[2].split(",");
                var x = parseFloat(coords[0]);
                var y = parseFloat(coords[1]);
                var z = parseFloat(coords[2]);
                var text = c[3];
                var duration = parseFloat(c[4]);

                this.addTourMarker(delay, x, y, z, text, duration)
            }
            else if(action === "selection")
            {
                this.addTourSelection(delay, c[2])
            }
        }
    }

    /**
     * Adds the current selection to the tour editor
     */
    this.addTourSelection = function(delay = null, selection = null, duration = null)
    {
        selection = selection == null ?  JSON.stringify(this.linus.getSelection()) : selection;
        var father = document.getElementById("tourCreatorList")
        var child = document.createElement("li")
        child.setAttribute("id", "tourChange"+this.tourChangeCounter)
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
        var sortable = new Sortable(father, {/*onMove: this.createTourCode,*/ animation: 150, handle: '.tourDragHandle'});
    }

    /**
     * Adds the current camera position to the tour editor
     */
    this.addTourCamera = function(delay = null, x = null, y = null, z = null, duration = null)
    {
        x = x == null ? this.camera.position.x : x;
        y = y == null ? this.camera.position.y : y;
        z = z == null ? this.camera.position.z : z;

        var father = document.getElementById("tourCreatorList")
        var child = document.createElement("li")
        child.setAttribute("id", "tourChange"+this.tourChangeCounter)
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

        this.tourChangeCounter++
        father.appendChild(child)
        var sortable = new Sortable(father, {/*onMove: this.createTourCode,*/ animation: 150, handle: '.tourDragHandle'});
    }

    /**
     * Adds a marker to the tour editor
     */
    this.addTourMarker = function(delay = null, x = null, y = null, z = null, text = null, duration = null)
    {
        x = x == null ? 0 : x;
        y = y == null ? 0 : y;
        z = z == null ? 0 : z;
        text = text == null ? "My marker content" : text;

        var father = document.getElementById("tourCreatorList")
        var child = document.createElement("li")
        child.setAttribute("id", "tourChange"+this.tourChangeCounter)
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
        var sortable = new Sortable(father, {/*onMove: this.createTourCode,*/ animation: 150, handle: '.tourDragHandle'});
    }

    /**
     * Have a look at all settings that have changed and add them to the tour editor
     */
    this.addTourState = function()
    {
        var keys = Object.keys(this.gui.values);
        for(var i = 0; i < keys.length; i++)
        {
            if(this.tourCreatorCheckedSettings[keys[i]] !== undefined)
            {
                if(this.tourCreatorCheckedSettings[keys[i]] != this.gui.values[keys[i]])
                {
                    console.log("Entry ", keys[i], " has changed")
                    this.addTourChange(null, keys[i], this.gui.values[keys[i]])
                }
            }
            else 
            {
                console.log("Entry ", keys[i], " is new")
                this.addTourChange(null, keys[i], this.gui.values[keys[i]])
            }
        }
        this.tourCreatorCheckedSettings = JSON.parse(JSON.stringify(this.gui.values))
    }
    
    /**
     *  Adds the change of a single parameter to the tour editor
     */
    this.addTourChange = function(delay = null, name = null, value = null, duration = null)
    {
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
        var sortable = new Sortable(father, {/*onMove: this.createTourCode,*/ animation: 150, handle: '.tourDragHandle'});
    }

    /**
     *  Creates the always-same basic elements: checkbox, delay, duration
     */
    this.createBasicTourElements = function(name, delay = null, duration = null, hideDuration = false)
    {
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
        input2.setAttribute("type", hideDuration? "hidden" : "number")
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
        if(!hideDuration) timer.appendChild(document.createElement("br"))
        if(!hideDuration) timer.appendChild(headline2)
        timer.appendChild(input2)
        if(!hideDuration) timer.appendChild(unit2)
        timer.appendChild(document.createElement("br"))

        return timer
    }
}