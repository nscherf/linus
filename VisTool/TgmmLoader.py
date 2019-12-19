import os
import xml.etree.ElementTree as ET
import copy

from .AbstractLoader import AbstractLoader


class TgmmLoader(AbstractLoader):
    """ A helper to load a folder of TGMM files
    """
    def __init__(self, folderWithXMLs, resampleTo=50, minTrackLength=2,dim=3):
        super(TgmmLoader, self).__init__(resampleTo, minTrackLength)
        self.loadXMLs(folderWithXMLs)
        self.trackListToNumpy()

    def loadXMLs(self, folder):
        self.trackList = {}
        counter = -1
        lastCells = {}
        for filename in sorted(os.listdir(folder)):
            currentCells = {}
            if filename.endswith(".xml"):
                self.simpleStatusPrint(counter, 1)
                counter += 1
                root = ET.parse(folder + "/" + filename).getroot()
                cellCounter = 0
                for child in root:
                    if not child.attrib["parent"] in lastCells.keys():
                        trackName = str(counter) + "_" + str(cellCounter)
                        self.trackList[trackName] = []
                    else:
                        trackName = lastCells[child.attrib["parent"]]
                    currentCells[child.attrib["id"]] = trackName
                    coords = [float(x)
                              for x in child.attrib["m"].strip().split(" ")]
                    if "scale" in child.attrib:
                        scales = [
                            float(x) for x in child.attrib["scale"].strip().split(" ")]
                        coords = [a*b for a, b in zip(scales, coords)]
                    for i in range(len(coords), 3):
                        coords.append(0)  # Fill up missing dimensions with 0
                    coords.append(counter)
                    self.trackList[trackName].append(coords)
                    cellCounter += 1
            lastCells = copy.deepcopy(currentCells)
        print()

