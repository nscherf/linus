# WebGL interactive figure

This tool aims to be a simple option for scientists to visualize their trajectory datasets. The tool consists of two parts. First, an offline Python script performs preprocessing of tracks and creates a custom JSON. The second part runs in the browser and renders the tracks in 3D.

The tool automatically provides multiple controls, rendering options and filter methods, which enable advanced data exploration. Alternatively, you can take the user by the hand and present pre-defined tours. The tool runs without installation - it can be executed in all modern browsers, even in virtual reality goggles. 

## 1. Data processing
This section explains the first step: converting your data, add custom data attributes, provide visual context. You need python3 with the packages ```numpy``` and ```scipy```. Edge bundling requires ```pyopencl```.

You can either use a custom python script to set up your dataset or you can use the command line interface. For a minimum working example (using the command line interface), you only have to provide a trajectory data source:

```python
python3 run.py -csv ./mydata/
```
This creates the ready-to-use visualization just from a folder of CSV files. You can check all options by calling
```python
python3 run.py -h
``` 

### 1.1. Options for loading data
 The options for data import are:
- ```-tgmm```, path of a folder of TGMM files
- ```-biotracks```, path to a JSON file describing data in biotracks layout
- ```-svf```, path to a CSV file in svf layout. (Define the separator to be used in the CSV files with ```--csvSep```.)
- ```-csv```, path to a folder of CSV files, where each file contains at least three columns for x/y/z and (optionally) additional columns for attributes (Note, if the CSVs are without header line, also add the parameter ```--csvNoHeader```. Define the separator to be used in the CSV files with ```--csvSep```) __Attention: WebGL only allows a limited number of data attributes, depending on your hardware.__

All trajectories must be resampled to the same number of positions. By default, all lines are resampled to 40 points. You can change this by defining it with parameter ```--resampleTo```. Besides that, you can filter out small trajectories with ```--skipSmallerThan```. Move your data to the center (in a way that the mean of all coordinates is 0/0/0) or scale it to a maximum width of 1 by using the commands ```--moveToCenter``` and ```--scaleToUnit```.

### 1.2. Additional color scales/transformations
To enrich your visualization with additional color scales and transformations you can let the tool calculate the following information:
- ```--addRadius```, adds an attribute containing the distance between 0/0/0 (after the moveToCenter-operation was performed) and each position
- ```--addAngle```, adds an attribute containing the angle between line start and current location (in cartesian coordinates)
- ```--addTime```, a "counter" of the current line position (0 for the first point, 1 for the second point, 2 for the third ...)
- ```--addBundled```, performs edge bundling to improve clarity of dense line data. Works best for non-crossing trajectories. Requires PyOpenCL and a decent graphics card.

### 1.3. Adding context
We offer the additional rendering of a background silhouette that can be provided by either STL oder OBJ data (triangles). For this, add the following parameter:
- ```--stl```, plus the path to the file
- ```--obj```, plus the path to the file

The result will be exported to the folder ./export, which holds the index.html that can be opened in any modern browser. Performance seems to be best in Chrome-based browsers. Note, to reduce the data size you can zip the result with the parameter ```--zip```, which creates a base64-encoded zipped version instead of a native JSON file.

### 1.4. Individual setup in python
As an alternative to the command line interface, you can create your visualization in python. First you should understand the data organization. The idea is to have a dataset containing a certain number of tracks, where each track consists of a number of positions. For simplicity, we resize all tracks to the same number of positions directly after loading. Our tool allows the data to have multiple states. Another state could be a transformed version of the data, as for example the edge-bundled version. Additional states must have exactly the same layout like the original data - the same number of tracks, the same order, the same number of positions. While exploring the visualization, you will be able to fade dynamically between the states. Furthermore, the data can be enriched with attributes. These could be signals (measurements) or any other numeric values. The attributes form the foundation for filtering and colormapping.

Our tool offers several python classes that help you to create the visualization. The next subsection explain their purpose. However, a good way to start is to have a look at the ```run.py``` file.


#### 1.4.1. Loader classes
Use one of the loaders to load the trajectory data. Here you should define the resampling rate, the minimum track size, and individual parameters depending on the concrete loader class (e.g. CSV separator). The results are three collections:
- tracks
- attributes
- attribute names

#### 1.4.2. Track modifier
The track modifier is a class to alter the loaded data. This includes adding new attributes and new states, or to translate/scale the data.

#### 1.4.3. Triangle loader
A tool to load the triangle data. Note, if you have resized the trajectories, you should resize the triangles in the same way (otherwise they'll have different scale).

#### 1.4.4. Builder
The WebGlToolBuilder is the tool that collects all information and creates a single JSON file from it. In this class you can add multiple datasets. The order in which you add the datasets is important: multiple datasets are always rendered _after_ each other. This means, the second dataset will be painted just over the first one. Hence, they cannot partially overlap!


## 2. Data exploration
The export folder contains all necessary data. It can be shared in any way you wish. For example, you can upload it to a server, or just open the file export/index.html locally. You can select data by holding button [s] and drawing a rectangle on the screen. A double click 

### 2.1. The general concept
On the right side you can see a menu. First, it shows some general settings. This includes the size of the menu and options to (re)set the camera to a certain position. An interesting point here is the "Render order" - this setting defines how frequently the 3D data is sorted. A low frequency leads to visual artifacts (the background appears to be in front of the foreground) and a high frequency leads to bad performance. By default, a trade-off is selected: the data is sorted a moment after whenever the camera positions was changed.

### 2.2. Dataset-specific settings
For each dataset, a number of settings are possible. First, the render settings affect the appearance. Colormapping can be set according to all data attributes. Besides that shading and transparancy are an important tool to present the data in an appealing way (note, these settings can be specified separately for "normal" data and for "de-selected" data, in order to visualize highlighted data and background data in parallel).
Besides that, each dataset can be projected and cut separately. 

### 2.3. Selection, data export and tours
The lower part of the menu shows the button to open the tour editor. Furthermore, if tours are provided, they can be started from here. The overall tour speed can be adjusted, too, which e.g. allows a playback in slow motion. 

### 3. The tour editor
The tour editor is a tool to create a "video" in which several actions happen in a timely scheduled manner. The editor has three main functions:
- it can set the camera to a certain position
- it can set any of the settings in the menu to a certain value
- it can show a text note on screen

This means that a tour can adjust everything that a human user could change in the menu as well. There are a few quirks related to this: for example, to change the color you could either use the tour editor to select one of the presets or you could tell it to directly set the color values for foreground/background, and so on.

We recommend to open two tabs: one for defining the tour, another one for the result. See 3.3. for the explaination how a tour is started.

Note, text overlays and camera settings do not work in VR (there are no camera movements possible since the head is the camera!).

#### 3.1. Recording a tour
The tour elements are added in a straight forward way: Adjust the camera to your needs and press the button "Get camera". Adjust the settings to your need and press the button "Get settings". Select data with [s] + mouse and press "Use selection". Add markers by clicking the respective button.

#### 3.2. Adjust the timing, remove elements
You can define a delay for each element. A delay of 0 means that the action is executed immediately after the previous action has finished. Some actions have a duration. E.g. the text labels show up for a certain time period. 
You can change the order of the tour elements by drag&drop on the top left corner (three dashes).
You can disable elements by un-checking the box next to the drag-button.

#### 3.3. Sharing the tour
Click into the text box to retrieve the tour code. If the tour code is short enough (depending on the server settings, e.g. less than 1000 characters), you can directly share the URL (by URL or by QR Code) with other people. The tour is encoded in this URL. Note, the URL grows massively with the use of selections. If you only use "get settings" and "get camera", the tour URL is shortest and thus easiest to share.

If the URL is longer than your server allows, you have to copy it to the source code of the index.html file. Have a look at the respective comments in the lower end of the source code file.

You can choose whether the tour should start automatically or not by (un-)checking the respective checkbox.



## Questions and answers

### Structure of JSON (with annotations)
How does the data look like? First we show an empty example with comments:
```json
var data = {  
  "sets": [                 # An array of datasets. E.g. track data + visual context
    {  
      "type":"lines",       # "lines" or "triangles"
      "name":"my data"      # Name of this state, shown to the user
      "selectable":true,    # Allow selection by user
      "indices":[[]],       # Indices, refering to positions (see below)
      "states":[            # An array of states, e.g. original and processed data. 
        {           
          "positions":[[]], # Positions: x0, y0, z0. x1, y1, z1, ...
          "attributes":[    # An array of attributes for this state
            {  
              "name":"..",  # Name for the attribute
              "shared":true,# Are the attributes the same for all states?
              "values":[[]],# Values. Size: number of positions * dim (see below)
              "dim":1,      # Dimension - how many values belong to a position?
              "fixedColor":true # Should colormap be stretched to currently 
                                #visible range, or fixed to global min/max?
            }
          ],
        },
      ],
      "entities":[[]],      # Track ID of each position
      "scale":0.07692       # Scale to reach original data dimension
    }
  ],
  "dim":3                   # 2D or 3D? Currently always 3.
}
```
Next, we show an example that consists of two data set, a trajectory data set (containing two trajectories), and a triangle dataset (containing one triangle). Note, the order of the sets is important for the render order. In this case, the triangle would be drawn first and the lines are rendered superimposed (independent of the perspective of the camera).

Furthermore, the trajectory data consists of two states. Here, the second state is just like the first state, but the point p(10, 10, 10) was added to each position. Note, all the attributes are shared. This means that attributes are only read from the first state but also used for the second state. Hence you can omit to provide values for the second state, which saves storage.



A full example:
```json
var data = {
  "sets": [
    {
      "type": "triangles",
      "name": "Triangles",
      "states": [
        {
          "attributes": [],
          "positions": [
            [
              -0.5, -0.5, 0.5,
              -0.5,  0.5, 0.5,
               0.5, -0.5, 0.5
            ]
          ],
          "name": "Triangles",
          "normals": [
            [
              0.0, 0.0, 1.0,
              0.0, 0.0, 1.0,
              0.0, 0.0, 1.0
            ]
          ]
        }
      ],
      "selectable": false,
      "entities": [[0, 0, 0]],
      "indices": [],
      "scale":0.07692
    },
    {
      "type":"lines",
      "name":"Trajectories",
      "states":[
        {
          "positions":[
            [
              1.61538, 0.69230, 0.15384,
              0.84615, 0.15384, 2.38461,
              1.30769, 1.92307, 1.61538,
              0.92307, 0.38461, 0.94615,
              1.84615, 0.07692, 0.69230,
              1.46153, 3.15384, 0.99999
            ]
          ],
          "attributes":[
            {
              "name":"Trajectory Index",
              "shared":true,
              "values":[ [ 0.0, 1.0, 2.0, 0.0, 1.0, 2.0 ] ],
              "dim":1,
              "fixedColor":true
            },
            {
              "shared":true,
              "values":[ [
                0.0, 7.97972e-17, 5.0, 5.0, -1.05471e-15, 5.0 ] ],
                "dim":1,
                "name":"Signal",
                "fixedColor":false
              }
            ],
            "name":"original"
          },
          {
            "positions":[
              [
                0.61538, 1.69230, 1.15384,
                1.84615, 1.15384, 3.38461,
                0.30769, 0.92307, 0.61538,
                1.92307, 1.38461, 1.94615,
                0.84615, 1.07692, 1.69230,
                0.46153, 2.15384, 1.99999
              ]
            ],
            "attributes":[
              {
                "name":"Trajectory Index",
                "shared":true,
                "dim":1,
                "fixedColor":true
              },
              {
                "name":"Signal",
                "shared":true,
                "dim":1,
                "fixedColor":false
              }
            ],
            "name":"bundled"
          }
        ],
        "selectable":true,
        "entities":[ [ 0, 0, 0, 3, 3, 3 ] ],
        "indices":[ [ 0,1,1,2,3,4,4,5 ] ],
        "scale":0.07692
      }
    ],
  "dim":3
}

```


### What is the difference between shared and non-shared attributes
Shared attributes are only read from the first state and also used in the second state (and consecutive states). If additional states should use their own values for a certain attribute, the respective attribute must be declared as non-shared.


### No data is not shown, error says "multiple attributes with the same name"
Number of attributes is too high. Try it with less and ensure that all attributes that are constant among the states are labeled as shared.

### Why are the nested square brackets( [[ ) in the data?
All data arrays are surrounded by double square brackets. There is a reason for that: The tool allows to provide data to be organized in separate draw calls (but in this example - and also in the data created from the python script - all data is rendered with one draw call). Multiple draw calls would faster (element-wise) sorting, but a high number of draw calls has enormous impact on the performance. However, the following data arrays would create the same geometry:
```json
[  
    [  
        1.61538, 0.69230, 0.15384, 
        0.84615, 0.15384, 2.38461, 
        1.30769, 1.92307, 1.61538,
        0.92307, 0.38461, 0.94615,
        1.84615, 0.07692, 0.69230,
        1.46153, 3.15384, 0.99999
    ]
]
```
and
```json
[  
    [  
        1.61538, 0.69230, 0.15384, 
        0.84615, 0.15384, 2.38461, 
        1.30769, 1.92307, 1.61538
    ],
    [
        0.92307, 0.38461, 0.94615,
        1.84615, 0.07692, 0.69230,
        1.46153, 3.15384, 0.99999
    ]
]
```

This structure must be consistent for all other data arrays where you can see the double brackets (hence, also attributes etc. must be organized with arrays of same element number). The original reason was to allow the rendering engine to depth-sort all elements (by deciding which object should be painted before other objects) before drawing. However, this feature is currently not of use since we implemented depth-sorting on _vertex-basis_, which is more accurate than only _element-wise_. Quick solution: just provide the data in a single array and write the two brackets around.

### Selection is not exact
Selecting elements works the following way: First, you make the selection by holding button [s] while drawing a rectangle to the screen. Second, the software decides which lines/triangles to show based on vertices (!) that are in the selection. This means, if you select a part of a line not containing any vertex, this line is not recognized. Your selection must always include at least one supporting point of the desired line/triangle. Furthermore, the selection process works only on the coordinates provided by the user ("the original data") but it ignores altered positions (e.g. caused by the Mercator projection).

### In the tour editor: I only changed the color preset, but _many_ settings appear
THe tour editor observes what elements have changed in the menu. If you apply a color preset, a number of colors are set automatically. The tour editor will list all of these changes. You can safely disable the respective color changes and only keep the change of the preset.

### My tours look different in VR
Virtual reality is incompatible with text overlays and with changes on the camera.

### I cannot create a QR Code for my tour
The tour URL is too long to be encoded as QR Code

### I cannot open a tour URL
Likely the tour URL is too long. Instead of open the URL directly in the browser, copy it into the index.html (lower part, see the comments there)

