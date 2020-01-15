#pragma OPENCL EXTENSION cl_khr_global_int32_base_atomics : enable
#pragma OPENCL EXTENSION cl_khr_local_int32_base_atomics : enable
#pragma OPENCL EXTENSION cl_intel_printf : enable

float4 calculateLocalDirection(
    __global const float4 *points,
    int begin,
    int fiberLength,
    int myIndex)
{
    int end = begin + fiberLength - 1;
    int first = myIndex - 1;
    int last = myIndex + 1;

    first = max(begin, first);
    last = min(end, last);
    float4 result = normalize(points[last] - points[first]);
    return result;
}

float4 calculateOverallDirection(
    __global const float4 *points,
    int begin,
    int fiberLength)
{
    int end = begin + fiberLength - 1;

    float4 result = normalize(points[end] - points[begin]);
    return result;
}

int calculateClosestIndex(
    int fiberStart,
    int fiberLength,
    __global const float4 *points,
    float4 myPosition)
{
    float minDistance = 99999;
    int bestIndex = -1;
    for (int i = fiberStart; i < fiberStart + fiberLength; i++)
    {
        float newDistance = length(points[i] - myPosition);
        if (newDistance < minDistance)
        {
            minDistance = newDistance;
            bestIndex = i;
        }
    }

    return bestIndex;
}

float4 transformForcePerpendicular(float4 direction, float4 force)
{
    // forceCorrected := force - t * n
    // We take the force, which points to any direction. This could lead
    // to distorted lines. We want to avoid this by keeping the force
    // vector within the plane perpendicular to the direction of the line.
    // This is achieved by calculating the dot between tangent vector and
    // force vector. If force is perpendicular already, result would be 0.
    // If not, we subtract the tangent vector (by a ratio of the dot
    // product of direction and force). The resulting point lies within
    // the plane.
    float l = length(force);
    float4 forceOriginal = force;

    if (l <= 0.0)
    {
        // No transform if the force is near non-existing
        return force;
    }

    // Normalize the force (direction already is unit vector)
    force = force / l;
    float t = dot(direction, force);
    float sgn = 1;
    if (t > 0.0)
    {
        t = t * -1.;
        sgn = 1.;
    }

    force.x -= t * direction.x;
    force.y -= t * direction.y;
    force.z -= t * direction.z;

    if (dot(forceOriginal, force) < 0)
    {
        force *= -1.f;
    }

    return l * force;
}

float4 calculateForce(
    __global const int *clusterIndices,
    int clusterStart,
    int clusterLength,
    __global const int *fiberStarts,
    __global const int *fiberLengths,
    __global const float4 *points,
    float4 myPosition,
    float4 myDirection,
    float angleStick,
    float radius)
{
    float weightSum = 1.;
    float4 force = {0, 0, 0, 0};

    // Iterate over IDs of all streamlines of this cluster
    for (int i = clusterStart; i < clusterStart + clusterLength; i++)
    {
        // get all information about specific streamline
        int fiberId = clusterIndices[i];
        int fiberStart = fiberStarts[fiberId];
        int fiberLength = fiberLengths[fiberId];
        int closestIndex = calculateClosestIndex(
            fiberStart,
            fiberLength,
            points,
            myPosition);
        float minDistance = length(points[closestIndex] - myPosition);
        // TODO: Maybe something better than 0 check? Just should avoid "itself"
        if (minDistance > radius || minDistance <= 0.0)
        {
            continue;
        }

        float4 direction = calculateLocalDirection(
            points,
            fiberStart,
            fiberLength,
            closestIndex);

        float weight = ((radius - minDistance) / radius);

        if (!isnan(myDirection.x) && !isnan(direction.x))
        {
            float angle = pow((float)dot(myDirection, direction), (float)2.);
            angle = max(0., (angle - angleStick) / (1. - angleStick));
            float weight = angle * weight;
        }

        weight = pow((float)weight, (float)2.);
        weightSum += weight;
        force += weight * (points[closestIndex] - myPosition);
    }

    force /= weightSum;

    if (!isnan(myDirection.x))
    {
        force = transformForcePerpendicular(myDirection, force);
    }

    return force;
}

__kernel void skeletonize(
    __global const int *fiberStarts,
    __global const int *fiberLengths,
    __global const int *clusterStarts,
    __global const int *clusterLengths,
    __global const int *clusterIndices,
    __global const int *clusterInverse,
    __global const float4 *points,
    __global float4 *pointsResult,
    __global const float *magnetRadius,
    __global const float *stepsize,
    __global const float *angleMin,
    __global const float *angleStick,
    __global const int *offset,
    __global const int *bundleEndPoints)
{
    // Orientation phase - who am I, to which clusters do I belong,
    // who are my colleagues?
    int slId = get_global_id(0) + *offset;
    int clusterId = clusterInverse[slId];
    int fiberStart = fiberStarts[slId];
    int fiberLength = fiberLengths[slId];
    int clusterStart = clusterStarts[clusterId];
    int clusterLength = clusterLengths[clusterId];

    // Settings
    float angleMinLocal = *angleMin;
    float angleStickLocal = *angleStick;
    float radiusLocal = *magnetRadius; // TODO check bugs in other versions

    // walk along the fiber; if bundleEndPoints 0, we iterate from 1 to n-1; otherwise 0 to n
    int index = 0;
    int skip = 1 - *bundleEndPoints;

    for (int i = fiberStart + skip; i < (fiberStart + fiberLength - skip); i++)
    {
        // Get current point and tangent of this point
        float4 myPosition = points[i];
        float4 direction = calculateOverallDirection(
            points,
            fiberStart,
            fiberLength);

        float4 force = calculateForce(
            clusterIndices,
            clusterStart,
            clusterLength,
            fiberStarts,
            fiberLengths,
            points,
            myPosition,
            direction,
            angleStickLocal,
            radiusLocal);

        float4 innerDirection = (points[i + 1] + points[i - 1]);

        float4 resultPoint = {0, 0, 0, 0};
        resultPoint.x = myPosition.x + *stepsize * force.x;
        resultPoint.y = myPosition.y + *stepsize * force.y;
        resultPoint.z = myPosition.z + *stepsize * force.z;
        pointsResult[i] = resultPoint;

        index++;
    }
}

float4 smoothPosition(
    __global const float4 *points,
    int begin,
    int fiberLength,
    int myIndex,
    __global const int *radius,
    __global const float *intensity)
{
    float4 reference = points[myIndex];

    // get index of first and last index used for smoothing
    int end = begin + fiberLength - 1;
    int first = myIndex - *radius;
    int last = myIndex + *radius;
    first = max(begin, first);
    last = min(end, last);

    float4 result = {0, 0, 0, 0};

    for (int i = first; i < last + 1; i++)
    {
        result.x += points[i].x / (last - first + 1);
        result.y += points[i].y / (last - first + 1);
        result.z += points[i].z / (last - first + 1);
    }

    result.x = result.x * *intensity + reference.x * (1. - *intensity);
    result.y = result.y * *intensity + reference.y * (1. - *intensity);
    result.z = result.z * *intensity + reference.z * (1. - *intensity);

    return result;
}

__kernel void smooth(
    __global const int *fiberStarts,
    __global const int *fiberLengths,
    __global const float4 *points,
    __global float4 *pointsResult,
    __global const int *radius,
    __global const float *intensity,
    __global const int *offset)
{
    // If smoothing is (practically) disabled, leave
    if (*radius == 0 || *intensity < 0.001)
    {
        return;
    }

    // Orientation phase - who am I, to which clusters do I belong,
    // who are my colleagues?
    int slId = get_global_id(0) + *offset;
    int fiberStart = fiberStarts[slId];
    int fiberLength = fiberLengths[slId];

    // Smooth pointwise
    for (int i = fiberStart + 1; i < (fiberStart + fiberLength - 1); i++)
    {
        float4 resultPoint = smoothPosition(points, fiberStart, fiberLength, i, radius, intensity);
        pointsResult[i] = resultPoint;
    }
}