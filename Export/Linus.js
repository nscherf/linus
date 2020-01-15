function Linus(gui) {        
    // Script handling annotations. These are text boxes (divs) placed over the WebGL canvas at 2D 
    // positions that correspond to the underlying 3D positions of interest.
    // These functions are required for the animation loop, hence they are introduced already here.
    
    // Holding objects with annotation information (position, name, html)
    this.annotations =  [];

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
    this.backgroundColor = 0xdddddd;
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
    
    // Own helpers
    this.cameraUpdateCallback = function() {}; // A function that sets an updated camera position. Needed to avoid artifacts by parallelization
    this.recommendedScale = 1.; // Dataset scale (will be set to something like 1 / width of dataset)
    this.setsAndStates = []; // Overview of all sets and their states of the imported data
    this.customUniforms = []; // Preprocessed information generated from the data set
    this.customAttributes = []; // Preprocessed information generated from the data set
    this.dataAttributes = []; // Preprocessed information generated from the data set
    this.currentSelection = {}; // A map containing IDs of all elements currently being part of user's selection
    this.actualTitle = "", // Because we might change it; we store the title now

    // About sorting and the needs for updating the sort
    this.lastSort = 0; // Stores the last time the data has been depth-sorted
    this.sortForward = true;
    this.lastCamPos = new THREE.Vector3(0, 0, 0);
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
    this.webVrDisplacement = new THREE.Vector3(0, 1.5, -3);
    this.clickingVrOnCanvas = false; // Vr Mode: click on the canvas (only in "2D mode")
    this.clickingVrControllerButton = false; // Vr Mode: click a controller button (usually while being in the 3D environment)
    this.lastVrRotation = null; // Used to figure out motion and thus to rotate the observed object

    
 
    this.stats = null; // performance statistics widget
    // Note: if the following is changed, adjust the "magic number"! We must hardcode the size of this array to the shader.
    this.colorModeOptions = ['Solid', 'Orientation xyz',  'Orientation LonLat', 'Orientation Lat',  'Orientation Lon', 'Depth', 'Random']; 
    this.mercatorModeOptions = [];
    this.niceColors = [0xe6194B, 0x4363d8, 0x3cb44b, 0xffe119, 0xf58231, 0x911eb4, 0x42d4f4, 
                        0xf032e6, 0xbfef45, 0xfabebe, 0x469990, 0xe6beff, 0x9A6324, 0xfffac8, 
                        0x800000, 0xaaffc3, 0x808000, 0xffd8b1, 0x000075, 0xa9a9a9];
    this.niceColorsCopy = []; // backup



    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////// external access: setup and data 



    // Setter for a data file that follows our JSON layout
    this.setData = function(data)
    {
        this.data = data;
    },

    // Setter for a data file that follows our JSON layout
    this.setVr = function(data)
    {
        this.webVr = data;
    },
 
    // Disable or enable anti aliasing
    this.setAA = function(aa)
    {
        this.aa = aa;
    },

    // Disable or enable user interface
    this.disableGUI = function(val)
    {
        this.noGui = val;
    },

    // Add a performance widget
    this.showFps = function(val)
    {
        this.showFps = val;
    },
    
    
    // Set the level of detail mode
    this.setLOD = function(val)
    {
        this.lod = val;
    },



    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////// Annotation and inset handling 



    // Name is a unique identifier
    // x, y, z are the 3d positions (which will be projected to the current 2D position on the canvas)
    this.addAnnotation = function(name, x, y, z, text)
    {
        var elem = document.createElement('div');
        var textline = document.createTextNode(text); 
        elem.appendChild(textline);  
        elem.className += " annotationBox";
        var object = {}
        object["x"] = x;
        object["y"] = y;
        object["z"] = z;
        object["name"] = name;
        object["domObject"] = elem;
        this.annotations.push(object);
        document.body.appendChild(elem);

        // Let it fade in by giving it a class with opacity = 1
        elem.className += " annotationBoxVisible";
    },

    // Removes an annotation from DOM and from our list
    this.removeAnnotation = function(name)
    {
        for(var i = this.annotations.length - 1; i >= 0; i--)
        {
            if(this.annotations[i].name == name)
            {
                // Remove the visiblity-class, leads to fading out slowly
                this.annotations[i].domObject.classList.remove("annotationBoxVisible")
                // Remove it fully, but just after some seconds, so the fade out has finished at that time
                setTimeout(function(e){ document.body.removeChild(e); }, 5000, this.annotations[i].domObject); // Any time, but longer than animation from style.css
                // However, this can be removed immediately (doesn't affect the DOM)
                this.annotations.splice(i,1) 
            }
        }
    },

    // Projects a 3D pos to the current 2D pos on the canvas
    this.toScreenXY = function(pos, camera, canvas) 
    {
        var projScreenMat = new THREE.Matrix4();
        projScreenMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        pos.applyMatrix4(projScreenMat);
        return { x: (( pos.x + 1 ) * canvas.width / 2 + canvas.offsetLeft) / window.devicePixelRatio,
            y: (( - pos.y + 1) * canvas.height / 2 + canvas.offsetTop ) / window.devicePixelRatio};
    },

    // Moves the annotations to their correct 2D position (on top of the canvas)
    this.updateAnnotationPositions = function()
    {
        var scale = this.getScale()
        for(var i = 0; i < this.annotations.length; i++)
        {
            var newPos = this.toScreenXY(new THREE.Vector3(this.annotations[i].x, this.annotations[i].y, this.annotations[i].z).multiplyScalar(scale), this.camera, this.renderer.domElement)
            this.annotations[i].domObject.style.left = (10 + newPos.x) + "px"; // 10 and 20 depend on the size of the box, see style.css
            this.annotations[i].domObject.style.top = (20 + newPos.y) + "px";
        }
    },

    // Set labels for the axes tool
    this.setInsetLabels = function(x, y, z)
    {
        document.getElementById("insetLabelRed").innerHTML = x;
        document.getElementById("insetLabelGreen").innerHTML = y;
        document.getElementById("insetLabelBlue").innerHTML = z;
    },

    // Changes the inset's axes' labels according to current view mode
    // TODO: we currently only decide based on dataset 0's setting...
    this.updateInsetLabels = function()
    {
        if(this.gui.getValue("0_mercator__Level") < 0.5) // TODO Anything smarter here?
        {
            this.setInsetLabels("X", "Y", "Z")
        }
        else 
        {
            var zLabel = "time";
            if(this.gui.getValue("0_mercator__z Mapping") == 1) // TODO Anything smarter here?
            {
                zLabel = "signal";
            }
            else if(this.gui.getValue("0_mercator__z Mapping") == 2)
            {
                zLabel = "angle to start";
            }
            this.setInsetLabels("long.", "lat.", zLabel)
        }
    },

  

    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////// Array helpers



    // Creates an array of n times "elem"
    this.createFilledArray = function(elem, n)
    {
        var arr = [];
        for (var i = 0; i <= n; i++) 
        {
            arr.push(elem);
        };

        return arr;
    },

    // Just a little helper to shuffle an array
    this.shuffle = function(a) 
    {
        var j, x, i;
        for (i = a.length - 1; i > 0; i--) 
        {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }
        return a;
    },

   



    // Converts a trajectory to a list of tangents
    this.posToOrientation = function(positions, dim)
    {
        var result = new Array(positions.length);
        if(positions.length < 2 * dim)
        {
            return result.fill(0);
        }
        var debug = false
        for(var i = 0; i < positions.length; i += dim)
        {
            var i1 = (i == 0) ? 0 : (i - dim);
            var i2 = (i >= (positions.length - dim)) ? i : (i + dim);
            x = positions[i2] - positions[i1];
            y = (dim >= 2) ? (positions[i2 + 1] - positions[i1 + 1]) : 0;
            z = (dim >= 3) ? (positions[i2 + 2] - positions[i1 + 2]) : 0;     
    
            l = Math.sqrt(x*x + y*y + z*z);
            if(l == 0)
            {
                //console.log("Zero length at index " + i)
                l = 1;
                x = result[i1 + 0]
                y = result[i1 + 1]
                z = result[i1 + 2]
                //console.log("Corrected to " + x + " " + y + " " + z)
                debug = true
                
            }
            result[i] = x / l;
            if(dim >= 2) result[i+1] = y / l;
            if(dim >= 3) result[i+2] = z / l;
        }
        return result;
    },



    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////// Data loading and creation of shader source code



    // The actual program start, and start of the event loop
    this.start = function()
    {
        if (THREE.WEBGL.isWebGLAvailable() === false) 
        {
            document.body.appendChild(THREE.WEBGL.getWebGLErrorMessage());
        }
        this.actualTitle = document.title;
        this.niceColorsCopy = JSON.parse(JSON.stringify(this.niceColors))
        this.init();
        
        
        if(!this.webVr) 
        { 
            this.animateFrame(this); // without WEBVR: The traditional call
        }
        else 
        {
            this.renderer.setAnimationLoop( function () {
                this.animateFrame(this)
            }.bind(this) );
        }
        
        document.addEventListener("keydown", this.onDocumentKeyDown.bind(this), false);
        document.addEventListener("keyup", this.onDocumentKeyUp.bind(this), false);
        document.addEventListener("scroll", this.onDocumentScroll.bind(this), false);

        return; // TODO 
    },

    // Adds notes for a custom attribute to the list of attributes.
    // (Custom attribute means: something like meta data that is generated by this viewer. Let's call it "metadata".)
    this.addCustomAttribute = function(dataset, type, name, dependency, count, interpolate, normalize, shared)
    {
        var i = this.customAttributes.length;
        for(var j = 0; j < i; j++)
        {
            if(this.customAttributes[j]["name"] == name && this.customAttributes[j]["dataset"] == dataset)
            {
                return; // Don't add twice
            }
        }
        this.customAttributes.push({})
        this.customAttributes[i].type = type;
        this.customAttributes[i].dataset = dataset;
        this.customAttributes[i].dependency = dependency;
        this.customAttributes[i].count = count;
        this.customAttributes[i].name = name;
        this.customAttributes[i].interpolate = interpolate;
        this.customAttributes[i].normalize = normalize;
        this.customAttributes[i].shared = shared;
    },

    // Gets the index of a data attribute based on its name (reverse index)
    this.getDataAttributeIndex = function(setId, name)
    {
        for(var i = 0; i < this.dataAttributes.length; i++)
        {
            if(this.dataAttributes[i].name == name && this.dataAttributes[i].dataset == setId)
            {
                return i;
            }
        }
        return -1;
    },

    // Adds preliminary notes for a new data attribute to the list of attributes.
    // (Data attribute means: something directly copied from the given data, like position.) 
    this.addDataAttribute = function(dataset, name, dim, min, max, shared, fixedColor)
    {
        for(var i = 0; i < this.dataAttributes.length; i++)
        {
            if(this.dataAttributes[i].name == name && this.dataAttributes[i].dataset == dataset)
            {
                return;
            }
        }
        var i = this.dataAttributes.length
        var type = "float";
        if(dim == 2)
        {
            type = "vec2";
        }
        else if(dim == 3)
        {
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
    },

    // Adds preliminary notes for uniforms we want later to create inside the shader source code
    this.addCustomUniform = function(dataset, type, name, num, value)
    {
        for(var i = 0; i < this.customUniforms.length; i++)
        {
            if(this.customUniforms[i].name === name && this.customUniforms[i].dataset === dataset)
            {
                return;
            }
        }
        var newUniform = {}
        newUniform.dataset = dataset
        newUniform.type = type
        newUniform.name = name
        newUniform.num = num
        newUniform.value = value
        this.customUniforms.push(newUniform)
    },

    // Alters the shader source: add a color mode for each attribute (e.g. colorize according to time point).
    this.addColorModesToShader = function(setId, shader)
    {
        console.log("Add color modes", this.dataAttributes)
        var nl = "\n" + Array(5).join(" ");
        var code = nl;
        var magicNumber = 7; // Assuming we already have n color modes, so we add a (n+1)th one here
        for(var i = 0; i < this.dataAttributes.length; i++)
        {
            if(this.dataAttributes[i].dataset !== setId)
                continue; 
            var name = this.cleanVarName(this.dataAttributes[i].name);
            var lower = this.dataAttributes[i].fixedColor ? name + "Min" : "max(" + name + "Min, "+name+"From)";
            var upper = this.dataAttributes[i].fixedColor ? name + "Max" : "min("+name+"To," + name + "Max)";
            code += "else if(mode == "+(magicNumber + i )+") {float t = (v" + this.capitalizeFirst(name) +
            " - "+ lower +") / (" + upper + " - " + lower + "); gl_FragColor.xyz = (1. - t) * primaryColor + t * secondaryColor;}" + nl;
        }
        shader = shader.replace("#colorModes#", code);
        return shader
    },

    // Alters the shader source: add mercator height for each attribute (e.g. late time points -> higher peaks in mercator)
    this.addMercatorModesToShader = function(setId, shader)
    {
        var nl = "\n" + Array(5).join(" ");
        var code = nl;
        code += "if(false) {} " + nl; // Dummy - maybe something else?
        var magicNumber = 0; // Assuming we already have 0 mercator modes
        for(var i = 0; i < this.dataAttributes.length; i++)
        {
            if(this.dataAttributes[i].dataset !== setId)
                continue; 

            var name = this.cleanVarName(this.dataAttributes[i].name)
            var lower = this.dataAttributes[i].fixedColor ? name + "Min" : "max(" + name + "Min, "+name+"From)";
            var upper = this.dataAttributes[i].fixedColor ? name + "Max" : "min("+name+"To," + name + "Max)";
            code += "else if(mercatorMode == "+(magicNumber + i )+") {mercatorHeight = (v" + this.capitalizeFirst(name) +
            " - "+ lower +") / (" + upper + " - " + lower + ");}" + nl;
        }
        shader = shader.replace("#mercatorModes#", code);
        return shader
    },


    // Alters the shader source: adds a (remove-)filter based on each attribute ("discard if not in user-specified range").
    this.addFilterToShader = function(setId, shader, indent)
    {
        console.log("Add filter to shader for dataset:", setId)
        var nl = "\n" + Array(indent + 1).join(" ");
        var newCode = nl;
        for(var i = 0; i < this.dataAttributes.length; i++)
        {
            if(this.dataAttributes[i].dataset !== setId)
                continue; 
            console.log("Add ", this.dataAttributes[i].name, " to dataset ", this.dataAttributes[i].dataset)

            var name = this.cleanVarName(this.dataAttributes[i].name);
            if(this.dataAttributes[i].dim == 1)
            {
                newCode += "if(v" + this.capitalizeFirst(name) + " < " + name + "From"
                + " || v" + this.capitalizeFirst(name)+" > " + name + "To" 
                +") {discard; /*gl_FragColor.w = 0.0;*/} " + nl;
            }
        }

        shader = shader.replace("#attributeFilter#", newCode);
        return shader
    },

    // Alters the shader source: add uniforms. Will also include color-related attributes, which are
    // needed for some color-related uniforms.
    this.addUniformsToShader = function(setId, shader)
    {
        var newCode = "\n"
        for(var i = 0; i < this.customUniforms.length; i++)
        {

            if(this.customUniforms[i].dataset !== setId)
                continue; 

            var type = this.customUniforms[i].type;
            if(type == "color")
            {
                type = "vec3";
            }

            // The following is actually not yet supported in WebGL...
            var arrayExt = "";
            if(this.customUniforms[i].num > 1)
            {
                arrayExt = "[" + this.customUniforms[i].num + "]";
            }
            newCode += "uniform " + type + " " + this.cleanVarName(this.customUniforms[i].name) + arrayExt+ ";\n";
            
        }

        shader = shader.replace("#colorDefinition#", this.createAttributeForShader("colors", "vec3", "vSetId", 
            this.setsAndStates.length, false, false, false, false, 4));
        shader = shader.replace("#genericUniforms#", newCode);
        
        return shader
    },

    // Alters the shader source: varying for each vertex attribute
    this.addVaryingsToShader = function(setId, shader)
    {
        console.log("Add varyings to shader for dataset ", setId)
        var nl = Array(5).join(" ");
        var newCode = "\n";
        for(var i = 0; i < this.dataAttributes.length; i++)
        {
            if(this.dataAttributes[i].dataset !== setId)
                continue;

            var type = this.dataAttributes[i].type;
            if(type == "color")
            {
                type = "vec3";
            }
            newCode += "varying " + type + " v" + this.capitalizeFirst(this.cleanVarName(this.dataAttributes[i].name)) +";\n";
        }

        shader = shader.replace("#genericVaryings#", newCode);
        return shader
    },

    // Alters the shader source: interpolate state-specific attributes
    this.addCustomAttributesToShader = function(setId, shader)
    {
        console.log("Call addCustomAttributesToShader for dataset ", setId)
        var newCode = "\n";
        var newCodeInterp = "\n";
        for(var i = 0; i < this.customAttributes.length; i++)
        {
            if(this.customAttributes[i].dataset !== setId)
            continue; 
            console.log("Handle attribute ",i,", ", this.customAttributes[i].name)
            var name = this.cleanVarName(this.customAttributes[i].name)
            newCodeInterp += 
                this.createAttributeForShader(name, this.customAttributes[i].type, 
                this.customAttributes[i].dependency, 
                this.customAttributes[i].count, 
                this.customAttributes[i].shared, 
                this.customAttributes[i].interpolate, 
                this.customAttributes[i].normalize, true, 4);

            if(this.customAttributes[i].shared)
            {
                newCode += "attribute " + this.customAttributes[i].type + " " + name + ";\n";
            }
            else
            {
                for(var j = 0; j < this.customAttributes[i].count; j++)
                {
                    newCode += "attribute " + this.customAttributes[i].type + " " + name + j + ";\n";
                }
            }
        }

        shader = shader.replace("#genericAttributeInterpolation#", newCodeInterp);
        shader = shader.replace("#genericAttributes#", newCode)
        return shader
    },

    // Creates the source code for a shader. Especially it allows interpolation, if we have multiple states
    // of a dataset. Optionally, we can pass it as varying
    // E.g. if we have a dataset with 3 states, then the attribute "position" will result in:
    // - the three states, i.e. position1, position2, position3 (attributes)
    // - positionOut, which is placed inside the shader function. The value is interpolated from position1, 
    //   position2, position3, according to the current user-selected state
    // - optionally, a pass to vPosition (however, it assumes this varying was created elsewhere!)
    this.createAttributeForShader = function(attName, attType, dependency, count, shared, interpolate, normalize, addVarying, indent)
    {
        var nl = "\n" + Array(indent + 1).join(" ");
        var code = nl;
        if(shared)
        {
            code += attType + " " + attName + "Out = " + attName + ";\n";
        }
        else if(count == 1)
        {
            code += attType + " " + attName + "Out = " + attName + "0;\n";
        }
        else
        {
            code += "int "+attName+"Index = int("+dependency+");" + nl + "float "+attName+"Fade = "+dependency+" - float("+attName+"Index);" + nl;
            code += attType + " " + attName + "Out;" + nl;
            for(var i = 0; i < count; i++)
            {
                if(interpolate && i >= 1)
                {
                    code += "if("+dependency+" < float("+i+"))  {" + attName + "Out = (1. - "+attName+"Fade) * "+  attName + (i-1) + " + " + attName + "Fade * "+  attName + (i) + ";} " + nl + " else  "; 
                    if(i == count - 1)
                    {
                        code += "{" + attName + "Out = " + attName + (i) + ";}" + nl;
                    }
                }
                else if(!interpolate)
                {
                    code += "if(int("+dependency+") == "+i+")  {" + attName + "Out = "+ attName + (i) + ";}" + nl;
                }
            }
        }

        // Every attribute is finally forwarded to the fragment shader
        if(addVarying) code += "v" + this.capitalizeFirst(attName) + " = " + attName + "Out;" + nl;
        return code
    },
    
    // Creates a nice name applicable as variable name for shader code
    this.cleanVarName = function(name)
    {
        // There should be more rules, I guess...
        return name.replace(/ /g, "");
    },

    // Capitalizes only first word of a string
    this.capitalizeFirst = function(string) 
    {
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    // Currently "under construction". In general this function creates a single Object, like a line. However,
    // it might be necessary to subdivide the objects automatically (...) 
    this.addDataHelperLines = function(i, k, dim, numStates)
    {
        var elementSize = dim // for lines, and triangles, since "dim" (e.g. 3) values(x,y,z) must stay together
        var numElements = this.data.sets[i].states[0].positions[k].length / elementSize;
        var geometry = new THREE.BufferGeometry();

        geometry.type = this.data.sets[i].type
        geometry.originIndex = k;
        var setIds = this.createFilledArray(i, numElements - 1)
        var drawIndexValues = JSON.parse(JSON.stringify(this.data.sets[i].entities[k])) // this.createFilledArray(1, numElements - 1)
        geometry.addAttribute('setId', new THREE.Float32BufferAttribute(setIds, 1));
        geometry.addAttribute('drawIndex', new THREE.Float32BufferAttribute(drawIndexValues, 1));

        // Make it twice (once here, once as attribute), otherwise three js problems
        geometry.addAttribute('position', new THREE.Float32BufferAttribute(this.data.sets[i].states[0].positions[k]/**.slice(dim * fr, dim * to)**/, dim));
        
        geometry.setIndex(this.data.sets[i].indices[k])
        this.numGlPrimitives += this.data.sets[i].indices[k].length / 2;

        for(var j = 0; j < numStates; j++) // States, starting from 1!!!
        {
            var positions = this.data.sets[i].states[j].positions[k]/**.slice(dim * fr, dim * to)**/;
            var last = []
            for(var l = positions.length - dim; l < positions.length; l++)
            {
                last.push(positions[l] + (positions[l] - positions[l - dim])) // It's a fake, one step further
            }
            
            geometry.addAttribute('position' + j, new THREE.Float32BufferAttribute(positions, dim));
            geometry.addAttribute('nextPosition' + j, new THREE.Float32BufferAttribute(positions.slice(dim).concat(last), dim))

            for(var a = 0; a < this.data.sets[i].states[j].attributes.length; a++)
            {
                var aDim = this.data.sets[i].states[j].attributes[a].dim;
                var shared = this.data.sets[i].states[j].attributes[a].shared;
                var attName = this.data.sets[i].states[j].attributes[a].name;
                
                if(shared == true && j > 0)
                {
                    // Skip attributes if we share and have read the first one already.
                    // (We HAVE TO skip because maybe there are not even values for the subsequent ones.)
                    continue;
                }

                var values = this.data.sets[i].states[j].attributes[a].values[k]/**.slice(aDim * fr, aDim * to)**/
                if(shared == false)
                {
                    attName += j; // If we save all attributes, name them with number
                }
                geometry.addAttribute(this.cleanVarName(attName), new THREE.Float32BufferAttribute(values, aDim));

                var id = this.getDataAttributeIndex(i, this.data.sets[i].states[j].attributes[a].name)

                for(var vv = 0; vv < values.length; vv++)
                {
                    this.dataAttributes[id].min = Math.min(this.dataAttributes[id].min, values[vv])
                    this.dataAttributes[id].max = Math.max(this.dataAttributes[id].max, values[vv])
                }
            }
        }

        // Create a unique id with setId_lineId
        geometry.totalLineId = []
        for(var l = 0; l < this.data.sets[i].entities[k].length; l++)
        {
            geometry.totalLineId.push(i.toString() + "_" + this.data.sets[i].entities[k][l].toString());
        }

        console.log("Add state ", geometry)

        return geometry;
    },

    // Currently "under construction". In general this function creates a single Object, like a line. However,
    // it might be necessary to subdivide the objects automatically (...) 
    this.addDataHelperTriangles = function(i, k, dim, numStates)
    {
        console.log("Entities of", i, this.data.sets[i].entities)
        var elementSize = dim // for lines, and triangles, since "dim" (e.g. 3) values(x,y,z) must stay together
        var numElements = this.data.sets[i].states[0].positions[k].length / elementSize;
        var geometry = new THREE.BufferGeometry();
        geometry.type = this.data.sets[i].type
        geometry.originIndex = k;

        var setIds = this.createFilledArray(i, numElements - 1)
        var drawIndexValues = JSON.parse(JSON.stringify(this.data.sets[i].entities[k])) // this.createFilledArray(1, numElements - 1)

        geometry.addAttribute('setId', new THREE.Float32BufferAttribute(setIds, 1));
        geometry.addAttribute('drawIndex', new THREE.Float32BufferAttribute(drawIndexValues, 1));

        // Make it twice (once here, once as attribute), otherwise three js problems
        geometry.addAttribute('position', new THREE.Float32BufferAttribute(this.data.sets[i].states[0].positions[k], dim));
        geometry.addAttribute('normalCustom', new THREE.Float32BufferAttribute(this.data.sets[i].states[0].normals[k], dim));
        geometry.setIndex(this.data.sets[i].indices[k])
        this.numGlPrimitives += this.data.sets[i].indices[k].length / 3;

        for(var j = 0; j < numStates; j++) // States, starting from 1!!!
        {
            var positions = this.data.sets[i].states[j].positions[k]/**.slice(dim * fr, dim * to)**/;
            var last = []
            for(var l = positions.length - dim; l < positions.length; l++)
            {
                last.push(positions[l] + (positions[l] - positions[l - dim])) // It's a fake, one step further
            }
            
            geometry.addAttribute('position' + j, new THREE.Float32BufferAttribute(positions, dim));

            for(var a = 0; a < this.data.sets[i].states[j].attributes.length; a++)
            {
                var aDim = this.data.sets[i].states[j].attributes[a].dim;
                var values = this.data.sets[i].states[j].attributes[a].values[k]/**.slice(aDim * fr, aDim * to)**/
                var shared = this.data.sets[i].states[j].attributes[a].shared
                var attName = this.data.sets[i].states[j].attributes[a].name

                if(shared == true && j > 0)
                {
                    // Skip attributes if we share and have read the first one already
                    continue;
                }
                if(shared == false)
                {
                    attName += j; // If we save all attributes, name them with number
                }
                geometry.addAttribute(this.cleanVarName(attName), new THREE.Float32BufferAttribute(values, aDim));

                for(var vv = 0; vv < values.length; vv++)
                {
                    this.dataAttributes[a].min = Math.min(this.dataAttributes[a].min, values[vv])
                    this.dataAttributes[a].max = Math.max(this.dataAttributes[a].max, values[vv])
                }
            }
        }

        // Create a unique id with setId_triangleId
        geometry.totalLineId = []
        for(var l = 0; l < this.data.sets[i].entities[k].length; l++)
        {
            geometry.totalLineId.push(i.toString() + "_" + this.data.sets[i].entities[k][l].toString());
        }

        return geometry;
    },

    // Reads the data and builds up all the geometry
    this.preprocessData = function(data, i)
    {
        var dim = this.data.dim
        var objects = []

        this.setsAndStates.push({})
        this.setsAndStates[i].name = this.data.sets[i].name
        this.setsAndStates[i].scale = this.data.sets[i].scale
        this.setsAndStates[i].type = this.data.sets[i].type
        this.setsAndStates[i].states = {}

        // Quickly look for some infos about the states
        var numStates = this.data.sets[i].states.length;
        for(var j = 0; j < numStates; j++) // States
        {
            this.setsAndStates[i].states[j] = this.data.sets[i].states[j].name
        }

        // Collect some basic information about the optional attributes
        for(var a = 0; a < this.data.sets[i].states[0].attributes.length; a++)
        {
            var aDim = this.data.sets[i].states[0].attributes[a].dim;
            var name = this.data.sets[i].states[0].attributes[a].name;
            var shared = this.data.sets[i].states[0].attributes[a].shared;
            var fixedColor = this.data.sets[i].states[0].attributes[a].fixedColor;
            this.addDataAttribute(i, name, aDim, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, shared, fixedColor);
        }

        // Now we work on initial state (0) first and extend later on
        for(var k = 0; k < this.data.sets[i].states[0].positions.length; k++) // Objects
        {
            if(k % this.lod != 0)
            {
                console.log("Skip");
                continue;
            }
            this.setStatus(0, this.data.sets[i].states.length * this.data.sets[i].states[0].positions.length, 
                this.data.sets[i].states[0].positions.length * i + k, "Preparing data");
            var geometry = null;
            if(this.data.sets[i].type === "triangles")
            {
                geometry = this.addDataHelperTriangles(i, k, dim, numStates);
            }
            else 
            {
                //Lines
                geometry = this.addDataHelperLines(i, k, dim, numStates);
            }
            objects.push(geometry);
        }

        this.addCustomAttribute(i, "vec3", "position", "stateInternal", numStates, true, false, false);
        this.addCustomAttribute(i, "vec3", "nextPosition", "stateInternal", numStates, true, false, false);

        return objects
    },

    // Checks the data's extra attributes (except for position/orientation) and creates variables for the shader
    this.processAttributes = function(setId)
    {
        for(var a = 0; a <  this.dataAttributes.length; a++)
        {
            if(this.dataAttributes[a].dataset !== setId)
                continue;

            var aDim = this.dataAttributes[a].dim;
            var name = this.dataAttributes[a].name;
            var shared = this.dataAttributes[a].shared;
            var dataset = this.dataAttributes[a].dataset;
            var type = "";
            if(aDim == 1) {type = "float";}
            if(aDim == 2) {type = "vec2";}
            if(aDim == 3) {type = "vec3";}

            // For the shader source code
            this.addCustomAttribute(dataset, type, name, "state", this.dataAttributes.length, true, false, shared);
            this.addCustomUniform(  dataset, type, name+"From", 1, this.dataAttributes[a].min);
            this.addCustomUniform(  dataset, type, name+"To",   1, this.dataAttributes[a].max);
            this.addCustomUniform(  dataset, type, name+"Min",  1, this.dataAttributes[a].min);
            this.addCustomUniform(  dataset, type, name+"Max",  1, this.dataAttributes[a].max);

            // For the interface between graphics card and browser
            this.uniforms[this.dataAttributes[a].dataset][this.cleanVarName(this.dataAttributes[a].name+"From")] = new THREE.Uniform(this.dataAttributes[a].min)
            this.uniforms[this.dataAttributes[a].dataset][this.cleanVarName(this.dataAttributes[a].name+"To")]   = new THREE.Uniform(this.dataAttributes[a].max)
            this.uniforms[this.dataAttributes[a].dataset][this.cleanVarName(this.dataAttributes[a].name+"Min")]  = new THREE.Uniform(this.dataAttributes[a].min)
            this.uniforms[this.dataAttributes[a].dataset][this.cleanVarName(this.dataAttributes[a].name+"Max")]  = new THREE.Uniform(this.dataAttributes[a].max)
        }
    }

    // Initialization of THREE.js
    this.init = function()
    {
        
        document.body.innerHTML = document.body.innerHTML + 
            `<div id="selectionBox" hidden></div>
            <div id="inset"></div>
            <div id="insetLabel">
                <span id="insetLabelRed">X</span>, 
                <span id="insetLabelGreen">Y</span>, 
                <span id="insetLabelBlue">Z</span>
            </div>`;
        this.initGl();

        this.initGui();
    
        this.div = document.getElementById('selectionBox');
        this.makeAllElementsVisible()
    }

    // Holds default values for the uniforms of a line geometry
    this.getLineUniforms = function()
    {
        return {
            alpha: new THREE.Uniform(0.1),
            mode: new THREE.Uniform(0),
            mercatorMode: new THREE.Uniform(0),
            mercatorRadius: new THREE.Uniform(0.),
            lineColor: new THREE.Uniform(new THREE.Color(0xff003c)),
            primaryColor: new THREE.Uniform(new THREE.Color(0xe40e1a)),
            secondaryColor: new THREE.Uniform(new THREE.Color(0x0041df)),
            backgroundColor: new THREE.Uniform(new THREE.Color(this.backgroundColor)),
            defocusColor: new THREE.Uniform(new THREE.Color(0x888888)),
            defocusAlpha: new THREE.Uniform(0.02),
            defocusState: new THREE.Uniform(0.5),
            scale: new THREE.Uniform(1),
            colorScale: new THREE.Uniform(30),
            shading: new THREE.Uniform(0.),
            glossiness: new THREE.Uniform(10.),
            darkenInside : new THREE.Uniform(0.),
            mercator : new THREE.Uniform(0.),
            mercatorOffset : new THREE.Uniform(3.142 / 2.),
            mercatorOffset2 : new THREE.Uniform(0.),
            mercatorOffset3 : new THREE.Uniform(0.),
            zLower: new THREE.Uniform(-99999),
            zUpper: new THREE.Uniform(99999),
            xLower: new THREE.Uniform(-99999),
            xUpper: new THREE.Uniform(99999),
            yLower: new THREE.Uniform(-99999),
            yUpper: new THREE.Uniform(99999),
            state: new THREE.Uniform(0),
            projLevel: new THREE.Uniform(0),
            projPlane: new THREE.Uniform(new THREE.Vector3(0, 0, 99999)),
            projPlaneN: new THREE.Uniform(new THREE.Vector3(0, 0, 1))};
    },

    // Holds default values for the uniforms of a triangle geometry
    this.getTriangleUniforms = function()
    {
        return {
            alpha: new THREE.Uniform(0.1),
            mode: new THREE.Uniform(0),
            mercatorMode: new THREE.Uniform(0),
            mercatorRadius: new THREE.Uniform(0.),
            lineColor: new THREE.Uniform(new THREE.Color(0xff003c)),
            primaryColor: new THREE.Uniform(new THREE.Color(0xe40e1a)),
            secondaryColor: new THREE.Uniform(new THREE.Color(0xffe100)),
            backgroundColor: new THREE.Uniform(new THREE.Color(this.backgroundColor)),
            defocusColor: new THREE.Uniform(new THREE.Color(0x888888)),
            defocusAlpha: new THREE.Uniform(0.02),
            defocusState: new THREE.Uniform(0.5),
            scale: new THREE.Uniform(1),
            colorScale: new THREE.Uniform(30),
            shading: new THREE.Uniform(0.),
            glossiness: new THREE.Uniform(10.),
            darkenInside : new THREE.Uniform(0.),
            mercator : new THREE.Uniform(0.),
            mercatorOffset : new THREE.Uniform(1.57079632),
            mercatorOffset2 : new THREE.Uniform(0.),
            mercatorOffset3 : new THREE.Uniform(0.),
            zLower: new THREE.Uniform(-99999),
            zUpper: new THREE.Uniform(99999),
            xLower: new THREE.Uniform(-99999),
            xUpper: new THREE.Uniform(99999),
            yLower: new THREE.Uniform(-99999),
            yUpper: new THREE.Uniform(99999),
            projLevel: new THREE.Uniform(0),
            projPlane: new THREE.Uniform(new THREE.Vector3(0, 0, 99999)),
            projPlaneN: new THREE.Uniform(new THREE.Vector3(0, 0, 1)),

            state: new THREE.Uniform(0)};
    },

    // Holds default values for the uniforms of a line geometry
    this.getLineMaterial = function(i)
    {
        return new THREE.ShaderMaterial({ 
            uniforms: this.uniforms[i],
            transparent: true,
            linewidth: 2,
            depthFunc: THREE.AlwaysDepth, 
            blending: THREE.NormalBlending, 
            fragmentShader : this.addVaryingsToShader(i,
                this.addFilterToShader(i,
                    this.addColorModesToShader(i,
                        this.addUniformsToShader(i,this.fragmentShader)), 4)),
            vertexShader :  this.addVaryingsToShader(i,
                    this.addCustomAttributesToShader(i,
                        this.addMercatorModesToShader(i,
                            this.addUniformsToShader(i, this.vertexShaderLines))))
            });
    },

    // Holds default values for the uniforms of a triangle geometry
    this.getTriangleMaterial = function(i)
    {
        return new THREE.ShaderMaterial({ 
            uniforms: this.uniforms[i],
            transparent: true,
            depthFunc: THREE.AlwaysDepth,
            side:THREE.DoubleSide,
            blending: THREE.NormalBlending,
            fragmentShader : this.addVaryingsToShader(i,
                this.addFilterToShader(i,
                    this.addColorModesToShader(i,
                        this.addUniformsToShader(i, this.fragmentShader)), 4)),
            vertexShader :  this.addVaryingsToShader(i,
                    this.addCustomAttributesToShader(i,
                        this.addMercatorModesToShader(i,
                            this.addUniformsToShader(i,this.vertexShaderTriangle))))
            });
    },

    // "Low level" GL initialization and object creation. This function calls different helpers depending on
    // the geometry type.
    this.initGl = function() 
    {
        this.renderer = new THREE.WebGLRenderer({antialias: this.aa,
             alpha: true, stencil: false, preserveDrawingBuffer: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0.0);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.sortObjects = false
        this.renderer.depthWrite = false
        document.body.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(0, 0, 2);

        // Note: these controls are used whenever we are not in VR. In VR, however, we keep the camera fixed
        // but we rotate the scene. The reason is that he user "is" the camera and can --- in theory -- 
        // move around.
        //this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                
        // Trackball controls could be nice, but they are currently not working, maybe a version mismatch?!
        this.controls = new THREE.TrackballControls( this.camera, this.renderer.domElement );
        this.controls.staticMoving = true;
        this.controls.dynamicDampingFactor = 0;
        this.controls.rotateSpeed = 2.0;
        /*
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 0.8;
        this.controls.keys = [ 65, 83, 68 ];
        this.controls.addEventListener( 'change', this.render );
        */

        if(this.webVr)
        {
            this.renderer.vr.enabled = true
            this.vrControls = this.renderer.vr.getController( 0 );
            this.vrControls.addEventListener( 'selectstart', this.onVrSelectStart.bind(this) );
            this.vrControls.addEventListener( 'selectend', this.onVrSelectEnd.bind(this) );
            document.body.appendChild( THREE.WEBVR.createButton( this.renderer ) );
            this.controls.enabled = false;
        }
        this.controls.minDistance = 0;
        this.controls.maxDistance = 5000;

        // Give everything to the THREE scene, but create a father, which is used to scale the whole scene
        father = new THREE.Object3D()
        father.name = "father"

        // All the static uniforms
        if(typeof data == "string")
        {
            //alert("Data looks zipped. This saves 90% of traffic but takes some seconds extra to unzip.");
            this.data = JSON.parse(pako.inflate(atob(this.data), {to: 'string'}))
            console.log("Inflating object done")      
            console.log(this.data)              
        }

        for(var i = 0; i < this.data.sets.length; i++)
        {
            // Create basic uniforms. They will be complemented by data-specific uniforms.
            if(this.data.sets[i].type == "triangles")
            {
                this.uniforms[i] = this.getTriangleUniforms();
            }
            else 
            {
                this.uniforms[i] = this.getLineUniforms()
            }
            
            // Prepare the data
            objects = this.preprocessData(data, i)
            this.processAttributes(i)

            // The material (shaders...) must be created after the data has been analyzed!
            if(this.data.sets[i].type == "triangles")
            {
                this.material[i] = this.getTriangleMaterial(i)
            }
            else 
            {
                this.material[i] = this.getLineMaterial(i);
            }

            // Finally, add the geometry to the scene
            for(var j = 0; j < objects.length; j++)
            {
                var mesh = null
                if(objects[j].type === "triangles")
                {
                    mesh = new THREE.Mesh(objects[j], this.material[i]);
                }
                else
                {
                    mesh = new THREE.LineSegments(objects[j], this.material[i]);
                }
                mesh.sortObjects = false
                mesh.depthWrite = false
                mesh.frustumCulled = false
                mesh.selectable = this.data.sets[i].selectable;
                father.add(mesh);
            }
        }

        this.setStatus(0, 1, 1); // We are done

        // For webVr, move the scene into "head height" (something like 1.50m => y = 1.5)
        if(this.webVr)
        {
            father.position.add(this.webVrDisplacement)
        }

        this.scene.add(father);
        /*
        // DEBUG camera
        var geometry1 = new THREE.SphereGeometry( 0.2, 32, 32 );
        var material1 = new THREE.MeshBasicMaterial( {color: 0xffff00} );
        var sphere1 = new THREE.Mesh( geometry1, material1 );
        sphere1.position.add(this.webVrDisplacement)
        sphere1.position.add(new THREE.Vector3(0,0,-1))
        this.scene.add( sphere1 );
        */
        
        // Get extent of current data and set scale to make it fit the screen
        this.bbox = new THREE.Box3().setFromObject(father);
        recommendedScale = 2. / (this.bbox.max.x - this.bbox.min.x)
        this.setScale(recommendedScale)

        // Here we can find literally everything, in case we have to debug
        console.log("THIS:", this)

        // Have a look on the shaders immediately before rendering is performed (to see latest changes on shaders)
        //this.scene.children[0].onBeforeRender = function( renderer, scene, camera, geometry, material, group ) {    
        //    console.log(material.vertexShader); console.log(material.fragmentShader)        };

        // Add event listener, performance tool, GUI
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this.onWindowResize();
        this.stats = new Stats();
        
        if(this.noGui)
        {
            this.gui.hide();
        }
        
        if(this.showFps)
        {
            document.body.appendChild(this.stats.dom);
        }
        
        this.initInset()
    },

    // Add inset to the document
    this.initInset = function()
    {
        this.container2 = document.getElementById('inset');
        this.renderer2 = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer2.setClearColor( 0xf0f0f0, 0 );
        this.renderer2.setSize( document.getElementById("inset").offsetWidth, document.getElementById("inset").offsetHeight );
        
        // The inset doesn't make sense for VR since the camera is not moved there (only the objects). And we don't see it, since
        // the user can only "dive into one 3D canvas" anyway
        if(!this.webVr)
        {
            this.container2.appendChild( this.renderer2.domElement );
        }
        else 
        {
            document.getElementById("insetLabel").className += " hideMe";
        }

        this.scene2 = new THREE.Scene();
        this.camera2 = new THREE.PerspectiveCamera( 50, document.getElementById("inset").offsetWidth / document.getElementById("inset").offsetHeight, 0.1, 1000 );
        this.camera2.up = this.camera.up; // important!

        // axes
        this.axes2 = new THREE.AxesHelper( .81 );
        var colors = this.axes2.geometry.attributes.color;
        colors.setXYZ( 0, 1.0, 0.1, 0.1 ); // index, R, G, B
        colors.setXYZ( 1, 1.0, 0.1, 0.1 ); // red
        colors.setXYZ( 2, 0.2, .8, 0.1 );
        colors.setXYZ( 3, 0.2, .8, 0.1 ); // green
        colors.setXYZ( 4, 0.1, 0.4, 1 );
        colors.setXYZ( 5, 0.1, 0.4, 1 ); // blue
        this.axes2.material.linewidth = 2;
        this.scene2.add(this.axes2);
        this.doneLoading();
    },

    // Getter for scale of 3D objects. TODO: currently just returns scale of first child. 
    // However, we aim to keep scale the same for all children anyway
    this.getScale = function()
    {
        return this.scene.children[0].scale.x
    },

    // Sets scale to all objects of scene
    this.setScale = function(s)
    {
        for(var i = 0; i < this.scene.children.length; i++)
        {
            this.scene.children[i].scale.set(s, s, s)
        }
    },

    // Update camera and viewport when window size changes
    this.onWindowResize = function() 
    {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    // Animation loop. Gets new frame, moves annotations
    this.animateFrame = function() 
    {
        if(!this.webVr) 
        {
            this.updateAnnotationPositions(); 
            requestAnimationFrame(this.animateFrame.bind(this)); // without WEBVR: add this line
        }

        

        this.controls.update();

        this.stats.update();
        this.sortSegments()
        this.cameraUpdateCallback() // Camera changes are in here and called now to avoid synchronization problems

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
    },
    
    this.mergeSort = function(array, comparefn) 
    {
        function merge(arr, aux, lo, mid, hi, comparefn) 
        {
            var i = lo;
            var j = mid + 1;
            var k = lo;
            while(true)
            {
                var cmp = comparefn(arr[i], arr[j]);
                if(cmp <= 0){
                    aux[k++] = arr[i++];
                    if(i > mid){
                    do
                        aux[k++] = arr[j++];
                    while(j <= hi);
                    break;
                    }
                } else {
                    aux[k++] = arr[j++];
                    if(j > hi){
                    do
                        aux[k++] = arr[i++];
                    while(i <= mid);
                    break;
                    }
                }
            }
        }

        function sortarrtoaux(arr, aux, lo, hi, comparefn) 
        {
            if (hi < lo) return;
            if (hi == lo){
                aux[lo] = arr[lo];
                return;
            }
            var mid = Math.floor(lo + (hi - lo) / 2);
            sortarrtoarr(arr, aux, lo, mid, comparefn);
            sortarrtoarr(arr, aux, mid + 1, hi, comparefn);
            merge(arr, aux, lo, mid, hi, comparefn);
        }

        function sortarrtoarr(arr, aux, lo, hi, comparefn) {
            if (hi <= lo) return;
            var mid = Math.floor(lo + (hi - lo) / 2);
            sortarrtoaux(arr, aux, lo, mid, comparefn);
            sortarrtoaux(arr, aux, mid + 1, hi, comparefn);
            merge(aux, arr, lo, mid, hi, comparefn);
        }

        function merge_sort(arr, comparefn) {
            var aux = arr.slice(0);
            sortarrtoarr(arr, aux, 0, arr.length - 1, comparefn);
            return arr;
        }

        return merge_sort(array, comparefn);
    },


  
    // The sorting only considers start point of line. This can cause artifacts for sparse lines. However,
    // best way to avoid artifacts would be to provide more supporting points in the line (=> resampling).
    // After a full run of this function, all elements are sorted. To avoid sorting in this frame, we must
    // return early, which we e.g. do depending on time or camera motion (to increase the framerate)
    this.sortSegments = function()
    {
        // Stop sorting based on the time criterion, or when we we do not want to sort
        if( (this.sortFrequency == 4 && this.sortNeedShuffle == false) ||
            (this.sortFrequency == 3 && ((Date.now() - this.lastSort) < 5000)) ||
            this.sortFrequency == 2 && ((Date.now() - this.lastSort) < 1000) )
        {

            return;
        }
        
        // Stop sorting whenever we are still in the motion process
        var camPos = new THREE.Vector3(0, 0, 1000 ).unproject( this.camera ).divideScalar(this.getScale())
        if(this.webVr)
        {
            // TODO Actually we must consider both camera and rotation for webvr!
            var rotation = new THREE.Quaternion()
            rotation = this.scene.children[0].getWorldQuaternion(rotation)
            rotation = rotation.inverse(rotation)
            camPos = new THREE.Vector3(0, 0,-5 )
            camPos.applyQuaternion(rotation)
            camPos.add(this.webVrDisplacement)
            /*
            // DEBUG: Camera
            this.scene.children[1].position.set(0,0,0)
            this.scene.children[1].position.add(new THREE.Vector3(0,0,-5))
            this.scene.children[1].position.applyQuaternion(rotation)
            this.scene.children[1].position.add(this.webVrDisplacement)
            console.log("Distance:", this.scene.children[1].position.distanceTo(this.camera.position))
            */
        }
        if(this.sortFrequency == 0 && camPos.distanceTo(this.lastCamPos) > 0.0) // If camera has moved
        {
            this.lastCamPos = camPos
            this.lastCamPosUpdate = Date.now()
            this.sortedSinceLastCamPosUpdate = false
            return // Don't update render order while being on motion!
        }
        // Camera has not moved for LESS than a (0.3) second OR we already updated everything: also return
        else if(this.sortFrequency == 0 && (this.sortedSinceLastCamPosUpdate || (Date.now() - this.lastCamPosUpdate < 300))) 
        {
            return
        }

        var t0 = performance.now();
        var t0a = 0;

        // If we made it until here, we will finally sort the scene
        for(var i = 0; i < this.scene.children.length; i++)
        {
            for(var j = 0; j < this.scene.children[i].children.length; j++)
            {
                if(this.scene.children[i].children[j].geometry.index === null)
                {
                    //console.log("Skip unsortable elements (=no index list used)")
                    continue
                }

                var ind = this.scene.children[i].children[j].geometry.index.array // assignment just for convenience
                var indCopy = ind.slice(0)
                var pos = this.scene.children[i].children[j].geometry.attributes.position.array // TODO: or any pos1,2,...
                var elementSize = this.scene.children[i].children[j].type == "Mesh" ? 3 : 2
                var distances = new Float32Array(ind.length / elementSize) // Multiple indices represent one primitive. We only consider first for sorting.
                var cur = -1
                // Calculate squared distance cam--point for all starting points
                for(var k = 0; k < distances.length; k++)
                {
                    cur = 3 * ind[elementSize * k]
                    distances[k] = Math.pow(pos[cur] - camPos.x, 2) + Math.pow(pos[cur + 1] - camPos.y, 2) + Math.pow(pos[cur + 2] - camPos.z, 2);
                }
                t0a = performance.now();
                
                // Retrieve a sorted index list from the list of distances (as described in:
                // https://stackoverflow.com/questions/3730510/javascript-sort-array-and-return-an-array-of-indicies-that-indicates-the-positi )
                var sorted = new Int32Array(distances.length);
                for (var l = 0; l < distances.length ; ++l) sorted[l] = l;

                console.log("Sort")

                if(this.sortFrequency == 4)
                {
                    // Case "4", no sorting. If we made it to here, we want to shuffle
                    sorted = this.shuffle(sorted)
                    this.sortNeedShuffle = false
                }
                else 
                {
                    // Case: actual sorting. 

                    // Next: we define a sort function that puts the most distant first and the closest last
                    if(this.sortForward && !this.webVr)
                    {
                        //sorted.sort(function (a, b) {return distances[b] - distances[a]; });
                        sorted.sort(function (a, b) {return distances[a] > distances[b] ? -1 : distances[a] < distances[b] ? 1 : 0; });
                        //this.mergeSort(sorted, function (a, b) {return distances[a] > distances[b] ? -1 : 1; })
                    }
                    else 
                    {
                        //sorted.sort(function (a, b) {return distances[a] - distances[b]; });
                        sorted.sort(function (a, b) {return distances[a] < distances[b] ? -1 : distances[a] > distances[b] ? 1 : 0; });
                        //this.mergeSort(sorted, function (a, b) {return distances[a] < distances[b] ? -1 : 1; })
                    }
                }

                // Finally copy the sorted indices and tell THREE.js to update the geometry
                for(var l = 0; l < sorted.length; l++)
                {
                    for(var k = 0; k < elementSize; k++)
                    {
                        ind[elementSize * l + k] = indCopy[elementSize * sorted[l] + k]
                    }
                }
                this.scene.children[i].children[j].geometry.needsUpdate = true
                this.scene.children[i].children[j].geometry.index.needsUpdate = true
            }   
        }

        var t1 = performance.now();
        //console.log("Squaring time: ", t0a - t0)
        //console.log("Sorting time: ", t1 - t0)
        this.lastSort = Date.now()
        this.sortedSinceLastCamPosUpdate = true
    },
    


    ///////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////  GUI-Related functions



    // Load the default colors (for the variables provided by reference in parameter p)
    this.colorReset = function(p)
    {
        p.niceColors = JSON.parse(JSON.stringify(p.niceColorsCopy)); // deep copy array
        p.primary.setValue(0xf51818);
        p.secondary.setValue(0xffe100);
        p.background.setValue(0xdddddd);
    },

    // Colorize the data sets and primary/secondary according to the niceColors-array
    this.colorListTo3D = function(p)
    {
        this.gui.setValue(this.primary, p.niceColors[0])
        this.gui.setValue(this.secondary, p.niceColors[1])
    },

    // https://stackoverflow.com/questions/1484506/random-color-generator
    this.getRandomColor = function()
    {
        var letters = '0123456789ABCDEF';
        var color = '#';
        for (var i = 0; i < 6; i++) {
          color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    },

      


    // Create GUI elements and handle user interactions
    // TODO: clean up the mess with parameters p, p2, p, ...
    this.initGui = function() 
    {
        this.gui.create();

        this.gui.addMainHeadline("General settings")
        this.gui.addSelection("Gui scale", ["Small", "Medium", "Large"], 1, function(val) {this.scale((val == 0 ? 250 : (val == 1 ? 400 : 600)))}.bind(this), false)

        var cameraLinks = document.createElement("div");
        var cameraLinksTag = document.createElement("div");
        cameraLinksTag.innerHTML = "Reset camera";
        cameraLinksTag.classList.add("guiTag");
        cameraLinks.appendChild(cameraLinksTag);

        var directions = ["+x", "-x", "+y", "-y", "+z", "-z"]
        for(var i = 0; i < directions.length; i++)
        {
            var cameraLink = document.createElement("a");
            var d = directions[i];
            cameraLink.href = "#";
            cameraLink.classList.add("resetCamLink");
            cameraLink.innerHTML = d;
            var p = {context: this, d: d};
            cameraLink.onclick = function() {this.context.setCamera(this.d);}.bind(p);
            cameraLinks.appendChild(cameraLink);
        }

        this.gui.addChild(cameraLinks);
        this.gui.addFloat("Scene scale", 0.1, 5, this.getScale(), function(val) {this.setScale(val)}.bind(this), false)
        
        this.sortFrequency = 0; // this.numGlPrimitives > 100000 ? 0 : 1 // or decide based on number of triangles?
        this.gui.addSelection("Render: Update order", ["When not moving", "Every frame", "every 1s", "every 5s", "Never"],
            this.sortFrequency, function(val) {this.sortFrequency = val; this.sortNeedShuffle = val==4;}.bind(this), false)
        this.gui.addColor('Background color', '#'+this.material[0].uniforms.backgroundColor.value.getHexString(), function(val) {
            // Also tell the items about the background color. We use this to fade elements to background color.
            for(var setId = 0; setId < this.setsAndStates.length; setId++)
            {
                this.material[setId].uniforms.backgroundColor.value = new THREE.Color(val)
            }
            this.backgroundColor = val
        }.bind(this), false);    



        // Add dataset-specific properties, like a specific color for each dataset
        for(var setId = 0; setId < this.setsAndStates.length; setId++)
        {
            this.gui.addMainHeadline("Dataset " + (setId + 1) + ": " + this.setsAndStates[setId].name)
            var name = setId + "_" + this.setsAndStates[setId].name;
            var s = 1./parseFloat(this.setsAndStates[setId].scale);
            var start = 8; // Magic number, see above in the shader (color interpolation)


            // Here we add information for each attribute of the current dataset
            for(var i = 0; i < this.dataAttributes.length; i++)
            {
                if(this.dataAttributes[i].dataset !== setId)
                continue; // Only attributes of current dataset
                
                this.gui.addHeadline("Attribute filter: " + this.dataAttributes[i].name)
                var name = i + ": " + this.dataAttributes[i].name;

                // Parameter object, for this specific attribute
                var p = {};
                p.name = name;
                p.uniformName = this.cleanVarName(this.dataAttributes[i].name);
                p.i = i;
                p.to = parseFloat(this.dataAttributes[i].max);
                p.window = parseFloat(0);
                p.uniforms = this.material[setId].uniforms;
                p.setId = setId;
                p.gui = this.gui;

                this.gui.addFloat(setId + "_" + name + " __Min",  parseFloat(this.dataAttributes[i].min), 
                    parseFloat(this.dataAttributes[i].max), parseFloat(this.dataAttributes[i].min), function(val)
                    {
                        this.uniforms[this.uniformName + "From"].value = val;
                        var window = this.gui.getValue(this.setId +"_"+this.name+"__Window")
                        // The next one will set the "max" value automatically if the window is non-zero
                        if(window  > 0.0)
                        {
                            this.gui.setValue(this.setId +"_"+this.name+"__Max", parseFloat(val) + parseFloat(window))
                        }
                    }.bind(p))

                this.gui.addFloat(setId+"_"+name + "__Max", parseFloat(this.dataAttributes[i].min), parseFloat(this.dataAttributes[i].max),
                    parseFloat(this.dataAttributes[i].max), function(val) {this.uniforms[this.uniformName + "To"].value = val;}.bind(p))

                this.gui.addFloat(setId+"_"+name + "__Window", parseFloat(0), parseFloat(this.dataAttributes[i].max - this.dataAttributes[i].min),
                    parseFloat(0), function(val) {/*nothing to do*/}.bind(p))

                this.colorModeOptions.push(name)
                this.mercatorModeOptions.push(name)
            }
            
            // Parameter object, for this data set
            var p = {};
            p.niceColors = this.niceColors;
            p.niceColorsCopy = this.niceColorsCopy;
            p.primary = setId.toString()+"__Primary color";
            p.secondary = setId.toString()+"__Secondary color";
            p.defocus =setId.toString()+"__Defocus color";
            p.background = "Background color";
            p.setsAndStates = this.setsAndStates
            p.numStates = Object.keys(this.setsAndStates[setId].states).length
            p.colorListTo3D = this.colorListTo3D
            p.gui = this.gui
            p.getRandomColor = this.getRandomColor
            p.material = this.material[setId]
            p.setId = setId
            p.backgroundColor = this.backgroundColor
            p.updateInsetLabels = this.updateInsetLabels.bind(this)
            p.setScale = this.setScale.bind(this)
            
            this.gui.addHeadline("Render settings")
            this.gui.addColor(setId.toString()+'__Primary color', '#'+p.material.uniforms.primaryColor.value.getHexString(), 
                function(val) {this.material.uniforms.primaryColor.value = new THREE.Color(val)}.bind(p))
            this.gui.addColor(setId.toString()+'__Secondary color', '#'+p.material.uniforms.secondaryColor.value.getHexString(), 
                function(val) {this.material.uniforms.secondaryColor.value = new THREE.Color(val)}.bind(p))
            this.gui.addColor(setId.toString()+'__Defocus color', '#'+p.material.uniforms.defocusColor.value.getHexString(), 
                function(val) {this.material.uniforms.defocusColor.value = new THREE.Color(val)}.bind(p))
            
            this.gui.addSelection( setId.toString()+'__Color presets', ["Default", "Dark red/blue", "Shuffle all","Cream 1", 
            "Cream 2", "Cyan", "Neon", "Nico", "Warm blue/red", "b/w", "b/w inverse", "ice", "purple", "ocean"], 0, function(val) {  
                if(val == 1)
                {
                    this.gui.setValue(this.primary, "#dc0d0d")
                    this.gui.setValue(this.secondary, "#1192f6")
                    this.gui.setValue(this.background, "#080b1a")
                    this.gui.setValue(this.defocus, "#4f4e51")
                }
                else if(val == 2)
                {
                    this.gui.setValue(this.primary,    this.getRandomColor())
                    this.gui.setValue(this.secondary,  this.getRandomColor())
                    this.gui.setValue(this.background, this.getRandomColor())
                    this.gui.setValue(this.defocus, this.getRandomColor())
                }
                else if(val == 3)
                {
                    this.gui.setValue(this.primary, "#123C69")
                    this.gui.setValue(this.secondary, "#AC3B61")
                    this.gui.setValue(this.background, "#f0cdbc")
                    this.thguiis.setValue(this.defocus, "#9f9f9f")
                    
                }
                else if(val == 4)
                {
                    this.gui.setValue(this.primary, "#6ca56b")
                    this.gui.setValue(this.secondary, "#e5e4d4")
                    this.gui.setValue(this.background, "#9a6755")
                    this.gui.setValue(this.defocus, "#5a362a")
                }
                else if(val == 5)
                {
                    this.gui.setValue(this.primary, "#FFE400")
                    this.gui.setValue(this.secondary, "#f70253")
                    this.gui.setValue(this.background, "#10E7DC")
                    this.gui.setValue(this.defocus, "#ffffff")
                }
                else if(val == 6)
                {
                    this.gui.setValue(this.primary, "#f3f315")
                    this.gui.setValue(this.secondary, "#ff0099")
                    this.gui.setValue(this.background, "#111111")
                    this.gui.setValue(this.defocus, "#888888")
                }
                else if(val == 7)
                {
                    this.gui.setValue(this.primary, "#00b0e6")
                    this.gui.setValue(this.secondary, "#ff001e")
                    this.gui.setValue(this.background, "#ffffff")
                    this.gui.setValue(this.defocus, "#888888")
                }
                else if(val == 8) // warm blue red yellow
                {
                    this.gui.setValue(this.primary, "#f5ed70")
                    this.gui.setValue(this.secondary, "#e03335")
                    this.gui.setValue(this.background, "#0a7fa2")
                    this.gui.setValue(this.defocus, "#065e7c")
                }
                else if(val == 9) // black and white
                {
                    this.gui.setValue(this.primary, "#000000")
                    this.gui.setValue(this.secondary, "#737373")
                    this.gui.setValue(this.background, "#ffffff")
                    this.gui.setValue(this.defocus, "#bfbfbf")
                }
                else if(val == 10) // black and white inverse
                {
                    this.gui.setValue(this.primary, "#ffffff")
                    this.gui.setValue(this.secondary, "#313131")
                    this.gui.setValue(this.background, "#000000")
                    this.gui.setValue(this.defocus, "#414141")
                }
                else if(val == 11) // ice
                {
                    this.gui.setValue(this.primary, "#00787e")
                    this.gui.setValue(this.secondary, "#92f5fa")
                    this.gui.setValue(this.background, "#07242a")
                    this.gui.setValue(this.defocus, "#1e152f")
                }
                else if(val == 12) // purple
                {
                    this.gui.setValue(this.primary, "#1d8c80")
                    this.gui.setValue(this.secondary, "#edaf9b")
                    this.gui.setValue(this.background, "#43283f")
                    this.gui.setValue(this.defocus, "#24454d")
                }
                else if(val == 13) // purple
                {
                    this.gui.setValue(this.primary, "#fff673")
                    this.gui.setValue(this.secondary, "#00ca60")
                    this.gui.setValue(this.background, "#042a55")
                    this.gui.setValue(this.defocus, "#214588")
                }
                else 
                {
                    this.gui.setValue(this.primary, "#e40e1a")
                    this.gui.setValue(this.secondary, "#0041df")
                    this.gui.setValue(this.background, "#e2e2e2")
                    this.gui.setValue(this.defocus, "#888888")
                }
            }.bind(p))
            
            this.gui.addSelection(setId.toString()+'__Color mode', this.colorModeOptions, 0, function(val) {this.material.uniforms["mode"].value = val;}.bind(p));

            this.gui.addFloat(setId.toString()+'__Line width (test)', 0, 20, 2,  function(val) {this.material.linewidth = val}.bind(p))
            this.gui.addFloat(setId.toString()+'__Fade out behind center', 0, 1, 0, function(val) {this.material.uniforms.darkenInside.value = val}.bind(p))
            this.gui.addFloat(setId.toString()+'__Shading', 0, 2, 0,             function(val) {this.material.uniforms.shading.value = val}.bind(p))
            this.gui.addFloat(setId.toString()+'__Glossiness', 0, 200, 10,     function(val) {this.material.uniforms.glossiness.value = val}.bind(p))
            this.gui.addFloat(setId.toString()+'__Alpha', 0, 1, 0.1,             function(val) {this.material.uniforms.alpha.value = val}.bind(p))
            if(p.numStates > 1)
            {
                console.log("Num states:", p.numStates);
                this.gui.addFloat(setId.toString()+'__State', 0, p.numStates - 1, 0,     function(val) {this.material.uniforms.state.value = val}.bind(p))
            }
            this.gui.addFloat(setId.toString()+'__Defocus alpha', 0, 1, 0.02,       function(val) {this.material.uniforms.defocusAlpha.value = val}.bind(p))
            
            if(p.numStates > 1)
            {
                this.gui.addFloat(setId.toString()+'__Defocus state', 0, p.numStates - 1, 0,       function(val) {this.material.uniforms.defocusState.value = val}.bind(p))
            }
            this.gui.addHeadline("Mercator projections")
            this.gui.addFloat(setId.toString()+'_mercator__Level', 0, 1, 0, function(val) {this.material.uniforms.mercator.value = val;this.updateInsetLabels();}.bind(p))
            this.gui.addFloat(setId.toString()+'_mercator__Rotation x', 0, 6.28318, 1.57079632, function(val) {this.material.uniforms.mercatorOffset.value = val}.bind(p))
            this.gui.addFloat(setId.toString()+'_mercator__Rotation y', 0, 6.28318, 0, function(val) {this.material.uniforms.mercatorOffset2.value = val}.bind(p))
            this.gui.addFloat(setId.toString()+'_mercator__Rotation z', 0, 6.28318, 0, function(val) {this.material.uniforms.mercatorOffset3.value = val}.bind(p))
            this.gui.addFloat(setId.toString()+'_mercator__z Scale', 0, 10, 0,   function(val) {this.material.uniforms.mercatorRadius.value = val}.bind(p))
            
            this.gui.addSelection(setId.toString()+'_mercator__z Mapping', this.mercatorModeOptions, 0, function(val) 
            {
                this.material.uniforms["mercatorMode"].value = val
                this.updateInsetLabels()
            }.bind(p));

            this.gui.addHeadline("Cutting planes")
            
            this.gui.addFloat(setId.toString()+'_cutting plane:__x Min', s * this.bbox.min.x, s * this.bbox.max.x, s * this.bbox.min.x, function(val) {this.material.uniforms.xLower.value = val / s}.bind(p))
            this.gui.addFloat(setId.toString()+'_cutting plane:__x Max', s * this.bbox.min.x, s * this.bbox.max.x, s * this.bbox.max.x, function(val) {this.material.uniforms.xUpper.value = val / s}.bind(p))
            this.gui.addFloat(setId.toString()+'_cutting plane:__y Min', s * this.bbox.min.y, s * this.bbox.max.y, s * this.bbox.min.y, function(val) {this.material.uniforms.yLower.value = val / s}.bind(p))
            this.gui.addFloat(setId.toString()+'_cutting plane:__y Max', s * this.bbox.min.y, s * this.bbox.max.y, s * this.bbox.max.y, function(val) {this.material.uniforms.yUpper.value = val / s}.bind(p))
            this.gui.addFloat(setId.toString()+'_cutting plane:__z Min', s * this.bbox.min.z, s * this.bbox.max.z, s * this.bbox.min.z, function(val) {this.material.uniforms.zLower.value = val / s}.bind(p))
            this.gui.addFloat(setId.toString()+'_cutting plane:__z Max', s * this.bbox.min.z, s * this.bbox.max.z, s * this.bbox.max.z, function(val) {this.material.uniforms.zUpper.value = val / s}.bind(p))

            this.gui.addHeadline("Projection on 2D plane in 3D space")
            this.gui.addFloat(setId.toString()+'__Projection level', 0, 1, 0, function(val) {this.material.uniforms.projLevel.value = val}.bind(p))
            this.gui.addFloat(setId.toString()+'__Center x', s * this.bbox.min.x, s * this.bbox.max.x, 0, function(val) {this.material.uniforms.projPlane.value.setX(val / s)}.bind(p))
            this.gui.addFloat(setId.toString()+'__Center y', s * this.bbox.min.y, s * this.bbox.max.y, 0, function(val) {this.material.uniforms.projPlane.value.setY(val / s)}.bind(p))
            this.gui.addFloat(setId.toString()+'__Center z', s * this.bbox.min.z, s * this.bbox.max.z, s * this.bbox.max.z, function(val) {this.material.uniforms.projPlane.value.setZ(val / s)}.bind(p))
            this.gui.addFloat(setId.toString()+'__Normal x', -1., 1., 0., function(val) {this.material.uniforms.projPlaneN.value.setX(val)}.bind(p))
            this.gui.addFloat(setId.toString()+'__Normal y', -1., 1., 0., function(val) {this.material.uniforms.projPlaneN.value.setY(val)}.bind(p))
            this.gui.addFloat(setId.toString()+'__Normal z', -1., 1., 1., function(val) {this.material.uniforms.projPlaneN.value.setZ(val)}.bind(p))
    
        }    

        // Default elements for gui
        this.gui.addMainHeadline("Tours and Data Export");
        var screenshotLinkHolder = document.createElement("div");
        screenshotLinkHolder.setAttribute("id", "screenshotLinkHolder");
        var screenshotLink = document.createElement("a");
        screenshotLink.innerHTML = "&bull; Screenshot";
        screenshotLink.href = "#"; 
        screenshotLink.id = "screenshotButton"; 
        screenshotLink.onclick = this.screenshot.bind(this);
        this.gui.addChild(screenshotLink);


        var exportLinkHolder = document.createElement("div");
        exportLinkHolder.setAttribute("id", "exportLinkHolder");
        var exportLink = document.createElement("a");
        //exportLink.setAttribute("id", "exportLinkHolder");
        exportLink.innerHTML = "&bull; Download selection";
        exportLink.id = "exportButton"; 
        exportLink.href = "#"; 
        exportLink.onclick = this.exportSelection.bind(this);
        var exportLinkStatus = document.createElement("span");
        exportLinkStatus.style.marginLeft = "5px";
        exportLinkStatus.id = "exportButtonStatus";
        exportLinkHolder.appendChild(exportLink)
        exportLinkHolder.appendChild(exportLinkStatus)
        this.gui.addChild(exportLinkHolder);
    },



    ///////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////// Selection-related and clicking-related functions


    // Does user click trigger and mouse simultaneously?
    this.clickAndEnterPressing = function() 
    {
        return this.pressingEnter && this.clickingMouseButton;
    },

    // Calculate selection box
    this.reCalc = function() 
    {
        this.x3 = Math.min(this.x1, this.x2);
        this.x4 = Math.max(this.x1, this.x2);
        this.y3 = Math.min(this.y1, this.y2);
        this.y4 = Math.max(this.y1, this.y2);
        this.div.style.left   = this.x3 + 'px';
        this.div.style.top    = this.y3 + 'px';
        this.div.style.width  = this.x4 - this.x3 + 'px';
        this.div.style.height = this.y4 - this.y3 + 'px';
    },

    // onmousedown event handler, and only if trigger button is pressed, too
    this.onmousedown = function(e) 
    {
        if(this.pressingButton)
        {
            this.clickingMouseButton = true
            this.div.hidden = 0;
            this.x1 = e.clientX;
            this.y1 = e.clientY;
            this.reCalc();
        }
        else if(this.webVr)
        {
            this.clickingVrOnCanvas = true
        }
    },

    // Handler for mouse motion
    this.onmousemove = function(e) 
    {
        if(this.clickingMouseButton)
        {
            this.x2 = e.clientX;
            this.y2 = e.clientY;
            this.reCalc();
        }
        else if(this.clickingVrOnCanvas)
        {
            console.log("vr move", e.clientX, e.clientY)
            if(this.lastVrPosX != null && this.lastVrPosY != null)
            {
                var diffX = e.clientX - this.lastVrPosX
                var diffY = e.clientY - this.lastVrPosY
                console.log("Move object by", diffX, diffY)

                this.scene.children[0].rotation.y += 0.01 * diffX;
                this.scene.children[0].rotation.x += 0.01 * diffY;
                //console.log(
                
            }

            this.lastVrPosX = e.clientX
            this.lastVrPosY = e.clientY
        }
    },


    // Handler of mouse release. Calculates the corner points of the selection in world space, also for near and far
    this.onmouseup = function(e) 
    {
        if(this.div.hidden == 0)
        {
            var ww = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
            var hh = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
            this.y1 = hh - this.y1;
            this.y2 = hh - this.y2;
            var fromX = (this.x1 / ww) * 2. - 1.;
            var fromY = (this.y1 / hh) * 2. - 1.;
            var toX = (this.x2 / ww) * 2. - 1.;
            var toY = (this.y2 / hh) * 2. - 1.;
            
            var scale = this.getScale()
            var p1Near = new THREE.Vector3(fromX, fromY, -1 ).unproject( this.camera ).divideScalar(scale);
            var p2Near = new THREE.Vector3(toX,   fromY, -1 ).unproject( this.camera ).divideScalar(scale);
            var p3Near = new THREE.Vector3(toX,   toY,   -1 ).unproject( this.camera ).divideScalar(scale);
            var p4Near = new THREE.Vector3(fromX, toY,   -1 ).unproject( this.camera ).divideScalar(scale);
            var p1Far  = new THREE.Vector3(fromX, fromY,  1 ).unproject( this.camera ).divideScalar(scale);
            var p2Far  = new THREE.Vector3(toX,   fromY,  1 ).unproject( this.camera ).divideScalar(scale);
            var p3Far  = new THREE.Vector3(toX,   toY,    1 ).unproject( this.camera ).divideScalar(scale);
            var p4Far  = new THREE.Vector3(fromX, toY,    1 ).unproject( this.camera ).divideScalar(scale);
            this.checkPoints(p1Near, p2Near, p3Near, p4Near, p1Far, p2Far, p3Far, p4Far)
        }
        else if(this.clickingVrOnCanvas)
        {
            this.clickingVrOnCanvas = false
            this.lastVrPosX = null
            this.lastVrPosY = null
        }

        this.div.hidden = 1;
        this.clickingMouseButton = false
    },

    // Handles the beginning of a "click" with (the first) webVR controller
    this.onVrSelectStart = function()
    {
        this.clickingVrControllerButton = true
        this.onVrMoveObserver()
    },

    // Handles the end of a "click" with (the first) webVR controller
    this.onVrSelectEnd = function()
    {
        this.clickingVrControllerButton = false
        this.lastVrRotation = null
    },

    // Permanently checks the rotation of the webVR controller and uses the rotation to rotate the data.
    // Note, since most webVR controllers, we cannot (easily) use something like a "onMove" event. That's
    // why we only use the (very general) onVrSelectStart/onVrSelectEnd to trigger our custom observer.
    this.onVrMoveObserver = function()
    {
        if(this.lastVrRotation !== null)
        {
            var diffX = this.lastVrRotation.x - this.vrControls.rotation.x
            var diffY = this.lastVrRotation.y - this.vrControls.rotation.y

            // minimize the chance that this.lastVrRotation has changed to null in the mean time
            if(this.clickingVrControllerButton) 
            {
                this.scene.children[0].rotation.x += 2. * diffX;
                this.scene.children[0].rotation.y += 2. * diffY;
            }
        }
        
        // infinite loop: call itself again if user still holds the button
        if(this.clickingVrControllerButton)
        {
            this.lastVrRotation = new THREE.Vector3(this.vrControls.rotation.x, this.vrControls.rotation.y, this.vrControls.rotation.z)
            setTimeout(function(p) {p.onVrMoveObserver().bind(p);}, 20, this);
        }
    },

    

    // Handler of double click: display everything
    this.ondblclick = function()
    {
        this.makeAllElementsVisible();
    },

    // Get a plane formed by three points
    this.getPlane = function(p1, p2, p3)
    {
        var v1 = new THREE.Vector3(p2.x, p2.y, p2.z); // = p2
        v1.sub(p1); // = p2 - p1
        var v2 =  new THREE.Vector3(p2.x, p2.y, p2.z); // = p2
        v2.sub(p3); // = p2 - p3
        var n = new THREE.Vector3(v1.x, v1.y, v1.z);
        n = n.cross(v2);
        var d = (p2.x * n.x + p2.y * n.y + p2.z * n.z);
        return {"a" : n.x, "b" : n.y, "c" : n.z, "d" : -d}
    },

    // Check if x/y/z is "left of that plane"
    this.isInside = function(plane, x, y, z)
    {
        return (x * plane.a + y * plane.b + z * plane.c + plane.d) > 0;
    },

    // Show all elements
    this.makeAllElementsVisible = function()
    {
        this.currentSelection = {}
        for(var i = 0; i < this.scene.children[0].children.length; i++)
        {
            var k = this.scene.children[0].children[i].geometry.originIndex;
            var newValues = JSON.parse(JSON.stringify(this.data.sets[i].entities[k]))

            this.scene.children[0].children[i].geometry.attributes.drawIndex.setArray(new Float32Array(newValues));
            this.scene.children[0].children[i].geometry.attributes.drawIndex.needsUpdate = true;
            for(var j = 0; j < this.scene.children[0].children[i].geometry.totalLineId.length; j++)
            {
                this.currentSelection[this.scene.children[0].children[i].geometry.totalLineId[j]] = 1
            }
        }
    },

    // Hide all elements
    this.makeAllElementsInvisible = function()
    {
        for(var i = 0; i < this.scene.children[0].children.length; i++)
        {
            //this.scene.children[0].children[i].visible = false;
            var newValues = this.createFilledArray(-1, 
                this.scene.children[0].children[i].geometry.attributes.drawIndex.array.length);
            this.scene.children[0].children[i].geometry.attributes.drawIndex.setArray(new Float32Array(newValues));
            this.scene.children[0].children[i].geometry.attributes.drawIndex.needsUpdate = true;
        }
    },

    // Get elements that are within that cube formed by p1, p2, p3, p4 (front face) and p5, p6, p7, p8 (back face)
    this.checkPoints = function(p1, p2, p3, p4, p5, p6, p7, p8)
    {
        var plane1 = this.getPlane(p1, p2, p5);
        var plane2 = this.getPlane(p2, p3, p6);
        var plane3 = this.getPlane(p3, p4, p7);
        var plane4 = this.getPlane(p4, p1, p8);

        var clickedElements = []
        this.currentSelection = {};

        // First we check which element is actually visible
        var rememberVisible = {}
        for(var i = 0; i < this.scene.children[0].children.length; i++)
        {
            for(var j = 0; j < this.scene.children[0].children[i].geometry.attributes.drawIndex.array.length; j++)
            {
                if(this.scene.children[0].children[i].geometry.attributes.drawIndex.array[j] > 0.5)
                {
                    rememberVisible[this.scene.children[0].children[i].geometry.totalLineId[j]] = 1;
                }
            }
        }

        // Now we iterate over all elements (except for already "invisible" ones) and check 
        // if they are part of the new selection
        for(var i = 0; i < this.scene.children[0].children.length; i++)
        {
            for(var j = 0; j < this.scene.children[0].children[i].geometry.attributes.drawIndex.array.length; j++)
            {
                var lineId = this.scene.children[0].children[i].geometry.totalLineId[j];
                if(rememberVisible[lineId] === undefined || this.currentSelection[lineId] !== undefined)
                {
                    // We should not consider that since 
                    // We have been here a moment ago 
                    continue
                }
                var x = this.scene.children[0].children[i].geometry.attributes.position.array[3 * j + 0];
                var y = this.scene.children[0].children[i].geometry.attributes.position.array[3 * j + 1];
                var z = this.scene.children[0].children[i].geometry.attributes.position.array[3 * j + 2];

                if(this.scene.children[0].children[i].selectable)
                {
                    if(this.isInside(plane1, x, y, z) && this.isInside(plane2, x, y, z) &&
                        this.isInside(plane3, x, y, z) && this.isInside(plane4, x, y, z))
                    {
                        clickedElements.push(this.scene.children[0].children[i].geometry.totalLineId[j])
                        this.currentSelection[lineId] = 1;
                    }
                }
                else
                {
                    clickedElements.push(this.scene.children[0].children[i].geometry.totalLineId[j])
                    this.currentSelection[lineId] = 1; 
                }
            }
        }

        this.hideAllButSelected(this.currentSelection);
        console.log(this.currentSelection)
    },

    // Hides all elements that are not within the selected "cube"
    this.hideAllButSelected = function(selectionMap)
    {
        // Hide all first, then show the elements that match the criteria
        this.makeAllElementsInvisible()
        console.log("SelectionMap", selectionMap)

        for(var i = 0; i < this.scene.children[0].children.length; i++)
        {
            var k = this.scene.children[0].children[i].geometry.originIndex;
            var newValues = this.createFilledArray(-1, 
                this.scene.children[0].children[i].geometry.attributes.drawIndex.array.length);
            
            for(var j = 0; j < this.scene.children[0].children[i].geometry.attributes.drawIndex.array.length; j++)
            {
                var lineId = this.scene.children[0].children[i].geometry.totalLineId[j];
                if(selectionMap[lineId] !== undefined)
                {
                    newValues[j] = this.data.sets[i].entities[k][j]           //this.scene.children[0].children[i].visible = true;;
                }
            }
            this.scene.children[0].children[i].geometry.attributes.drawIndex.setArray(new Float32Array(newValues));
            this.scene.children[0].children[i].geometry.attributes.drawIndex.needsUpdate = true;
        }
    },

    this.getSelection = function()
    {
        return this.currentSelection;
    }

    this.disableExportButton = function() {
        var e = document.getElementById("exportButton");
        e.style.opacity = 0.5;
        e.style.cursor = "default";
        e.onclick = 0;
    }

    this.enableExportButton = function() {
        var e = document.getElementById("exportButton");
        e.style.opacity = 1.;
        e.style.cursor = "pointer";
        e.onclick = this.exportSelection.bind(this);
        var e2 = document.getElementById("exportButtonStatus");
        e2.innerHTML = ""
    }

    this.getExportLine = function(data, entity, index, dim)
    {
        var code = ""
        for(var i = 0; i < dim; i++)
        {
            code += data.positions[entity][index * dim + i] + ";";
        }
        for(var i = 0; i < data.attributes.length; i++)
        {   
            // They may not exist or be incomplete, if data is shared
            if(data.attributes[i].values === undefined)
                continue; 
            if(data.attributes[i].values.length <= entity)
                continue; 
            if(data.attributes[i].values[entity].length <= index)
                continue; 
            code += data.attributes[i].values[entity][index] + ";";
        }
        code += "\n";
        return code 
    }

    this.getExportHeader = function(data, entity, dim)
    {
        var code = ""
        var dims = ["x", "y", "z", "w"];
        for(var i = 0; i < dim; i++)
        {
            code += dims[i] + ";";
        }
        for(var i = 0; i < data.attributes.length; i++)
        {   
            // They may not exist or be incomplete, if data is shared
            if(data.attributes[i].values === undefined)
                continue; 
            if(data.attributes[i].values.length <= entity)
                continue; 
            if(data.attributes[i].values[entity].length === 0)
                continue; 
            code += data.attributes[i].name + ";";
        }
        code += "\n";
        return code 
    }


    this.exportShowStatus = function(description, current, sparse, maximum = null)
    {
        if(current % sparse == 0)
            document.getElementById("exportButtonStatus").innerHTML = description + 
                ": " + current + (maximum === null ? "" : (" of " + maximum))
    }

    this.exportPrepareData = function()
    {
        var selectionMap = this.currentSelection
        var sets = [];
        var dim = 3;

        for(var i = 0; i < this.data.sets.length; i++)
        {
            console.log("Iterate over data sets ... now set ", i)
            var set = {}
            set.name = i + "_" + this.data.sets[i].name;
            var numIndices = 2;
            if(this.data.sets[i].type !== "lines")
                continue; // TODO currently only export of lines
            set.states = [];
            console.log(this.data.sets[i].indices)
            console.log(this.data.sets[i].states)
            counter = 0;
            for(var j = 0; j < this.data.sets[i].states.length; j++)
            {
                console.log("Iterate over data set states ... now state ", j)
                var state = {}
                state.name = j + "_" + this.data.sets[i].states[j].name;
                state.elements = []
                for(var k = 0; k < this.data.sets[i].entities.length; k++)
                {
                    var skip = false;
                    var lastEntity = -1;
                    var code = "";
                    for(var m = 1; m < this.data.sets[i].entities[k].length; m++)
                    {
                        if(lastEntity !== this.data.sets[i].entities[k][m])
                        {
                            //console.log("new line", this.data.sets[i].entities[k][m])
                            counter++;
                            this.exportShowStatus("Converting trajectories", counter, 100)
                            skip = false;
                            var lineId = i.toString() + "_" + this.data.sets[i].entities[k][m].toString();
                            if(selectionMap[lineId] === undefined)
                            {
                                skip = true;
                            }
                            //console.log(code)
                            if(code !== "")
                                state.elements.push(code)
                            code = "";
                            if(!skip)
                            {
                                code += this.getExportHeader(this.data.sets[i].states[j],
                                    k,
                                    dim)
                                code += this.getExportLine(this.data.sets[i].states[j],
                                            k,
                                            this.data.sets[i].indices[k][numIndices * m] - 1,
                                            dim)
                            }
                        }
                        lastEntity = this.data.sets[i].entities[k][m]

                        if(!skip)
                        {
                            code += this.getExportLine(this.data.sets[i].states[j],
                                        k,
                                        this.data.sets[i].indices[k][numIndices * m],
                                        dim)
                        }
                    }
                    if(code !== "")
                        state.elements.push(code)
                }
                set.states.push(state)
            }
            sets.push(set);
        }

        console.log("EXPORT: ")
        console.log(sets)
        return sets;
    }

    // Creates a dataset like the original one, but only with selected. TODO: However, it is complicated to display the result,
    // since the text can have multiple megabytes...
    this.exportSelection = function()
    {
        this.disableExportButton();
        var data = this.exportPrepareData();
        this.downloadZippedCsv("export.zip", data)
        
    }

    this.downloadZippedCsv = function(filename, data)
    {
        var zip = new JSZip();
        for(var set = 0; set < data.length; set++)
        {
            var setFolder = zip.folder(data[set].name)
            for(var state = 0; state < data[set].states.length; state++)
            {
                var stateFolder = setFolder.folder(data[set].states[state].name)
                for(var i = 0; i < data[set].states[state].elements.length; i++)
                {
                    stateFolder.file(i + ".csv", data[set].states[state].elements[i]);
                }
            }
        }
        console.log("Zip was prepared")
        zip.generateAsync({type:"blob"}, function(metadata) {
            this.exportShowStatus("Zipping", parseInt(metadata.percent), 1, 100)}.bind(this))
        .then(function(content) {
            // see FileSaver.js
            console.log("Create downloadable file")
            saveAs(content, filename);
            this.enableExportButton();
        }.bind(this));
    }

    this.disableScreenshotButton = function() {
        var e = document.getElementById("screenshotButton");
        e.style.opacity = 0.5;
        e.style.cursor = "default";
        e.onclick = 0;
    }

    this.enableScreenshotButton = function() {
        var e = document.getElementById("screenshotButton");
        e.style.opacity = 1.;
        e.style.cursor = "pointer";
        e.onclick = this.screenshot.bind(this);
    }

    this.screenshot = function() {
        this.disableScreenshotButton();
        //var dataURL = this.canvas.toDataURL('image/png');
        this.renderer.domElement.toBlob(function(blob){
            date = new Date();
            var dateString = date.getFullYear() + "-" + (1+date.getMonth()) + "-" + date.getDate() + ", " +
                date.getHours() + "-" + ("00" + date.getMinutes()).slice(-2) + "-" + date.getSeconds()
            saveAs(blob, 'screenshot ' + dateString + '.png');
            this.enableScreenshotButton();
        }.bind(this), 'image/png');
    }

    // TODO: find a reasonable/acceptable way to download or display the text representing the filtered data
    this.downloadText = function(filename, text) 
    {
        var blob = new File([text], 'data.json', {
            type: "text/plain;charset=utf-8"
        });
        saveAs(blob);

    },

    this.setCamera = function(v)
    {
        console.log(v)
        this.controls.reset();
        var d = 2;
        var x = (v === "+x") ? d : ((v === "-x") ? -d : 0);
        var y = (v === "+y") ? d : ((v === "-y") ? -d : 0);
        var z = (v === "+z") ? d : ((v === "-z") ? -d : 0);
        console.log("set cam to ", x, y, z);
        this.camera.position.x = x;
        this.camera.position.y = y;
        this.camera.position.z = z;
        this.camera.updateProjectionMatrix();
        this.controls.update();
    },

    // Define the trigger button press
    this.onDocumentKeyDown = function(event) 
    {
        console.log("Event:", event.target.tagName.toLowerCase(), event.which)
        if(event.target.tagName.toLowerCase() == "input")
        {
            return false;
        }
        var keyCode = event.which;
        console.log("Button " + keyCode)
        if (keyCode == 83) {
            this.pressingButton = true
            this.controls.enabled = false;
            return false;
        } 
        return true;
    },

    // Define the trigger button release
    this.onDocumentKeyUp = function(event) 
    {
        var keyCode = event.which;
        console.log("Done with " + keyCode)
        if (keyCode == 83) {
            this.pressingButton = false
            this.controls.enabled = true && !this.webVr; // no enabling in webVr mode!
        } 
    },

    this.onDocumentScroll = function(e)
    {
        // TODO: [if needed] getting scroll events and use them to zoom. Currently, orbitcontrols steal them
        console.log("scroll")
    },



    ///////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////  Tour-related functions



    // Removes the keep-waiting-messages and sets the title bar to its actual title (before it was loading status)
    this.doneLoading = function()
    {
        document.getElementById("loadingBox").className += " hideMe";
        setTimeout(function() {document.getElementById("loadingBox").className += " removeMe";}, 1000);
        document.title = this.actualTitle;
    },

    // Update the loading bar. TODO: doesn't seem to work - maybe no DOM updates during script load?
    // Current solution: write update to title. This one always updates.
    this.setStatus = function(from, to, now, message)
    {
        var p = 100 * (now - from) / (to - from) ;
        document.title = Math.round(p) + "% " + message + " - " + this.actualTitle;
    },


    
    

    this.vertexShaderLines = `
    #genericUniforms#
    #genericVaryings#
    #genericAttributes#

    attribute float setId;
    attribute float drawIndex;

    varying vec3 vOrientation;
    varying vec3 vOrientationColor;
    varying vec3 vPosition;
    varying vec3 vNextPosition;
    varying vec3 vNormal;
    varying vec3 vView;
    varying vec3 vCenter;
    varying float vDepth;
    varying float vSetId;
    varying float vDrawIndex;
    varying float vDiscardThis;
    varying float vLongDiff;
    varying float vLatDiff;
    uniform float scale;
    uniform float state;
    uniform float defocusState;
    uniform float shading;
    uniform float glossiness;
    uniform float darkenInside;
    uniform float mercator;
    uniform int mercatorMode;
    uniform float mercatorRadius;
    uniform float mercatorOffset;
    uniform float mercatorOffset2;
    uniform float mercatorOffset3;
    uniform float zLower;
    uniform float zUpper;
    uniform float xLower;
    uniform float xUpper;
    uniform float yLower;
    uniform float yUpper;
    uniform vec3 projPlane;
    uniform vec3 projPlaneN;
    uniform float projLevel;

    mat4 rotationMatrix(vec3 axis, float angle) 
    {
        axis = normalize(axis);
        float s = sin(angle);
        float c = cos(angle);
        float oc = 1.0 - c;
        
        return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                    0.0,                                0.0,                                0.0,                                1.0);
    }

    void main() 
    {
        vSetId = setId;
        vDrawIndex = drawIndex;
        float stateInternal = drawIndex >= 0. ? state : defocusState;
        #genericAttributeInterpolation#
        vDiscardThis = 0.;
        if(positionOut.z < zLower || positionOut.z > zUpper || 
            positionOut.x < xLower || positionOut.x > xUpper || 
            positionOut.y < yLower || positionOut.y > yUpper )
        {
            vDiscardThis = 1.;
        }

        vec3 projPlaneNn = normalize(projPlaneN);
        vec3 planeTest = positionOut.xyz - projPlane;
        if(dot(planeTest, projPlaneNn) >= 0.)
        {
            vDiscardThis = 1.;
        }
        else if(projLevel > 0.001)
        {
            float dist = length(planeTest) * dot(normalize(planeTest), projPlaneNn);
            positionOut.xyz -= projPlaneNn * dist * projLevel;
            
            planeTest = nextPositionOut.xyz - projPlane;
            dist = length(planeTest) * dot(normalize(planeTest), projPlaneNn);
            nextPositionOut.xyz -= projPlaneNn * dist * projLevel;
        }

        // Always determine lon and lat, since we might need it for coloring
        float r = length(positionOut.xyz);
        vec4 v = vec4(positionOut.xyz, 1.) * rotationMatrix(vec3(1,0,0), mercatorOffset)
            * rotationMatrix(vec3(0,1,0), mercatorOffset2)
            * rotationMatrix(vec3(0,0,1), mercatorOffset3);
            
        float rNext = length(nextPositionOut.xyz);
        vec4 vNext = vec4(nextPositionOut.xyz, 1.) * rotationMatrix(vec3(1,0,0), mercatorOffset)
            * rotationMatrix(vec3(0,1,0), mercatorOffset2)
            * rotationMatrix(vec3(0,0,1), mercatorOffset3);
            
        float lat = asin(v.z / r) ;  // z
        float lon = atan(v.x, v.y);  // y x
        float latNext = asin(vNext.z / rNext) ;  // z
        float lonNext = atan(vNext.x, vNext.y);  // y x
        vLongDiff = lonNext - lon; //lon > 0. ? lon - lonNext : lonNext - lon;
        vLatDiff = positionOut.y > 0. ? lat - latNext : latNext - lat;

        if(mercator > 0.002)
        {
            float mercatorHeight;
            #mercatorModes#

            if(abs(lon - lonNext) > 1.)
            {
                vDiscardThis = 1.;
            }

            vec3 posMercator = r / 3.142 * vec3(lon, log(tan(3.142 * 0.25 + lat * 0.5)), mercatorHeight * mercatorRadius - mercatorRadius/2.);
            vec3 nextPosMercator = r / 3.142 * vec3(lonNext, log(tan(3.142 * 0.25 + latNext * 0.5)), mercatorHeight * mercatorRadius - mercatorRadius/2.);
            positionOut = mix(positionOut, posMercator, mercator);
            nextPositionOut = mix(nextPositionOut, nextPosMercator, mercator);
        }
        vOrientation = normalize(nextPositionOut - positionOut);
        
        vec4 modelViewProjection = modelViewMatrix * vec4(positionOut, 1.0 );
        gl_Position = projectionMatrix * modelViewProjection;
        vPosition = gl_Position.xyz;
        vec4 modelViewProjectionNext = modelViewMatrix * vec4(nextPositionOut, 1.0 );
        vNextPosition = (projectionMatrix * modelViewProjectionNext).xyz;
        

        vDepth = clamp((-2.-modelViewProjection.z) / 2., 0., 1.);

        if(shading > 0.01)
        {
            // Assume camera is more distant, but just zoomed in. Leads to better shading,
            // as if coming from a very far light source, like the sun
            vView = normalize(vPosition - 1000. * cameraPosition);
            vec3 biNormal = normalize(cross(vView, vOrientation));
            vNormal = cross( biNormal, vOrientation );
            vNormal *= sign( dot( vNormal, vec3( 0.0, 0.0, 1.0 ) ) );
            vNormal *= sign( dot( vNormal, vView ) );
            vNormal *= -1.;
        }

        if(darkenInside > 0.)
        {
            vCenter = (projectionMatrix * modelViewMatrix * vec4(0., 0., 0., 1.)).xyz;
        }
    }`,



    this.vertexShaderTriangle = `
    #genericUniforms#
    #genericVaryings#
    #genericAttributes#

    attribute float setId;
    attribute float drawIndex;
    attribute vec3 normalCustom;

    varying vec3 vOrientation;
    varying vec3 vOrientationColor;
    varying vec3 vPosition;
    varying vec3 vNextPosition;
    varying vec3 vNormal;
    varying vec3 vView;
    varying vec3 vCenter;
    varying float vDepth;
    varying float vSetId;
    varying float vDrawIndex;
    varying float vDiscardThis;
    varying float vLongDiff;
    varying float vLatDiff;
    uniform float scale;
    uniform float state;
    uniform float defocusState;
    uniform float shading;
    uniform float glossiness;
    uniform float darkenInside;
    uniform float mercator;
    uniform int mercatorMode;
    uniform float mercatorRadius;
    uniform float mercatorOffset;
    uniform float mercatorOffset2;
    uniform float mercatorOffset3;
    uniform float zLower;
    uniform float zUpper;
    uniform float xLower;
    uniform float xUpper;
    uniform float yLower;
    uniform float yUpper;
    uniform vec3 projPlane;
    uniform vec3 projPlaneN;
    uniform float projLevel;


    mat4 rotationMatrix(vec3 axis, float angle) 
    {
        axis = normalize(axis);
        float s = sin(angle);
        float c = cos(angle);
        float oc = 1.0 - c;
        
        return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                    0.0,                                0.0,                                0.0,                                1.0);
    }

    void main() 
    {
        vSetId = setId;
        vDrawIndex = drawIndex;
        float stateInternal = drawIndex >= 0. ? state : defocusState;
        #genericAttributeInterpolation#
        vDiscardThis = 0.;
        if(positionOut.z < zLower || positionOut.z > zUpper || 
            positionOut.x < xLower || positionOut.x > xUpper || 
            positionOut.y < yLower || positionOut.y > yUpper )
        {
            vDiscardThis = 1.;
        }

        vec3 planeTest = positionOut.xyz - projPlane;
        vec3 projPlaneNn = normalize(projPlaneN);
        if(dot(planeTest, projPlaneN) >= 0.)
        {
            vDiscardThis = 1.;
        }
        else if(projLevel > 0.001)
        {
            float dist = length(planeTest) * dot(normalize(planeTest), projPlaneNn);
            positionOut.xyz -= projPlaneNn * dist * projLevel;
            
            planeTest = nextPositionOut.xyz - projPlane;
            dist = length(planeTest) * dot(normalize(planeTest), projPlaneNn);
            nextPositionOut.xyz -= projPlaneNn * dist * projLevel;
        }

        // Always determine lon and lat, since we might need it for coloring
        float r = length(positionOut.xyz);
        vec4 v = vec4(positionOut.xyz, 1.) * rotationMatrix(vec3(1,0,0), mercatorOffset)
            * rotationMatrix(vec3(0,1,0), mercatorOffset2)
            * rotationMatrix(vec3(0,0,1), mercatorOffset3);
            
        float rNext = length(nextPositionOut.xyz);
        vec4 vNext = vec4(nextPositionOut.xyz, 1.) * rotationMatrix(vec3(1,0,0), mercatorOffset)
            * rotationMatrix(vec3(0,1,0), mercatorOffset2)
            * rotationMatrix(vec3(0,0,1), mercatorOffset3);
            
        float lat = asin(v.z / r) ;  // z
        float lon = atan(v.x, v.y);  // y x
        float latNext = asin(vNext.z / rNext) ;  // z
        float lonNext = atan(vNext.x, vNext.y);  // y x
        vLongDiff = lonNext - lon; //lon > 0. ? lon - lonNext : lonNext - lon;
        vLatDiff = positionOut.y > 0. ? lat - latNext : latNext - lat;

        if(mercator > 0.002)
        {
            float mercatorHeight;
            #mercatorModes#

            if(abs(lon - lonNext) > 1.)
            {
                vDiscardThis = 1.;
            }

            vec3 posMercator = r / 3.142 * vec3(lon, log(tan(3.142 * 0.25 + lat * 0.5)), mercatorHeight * mercatorRadius - mercatorRadius/2.);
            vec3 nextPosMercator = r / 3.142 * vec3(lonNext, log(tan(3.142 * 0.25 + latNext * 0.5)), mercatorHeight * mercatorRadius - mercatorRadius/2.);
            positionOut = mix(positionOut, posMercator, mercator);
            nextPositionOut = mix(nextPositionOut, nextPosMercator, mercator);
        }
        vOrientation = normalize(nextPositionOut - positionOut);
        
        vec4 modelViewProjection = modelViewMatrix * vec4(positionOut, 1.0 );
        gl_Position = projectionMatrix * modelViewProjection;
        vPosition = gl_Position.xyz;
        vec4 modelViewProjectionNext = modelViewMatrix * vec4(nextPositionOut, 1.0 );
        vNextPosition = (projectionMatrix * modelViewProjectionNext).xyz;
        vDepth = clamp((-2.-modelViewProjection.z) / 2., 0., 1.);

        if(shading > 0.01)
        {
            vNormal = normalCustom;
            // Assume camera is more distant, but just zoomed in. Leads to better shading,
            // as if coming from a very far light source, like the sun
            vView = normalize(vPosition - 100. * cameraPosition);
        }

        if(darkenInside > 0.)
        {
            vCenter = (projectionMatrix * modelViewMatrix * vec4(0., 0., 0., 1.)).xyz;
        }
    }`,

    this.fragmentShader = `
    #genericUniforms#
    #genericVaryings#
    uniform float alpha;
    uniform int mode;
    varying vec3 vOrientation;
    varying float vLongDiff;
    varying float vLatDiff;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vView;
    varying vec3 vCenter;
    varying float vSetId;
    varying float vDrawIndex;
    varying float vDepth;
    varying float vDiscardThis;
    uniform vec3 diffuse;
    uniform float opacity;
    uniform float scale;
    uniform vec3 primaryColor;
    uniform vec3 secondaryColor;
    uniform vec3 defocusColor;
    uniform vec3 backgroundColor;
    uniform float shading;
    uniform float glossiness;
    uniform float darkenInside;
    uniform float defocusAlpha;
    uniform float colorScale;


    float lightIntensity2(vec3 viewDir, vec3 normalDir)
    {
        float ambient = 0.2;
        float diffuse = 1.0;
        float specular = 7.0;
        float shininess = 250.;

        return ambient 
               + diffuse * abs(dot(-viewDir, normalDir)) //max(0., dot(-viewDir, normalDir)) 
               + specular *  pow(abs(dot(-viewDir, normalDir)), shininess);//pow(max(dot(-viewDir, normalDir), 0.0 ), shininess);
    }
    float lightIntensity(vec3 viewDir, vec3 normalDir)
    {
        // diffuse term
        vec3 lightDir = -viewDir;
        float NdotL = dot(normalDir, lightDir);
        float diffuse = NdotL;
        float shininess = 50.;
        vec3 rVector = normalize(2.0 * normalDir * abs(dot(normalDir, lightDir)) - lightDir);
        float RdotV = dot(rVector, -viewDir);

        float specular = 0.;
        if(RdotV > 0.)
            specular = glossiness * pow(RdotV, shininess);
        return 0.2 + diffuse + specular;
    }

    vec3 pseudoRandomColor(float i) 
    {
        return vec3(mod(7.  * i, 206.) + 50., 
                    mod(11. * i, 128.) + 50., 
                    mod(31. * i, 206.) + 20.) / 256.;
        float h = i * mod(2654435761., pow(2., 32.));
        return vec3(mod(h, 256.), mod(h, 10000.) / 40., mod(h, 65536.) / 256.) / 256.;
    }

    void main() 
    {

        gl_FragColor = vec4(primaryColor, alpha);

        if(mode==1)
        {
            gl_FragColor = vec4(vOrientation.x / 2. + 0.5, vOrientation.y / 2. + 0.5, vOrientation.z / 2. + 0.5, alpha);
        }
        else if(mode == 2)
        {
            gl_FragColor.xyz = normalize(vec3(vLongDiff, 0, vLatDiff));
            gl_FragColor = vec4(gl_FragColor.x / 2. + 0.5, gl_FragColor.y / 2. + 0.5, gl_FragColor.z / 2. + 0.5, alpha);
        }
        else if(mode == 3)
        {
            gl_FragColor.xyz = vec3(clamp((vLatDiff) * colorScale, -1., 1.), 0,0);
            gl_FragColor = vec4(gl_FragColor.x / 2. + 0.5, gl_FragColor.y / 2. + 0.5, gl_FragColor.z / 2. + 0.5, alpha);
        }
        else if(mode == 4)
        {
            gl_FragColor.xyz = vec3(clamp(vLongDiff * colorScale, -1., 1.), 0,0);
            gl_FragColor = vec4(gl_FragColor.x / 2. + 0.5, gl_FragColor.y / 2. + 0.5, gl_FragColor.z / 2. + 0.5, alpha);
        }
        else if(mode == 5)
        {
            gl_FragColor.xyz = (1. - vDepth) * primaryColor + vDepth * secondaryColor;
        }
        else if(mode == 6)
        {
            gl_FragColor.xyz = pseudoRandomColor(vDrawIndex);
        }
    #colorModes#

        float sim = 1.0;
        if(shading > 0.01)
        {
            sim = mix(1.,  lightIntensity(vView, vNormal), shading);
        }

        gl_FragColor = vec4(clamp(sim * gl_FragColor.xyz, 0., 1.), alpha);


        if(darkenInside > 0.)
        {
            if(vCenter.z < vPosition.z)
            {
                //gl_FragColor.xyz = 1. - darkenInside;
                gl_FragColor.xyz = mix(gl_FragColor.xyz, backgroundColor, darkenInside);
            }
        }

        if(vDrawIndex < 0. || vDiscardThis > 0.001)
        {
            gl_FragColor = vec4(clamp(sim * defocusColor, 0., 1.), defocusAlpha);
        }
        /*
        if(vDiscardThis > 0.001)
        {
            discard;
        }
        */
    #attributeFilter#

        // gl_FragColor = vec4(vNormal, 1.); // Debug outputs
    }`

}
