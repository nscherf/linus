
import csv
from .AbstractLoader import AbstractLoader


class SvfLoader(AbstractLoader):
    """ A helper to load a folder of SVF files.
    """

    def __init__(self, svfPath, resampleTo=50, minTrackLength=2, csvSeparator=",", dim=3):
        super(SvfLoader, self).__init__(resampleTo, minTrackLength)
        self.csvSeparator = csvSeparator
        self.loadSvf(svfPath)
        self.trackListToNumpy()
        return

    def loadSvf(self, path):
        """ Loads the points from (a single, huge) CSV and establishes
            the tracking connection by using the "mother_id" attribute
        """
        self.trackList = {}
        # We must remember what the track name of a certain cell is
        parentsTrack = {}
        # We use the trackCounter to identify tracks with unique names
        trackCounter = 0
        # So far we only support one attribute, which is the time
        self.attributeNames.append("Frame")

        with open(path) as f:
            objectReader = csv.DictReader(
                f, delimiter=self.csvSeparator, skipinitialspace=True)
            for row in objectReader:
                #row = {k.replace(' ', ''): v for k, v in row.items()}
                if int(row["mother_id"]) == -1:
                    self.trackList[trackCounter] = []
                    trackId = trackCounter
                    trackCounter += 1
                    self.simpleStatusPrint(trackCounter, 50)
                else:
                    trackId = parentsTrack[int(row["mother_id"])]
                parentsTrack[int(row["id"])] = trackId
                self.trackList[trackId].append(
                    [float(row["x"]), float(row["y"]), float(row["z"]), float(row["t"])])
        print()
