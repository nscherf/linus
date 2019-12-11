import numpy as np
import math


class TrackModifier:
    """ Provides functionality to add features or modify a trajectory """

    def __init__(self, tracks, attributes, attributeNames):
        self.tracks = tracks
        self.attributes = attributes
        self.attributeNames = attributeNames

    def get(self):
        """ Returns the (altered, updated) tracks """
        return self.tracks, self.attributes, self.attributeNames

    def translate(self, x, y, z):
        """ Moves all track positions by x/y/z """
        self.tracks[:, :, 0] += x
        self.tracks[:, :, 1] += y
        self.tracks[:, :, 2] += z

    def scale(self, scale):
        """ scales all track positions by a certain value """
        self.tracks[:, :, :] *= scale

    def getBarycenter(self):
        """ Average of all track positions """
        return[self.tracks[:, :, 0].mean(), self.tracks[:, :, 1].mean(), self.tracks[:, :, 2].mean()]

    def getMin(self):
        """ Minimum ( [x, y, z] ) of all track positions """
        return[self.tracks[:, :, 0].min(), self.tracks[:, :, 1].min(), self.tracks[:, :, 2].max()]

    def getMax(self):
        """ Maximum ( [x, y, z] ) of all track positions """
        return[self.tracks[:, :, 0].max(), self.tracks[:, :, 1].max(), self.tracks[:, :, 2].max()]

    def getExtent(self):
        """ The longest extent of any dimension """
        mi = self.getMin()
        ma = self.getMax()
        return max(ma[0] - mi[0], ma[1] - mi[1], ma[2] - mi[2])

    def addAttributeRadius(self):
        """ Calculates the distance of each position to 0/0/0. If center  
            point is somewhere else, translate the tracks accordingly """
        centers = np.zeros_like(self.tracks)
        dist = centers - self.tracks
        dist = np.square(dist)
        dist = np.sum(dist, axis=2)
        dist = np.sqrt(dist)
        self.attributeNames.append("Radius")
        self.attributes = np.append(self.attributes, np.zeros(
            (self.attributes.shape[0], self.attributes.shape[1], 1)), axis=2)
        self.attributes[:, :, self.attributes.shape[2]-1] = dist

    def sim(self, p1, p2):
        """Cosine similarity with clamped negative values - If two vectors
            look in opposing directions, result is 0 instead of -1 """
        l1 = math.sqrt((p1[0])**2 + (p1[1])**2 + (p1[2])**2)
        l2 = math.sqrt((p2[0])**2 + (p2[1])**2 + (p2[2])**2)
        if l1 == 0 or l2 == 0:
            return -2
        return ((p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]) / l1 / l2) / 2. + 0.5

    def addAttributeAngleToStart(self):
        """ Creates an attribute holding the angle between the beginning (the 
            first 5%) of the track and each local position """
        sims = np.zeros((self.tracks.shape[0], self.tracks.shape[1]))
        for t in range(self.tracks.shape[0]):
            i2 = int(0.05 * self.tracks.shape[1])
            ref = self.tracks[t, i2, :] - self.tracks[t, 0, :]
            for p in range(self.tracks.shape[1] - 1):
                local = self.tracks[t, p+1, :] - self.tracks[t, p, :]
                sims[t, p] = self.sim(ref, local)
        self.attributeNames.append("Angle to start")
        self.attributes = np.append(self.attributes, np.zeros(
            (self.attributes.shape[0], self.attributes.shape[1], 1)), axis=2)
        self.attributes[:, :, self.attributes.shape[2]-1] = sims

    def addAttributeTime(self):
        """ Adds an attribute with numbers 0, 1, ..., n for the respective 
            position of a track """
        self.attributeNames.append("Time")
        self.attributes = np.append(self.attributes, np.zeros(
            (self.attributes.shape[0], self.attributes.shape[1], 1)), axis=2)
        for i in range(self.attributes.shape[1]):
            self.attributes[:, i, self.attributes.shape[2]-1] = i
