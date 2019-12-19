# WebGL interactive figure

This tool aims to be a simple option for scientists to visualize their trajectory datasets. The tool consists of two parts. First, an offline Python script performs preprocessing of tracks and creates a custom JSON. The second part runs in the browser and renders the tracks in 3D.

The tool automatically provides multiple controls, rendering options and filter methods, which enables advanced data exploration. Alternatively, you can take the user by the hand and present pre-defined tours. The tool runs without installation - it can be executed in all modern browsers, even in virtual reality goggles. 

## Data processing
This section explains the first step: converting your data, add custom data attributes, provide visual context. You need python3 with numpy and scipy. Edge bundling requires pyopencl.

You can either build your dataset programmatically or use the command line interface. The most basic usage is to call the script and deliver a trajectory data source:

```python
python3 run.py -csv ./mydata/
```
This creates the visualization from a folder of CSV files. All import options are:
- ```-tgmm```, path of a folder of TGMM files
- ```-biotracks```, path to a JSON file describing data in biotracks layout
- ```-svf```, path to a CSV file in svf layout. Define the separator to be used in the CSV files with ```--csvSep```.
- ```-csv```, path to a folder of CSV files, where each file contains at least three columns for x/y/z and (optionally) additional columns for attributes. Note, if the CSVs are without header line, also add the parameter ```--csvNoHeader```. Define the separator to be used in the CSV files with ```--csvSep```.

All trajectories must be resampled to the same number of positions. By default, all lines are resampled to 40 points. You can change this by defining it with parameter ```--resampleTo```. Besides that, you can filter out small trajectories with ```--skipSmallerThan```. Move your data to the center (set barycenter to 0/0/0) or scale it to a maximum width of 1 by using the commands ```--moveToCenter``` and ```--scaleToUnit```.

To enrich your visualization you can let the tool calculate the following information:
- ```--addRadius```, adds an attribute containing the distance between 0/0/0 (after the moveToCenter-operation was performed) and each position
- ```--addAngle```, adds an attribute containing the angle between line start and current location (in cartesian coordinates)
- ```--addTime```, a "counter" of the current line position (0 for the first point, 1 for the second point, ...)
- ```--addBundled```, performs edge bundling to improve clarity of dense line data. Works best for non-crossing trajectories. Requires PyOpenCL and a decent graphics card.

We offer the additional rendering of a background silhouette that can be provided by either STL oder OBJ data (triangles). For this, add the following parameter:
- ```--stl```, plus the path to the file
- ```--obj```, plus the path to the file

The result will be exported to the folder ./export, which holds the index.html that can be opened in any modern browser. Performance seems to be best in Chrome-based browsers. Note, to reduce the data size you can zip the result with the parameter ```--zip```, which creates a base64-encoded zipped version instead of a native JSON file.

### Individual setup in python
As an alternative to the command line interface, you can create your visualization in python. First you should understand the data organization. The idea is to have a dataset containing at least a number of tracks, where each track consists of a number of positions. For simplicity, we resize all tracks while loading to have the same number of positions. In theory, our tool allows the data to have multiple states. Another state could be a projected version of the data, or for example the edge-bundled version. Additional states must have exactly the same layout like the original data (same number of tracks, same order, same number of positions). Later you will be able to fade dynamically between the states. Furthermore, the data can be enriched with attributes. These could be signals (measurements) or any other numeric values. Later you will be able to colorize or filter the data based on these attributes. 

Our tool offers several class that help you to create the visualization:


#### Loader classes
Use one of the loaders to load the trajectory data. Here you should define the resampling rate, the minimum track size, and individual parameters depending on the concrete loader class (e.g. CSV separator). The results are
- tracks
- attributes
- attribute names

#### Track modifier
The track modifier is a class to alter the loaded data. This includes adding new attributes and new states, or to translate/scale the data.

#### Triangle loader
A tool to load the triangle data. Note, if you have resized the trajectories, you should resize the triangles in the same way (otherwise they'll have different scale).

#### Builder
The WebGlToolBuilder is the tool that collects all information and creates a single JSON file from it. In this class you can add multiple datasets. However, multiple datasets are always rendered _after_ each other, hence they cannot partially overlap.


### Trajectory data
Trajectory input data is expected as a folder of CSV files. Each file contains a single track and each line of a CSV file represents a position. If the first line contains a header (e.g.~the names of the columns), set the parameter `firstLineIsHeader` to `True`. The values  within one line should be separated by commas (alternatively you can define your own separator with the property `csvSeparator`). Each csv file must contain at least three columns representing the x, y, z coordinates. Additional custom columns may contain numeric values representing data attributes (e.g. a measured signal or the time point of the respective position), but it is important that all tracks have the _same number_ of additional attributes. __Note: WebGL only allows a limited number of data attributes. Five custom attributes should not be a problem, but check the explanations below for details.__

To load a file and resample the tracks to a fixed length of 60 positions, use the following command:

```python
trajectories = eb.EdgeBundler("/my/trajectory/folder/", resampleTo = 60)
# or if you need to adjust parameters: 
# eb.EdgeBundler("/my/trajectory/folder/", resampleTo = 60, firstLineIsHeader = False, csvSeparator = ",")
```
If your data contains data attributes (a 4th, 5th, ... column in the CSV files) and you did not provide headers in the CSV files, you can also specify the attribute names in the respective order:
```python
trajectories.addAttributeName("Time") # name for attribute in 4th column
trajectories.addAttributeName("Signal") # name for attribute in 5th column
...
```
Furthermore, you can define a number of settings. If you do not provide the settings, default values will be used that should also create a proper visualization. The settings will be explained below.
```python
trajectories.setNumClusters(4)
trajectories.setMagnetRadius(20)
trajectories.setBundlingIterations(1)
```

### Triangle data (STL format) for context visualization

Besides the trajectories, it is also possible to add general geometry.
```python
triangles = eb.TriangleBuilder()
triangles.addFromStl("./testcases/4small/surface/head_surface_fixed.stl", "Skull")
```
The software aims to scale the data into the range [-0.5, 0.5]. If you do not specify a scale, the scale is defined automatically by checking the boundaries of the data. To prevent all datasets from being scaled differently, you can copy the scale from the already processed data to the next data set. In this example, we processed the trajectories first and we know the scale now. To keep the triangles synchronized, also apply the same scaling by:

```python
triangles.setResampling(trajectories.scale, trajectories.center)
```

### Combining the data

Now we are done with processing of the data sets. In the next step, the data sets are added to the resulting JSON document which will be loaded by the WebGL tool. Remember, the order is important, since it has effect on the render order.

```python
builder.addDataset(triangles.getWebGlJson()) # Adding triangles first makes them background
builder.addDataset(trajectories.getWebGlJson()) # Added second, will always be painted on top
builder.writeJson(".")
```

Furthermore, you can also export the bundled tracks (to a subfolder "./resampled"), or you can visually check the results with Python tools. The first parameters provides the tracks you want to draw (the original ones `trajectories.tracks`, or the bundled ones `trajectories.tracksBundled`) and the assignment of clusters for colorization.

```python
trajectories.exportBundledTracks()
trajectories.plotTracks(trajectories.tracksBundled, trajectories.clustersReverse)
```


## Questions and answers

### Structure of JSON (with annotations)
```json
var data = {  
  "sets": [                 # An array of datasets.E.g. track data + visual context
    {  
      "type":"lines",       # "lines" or "triangles"
      "name":"original"     # Name of this state
      "selectable":true,    # Allow selection by user
      "indices":[[]],       # Indices, refering to positions (see below)
      "name":"any name",    # Name for representation in tool, e.g. "data 1"
      "states":[            # An array of states, e.g. original and processed data. 
        {           
          "positions":[[]], # Positions: x0, y0, z0. x1, y1, z1, ...
          "attributes":[    # An array of attributes for this state
            {  
              "name":"..",  # Name for the attribute
              "shared":true,# Are the attributes are the same for all states?
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
  "dim":3                   # 2D or 3D ?
}
```
### Full Example of JSON 
The example consists of two data set, once a trajectory data set (containing two trajectories), and a triangle dataset (containing one triangle). Note, the order of the sets is important for the render order. In this case, the triangle would be drawn first and the lines are rendered superimposed (independent of the perspective of the camera).

Furthermore, the trajectory data consists of two states. Here, the second state is just like the first state, but the point p(10, 10, 10) added to each position. Note, all the attributes are shared. This means that attributes are only read from the first state and also used for the second state. Hence you can omit to provide values again, which saves storage.

Note, all data arrays are surrounded by double square brackets. There is a reason for that: The tool allows to provide data to be organized in separate draw calls. Instead of drawing both lines at once... :
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
... it would be possible to  sort the trajectories and draw each separately:
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
### Shared vs. non-shared attributes

### Data is not shown, error says "multiple attributes with the same name"
Number of attributes is too high. Try it with less and ensure that all attributes that are constant among the states are labeled as shared.

### Selection is not exact
Selecting elements works the following way: First, you make the selection by holding button [s] while drawing a rectangle to the screen. Second, the software decides which lines/triangles to show based on vertices (!) that are in the selection. This means, if you select a part of a line not containing any vertex, this line is not recognized. Your selection must always include at least one supporting point of the desired line/triangle.