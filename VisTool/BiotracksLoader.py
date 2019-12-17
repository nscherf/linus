import os
import numpy as np
from scipy.ndimage import zoom
import json
import csv


class BiotracksLoader:
    """ A helper to load a folder of CSV files and to represent it by:
        - a numpy array for the positions, [n_tracks, n_pos_per_track, 3 (x/y/z)]
        - a numpy array for attributes, [n_tracks, n_pos_per_track, n_attributes]
        - a list of attribute names, derived from the header or automatically [att0, att1,...] """

    def __init__(self, jsonPath, resampleTo=50, dim=3):
        self.jsonPath = jsonPath + "/"  # Better a slash too much...
        self.trackPath = "tracks.csv"
        self.linkPaths = []
        self.linkKeys = []
        self.linkNames = []
        self.objectPaths = {}
        self.objectKeys = {}
        self.objectColumns = {}
        self.trackList = {}
        self.tracksNp, self.attributesNp, self.attributeNames = np.zeros(
            ()), np.zeros(()), np.zeros(())
        self.resampleTo = resampleTo

        self.analyzeJson(jsonPath)
        self.createFullTracks()
        self.trackListToNumpy()

    def trackListToNumpy(self):
        """ Converts the internal list (dictionary trackId -> track, where
            each track is an array of {t:..., x:..., y:..., z:...}) to
            a numpy array and resizes them to self.resampleTo
        """
        self.tracksNp = np.zeros(
            (len(self.trackList.keys()), self.resampleTo, 3))
        self.attributesNp = np.zeros(
            (len(self.trackList.keys()), self.resampleTo, 1))
        self.attributeNames = ["Frame"]
        counter = 0
        for i in self.trackList.keys():
            print("Handle track ", i, "of length", len(self.trackList[i]))
            trackNp = np.zeros((len(self.trackList[i]), 3))
            # TODO: handle attributes?
            attributesNp = np.zeros((len(self.trackList[i]), 1))
            for j in range(len(self.trackList[i])):
                trackNp[j, 0] = self.trackList[i][j]["x"]
                trackNp[j, 1] = self.trackList[i][j]["y"]
                trackNp[j, 2] = self.trackList[i][j]["z"]
                attributesNp[j, 0] = self.trackList[i][j]["t"]
            scale = float(self.resampleTo) / len(trackNp)

            # Resize the track, if valid size
            if len(trackNp) > 1:
                trackNpZoomed = zoom(trackNp, (scale, 1))
                if len(trackNpZoomed) != self.resampleTo:
                    print("Unexpected track size after resampling:",
                          len(trackNpZoomed))
                attributesNpZoomed = zoom(attributesNp, (scale, 1))

                # TODO: a bug - sometimes zoom produces zero values in the last row.
                # Copy first and last to always keep original start and end points
                trackNpZoomed[0] = trackNp[0]
                attributesNpZoomed[0] = attributesNp[0]
                trackNpZoomed[-1] = trackNp[-1]
                attributesNpZoomed[-1] = attributesNp[-1]
                self.tracksNp[counter] = trackNpZoomed
                self.attributesNp[counter] = attributesNpZoomed
            counter += 1

    def createFullTracks(self):
        """ Loads all objects (and their unique ID), loads the links (which
            are a list of object IDs), loads the tracks (which are a list 
            of link IDs) and resolves the information to a single list 
            of tracks
        """
        # We assume that links/objects have unique ID over all files
        self.linkCollection = {}
        objects = {}
        links = {}

        # We check all files containing links
        for i in range(len(self.linkPaths)):
            # The column names.
            objectListName = self.linkKeys[i]["objectListName"]
            objectColumnName = self.linkKeys[i]["objectColumnName"]
            # TODO: is it correct to assume this constant strings?
            objectColumnTime = "cmso_frame_id"
            objectColumnX = "cmso_x_coord"
            objectColumnY = "cmso_y_coord"
            objectColumnZ = "cmso_z_coord"
            #print("Handle object list", objectListName, "with key", objectColumnName)

            # Open objects and store x, y, z, t
            with open(self.objectPaths[objectListName]) as objectFile:
                objectReader = csv.DictReader(objectFile, delimiter=',')
                for row in objectReader:
                    c = {}
                    c["t"] = row[objectColumnTime]
                    c["x"] = row[objectColumnX]
                    c["y"] = row[objectColumnY]
                    c["z"] = 0
                    if objectColumnZ in row:
                        c["z"] = row[objectColumnZ]
                    objects[row[objectColumnName]] = c

            # Get list of links
            with open(self.linkPaths[i]) as linkFile:
                linkReader = csv.reader(linkFile, delimiter=',')
                next(linkReader, None)  # skip header
                for row in linkReader:
                    if not row[0] in links:
                        links[row[0]] = []
                    links[row[0]].append(row[1])

        # Build the tracks
        with open(self.trackPath) as trackFile:
            trackReader = csv.reader(trackFile, delimiter=',')
            next(trackReader, None)  # skip header

            for row in trackReader:
                if not row[0] in self.trackList:
                    self.trackList[row[0]] = []
                for p in links[row[1]]:
                    self.trackList[row[0]].append(objects[p])

    def analyzeJson(self, path):
        folder = os.path.dirname(path)
        self.trackPath = folder + "/tracks.csv"
        with open(path) as json_file:
            data = json.load(json_file)
            for r in range(len(data["resources"])):
                if "primaryKey" in data["resources"][r]["schema"]:
                    objId = data["resources"][r]["name"]
                    self.objectPaths[objId] = folder + \
                        "/" + data["resources"][r]["path"]
                    self.objectKeys[objId] = data["resources"][r]["schema"]["primaryKey"]
                    self.objectColumns[objId] = [x["name"]
                                                 for x in data["resources"][r]["schema"]["fields"]]
                    #print("Found an object table. Update:", self.objectPaths, self.objectKeys, self.objectColumns)
                if "foreignKeys" in data["resources"][r]["schema"]:
                    keys = {}
                    for i in range(len(data["resources"][r]["schema"]["foreignKeys"])):
                        keys["objectListName"] = data["resources"][r]["schema"]["foreignKeys"][i]["reference"]["resource"]
                        keys["objectColumnName"] = data["resources"][r]["schema"]["foreignKeys"][i]["reference"]["fields"]
                    self.linkKeys.append(keys)
                    self.linkPaths.append(
                        folder + "/" + data["resources"][r]["path"])
                    self.linkNames.append(data["resources"][r]["name"])
                    #print("Found link table", self.linkPaths, self.linkKeys, self.linkNames)

    def simpleStatusPrint(self, i=1, sparse=1):
        """ Prints a star (*) if for each call (or only if i % sparse == 0, to only print 
            every sparse^th), makes a line break every 50 """
        if i % sparse == 0:
            print("*", end='', flush=True)
        if i % (50 * sparse) == 0 and i > 0:
            print("("+str(i)+")")

    def get(self):
        """ get the three lists: tracks, attribute (values), attribute names """
        return self.tracksNp, self.attributesNp, self.attributeNames
