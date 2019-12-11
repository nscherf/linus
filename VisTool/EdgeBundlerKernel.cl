
#pragma OPENCL EXTENSION cl_khr_global_int32_base_atomics : enable
#pragma OPENCL EXTENSION cl_khr_local_int32_base_atomics : enable
#pragma OPENCL EXTENSION cl_intel_printf : enable

float4 calculateLocalDirection(
        __global const float4 *points,
        int begin,
        int fiberLength,
        int myIndex
        )
{
    int end = begin + fiberLength - 1;
    int first = myIndex - 1;
    int last = myIndex + 1;

    first = max( begin, first );
    last = min( end, last );
    float4 result = normalize( points[last] - points[first] );
    //printf("Direction from index %d to %d is %v4f \n", first, last, result);
    //printf("  ...calculated from p1 %v4f and p2 %v4f", points[first], points[last] );
    return result;
}


float4 calculateOverallDirection(
        __global const float4 *points,
        int begin,
        int fiberLength
        )
{
    int end = begin + fiberLength - 1;

    float4 result = normalize( points[end] - points[begin] );
    //printf("Direction from index %d to %d is %v4f \n", first, last, result);
    //printf("  ...calculated from p1 %v4f and p2 %v4f", points[first], points[last] );
    return result;
}

/*

float4 calculateDirection(
        __global const float4 *points,
        int begin,
        int fiberLength,
        int myIndex,
        int radius
        )
{
    int end = begin + fiberLength;
    float4 result = {0, 0, 0, 0};

    for( int i = 0; i <= radius; i ++ )
    {
        int first = myIndex - i;
        int last = myIndex + i + 1;

        first = max( begin, first );
        last = min( end, last );
        result += normalize( points[last] - points[first] );
    }

    result /= radius + 1;

    return normalize( result );
}
*/


bool checkCurvature(
        __global const float4 *points,
        int begin,
        int fiberLength,
        int myIndex,
        float4 newPoint,
        float angleMin
        )
{
    // Still a bug in this function! For some reason this causes strange behaviour,
    // like clustering only parts
    return true;

    int end = begin + fiberLength - 1;

    int prePrev = myIndex - 2;
    int prev = myIndex - 1;
    int next = myIndex + 1;
    int postNext = myIndex + 2;

    prePrev = max( begin, prePrev );
    prev = max( begin, prev );
    next = min( end, next );
    postNext = min( end, postNext );

    // Calculate curvature before index of interest, at index, and after index.
    // Calculate this for both the old and the new situation.
    // If all angles are getting smaller (TODO allow minor changes ), return true.

    // Angles of status quo
    float anglePrev1 = dot( normalize( points[prePrev] - points[prev] ), normalize( points[prev] - points[myIndex] ) );
    float angle1     = dot( normalize( points[prev] - points[myIndex] ), normalize( points[myIndex] - points[next] ) );
    float angleNext1 = dot( normalize( points[myIndex] - points[next] ), normalize( points[next] - points[postNext]) );
    float angleSum1 = anglePrev1 + angle1 + angleNext1;
    // Angles after change
    float anglePrev2 = dot( normalize( points[prePrev] - points[prev] ), normalize( points[prev] -        newPoint ) );
    float angle2     = dot( normalize( points[prev] -        newPoint ), normalize( newPoint        - points[next] ) );
    float angleNext2 = dot( normalize( newPoint        - points[next] ), normalize( points[next] - points[postNext]) );
    float angleSum2 = anglePrev2 + angle2 + angleNext2;

    // Short cut: if it's better - straighter - over all, just do it!
    if( angleSum2 > angleSum1 ) return true;

    return ( angleMin <= anglePrev2 ) && ( angleMin <= angle2 ) && ( angleMin <= angleNext2 );
    // return ( anglePrev1 <= anglePrev2 ) && ( angle1 <= angle2 ) && ( angleNext1 <= angleNext2 );
}


int calculateClosestIndex(
        int fiberStart,
        int fiberLength,
        __global const float4 *points,
        float4 myPosition
        )
{
    float minDistance = 99999;
    int bestIndex = -1;
    for( int i = fiberStart; i < fiberStart + fiberLength; i++ )
    {
        float newDistance = length( points[ i ] - myPosition );

        if( newDistance < minDistance )
        {
            minDistance = newDistance;
            bestIndex = i;
        }
    }

    return bestIndex;
}



float4 transformForcePerpendicular( float4 direction, float4 force )
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

    float l = length( force );
    float4 forceOriginal = force;

    //printf("Function transform, direction is %v4f\n", direction);

    if( l <= 0.0)
    {
        // No transform if the force is near non-existing
        return force;
    }

    // Normalize the force (direction already is unit vector)
    force = force / l;
    //printf("  force orientation %v4f, length %f\n", force, l);
    float t = dot( direction, force );
    float sgn = 1;
    if( t > 0.0 )
    {
        t = t * -1.;
        sgn = 1.;
    }

    //printf("    similarity between direction and force is %f\n", t);


    force.x -= t * direction.x;
    force.y -= t * direction.y;
    force.z -= t * direction.z;

    if( dot( forceOriginal, force ) < 0 )
    {
        //printf("    rotate adjusted force \n");
        force *= -1.f;
    }


    //printf("  force adjusted is %v4f\n\n", force);

    return  l * force;
}



float4 calculateForce(
        __global const int* clusterIndices,
        int clusterStart,
        int clusterLength,
        __global const int *fiberStarts,
        __global const int *fiberLengths,
        __global const float4 *points,
        float4 myPosition,
        float4 myDirection,
        float angleStick,
        float radius
        )
{
    //printf("  Function calculating force, my direction is now %v4f \n", myDirection);

    float weightSum = 1.;
    float4 force = { 0, 0, 0, 0 };

    // Iterate over IDs of all streamlines of this cluster
    for( int i = clusterStart; i < clusterStart + clusterLength; i++ )
    {
        // get all information about specific streamline
        int fiberId = clusterIndices[ i ];
        int fiberStart = fiberStarts[ fiberId ];
        int fiberLength = fiberLengths[ fiberId ];
        int closestIndex = calculateClosestIndex(
                                fiberStart,
                                fiberLength,
                                points,
                                myPosition
                                );
        // ...including closest point and direction of closest passing
        float minDistance = length( points[ closestIndex] - myPosition );

        if( minDistance > radius || minDistance <= 0.0 ) // TODO: Maybe something better than 0 check? Just should avoid "itself"
        {
            continue;
        }

        float4 direction = calculateLocalDirection(
                               points,
                               fiberStart,
                               fiberLength,
                               closestIndex );

        // Depending on distance etc, calculate a weight
        float weight = ( ( radius - minDistance ) / radius );
        if(!isnan(myDirection.x) && !isnan(direction.x))
        {
            float angle = pow( (float) dot( myDirection, direction ), (float) 2. );
            angle = max( 0., ( angle - angleStick ) / ( 1. - angleStick )  );
            float weight = angle * weight;
        }

        weight = pow( (float) weight, (float) 2. );
        weightSum += weight;
        force += weight * ( points[ closestIndex] - myPosition );
    }

    force /= weightSum;

    if(!isnan(myDirection.x))
    {
        force = transformForcePerpendicular( myDirection, force );
    }

    return force;
}




__kernel void skeletonize(
        __global const int* fiberStarts,
        __global const int* fiberLengths,
        __global const int* clusterStarts,
        __global const int* clusterLengths,
        __global const int* clusterIndices,
        __global const int* clusterInverse,
        __global const float4* points,
        __global float4* pointsResult,
        __global const float* magnetRadius,
        __global const float* stepsize,
        __global const float* angleMin,
        __global const float* angleStick,
        __global const int* offset,
        __global const int* bundleEndPoints
         )
{
    // Orientation phase - who am I, to which clusters do I belong,
    // who are my colleagues?
    int slId = get_global_id( 0 ) + *offset;
    int clusterId = clusterInverse[ slId ];
    int fiberStart = fiberStarts[ slId ];
    int fiberLength = fiberLengths[ slId ];
    int clusterStart = clusterStarts[ clusterId ];
    int clusterLength = clusterLengths[ clusterId ];

    // Settings
    float angleMinLocal = *angleMin;
    float angleStickLocal = *angleStick;
    float radiusLocal = *magnetRadius; // TODO check bugs in other versions

    // walk along the fiber; if bundleEndPoints 0, we iterate from 1 to n-1; otherwise 0 to n
    int index = 0;
    int skip = 1 - *bundleEndPoints; 

    for( int i = fiberStart + skip; i < ( fiberStart + fiberLength - skip ); i++ )
    {


        // Get current point and tangent of this point
        float4 myPosition = points[ i ];

        // approach 1: consider local direction
        /*
        float4 direction = calculateLocalDirection(
                               points,
                               fiberStart,
                               fiberLength,
                               i );
        */
        // approach 2: consider overall fiber direction
        float4 direction = calculateOverallDirection(
                               points,
                               fiberStart,
                               fiberLength);


        // DEBUG LINES
        //pointsResult[i] = points[i] + direction;
        //continue;

        // calculate the "pressure" from other streamlines of this cluster
        //printf("give direction into function: %v4f\n", direction);
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
                           radiusLocal
                           );


        /*
        float4 forceWider = calculateForce(
                           clusterIndices,
                           clusterStart,
                           clusterLength,
                           fiberStarts,
                           fiberLengths,
                           points,
                           myPosition,
                           direction,
                           angleStickLocal,
                           2.0 * radiusLocal
                           );
        force.x -= 0.15 * forceWider.x;
        force.y -= 0.15 * forceWider.y;
        force.z -= 0.15 * forceWider.z;
        */
        //printf(" Force is %v4f \n\n", force);
        float4 innerDirection = ( points[ i + 1 ] + points[ i - 1 ] );
        // innerDirection /= 2;
        // innerDirection = innerDirection - myPosition;
        //if( dot( normalize( force ), normalize( innerDirection ) ) < -0.2 )
        {
            //force = 0 * innerDirection;
        }
        //force = innerDirection;

        float4 resultPoint = { 0, 0, 0, 0 };
        resultPoint.x = force.x; // DEBUG
        resultPoint.y = force.y; // DEBUG
        resultPoint.z = force.z; // DEBUG
        resultPoint.w = *stepsize; // DEBUG

        resultPoint.x = slId; // DEBUG
        resultPoint.y = clusterId; // DEBUG
        resultPoint.z = fiberLength; // DEBUG
        resultPoint.w = 0; // DEBUG
        
        resultPoint.x = myPosition.x + *stepsize * force.x;
        resultPoint.y = myPosition.y + *stepsize * force.y;
        resultPoint.z = myPosition.z + *stepsize * force.z;
        
        pointsResult[ i ] = resultPoint;


        /*
        // This part is somewhat error-prone. Simple smoothing might bring
        // better results.
        if( checkCurvature( points,
                            fiberStart,
                            fiberLength,
                            i,
                            resultPoint,
                            angleMinLocal ) )
        {
            pointsResult[ i ] = resultPoint;
        }
        */

        index++;
    }
}





float4 smoothPosition(
        __global const float4 *points,
        int begin,
        int fiberLength,
        int myIndex,
        __global const int* radius,
        __global const float* intensity
        )
{
    float4 reference = points[ myIndex ];

    // get index of first and last index used for smoothing
    int end = begin + fiberLength - 1;
    int first = myIndex - *radius;
    int last = myIndex + *radius;
    first = max( begin, first );
    last = min( end, last );

    float4 result = { 0, 0, 0, 0 };

    for( int i = first; i < last + 1; i++ )
    {
        result.x += points[ i ].x / ( last - first + 1 );
        result.y += points[ i ].y / ( last - first + 1 );
        result.z += points[ i ].z / ( last - first + 1 );
    }

    result.x = result.x * *intensity + reference.x * ( 1. - *intensity );
    result.y = result.y * *intensity + reference.y * ( 1. - *intensity );
    result.z = result.z * *intensity + reference.z * ( 1. - *intensity );

    return result;
}



__kernel void smooth(
        __global const int* fiberStarts,
        __global const int* fiberLengths,
        __global const float4* points,
        __global float4* pointsResult,
        __global const int* radius,
        __global const float* intensity,
        __global const int* offset
         )
{
    // If smoothing is (practically) disabled, leave
    if( *radius == 0 || *intensity < 0.001 )
    {
        return;
    }

    // Orientation phase - who am I, to which clusters do I belong,
    // who are my colleagues?
    int slId = get_global_id( 0 ) + *offset;
    int fiberStart = fiberStarts[ slId ];
    int fiberLength = fiberLengths[ slId ];

    // Smooth pointwise
    for( int i = fiberStart + 1; i < ( fiberStart + fiberLength - 1 ); i++ )
    {
        float4 resultPoint = smoothPosition( points, fiberStart, fiberLength, i, radius, intensity );
        pointsResult[ i ] = resultPoint;
    }
}

