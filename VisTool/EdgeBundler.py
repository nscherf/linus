import os
import math
import random
import copy
import sys
import numpy as np
import time
from scipy.ndimage import zoom


TYPEF = np.float64
TYPEI = np.int32


class EdgeBundler:
    """ Tool to perform edge bundling on a numpy array of tracks:
        [num_tracks, num_pos_per_track, x/y/z]
        The results are provided in the same shape. """

    def __init__(self, tracks):
        """ Inits parameters with default values. Most of them will be overwritten automatically """
        startTime = time.time()
        self.min = [sys.maxsize, sys.maxsize, sys.maxsize]
        self.max = [-sys.maxsize, -sys.maxsize, -sys.maxsize]
        self.tracksNp = tracks
        self.tracksBundledNp = np.zeros_like(tracks)
        self.trackLength = self.tracksNp.shape[1]
        self.min = [self.tracksNp[:, :, 0].min(
        ), self.tracksNp[:, :, 1].min(), self.tracksNp[:, :, 2].min()]
        self.max = [self.tracksNp[:, :, 0].max(
        ), self.tracksNp[:, :, 1].max(), self.tracksNp[:, :, 2].max()]

        # OpenCl-Parameters, will contain typed arrays later on
        self.oclFiberStarts = np.empty(0, dtype=TYPEI)
        self.oclFiberLengths = np.empty(0, dtype=TYPEI)
        self.oclClusterStarts = np.empty(0, dtype=TYPEI)
        self.oclClusterLengths = np.empty(0, dtype=TYPEI)
        self.oclClusterIndices = np.empty(0, dtype=TYPEI)
        self.oclClusterInverse = np.empty(0, dtype=TYPEI)
        self.oclPoints = np.empty(0, dtype=TYPEF)
        self.oclPointsResult = np.empty(0, dtype=TYPEF)
        self.magnetRadius = 0
        self.stepsize = 0
        self.angleMin = 0
        self.angleStick = 0
        self.offset = 0
        self.bundleEndPoints = 0

        # To be set up by user. However, some of them might be overwritten later automatically
        # with the purpose to provide a nice default value.
        self.dimension = 3  # default is 3D data
        self.numClusters = 5
        self.quickBundleLength = 8
        self.quickBundleIterations = 20
        self.bundlingIterations = 15
        self.chunkSize = 10000  # number of calculations per CL-call
        self.scale = 1.

    def setMagnetRadius(self, val):
        """ Setter for the radius in which magnetic forces should apply. High values
            might result in "shrinking" of the data (like in a black hole...), low
            values will only lead to minor local changes. Something like 1-5% of the
            overall dataset width seems good."""
        self.magnetRadius = val

    def setBundlingIterations(self, val):
        """ Number of iterations for bundling. After each iteration, data will be
            smoothed (if smoothing is enabled). In general, there are two options:
            1) high step size and only a few iterations
            2) short step size and more iterations
            By default, we use 20 iterations and a step size of 0.5 """
        self.bundlingIterations = val

    def setClusterIterations(self, val):
        """ Number of iterations for the initial subdivision of the data. After
            10-20 iterations, usually nothing changes anymore. """
        self.quickBundleIterations = val

    def simpleStatusPrint(self, i=1, sparse=1):
        """ Prints a star (*) if for each call (or only if i % sparse == 0, to only print 
            every sparse^th), makes a line break every 50 """
        if i % sparse == 0:
            print("*", end='', flush=True)
        if i % (50 * sparse) == 0 and i > 0:
            print("("+str(i)+")")

    def estimateDefaultValues(self):
        """ Set some of the parameters depending on data size. """
        # Some - for now - fixed values:
        self.stepsize = .5
        self.angleMin = 0.
        self.angleStick = 0.0
        self.bundleEndPoints = 0
        self.smoothRadius = 1.
        self.smoothIntensity = 0.5  # TODO. 0.5

        self.min = [x for x in self.min]
        self.max = [x for x in self.max]

        diagonal = math.sqrt(
            sum([(x[0]-x[1])**2 for x in zip(self.max, self.min)]))
        self.magnetRadius = diagonal * 0.02
        # if self.oclMagnetRadius > 9: self.oclMagnetRadius = int(self.oclMagnetRadius) # pure cosmetics
        self.numClusters = math.ceil(len(self.tracksNp) / 100)

        print("Overview of automatically derived parameters:")
        #print("Min and max are at", self.min, self.max)
        print("Diagonal of data space is", diagonal,
              ". We choose 2% of that as bundling radius:", self.magnetRadius)
        print("Number of tracks is", len(self.tracksNp),
              ", hence we chose", self.numClusters, "as number of clusters")

    def prepareOpenClData(self, cl):
        """ Prepare the data (tracks, clusters) by copying into OpenCl-readable layout """
        # We first care about tracks and what points belong to them
        self.oclFiberStarts = np.array(
            [self.trackLength * x for x in range(len(self.tracksNp))], dtype=TYPEI)
        self.oclFiberLengths = np.array(
            [self.trackLength for x in range(len(self.tracksNp))], dtype=TYPEI)
        cl.oclPoints = self.trackNpToNpOpenCl4D(self.tracksNp)
        pointCounter = len(self.tracksNp) * self.trackLength

        # The result array is just the same like the input. Since the result might only
        # fill some positions, we have to initialize the result with the original points.
        cl.oclPointsResult = copy.deepcopy(cl.oclPoints)

        # Now we store clusters and their relation to the tracks
        self.oclClusterIndices = np.empty(0, dtype=TYPEI)
        self.oclClusterInverse = np.zeros(
            shape=(len(self.tracksNp)), dtype=TYPEI)
        self.oclClusterStarts = np.empty(0, dtype=TYPEI)
        self.oclClusterLengths = np.empty(0, dtype=TYPEI)
        trackCounter = 0
        for c in range(len(self.clusters)):
            self.oclClusterStarts = np.append(
                self.oclClusterStarts, trackCounter)
            self.oclClusterLengths = np.append(
                self.oclClusterLengths, len(self.clusters[c]))
            for i in range(len(self.clusters[c])):
                self.oclClusterIndices = np.append(
                    self.oclClusterIndices, self.clusters[c][i])
                self.oclClusterInverse[self.clusters[c][i]] = c
            trackCounter += len(self.clusters[c])

    def printPrepareOpenClSummary(self, cl):
        """ Just some debug output """
        print("\nData preparation summary:")
        print(len(cl.oclPoints), "points organized in ", len(
            self.tracksNp), "tracks and ", len(self.clusters), "clusters")
        print("Radius: ", self.magnetRadius, ", step size: ",
              self.stepsize, ", angle: ", self.angleMin)
        print("stickyness: ", self.angleStick,
              ", endpoint bundling: ", self.bundleEndPoints)
        print("smoothing: ", self.smoothIntensity,
              ", smoothing radius: ", self.smoothRadius)

    def convertOpenClSettingsToClTypes(self, cl):
        """ Converts to respective c-like floats/ints. This step is performed separately, which 
            allows easy adjustment of the values with python-types beforehand (meaning, the user
            doesn't have to care about using proper types when he/she sets up parameters) """
        # Array-like structures
        cl.oclFiberStarts = np.array(self.oclFiberStarts, dtype=np.int32)
        cl.oclFiberLengths = np.array(self.oclFiberLengths, dtype=np.int32)
        cl.oclClusterStarts = np.array(self.oclClusterStarts, dtype=np.int32)
        cl.oclClusterLengths = np.array(self.oclClusterLengths, dtype=np.int32)
        cl.oclClusterIndices = np.array(self.oclClusterIndices, dtype=np.int32)
        cl.oclClusterInverse = np.array(self.oclClusterInverse, dtype=np.int32)
        # Scalar values; For copy-and-paste reasons they are handled as array, too, since
        # openCl doesn't care anyway (in OpenCL we receive pointers only)
        cl.oclMagnetRadius = np.array(
            [self.magnetRadius * self.scale], dtype=np.float32)
        cl.oclStepsize = np.array([self.stepsize], dtype=np.float32)
        cl.oclAngleMin = np.array([self.angleMin], dtype=np.float32)
        cl.oclAngleStick = np.array([self.angleStick], dtype=np.float32)
        cl.oclBundleEndPoints = np.array(
            [self.bundleEndPoints], dtype=np.int32)
        cl.oclSmoothRadius = np.array([self.smoothRadius], dtype=np.int32)
        cl.oclSmoothIntensity = np.array(
            [self.smoothIntensity], dtype=np.float32)

    def prepareOpenClBuffers(self, cl):
        """ Copies the data into buffer objects (in order to transfer them to GPU) """
        print("Copy data into buffers")
        import pyopencl as pyopencl
        self.convertOpenClSettingsToClTypes(cl)
        cl.oclFiberStartsBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclFiberStarts)
        cl.oclFiberLengthsBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclFiberLengths)
        cl.oclClusterStartsBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclClusterStarts)
        cl.oclClusterLengthsBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclClusterLengths)
        cl.oclClusterIndicesBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclClusterIndices)
        cl.oclClusterInverseBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclClusterInverse)
        cl.oclPointsBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_WRITE | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclPoints)
        cl.oclPointsResultBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_WRITE | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclPointsResult)
        cl.oclMagnetRadiusBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclMagnetRadius)
        cl.oclStepsizeBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclStepsize)
        cl.oclAngleMinBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclAngleMin)
        cl.oclAngleStickBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclAngleStick)
        cl.oclBundleEndPointsBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclBundleEndPoints)
        cl.oclSmoothRadiusBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclSmoothRadius)
        cl.oclSmoothIntensityBuf = pyopencl.Buffer(
            cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=cl.oclSmoothIntensity)

    def getChunkSizes(self):
        """ Splits the workload into chunks that are processed separately. Reason: too many 
            items at once can make the GPU crash. Furthermore we have more frequent status
            updates this way """
        num = math.floor(len(self.tracksNp) / self.chunkSize)
        remainder = len(self.tracksNp) % self.chunkSize
        return [self.chunkSize] * num + [remainder]

    def postProcessOpenCl(self, cl):
        """ Check the results and convert them back to the array structure """
        totalCounter = 0
        print("Convert data back")
        for t in range(len(self.tracksBundledNp)):
            for i in range(self.trackLength):
                self.tracksBundledNp[t, i, 0] = cl.oclPoints[totalCounter][0]
                self.tracksBundledNp[t, i, 1] = cl.oclPoints[totalCounter][1]
                self.tracksBundledNp[t, i, 2] = cl.oclPoints[totalCounter][2]
                totalCounter += 1

    def prepareOpenCl(self, cl):
        """ Create the basic OpenCL structures """
        import pyopencl as pyopencl
        cl.ctx = pyopencl.create_some_context()
        cl.queue = pyopencl.CommandQueue(cl.ctx)
        cl.mf = pyopencl.mem_flags
        self.prepareOpenClData(cl)
        self.printPrepareOpenClSummary(cl)
        self.prepareOpenClBuffers(cl)

    def getResult(self):
        """ Retrieve the results from here """
        return self.tracksBundledNp

    def runEdgeBundlingOpenCl(self):
        """ The whole magic! """
        if self.bundlingIterations == 0:
            return

        cl = EdgeBundlerClComponents()

        self.quickBundles()
        self.prepareOpenCl(cl)
        chunkSizes = self.getChunkSizes()
        startTime = time.time()
        import pyopencl as pyopencl

        sourceCode = ""
        with open(os.path.dirname(os.path.realpath(__file__))+'/EdgeBundlerKernel.cl', 'r') as sourceCodeFile:
            sourceCode = sourceCodeFile.read()
        # How to add flags, like constants: .build(options=['-D', "WINDOW=111",...])
        prg = pyopencl.Program(cl.ctx, sourceCode).build()
        print("Run edge bundling in ",
              (self.bundlingIterations * len(chunkSizes)), "iterations: ")
        for i in range(self.bundlingIterations):
            # Step 1: edge bundling (piecewise, to avoid freezes and to provide better status updates)
            offset = 0
            for j in range(len(chunkSizes)):
                self.simpleStatusPrint(i * len(chunkSizes) + j)
                numThreads = chunkSizes[j]
                offsetInt32 = np.array(offset, dtype=np.int32)
                cl.oclOffsetBuf = pyopencl.Buffer(
                    cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=offsetInt32)
                prg.skeletonize(cl.queue, [numThreads], None,
                                cl.oclFiberStartsBuf,
                                cl.oclFiberLengthsBuf,
                                cl.oclClusterStartsBuf,
                                cl.oclClusterLengthsBuf,
                                cl.oclClusterIndicesBuf,
                                cl.oclClusterInverseBuf,
                                cl.oclPointsBuf,
                                cl.oclPointsResultBuf,
                                cl.oclMagnetRadiusBuf,
                                cl.oclStepsizeBuf,
                                cl.oclAngleMinBuf,
                                cl.oclAngleStickBuf,
                                cl.oclOffsetBuf,
                                cl.oclBundleEndPointsBuf)
                offset += chunkSizes[j]

            # Step 2: move result to input slot
            pyopencl.enqueue_copy(cl.queue, cl.oclPoints,
                                  cl.oclPointsResultBuf)
            pyopencl.enqueue_copy(cl.queue, cl.oclPointsBuf, cl.oclPoints)

            # Step 3: smoothing (piecewise, to avoid freezes and to provide better status updates)
            offset = 0
            for j in range(len(chunkSizes)):
                numThreads = chunkSizes[j]
                offsetInt32 = np.array(offset, dtype=np.int32)
                cl.oclOffsetBuf = pyopencl.Buffer(
                    cl.ctx, cl.mf.READ_ONLY | cl.mf.COPY_HOST_PTR, hostbuf=offsetInt32)
                prg.smooth(cl.queue, [numThreads], None,
                           cl.oclFiberStartsBuf,
                           cl.oclFiberLengthsBuf,
                           cl.oclPointsBuf,
                           cl.oclPointsResultBuf,
                           cl.oclSmoothRadiusBuf,
                           cl.oclSmoothIntensityBuf,
                           cl.oclOffsetBuf)
                offset += chunkSizes[j]

            # Step 4: again, move result to input slot
            pyopencl.enqueue_copy(cl.queue, cl.oclPoints,
                                  cl.oclPointsResultBuf)
            pyopencl.enqueue_copy(cl.queue, cl.oclPointsBuf, cl.oclPoints)
        print(" ")  # Newline after status prints

        print("Finished edge bundling after", time.time() - startTime)
        self.postProcessOpenCl(cl)

    def trackNpToNpOpenCl4D(self, tracks):
        """ Creates cl-typed array and fills it with track positions """
        import pyopencl.array as cl_array
        npa = np.zeros((len(tracks), self.trackLength),
                       dtype=cl_array.vec.float4)
        for i in range(len(tracks)):
            for p in range(self.trackLength):
                npa[i, p][0] = tracks[i, p, 0]
                npa[i, p][1] = tracks[i, p, 1]
                npa[i, p][2] = tracks[i, p, 2]
        return npa.flatten()

    def calculateMeanTracksNumpy(self, tracks, clusters):
        """ Calculates the mean of a number of tracks. Works only for equally sized tracks. """
        meanTracks = np.zeros((self.numClusters, self.quickBundleLength, 3))
        meanTrackCounter = [0] * len(meanTracks)
        i = 0
        for t in range(len(tracks)):
            meanTrackCounter[clusters[i]] += 1.
            ratio = 1. / float(meanTrackCounter[clusters[i]])
            meanTracks[clusters[i]] = (
                1. - ratio) * meanTracks[clusters[i]] + ratio * tracks[i]
            i += 1
        return meanTracks

    def distanceBetweenTracks(self, t1, t2):
        """ Sum of distances between the points of two tracks (pairwise
            comparison i^th with i^th point) """
        dist = 0
        for i in range(len(t1)):
            dist += t1[i].distanceTo(t2[i])
        return dist

    def quickBundles(self):
        """ Simple clustering based on spatial proximity """
        # Some loop variables
        print("Performing clustering in",
              self.quickBundleIterations, "iterations: ")

        targetScale = float(self.quickBundleLength) / float(self.trackLength)
        tracksQb = zoom(self.tracksNp, (1, targetScale, 1))

        clusters = [[] for i in range(self.numClusters)]
        # Actually we want to have it all filled -
        clustersReverse = list(range(len(self.tracksNp)))

        # Put a streamline to each clusters
        fillStepsize = int(len(tracksQb) / self.numClusters)
        meanTracks = np.zeros((self.numClusters, self.quickBundleLength, 3))
        for i in range(self.numClusters):
            meanTracks[i] = tracksQb[i * fillStepsize]

        clusterSizesDebug = []
        for i in range(len(clusters)):
            clusterSizesDebug.append(len(clusters[i]))

        start = time.time()
        for i in range(self.quickBundleIterations):
            self.simpleStatusPrint(i)
            clusters = [[] for i in range(self.numClusters)]

            for t in range(len(tracksQb)):
                lowestDistance = 99999999
                bestIndex = -1

                # Create an array only filled with n times the track of interest (track t)
                trackRepeated = np.zeros_like(meanTracks)
                for ii in range(len(trackRepeated)):
                    trackRepeated[ii] = tracksQb[t]

                diff = np.sum(
                    np.sum(np.square(trackRepeated - meanTracks), axis=2), axis=1)
                bestIndex = np.argmin(diff)
                clusters[bestIndex].append(t)
                clustersReverse[t] = bestIndex
            #print("Clusters: ", clusters)
            meanTracks = self.calculateMeanTracksNumpy(
                tracksQb, clustersReverse)
            clusterSizesDebug = []
            for ii in range(len(clusters)):
                clusterSizesDebug.append(len(clusters[ii]))
            print("After iteration", i, ", cluster sizes:", clusterSizesDebug)
        print(" ")
        print("Finished clustering after", time.time() - start)
        self.debugMeanTracks = meanTracks
        self.clusters = np.array(clusters)
        self.clustersReverse = np.array(clustersReverse)

    def plotTracks(self, tracks, clusters=[], alpha=0.2):
        """ Simple 3D plot """
        import matplotlib.pyplot as plt
        colorList = []
        for i in range(max(1, self.numClusters)):  # TODO Case "0" - necessary?!?!
            colorList.append([random.uniform(0, 1), random.uniform(
                0, 1), random.uniform(0, 1), alpha])

        fig = plt.figure()
        ax = fig.gca(projection='3d')
        counter = 0
        for t in range(len(tracks)):
            x = tracks[t, :, 0]
            y = tracks[t, :, 1]
            z = tracks[t, :, 2]

            if len(clusters) == 0:  # TODO Necessary?!?!
                colorIndex = 0
            else:
                colorIndex = clusters[counter]

            ax.plot(x, y, z, color=colorList[colorIndex])
            counter += 1
        plt.show()


class EdgeBundlerClComponents:
    """ Contains data/buffers that are only relevant for opencl. """

    def __init__(self):
        self.oclFiberStartsBuf = 0
        self.oclFiberLengthsBuf = 0
        self.oclClusterStartsBuf = 0
        self.oclClusterLengthsBuf = 0
        self.oclClusterIndicesBuf = 0
        self.oclClusterInverseBuf = 0
        self.oclPointsBuf = 0
        self.oclPointsResultBuf = 0
        self.oclMagnetRadiusBuf = 0
        self.oclStepsizeBuf = 0
        self.oclAngleMinBuf = 0
        self.oclAngleStickBuf = 0
        self.oclOffsetBuf = 0
        self.oclBundleEndPointsBuf = 0
        self.ctx = 0
        self.oclFiberStarts = 0
        self.oclFiberLengths = 0
        self.oclClusterStarts = 0
        self.oclClusterLengths = 0
        self.oclClusterIndices = 0
        self.oclClusterInverse = 0
        self.oclMagnetRadius = 0
        self.oclStepsize = 0
        self.oclAngleMin = 0
        self.oclAngleStick = 0
        self.oclBundleEndPoints = 0
        self.oclSmoothRadius = 0
        self.oclSmoothIntensity = 0
