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
        self.convertTrackListToMatrix()

    def loadXMLs(self, folder):
        self.prepareDataStructure()
        for filename in sorted(os.listdir(folder)):
            self.simpleStatusPrint(self.counter, 1)
            if filename.endswith(".xml"):
                self.handleXmlFile(folder + "/" + filename)
        print()

    def prepareDataStructure(self):
        self.trackList = {}
        self.lastCells = {}
        self.counter = 0

    def handleXmlFile(self, filename):
        self.currentCells = {}
        try:
            root = ET.parse(filename).getroot()
            self.cellCounter = 0
            for child in root:
                self.loadTrack(child)
                self.cellCounter += 1
            self.lastCells = copy.deepcopy(self.currentCells)
            self.counter += 1
        except Exception:
            self.stopBecauseError("Could not handle XML file (invalid syntax?):" + filename)


    def loadTrack(self, xmlTrack):
        if not xmlTrack.attrib["parent"] in self.lastCells.keys():
            trackName = str(self.counter) + "_" + str(self.cellCounter)
            self.trackList[trackName] = []
        else:
            trackName = self.lastCells[xmlTrack.attrib["parent"]]
        self.currentCells[xmlTrack.attrib["id"]] = trackName
        coords = [float(x) for x in xmlTrack.attrib["m"].strip().split(" ")]
        if "scale" in xmlTrack.attrib:
            scales = [float(x) for x in xmlTrack.attrib["scale"].strip().split(" ")]
            coords = [a*b for a, b in zip(scales, coords)]
        for i in range(len(coords), 3):
            coords.append(0)  # Fill up missing dimensions with 0
        coords.append(self.counter)
        self.trackList[trackName].append(coords)
