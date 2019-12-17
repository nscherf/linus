import os
import argparse
import VisTool as vt

# Output OpenCL compiler messages (including warnings).
os.environ['PYOPENCL_COMPILER_OUTPUT'] = "1"
# Set your favorite OpenCL device here, if you want. Remove line for being asked on each run.
os.environ['PYOPENCL_CTX'] = "0"

# Prepare the command line interface
parser = argparse.ArgumentParser(description='Prepare trajectory data for WebGL visualization.')
parser.add_argument("-csv", help="A folder containing (only) CSV files with tracks", default=None, nargs="?")
parser.add_argument("-biotracks", help="The biotracks JSON file", default=None, nargs="?")
parser.add_argument("-tgmm", help="A folder containing (only) TGMM files with tracks", default=None, nargs="?")
parser.add_argument("--stl", help="A stl file for context/background", default=None, nargs="?")
parser.add_argument("--addRadius", help="Create an attribute containing the radius (distance to center)", action='store_true', default=None)
parser.add_argument("--addAngle", help="Create an attribute containing the angle between initial orientation and local orientation", action='store_true', default=None)
parser.add_argument("--addTime", help="Create an attribute containing the time/counter of the track position (first pos is 0, ..., n)", action='store_true', default=None)
parser.add_argument("--addBundled", help="Creates a bundled version of the tracks and adds them as a second state", action='store_true', default=None)
parser.add_argument("--moveToCenter", help="Moves the data to its barycenter", action='store_true', default=None)
parser.add_argument("--scaleToUnit", help="Scale the data to a maximum width of 1", action='store_true', default=None)
args = parser.parse_args()
parser.print_help()

# Get the arguments. Not-provided arguments default to "None"
csvPath = args.csv
tgmmPath = args.tgmm
biotracksPath = args.biotracks
stlPath = args.stl
addRadius = args.addRadius
addAngle = args.addAngle
addTime = args.addTime
addBundled = args.addBundled
moveToCenter = args.moveToCenter
scaleToUnit = args.scaleToUnit


# Case 1: Use the command line interface
loadFromCmd = tgmmPath != None or csvPath != None or biotracksPath != None
if loadFromCmd:
    if csvPath != None:
        print("Load from CSV...")
        loader = vt.CsvLoader(csvPath, 50, firstLineIsHeader=False)
    if tgmmPath != None:
        print("TODO - TGMM")
        loader = vt.TgmmLoader(tgmmPath, 50)
    if biotracksPath != None:
        print("Load from Biotracks...")
        loader = vt.BiotracksLoader(biotracksPath, 50)
    tracks, attributes, names = loader.get()

    # Start the track modifier that adjusts the data or adds attributes
    tm = vt.TrackModifier(tracks, attributes, names)

    scale = 1.
    if scaleToUnit != None:
        extent = tm.getExtent()
        scale = 1. / extent
        tm.scale(scale)

    bary = [0., 0., 0.]
    if moveToCenter != None:
        bary = tm.getBarycenter()
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
    wgb = vt.WebGlToolBuilder()

    # First, add background data. Note, we need the scale we derived from the tracks
    if stlPath != None:
        triangles = vt.TriangleLoader()
        triangles.setScale(scale)
        triangles.addFromStl(stlPath)
        positions, indices, normals = triangles.get()
        wgb.addTriangleDataset(positions, indices, normals, "Context", scale)

    # Finally, add the track data
    wgb.addTrajectoryDataset(tracks, attributes, names, "Trajectories", scale)

    # Add states (to the last dataset, which is the trajectory set)
    if addBundled is not None:
        tm.addAttributeAngleToStart()
        bundler = vt.EdgeBundler(tracks)
        bundler.estimateDefaultValues()
        bundler.runEdgeBundlingOpenCl()
        tracksBundled = bundler.getResult()
        wgb.addTrajectoryDatasetState(tracksBundled, "bundled")

    # Output results
    wgb.setDecimalDigits(5)
    wgb.writeJson("export/data/data.json", True)
    print("Created", tracks.shape[0], "tracks, each of size", tracks.shape[1])
    print("Added the following attributes:", names)

