import os
import numpy as np
from scipy.ndimage import zoom
import json
import csv

from .AbstractLoader import AbstractLoader


class BiotracksLoader(AbstractLoader):
    """ A helper to load a folder of CSV files and to represent it by:
        - a numpy array for the positions, [n_tracks, n_pos_per_track, 3 (x/y/z)]
        - a numpy array for attributes, [n_tracks, n_pos_per_track, n_attributes]
        - a list of attribute names, derived from the header or automatically [att0, att1,...] """

    def __init__(self, jsonPath, resampleTo=50, minTrackLength=2, dim=3):
        super(BiotracksLoader, self).__init__(resampleTo, minTrackLength)
        self.dim = dim
        self.jsonPath = jsonPath + "/"  # Better a slash too much...
        self.trackPath = "tracks.csv"
        self.linkPaths = []
        self.linkKeys = []
        self.linkNames = []
        self.objectPaths = {}
        self.objectKeys = {}
        self.objectColumns = {}

        self.analyzeJson(jsonPath)
        self.createFullTracks()
        self.trackListToNumpy()

    def createFullTracks(self):
        """ Loads all objects (and their unique ID), loads the links (which
            are a list of object IDs), loads the tracks (which are a list 
            of link IDs) and resolves the information to a single list 
            of tracks
        """
        # We assume that links/objects have unique ID over all files
        self.linkCollection = {}
        self.attributeNames.append("Frame")
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
                    c = [row[objectColumnX], row[objectColumnY]]
                    if objectColumnZ in row:
                        c.append(row[objectColumnZ])
                    else:
                        c.append(0)
                    c.append(row[objectColumnTime])
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
