
import csv
from .AbstractLoader import AbstractLoader


class SvfLoader(AbstractLoader):
    """ A helper to load a folder of SVF files.
    """

    def __init__(self, svfPath, resampleTo=50, minTrackLength=2, csvSeparator=",", dim=3):
        super(SvfLoader, self).__init__(resampleTo, minTrackLength)
        self.csvSeparator = csvSeparator
        self.loadSvf(svfPath)
        self.convertTrackListToMatrix()
        
    def loadSvf(self, path):
        """ Loads the points from (a single, huge) CSV and establishes
            the tracking connection by using the "mother_id" attribute
        """
        self.initDataStructure()
        try:
            with open(path) as f:
                objectReader = csv.DictReader(f, delimiter=self.csvSeparator, skipinitialspace=True)
                for row in objectReader:
                    self.handleCsvRow(row)
        except IOError:
            self.stopBecauseMissingFile(path, "csv file")
        print()

    def handleCsvRow(self, row):
        if int(row["mother_id"]) == -1:
            self.trackList[self.trackCounter] = []
            trackId = self.trackCounter
            self.trackCounter += 1
            self.simpleStatusPrint(self.trackCounter, 50)
        else:
            trackId = self.parentsTrack[int(row["mother_id"])]
        self.parentsTrack[int(row["id"])] = trackId
        self.trackList[trackId].append([float(row["x"]), float(row["y"]), float(row["z"]), float(row["t"])])

    def initDataStructure(self):
        self.trackList = {}
        # We must remember what the track name of a certain cell is
        self.parentsTrack = {}
        # We use the trackCounter to identify tracks with unique names
        self.trackCounter = 0
        # So far we only support one attribute, which is the time
        self.attributeNames = ["Frame"]