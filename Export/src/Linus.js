import {
    WebGLRenderer,
    TextureLoader,
    Quaternion,
    Vector3,
    Texture,
    Sprite,
    SpriteMaterial,
    AxesHelper,
    Matrix4,
    AlwaysDepth,
    DoubleSide,
    NormalBlending,
    Object3D,
    Mesh,
    LineSegments,
    Box3,
    BufferGeometry,
    Float32BufferAttribute,
    PerspectiveCamera,
    Scene,
    Uniform,
    Color,
    ShaderMaterial,
} from "../includes/three/three.js";
import { TrackballControls } from "../includes/three/TrackballControls.js";
import { default as Stats } from "../includes/three/stats.min.js";
import { VRButton } from "../includes/three/VRButton.js";
import { default as Pako } from "../includes/pako.js";
import { default as JSZip } from "../includes/jszip.min.js";
import ColorMaps from "./ColorMaps.js";
import Shaders from "./Shaders.js";
import ScreenCapture from "./ScreenCapture.js";
import ExportHandler from "./ExportHandler.js";

export default class Linus {
    constructor(gui) {
        // Script handling annotations. These are text boxes (divs) placed over the WebGL canvas at 2D
        // positions that correspond to the underlying 3D positions of interest.
        // These functions are required for the animation loop, hence they are introduced already here.

        // Holding objects with annotation information (position, name, html)
        this.annotations = [];
        this.gui = gui;

        // Several options for rendering/displaying GUI
        this.aa = false; // Use anti aliasing
        this.noGui = false; // Don't show GUI
        this.showFps = false; // Add a performance widget
        this.lod = 1; // Reduce the number of tracks to 1/lod (we draw item #i only when i%lod==0)
        this.sortFrequency = 0; // Encodes the frequency how often the item order is updated - see sortLineSegments()
        this.sortNeedShuffle = true; // Needed to shuffle render order once when we decide to NOT sort anymore (-> less regular artifacts)
        this.webVr = false; // Change camera and GUI (etc.) to comply with WebVR

        // A number of objects used by THREE.js.
        this.backgroundColor = 0xe2e2e2;
        this.line = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.vrControls = null;
        this.material = [];
        this.uniforms = [];
        this.bbox = null;
        this.container2 = null; // Here and below: second view port with inset (axes)
        this.renderer2 = null;
        this.scene2 = null;
        this.camera2 = null;
        this.axes2 = null;
        this.data = null;
        this.numGlPrimitives = 0;
        this.colorMapTextures = [];
        this.colorMapNames = ["Custom colors"];
        this.colorMaps = new ColorMaps().getColorMaps();
        this.shaders = new Shaders();
        this.exportHandler = new ExportHandler();
        this.screenCapture = new ScreenCapture(this.exportHandler);

        // Own helpers
        this.cameraUpdateCallback = function () { }; // A function that sets an updated camera position. Needed to avoid artifacts by parallelization
        this.recommendedScale = 1; // Dataset scale (will be set to something like 1 / width of dataset)
        this.setsAndStates = []; // Overview of all sets and their states of the imported data
        this.customUniforms = []; // Preprocessed information generated from the data set
        this.customAttributes = []; // Preprocessed information generated from the data set
        this.dataAttributes = []; // Preprocessed information generated from the data set
        this.currentSelection = {}; // A map containing IDs of all elements currently being part of user's selection
        this.actualTitle = ""; // Because we might change it; we store the title now

        // About sorting and the needs for updating the sort
        this.lastSort = 0; // Stores the last time the data has been depth-sorted
        this.sortForward = true;
        this.lastCamPos = new Vector3(0, 0, 0);
        this.lastCamPosUpdate = 0;
        this.sortedSinceLastCamPosUpdate = false;

        // Members related to selections
        this.div = null; // Selection box
        this.x1 = 0; // Selection box top-left/bottom-right coordinates
        this.y1 = 0;
        this.x2 = 0;
        this.y2 = 0;
        this.pressingButton = false; // Observer if trigger button is pressed
        this.clickingMouseButton = false; // Observer if mouse button is pressed
        this.webVrDisplacement = new Vector3(0, 1.5, -3);
        this.clickingVrOnCanvas = false; // Vr Mode: click on the canvas (only in "2D mode")
        this.clickingVrControllerButton = false; // Vr Mode: click a controller button (usually while being in the 3D environment)
        this.lastVrRotation = null; // Used to figure out motion and thus to rotate the observed object

        this.stats = null; // performance statistics widget
        // Note: if the following is changed, adjust the "magic number"! We must hardcode the size of this array to the shader.
        this.colorModeOptions = [
            "Solid",
            "Orientation xyz",
            "Orientation LonLat",
            "Orientation Lat",
            "Orientation Lon",
            "Depth",
            "Random",
        ];
        this.mercatorModeOptions = [];
        this.niceColors = new ColorMaps().getNiceColors();
        this.niceColorsCopy = []; // backup
    }
    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////// external access: setup and data

    // Setter for a data file that follows our JSON layout
    setData(data) {
        this.data = data;
    }

    // Setter for a data file that follows our JSON layout
    setVr(shouldEnable) {
        this.webVr = shouldEnable;
        if (shouldEnable) {
            this.backgroundColor = 0x111111;
        }
    }

    // Disable or enable anti aliasing
    setAA(shouldEnable) {
        this.aa = shouldEnable;
    }

    // Disable or enable user interface
    disableGUI(val) {
        this.noGui = val;
    }

    // Add a performance widget
    setShowFps(val) {
        this.showFps = val;
    }

    // Set the level of detail mode
    setLOD(val) {
        this.lod = val;
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////// Annotation and inset handling

    spriteBackgroundDrawer(ctx, wOriginal, hOriginal, rOriginal, upscale) {
        let w = wOriginal * upscale;
        let arrowBaseWidth = 20;
        let wArrowPos = (w - arrowBaseWidth) / 2;
        let arrowHeight = 30;
        let h = hOriginal * upscale;
        let r = rOriginal * upscale;
        let x = 0;
        let y = 0;
        console.log("Create sprite of size", w, h);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);

        ctx.lineTo(x + wArrowPos, y + h);
        ctx.lineTo(x + w / 2, y + h + arrowHeight);
        ctx.lineTo(x + w - wArrowPos, y + h);

        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    makeTextSprite(message, x, y, z) {
        let upscale = 2;
        let fontface = "Arial";
        let fontsize = 18;
        let backgroundColor = { r: 0, g: 0, b: 0, a: 0.5 };
        let textColor = { r: 255, g: 255, b: 255, a: 1.0 };
        let spacing = 10;
        let heightBuffer = 40; // used for down-pointing arrow
        let canvas = document.createElement("canvas");
        let context = canvas.getContext("2d");
        context.font = parseInt(fontsize) + "px " + fontface;
        console.log(context.font);
        let metrics = context.measureText(message);
        let textWidth = metrics.width;
        let backgroundWidth = parseInt(textWidth + 2 * spacing);
        let backgroundHeight = parseInt(fontsize * 1.4 + 2 * spacing);
        let totalWidth = backgroundWidth;
        let totalHeight = backgroundHeight + heightBuffer;
        canvas.width = totalWidth * upscale;
        canvas.height = totalHeight * upscale;
        console.log("metrics", metrics, canvas);

        context.font = parseInt(fontsize * upscale) + "px " + fontface;
        context.fillStyle =
            "rgba(" +
            backgroundColor.r +
            "," +
            backgroundColor.g +
            "," +
            backgroundColor.b +
            "," +
            backgroundColor.a +
            ")";
        context.strokeStyle = "rgba(0, 0, 0, 0)";

        context.lineWidth = 0;
        this.spriteBackgroundDrawer(
            context,
            backgroundWidth,
            backgroundHeight,
            8,
            upscale
        );

        context.fillStyle =
            "rgba(" +
            textColor.r +
            ", " +
            textColor.g +
            ", " +
            textColor.b +
            ", 1.0)";
        context.fillText(
            message,
            spacing * upscale,
            (fontsize + spacing) * upscale
        );

        let texture = new Texture(canvas);
        texture.needsUpdate = true;

        let spriteMaterial = new SpriteMaterial({
            map: texture,
            useScreenCoordinates: false,
            sizeAttenuation: false,
        });
        let sprite = new Sprite(spriteMaterial);
        let s = 0.001;
        sprite.scale.set(s * totalWidth, s * totalHeight, 1);
        let dataScale = this.data.sets[0].scale * this.getScale();
        console.log(dataScale);
        sprite.position.set(dataScale * x, dataScale * y, dataScale * z);
        if (this.webVr) {
            sprite.position.add(this.webVrDisplacement);
        }
        sprite.material.depthTest = false;
        return sprite;
    }

    // Name is a unique identifier
    // x, y, z are the 3d positions (which will be projected to the current 2D position on the canvas)
    addAnnotation(name, x, y, z, text) {
        let sprite = this.makeTextSprite(text, x, y, z);
        sprite.internalName = name;
        this.scene.add(sprite);
        let object = { name: name };
        this.annotations.push(object);
    }

    // Removes an annotation from DOM and from our list
    removeAnnotation(name) {
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            if (this.annotations[i].name == name) {
                console.log("Remove from array");
                // Remove the visiblity-class, leads to fading out slowly
                //this.annotations[i].domObject.classList.remove("annotationBoxVisible")
                // Remove it fully, but just after some seconds, so the fade out has finished at that time
                //setTimeout(function(e){ document.body.removeChild(e); }, 5000, this.annotations[i].domObject); // Any time, but longer than animation from style.css
                // However, this can be removed immediately (doesn't affect the DOM)
                this.annotations.splice(i, 1);
            }
        }

        for (let i = this.scene.children.length - 1; i > 0; i--) {
            if (this.scene.children[i].internalName !== undefined) {
                if (this.scene.children[i].internalName === name) {
                    this.scene.remove(this.scene.children[i]);
                }
            }
        }
        this.renderer.renderLists.dispose();
    }

    // Projects a 3D pos to the current 2D pos on the canvas
    toScreenXY(pos, camera, canvas) {
        let projScreenMat = new Matrix4();
        projScreenMat.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        );
        pos.applyMatrix4(projScreenMat);
        return {
            x:
                (((pos.x + 1) * canvas.width) / 2 + canvas.offsetLeft) /
                window.devicePixelRatio,
            y:
                (((-pos.y + 1) * canvas.height) / 2 + canvas.offsetTop) /
                window.devicePixelRatio,
        };
    }

    // Set labels for the axes tool
    setInsetLabels(x, y, z) {
        document.getElementById("insetLabelRed").innerHTML = x;
        document.getElementById("insetLabelGreen").innerHTML = y;
        document.getElementById("insetLabelBlue").innerHTML = z;
    }

    // Changes the inset's axes' labels according to current view mode
    // TODO: we currently only decide based on dataset 0's setting...
    updateInsetLabels() {
        if (this.gui.getValue("0_mercator__Level") < 0.5) {
            // TODO Anything smarter here?
            this.setInsetLabels("X", "Y", "Z");
        } else {
            let zLabel = "time";
            if (this.gui.getValue("0_mercator__z Mapping") == 1) {
                // TODO Anything smarter here?
                zLabel = "signal";
            } else if (this.gui.getValue("0_mercator__z Mapping") == 2) {
                zLabel = "angle to start";
            }
            this.setInsetLabels("long.", "lat.", zLabel);
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////// Array helpers

    // Creates an array of n times "elem"
    createFilledArray(elem, n) {
        let arr = [];
        for (let i = 0; i <= n; i++) {
            arr.push(elem);
        }

        return arr;
    }

    // Just a little helper to shuffle an array
    shuffle(a) {
        let j, x, i;
        for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }
        return a;
    }

    // Converts a trajectory to a list of tangents
    posToOrientation(positions, dim) {
        let result = new Array(positions.length);
        if (positions.length < 2 * dim) {
            return result.fill(0);
        }
        let debug = false;
        for (let i = 0; i < positions.length; i += dim) {
            let i1 = i == 0 ? 0 : i - dim;
            let i2 = i >= positions.length - dim ? i : i + dim;
            x = positions[i2] - positions[i1];
            y = dim >= 2 ? positions[i2 + 1] - positions[i1 + 1] : 0;
            z = dim >= 3 ? positions[i2 + 2] - positions[i1 + 2] : 0;

            l = Math.sqrt(x * x + y * y + z * z);
            if (l == 0) {
                //console.log("Zero length at index " + i)
                l = 1;
                x = result[i1 + 0];
                y = result[i1 + 1];
                z = result[i1 + 2];
                //console.log("Corrected to " + x + " " + y + " " + z)
                debug = true;
            }
            result[i] = x / l;
            if (dim >= 2) result[i + 1] = y / l;
            if (dim >= 3) result[i + 2] = z / l;
        }
        return result;
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////// Data loading and creation of shader source code

    // The actual program start, and start of the event loop
    start() {
        let testCanvas = document.createElement("canvas");
        if (
            !(
                window.WebGLRenderingContext &&
                (testCanvas.getContext("webgl") ||
                    testCanvas.getContext("experimental-webgl"))
            )
        ) {
            alert("Error - this browser does not support WebGL.");
        }
        this.actualTitle = document.title;
        this.niceColorsCopy = JSON.parse(JSON.stringify(this.niceColors));
        this.init();

        if (!this.webVr) {
            this.animateFrame(this); // without WEBVR: The traditional call
        } else {
            this.renderer.setAnimationLoop(
                function () {
                    this.animateFrame(this);
                }.bind(this)
            );
        }

        document.addEventListener(
            "keydown",
            this.onDocumentKeyDown.bind(this),
            false
        );
        document.addEventListener(
            "keyup",
            this.onDocumentKeyUp.bind(this),
            false
        );
        document.addEventListener(
            "scroll",
            this.onDocumentScroll.bind(this),
            false
        );

        return; // TODO
    }

    // Adds notes for a custom attribute to the list of attributes.
    // (Custom attribute means: something like meta data that is generated by this viewer. Let's call it "metadata".)
    addCustomAttribute(
        dataset,
        type,
        name,
        dependency,
        count,
        interpolate,
        normalize,
        shared
    ) {
        let i = this.customAttributes.length;
        for (let j = 0; j < i; j++) {
            if (
                this.customAttributes[j]["name"] == name &&
                this.customAttributes[j]["dataset"] == dataset
            ) {
                return; // Don't add twice
            }
        }
        this.customAttributes.push({});
        this.customAttributes[i].type = type;
        this.customAttributes[i].dataset = dataset;
        this.customAttributes[i].dependency = dependency;
        this.customAttributes[i].count = count;
        this.customAttributes[i].name = name;
        this.customAttributes[i].interpolate = interpolate;
        this.customAttributes[i].normalize = normalize;
        this.customAttributes[i].shared = shared;
    }

    // Gets the index of a data attribute based on its name (reverse index)
    getDataAttributeIndex(setId, name) {
        for (let i = 0; i < this.dataAttributes.length; i++) {
            if (
                this.dataAttributes[i].name == name &&
                this.dataAttributes[i].dataset == setId
            ) {
                return i;
            }
        }
        return -1;
    }

    // Adds preliminary notes for a new data attribute to the list of attributes.
    // (Data attribute means: something directly copied from the given data, like position.)
    addDataAttribute(dataset, name, dim, min, max, shared, fixedColor) {
        for (let i = 0; i < this.dataAttributes.length; i++) {
            if (
                this.dataAttributes[i].name == name &&
                this.dataAttributes[i].dataset == dataset
            ) {
                console.error(
                    "This attribute exists twice:",
                    name,
                    "of dataset",
                    dataset
                );

                return;
            }
        }
        let i = this.dataAttributes.length;
        let type = "float";
        if (dim == 2) {
            type = "vec2";
        } else if (dim == 3) {
            type = "vec3";
        }

        this.dataAttributes.push({});
        this.dataAttributes[i].type = type;
        this.dataAttributes[i].dataset = dataset;
        this.dataAttributes[i].dim = dim;
        this.dataAttributes[i].name = name;
        this.dataAttributes[i].shared = shared;
        this.dataAttributes[i].fixedColor = fixedColor;
        this.dataAttributes[i].min = min;
        this.dataAttributes[i].max = max;
    }

    // Adds preliminary notes for uniforms we want later to create inside the shader source code
    addCustomUniform(dataset, type, name, num, value) {
        for (let i = 0; i < this.customUniforms.length; i++) {
            if (
                this.customUniforms[i].name === name &&
                this.customUniforms[i].dataset === dataset
            ) {
                return;
            }
        }
        let newUniform = {};
        newUniform.dataset = dataset;
        newUniform.type = type;
        newUniform.name = name;
        newUniform.num = num;
        newUniform.value = value;
        this.customUniforms.push(newUniform);
    }

    // Alters the shader source: add a color mode for each attribute (e.g. colorize according to time point).
    addColorModesToShader(setId, shader) {
        console.log("Add color modes", this.dataAttributes);
        let nl = "\n" + Array(5).join(" ");
        let code = nl;
        let magicNumber = 7; // Assuming we already have n color modes, so we add a (n+1)th one here
        for (let i = 0; i < this.dataAttributes.length; i++) {
            if (this.dataAttributes[i].dataset !== setId) continue;
            let name = this.cleanVarName(this.dataAttributes[i].name);
            let lower = this.dataAttributes[i].fixedColor
                ? name + "Min"
                : "max(" + name + "Min, " + name + "From)";
            let upper = this.dataAttributes[i].fixedColor
                ? name + "Max"
                : "min(" + name + "To," + name + "Max)";
            code +=
                "else if(mode == " +
                (magicNumber + i) +
                ") {float t = (v" +
                this.capitalizeFirst(name) +
                " - " +
                lower +
                ") / (" +
                upper +
                " - " +
                lower +
                "); gl_FragColor.xyz = getColor(t, 1.).xyz;}" +
                nl;
        }
        shader = shader.replace("#colorModes#", code);
        return shader;
    }

    // Alters the shader source: add mercator height for each attribute (e.g. late time points -> higher peaks in mercator)
    addMercatorModesToShader(setId, shader) {
        let nl = "\n" + Array(5).join(" ");
        let code = nl;
        code += "if(false) {} " + nl; // Dummy - maybe something else?
        let magicNumber = 0; // Assuming we already have 0 mercator modes
        for (let i = 0; i < this.dataAttributes.length; i++) {
            if (this.dataAttributes[i].dataset !== setId) continue;

            let name = this.cleanVarName(this.dataAttributes[i].name);
            let lower = this.dataAttributes[i].fixedColor
                ? name + "Min"
                : "max(" + name + "Min, " + name + "From)";
            let upper = this.dataAttributes[i].fixedColor
                ? name + "Max"
                : "min(" + name + "To," + name + "Max)";
            code +=
                "else if(mercatorMode == " +
                (magicNumber + i) +
                ") {mercatorHeight = (v" +
                this.capitalizeFirst(name) +
                " - " +
                lower +
                ") / (" +
                upper +
                " - " +
                lower +
                ");}" +
                nl;
        }
        shader = shader.replace("#mercatorModes#", code);
        return shader;
    }

    // Alters the shader source: adds a (remove-)filter based on each attribute ("discard if not in user-specified range").
    addFilterToShader(setId, shader, indent) {
        console.log("Add filter to shader for dataset:", setId);
        let nl = "\n" + Array(indent + 1).join(" ");
        let newCode = nl;
        for (let i = 0; i < this.dataAttributes.length; i++) {
            if (this.dataAttributes[i].dataset !== setId) continue;
            console.log(
                "Add ",
                this.dataAttributes[i].name,
                " to dataset ",
                this.dataAttributes[i].dataset
            );

            let name = this.cleanVarName(this.dataAttributes[i].name);
            if (this.dataAttributes[i].dim == 1) {
                newCode +=
                    "if(v" +
                    this.capitalizeFirst(name) +
                    " < " +
                    name +
                    "From" +
                    " || v" +
                    this.capitalizeFirst(name) +
                    " > " +
                    name +
                    "To" +
                    ") {hideBecauseFilter = 1.;} " +
                    nl;
            }
        }

        shader = shader.replace("#attributeFilter#", newCode);
        return shader;
    }

    // Alters the shader source: add uniforms. Will also include color-related attributes, which are
    // needed for some color-related uniforms.
    addUniformsToShader(setId, shader) {
        let newCode = "\n";
        for (let i = 0; i < this.customUniforms.length; i++) {
            if (this.customUniforms[i].dataset !== setId) continue;

            let type = this.customUniforms[i].type;
            if (type == "color") {
                type = "vec3";
            }

            // The following is actually not yet supported in WebGL...
            let arrayExt = "";
            if (this.customUniforms[i].num > 1) {
                arrayExt = "[" + this.customUniforms[i].num + "]";
            }
            newCode +=
                "uniform " +
                type +
                " " +
                this.cleanVarName(this.customUniforms[i].name) +
                arrayExt +
                ";\n";
        }

        shader = shader.replace(
            "#colorDefinition#",
            this.createAttributeForShader(
                "colors",
                "vec3",
                "vSetId",
                this.setsAndStates.length,
                false,
                false,
                false,
                false,
                4,
                true
            )
        );
        shader = shader.replace("#genericUniforms#", newCode);

        return shader;
    }

    // Alters the shader source: varying for each vertex attribute
    addVaryingsToShader(setId, shader) {
        console.log("Add varyings to shader for dataset ", setId);
        let nl = Array(5).join(" ");
        let newCode = "\n";
        for (let i = 0; i < this.dataAttributes.length; i++) {
            if (this.dataAttributes[i].dataset !== setId) continue;

            let type = this.dataAttributes[i].type;
            if (type == "color") {
                type = "vec3";
            }
            newCode +=
                "varying " +
                type +
                " v" +
                this.capitalizeFirst(
                    this.cleanVarName(this.dataAttributes[i].name)
                ) +
                ";\n";
        }

        shader = shader.replace("#genericVaryings#", newCode);
        return shader;
    }

    addCustomAttributesToShader(setId, shader) {
        return this.addCustomAttributesToShaderStep(
            setId,
            false,
            this.addCustomAttributesToShaderStep(setId, true, shader)
        );
    }

    // Alters the shader source: interpolate state-specific attributes
    addCustomAttributesToShaderStep(setId, defineTypes, shader) {
        console.log("Call addCustomAttributesToShader for dataset ", setId);
        let newCode = "\n";
        let newCodeInterp = "\n";
        for (let i = 0; i < this.customAttributes.length; i++) {
            if (this.customAttributes[i].dataset !== setId) continue;
            console.log(
                "Handle attribute ",
                i,
                ", ",
                this.customAttributes[i].name
            );
            let name = this.cleanVarName(this.customAttributes[i].name);
            newCodeInterp += this.createAttributeForShader(
                name,
                this.customAttributes[i].type,
                this.customAttributes[i].dependency,
                this.customAttributes[i].count,
                this.customAttributes[i].shared,
                this.customAttributes[i].interpolate,
                this.customAttributes[i].normalize,
                true,
                4,
                defineTypes
            );

            if (this.customAttributes[i].shared) {
                newCode +=
                    "attribute " +
                    this.customAttributes[i].type +
                    " " +
                    name +
                    ";\n";
            } else {
                for (let j = 0; j < this.customAttributes[i].count; j++) {
                    newCode +=
                        "attribute " +
                        this.customAttributes[i].type +
                        " " +
                        name +
                        j +
                        ";\n";
                }
            }
        }

        shader = shader.replace(
            "#genericAttributeInterpolation#",
            newCodeInterp
        );
        shader = shader.replace("#genericAttributes#", newCode);
        return shader;
    }

    // Creates the source code for a shader. Especially it allows interpolation, if we have multiple states
    // of a dataset. Optionally, we can pass it as varying
    // E.g. if we have a dataset with 3 states, then the attribute "position" will result in:
    // - the three states, i.e. position1, position2, position3 (attributes)
    // - positionOut, which is placed inside the shader function. The value is interpolated from position1,
    //   position2, position3, according to the current user-selected state
    // - optionally, a pass to vPosition (however, it assumes this varying was created elsewhere!)
    createAttributeForShader(
        attName,
        attType,
        dependency,
        count,
        shared,
        interpolate,
        normalize,
        addVarying,
        indent,
        defineTypes
    ) {
        let nl = "\n" + Array(indent + 1).join(" ");
        let code = nl;
        if (shared) {
            code +=
                (defineTypes ? attType + " " : "") +
                attName +
                "Out = " +
                attName +
                ";\n";
        } else if (count == 1) {
            code +=
                (defineTypes ? attType + " " : "") +
                attName +
                "Out = " +
                attName +
                "0;\n";
        } else {
            code +=
                (defineTypes ? "int " : "") +
                attName +
                "Index = int(" +
                dependency +
                ");" +
                nl;
            code +=
                (defineTypes ? "float " : "") +
                attName +
                "Fade = " +
                dependency +
                " - float(" +
                attName +
                "Index);" +
                nl;
            code += (defineTypes ? attType + " " : "") + attName + "Out;" + nl;
            for (let i = 0; i < count; i++) {
                if (interpolate && i >= 1) {
                    code +=
                        "if(" +
                        dependency +
                        " < float(" +
                        i +
                        "))  {" +
                        attName +
                        "Out = (1. - " +
                        attName +
                        "Fade) * " +
                        attName +
                        (i - 1) +
                        " + " +
                        attName +
                        "Fade * " +
                        attName +
                        i +
                        ";} " +
                        nl +
                        " else  ";
                    if (i == count - 1) {
                        code +=
                            "{" + attName + "Out = " + attName + i + ";}" + nl;
                    }
                } else if (!interpolate) {
                    code +=
                        "if(int(" +
                        dependency +
                        ") == " +
                        i +
                        ")  {" +
                        attName +
                        "Out = " +
                        attName +
                        i +
                        ";}" +
                        nl;
                }
            }
        }

        // Every attribute is finally forwarded to the fragment shader
        if (addVarying)
            code +=
                "v" +
                this.capitalizeFirst(attName) +
                " = " +
                attName +
                "Out;" +
                nl;
        return code;
    }

    // Creates a nice name applicable as variable name for shader code
    cleanVarName(name) {
        // There should be more rules, I guess...
        let nameCleaned = name.replace(/[^A-Za-z0-9]/g, "");

        if (nameCleaned.match(/^\d/)) {
            let m =
                "Error! Attribute " +
                name +
                " must start with a non-numeric character.";
            alert(m);
            throw new Error(m);
        }
        return nameCleaned;
    }

    // Capitalizes only first word of a string
    capitalizeFirst(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // Currently "under construction". In general this function creates a single Object, like a line. However,
    // it might be necessary to subdivide the objects automatically (...)
    addDataHelperLines(i, k, dim, numStates) {
        let elementSize = dim; // for lines, and triangles, since "dim" (e.g. 3) values(x,y,z) must stay together
        let numElements = this.data.sets[i].states[0].positions[k].length / elementSize;
        let axesElements = 0;
        if(this.data.sets[i].axes !== undefined) {
            axesElements = this.data.sets[i].axes.length / elementSize;
            // console.log(JSON.string(this.data.sets[i]))
        }
        let numElementsWithAxes = numElements + axesElements;
        let geometry = new BufferGeometry();

        geometry.type = this.data.sets[i].type;
        geometry.originIndex = k;
        let setIds = this.createFilledArray(i, numElementsWithAxes - 1);
        let axeType = this.createFilledArray(0, numElements - 1);

        let drawIndexValues = JSON.parse(JSON.stringify(this.data.sets[i].entities[k]));
        let primitiveIndices = JSON.parse(JSON.stringify(this.data.sets[i].indices[k]));
        

        let positions = JSON.parse(JSON.stringify(this.data.sets[i].states[0].positions[k]));
        if(this.data.sets[i].axes !== undefined) {
            for (let axeItem = 0; axeItem < this.data.sets[i].axes.length / elementSize; axeItem++) {
                drawIndexValues.push(-1)
                axeType.push(1)
                for (let d = 0; d < dim; d++) {
                    positions.push(this.data.sets[i].axes[dim * axeItem + d])
                }
            }
            for (let axeItem = 0; axeItem < this.data.sets[i].axesIndices.length; axeItem++) {
                primitiveIndices.push(this.data.sets[i].axesIndices[axeItem] + numElements)
            }
        }

        geometry.setAttribute(
            "setId", 
            new Float32BufferAttribute(setIds, 1));

        geometry.setAttribute(
            "drawIndex",
            new Float32BufferAttribute(drawIndexValues, 1)
        );

        geometry.setAttribute(
            "axeType",
            new Float32BufferAttribute(axeType, 1)
        );

        // Make it twice (once here, once as attribute), otherwise three js problems
        geometry.setAttribute(
            "position",
            new Float32BufferAttribute(positions, dim)
        );


        geometry.setIndex(primitiveIndices);
        this.numGlPrimitives += primitiveIndices / 2;
/*
        console.log("--- Positions " )
        console.log(positions.length / dim)
        console.log(positions.join(", "))

        
        console.log("--- setIds " )
        console.log(setIds.length)
        console.log(setIds.join(", "))

        console.log("--- axeType " )
        console.log(axeType.length)
        console.log(axeType.join(", "))

        console.log("--- drawIndexValues " )
        console.log(drawIndexValues.length)
        console.log(drawIndexValues.join(", "))

        console.log("--- primitiveIndices ")
        console.log(primitiveIndices.length)
        console.log(primitiveIndices.join(", "))*/
        for (
            let j = 0;
            j < numStates;
            j++ 
        ) {
            let positionsState = JSON.parse(JSON.stringify(this.data.sets[i].states[j].positions[k]));

            if(this.data.sets[i].axes !== undefined) {
                for (let axePos = 0; axePos < this.data.sets[i].axes.length; axePos++) {
                    positionsState.push(this.data.sets[i].axes[axePos])
                }
            }

            let last = [];
            for (let l = positionsState.length - dim; l < positionsState.length; l++) {
                last.push(positionsState[l] + (positionsState[l] - positionsState[l - dim])); // It's a fake, one step further
            }

            geometry.setAttribute(
                "position" + j,
                new Float32BufferAttribute(positionsState, dim)
            );

            geometry.setAttribute(
                "nextPosition" + j,
                new Float32BufferAttribute(
                    positionsState.slice(dim).concat(last),
                    dim
                    )
                    );
            /*
            console.log("----- positionsState " + j)
            console.log(positionsState.length / dim)
            console.log(positionsState.join(", "))
            
            console.log("----- nextPosition " + j)
            console.log(positionsState.slice(dim).concat(last).length / dim)
            console.log(positionsState.slice(dim).concat(last).join(", "))
            */
            for (
                let a = 0;
                a < this.data.sets[i].states[j].attributes.length;
                a++
            ) {
                let aDim = this.data.sets[i].states[j].attributes[a].dim;
                let shared = this.data.sets[i].states[j].attributes[a].shared;
                let attName = this.data.sets[i].states[j].attributes[a].name;

                if (shared == true && j > 0) {
                    // Skip attributes if we share and have read the first one already.
                    // (We HAVE TO skip because maybe there are not even values for the subsequent ones.)
                    continue;
                }

                let values = JSON.parse(JSON.stringify(this.data.sets[i].states[j].attributes[a].values[
                    k
                ])); 

                if(this.data.sets[i].axes !== undefined) {
                    for (let axePos = 0; axePos < this.data.sets[i].axes.length / elementSize; axePos++) {
                        for(let fillDim = 0; fillDim < aDim; fillDim++) {
                            values.push(0)
                        }
                    }
                }

                if (shared == false) {
                    attName += j; // If we save all attributes, name them with number
                }
                geometry.setAttribute(
                    this.cleanVarName(attName),
                    new Float32BufferAttribute(values, aDim)
                );
                /*
                console.log("----- att " + this.cleanVarName(attName))
                console.log(values / dim)
                */
                let id = this.getDataAttributeIndex(
                    i,
                    this.data.sets[i].states[j].attributes[a].name
                );

                for (let vv = 0; vv < values.length; vv++) {
                    this.dataAttributes[id].min = Math.min(
                        this.dataAttributes[id].min,
                        values[vv]
                    );
                    this.dataAttributes[id].max = Math.max(
                        this.dataAttributes[id].max,
                        values[vv]
                    );
                }
                /*
                console.log("--- Attribute " + a)
                console.log(values.length)
                // console.log(values.join(", "))
                */
            }

        }

        // Create a unique id with setId_lineId
        geometry.totalLineId = [];
        for (let l = 0; l < this.data.sets[i].entities[k].length; l++) {
            geometry.totalLineId.push(
                i.toString() + "_" + this.data.sets[i].entities[k][l].toString()
            );
        }

        return geometry;
    }

    // Currently "under construction". In general this function creates a single Object, like a line. However,
    // it might be necessary to subdivide the objects automatically (...)
    addDataHelperTriangles(i, k, dim, numStates) {
        console.log("Entities of", i, this.data.sets[i].entities);
        let elementSize = dim; // for lines, and triangles, since "dim" (e.g. 3) values(x,y,z) must stay together
        let numElements =
            this.data.sets[i].states[0].positions[k].length / elementSize;
        let geometry = new BufferGeometry();
        geometry.type = this.data.sets[i].type;
        geometry.originIndex = k;

        let setIds = this.createFilledArray(i, numElements - 1);
        let drawIndexValues = JSON.parse(
            JSON.stringify(this.data.sets[i].entities[k])
        ); // this.createFilledArray(1, numElements - 1)

        geometry.setAttribute("setId", new Float32BufferAttribute(setIds, 1));
        geometry.setAttribute(
            "drawIndex",
            new Float32BufferAttribute(drawIndexValues, 1)
        );

        // Make it twice (once here, once as attribute), otherwise three js problems
        geometry.setAttribute(
            "position",
            new Float32BufferAttribute(
                this.data.sets[i].states[0].positions[k],
                dim
            )
        );
        geometry.setAttribute(
            "normalCustom",
            new Float32BufferAttribute(
                this.data.sets[i].states[0].normals[k],
                dim
            )
        );
        geometry.setIndex(this.data.sets[i].indices[k]);
        this.numGlPrimitives += this.data.sets[i].indices[k].length / 3;

        for (
            let j = 0;
            j < numStates;
            j++ // States, starting from 1!!!
        ) {
            let positions = this.data.sets[i].states[j].positions[
                k
            ]; /**.slice(dim * fr, dim * to)**/
            let last = [];
            for (let l = positions.length - dim; l < positions.length; l++) {
                last.push(positions[l] + (positions[l] - positions[l - dim])); // It's a fake, one step further
            }

            geometry.setAttribute(
                "position" + j,
                new Float32BufferAttribute(positions, dim)
            );

            for (
                let a = 0;
                a < this.data.sets[i].states[j].attributes.length;
                a++
            ) {
                let aDim = this.data.sets[i].states[j].attributes[a].dim;
                let values = this.data.sets[i].states[j].attributes[a].values[
                    k
                ]; /**.slice(aDim * fr, aDim * to)**/
                let shared = this.data.sets[i].states[j].attributes[a].shared;
                let attName = this.data.sets[i].states[j].attributes[a].name;

                if (shared == true && j > 0) {
                    // Skip attributes if we share and have read the first one already
                    continue;
                }
                if (shared == false) {
                    attName += j; // If we save all attributes, name them with number
                }
                geometry.setAttribute(
                    this.cleanVarName(attName),
                    new Float32BufferAttribute(values, aDim)
                );

                for (let vv = 0; vv < values.length; vv++) {
                    this.dataAttributes[a].min = Math.min(
                        this.dataAttributes[a].min,
                        values[vv]
                    );
                    this.dataAttributes[a].max = Math.max(
                        this.dataAttributes[a].max,
                        values[vv]
                    );
                }
            }
        }

        // Create a unique id with setId_triangleId
        geometry.totalLineId = [];
        for (let l = 0; l < this.data.sets[i].entities[k].length; l++) {
            geometry.totalLineId.push(
                i.toString() + "_" + this.data.sets[i].entities[k][l].toString()
            );
        }

        return geometry;
    }

    // Reads the data and builds up all the geometry
    preprocessData(data, i) {
        let dim = this.data.dim;
        let objects = [];

        this.setsAndStates.push({});
        this.setsAndStates[i].name = this.data.sets[i].name;
        this.setsAndStates[i].scale = this.data.sets[i].scale;
        this.setsAndStates[i].type = this.data.sets[i].type;
        this.setsAndStates[i].states = {};

        // Quickly look for some infos about the states
        let numStates = this.data.sets[i].states.length;
        for (
            let j = 0;
            j < numStates;
            j++ // States
        ) {
            this.setsAndStates[i].states[j] = this.data.sets[i].states[j].name;
        }

        // Collect some basic information about the optional attributes
        for (
            let a = 0;
            a < this.data.sets[i].states[0].attributes.length;
            a++
        ) {
            let aDim = this.data.sets[i].states[0].attributes[a].dim;
            let name = this.data.sets[i].states[0].attributes[a].name;
            let shared = this.data.sets[i].states[0].attributes[a].shared;
            let fixedColor = this.data.sets[i].states[0].attributes[a]
                .fixedColor;
            this.addDataAttribute(
                i,
                name,
                aDim,
                Number.MAX_SAFE_INTEGER,
                Number.MIN_SAFE_INTEGER,
                shared,
                fixedColor
            );
        }

        // Now we work on initial state (0) first and extend later on
        for (
            let k = 0;
            k < this.data.sets[i].states[0].positions.length;
            k++ // Objects
        ) {
            this.setStatus(
                0,
                this.data.sets[i].states.length *
                this.data.sets[i].states[0].positions.length,
                this.data.sets[i].states[0].positions.length * i + k,
                "Preparing data"
            );
            let geometry = null;
            if (this.data.sets[i].type === "triangles") {
                geometry = this.addDataHelperTriangles(i, k, dim, numStates);
            } else {
                //Lines
                geometry = this.addDataHelperLines(i, k, dim, numStates);
            }
            objects.push(geometry);
        }

        this.addCustomAttribute(
            i,
            "vec3",
            "position",
            "stateInternal",
            numStates,
            true,
            false,
            false
        );
        this.addCustomAttribute(
            i,
            "vec3",
            "nextPosition",
            "stateInternal",
            numStates,
            true,
            false,
            false
        );

        return objects;
    }

    // Checks the data's extra attributes (except for position/orientation) and creates variables for the shader
    processAttributes(setId) {
        for (let a = 0; a < this.dataAttributes.length; a++) {
            if (this.dataAttributes[a].dataset !== setId) continue;

            let aDim = this.dataAttributes[a].dim;
            let name = this.dataAttributes[a].name;
            let shared = this.dataAttributes[a].shared;
            let dataset = this.dataAttributes[a].dataset;
            let type = "";
            if (aDim == 1) {
                type = "float";
            }
            if (aDim == 2) {
                type = "vec2";
            }
            if (aDim == 3) {
                type = "vec3";
            }

            // For the shader source code
            this.addCustomAttribute(
                dataset,
                type,
                name,
                "state",
                this.dataAttributes.length,
                true,
                false,
                shared
            );
            this.addCustomUniform(
                dataset,
                type,
                name + "From",
                1,
                this.dataAttributes[a].min
            );
            this.addCustomUniform(
                dataset,
                type,
                name + "To",
                1,
                this.dataAttributes[a].max
            );
            this.addCustomUniform(
                dataset,
                type,
                name + "Min",
                1,
                this.dataAttributes[a].min
            );
            this.addCustomUniform(
                dataset,
                type,
                name + "Max",
                1,
                this.dataAttributes[a].max
            );

            // For the interface between graphics card and browser
            this.uniforms[this.dataAttributes[a].dataset][
                this.cleanVarName(this.dataAttributes[a].name + "From")
            ] = new Uniform(this.dataAttributes[a].min);
            this.uniforms[this.dataAttributes[a].dataset][
                this.cleanVarName(this.dataAttributes[a].name + "To")
            ] = new Uniform(this.dataAttributes[a].max);
            this.uniforms[this.dataAttributes[a].dataset][
                this.cleanVarName(this.dataAttributes[a].name + "Min")
            ] = new Uniform(this.dataAttributes[a].min);
            this.uniforms[this.dataAttributes[a].dataset][
                this.cleanVarName(this.dataAttributes[a].name + "Max")
            ] = new Uniform(this.dataAttributes[a].max);
        }
    }

    // Initialization of THREE.js
    init() {
        // Add additional elements to the screen
        document.body.innerHTML =
            document.body.innerHTML +
            `<div id="selectionBox" hidden></div>
            <div id="inset"></div>
            <div id="insetLabel">
                <span id="insetLabelRed">X</span>, 
                <span id="insetLabelGreen">Y</span>, 
                <span id="insetLabelBlue">Z</span>
            </div>`;

        this.initGl();
        this.initGui();
        this.screenCapture.init(this.renderer);
        this.div = document.getElementById("selectionBox");
        this.makeAllElementsVisible();
    }

    // Holds default values for the uniforms of a line geometry
    getLineUniforms() {
        return {
            alpha: new Uniform(0.1),
            mode: new Uniform(0),
            colorMapMode: new Uniform(0),
            colorMap: { value: 0 },
            axesTransparancy: new Uniform(1),
            axesColor: new Uniform(new Color(0x000000)),
            mercatorMode: new Uniform(0),
            mercatorRadius: new Uniform(0),
            lineColor: new Uniform(new Color(0xff003c)),
            primaryColor: new Uniform(new Color(0xe40e1a)),
            secondaryColor: new Uniform(new Color(0x0041df)),
            backgroundColor: new Uniform(new Color(this.backgroundColor)),
            defocusColor: new Uniform(new Color(0x888888)),
            defocusAlpha: new Uniform(0.02),
            defocusState: new Uniform(0.5),
            scale: new Uniform(1),
            colorScale: new Uniform(30),
            shading: new Uniform(0),
            glossiness: new Uniform(10),
            darkenInside: new Uniform(0),
            mercator: new Uniform(0),
            mercatorOffset: new Uniform(3.142 / 2),
            mercatorOffset2: new Uniform(0),
            mercatorOffset3: new Uniform(0),
            zLower: new Uniform(-99999),
            zUpper: new Uniform(99999),
            xLower: new Uniform(-99999),
            xUpper: new Uniform(99999),
            yLower: new Uniform(-99999),
            yUpper: new Uniform(99999),
            state: new Uniform(0),
            projLevel: new Uniform(0),
            projPlane: new Uniform(new Vector3(0, 0, 99999)),
            projPlaneN: new Uniform(new Vector3(0, 0, 1)),
        };
    }

    // Holds default values for the uniforms of a triangle geometry
    getTriangleUniforms() {
        return {
            alpha: new Uniform(0.1),
            mode: new Uniform(0),
            mercatorMode: new Uniform(0),
            mercatorRadius: new Uniform(0),
            lineColor: new Uniform(new Color(0xff003c)),
            primaryColor: new Uniform(new Color(0xe40e1a)),
            secondaryColor: new Uniform(new Color(0xffe100)),
            backgroundColor: new Uniform(new Color(this.backgroundColor)),
            defocusColor: new Uniform(new Color(0x888888)),
            defocusAlpha: new Uniform(0.02),
            defocusState: new Uniform(0.5),
            scale: new Uniform(1),
            colorScale: new Uniform(30),
            shading: new Uniform(0),
            glossiness: new Uniform(10),
            darkenInside: new Uniform(0),
            mercator: new Uniform(0),
            mercatorOffset: new Uniform(1.57079632),
            mercatorOffset2: new Uniform(0),
            mercatorOffset3: new Uniform(0),
            zLower: new Uniform(-99999),
            zUpper: new Uniform(99999),
            xLower: new Uniform(-99999),
            xUpper: new Uniform(99999),
            yLower: new Uniform(-99999),
            yUpper: new Uniform(99999),
            projLevel: new Uniform(0),
            projPlane: new Uniform(new Vector3(0, 0, 99999)),
            projPlaneN: new Uniform(new Vector3(0, 0, 1)),

            state: new Uniform(0),
        };
    }

    // Holds default values for the uniforms of a line geometry
    getLineMaterial(i) {
        return new ShaderMaterial({
            uniforms: this.uniforms[i],
            transparent: true,
            linewidth: 2,
            depthFunc: AlwaysDepth,
            blending: NormalBlending,
            fragmentShader: this.addVaryingsToShader(
                i,
                this.addFilterToShader(
                    i,
                    this.addColorModesToShader(
                        i,
                        this.addUniformsToShader(
                            i,
                            this.shaders.fragmentShader()
                        )
                    ),
                    4
                )
            ),
            vertexShader: this.addVaryingsToShader(
                i,
                this.addCustomAttributesToShader(
                    i,
                    this.addMercatorModesToShader(
                        i,
                        this.addUniformsToShader(
                            i,
                            this.shaders.vertexShaderLine()
                        )
                    )
                )
            ),
        });
    }
    // Holds default values for the uniforms of a triangle geometry
    getTriangleMaterial(i) {
        return new ShaderMaterial({
            uniforms: this.uniforms[i],
            transparent: true,
            depthFunc: AlwaysDepth,
            side: DoubleSide,
            blending: NormalBlending,
            fragmentShader: this.addVaryingsToShader(
                i,
                this.addFilterToShader(
                    i,
                    this.addColorModesToShader(
                        i,
                        this.addUniformsToShader(
                            i,
                            this.shaders.fragmentShader()
                        )
                    ),
                    4
                )
            ),
            vertexShader: this.addVaryingsToShader(
                i,
                this.addCustomAttributesToShader(
                    i,
                    this.addMercatorModesToShader(
                        i,
                        this.addUniformsToShader(
                            i,
                            this.shaders.vertexShaderTriangle()
                        )
                    )
                )
            ),
        });
    }

    initColormaps() {
        for (let name in this.colorMaps) {
            this.colorMapTextures.push(
                new TextureLoader().load(this.colorMaps[name])
            );
            this.colorMapNames.push(name);
        }
    }

    // "Low level" GL initialization and object creation. This function calls different helpers depending on
    // the geometry type.
    initGl() {
        this.renderer = new WebGLRenderer({
            antialias: this.aa,
            alpha: true,
            stencil: false,
            preserveDrawingBuffer: true,
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0.0);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.sortObjects = false;
        this.renderer.depthWrite = false;
        document.body.appendChild(this.renderer.domElement);
        this.initColormaps();
        this.scene = new Scene();

        this.camera = new PerspectiveCamera(
            40,
            window.innerWidth / window.innerHeight,
            1,
            1000
        );
        this.camera.position.set(0, 0, 2);

        // Note: these controls are used whenever we are not in VR. In VR, however, we keep the camera fixed
        // but we rotate the scene. The reason is that he user "is" the camera and can --- in theory --
        // move around.
        //this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);

        // Trackball controls could be nice, but they are currently not working, maybe a version mismatch?!
        this.controls = new TrackballControls(
            this.camera,
            this.renderer.domElement
        );
        this.controls.staticMoving = true;
        this.controls.dynamicDampingFactor = 0;
        this.controls.rotateSpeed = 2.0;
        this.controls.noPan = true;

        /*
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 0.8;
        this.controls.keys = [ 65, 83, 68 ];
        this.controls.addEventListener( 'change', this.render );
        */

        if (this.webVr) {
            this.renderer.xr.enabled = true;
            this.vrControls = this.renderer.xr.getController(0);
            this.vrControls.addEventListener(
                "selectstart",
                this.onVrSelectStart.bind(this)
            );
            this.vrControls.addEventListener(
                "selectend",
                this.onVrSelectEnd.bind(this)
            );
            document.body.appendChild(VRButton.createButton(this.renderer));
            this.controls.enabled = false;
        }
        this.controls.minDistance = 0;
        this.controls.maxDistance = 5000;

        // Give everything to the THREE scene, but create a father, which is used to scale the whole scene
        let father = new Object3D();
        father.name = "father";

        // All the static uniforms
        if (typeof this.data == "string") {
            //alert("Data looks zipped. This saves 90% of traffic but takes some seconds extra to unzip.");
            this.data = JSON.parse(
                Pako.inflate(atob(this.data), { to: "string" })
            );
            console.log("Inflating object done");
        }

        console.log(this.data);
        for (let i = 0; i < this.data.sets.length; i++) {
            // Create basic uniforms. They will be complemented by data-specific uniforms.
            if (this.data.sets[i].type == "triangles") {
                this.uniforms[i] = this.getTriangleUniforms();
            } else {
                this.uniforms[i] = this.getLineUniforms();
            }

            // Prepare the data
            let objects = this.preprocessData(this.data, i);
            this.processAttributes(i);

            // The material (shaders...) must be created after the data has been analyzed!
            if (this.data.sets[i].type == "triangles") {
                this.material[i] = this.getTriangleMaterial(i);
            } else {
                this.material[i] = this.getLineMaterial(i);
            }

            // Finally, add the geometry to the scene
            for (let j = 0; j < objects.length; j++) {
                let mesh = null;
                if (objects[j].type === "triangles") {
                    mesh = new Mesh(objects[j], this.material[i]);
                } else {
                    mesh = new LineSegments(objects[j], this.material[i]);
                }
                mesh.sortObjects = false;
                mesh.depthWrite = false;
                mesh.frustumCulled = false;
                mesh.selectable = this.data.sets[i].selectable;
                father.add(mesh);
            }
        }

        this.setStatus(0, 1, 1); // We are done

        // For webVr, move the scene into "head height" (something like 1.50m => y = 1.5)
        if (this.webVr) {
            father.position.add(this.webVrDisplacement);
        }

        this.scene.add(father);
        /*
        // DEBUG camera
        let geometry1 = new SphereGeometry( 0.2, 32, 32 );
        let material1 = new MeshBasicMaterial( {color: 0xffff00} );
        let sphere1 = new Mesh( geometry1, material1 );
        sphere1.position.add(this.webVrDisplacement)
        sphere1.position.add(new Vector3(0,0,-1))
        this.scene.add( sphere1 );
        */

        // Get extent of current data and set scale to make it fit the screen
        this.bbox = new Box3().setFromObject(father);
        this.recommendedScale = 2 / (this.bbox.max.x - this.bbox.min.x);
        this.setScale(this.recommendedScale);

        // Here we can find literally everything, in case we have to debug
        console.log("THIS:", this);

        // Have a look on the shaders immediately before rendering is performed (to see latest changes on shaders)
        //scene.children[0].onBeforeRender ( renderer, scene, camera, geometry, material, group ) {
        //    console.log(material.vertexShader); console.log(material.fragmentShader)        };

        // Add event listener, performance tool, GUI
        window.addEventListener(
            "resize",
            this.onWindowResize.bind(this),
            false
        );
        this.onWindowResize();
        this.stats = new Stats();

        if (this.noGui) {
            this.gui.hide();
        }

        if (this.showFps) {
            document.body.appendChild(this.stats.dom);
        }

        this.initInset();
    }

    // Add inset to the document
    initInset() {
        this.container2 = document.getElementById("inset");
        this.renderer2 = new WebGLRenderer({ antialias: true, alpha: true });
        this.renderer2.setClearColor(0xf0f0f0, 0);
        this.renderer2.setSize(
            document.getElementById("inset").offsetWidth,
            document.getElementById("inset").offsetHeight
        );

        // The inset doesn't make sense for VR since the camera is not moved there (only the objects). And we don't see it, since
        // the user can only "dive into one 3D canvas" anyway
        if (!this.webVr) {
            this.container2.appendChild(this.renderer2.domElement);
        } else {
            document.getElementById("insetLabel").className += " hideMe";
        }

        this.scene2 = new Scene();
        this.camera2 = new PerspectiveCamera(
            50,
            document.getElementById("inset").offsetWidth /
            document.getElementById("inset").offsetHeight,
            0.1,
            1000
        );
        this.camera2.up = this.camera.up; // important!

        // axes
        this.axes2 = new AxesHelper(0.81);
        let colors = this.axes2.geometry.attributes.color;
        colors.setXYZ(0, 1.0, 0.1, 0.1); // index, R, G, B
        colors.setXYZ(1, 1.0, 0.1, 0.1); // red
        colors.setXYZ(2, 0.2, 0.8, 0.1);
        colors.setXYZ(3, 0.2, 0.8, 0.1); // green
        colors.setXYZ(4, 0.1, 0.4, 1);
        colors.setXYZ(5, 0.1, 0.4, 1); // blue
        this.axes2.material.linewidth = 2;
        this.scene2.add(this.axes2);
        this.doneLoading();
    }

    // Getter for scale of 3D objects. TODO: currently just returns scale of first child.
    // However, we aim to keep scale the same for all children anyway
    getScale() {
        return this.scene.children[0].scale.x;
    }

    // Sets scale to all objects of scene
    setScale(s) {
        for (let i = 0; i < this.scene.children.length; i++) {
            this.scene.children[i].scale.set(s, s, s);
        }
    }

    // Update camera and viewport when window size changes
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Animation loop. Gets new frame, moves annotations
    animateFrame() {
        this.stats.update();
        this.sortSegments();
        this.cameraUpdateCallback(); // Camera changes are in here and called now to avoid synchronization problems
        this.renderer.setClearColor(this.backgroundColor, 1);
        this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        this.camera.updateProjectionMatrix();
        this.renderer.render(this.scene, this.camera);

        // Inset
        this.camera2.position.copy(this.camera.position);
        this.camera2.position.sub(this.controls.target);
        this.camera2.position.setLength(2);
        this.camera2.lookAt(this.scene2.position); // Copy perspective from main camera
        this.renderer2.render(this.scene2, this.camera2);

        if (!this.webVr) {
            requestAnimationFrame(this.animateFrame.bind(this)); // without WEBVR: add this line
            this.controls.update();
        }
    }

    mergeSort(array, comparefn) {
        function merge(arr, aux, lo, mid, hi, comparefn) {
            let i = lo;
            let j = mid + 1;
            let k = lo;
            while (true) {
                let cmp = comparefn(arr[i], arr[j]);
                if (cmp <= 0) {
                    aux[k++] = arr[i++];
                    if (i > mid) {
                        do aux[k++] = arr[j++];
                        while (j <= hi);
                        break;
                    }
                } else {
                    aux[k++] = arr[j++];
                    if (j > hi) {
                        do aux[k++] = arr[i++];
                        while (i <= mid);
                        break;
                    }
                }
            }
        }

        function sortarrtoaux(arr, aux, lo, hi, comparefn) {
            if (hi < lo) return;
            if (hi == lo) {
                aux[lo] = arr[lo];
                return;
            }
            let mid = Math.floor(lo + (hi - lo) / 2);
            sortarrtoarr(arr, aux, lo, mid, comparefn);
            sortarrtoarr(arr, aux, mid + 1, hi, comparefn);
            merge(arr, aux, lo, mid, hi, comparefn);
        }

        function sortarrtoarr(arr, aux, lo, hi, comparefn) {
            if (hi <= lo) return;
            let mid = Math.floor(lo + (hi - lo) / 2);
            sortarrtoaux(arr, aux, lo, mid, comparefn);
            sortarrtoaux(arr, aux, mid + 1, hi, comparefn);
            merge(aux, arr, lo, mid, hi, comparefn);
        }

        function merge_sort(arr, comparefn) {
            let aux = arr.slice(0);
            sortarrtoarr(arr, aux, 0, arr.length - 1, comparefn);
            return arr;
        }

        return merge_sort(array, comparefn);
    }

    // The sorting only considers start point of line. This can cause artifacts for sparse lines. However,
    // best way to avoid artifacts would be to provide more supporting points in the line (=> resampling).
    // After a full run of this function, all elements are sorted. To avoid sorting in this frame, we must
    // return early, which we e.g. do depending on time or camera motion (to increase the framerate)
    sortSegments() {
        // Stop sorting based on the time criterion, or when we we do not want to sort
        if (
            (this.sortFrequency == 4 && this.sortNeedShuffle == false) ||
            (this.sortFrequency == 3 && Date.now() - this.lastSort < 5000) ||
            (this.sortFrequency == 2 && Date.now() - this.lastSort < 1000)
        ) {
            return;
        }

        // Stop sorting whenever we are still in the motion process
        let camPos = new Vector3(0, 0, 1000)
            .unproject(this.camera)
            .divideScalar(this.getScale());
        if (this.webVr) {
            // TODO Actually we must consider both camera and rotation for webvr!
            let rotation = new Quaternion();
            rotation = this.scene.children[0].getWorldQuaternion(rotation);
            rotation = rotation.inverse(rotation);
            camPos = new Vector3(0, 0, -5);
            camPos.applyQuaternion(rotation);
            //camPos.add(this.webVrDisplacement)
            /*
            // DEBUG: Camera
            this.scene.children[1].position.set(0,0,0)
            this.scene.children[1].position.add(new Vector3(0,0,-5))
            this.scene.children[1].position.applyQuaternion(rotation)
            this.scene.children[1].position.add(this.webVrDisplacement)
            console.log("Distance:", this.scene.children[1].position.distanceTo(this.camera.position))
            */
        }
        if (
            this.sortFrequency == 0 &&
            camPos.distanceTo(this.lastCamPos) > 0.0
        ) {
            // If camera has moved
            this.lastCamPos = camPos;
            this.lastCamPosUpdate = Date.now();
            this.sortedSinceLastCamPosUpdate = false;
            return; // Don't update render order while being on motion!
        }
        // Camera has not moved for LESS than a (0.3) second OR we already updated everything: also return
        else if (
            this.sortFrequency == 0 &&
            (this.sortedSinceLastCamPosUpdate ||
                Date.now() - this.lastCamPosUpdate < 300)
        ) {
            return;
        }

        let t0 = performance.now();
        let t0a = 0;

        // If we made it until here, we will finally sort the scene
        for (let i = 0; i < this.scene.children.length; i++) {
            for (let j = 0; j < this.scene.children[i].children.length; j++) {
                if (
                    this.scene.children[i].children[j].geometry.index === null
                ) {
                    //console.log("Skip unsortable elements (=no index list used)")
                    continue;
                }

                let ind = this.scene.children[i].children[j].geometry.index
                    .array; // assignment just for convenience
                let indCopy = ind.slice(0);
                let pos = this.scene.children[i].children[j].geometry.attributes
                    .position.array; // TODO: or any pos1,2,...
                let elementSize =
                    this.scene.children[i].children[j].type == "Mesh" ? 3 : 2;
                let distances = new Float32Array(ind.length / elementSize); // Multiple indices represent one primitive. We only consider first for sorting.
                let cur = -1;
                // Calculate squared distance cam--point for all starting points
                for (let k = 0; k < distances.length; k++) {
                    cur = 3 * ind[elementSize * k];
                    distances[k] =
                        Math.pow(pos[cur] - camPos.x, 2) +
                        Math.pow(pos[cur + 1] - camPos.y, 2) +
                        Math.pow(pos[cur + 2] - camPos.z, 2);
                }
                t0a = performance.now();

                // Retrieve a sorted index list from the list of distances (as described in:
                // https://stackoverflow.com/questions/3730510/javascript-sort-array-and-return-an-array-of-indicies-that-indicates-the-positi )
                let sorted = new Int32Array(distances.length);
                for (let l = 0; l < distances.length; ++l) sorted[l] = l;

                if (this.sortFrequency == 4) {
                    // Case "4", no sorting. If we made it to here, we want to shuffle
                    sorted = this.shuffle(sorted);
                    this.sortNeedShuffle = false;
                } else {
                    // Case: actual sorting.

                    // Next: we define a sort function that puts the most distant first and the closest last
                    if (this.sortForward && !this.webVr) {
                        //sorted.sort(function (a, b) {return distances[b] - distances[a]; });
                        sorted.sort(function (a, b) {
                            return distances[a] > distances[b]
                                ? -1
                                : distances[a] < distances[b]
                                    ? 1
                                    : 0;
                        });
                        //this.mergeSort(sorted, function (a, b) {return distances[a] > distances[b] ? -1 : 1; })
                    } else {
                        //sorted.sort(function (a, b) {return distances[a] - distances[b]; });
                        sorted.sort(function (a, b) {
                            return distances[a] < distances[b]
                                ? -1
                                : distances[a] > distances[b]
                                    ? 1
                                    : 0;
                        });
                        //this.mergeSort(sorted, function (a, b) {return distances[a] < distances[b] ? -1 : 1; })
                    }
                }
                console.log("Sorted", sorted.length)

                // Finally copy the sorted indices and tell THREE.js to update the geometry
                for (let l = 0; l < sorted.length; l++) {
                    for (let k = 0; k < elementSize; k++) {
                        ind[elementSize * l + k] =
                            indCopy[elementSize * sorted[l] + k];
                    }
                }
                this.scene.children[i].children[j].geometry.needsUpdate = true;
                this.scene.children[i].children[
                    j
                ].geometry.index.needsUpdate = true;
            }
        }

        let t1 = performance.now();
        //console.log("Squaring time: ", t0a - t0)
        //console.log("Sorting time: ", t1 - t0)
        this.lastSort = Date.now();
        this.sortedSinceLastCamPosUpdate = true;
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////  GUI-Related functions

    // Load the default colors (for the variables provided by reference in parameter p)
    colorReset(p) {
        p.niceColors = JSON.parse(JSON.stringify(p.niceColorsCopy)); // deep copy array
        p.primary.setValue(0xf51818);
        p.secondary.setValue(0xffe100);
        p.background.setValue(0xdddddd);
    }

    // Colorize the data sets and primary/secondary according to the niceColors-array
    colorListTo3D(p) {
        this.gui.setValue(this.primary, p.niceColors[0]);
        this.gui.setValue(this.secondary, p.niceColors[1]);
    }

    // https://stackoverflow.com/questions/1484506/random-color-generator
    getRandomColor() {
        let letters = "0123456789ABCDEF";
        let color = "#";
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    // Create GUI elements and handle user interactions
    // TODO: clean up the mess with parameters p, p2, p, ...
    initGui() {
        this.gui.create();

        this.gui.addMainHeadline("General settings");
        this.gui.addSelection(
            "Gui scale",
            ["Small", "Medium", "Large"],
            1,
            function (val) {
                this.gui.scale(val == 0 ? 250 : val == 1 ? 400 : 600);
            }.bind(this),
            false
        );

        if (!this.webVr) {
            let cameraLinks = document.createElement("div");
            let cameraLinksTag = document.createElement("div");
            cameraLinksTag.innerHTML = "Reset camera";
            cameraLinksTag.classList.add("guiTag");
            cameraLinks.appendChild(cameraLinksTag);

            let directions = ["+x", "-x", "+y", "-y", "+z", "-z"];
            for (let i = 0; i < directions.length; i++) {
                let cameraLink = document.createElement("a");
                let d = directions[i];
                cameraLink.href = "#";
                cameraLink.classList.add("resetCamLink");
                cameraLink.innerHTML = d;
                let p = { context: this, d: d };
                cameraLink.onclick = function () {
                    this.context.setCamera(this.d);
                }.bind(p);
                cameraLinks.appendChild(cameraLink);
            }
            this.gui.addChild(cameraLinks);

            let cameraRotateLinks = document.createElement("div");
            let cameraRotateLinksTag = document.createElement("div");
            cameraRotateLinksTag.innerHTML = "Rotate camera";
            cameraRotateLinksTag.classList.add("guiTag");
            cameraRotateLinks.appendChild(cameraRotateLinksTag);
            for (let i = 0; i < directions.length; i++) {
                let cameraLink = document.createElement("a");
                let d = directions[i];
                cameraLink.href = "#";
                cameraLink.classList.add("resetCamLink");
                cameraLink.innerHTML = d;
                let p = { context: this, d: d };
                cameraLink.onclick = function () {
                    this.context.rotateCamera(this.d);
                }.bind(p);
                cameraRotateLinks.appendChild(cameraLink);
            }
            this.gui.addChild(cameraRotateLinks);
        }

        //this.gui.addFloat("Scene scale", 0.1, 5, this.getScale(), function(val) {this.setScale(val)}.bind(this), false)

        this.sortFrequency = 0; // this.numGlPrimitives > 100000 ? 0 : 1 // or decide based on number of triangles?
        this.gui.addSelection(
            "Render: Update order",
            ["When not moving", "Every frame", "every 1s", "every 5s", "Never"],
            this.sortFrequency,
            function (val) {
                this.sortFrequency = val;
                this.sortNeedShuffle = val == 4;
            }.bind(this),
            false
        );
        this.gui.addColor(
            "Background color",
            "#" +
            this.material[0].uniforms.backgroundColor.value.getHexString(),
            function (val) {
                // Also tell the items about the background color. We use this to fade elements to background color.
                for (
                    let setId = 0;
                    setId < this.setsAndStates.length;
                    setId++
                ) {
                    this.material[
                        setId
                    ].uniforms.backgroundColor.value = new Color(val);
                }
                this.backgroundColor = val;
            }.bind(this),
            false
        );

        let resetDefault = document.createElement("div");
        let resetDefaultTag = document.createElement("div");
        resetDefaultTag.innerHTML = "Reset settings";
        resetDefaultTag.classList.add("guiTag");
        resetDefault.appendChild(resetDefaultTag);
        var resetDefaultButton = document.createElement("button");
        resetDefaultButton.innerHTML = "Load now"
        resetDefaultButton.onclick = function () {
            this.gui.loadDefaults();
        }.bind(this)
        resetDefault.append(resetDefaultButton);
        this.gui.addChild(resetDefault);

        if (this.webVr) {
            this.gui.addFloat(
                "VR Camera pos. x",
                -5,
                5,
                this.webVrDisplacement.x,
                function (val) {
                    this.scene.children[0].position.sub(this.webVrDisplacement);
                    this.webVrDisplacement.setX(parseFloat(val));
                    this.scene.children[0].position.add(this.webVrDisplacement);
                }.bind(this),
                false
            );
            this.gui.addFloat(
                "VR Camera pos. y",
                -5,
                5,
                this.webVrDisplacement.y,
                function (val) {
                    this.scene.children[0].position.sub(this.webVrDisplacement);
                    this.webVrDisplacement.setY(parseFloat(val));
                    this.scene.children[0].position.add(this.webVrDisplacement);
                }.bind(this),
                false
            );
            this.gui.addFloat(
                "VR Camera pos. z",
                -5,
                5,
                this.webVrDisplacement.z,
                function (val) {
                    this.scene.children[0].position.sub(this.webVrDisplacement);
                    this.webVrDisplacement.setZ(parseFloat(val));
                    this.scene.children[0].position.add(this.webVrDisplacement);
                }.bind(this),
                false
            );
        }

        // Add dataset-specific properties, like a specific color for each dataset
        for (let setId = 0; setId < this.setsAndStates.length; setId++) {
            this.gui.addMainHeadline(
                "Dataset " + (setId + 1) + ": " + this.setsAndStates[setId].name
            );
            let name = setId + "_" + this.setsAndStates[setId].name;
            let s = 1 / parseFloat(this.setsAndStates[setId].scale);
            let start = 8; // Magic number, see above in the shader (color interpolation)


            // Here we add information for each attribute of the current dataset
            for (let i = 0; i < this.dataAttributes.length; i++) {
                if (this.dataAttributes[i].dataset !== setId) continue; // Only attributes of current dataset

                this.gui.addHeadline(
                    "Attribute filter: " + this.dataAttributes[i].name
                );
                let name = i + ": " + this.dataAttributes[i].name;

                // Parameter object, for this specific attribute
                let p = {};
                p.name = name;
                p.uniformName = this.cleanVarName(this.dataAttributes[i].name);
                p.i = i;
                p.to = parseFloat(this.dataAttributes[i].max);
                p.window = parseFloat(0);
                p.uniforms = this.material[setId].uniforms;
                p.setId = setId;
                p.gui = this.gui;

                this.gui.addFloat(
                    setId + "_" + name + " __Min",
                    parseFloat(this.dataAttributes[i].min),
                    parseFloat(this.dataAttributes[i].max),
                    parseFloat(this.dataAttributes[i].min),
                    function (val) {
                        this.uniforms[this.uniformName + "From"].value = val;
                        let window = this.gui.getValue(
                            this.setId + "_" + this.name + "__Window"
                        );
                        // The next one will set the "max" value automatically if the window is non-zero
                        if (window > 0.0) {
                            this.gui.setValue(
                                this.setId + "_" + this.name + "__Max",
                                parseFloat(val) + parseFloat(window)
                            );
                        }
                    }.bind(p)
                );

                this.gui.addFloat(
                    setId + "_" + name + "__Max",
                    parseFloat(this.dataAttributes[i].min),
                    parseFloat(this.dataAttributes[i].max),
                    parseFloat(this.dataAttributes[i].max),
                    function (val) {
                        this.uniforms[this.uniformName + "To"].value = val;
                    }.bind(p)
                );

                this.gui.addFloat(
                    setId + "_" + name + "__Window",
                    parseFloat(0),
                    parseFloat(
                        this.dataAttributes[i].max - this.dataAttributes[i].min
                    ),
                    parseFloat(0),
                    function (val) {
                        /*nothing to do*/
                    }.bind(p)
                );

                this.colorModeOptions.push(name);
                this.mercatorModeOptions.push(name);
            }

            // Parameter object, for this data set
            let p = {};
            p.niceColors = this.niceColors;
            p.niceColorsCopy = this.niceColorsCopy;
            p.colorMapMode = setId.toString() + "__Color map";
            p.primary = setId.toString() + "__Primary color";
            p.secondary = setId.toString() + "__Secondary color";
            p.defocus = setId.toString() + "__Defocus color";
            p.background = "Background color";
            p.setsAndStates = this.setsAndStates;
            p.numStates = Object.keys(this.setsAndStates[setId].states).length;
            p.colorListTo3D = this.colorListTo3D;
            p.gui = this.gui;
            p.getRandomColor = this.getRandomColor;
            p.material = this.material[setId];
            p.setId = setId;
            p.backgroundColor = this.backgroundColor;
            p.updateInsetLabels = this.updateInsetLabels.bind(this);
            p.setScale = this.setScale.bind(this);
            p.colorMapTextures = this.colorMapTextures;

            
            if(this.data.sets[setId].axes !== undefined && this.data.sets[setId].axes.length > 0) {
                // We also have axes to draw
                this.gui.addHeadline(
                    "Axes styling"
                );

                this.gui.addFloat(
                    setId.toString() + "__Axes transparancy",
                    0,
                    1,
                    1,
                    function (val) {
                        this.material.uniforms.axesTransparancy.value = val;
                    }.bind(p)
                );

                this.gui.addColor(
                    setId.toString() + "__Axes color",
                    "#000000",
                    function (val) {
                        // Also tell the items about the background color. We use this to fade elements to background color.
                        for (
                            let setId = 0;
                            setId < this.setsAndStates.length;
                            setId++
                        ) {
                            this.material.uniforms.axesColor.value = new Color(val);
                        }
                    }.bind(p)
                );
            }

            this.gui.addHeadline("Render settings");
            this.gui.addSelection(
                setId.toString() + "__Color map",
                this.colorMapNames,
                0,
                function (val) {
                    this.material.uniforms.colorMapMode.value = val > 0 ? 1 : 0;
                    if (val > 0)
                        this.material.uniforms.colorMap.value = this.colorMapTextures[
                            val - 1
                        ];
                    console.log(
                        "set to colormap ",
                        val - 1,
                        this.colorMapTextures[val - 1]
                    );
                    this.material.uniforms.colorMap.needsUpdate = true;
                }.bind(p)
            );

            this.gui.addSelection(
                setId.toString() + "__Custom color: presets",
                [
                    "Default",
                    "Dark red/blue",
                    "Shuffle all",
                    "Cream 1",
                    "Cream 2",
                    "Cyan",
                    "Neon",
                    "Nico",
                    "Warm blue/red",
                    "b/w",
                    "b/w inverse",
                    "ice",
                    "purple",
                    "ocean",
                ],
                0,
                function (val) {
                    if (val == 1) {
                        this.gui.setValue(this.primary, "#dc0d0d");
                        this.gui.setValue(this.secondary, "#1192f6");
                        this.gui.setValue(this.background, "#080b1a");
                        this.gui.setValue(this.defocus, "#4f4e51");
                    } else if (val == 2) {
                        this.gui.setValue(this.primary, this.getRandomColor());
                        this.gui.setValue(
                            this.secondary,
                            this.getRandomColor()
                        );
                        this.gui.setValue(
                            this.background,
                            this.getRandomColor()
                        );
                        this.gui.setValue(this.defocus, this.getRandomColor());
                    } else if (val == 3) {
                        this.gui.setValue(this.primary, "#123C69");
                        this.gui.setValue(this.secondary, "#AC3B61");
                        this.gui.setValue(this.background, "#f0cdbc");
                        this.gui.setValue(this.defocus, "#9f9f9f");
                    } else if (val == 4) {
                        this.gui.setValue(this.primary, "#6ca56b");
                        this.gui.setValue(this.secondary, "#e5e4d4");
                        this.gui.setValue(this.background, "#9a6755");
                        this.gui.setValue(this.defocus, "#5a362a");
                    } else if (val == 5) {
                        this.gui.setValue(this.primary, "#FFE400");
                        this.gui.setValue(this.secondary, "#f70253");
                        this.gui.setValue(this.background, "#10E7DC");
                        this.gui.setValue(this.defocus, "#ffffff");
                    } else if (val == 6) {
                        this.gui.setValue(this.primary, "#f3f315");
                        this.gui.setValue(this.secondary, "#ff0099");
                        this.gui.setValue(this.background, "#111111");
                        this.gui.setValue(this.defocus, "#888888");
                    } else if (val == 7) {
                        this.gui.setValue(this.primary, "#00b0e6");
                        this.gui.setValue(this.secondary, "#ff001e");
                        this.gui.setValue(this.background, "#ffffff");
                        this.gui.setValue(this.defocus, "#888888");
                    } else if (val == 8) {
                        // warm blue red yellow
                        this.gui.setValue(this.primary, "#f5ed70");
                        this.gui.setValue(this.secondary, "#e03335");
                        this.gui.setValue(this.background, "#0a7fa2");
                        this.gui.setValue(this.defocus, "#065e7c");
                    } else if (val == 9) {
                        // black and white
                        this.gui.setValue(this.primary, "#000000");
                        this.gui.setValue(this.secondary, "#737373");
                        this.gui.setValue(this.background, "#ffffff");
                        this.gui.setValue(this.defocus, "#bfbfbf");
                    } else if (val == 10) {
                        // black and white inverse
                        this.gui.setValue(this.primary, "#ffffff");
                        this.gui.setValue(this.secondary, "#313131");
                        this.gui.setValue(this.background, "#000000");
                        this.gui.setValue(this.defocus, "#414141");
                    } else if (val == 11) {
                        // ice
                        this.gui.setValue(this.primary, "#00787e");
                        this.gui.setValue(this.secondary, "#92f5fa");
                        this.gui.setValue(this.background, "#07242a");
                        this.gui.setValue(this.defocus, "#1e152f");
                    } else if (val == 12) {
                        // purple
                        this.gui.setValue(this.primary, "#1d8c80");
                        this.gui.setValue(this.secondary, "#edaf9b");
                        this.gui.setValue(this.background, "#43283f");
                        this.gui.setValue(this.defocus, "#24454d");
                    } else if (val == 13) {
                        // purple
                        this.gui.setValue(this.primary, "#fff673");
                        this.gui.setValue(this.secondary, "#00ca60");
                        this.gui.setValue(this.background, "#042a55");
                        this.gui.setValue(this.defocus, "#214588");
                    } else {
                        this.gui.setValue(this.primary, "#e40e1a");
                        this.gui.setValue(this.secondary, "#0041df");
                        this.gui.setValue(this.background, "#e2e2e2");
                        this.gui.setValue(this.defocus, "#888888");
                    }
                }.bind(p)
            );
            this.gui.addColor(
                setId.toString() + "__Primary color",
                "#" + p.material.uniforms.primaryColor.value.getHexString(),
                function (val) {
                    this.material.uniforms.primaryColor.value = new Color(val);
                    this.gui.setValue(this.colorMapMode, 0);
                }.bind(p)
            );
            this.gui.addColor(
                setId.toString() + "__Secondary color",
                "#" + p.material.uniforms.secondaryColor.value.getHexString(),
                function (val) {
                    this.material.uniforms.secondaryColor.value = new Color(
                        val
                    );
                    this.gui.setValue(this.colorMapMode, 0);
                }.bind(p)
            );
            this.gui.addColor(
                setId.toString() + "__Defocus color",
                "#" + p.material.uniforms.defocusColor.value.getHexString(),
                function (val) {
                    this.material.uniforms.defocusColor.value = new Color(val);
                }.bind(p)
            );
            this.gui.addSelection(
                setId.toString() + "__Color mode",
                this.colorModeOptions,
                0,
                function (val) {
                    this.material.uniforms["mode"].value = val;
                }.bind(p)
            );

            this.gui.addFloat(
                setId.toString() + "__Line width (test)",
                0,
                20,
                2,
                function (val) {
                    this.material.linewidth = val;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "__Fade out behind center",
                0,
                1,
                0,
                function (val) {
                    this.material.uniforms.darkenInside.value = val;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "__Shading",
                0,
                2,
                0,
                function (val) {
                    this.material.uniforms.shading.value = val;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "__Glossiness",
                0,
                200,
                10,
                function (val) {
                    this.material.uniforms.glossiness.value = val;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "__Alpha",
                0,
                1,
                0.1,
                function (val) {
                    this.material.uniforms.alpha.value = val;
                }.bind(p)
            );
            if (p.numStates > 1) {
                console.log("Num states:", p.numStates);
                this.gui.addFloat(
                    setId.toString() + "__State",
                    0,
                    p.numStates - 1,
                    0,
                    function (val) {
                        this.material.uniforms.state.value = val;
                    }.bind(p)
                );
            }
            this.gui.addFloat(
                setId.toString() + "__Defocus alpha",
                0,
                1,
                0.02,
                function (val) {
                    this.material.uniforms.defocusAlpha.value = val;
                }.bind(p)
            );

            if (p.numStates > 1) {
                this.gui.addFloat(
                    setId.toString() + "__Defocus state",
                    0,
                    p.numStates - 1,
                    Math.min(0.5, p.numStates - 1),
                    function (val) {
                        this.material.uniforms.defocusState.value = val;
                    }.bind(p)
                );
            }
            this.gui.addHeadline("Mercator projections");
            this.gui.addFloat(
                setId.toString() + "_mercator__Level",
                0,
                1,
                0,
                function (val) {
                    this.material.uniforms.mercator.value = val;
                    this.updateInsetLabels();
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "_mercator__Rotation x",
                0,
                6.28318,
                1.57079632,
                function (val) {
                    this.material.uniforms.mercatorOffset.value = val;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "_mercator__Rotation y",
                0,
                6.28318,
                0,
                function (val) {
                    this.material.uniforms.mercatorOffset2.value = val;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "_mercator__Rotation z",
                0,
                6.28318,
                0,
                function (val) {
                    this.material.uniforms.mercatorOffset3.value = val;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "_mercator__z Scale",
                0,
                10,
                0,
                function (val) {
                    this.material.uniforms.mercatorRadius.value = val;
                }.bind(p)
            );

            this.gui.addSelection(
                setId.toString() + "_mercator__z Mapping",
                this.mercatorModeOptions,
                0,
                function (val) {
                    this.material.uniforms["mercatorMode"].value = val;
                    this.updateInsetLabels();
                }.bind(p)
            );

            this.gui.addHeadline("Cutting planes");

            this.gui.addFloat(
                setId.toString() + "_cutting plane:__x Min",
                s * this.bbox.min.x,
                s * this.bbox.max.x,
                s * this.bbox.min.x,
                function (val) {
                    this.material.uniforms.xLower.value = val / s;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "_cutting plane:__x Max",
                s * this.bbox.min.x,
                s * this.bbox.max.x,
                s * this.bbox.max.x,
                function (val) {
                    this.material.uniforms.xUpper.value = val / s;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "_cutting plane:__y Min",
                s * this.bbox.min.y,
                s * this.bbox.max.y,
                s * this.bbox.min.y,
                function (val) {
                    this.material.uniforms.yLower.value = val / s;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "_cutting plane:__y Max",
                s * this.bbox.min.y,
                s * this.bbox.max.y,
                s * this.bbox.max.y,
                function (val) {
                    this.material.uniforms.yUpper.value = val / s;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "_cutting plane:__z Min",
                s * this.bbox.min.z,
                s * this.bbox.max.z,
                s * this.bbox.min.z,
                function (val) {
                    this.material.uniforms.zLower.value = val / s;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "_cutting plane:__z Max",
                s * this.bbox.min.z,
                s * this.bbox.max.z,
                s * this.bbox.max.z,
                function (val) {
                    this.material.uniforms.zUpper.value = val / s;
                }.bind(p)
            );

            this.gui.addHeadline("Projection on 2D plane in 3D space");
            this.gui.addFloat(
                setId.toString() + "__Projection level",
                0,
                1,
                0,
                function (val) {
                    this.material.uniforms.projLevel.value = val;
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "__Center x",
                s * this.bbox.min.x,
                s * this.bbox.max.x,
                0,
                function (val) {
                    this.material.uniforms.projPlane.value.setX(val / s);
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "__Center y",
                s * this.bbox.min.y,
                s * this.bbox.max.y,
                0,
                function (val) {
                    this.material.uniforms.projPlane.value.setY(val / s);
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "__Center z",
                s * this.bbox.min.z,
                s * this.bbox.max.z,
                s * this.bbox.max.z,
                function (val) {
                    this.material.uniforms.projPlane.value.setZ(val / s);
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "__Normal x",
                -1,
                1,
                0,
                function (val) {
                    this.material.uniforms.projPlaneN.value.setX(val);
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "__Normal y",
                -1,
                1,
                0,
                function (val) {
                    this.material.uniforms.projPlaneN.value.setY(val);
                }.bind(p)
            );
            this.gui.addFloat(
                setId.toString() + "__Normal z",
                -1,
                1,
                1,
                function (val) {
                    this.material.uniforms.projPlaneN.value.setZ(val);
                }.bind(p)
            );
        }

        // Default elements for gui
        this.gui.addMainHeadline("Tours and Data Export");
        this.gui.addFloat(
            "Video bitrate (mbit)",
            2,
            200,
            parseInt(this.videoBitrate / 1000000),
            function (v) {
                this.videoBitrate = v * 1000000;
            }.bind(this),
            false
        );

        let exportLinkHolder = document.createElement("div");
        exportLinkHolder.setAttribute("id", "exportLinkHolder");
        let exportLink = document.createElement("a");
        //exportLink.setAttribute("id", "exportLinkHolder");
        exportLink.innerHTML = "&bull; Download selection";
        exportLink.id = "exportButton";
        exportLink.href = "#";
        exportLink.onclick = this.exportSelection.bind(this);
        let exportLinkStatus = document.createElement("span");
        exportLinkStatus.style.marginLeft = "5px";
        exportLinkStatus.id = "exportButtonStatus";
        exportLinkHolder.appendChild(exportLink);
        exportLinkHolder.appendChild(exportLinkStatus);
        this.gui.addChild(exportLinkHolder);
        console.log("Default values", this.gui.defaultValues)
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////// Selection-related and clicking-related functions

    // Does user click trigger and mouse simultaneously?
    clickAndEnterPressing() {
        return this.pressingEnter && this.clickingMouseButton;
    }

    // Calculate selection box
    reCalc() {
        this.x3 = Math.min(this.x1, this.x2);
        this.x4 = Math.max(this.x1, this.x2);
        this.y3 = Math.min(this.y1, this.y2);
        this.y4 = Math.max(this.y1, this.y2);
        this.div.style.left = this.x3 + "px";
        this.div.style.top = this.y3 + "px";
        this.div.style.width = this.x4 - this.x3 + "px";
        this.div.style.height = this.y4 - this.y3 + "px";
    }

    // onmousedown event handler, and only if trigger button is pressed, too
    onmousedown(e) {
        if (this.renderer.domElement !== e.target) {
            // Never notice this click if it wasn't targeted at the canvas
            return;
        }
        document.activeElement.blur();

        if (this.pressingButton) {
            this.clickingMouseButton = true;
            this.div.hidden = 0;
            this.x1 = e.clientX;
            this.y1 = e.clientY;
            this.reCalc();
        } else if (this.webVr) {
            this.clickingVrOnCanvas = true;
        }
    }

    // Handler for mouse motion
    onmousemove(e) {
        if (this.clickingMouseButton) {
            this.x2 = e.clientX;
            this.y2 = e.clientY;
            this.reCalc();
        } else if (this.clickingVrOnCanvas) {
            console.log("vr move", e.clientX, e.clientY);
            if (this.lastVrPosX != null && this.lastVrPosY != null) {
                let diffX = e.clientX - this.lastVrPosX;
                let diffY = e.clientY - this.lastVrPosY;

                this.scene.children[0].rotation.y += 0.01 * diffX;
                this.scene.children[0].rotation.x += 0.01 * diffY;

                for (let i = 1; i < this.scene.children.length; i++) {
                    let m = new Matrix4();
                    let n = new Matrix4();
                    m.makeRotationY(0.01 * diffX);
                    n.makeRotationX(0.01 * diffY);
                    this.scene.children[i].position.sub(this.webVrDisplacement);
                    this.scene.children[i].position
                        .applyMatrix4(m)
                        .applyMatrix4(n);
                    this.scene.children[i].position.add(this.webVrDisplacement);
                }
            }

            this.lastVrPosX = e.clientX;
            this.lastVrPosY = e.clientY;
        }
    }

    // Handler of mouse release. Calculates the corner points of the selection in world space, also for near and far
    onmouseup(e) {
        if (this.div.hidden == 0) {
            let ww =
                window.innerWidth ||
                document.documentElement.clientWidth ||
                document.body.clientWidth;
            let hh =
                window.innerHeight ||
                document.documentElement.clientHeight ||
                document.body.clientHeight;
            this.y1 = hh - this.y1;
            this.y2 = hh - this.y2;
            let normalizedX1 = (this.x1 / ww) * 2 - 1;
            let normalizedY1 = (this.y1 / hh) * 2 - 1;
            let normalizedX2 = (this.x2 / ww) * 2 - 1;
            let normalizedY2 = (this.y2 / hh) * 2 - 1;

            let fromX = Math.min(normalizedX1, normalizedX2);
            let fromY = Math.max(normalizedY1, normalizedY2);
            let toX = Math.max(normalizedX1, normalizedX2);
            let toY = Math.min(normalizedY1, normalizedY2);

            console.log("Selection from", fromX, fromY, "to", toX, toY);

            let scale = this.getScale();
            let p1Near = new Vector3(fromX, fromY, -1)
                .unproject(this.camera)
                .divideScalar(scale);
            let p2Near = new Vector3(toX, fromY, -1)
                .unproject(this.camera)
                .divideScalar(scale);
            let p3Near = new Vector3(toX, toY, -1)
                .unproject(this.camera)
                .divideScalar(scale);
            let p4Near = new Vector3(fromX, toY, -1)
                .unproject(this.camera)
                .divideScalar(scale);
            let p1Far = new Vector3(fromX, fromY, 1)
                .unproject(this.camera)
                .divideScalar(scale);
            let p2Far = new Vector3(toX, fromY, 1)
                .unproject(this.camera)
                .divideScalar(scale);
            let p3Far = new Vector3(toX, toY, 1)
                .unproject(this.camera)
                .divideScalar(scale);
            let p4Far = new Vector3(fromX, toY, 1)
                .unproject(this.camera)
                .divideScalar(scale);
            this.checkPoints(
                p1Near,
                p2Near,
                p3Near,
                p4Near,
                p1Far,
                p2Far,
                p3Far,
                p4Far
            );
        } else if (this.clickingVrOnCanvas) {
            this.clickingVrOnCanvas = false;
            this.lastVrPosX = null;
            this.lastVrPosY = null;
        }

        this.div.hidden = 1;
        this.clickingMouseButton = false;
    }

    // Handles the beginning of a "click" with (the first) webVR controller
    onVrSelectStart() {
        this.clickingVrControllerButton = true;
        this.onVrMoveObserver();
    }

    // Handles the end of a "click" with (the first) webVR controller
    onVrSelectEnd() {
        this.clickingVrControllerButton = false;
        this.lastVrRotation = null;
    }

    // Permanently checks the rotation of the webVR controller and uses the rotation to rotate the data.
    // Note, since most webVR controllers, we cannot (easily) use something like a "onMove" event. That's
    // why we only use the (very general) onVrSelectStart/onVrSelectEnd to trigger our custom observer.
    onVrMoveObserver() {
        if (this.lastVrRotation !== null) {
            let diffX = this.lastVrRotation.x - this.vrControls.rotation.x;
            let diffY = this.lastVrRotation.y - this.vrControls.rotation.y;

            // minimize the chance that this.lastVrRotation has changed to null in the mean time
            if (this.clickingVrControllerButton) {
                this.scene.children[0].rotation.x += 2 * diffX;
                this.scene.children[0].rotation.y += 2 * diffY;
            }
        }

        // infinite loop: call itself again if user still holds the button
        if (this.clickingVrControllerButton) {
            this.lastVrRotation = new Vector3(
                this.vrControls.rotation.x,
                this.vrControls.rotation.y,
                this.vrControls.rotation.z
            );
            setTimeout(
                function (p) {
                    p.onVrMoveObserver().bind(p);
                },
                20,
                this
            );
        }
    }

    // Handler of double click: display everything
    ondblclick(e) {
        if (e.target === this.renderer.domElement) {
            this.makeAllElementsVisible();
        }
    }

    // Get a plane formed by three points
    getPlane(p1, p2, p3) {
        let v1 = new Vector3(p2.x, p2.y, p2.z); // = p2
        v1.sub(p1); // = p2 - p1
        let v2 = new Vector3(p2.x, p2.y, p2.z); // = p2
        v2.sub(p3); // = p2 - p3
        let n = new Vector3(v1.x, v1.y, v1.z);
        n = n.cross(v2);
        let d = p2.x * n.x + p2.y * n.y + p2.z * n.z;
        return { a: n.x, b: n.y, c: n.z, d: -d };
    }

    // Check if x/y/z is "left of that plane"
    isInside(plane, x, y, z) {
        return x * plane.a + y * plane.b + z * plane.c + plane.d > 0;
    }

    // Show all elements
    makeAllElementsVisible() {
        this.currentSelection = {};
        for (let i = 0; i < this.scene.children[0].children.length; i++) {
            let k = this.scene.children[0].children[i].geometry.originIndex;
            let newValuesAxes = [];
            if(this.data.sets[i].axes !== undefined) {
                for(let axeItem = 0; axeItem < this.data.sets[i].axes.length / 3; axeItem++) {
                    newValuesAxes.push(-1);
                }
            }
            let newValues = JSON.parse(
                JSON.stringify(this.data.sets[i].entities[k])
            );
            newValues = newValues.concat(newValuesAxes)
            console.log("Draw index values", newValues)
            
            //this.scene.children[0].children[i].geometry.attributes.drawIndex.setArray(new Float32Array(newValues));
            
            this.scene.children[0].children[i].geometry.setAttribute(
                "drawIndex",
                new Float32BufferAttribute(newValues, 1)
                );
            this.scene.children[0].children[i].geometry.attributes.drawIndex.needsUpdate = true;
            for (let j = 0; j < this.scene.children[0].children[i].geometry.totalLineId.length; j++) {
                this.currentSelection[
                    this.scene.children[0].children[i].geometry.totalLineId[j]
                ] = 1;
            }
        }
    }

    // Hide all elements
    makeAllElementsInvisible() {
        for (let i = 0; i < this.scene.children[0].children.length; i++) {
            //this.scene.children[0].children[i].visible = false;
            let newValues = this.createFilledArray(
                -1,
                this.scene.children[0].children[i].geometry.attributes.drawIndex
                    .array.length
            );

            this.scene.children[0].children[i].geometry.setAttribute(
                "drawIndex",
                new Float32BufferAttribute(newValues, 1)
            );
            this.scene.children[0].children[
                i
            ].geometry.attributes.drawIndex.needsUpdate = true;
        }
    }

    // Get elements that are within that cube formed by p1, p2, p3, p4 (front face) and p5, p6, p7, p8 (back face)
    checkPoints(p1, p2, p3, p4, p5, p6, p7, p8) {
        let plane1 = this.getPlane(p1, p2, p5);
        let plane2 = this.getPlane(p2, p3, p6);
        let plane3 = this.getPlane(p3, p4, p7);
        let plane4 = this.getPlane(p4, p1, p8);

        let clickedElements = [];
        this.currentSelection = {};

        // First we check which element is actually visible
        let rememberVisible = {};
        for (let i = 0; i < this.scene.children[0].children.length; i++) {
            for (
                let j = 0;
                j <
                this.scene.children[0].children[i].geometry.attributes.drawIndex
                    .array.length;
                j++
            ) {
                if (
                    !this.scene.children[0].children[i].selectable ||
                    this.scene.children[0].children[i].geometry.attributes
                        .drawIndex.array[j] > 0.5
                ) {
                    rememberVisible[
                        this.scene.children[0].children[i].geometry.totalLineId[
                        j
                        ]
                    ] = 1;
                }
            }
        }

        // Now we iterate over all elements (except for already "invisible" ones) and check
        // if they are part of the new selection
        for (let i = 0; i < this.scene.children[0].children.length; i++) {
            for (
                let j = 0;
                j <
                this.scene.children[0].children[i].geometry.attributes.drawIndex
                    .array.length;
                j++
            ) {
                let lineId = this.scene.children[0].children[i].geometry
                    .totalLineId[j];
                if (
                    rememberVisible[lineId] === undefined ||
                    this.currentSelection[lineId] !== undefined
                ) {
                    // We should not consider that since
                    // We have been here a moment ago
                    continue;
                }
                let x = this.scene.children[0].children[i].geometry.attributes
                    .position.array[3 * j + 0];
                let y = this.scene.children[0].children[i].geometry.attributes
                    .position.array[3 * j + 1];
                let z = this.scene.children[0].children[i].geometry.attributes
                    .position.array[3 * j + 2];

                if (this.scene.children[0].children[i].selectable) {
                    if (
                        this.isInside(plane1, x, y, z) &&
                        this.isInside(plane2, x, y, z) &&
                        this.isInside(plane3, x, y, z) &&
                        this.isInside(plane4, x, y, z)
                    ) {
                        clickedElements.push(
                            this.scene.children[0].children[i].geometry
                                .totalLineId[j]
                        );
                        this.currentSelection[lineId] = 1;
                    }
                } else {
                    clickedElements.push(
                        this.scene.children[0].children[i].geometry.totalLineId[
                        j
                        ]
                    );
                    this.currentSelection[lineId] = 1;
                }
            }
        }

        this.hideAllButSelected(this.currentSelection);
        console.log(this.currentSelection);
    }

    // Hides all elements that are not within the selected "cube"
    hideAllButSelected(selectionMap) {
        // Hide all first, then show the elements that match the criteria
        this.makeAllElementsInvisible();
        console.log("SelectionMap", selectionMap);

        for (let i = 0; i < this.scene.children[0].children.length; i++) {
            let k = this.scene.children[0].children[i].geometry.originIndex;
            let newValues = this.createFilledArray(
                -1,
                this.scene.children[0].children[i].geometry.attributes.drawIndex
                    .array.length - 1
            );

            for (
                let j = 0;
                j <
                this.scene.children[0].children[i].geometry.attributes.drawIndex
                    .array.length;
                j++
            ) {
                let lineId = this.scene.children[0].children[i].geometry
                    .totalLineId[j];
                if (selectionMap[lineId] !== undefined) {
                    newValues[j] = this.data.sets[i].entities[k][j]; //this.scene.children[0].children[i].visible = true;
                }
            }
            
            /*
            if(this.data.sets[i].axes !== undefined) {
                        for(let axeIndex = 0; axeIndex < this.data.sets[i].axes.length / 3; axeIndex++) {
                            newValues[j]
                        }
                    }
  */
            this.scene.children[0].children[i].geometry.setAttribute(
                "drawIndex",
                new Float32BufferAttribute(newValues, 1)
                );
            this.scene.children[0].children[
                i
            ].geometry.attributes.drawIndex.needsUpdate = true;
        }
    }

    getSelection() {
        return this.currentSelection;
    }

    disableExportButton() {
        let e = document.getElementById("exportButton");
        e.style.opacity = 0.5;
        e.style.cursor = "default";
        e.onclick = 0;
    }

    enableExportButtonAndHideStatus() {
        let e = document.getElementById("exportButton");
        e.style.opacity = 1;
        e.style.cursor = "pointer";
        e.onclick = this.exportSelection.bind(this);
        let e2 = document.getElementById("exportButtonStatus");
        e2.innerHTML = "";
    }

    getExportLine(data, entity, index, dim) {
        let code = "";
        for (let i = 0; i < dim; i++) {
            code += data.positions[entity][index * dim + i] + ";";
        }
        for (let i = 0; i < data.attributes.length; i++) {
            // They may not exist or be incomplete, if data is shared
            if (data.attributes[i].values === undefined) continue;
            if (data.attributes[i].values.length <= entity) continue;
            if (data.attributes[i].values[entity].length <= index) continue;
            code += data.attributes[i].values[entity][index] + ";";
        }
        code += "\n";
        return code;
    }

    getExportHeader(data, entity, dim) {
        let code = "";
        let dims = ["x", "y", "z", "w"];
        for (let i = 0; i < dim; i++) {
            code += dims[i] + ";";
        }
        for (let i = 0; i < data.attributes.length; i++) {
            // They may not exist or be incomplete, if data is shared
            if (data.attributes[i].values === undefined) continue;
            if (data.attributes[i].values.length <= entity) continue;
            if (data.attributes[i].values[entity].length === 0) continue;
            code += data.attributes[i].name + ";";
        }
        code += "\n";
        return code;
    }

    exportShowStatus(description, current, sparse, maximum = null) {
        if (current % sparse == 0)
            document.getElementById("exportButtonStatus").innerHTML =
                description +
                ": " +
                current +
                (maximum === null ? "" : " of " + maximum);
    }

    exportPrepareData() {
        let selectionMap = this.currentSelection;
        let sets = [];
        let dim = 3;

        for (let i = 0; i < this.data.sets.length; i++) {
            console.log("Iterate over data sets ... now set ", i);
            let set = {};
            set.name = i + "_" + this.data.sets[i].name;
            let numIndices = 2;
            if (this.data.sets[i].type !== "lines") continue; // TODO currently only export of lines
            set.states = [];
            let counter = 0;
            for (let j = 0; j < this.data.sets[i].states.length; j++) {
                console.log("Iterate over data set states ... now state ", j);
                let state = {};
                state.name = j + "_" + this.data.sets[i].states[j].name;
                let indexPos = 0;
                let lastIndex = -1;
                state.elements = [];
                for (let k = 0; k < this.data.sets[i].entities.length; k++) {
                    let skip = false;
                    let lastEntity = -1;
                    let code = "";
                    for (
                        let m = 1;
                        m < this.data.sets[i].indices[k].length;
                        m++
                    ) {
                        let index = this.data.sets[i].indices[k][m];
                        if (lastIndex == index) continue;

                        // If we reach a new entity, check if this entity is part of the
                        // selection, create the header, export the first line of the data.
                        // (After that, only the second point of each line segment will be
                        // exported, that's why we specifically need to export the first point here)
                        if (
                            lastEntity !== this.data.sets[i].entities[k][index]
                        ) {
                            counter++;
                            indexPos -= numIndices; // Always one index pair less than number of items
                            this.exportShowStatus(
                                "Converting trajectories",
                                counter,
                                100
                            );
                            skip = false;
                            let lineId =
                                i.toString() +
                                "_" +
                                this.data.sets[i].entities[k][index].toString();
                            if (selectionMap[lineId] === undefined) {
                                skip = true;
                            }
                            //console.log(code)
                            if (code !== "") state.elements.push(code);
                            code = "";
                            if (!skip) {
                                code += this.getExportHeader(
                                    this.data.sets[i].states[j],
                                    k,
                                    dim
                                );
                                code += this.getExportLine(
                                    this.data.sets[i].states[j],
                                    k,
                                    index,
                                    //this.data.sets[i].indices[k][numIndices * m] - 1,
                                    dim
                                );
                            }
                        } else if (!skip) {
                            code += this.getExportLine(
                                this.data.sets[i].states[j],
                                k,
                                index,
                                dim
                            );
                        }
                        lastEntity = this.data.sets[i].entities[k][index];
                        lastIndex = index;
                    }
                    if (code !== "") state.elements.push(code);
                }
                set.states.push(state);
            }
            sets.push(set);
        }

        console.log("Export:", sets);
        return sets;
    }

    // Creates a dataset like the original one, but only with selected.
    // TODO: However, it is complicated to display the result,
    // since the text can have multiple megabytes...
    exportSelection() {
        this.disableExportButton();
        let data = this.exportPrepareData();
        let filename =
            "export" + this.exportHandler.getExportFileName() + ".zip";
        this.downloadZippedCsv(filename, data);
    }

    downloadZippedCsv(filename, data) {
        let zip = new JSZip();
        for (let set = 0; set < data.length; set++) {
            let setFolder = zip.folder(data[set].name);
            for (let state = 0; state < data[set].states.length; state++) {
                let stateFolder = setFolder.folder(
                    data[set].states[state].name
                );
                for (
                    let i = 0;
                    i < data[set].states[state].elements.length;
                    i++
                ) {
                    stateFolder.file(
                        i + ".csv",
                        data[set].states[state].elements[i]
                    );
                }
            }
        }
        console.log("Zip was prepared");
        zip.generateAsync(
            { type: "blob" },
            function (metadata) {
                this.exportShowStatus(
                    "Zipping",
                    parseInt(metadata.percent),
                    1,
                    100
                );
            }.bind(this)
        ).then(
            function (content) {
                console.log("Create downloadable file");
                this.exportHandler.downloadRaw(filename, content);
                this.enableExportButtonAndHideStatus();
            }.bind(this)
        );
    }

    setCamera(v) {
        console.log(v);
        this.controls.reset();
        let d = 2;
        let x = v === "+x" ? d : v === "-x" ? -d : 0;
        let y = v === "+y" ? d : v === "-y" ? -d : 0;
        let z = v === "+z" ? d : v === "-z" ? -d : 0;

        // Bug of OrbitControls: camera on y axis means a freeze of controls
        if (y !== 0) x = 0.0000001;
        console.log("set cam to ", x, y, z);
        this.camera.position.x = x;
        this.camera.position.y = y;
        this.camera.position.z = z;
        this.camera.updateProjectionMatrix();
        this.controls.update();
    }

    rotateCamera(v) {
        let m = new Matrix4();
        let d = (5 / 180) * Math.PI;
        switch (String(v)) {
            case "+x":
                m.makeRotationX(d);
                break;
            case "-x":
                m.makeRotationX(-d);
                break;
            case "+y":
                m.makeRotationY(d);
                break;
            case "-y":
                m.makeRotationY(-d);
                break;
            case "+z":
                m.makeRotationZ(d);
                break;
            case "-z":
                m.makeRotationZ(-d);
                break;
        }
        this.camera.position.applyMatrix4(m);
        this.camera.up.applyMatrix4(m);
        this.camera.updateProjectionMatrix();
        this.controls.update();
    }

    // Define the trigger button press
    onDocumentKeyDown(event) {
        console.log("Event:", event.target.tagName.toLowerCase(), event.which);
        if (event.target.tagName.toLowerCase() == "input") {
            return false;
        }
        let keyCode = event.which;
        console.log("Button " + keyCode);
        if (keyCode == 83) {
            this.pressingButton = true;
            this.controls.enabled = false;
            return false;
        }
        return true;
    }

    // Define the trigger button release
    onDocumentKeyUp(event) {
        let keyCode = event.which;
        console.log("Done with " + keyCode);
        if (keyCode == 83) {
            this.pressingButton = false;
            this.controls.enabled = true && !this.webVr; // no enabling in webVr mode!
        }
    }

    onDocumentScroll(e) {
        // TODO: [if needed] getting scroll events and use them to zoom. Currently, orbitcontrols steal them
        console.log("scroll");
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////  Tour-related functions

    // Removes the keep-waiting-messages and sets the title bar to its actual title (before it was loading status)
    doneLoading() {
        document.getElementById("loadingBox").className += " hideMe";
        setTimeout(function () {
            document.getElementById("loadingBox").className += " removeMe";
        }, 1000);
        document.title = this.actualTitle;
    }

    // Update the loading bar. TODO: doesn't seem to work - maybe no DOM updates during script load?
    // Current solution: write update to title. This one always updates.
    setStatus(from, to, now, message) {
        let p = (100 * (now - from)) / (to - from);
        document.title =
            Math.round(p) + "% " + message + " - " + this.actualTitle;
    }
}
