import os
import argparse
import DataConverter as dc

# Output OpenCL compiler messages (including warnings).
os.environ['PYOPENCL_COMPILER_OUTPUT'] = "1"
# Set your favorite OpenCL device here, if you want. Remove line for being asked on each run.
os.environ['PYOPENCL_CTX'] = "0"

# Prepare the command line interface
parser = argparse.ArgumentParser(description='Provide at least one data source (parameters with single dash -)')
parser.add_argument("-csv", help="A folder containing (only) CSV files with tracks", default=None, nargs="?")
parser.add_argument("-biotracks", help="The biotracks JSON file", default=None, nargs="?")
parser.add_argument("-tgmm", help="A folder containing (only) TGMM files with tracks", default=None, nargs="?")
parser.add_argument("-svf", help="A SVF (CSV-like) file", default=None, nargs="?")
parser.add_argument("--addState2", help="Add another state (same type, same structure)", default=None, nargs="?")
parser.add_argument("--stl", help="A stl file for context/background", default=None, nargs="?")
parser.add_argument("--obj", help="An obj file for context/background", default=None, nargs="?")
parser.add_argument("--addRadius", help="Create an attribute containing the radius (distance to center)", action='store_true', default=None)
parser.add_argument("--addAngle", help="Create an attribute containing the angle between initial orientation and local orientation", action='store_true', default=None)
parser.add_argument("--addTime", help="Create an attribute containing the time/counter of the track position (first pos is 0, ..., n)", action='store_true', default=None)
parser.add_argument("--addBundled", help="Creates a bundled version of the tracks and adds them as a second state", action='store_true', default=None)
parser.add_argument("--moveToCenter", help="Moves the data to its barycenter", action='store_true', default=None)
parser.add_argument("--scaleToUnit", help="Scale the data to a maximum width of 1", action='store_true', default=None)
parser.add_argument("--zip", help="Zip the result and wrap it to base64", action='store_true', default=None)
parser.add_argument("--skipSmallerThan", help="Skips tracks that are smaller than n points (default: 2)", action='store', default=2)
parser.add_argument("--resampleTo", help="Target track length (after resampling) (default: 50)", action='store', default=50)
parser.add_argument("--csvNoHeader", help="By default, the first line is assumed to be a header. If table is full of numeric values, use this option.", action='store_true', default=None)
parser.add_argument("--csvSep", help="Add the CSV separator you are using (default: ,)", action='store_true', default=",")

print("Prepare your trajectory data for a WebGL-based interactive visualization.")
print("Please provide at least one data source. Find the result in ./Export/")
print("Use -h to show the help.")
print()

# Get the arguments. Not-provided arguments default to "None"
args = parser.parse_args()
csvPath = args.csv
tgmmPath = args.tgmm
svfPath = args.svf
addState2 = args.addState2
biotracksPath = args.biotracks
stlPath = args.stl
objPath = args.obj
addRadius = args.addRadius
addAngle = args.addAngle
addTime = args.addTime
addBundled = args.addBundled
moveToCenter = args.moveToCenter
scaleToUnit = args.scaleToUnit
useZip = args.zip
csvNoHeader = args.csvNoHeader
skipSmallerThan = int(args.skipSmallerThan)
resampleTo = int(args.resampleTo)
csvSep = args.csvSep


# Case 1: Use the command line interface
loadFromCmd = tgmmPath != None or csvPath != None or biotracksPath != None or svfPath != None
loaderState2 = None
if loadFromCmd:
    if csvPath is not None:
        print("Load from CSV...")
        loader = dc.CsvLoader(csvPath, resampleTo=resampleTo, minTrackLength=skipSmallerThan, firstLineIsHeader=(csvNoHeader is None), csvSeparator=csvSep)
        if addState2 is not None:
            loaderState2 = dc.CsvLoader(addState2, resampleTo=resampleTo, minTrackLength=skipSmallerThan, firstLineIsHeader=(csvNoHeader is None), csvSeparator=csvSep)
    if tgmmPath is not None:
        print("Load from TGMM...")
        loader = dc.TgmmLoader(tgmmPath, resampleTo=resampleTo, minTrackLength=skipSmallerThan,)
        if addState2 is not None:
            loaderState2 = dc.TgmmLoader(addState2, resampleTo=resampleTo, minTrackLength=skipSmallerThan,)

    if biotracksPath is not None:
        print("Load from Biotracks...")
        loader = dc.BiotracksLoader(biotracksPath, resampleTo=resampleTo, minTrackLength=skipSmallerThan,)
        if addState2 is not None:
            loaderState2 = dc.BiotracksLoader(addState2, resampleTo=resampleTo, minTrackLength=skipSmallerThan,)

    if svfPath is not None:
        print("Load from SVF...")
        loader = dc.SvfLoader(svfPath, resampleTo=resampleTo, minTrackLength=skipSmallerThan, csvSeparator=csvSep)
        if addState2 is not None:
            loaderState2 = dc.SvfLoader(addState2, resampleTo=resampleTo, minTrackLength=skipSmallerThan, csvSeparator=csvSep)

    tracks, attributes, names = loader.get()


    # Start the track modifier that adjusts the data or adds attributes
    tm = dc.TrackModifier(tracks, attributes, names)

    scale = 1.
    if scaleToUnit is not None:
        extent = tm.getExtent()
        scale = 1. / extent
        tm.scale(scale)

    bary = [0., 0., 0.]
    if moveToCenter is not None:
        bary = tm.getBarycenter()
        print("New center is at:", bary)
        tm.translate(-bary[0], -bary[1], -bary[2])

    # Add optional auto-generated attributes
    if addTime is not None:
        tm.addAttributeTime()
    if addRadius is not None:
        tm.addAttributeRadius()
    if addAngle is not None:
        tm.addAttributeAngleToStart()

    tracks, attributes, names = tm.get()

    # Prepare the output
    wgb = dc.WebGlToolBuilder()

    # First, add background data. Note, we need the scale we derived from the tracks
    if stlPath is not None:
        triangles = dc.TriangleLoader()
        triangles.setScale(scale)
        triangles.setCenter(bary)
        triangles.addFromStl(stlPath)
        positions, indices, normals = triangles.get()
        wgb.addTriangleDataset(positions, indices, normals, "Context", scale)

    if objPath is not None:
        triangles = dc.TriangleLoader()
        triangles.setScale(scale)
        triangles.setCenter(bary)
        triangles.addFromObj(objPath)
        positions, indices, normals = triangles.get()
        wgb.addTriangleDataset(positions, indices, normals, "Context", scale)

    # Finally, add the track data
    wgb.addTrajectoryDataset(tracks, attributes, names, "Trajectories", scale)

    # Add states (to the last dataset, which is the trajectory set)
    if addBundled is not None:
        tm.addAttributeAngleToStart()
        bundler = dc.EdgeBundler(tracks)
        bundler.estimateDefaultValues()
        bundler.runEdgeBundlingOpenCl()
        tracksBundled = bundler.getResult()
        wgb.addTrajectoryDatasetState(tracksBundled, "bundled")

    if addState2 is not None:
        tracks, attributes, names = loaderState2.get()
        wgb.addTrajectoryDatasetState(tracks, "state2", attributes)

    # Output results
    wgb.setDecimalDigits(5)
    outDir = "Export/data/"
    if not os.path.isdir(outDir):
        os.mkdir(outDir)
    wgb.writeJson(outDir + "data.json", (useZip is not None))
    print("Created", tracks.shape[0], "tracks, each of size", tracks.shape[1])
    print("Added the following attributes:", names)

