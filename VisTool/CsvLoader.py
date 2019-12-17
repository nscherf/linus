import os
import numpy as np
from scipy.ndimage import zoom


class CsvLoader:
    """ A helper to load a folder of CSV files and to represent it by:
        - a numpy array for the positions, [n_tracks, n_pos_per_track, 3 (x/y/z)]
        - a numpy array for attributes, [n_tracks, n_pos_per_track, n_attributes]
        - a list of attribute names, derived from the header or automatically [att0, att1,...] """

    def __init__(self, folderWithCSVs, resampleTo=50, firstLineIsHeader=True, csvSeparator=",", dim=3):
        self.folder = folderWithCSVs + "/"  # Better a slash too much...
        self.filenameList = []
        self.headerList = []
        self.numAttributes = -1
        self.attributeNames = []
        self.firstLineIsHeader = firstLineIsHeader
        self.attributesNp = 0
        self.tracksNp = 0
        self.processOneNth = 1
        self.csvSeparator = csvSeparator
        self.dimension = dim
        self.resampleTo = resampleTo
        self.load()

    def addAttributeName(self, name):
        """ Add another attribute name. If no name is provided, generic ones will be generated """
        self.attributeNames.append(name)

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

    def load(self):
        """ Calls the loading-function for each csv file """
        counter = 0
        counterValid = 0
        print("Loading files from:", self.folder)

        # First we store everything into a list since we don't know the final size
        trackList = []
        attributeList = []

        for filename in sorted(os.listdir(self.folder)):
            if filename.endswith(".csv"):
                self.simpleStatusPrint(counter, 50)
                if not counter % self.processOneNth == 0:
                    counter += 1
                    continue
                trackNp, attributeNp = self.loadFileNp(self.folder + filename)
                if counterValid == 0:
                    if self.firstLineIsHeader:
                        self.analyzeHeader(self.folder + filename)
                    else:
                        self.attributeNames = [
                            "att"+str(x) for x in range(attributeNp.shape[1])]
                if len(trackNp) > 1:
                    trackList.append(trackNp)
                    attributeList.append(attributeNp)
                    counterValid += 1

                self.filenameList.append(filename)
                counter += 1

        # Now bring everything into numpy layout
        self.attributesNp = np.zeros(
            (counterValid, self.resampleTo, self.numAttributes))
        self.tracksNp = np.zeros(
            (counterValid, self.resampleTo, self.dimension))
        for i in range(len(trackList)):
            self.tracksNp[i] = trackList[i]
            self.attributesNp[i] = attributeList[i]
        self.tracksBundledNp = np.copy(self.tracksNp)
        print(" ")  # new line after status prints

    def loadFileNp(self, filename):
        """ Opens a csv, reads all contents (except for first line if it is assumed to be a 
            header), everything after 2nd/3rd column is treated as attribute """
        trackNp = np.array([])
        attributesNp = np.array([])
        skipHeader = 0
        if self.firstLineIsHeader:
            skipHeader = 1
        rawData = np.genfromtxt(
            filename, delimiter=self.csvSeparator, skip_header=skipHeader)
        trackNp = rawData[:, 0:self.dimension]
        if self.numAttributes == -1:
            self.numAttributes = len(rawData[0]) - self.dimension
        attributesNp = rawData[:, self.dimension:len(rawData[0])]
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
            trackNp = trackNpZoomed
            attributesNp = attributesNpZoomed
        return trackNp, attributesNp

    def analyzeHeader(self, fileName):
        """ Copies the header names to the attribute name list """
        with open(fileName) as f:
            l = f.readline().split(self.csvSeparator)
            counter = 0
            for i in range(self.dimension, len(l)):
                self.addAttributeName(l[i].strip())
