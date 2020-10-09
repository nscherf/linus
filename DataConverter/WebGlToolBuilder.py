import numpy as np
import json
import re
import zlib
import base64
import math
import os 

class WebGlToolBuilder:
    """ Tool to combine data in order to create a JSON file for the WebGL tool """

    def __init__(self, dim=3):
        self.data = {}
        self.data["dim"] = dim
        self.data["sets"] = []
        self.max = [-999999, -999999, -999999]
        self.accuracy = 4
        self.useZip = True

    def setDecimalDigits(self, value):
        """ Number of digits (after decimal point) that should be stored in JSON """
        self.accuracy = value

    def tracksToIndices(self, tracks):
        """ Creates index list and line ID list for a set of tracks 
            E.g. 2 tracks represented by p1_1, p1_2, p1_3 and p2_1, p2_2, p2_3 result in:
            - an index list  0, 1, 1, 2,   3, 4, 4, 5
            - a list representing to which line a position belongs: 0, 0, 0, 1, 1, 1 """
        indices = []
        lineIds = []
        counter = 0
        for trackId in range(tracks.shape[0]):
            for posId in range(tracks.shape[1] - 1):
                lineIds.append(trackId)
                indices.append(counter)
                counter += 1
                indices.append(counter)
            lineIds.append(trackId)
            counter += 1  # the skipped one
        return lineIds, indices

    def exportJsonHelperState(self, tracks, attributes, attributeNames, stateName, stateNumber):
        """ Creates JSON structure (and delivers indices/lineIDs) for a certain
            state of the data """
        lineIds, indices = self.tracksToIndices(tracks)
        state = {}
        state["name"] = stateName
        state["positions"] = [tracks.flatten().tolist()]
        self.updateMaxValues(state["positions"])
        state["attributes"] = []

        if stateNumber == 0:  # because it's shared, only for the first
            for i in range(attributes.shape[2]):
                state["attributes"].append({})
                state["attributes"][i]["name"] = attributeNames[i]
                state["attributes"][i]["dim"] = 1
                state["attributes"][i]["shared"] = True
                state["attributes"][i]["fixedColor"] = True
                state["attributes"][i]["values"] = [
                    attributes[:, :, i].flatten().tolist()]
        return state, lineIds, indices

    def createAxe(self, dimension, start, end, stepSize, startIndex):
        values = [0., 0., 0.]
        positions = []
        indices = []
        lastIndex = 0
        steps = math.ceil((end - start) / stepSize)
        for i in range(steps):
            values[dimension] = i / (steps - 1) * (end - start) + start
            if i > 0:
                lastIndex = i + startIndex
                indices.append(lastIndex - 1)
                indices.append(lastIndex)
            for v in values:
                positions.append(v)

        displaceDepth = 0.2 * stepSize
        tickDisplace = [displaceDepth, displaceDepth, displaceDepth]
        tickDisplace[dimension] = 0
        counter = 0
        for i in np.arange(stepSize, end, stepSize):
            values[dimension] = i
            indices.append(2 * counter + lastIndex + 1)
            indices.append(2 * counter + lastIndex + 2)
            for v in values:
                positions.append(v)
            for valueIndex in range(len(values)):
                positions.append(values[valueIndex] - tickDisplace[valueIndex])
            counter += 1
        return positions, indices

    def addXYZAxes(self, tickDistance):
        print("Add axes with tick distance", tickDistance)
        if self.max[0] > 0.0000001:
            positions, indices = self.createAxe(0, 0, self.max[0], tickDistance, 0)
            self.data["sets"][0]["axes"] += positions
            self.data["sets"][0]["axesIndices"] += indices

        if self.max[1] > 0.0000001:
            positions, indices = self.createAxe(1, 0, self.max[1], tickDistance, indices[-1] + 1)
            self.data["sets"][0]["axes"] += positions
            self.data["sets"][0]["axesIndices"] += indices

        if self.max[2] > 0.0000001:
            positions, indices = self.createAxe(2, 0, self.max[2], tickDistance, indices[-1] + 1)
            self.data["sets"][0]["axes"] += positions
            self.data["sets"][0]["axesIndices"] += indices

    def addCustomAxes(self, axesFolder, csvSeparator = ",", skipHeader = False):
        counter = 0
        lastIndex = 0
        for filename in sorted(os.listdir(axesFolder)):
            if filename.endswith(".csv"):
                positions, indices = self.loadAxesFile(axesFolder + "/" + filename, lastIndex, csvSeparator, skipHeader)
                if len(indices) < 4:
                    continue
                self.data["sets"][0]["axes"] += positions
                self.data["sets"][0]["axesIndices"] += indices
                lastIndex = indices[-1] + 1
                counter += 1

    def loadAxesFile(self, axesFilePath, lastIndex, csvSeparator, skipHeader):
        axesFile = open(axesFilePath, 'r') 
        lines = axesFile.readlines() 
        counter = 0
        positions = []
        indices = []
        for line in lines: 
            if counter == 0 and skipHeader:
                counter += 1
                continue
            splitted = line.split(csvSeparator)
            x = splitted[0]
            y = splitted[1]
            z = splitted[2]
            positions.append(float(x))
            positions.append(float(y))
            positions.append(float(z))
            if counter > 0:
                indices.append(counter - 1 + lastIndex)
                indices.append(counter + lastIndex)
            counter += 1
        return positions, indices

    def addTriangleDataset(self, positions, indices, normals, datasetName, scale):
        """ Create the JSON structure that is needed for the WebGL-Tool """
        s = {}
        s["name"] = datasetName
        s["type"] = "triangles"
        s["selectable"] = False
        s["entities"] = []
        for i in range(len(indices)):
            t = []
            for p in range(int(len(indices[i]))):
                t.append(i)
            s["entities"].append(t)

        s["indices"] = indices
        s["scale"] = scale
        s["states"] = []

        s["states"].append({})
        s["states"][-1]["name"] = "original"
        s["states"][-1]["positions"] = positions[0]
        s["states"][-1]["normals"] = normals[0]
        s["states"][-1]["attributes"] = []
        self.data["sets"].append(s)

    def addTrajectoryDataset(self, tracks, attributes, attributeNames, datasetName, scale):
        """ Create the JSON structure for a new data set """
        s = {}
        state, lineIds, indices = self.exportJsonHelperState(
            tracks, attributes, attributeNames, "original", 0)
        s["states"] = [state]
        s["name"] = datasetName
        s["scale"] = scale
        s["type"] = "lines"
        s["entities"] = [lineIds]
        s["indices"] = [indices]
        s["selectable"] = True
        s["axes"] = []
        s["axesIndices"] = []
        self.data["sets"].append(s)

    def updateMaxValues(self, positions):
        for j in range(0, len(positions)):
            for i in range(0, len(positions[j])):
                k = i % self.data["dim"]
                self.max[k] = max(self.max[k], positions[j][i])

    def addTrajectoryDatasetState(self, tracks, stateName, attributes=[]):
        """ Adds another state to the newest dataset. Note, the state must have identical
            number of tracks/positions as previous state. """
        state, lineIds, indices = self.exportJsonHelperState(
            tracks, attributes, [], stateName, len(self.data["sets"][-1]["states"]))
        self.data["sets"][-1]["states"].append(state)

    def writeJson(self, path, zipped):
        """ Outputs the data, and optionally zips it """
        print("Prepare data export")
        data = json.dumps(self.data)
        data = self.reduceAccuracy(data)

        if zipped:
            print("Create zipped version")
            data = self.zipData(data)

        try:
            with open(path, 'w') as outfile:
                outfile.write("var data = " + data)
        except IOError:
            print("Error! Could not create output file", path)

    def reduceAccuracy(self, data):
        # Replace long digits by regex accepting only n digits
        decimal = ""
        for i in range(self.accuracy):
            decimal += "[0-9]"
        print("Reduce accuracy to", self.accuracy, "digits")
        data = re.sub('\s(-?[0-9]+\.'+decimal+')([0-9]*)', r'\1', data)
        return data

    def zipData(self, data):
        data = zlib.compress(str.encode(data))
        data = "\""+base64.b64encode(data).decode()+"\""
        return data
