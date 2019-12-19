import numpy as np
from scipy.ndimage import zoom


class AbstractLoader:
    def __init__(self, resampleTo, minTrackLength):
        """ Initialization with basic members.
        """
        self.trackList = {}
        self.tracksNp = np.empty((0))
        self.attributesNp = np.empty((0))
        self.attributeNames = []
        self.resampleTo = resampleTo
        self.dim = 3
        self.minTrackLength = minTrackLength
        # Child class must fill self.trackList, self.dim and self.attributeNames!

    def trackListToNumpy(self):
        """ Converts the internal list (dictionary trackId -> track, where
            each track is an array of [x, y, z, a1, a2, ...]) to
            a numpy array and resizes them to self.resampleTo.
            Requries self.dim and self.attributeNames to be properly filled.
        """
        self.tracksNp = np.zeros(
            (len(self.trackList.keys()), self.resampleTo, self.dim))
        self.attributesNp = np.zeros(
            (len(self.trackList.keys()), self.resampleTo, len(self.attributeNames)))
        counter = 0
        print("Convert tracks to numpy array")
        for i in self.trackList.keys():
            trackNp = np.zeros((len(self.trackList[i]), 3))
            # TODO: handle attributes?
            attributesNp = np.zeros(
                (len(self.trackList[i]), len(self.attributeNames)))
            for j in range(len(self.trackList[i])):
                trackNp[j, 0] = self.trackList[i][j][0]
                trackNp[j, 1] = self.trackList[i][j][1]
                trackNp[j, 2] = self.trackList[i][j][2]
                for a in range(len(self.attributeNames)):
                    attributesNp[j, a] = self.trackList[i][j][self.dim + a]
            scale = float(self.resampleTo) / len(trackNp)

            # Resize the track, if valid size
            if len(trackNp) > self.minTrackLength:
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
                self.simpleStatusPrint(counter, 50)
                counter += 1
            else:
                self.tracksNp = self.tracksNp[0:(len(self.tracksNp)-1)]
                self.attributesNp = self.attributesNp[0:(
                    len(self.attributesNp)-1)]
        print()

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
        return self.tracksNp, self.attributesNp, self.attributeNames
