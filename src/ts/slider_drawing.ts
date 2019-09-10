import { SliderCurveBézier } from "./game/slider_curve_bézier";
import { gameState } from "./game/game_state";
import { MathUtil } from "./util/math_util";
import { last } from "./util/misc_util";
import { Color } from "./util/graphics_util";
import { SLIDER_BODY_INSIDE_TO_TOTAL_RATIO, PLAYFIELD_DIMENSIONS } from "./util/constants";
import { renderer } from "./visuals/rendering";

declare let glMatrix: any;

let vertexShaderText = `
precision mediump float;

attribute vec3 vertPosition;

uniform mat3 mOsuToScreen;
uniform mat3 projectionMatrix; // Provided by PIXI

varying float fragDistance;

void main() {
    fragDistance = vertPosition.z;

    vec3 someWack = projectionMatrix * mOsuToScreen * vec3(vertPosition.x, vertPosition.y, 1.0);
    gl_Position = vec4(someWack.x, someWack.y, vertPosition.z, 1.0);
}
`;

let fragmentShaderText = `
precision mediump float;

uniform vec3 borderColor;
uniform vec3 innerColor;
uniform vec3 outerColor;
uniform float insideToTotalRatio;

varying float fragDistance;

void main() {
    vec4 color;

    if (fragDistance > insideToTotalRatio) {
        color = vec4(borderColor, 1.0);
        //color = vec4(1.0, 0.0, 0.0, 1.0);
    } else {
        float alpha = 0.666;

        color = alpha * vec4(mix(innerColor, outerColor, fragDistance / insideToTotalRatio), 1.0); // Nice-ass premultiplied alpha
        //color = vec4(0.0, 1.0, 0.0, 1.0);
    }

    gl_FragColor = color;
    //gl_FragColor = vec4(gl_FragCoord.z * vec3(1.0, 1.0, 1.0), 0.5);
    //gl_FragColor = vec4(1.0, fragDistance, insideToTotalRatio, 1.0);
    //gl_FragColor = vec4(borderColor, 1.0);
}
`;

export async function getWebGLShattyAssFuckingMotherfuckingNiggerTexture(width: number, height: number) {
    //console.time();
    let imageBitmap = await createImageBitmap(canvas, 0, 0, width, height);
    //console.timeEnd();

    return imageBitmap;
}

let canvas = document.createElement('canvas');
// TODO: TEMP:
canvas.setAttribute('width', '2048');
canvas.setAttribute('height', '2048');
let gl = canvas.getContext('webgl2', {
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
    antialias: true, // halp
}) as WebGLRenderingContext;

let vertexShader = gl.createShader(gl.VERTEX_SHADER);
let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

gl.shaderSource(vertexShader, vertexShaderText);
gl.shaderSource(fragmentShader, fragmentShaderText);

gl.compileShader(vertexShader);
if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    throw new Error('vertex shader error: ' + gl.getShaderInfoLog(vertexShader));
}

gl.compileShader(fragmentShader);
if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    throw new Error('fragment shader error: ' + gl.getShaderInfoLog(fragmentShader));
}

let program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);

gl.linkProgram(program);
gl.validateProgram(program);

if (!gl.getProgramParameter( program, gl.LINK_STATUS)) {
    let info = gl.getProgramInfoLog(program);
    throw new Error('Could not compile WebGL program. \n\n' + info);
}

if (!gl.getProgramParameter( program, gl.VALIDATE_STATUS)) {
    let info = gl.getProgramInfoLog(program);
    throw new Error('Could not validate WebGL program. \n\n' + info);
}

gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LESS);
//gl.enable(gl.SAMPLE_COVERAGE);
//gl.sampleCoverage(0.25, false);
//gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, gl.RBGA4, 256, 256);

gl.useProgram(program);

let circleSegments = 40;
let circleSegmentArcLength = Math.PI*2 / circleSegments;

let vertexBufferObject = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferObject);
gl.bufferData(gl.ARRAY_BUFFER, 1000000, gl.DYNAMIC_DRAW);

let positionAttribLocation = gl.getAttribLocation(program, 'vertPosition');
gl.vertexAttribPointer(
    positionAttribLocation,
    3,
    gl.FLOAT,
    false,
    3 * Float32Array.BYTES_PER_ELEMENT,
    0
);
/*
let distanceAttribLocation = gl.getAttribLocation(program, 'vertDistance');
gl.vertexAttribPointer(
    distanceAttribLocation,
    1,
    gl.FLOAT,
    false,
    4 * Float32Array.BYTES_PER_ELEMENT,
    3 * Float32Array.BYTES_PER_ELEMENT
);*/

gl.enableVertexAttribArray(positionAttribLocation);
//gl.enableVertexAttribArray(distanceAttribLocation);








let pixiProgram = new PIXI.Program(vertexShaderText, fragmentShaderText, "yes");

export function getSliderBodyMesh(curve: SliderCurveBézier) {

    /*
    let geometry = new PIXI.Geometry();

    let vertices = [
        200, 200, 0.0,
        400, 300, 0.0,
        200, 400, 0.0,

        250, 250, 1.0,
        450, 350, 1.0,
        250, 450, 1.0,
    ];

    let shit = new Float32Array(vertices);

    geometry.addAttribute(
        'vertPosition',
        new PIXI.Buffer(shit),
        3,
        false,
        PIXI.TYPES.FLOAT,
        3 * 4,
        0
    );

    let vertexSrc = `
    precision mediump float;

    attribute vec3 vertPosition;

    uniform mat3 mTransform;
    uniform mat3 projectionMatrix;

    varying float gayness;

    void main() {
        gayness = vertPosition.z;

        vec3 someWack = projectionMatrix * vec3(vertPosition.x, vertPosition.y, 1.0);
        gl_Position = vec4(someWack.x, someWack.y, 0.0, 1.0);
    }
    `;

    let fragmentSrc = `
    precision mediump float;

    uniform float blue;

    varying float gayness;

    void main() {
        //gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);

        float alpha = 0.25;
        gl_FragColor = alpha * vec4(1.0, gayness, 0.0, 1.0);
    }
    `;

    let mat2 = new Float32Array(9);
    glMatrix.mat3.identity(mat2);
    glMatrix.mat3.translate(mat2, mat2, new Float32Array([0.5, 0.5]));
    glMatrix.mat3.scale(mat2, mat2, new Float32Array([0.5, 0.5]));

    console.log(renderer.globalUniforms)

    let program = new PIXI.Program(vertexSrc, fragmentSrc, "yes");
    console.log(program.uniformData);

    let uniforms = {/*
        mTransform: {
            type: 'm3',
            value: mat2
        },
        blue: {
            type: 'float',
            value: 1
        }
    };

    let shader = new PIXI.Shader(program, uniforms);
    //let shader = PIXI.Shader.from(vertexSrc, fragmentSrc, {});

    shader.uniforms.blue = 1.0;

    let state2 = new PIXI.State();
    state2.depthTest = true;
    //state.blend = true;
    state2.blend = true;
    //state.blendMode = PIXI.BLEND_MODES.MULTIPLY;
    let mesh = new PIXI.Mesh(geometry, shader, state2);


     
    return mesh;

    */

















    /*
    let geometry = new PIXI.Geometry();

    let vertices = [
        -0.5, 0.5, 0.0,
        0.0, -0.5, 1.0,
        0.5, 0.5, 0.0
    ];

    let shit = new Float32Array(vertices);

    geometry.addAttribute(
        'vertPosition',
        new PIXI.Buffer(shit),
        3,
        false,
        PIXI.TYPES.FLOAT,
        3 * 4,
        0
    );

    let vertexSrc = `
    precision mediump float;

    attribute vec3 vertPosition;

    void main() {
        gl_Position = vec4(vertPosition, 1.0);
    }
    `;

    vertexSrc = `
    precision mediump float;

    attribute vec3 vertPosition;
    
    uniform mat3 mOsuToScreen;
    uniform mat3 projectionMatrix; // Provided by PIXI
    
    varying float fragDistance;
    
    void main() {
        fragDistance = vertPosition.z;
    
        vec3 someWack = vec3(vertPosition.x, vertPosition.y, 1.0);
        gl_Position = vec4(someWack.x, someWack.y, vertPosition.z, 1.0);
    }
    `;

    let fragmentSrc = `
    precision mediump float;

    void main() {
        gl_FragColor = vec4(1.0, sin(gl_FragCoord.x / 10.0), 0.0, 1.0);
    }
    `;

    let program = new PIXI.Program(vertexSrc, fragmentSrc);
    let shader = new PIXI.Shader(program, {});
    //let shader = PIXI.Shader.from(vertexSrc, fragmentSrc, {});

    let mesh = new PIXI.Mesh(geometry, shader);

    //return mesh;*/













































    let length = ((curve.equidistantPoints.length - 1) * (12 + circleSegments*3) + circleSegments*2*3 ) * 4; // 12 vertices per line segment, 4 floats per vertex
    let array = new Float32Array(length);
    let thing = gameState.currentPlay.circleRadiusOsuPx * curve.slider.reductionFactor; // TEMP

    let lastArrayIndex = 0;

    function addVertex(x: number, y: number, depth: number) {
        array[lastArrayIndex] = x;
        array[lastArrayIndex+1] = y;
        array[lastArrayIndex+2] = depth;

        lastArrayIndex += 3;
    }

    
    for (let i = 0; i < curve.equidistantPoints.length-1; i++) {
        let p1 = curve.equidistantPoints[i];
        let p2 = curve.equidistantPoints[i+1];

        let dx = p2.x - p1.x,
            dy = p2.y - p1.y;

        let dist = Math.hypot(dx, dy);

        // Normalized orthogonal shit. Rotates the thing 90° clockwise
        let odx = -dy / dist,
            ody = dx / dist;

        let bottomMiddle = p1;
        let topMiddle = p2;

        let bottomLeftX = p1.x - odx * thing,
            bottomLeftY = p1.y - ody * thing;
        let topLeftX = p2.x - odx * thing,
            topLeftY = p2.y - ody * thing;
        let bottomRightX = p1.x + odx * thing,
            bottomRightY = p1.y + ody * thing;
        let topRightX = p2.x + odx * thing,
            topRightY = p2.y + ody * thing;

        addVertex(bottomMiddle.x, bottomMiddle.y, 0.0);
        addVertex(bottomLeftX, bottomLeftY, 1.0);
        addVertex(topLeftX, topLeftY, 1.0);

        addVertex(bottomMiddle.x, bottomMiddle.y, 0.0);
        addVertex(topMiddle.x, topMiddle.y, 0.0);
        addVertex(topLeftX, topLeftY, 1.0);

        addVertex(bottomMiddle.x, bottomMiddle.y, 0.0);
        addVertex(bottomRightX, bottomRightY, 1.0);
        addVertex(topRightX, topRightY, 1.0);

        addVertex(bottomMiddle.x, bottomMiddle.y, 0.0);
        addVertex(topMiddle.x, topMiddle.y, 0.0);
        addVertex(topRightX, topRightY, 1.0);

        let prevPoint = curve.equidistantPoints[i-1];
        outer:
        if (prevPoint) {
            let t1 = Math.atan2(p1.y - prevPoint.y, p1.x - prevPoint.x),
                t2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            let td = MathUtil.getNormalizedAngleDelta(t1, t2);
            let absTd = Math.abs(td);

            //console.log(td);

            if (absTd < 1e-13) break outer; // Unnecessary for really small angles.

            if (absTd <= circleSegmentArcLength) {
                let dx2 = p1.x - prevPoint.x,
                    dy2 = p1.y - prevPoint.y;

                let dist2 = Math.hypot(dx2, dy2);

                // Normalized orthogonal shit. AGAIN.
                let odx2 = -dy2 / dist2,
                    ody2 =  dx2 / dist2;

                let v2x: number,
                    v2y: number,
                    v3x: number,
                    v3y: number;

                if (td > 0) {
                    v2x = p1.x - odx2 * thing;
                    v2y = p1.y - ody2 * thing;
                    v3x = bottomLeftX;
                    v3y = bottomLeftY;
                } else {
                    v2x = p1.x + odx2 * thing;
                    v2y = p1.y + ody2 * thing;
                    v3x = bottomRightX;
                    v3y = bottomRightY;
                }

                addVertex(p1.x, p1.y, 0.0);
                addVertex(v2x, v2y, 1.0);
                addVertex(v3x, v3y, 1.0);
            } else {
                let startingAngle = (td > 0)? t1 - Math.PI/2 : t1 + Math.PI/2;
                addLineCap(p1.x, p1.y, startingAngle, td);
            }
        }
    }

    addLineCap(curve.equidistantPoints[0].x, curve.equidistantPoints[0].y, 0, Math.PI*2); // draw start
    addLineCap(last(curve.equidistantPoints).x, last(curve.equidistantPoints).y, 0, Math.PI*2); // draw tail

    //console.timeEnd("Generate vertices");

    function addLineCap(x: number, y: number, startingAngle: number, angleDifference: number) {
        //angleDifference = Math.PI*2;

        let segments = Math.ceil(Math.abs(angleDifference) / circleSegmentArcLength) || 1;
        let radiansPerSegment = angleDifference / segments;

        //let p2 = [x + Math.cos(startingAngle) * thing, y + Math.sin(startingAngle) * thing];
        let p2x = x + Math.cos(startingAngle) * thing,
            p2y = y + Math.sin(startingAngle) * thing;
        for (let i = 0; i < segments; i++) {
            let p3Angle = startingAngle + radiansPerSegment * (i+1);
            //let p3 = [, ];
            let p3x = x + Math.cos(p3Angle) * thing,
                p3y = y + Math.sin(p3Angle) * thing

            addVertex(x, y, 0.0);
            addVertex(p2x, p2y, 1.0);
            addVertex(p3x, p3y, 1.0);

            p2x = p3x;
            p2y = p3y;
        }
    }

    
    /*
    array = new Float32Array([
        0, 0, 0.0,
        200, 0, 1.0,
        0, 200, 0.0,
    ]);*/

    let { pixelRatio, circleDiameter } = gameState.currentPlay;

    let mat = new Float32Array(9);

    // Transform from osu!pixels to slider-body-canvas-relative coordinates
    /*
    glMatrix.mat3.identity(mat);
    glMatrix.mat3.translate(mat, mat, new Float32Array([-curve.slider.minX, -curve.slider.minY]));
    glMatrix.mat3.scale(mat, mat, new Float32Array([pixelRatio, pixelRatio]));
    glMatrix.mat3.translate(mat, mat, new Float32Array([circleDiameter/2, circleDiameter/2]));*/

    let { width, height } = curve.slider.baseCanvas;

    // Transform from slider body canvas coordiates to normalized device coordinates [-1.0, 1.0]
    /*
    glMatrix.mat3.scale(mat, mat, new Float32Array([2 / width, 2 / height]));
    glMatrix.mat3.translate(mat, mat, new Float32Array([-1.0, -1.0]));*/

    glMatrix.mat3.identity(mat);

    glMatrix.mat3.scale(mat, mat, new Float32Array([1.0, -1.0])); // pff wtf flipped
    //glMatrix.mat3.translate(mat, mat, new Float32Array([-1.0, -1.0]));
    glMatrix.mat3.scale(mat, mat, new Float32Array([2 / width, 2 / height]));
    glMatrix.mat3.translate(mat, mat, new Float32Array([circleDiameter/2, circleDiameter/2]));
    glMatrix.mat3.scale(mat, mat, new Float32Array([pixelRatio, pixelRatio]));
    glMatrix.mat3.translate(mat, mat, new Float32Array([-curve.slider.minX, -curve.slider.minY]));


    let actualMat = new Float32Array(9);

    //let coord = window.innerWidth*0.5 + (osuCoordinateX - PLAYFIELD_DIMENSIONS.width/2) * this.pixelRatio;

    glMatrix.mat3.identity(actualMat);

    glMatrix.mat3.translate(actualMat, actualMat, new Float32Array([window.innerWidth*0.5, window.innerHeight*0.51]));
    glMatrix.mat3.scale(actualMat, actualMat, new Float32Array([pixelRatio, pixelRatio]));
    glMatrix.mat3.translate(actualMat, actualMat, new Float32Array([-PLAYFIELD_DIMENSIONS.width/2, -PLAYFIELD_DIMENSIONS.height/2]));

    //glMatrix.mat3.identity(actualMat);

    //glMatrix.mat3.identity(mat);
    
    //glMatrix.mat3.translate(mat, mat, new Float32Array([0.5, 0.5]))
    //glMatrix.mat3.scale(mat, mat, new Float32Array([0.25, 0.25]));
    
    

    //canvas.setAttribute('width', width.toString());
    //canvas.setAttribute('height', height.toString());

    //gl.viewport(0, 0, width, height);

    //document.body.appendChild(canvas);

    //console.log(mat, array);

    //gl.clearColor(0.0, 0.0, 0.0, 0.0);
    //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    


    /*
    let mMainUniformLocation = gl.getUniformLocation(program, 'mMain');
    let borderColorUniformLocation = gl.getUniformLocation(program, 'borderColor');
    let innerColorUniformLocation = gl.getUniformLocation(program, 'innerColor');
    let outerColorUniformLocation = gl.getUniformLocation(program, 'outerColor');
    let insideToTotalRatioUniformLocation = gl.getUniformLocation(program, 'insideToTotalRatio');*/

    //

    let borderColor = gameState.currentGameplaySkin.config.colors.sliderBorder;

    let sliderBodyColor: Color;
    if (gameState.currentGameplaySkin.config.colors.sliderTrackOverride) {
        sliderBodyColor = gameState.currentGameplaySkin.config.colors.sliderTrackOverride;
    } else {
        sliderBodyColor = curve.slider.comboInfo.color;
    }

    let targetRed = Math.min(255, sliderBodyColor.r * 1.125 + 75),
        targetGreen = Math.min(255, sliderBodyColor.g * 1.125 + 75),
        targetBlue = Math.min(255, sliderBodyColor.b * 1.125 + 75);

    //

    let pixiUniforms = {
        mOsuToScreen: {
            type: 'm3',
            value: actualMat
        },
        borderColor: {
            type: '3f',
            value: [borderColor.r/255, borderColor.g/255, borderColor.b/255]
        },
        innerColor: {
            type: '3f',
            value: [targetRed/255, targetGreen/255, targetBlue/255]
        },
        outerColor: {
            type: '3f',
            value: [sliderBodyColor.r/255, sliderBodyColor.g/255, sliderBodyColor.b/255]
        },
        insideToTotalRatio: {
            type: 'f',
            value: SLIDER_BODY_INSIDE_TO_TOTAL_RATIO
        }
    };

    let pixiShader = new PIXI.Shader(pixiProgram, pixiUniforms);
    //console.log(pixiShader);

    pixiShader.uniforms.insideToTotalRatio = SLIDER_BODY_INSIDE_TO_TOTAL_RATIO;
    pixiShader.uniforms.borderColor = [borderColor.r/255, borderColor.g/255, borderColor.b/255];
    pixiShader.uniforms.innerColor = [targetRed/255, targetGreen/255, targetBlue/255];
    pixiShader.uniforms.outerColor = [sliderBodyColor.r/255, sliderBodyColor.g/255, sliderBodyColor.b/255];
    

    /*
    gl.uniformMatrix3fv(mMainUniformLocation, false, mat);
    gl.uniform3f(borderColorUniformLocation, borderColor.r/255, borderColor.g/255, borderColor.b/255);
    gl.uniform3f(innerColorUniformLocation, targetRed/255, targetGreen/255, targetBlue/255);
    gl.uniform3f(outerColorUniformLocation, sliderBodyColor.r/255, sliderBodyColor.g/255, sliderBodyColor.b/255);
    gl.uniform1f(insideToTotalRatioUniformLocation, SLIDER_BODY_INSIDE_TO_TOTAL_RATIO);*/
    
    // The duration of this operation is apparently negligible, takes less than 50 μs
    let sliced = array.slice(0, lastArrayIndex);
    //console.log(sliced);
    // We slice here because we don't wanna upload useless vertices to the GPU.

    let pixiGeometry = new PIXI.Geometry();
    pixiGeometry.addAttribute(
        'vertPosition',
        new PIXI.Buffer(sliced),
        /*[
            0.5, 0.5, 0.0,
            -0.5, 0.0, 1.0,
            0.5, -0.5, 0.0
        ] as any as PIXI.Buffer,*/
        3,
        false,
        PIXI.TYPES.FLOAT,
        3 * Float32Array.BYTES_PER_ELEMENT,
        0
    );

    let state = new PIXI.State();
    state.depthTest = true;
    state.blend = false; // Why doesn't this work?
    //state.culling = true;
    
    let pixiMesh = new PIXI.Mesh(pixiGeometry, pixiShader, state);
    //console.log(renderer.state);

    //renderer.state.gl.enable(renderer.state.gl.DEPTH_TEST);
    //renderer.state.gl.depthFunc(renderer.state.gl.LESS);

    return pixiMesh;

    //console.time("Buffer upload");
    //gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferObject);
    //gl.bufferSubData(gl.ARRAY_BUFFER, 0, sliced);
    //console.timeEnd("Buffer upload");

    
    //gl.drawArrays(gl.TRIANGLES, 0, lastArrayIndex / 3);

    //gl.finish();
    //console.timeEnd("draw")
}

export function drawBézier(curve: SliderCurveBézier, endIndex: number) {
    //console.time("draw")

    //console.time("Generate vertices")

    let length = ((curve.equidistantPoints.length - 1) * (12 + circleSegments*3) + circleSegments*2*3 ) * 4; // 12 vertices per line segment, 4 floats per vertex
    let array = new Float32Array(length);
    let thing = gameState.currentPlay.circleRadiusOsuPx * curve.slider.reductionFactor; // TEMP

    let lastArrayIndex = 0;

    function addVertex(x: number, y: number, depth: number) {
        array[lastArrayIndex] = x;
        array[lastArrayIndex+1] = y;
        array[lastArrayIndex+2] = depth;

        lastArrayIndex += 3;
    }

    
    for (let i = 0; i < endIndex-1; i++) {
        let p1 = curve.equidistantPoints[i];
        let p2 = curve.equidistantPoints[i+1];

        let dx = p2.x - p1.x,
            dy = p2.y - p1.y;

        let dist = Math.hypot(dx, dy);

        // Normalized orthogonal shit. Rotates the thing 90° clockwise
        let odx = -dy / dist,
            ody = dx / dist;

        let bottomMiddle = p1;
        let topMiddle = p2;

        let bottomLeftX = p1.x - odx * thing,
            bottomLeftY = p1.y - ody * thing;
        let topLeftX = p2.x - odx * thing,
            topLeftY = p2.y - ody * thing;
        let bottomRightX = p1.x + odx * thing,
            bottomRightY = p1.y + ody * thing;
        let topRightX = p2.x + odx * thing,
            topRightY = p2.y + ody * thing;

        addVertex(bottomMiddle.x, bottomMiddle.y, 0.0);
        addVertex(bottomLeftX, bottomLeftY, 1.0);
        addVertex(topLeftX, topLeftY, 1.0);

        addVertex(bottomMiddle.x, bottomMiddle.y, 0.0);
        addVertex(topMiddle.x, topMiddle.y, 0.0);
        addVertex(topLeftX, topLeftY, 1.0);

        addVertex(bottomMiddle.x, bottomMiddle.y, 0.0);
        addVertex(bottomRightX, bottomRightY, 1.0);
        addVertex(topRightX, topRightY, 1.0);

        addVertex(bottomMiddle.x, bottomMiddle.y, 0.0);
        addVertex(topMiddle.x, topMiddle.y, 0.0);
        addVertex(topRightX, topRightY, 1.0);

        let prevPoint = curve.equidistantPoints[i-1];
        outer:
        if (prevPoint) {
            let t1 = Math.atan2(p1.y - prevPoint.y, p1.x - prevPoint.x),
                t2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            let td = MathUtil.getNormalizedAngleDelta(t1, t2);
            let absTd = Math.abs(td);

            //console.log(td);

            if (absTd < 1e-13) break outer; // Unnecessary for really small angles.

            if (absTd <= circleSegmentArcLength) {
                let dx2 = p1.x - prevPoint.x,
                    dy2 = p1.y - prevPoint.y;

                let dist2 = Math.hypot(dx2, dy2);

                // Normalized orthogonal shit. AGAIN.
                let odx2 = -dy2 / dist2,
                    ody2 =  dx2 / dist2;

                let v2x: number,
                    v2y: number,
                    v3x: number,
                    v3y: number;

                if (td > 0) {
                    v2x = p1.x - odx2 * thing;
                    v2y = p1.y - ody2 * thing;
                    v3x = bottomLeftX;
                    v3y = bottomLeftY;
                } else {
                    v2x = p1.x + odx2 * thing;
                    v2y = p1.y + ody2 * thing;
                    v3x = bottomRightX;
                    v3y = bottomRightY;
                }

                addVertex(p1.x, p1.y, 0.0);
                addVertex(v2x, v2y, 1.0);
                addVertex(v3x, v3y, 1.0);
            } else {
                let startingAngle = (td > 0)? t1 - Math.PI/2 : t1 + Math.PI/2;
                addLineCap(p1.x, p1.y, startingAngle, td);
            }
        }
    }

    addLineCap(curve.equidistantPoints[0].x, curve.equidistantPoints[0].y, 0, Math.PI*2); // draw start
    addLineCap(curve.equidistantPoints[endIndex].x, curve.equidistantPoints[endIndex].y, 0, Math.PI*2); // draw tail

    //console.timeEnd("Generate vertices");

    function addLineCap(x: number, y: number, startingAngle: number, angleDifference: number) {
        //angleDifference = Math.PI*2;

        let segments = Math.ceil(Math.abs(angleDifference) / circleSegmentArcLength) || 1;
        let radiansPerSegment = angleDifference / segments;

        //let p2 = [x + Math.cos(startingAngle) * thing, y + Math.sin(startingAngle) * thing];
        let p2x = x + Math.cos(startingAngle) * thing,
            p2y = y + Math.sin(startingAngle) * thing;
        for (let i = 0; i < segments; i++) {
            let p3Angle = startingAngle + radiansPerSegment * (i+1);
            //let p3 = [, ];
            let p3x = x + Math.cos(p3Angle) * thing,
                p3y = y + Math.sin(p3Angle) * thing

            addVertex(x, y, 0.0);
            addVertex(p2x, p2y, 1.0);
            addVertex(p3x, p3y, 1.0);

            p2x = p3x;
            p2y = p3y;
        }
    }

    /*
    array = new Float32Array([
        -1.0, -0.5, 0.0, 1.0,
        0.0, 0.5, 0.0, 1.0,
        1.0, -0.5, 0.0, 1.0,
    ]);*/

    let { pixelRatio, circleDiameter } = gameState.currentPlay;

    let mat = new Float32Array(9);

    // Transform from osu!pixels to slider-body-canvas-relative coordinates
    /*
    glMatrix.mat3.identity(mat);
    glMatrix.mat3.translate(mat, mat, new Float32Array([-curve.slider.minX, -curve.slider.minY]));
    glMatrix.mat3.scale(mat, mat, new Float32Array([pixelRatio, pixelRatio]));
    glMatrix.mat3.translate(mat, mat, new Float32Array([circleDiameter/2, circleDiameter/2]));*/

    let { width, height } = curve.slider.baseCanvas;

    // Transform from slider body canvas coordiates to normalized device coordinates [-1.0, 1.0]
    /*
    glMatrix.mat3.scale(mat, mat, new Float32Array([2 / width, 2 / height]));
    glMatrix.mat3.translate(mat, mat, new Float32Array([-1.0, -1.0]));*/

    glMatrix.mat3.identity(mat);

    glMatrix.mat3.scale(mat, mat, new Float32Array([1.0, -1.0])); // pff wtf flipped
    glMatrix.mat3.translate(mat, mat, new Float32Array([-1.0, -1.0]));
    glMatrix.mat3.scale(mat, mat, new Float32Array([2 / canvas.width, 2 / canvas.height]));
    glMatrix.mat3.translate(mat, mat, new Float32Array([circleDiameter/2, circleDiameter/2]));
    glMatrix.mat3.scale(mat, mat, new Float32Array([pixelRatio, pixelRatio]));
    glMatrix.mat3.translate(mat, mat, new Float32Array([-curve.slider.minX, -curve.slider.minY]));

    //glMatrix.mat3.identity(mat);
    
    //glMatrix.mat3.translate(mat, mat, new Float32Array([0.5, 0.5]))
    //glMatrix.mat3.scale(mat, mat, new Float32Array([0.25, 0.25]));
    
    

    //canvas.setAttribute('width', width.toString());
    //canvas.setAttribute('height', height.toString());

    //gl.viewport(0, 0, width, height);

    //document.body.appendChild(canvas);

    //console.log(mat, array);

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let mMainUniformLocation = gl.getUniformLocation(program, 'mMain');
    let borderColorUniformLocation = gl.getUniformLocation(program, 'borderColor');
    let innerColorUniformLocation = gl.getUniformLocation(program, 'innerColor');
    let outerColorUniformLocation = gl.getUniformLocation(program, 'outerColor');
    let insideToTotalRatioUniformLocation = gl.getUniformLocation(program, 'insideToTotalRatio');

    //

    let borderColor = gameState.currentGameplaySkin.config.colors.sliderBorder;

    let sliderBodyColor: Color;
    if (gameState.currentGameplaySkin.config.colors.sliderTrackOverride) {
        sliderBodyColor = gameState.currentGameplaySkin.config.colors.sliderTrackOverride;
    } else {
        sliderBodyColor = curve.slider.comboInfo.color;
    }

    let targetRed = Math.min(255, sliderBodyColor.r * 1.125 + 75),
        targetGreen = Math.min(255, sliderBodyColor.g * 1.125 + 75),
        targetBlue = Math.min(255, sliderBodyColor.b * 1.125 + 75);

    //

    gl.uniformMatrix3fv(mMainUniformLocation, false, mat);
    gl.uniform3f(borderColorUniformLocation, borderColor.r/255, borderColor.g/255, borderColor.b/255);
    gl.uniform3f(innerColorUniformLocation, targetRed/255, targetGreen/255, targetBlue/255);
    gl.uniform3f(outerColorUniformLocation, sliderBodyColor.r/255, sliderBodyColor.g/255, sliderBodyColor.b/255);
    gl.uniform1f(insideToTotalRatioUniformLocation, SLIDER_BODY_INSIDE_TO_TOTAL_RATIO);
    
    // The duration of this operation is apparently negligible, takes less than 50 μs
    let sliced = array.slice(0, lastArrayIndex);
    // We slice here because we don't wanna upload useless vertices to the GPU.

    //console.time("Buffer upload");
    //gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferObject);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sliced);
    //console.timeEnd("Buffer upload");

    
    gl.drawArrays(gl.TRIANGLES, 0, lastArrayIndex / 3);

    gl.finish();
    //console.timeEnd("draw")
}


/*

    async function init() {
        let canvas = document.querySelector('canvas');
        let gl = canvas.getContext('webgl', {
            preserveDrawingBuffer: true
        });

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        let vertexShader = gl.createShader(gl.VERTEX_SHADER);
        let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

        gl.shaderSource(vertexShader, await getResourceAsText('./vertex.glsl'));
        gl.shaderSource(fragmentShader, await getResourceAsText('./fragment.glsl'));

        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error('vertex shader error: ', gl.getShaderInfoLog(vertexShader));
            return;
        }

        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('fragment shader error: ', gl.getShaderInfoLog(fragmentShader));
            return;
        }

        let program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);

        gl.linkProgram(program);
        gl.validateProgram(program);

        if (!gl.getProgramParameter( program, gl.LINK_STATUS)) {
            let info = gl.getProgramInfoLog(program);
            throw new Error('Could not compile WebGL program. \n\n' + info);
        }

        if (!gl.getProgramParameter( program, gl.VALIDATE_STATUS)) {
            let info = gl.getProgramInfoLog(program);
            throw new Error('Could not validate WebGL program. \n\n' + info);
        }

        let points = [
            [-0.7, 0.7],
            [0.0, 0.7],
            [0.0, -0.7],
            [1.0, 0],
            [-0.5, 0]
        ];

        let segments = 32;

        let vertices = [];
        let thing = 0.2;
        console.time()
        for (let i = 0; i < points.length-1; i++) {
            let p1 = points[i],
                p2 = points[i+1];

            let dx = p2[0] - p1[0],
                dy = p2[1] - p1[1];

            // Normalized orthogonal shit
            let odx = dy / Math.hypot(dx, dy),
                ody = -dx / Math.hypot(dx, dy);

            let bottomLeft = [p1[0] - odx * thing, p1[1] - ody * thing];
            let topLeft = [p2[0] - odx * thing, p2[1] - ody * thing];
            let bottomRight = [p1[0] + odx * thing, p1[1] + ody * thing];
            let topRight = [p2[0] + odx * thing, p2[1] + ody * thing];
            let bottomMiddle = p1;
            let topMiddle = p2;

            vertices.push(bottomMiddle[0], bottomMiddle[1], 0.0, 1.0);
            vertices.push(bottomLeft[0], bottomLeft[1], 1.0, 0.0);
            vertices.push(topLeft[0], topLeft[1], 1.0, 0.0);

            vertices.push(bottomMiddle[0], bottomMiddle[1], 0.0, 1.0);
            vertices.push(topMiddle[0], topMiddle[1], 0.0, 1.0);
            vertices.push(topLeft[0], topLeft[1], 1.0, 0.0);

            vertices.push(bottomMiddle[0], bottomMiddle[1], 0.0, 1.0);
            vertices.push(bottomRight[0], bottomRight[1], 1.0, 0.0);
            vertices.push(topRight[0], topRight[1], 1.0, 0.0);

            vertices.push(bottomMiddle[0], bottomMiddle[1], 0.0, 1.0);
            vertices.push(topMiddle[0], topMiddle[1], 0.0, 1.0);
            vertices.push(topRight[0], topRight[1], 1.0, 0.0);

            addCircleSomewhere(p2[0], p2[1]);
        }

        addCircleSomewhere(points[0][0], points[0][1]);
        
        function addCircleSomewhere(x, y) {
            let angle = Math.PI*2 / 32;

            for (let i = 0; i < segments; i++) {
                let startingAngle = i*angle;
                let endingAngle = startingAngle + angle;

                let p2 = [x + Math.cos(startingAngle) * thing, y + Math.sin(startingAngle) * thing],
                    p3 = [x + Math.cos(endingAngle) * thing, y + Math.sin(endingAngle) * thing];

                vertices.push(x, y, 0.0, 1.0);
                vertices.push(p2[0], p2[1], 1.0, 0.0);
                vertices.push(p3[0], p3[1], 1.0, 0.0);
            }
        }

        console.timeEnd()

        //console.log(vertices.length)

        


        let vertices = [
            -1.0, -1.0,      1.0,
            1.0, -1.0,    1.0,
            -1.0, 1.0,     0.0,
            1.0, 1.0,     0.0,

            //0.0, 0.5,      0.0,
            //-0.5, 0.5,     0.0,
            //0.0, -0.5,    1.0,
        ];

        
        let floatArray = new Float32Array(vertices);

        console.time()
        let vertexBufferObject = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBufferObject);
        gl.bufferData(gl.ARRAY_BUFFER, floatArray, gl.STREAM_DRAW);
        console.timeEnd()

        

        gl.useProgram(program);

        //await wait(2000);

        gl.viewport(0, 0, 1000, 1000);

        console.time()
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length/4);
        gl.finish();
        console.timeEnd()
       

        //for (let i = 0; i < 1e8; i++) Math.random();
    }
    init();

    function wait(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
</script>

*/