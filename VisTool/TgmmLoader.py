import os
import numpy as np
from scipy.ndimage import zoom
import xml.etree.ElementTree as ET


class TgmmLoader:
    """ A helper to load a folder of CSV files and to represent it by:
        - a numpy array for the positions, [n_tracks, n_pos_per_track, 3 (x/y/z)]
        - a numpy array for attributes, [n_tracks, n_pos_per_track, n_attributes]
        - a list of attribute names, derived from the header or automatically [att0, att1,...] """

    def __init__(self, folderWithXMLs, resampleTo=50, firstLineIsHeader=True, csvSeparator=",", dim=3):
        self.resampleTo = resampleTo
        self.trackList = {}
        self.tracksNp, self.attributesNp, self.attributeNames = np.zeros(
            ()), np.zeros(()), np.zeros(())
        self.loadXMLs(folderWithXMLs)
        self.trackListToNumpy()
        return
        

    def loadXMLs(self, folder):
        self.trackList = {}
        counter = -1
        for filename in sorted(os.listdir(folder)):
            if filename.endswith(".xml"):
                counter += 1
                print("Handle", filename)
                root = ET.parse(folder + "/" + filename).getroot()
                for child in root:
                    if not child.attrib["lineage"] in self.trackList:
                        print("New track")
                        self.trackList[child.attrib["lineage"]] = []
                    else:
                        print("....track exists already")
                    coords = [float(x) for x in child.attrib["m"].strip().split(" ")]
                    if "scale" in child.attrib:
                        scales = [float(x) for x in child.attrib["scale"].strip().split(" ")]
                        coords = [a*b for a,b in zip(scales, coords)]
                    for i in range(len(coords), 3):
                        coords.append(0) # Fill up missing dimensions with 0
                    coords.append(counter)
                    self.trackList[child.attrib["lineage"]].append(coords)


    def trackListToNumpy(self):
        """ Converts the internal list (dictionary trackId -> track, where
            each track is an array of [x, y, z, t] to
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
                trackNp[j, 0] = self.trackList[i][j][0]
                trackNp[j, 1] = self.trackList[i][j][1]
                trackNp[j, 2] = self.trackList[i][j][2]
                attributesNp[j, 0] = self.trackList[i][j][3]
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
