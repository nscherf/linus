import numpy as np
import json
import re
import zlib
import base64


class WebGlToolBuilder:
    """ Tool to combine data in order to create a JSON file for the WebGL tool """

    def __init__(self, dim=3):
        self.data = {}
        self.data["dim"] = dim
        self.data["sets"] = []
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

    def addTriangleDataset(self, positions, indices, normals, datasetName, scale):
        """ Create the JSON structure that is needed for the WebGL-Tool """
        s = {}
        s["name"] = datasetName
        s["type"] = "triangles"
        s["selectable"] = False
        s["entities"] = []
        for i in range(len(indices)):
            t = []
            for p in range(int(len(indices[i]) / 3)):
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
        self.data["sets"].append(s)

    def addTrajectoryDatasetState(self, tracks, stateName):
        """ Adds another state to the newest dataset. Note, the state must have identical
            number of tracks/positions as previous state. """
        state, lineIds, indices = self.exportJsonHelperState(
            tracks, [], [], stateName, len(self.data["sets"][-1]["states"]))
        self.data["sets"][-1]["states"].append(state)

    def writeJson(self, path, zipped):
        """ Outputs the data, and optionally zips it """
        print("Convert data to JSON")
        data = json.dumps(self.data)

        # Replace long digits by regex accepting only n digits
        decimal = ""
        for i in range(self.accuracy):
            decimal += "[0-9]"
        print("Reduce accuracy to", self.accuracy, "digits")
        data = re.sub('\s(-?[0-9]+\.'+decimal+')([0-9]*)', r'\1', data)

        if zipped:
            print("Create zipped version")
            data = zlib.compress(str.encode(data))
            data = "\""+base64.b64encode(data).decode()+"\""

        with open(path, 'w') as outfile:
            outfile.write("var data = " + data)
        print("Done with export")
