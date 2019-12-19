import csv
import os

from .AbstractLoader import AbstractLoader


class CsvLoader(AbstractLoader):
    """ A helper to load a folder of CSV files and to represent it by:
        - a numpy array for the positions, [n_tracks, n_pos_per_track, 3 (x/y/z)]
        - a numpy array for attributes, [n_tracks, n_pos_per_track, n_attributes]
        - a list of attribute names, derived from the header or automatically [att0, att1,...] 
    """

    def __init__(self, folderWithCSVs, resampleTo=50, minTrackLength=2, firstLineIsHeader=True, csvSeparator=",", dim=3):
        super(CsvLoader, self).__init__(resampleTo, minTrackLength)
        self.csvSeparator = csvSeparator
        self.firstLineIsHeader = firstLineIsHeader
        self.loadCsvs(folderWithCSVs)
        self.trackListToNumpy()

    def loadCsvs(self, folder):
        """ Calls the loading-function for each csv file """
        counter = 0
        for filename in sorted(os.listdir(folder)):
            if filename.endswith(".csv"):
                with open(folder + "/" + filename) as f:
                    self.trackList[counter] = []
                    self.simpleStatusPrint(counter, 50)
                    objectReader = csv.reader(
                        f, delimiter=self.csvSeparator, skipinitialspace=True)
                    if counter == 0:
                        # If this is the first track, get attribute information
                        row = next(objectReader)
                        if self.firstLineIsHeader:
                            for i in range(self.dim, len(row)):
                                self.attributeNames.append(row[i])
                        else:
                            f.seek(0)
                            for i in range(self.dim, len(row)):
                                self.attributeNames.append(
                                    "Attrib" + str(i - self.dim))
                        print(self.attributeNames)

                    for row in objectReader:
                        self.trackList[counter].append([float(x) for x in row])
                    counter += 1
        print()
