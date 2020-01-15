import os
import numpy as np
from scipy.ndimage import zoom
import json
import csv
import sys

from .AbstractLoader import AbstractLoader


class BiotracksLoader(AbstractLoader):
    """ A helper to load a folder of CSV files and to represent it by:
        - a numpy array for the positions, [n_tracks, n_pos_per_track, 3 (x/y/z)]
        - a numpy array for attributes, [n_tracks, n_pos_per_track, n_attributes]
        - a list of attribute names, derived from the header or automatically [att0, att1,...] """

    def __init__(self, jsonPath, resampleTo=50, minTrackLength=2, dim=3):
        super(BiotracksLoader, self).__init__(resampleTo, minTrackLength)
        self.dim = dim
        self.jsonPath = jsonPath # Better a slash too much...
        self.folder = os.path.dirname(jsonPath)
        self.trackPath = "tracks.csv"
        self.initDataStructure()
        self.analyzeSettingFile(jsonPath)
        self.createFullTracks()
        self.convertTrackListToMatrix()

    def initDataStructure(self):
        self.linkPaths = []
        self.linkKeys = []
        self.linkNames = []
        self.objectPaths = {}
        self.objectKeys = {}
        self.objectColumns = {}
        self.linkCollection = {}
        self.attributeNames.append("Frame")
        self.objects = {}
        self.links = {}

    def createFullTracks(self):
        """ Loads all objects (and their unique ID), loads the links (which
            are a list of object IDs), loads the tracks (which are a list 
            of link IDs) and resolves the information to a single list 
            of tracks
        """
        self.checkLinkFiles()
        self.buildTracks()

    def checkLinkFiles(self):
        # We check all files containing links
        for i in range(len(self.linkPaths)):
            self.checkLinkFile(i)
            
    def checkLinkFile(self, i):
        # The column names.
        objectListName = self.linkKeys[i]["objectListName"]
        objectColumnName = self.linkKeys[i]["objectColumnName"]
        # TODO: is it correct to assume this constant strings?
        objectColumnTime = "cmso_frame_id"
        objectColumnX = "cmso_x_coord"
        objectColumnY = "cmso_y_coord"
        objectColumnZ = "cmso_z_coord"

        # Open objects and store x, y, z, t
        try:
            with open(self.objectPaths[objectListName]) as objectFile:
                objectReader = csv.DictReader(objectFile, delimiter=',')
                for row in objectReader:
                    c = [row[objectColumnX], row[objectColumnY]]
                    if objectColumnZ in row:
                        c.append(row[objectColumnZ])
                    else:
                        c.append(0)
                    c.append(row[objectColumnTime])
                    self.objects[row[objectColumnName]] = c
        except IOError:
            self.stopBecauseMissingFile(self.objectPaths[objectListName], "object file")

        # Get list of links
        try:
            with open(self.linkPaths[i]) as linkFile:
                linkReader = csv.reader(linkFile, delimiter=',')
                next(linkReader, None)  # skip header
                for row in linkReader:
                    if not row[0] in self.links:
                        self.links[row[0]] = []
                    self.links[row[0]].append(row[1])
        except IOError:
            self.stopBecauseMissingFile(self.linkPaths[i], "link file")

    def buildTracks(self):
        try:
            with open(self.trackPath) as trackFile:
                trackReader = csv.reader(trackFile, delimiter=',')
                next(trackReader, None)  # skip header

                for row in trackReader:
                    if not row[0] in self.trackList:
                        self.trackList[row[0]] = []
                    for p in self.links[row[1]]:
                        self.trackList[row[0]].append(self.objects[p])
        except IOError:
            self.stopBecauseMissingFile(self.trackPath, "track file")

    def analyzeSettingFile(self, path):
        self.trackPath = self.folder + "/tracks.csv"
        try:
            with open(path) as json_file:
                data = json.load(json_file)
                self.analyzeJSON(data)
        except IOError:
            self.stopBecauseMissingFile(path, "json file")

    def analyzeJSON(self, data):
        for r in range(len(data["resources"])):
            if "primaryKey" in data["resources"][r]["schema"]:
                self.analyzePrimary(data["resources"][r])
            if "foreignKeys" in data["resources"][r]["schema"]:
                self.analyzeForeign(data["resources"][r])

    def analyzePrimary(self, data):
        objId = data["name"]
        self.objectPaths[objId] = self.folder + "/" + data["path"]
        self.objectKeys[objId] = data["schema"]["primaryKey"]
        self.objectColumns[objId] = [x["name"] for x in data["schema"]["fields"]]    

    def analyzeForeign(self, data):
        keys = {}
        for i in range(len(data["schema"]["foreignKeys"])):
            keys["objectListName"] = data["schema"]["foreignKeys"][i]["reference"]["resource"]
            keys["objectColumnName"] = data["schema"]["foreignKeys"][i]["reference"]["fields"]
        self.linkKeys.append(keys)
        self.linkPaths.append(self.folder + "/" + data["path"])
        self.linkNames.append(data["name"])
        


