export default class Shaders {
    /**
     * Raw vertex shader with placeholders
     */
    vertexShader() {
        return `
#genericUniforms#
#genericVaryings#
#genericAttributes#
#customVars#

attribute float setId;
attribute float axeType;
attribute float drawIndex;

varying vec3 vOrientation;
varying vec3 vOrientationColor;
varying vec3 vPosition;
varying vec3 vNextPosition;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vCenter;
varying float vDepth;
varying float vSetId;
varying float vAxeType;
varying float vDrawIndex;
varying float vDiscardThis;
varying float vHideThis;
varying float vLongDiff;
varying float vLatDiff;
uniform float scale;
uniform float state;
uniform float defocusState;
uniform float shading;
uniform float glossiness;
uniform float darkenInside;
uniform float mercator;
uniform int mercatorMode;
uniform float mercatorRadius;
uniform float mercatorOffset;
uniform float mercatorOffset2;
uniform float mercatorOffset3;
uniform float zLower;
uniform float zUpper;
uniform float xLower;
uniform float xUpper;
uniform float yLower;
uniform float yUpper;
uniform vec3 projPlane;
uniform vec3 projPlaneN;
uniform float projLevel;

mat4 rotationMatrix(vec3 axis, float angle) 
{
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}

void main() 
{
    vSetId = setId;
    vAxeType = axeType;
    vDrawIndex = drawIndex;
    // Define the state (for selected data), then calculate a position
    float stateInternal = drawIndex >= 0. ? state : defocusState;
    #genericAttributeInterpolation#

    // Now some checks whether this item is selected or not
    vDiscardThis = 0.;
    vHideThis = 0.;
    if(positionOut.z < zLower || positionOut.z > zUpper || 
        positionOut.x < xLower || positionOut.x > xUpper || 
        positionOut.y < yLower || positionOut.y > yUpper )
    {
        vHideThis = 1.;
    }

    vec3 projPlaneNn = normalize(projPlaneN);
    vec3 planeTest = positionOut.xyz - projPlane;
    bool isAbovePlane = dot(planeTest, projPlaneNn) >= 0.;
    if(isAbovePlane)
    {
        vHideThis = 1.;
    }

    // In case this element is hidden, change the state accordingly and 
    // re-assign all elements that depend on the state
    if(vHideThis > 0.5)
    {
        stateInternal = defocusState;
    #genericAttributeInterpolation#
    }
    

    if(!isAbovePlane && projLevel > 0.001)
    {
        float dist = length(planeTest) * dot(normalize(planeTest), projPlaneNn);
        positionOut.xyz -= projPlaneNn * dist * projLevel;
        
        planeTest = nextPositionOut.xyz - projPlane;
        dist = length(planeTest) * dot(normalize(planeTest), projPlaneNn);
        nextPositionOut.xyz -= projPlaneNn * dist * projLevel;
    }

    // Always determine lon and lat, since we might need it for coloring
    float r = length(positionOut.xyz);
    vec4 v = vec4(positionOut.xyz, 1.) * rotationMatrix(vec3(1,0,0), mercatorOffset)
        * rotationMatrix(vec3(0,1,0), mercatorOffset2)
        * rotationMatrix(vec3(0,0,1), mercatorOffset3);
        
    float rNext = length(nextPositionOut.xyz);
    vec4 vNext = vec4(nextPositionOut.xyz, 1.) * rotationMatrix(vec3(1,0,0), mercatorOffset)
        * rotationMatrix(vec3(0,1,0), mercatorOffset2)
        * rotationMatrix(vec3(0,0,1), mercatorOffset3);
        
    float lat = asin(v.z / r) ;  // z
    float lon = atan(v.x, v.y);  // y x
    float latNext = asin(vNext.z / rNext) ;  // z
    float lonNext = atan(vNext.x, vNext.y);  // y x
    vLongDiff = lonNext - lon; //lon > 0. ? lon - lonNext : lonNext - lon;
    vLatDiff = positionOut.y > 0. ? lat - latNext : latNext - lat;

    if(mercator > 0.002)
    {
        float mercatorHeight;
        #mercatorModes#

        if(abs(lon - lonNext) > 1.)
        {
            vDiscardThis = 1.;
        }

        vec3 posMercator = r / 3.142 * vec3(lon, log(tan(3.142 * 0.25 + lat * 0.5)), mercatorHeight * mercatorRadius - mercatorRadius/2.);
        vec3 nextPosMercator = r / 3.142 * vec3(lonNext, log(tan(3.142 * 0.25 + latNext * 0.5)), mercatorHeight * mercatorRadius - mercatorRadius/2.);
        positionOut = mix(positionOut, posMercator, mercator);
        nextPositionOut = mix(nextPositionOut, nextPosMercator, mercator);
    }
    vOrientation = normalize(nextPositionOut - positionOut);
    
    vec4 modelViewProjection = modelViewMatrix * vec4(positionOut, 1.0 );
    gl_Position = projectionMatrix * modelViewProjection;
    vPosition = gl_Position.xyz;
    vec4 modelViewProjectionNext = modelViewMatrix * vec4(nextPositionOut, 1.0 );
    vNextPosition = (projectionMatrix * modelViewProjectionNext).xyz;
    

    vDepth = clamp((-2.-modelViewProjection.z) / 2., 0., 1.);

    if(shading > 0.01)
    {
        // Assume camera is more distant, but just zoomed in. Leads to better shading,
        // as if coming from a very far light source, like the sun
        #customNormal#
    }

    if(darkenInside > 0.)
    {
        vCenter = (projectionMatrix * modelViewMatrix * vec4(0., 0., 0., 1.)).xyz;
    }
}`;
    }

    /**
     * Vertex shader with adaptions for lines
     */
    vertexShaderLine() {
        let vertexShaderLineVars = "";
        let vertexShaderLineNormal =
            "vView = normalize(vPosition - 1000. * cameraPosition);\n" +
            "vec3 biNormal = normalize(cross(vView, vOrientation));\n" +
            "vNormal = cross( biNormal, vOrientation );\n" +
            "vNormal *= sign( dot( vNormal, vec3( 0.0, 0.0, 1.0 ) ) );\n" +
            "vNormal *= sign( dot( vNormal, vView ) );\n" +
            "vNormal *= -1.;\n";
        return this.vertexShader()
            .replace("#customVars#", vertexShaderLineVars)
            .replace("#customNormal#", vertexShaderLineNormal);
    }

    /**
     * Vertex shader with adaptions for triangles
     */
    vertexShaderTriangle() {
        let vertexShaderTriangleVars = "attribute vec3 normalCustom;";
        let vertexShaderTriangleNormal =
            "vNormal = normalCustom;\n" +
            "vView = normalize(vPosition - 1000. * cameraPosition);\n";

        return this.vertexShader()
            .replace("#customVars#", vertexShaderTriangleVars)
            .replace("#customNormal#", vertexShaderTriangleNormal);
    }

    /**
     * Fragment shader, used for both line and triangle fragments
     */
    fragmentShader() {
        return `
#genericUniforms#
#genericVaryings#
uniform float alpha;
uniform int mode;
varying vec3 vOrientation;
varying float vLongDiff;
varying float vLatDiff;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vCenter;
varying float vSetId;
varying float vAxeType;
varying float vDrawIndex;
varying float vDepth;
varying float vDiscardThis;
varying float vHideThis;
uniform vec3 diffuse;
uniform float opacity;
uniform float scale;
uniform vec3 primaryColor;
uniform vec3 secondaryColor;
uniform vec3 defocusColor;
uniform vec3 backgroundColor;
uniform float shading;
uniform float glossiness;
uniform float darkenInside;
uniform float defocusAlpha;
uniform float colorScale;
uniform sampler2D colorMap;
uniform int colorMapMode;
uniform float axesTransparancy;
uniform vec3 axesColor;


float lightIntensity2(vec3 viewDir, vec3 normalDir)
{
    float ambient = 0.2;
    float diffuse = 1.0;
    float specular = 7.0;
    float shininess = 250.;

    return ambient 
           + diffuse * abs(dot(-viewDir, normalDir)) //max(0., dot(-viewDir, normalDir)) 
           + specular *  pow(abs(dot(-viewDir, normalDir)), shininess);//pow(max(dot(-viewDir, normalDir), 0.0 ), shininess);
}
float lightIntensity(vec3 viewDir, vec3 normalDir)
{
    // diffuse term
    vec3 lightDir = -viewDir;
    float NdotL = dot(normalDir, lightDir);
    float diffuse = NdotL;
    float shininess = 50.;
    vec3 rVector = normalize(2.0 * normalDir * abs(dot(normalDir, lightDir)) - lightDir);
    float RdotV = dot(rVector, -viewDir);

    float specular = 0.;
    if(RdotV > 0.)
        specular = glossiness * pow(RdotV, shininess);
    return 0.2 + diffuse + specular;
}

vec3 pseudoRandomColor(float i) 
{
    return vec3(mod(7.  * i, 206.) + 50., 
                mod(11. * i, 128.) + 50., 
                mod(31. * i, 206.) + 20.) / 256.;
    float h = i * mod(2654435761., pow(2., 32.));
    return vec3(mod(h, 256.), mod(h, 10000.) / 40., mod(h, 65536.) / 256.) / 256.;
}

vec4 getColor(float value, float alpha)
{
    if(colorMapMode == 0) {
        return vec4(mix(primaryColor, secondaryColor, value), alpha);
    }
    else 
    {
        return texture2D(colorMap, vec2(value, 0.5));
    }
}

void main() 
{
    if(vAxeType > 0.5) {
        gl_FragColor = vec4(axesColor, axesTransparancy);
        if(vDiscardThis > 0.001) {
            discard;
        }
        return;
    }

    gl_FragColor = getColor(0., alpha);

    if(mode==1)
    {
        gl_FragColor = vec4(vOrientation.x / 2. + 0.5, vOrientation.y / 2. + 0.5, vOrientation.z / 2. + 0.5, alpha);
    }
    else if(mode == 2)
    {
        gl_FragColor.xyz = normalize(vec3(vLongDiff, 0, vLatDiff));
        gl_FragColor = vec4(gl_FragColor.x / 2. + 0.5, gl_FragColor.y / 2. + 0.5, gl_FragColor.z / 2. + 0.5, alpha);
    }
    else if(mode == 3)
    {
        gl_FragColor.xyz = vec3(clamp((vLatDiff) * colorScale, -1., 1.), 0,0);
        gl_FragColor = vec4(gl_FragColor.x / 2. + 0.5, gl_FragColor.y / 2. + 0.5, gl_FragColor.z / 2. + 0.5, alpha);
    }
    else if(mode == 4)
    {
        gl_FragColor.xyz = vec3(clamp(vLongDiff * colorScale, -1., 1.), 0,0);
        gl_FragColor = vec4(gl_FragColor.x / 2. + 0.5, gl_FragColor.y / 2. + 0.5, gl_FragColor.z / 2. + 0.5, alpha);
    }
    else if(mode == 5)
    {
        gl_FragColor.xyz = getColor(vDepth, 1.).xyz;
    }
    else if(mode == 6)
    {
        gl_FragColor.xyz = pseudoRandomColor(vDrawIndex);
    }
#colorModes#

    float sim = 1.0;
    if(shading > 0.01)
    {
        sim = mix(1.,  lightIntensity(vView, vNormal), shading);
    }

    gl_FragColor = vec4(clamp(sim * gl_FragColor.xyz, 0., 1.), alpha);


    if(darkenInside > 0.)
    {
        if(vCenter.z < vPosition.z)
        {
            //gl_FragColor.xyz = 1. - darkenInside;
            gl_FragColor.xyz = mix(gl_FragColor.xyz, backgroundColor, darkenInside);
        }
    }

    float hideBecauseFilter = 0.;
    #attributeFilter#

    // Painting something in defocus color (because it is hidden)
    if(vDrawIndex < 0. || vHideThis > 0.001 || hideBecauseFilter > 0.001)
    {
        gl_FragColor = vec4(clamp(sim * defocusColor, 0., 1.), defocusAlpha);
    }
    
    if(vDiscardThis > 0.001)
    {
        discard;
    }
}`;
    }
}
