import numpy as np
import math


class TriangleLoader:
    """ Loads triangles (and translates/scales them if necessary) """

    def __init__(self):
        self.name = "Triangles"
        self.indices = []
        self.positions = []
        self.normals = []
        self.stateNames = []
        self.entities = []
        self.scale = 1.0
        self.center = [0, 0, 0]

    def get(self):
        return self.positions, self.indices, self.normals

    def setScale(self, scale, center=[0, 0, 0]):
        """ Set scale and center in order to adjust the triangle coordinates """
        self.center = center
        self.scale = scale

    def calculateNormal(self, p1, p2, p3):
        """ Simple triangle-based approach to calculate normals """
        Ux = p2[0] - p1[0]
        Uy = p2[1] - p1[1]
        Uz = p2[2] - p1[2]
        Vx = p3[0] - p1[0]
        Vy = p3[1] - p1[1]
        Vz = p3[2] - p1[2]

        n = [Uy*Vz - Uz*Vy, Uz*Vx - Ux*Vz, Ux*Vy - Uy*Vx]
        l = math.sqrt(sum([x**2 for x in n]))
        return [x / l for x in n]

    def addFromObj(self, filename):
        """ Import obj file """
        import re
        reComp = re.compile("(?<=^)(v |vn |vt |f )(.*)(?=$)", re.MULTILINE)
        with open(filename) as f:
            data = [txt.group() for txt in reComp.finditer(f.read())]

        v_arr, vn_arr, vt_arr, f_arr = [], [], [], []
        for line in data:
            tokens = line.split(' ')
            if tokens[0] == 'v':
                v_arr.append([float(c) for c in tokens[1:]])
            elif tokens[0] == 'vn':
                vn_arr.append([float(c) for c in tokens[1:]])
            elif tokens[0] == 'vt':
                vn_arr.append([float(c) for c in tokens[1:]])
            elif tokens[0] == 'f':
                f_arr.append(
                    [[int(i) if len(i) else 0 for i in c.split('/')] for c in tokens[1:]])

        vertices, normals = [], []
        for face in f_arr:
            for tp in face:
                vertices += v_arr[tp[0]-1][0:3]
                normals += vn_arr[tp[2]-1]
        indices = list(range(0, int(len(vertices)/3)))
        entities = len(indices) * [0]
        self.addData(entities, indices, vertices, normals)

    def addFromObj2(self, file):
        """ Import obj file """

        import pywavefront  # pip install PyWavefront
        scene = pywavefront.Wavefront(file)
        scene.parse()  # Explicit call to parse() needed when parse=False

        entityId = 0
        entities = []
        indices = []
        points = []
        pointCounter = 0
        normals = []

        for n in scene.parser.normals:
            normals += [n[0], n[1], n[2]]
        print(normals)
        print(len(normals))

        if True:
            # Below: the official way, but without normals
            # Iterate vertex data collected in each material
            for name, material in scene.materials.items():
                # Contains the vertex format (string) such as "T2F_N3F_V3F"
                # T2F, C3F, N3F and V3F may appear in this string
                material.vertex_format
                # Contains the vertex list of floats in the format described above
                material.vertices
                numPoints = int(len(material.vertices) / 3)
                entities = entities + [len(self.entities)] * numPoints
                indices = indices + \
                    list(range(len(indices), (len(indices) + numPoints)))
                points = points + material.vertices
                # for i in range(int(numPoints/3)):
                #normal = self.calculateNormal(material.vertices[(9*i):(9*i+3)], material.vertices[(9*i+3):(9*i+6)], material.vertices[(9*i+6):(9*i+9)])
                #normals += normal * 3
                # Material properties

                material.diffuse
                material.ambient
                material.texture
        self.addData(entities, indices, points, normals)

    def addFromStl(self, file):
        """ This adds another state (of the same "entity"). If you want to add another 3D object,
            please create a new instance of the TriangleBuilder. 
            Every state must use the same indices (and thus must have the exact same number of 
            vertices)! Adding a new entity will overwrite the indices. Make sure everything you
            add uses the same indices. """
        from stl import mesh  # pip install numpy-stl
        m = mesh.Mesh.from_file(file)

        # The next lines are arrays of arrays. We assume that each entity consists only of one 3D object.
        # For displaying multiple objects, create another "dataset" using a new instance of TriangleBuilder

        entityId = 0
        entities = []
        indices = []
        pointsFlattened = []
        pointsScaled = []
        pointCounter = 0
        for p in m.points:
            entities.append(entityId)
            entities.append(entityId)
            entities.append(entityId)
            indices.append(pointCounter)
            pointCounter += 1
            indices.append(pointCounter)
            pointCounter += 1
            indices.append(pointCounter)
            pointCounter += 1
            for e in p:
                pointsFlattened.append(float(e))
                # Get normals, but multiply them for each vertex (TODO: better normals)
        normals = []
        for n in m.normals:
            l = math.sqrt(n[0]**2 + n[1]**2 + n[2]**2)
            n = [n[0] / l, n[1] / l, n[2] / l]
            normals.append(n)
            normals.append(n)
            normals.append(n)
        normals = np.array(normals).flatten()
        self.addData(entities, indices, pointsFlattened, normals)

    def addData(self, entities, indices, points, normals):
        """ Handles the triangle data (no matter from where they were imported) """
        pointsScaled = []
        for i in range(len(points)):
            if i % 3 == 0:
                pointsScaled.append((points[i] - self.center[0]) * self.scale)
            elif i % 3 == 1:
                pointsScaled.append((points[i] - self.center[1]) * self.scale)
            else:
                pointsScaled.append((points[i] - self.center[2]) * self.scale)
        self.positions.append([pointsScaled])
        self.entities.append(entities)
        self.indices.append(indices)
        self.normals.append([[float(x) for x in normals]])
