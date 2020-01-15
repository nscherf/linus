import numpy as np
import sys
from scipy.ndimage import zoom


class AbstractLoader:
    def __init__(self, resampleTo, minTrackLength):
        """ Initialization with basic members.
            Child classes must fill self.trackList, self.dim and 
            self.attributeNames!
        """
        self.trackList = {}
        self.tracksMatrix = np.empty((0))
        self.attributesMatrix = np.empty((0))
        self.attributeNames = []
        self.resampleTo = resampleTo
        self.dim = 3
        self.minTrackLength = minTrackLength

    def convertTrackListToMatrix(self):
        """ Converts the internal list (dictionary trackId -> track, where
            each track is an array of [x, y, z, a1, a2, ...]) to
            a numpy array and resizes them to self.resampleTo.
            Requries self.dim and self.attributeNames to be properly filled.
        """
        self.initEmptyTrackMatrix()
        counterValidTracks = 0
        print("Convert tracks to numpy array")
        for trackId in self.trackList.keys():
            track, attributes = self.trackFromListToMatrix(trackId)
            if len(track) > self.minTrackLength:
                track, attributes = self.resizeTrack(track, attributes)
                self.addTrackToMatrix(counterValidTracks,
                                      track, attributes)
                self.simpleStatusPrint(counterValidTracks, 50)
                counterValidTracks += 1
            else:
                self.shrinkTrackMatrix()
        print()

    def trackFromListToMatrix(self, index):
        track = np.zeros((len(self.trackList[index]), 3))
        attributes = np.zeros(
            (len(self.trackList[index]), len(self.attributeNames)))
        for j in range(len(self.trackList[index])):
            track[j, 0] = self.trackList[index][j][0]
            track[j, 1] = self.trackList[index][j][1]
            track[j, 2] = self.trackList[index][j][2]
            for a in range(len(self.attributeNames)):
                attributes[j, a] = self.trackList[index][j][self.dim + a]
        return track, attributes

    def initEmptyTrackMatrix(self):
        self.tracksMatrix = np.zeros(
            (len(self.trackList.keys()), self.resampleTo, self.dim))
        self.attributesMatrix = np.zeros(
            (len(self.trackList.keys()), self.resampleTo, len(self.attributeNames)))

    def addTrackToMatrix(self, position, track, attributes):
        self.tracksMatrix[position] = track
        self.attributesMatrix[position] = attributes

    def shrinkTrackMatrix(self):
        """ Removes the last column of the track/attribute matrices,
            e.g. after a track was deleted """
        self.tracksMatrix = self.tracksMatrix[0:(len(self.tracksMatrix)-1)]
        self.attributesMatrix = self.attributesMatrix[0:(len(self.attributesMatrix)-1)]

    def resizeTrack(self, track, attributes):
        scale = float(self.resampleTo) / len(track)
        trackZoomed = zoom(track, (scale, 1))
        attributesZoomed = zoom(attributes, (scale, 1))
        if len(trackZoomed) != self.resampleTo:
            print("Warning: Unexpected length after resampling:", len(trackZoomed))

        # Copy first and last to always keep original start and end points,
        # avoiding interpolation artifacts.
        trackZoomed[0] = track[0]
        attributesZoomed[0] = attributes[0]
        trackZoomed[-1] = track[-1]
        attributesZoomed[-1] = attributes[-1]
        return trackZoomed, attributesZoomed

    def simpleStatusPrint(self, i=1, sparse=1):
        """ Prints a star (*) if for each call (or only if i % sparse == 0, to only print 
            every sparse^th), makes a line break every 50 
        """
        if i % sparse == 0:
            print("*", end='', flush=True)
        if i % (50 * sparse) == 0 and i > 0:
            print("("+str(i)+")")

    def get(self):
        """ get the three lists: tracks, attribute (values), attribute names 
        """
        return self.tracksMatrix, self.attributesMatrix, self.attributeNames

    def stopBecauseMissingFile(self, filename, description):
        self.stopBecauseError("Could not open " + description + ": " + filename)

    def stopBecauseError(self, description):
        print("\nError!", description)
        sys.exit()