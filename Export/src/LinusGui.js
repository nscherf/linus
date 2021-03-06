/**
 * Constructs a GUI manager. Provides basic functionality like:
 * - adding settings for float, colors, selection
 * - defining callbacks for each setting
 * - adding custom HTML
 * - while settings must have unique names, the visible name is created by
 *   using a) the whole string if no "__" is part of the string
 *         b) if the name includes "__", only everything right of "__" is shown
 */
export default class LinusGUI {
    constructor() {
        // GUI metadata and settings
        this.elementCounter = 0;
        this.elementGroupCounter = 0;
        this.elementMap = [];
        this.types = {};
        this.values = {};
        this.defaultValues = {};
    }

    /**
     * Hide the GUI
     */
    hide() {
        document.getElementById("guiArea").classList.add("hideMe");
        document.getElementById("guiAreaToggle").classList.add("hideMe");
    }

    /**
     * Show the (currently hidden) GUI
     */
    unhide() {
        document.getElementById("guiArea").classList.remove("hideMe");
        document.getElementById("guiAreaToggle").classList.remove("hideMe");
    }

    /**
     * Creates the GUI container and basic contents
     */
    create() {
        let guiArea = document.createElement("div");
        guiArea.setAttribute("id", "guiArea");
        guiArea.setAttribute("class", "guiArea noSelect");
        document.body.appendChild(guiArea);

        let guiAreaToggle = document.createElement("div");
        guiAreaToggle.setAttribute("id", "guiAreaToggle");
        guiAreaToggle.setAttribute("class", "guiAreaToggle crossed");
        guiAreaToggle.onclick = this.toggle.bind(this);
        document.body.appendChild(guiAreaToggle);
    }

    /*
     * A medium-sized headline in the GUI. Automatically, all upcoming reguilar GUI elements (until the next
     * medium-sized headlines) will be grouped and minimized. A click on *this* headline will open them.
     */
    addHeadline(value) {
        this.elementGroupCounter += 1;
        let e = document.getElementById("guiArea");
        let headline = document.createElement("div");
        headline.textContent = value;
        headline.setAttribute("class", "guiHeadline");
        headline.setAttribute("id", "guiElemGroup" + this.elementGroupCounter);

        headline.onclick = function () {
            // The headline's ID is the same as the name of all children. We hence show/hide all
            // elements having a name that equals the headline's id
            this.classList.toggle("guiHeadlineOpened");
            document
                .getElementsByName(this.getAttribute("id"))
                .forEach(function (groupElement) {
                    groupElement.classList.toggle("hideGuiElement");
                });
        };

        e.appendChild(headline);
    }

    /**
     * Add a slider for floating point numbers
     */
    addFloat(name, min, max, value, callback, hide = true) {
        this.defaultValues[name] = value;
        this.elementMap[name] = this.elementCounter;
        this.types[name] = "float";
        let e = document.getElementById("guiArea");
        let line = document.createElement("div");
        line.setAttribute("class", "guiLine" + (hide ? " hideGuiElement" : ""));
        line.setAttribute("name", "guiElemGroup" + this.elementGroupCounter);

        let tagField = document.createElement("div");
        tagField.textContent = this.getDisplayName(name);
        tagField.setAttribute("class", "guiTag");
        let valueField = document.createElement("input");
        valueField.setAttribute("type", "number");
        valueField.value = value;
        valueField.setAttribute("class", "guiValueFloat");

        let slider = document.createElement("input");
        slider.setAttribute("id", "guiElem" + this.elementCounter);
        slider.setAttribute("type", "range");
        slider.setAttribute("min", min);
        slider.setAttribute("max", max);
        slider.setAttribute("step", (max - min) / 1000000000.0);
        slider.setAttribute("value", value);
        slider.setAttribute("class", "guiSlider");

        line.appendChild(tagField);
        line.appendChild(slider);
        line.appendChild(valueField);
        e.appendChild(line);

        valueField.addEventListener(
            "input",
            function () {
                this.values[name] = valueField.value;
                slider.value = valueField.value;
                callback(valueField.value);
                //valueField.blur() // Leave focus, otherwise selection cannot work
            }.bind(this),
            false
        );

        slider.addEventListener(
            "input",
            function () {
                this.values[name] = slider.value;
                valueField.value = slider.value;
                callback(slider.value);
                //slider.blur() // Leave focus, otherwise selection cannot work
            }.bind(this),
            false
        );

        this.elementCounter += 1;
    }

    /**
     * Add a dropdown selection
     */
    addSelection(name, values, selected, callback, hide = true) {
        this.defaultValues[name] = selected;
        this.elementMap[name] = this.elementCounter;
        this.types[name] = "select";
        let e = document.getElementById("guiArea");
        let line = document.createElement("div");
        line.setAttribute("class", "guiLine" + (hide ? " hideGuiElement" : ""));
        line.setAttribute("name", "guiElemGroup" + this.elementGroupCounter);

        let tagField = document.createElement("div");
        tagField.textContent = this.getDisplayName(name);
        tagField.setAttribute("class", "guiTag");

        let select = document.createElement("select");
        select.setAttribute("class", "guiSelect");
        select.setAttribute("id", "guiElem" + this.elementCounter);

        for (let i = 0; i < values.length; i++) {
            let option = document.createElement("option");
            option.textContent = values[i];
            if (i == selected) {
                option.setAttribute("selected", "selected");
            }
            select.appendChild(option);
        }

        line.appendChild(tagField);
        line.appendChild(select);
        e.appendChild(line);

        select.addEventListener(
            "change",
            function () {
                this.values[name] = select.selectedIndex;
                callback(select.selectedIndex);
            }.bind(this),
            false
        );
        this.elementCounter += 1;
    }

    /**
     * Add a color selection
     */
    addColor(name, value, callback, hide = true) {
        this.defaultValues[name] = value;
        this.elementMap[name] = this.elementCounter;
        this.types[name] = "color";
        let e = document.getElementById("guiArea");
        let line = document.createElement("div");
        line.setAttribute("class", "guiLine" + (hide ? " hideGuiElement" : ""));
        line.setAttribute("name", "guiElemGroup" + this.elementGroupCounter);

        let tagField = document.createElement("div");
        tagField.textContent = this.getDisplayName(name);
        tagField.setAttribute("class", "guiTag");

        let color = document.createElement("input");
        color.setAttribute("class", "guiColor");
        color.setAttribute("id", "guiElem" + this.elementCounter);
        color.setAttribute("value", value);
        color.setAttribute("type", "color");

        line.appendChild(tagField);
        line.appendChild(color);
        e.appendChild(line);

        color.addEventListener(
            "change",
            function () {
                this.values[name] = color.value;
                callback(color.value);
                //color.blur() // Leave focus, otherwise selection cannot work
            }.bind(this),
            false
        );
        this.elementCounter += 1;
    }

    /**
     * A large headline in the GUI
     */
    addMainHeadline(value) {
        let e = document.getElementById("guiArea");
        let headline = document.createElement("div");
        headline.textContent = value;
        headline.setAttribute("class", "guiMainHeadline");
        e.appendChild(headline);
    }

    /**
     * Add plain html source as one line into the GUI
     */
    addHtml(content) {
        let e = document.getElementById("guiArea");
        let line = document.createElement("div");
        line.setAttribute("class", "guiBlock");
        line.innerHTML = content;
        e.appendChild(line);
    }

    /**
     * Add DOM element into the GUI
     */
    addChild(e2) {
        let e = document.getElementById("guiArea");
        let line = document.createElement("div");
        line.setAttribute("class", "guiBlock");
        line.appendChild(e2);
        e.appendChild(line);
    }

    /**
     * Converts the GUI element's name to a string that is actually shown in the GUI.
     * The GUI elements must have unique (internal) names, which can be long or redundant
     * e.g. dataset_0_attribute_1_min. Plus, we allow to use "__" to separate internal
     * information from external names. Then dataset_0_attribute_1__min would only be
     * shown as "min" (= everything after __)
     */
    getDisplayName(name) {
        let splitted = name.split("__");
        if (splitted.length == 2) {
            return splitted[1];
        }
        return name;
    }

    /**
     * Closes or opens the menu (like minimizing, maximizing - not completely removing it!)
     */
    toggle() {
        document
            .getElementById("guiArea")
            .classList.toggle("guiAreaRestricted");
        document.getElementById("guiAreaToggle").classList.toggle("crossed");
    }

    loadDefaults() {
        for (let key in this.defaultValues) {
            console.log(key, this.defaultValues[key])
            this.setValue(key, this.defaultValues[key]);
        }
    }

    /**
     * Get value of a GUI element
     */
    getValue(name) {
        let id = "guiElem" + this.elementMap[name];
        if (this.types[name] == "select") {
            return document.getElementById(id).selectedIndex;
        }
        return document.getElementById(id).value;
    }

    hasChanged(name) {
        let value = this.getValue(name);
        if(this.types[name] == "select") {
            return value !== this.defaultValues[name];
        } else if(this.types[name] == "color") {
            return value !== this.defaultValues[name];
        }
        else {
            return Math.abs(this.defaultValues[name] - value) > 0.0001;
        }
        return false;
    }


    /**
     * Set value to GUI. After that, also trigger events to propagate
     * values to their destination.
     */
    setValue(name, value) {
        let id = "guiElem" + this.elementMap[name];
        if (this.types[name] == "select") {
            document.getElementById(id).selectedIndex = value;
        } // color, float
        else {
            document.getElementById(id).value = value;
            console.log(document.getElementById(id).value, value)
        }

        // Trigger both type of events that we actually use:
        // oninput e.g. for sliders, onchange e.g. for dropdown
        let eventInput = new Event("input", {
            bubbles: true,
            cancelable: true,
        });

        let eventChange = new Event("change");
        document.getElementById(id).dispatchEvent(eventInput);
        document.getElementById(id).dispatchEvent(eventChange);
    }

    /**
     * Sets the width of the GUI the a specified value [in pixels]
     */
    scale(size) {
        document.getElementById("guiArea").style.width = size + "px";
    }
}
