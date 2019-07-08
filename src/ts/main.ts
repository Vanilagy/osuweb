console.log("ORERU!");

import { Beatmap } from "./datamodel/beatmap";
import { Circle } from "./datamodel/circle";
import { Slider } from "./datamodel/slider";
import { DrawableSlider } from "./game/drawable_slider";
import { MathUtil, Point } from "./util/math_util";
import { HitObject } from "./datamodel/hit_object";

const beatmapFileSelect = document.querySelector('#beatmapSelect') as HTMLInputElement;
const playButton = document.querySelector('#playButton') as HTMLElement;
const mainCanvas = document.querySelector('#mainCanvas') as HTMLCanvasElement;
const cursorElement = document.querySelector('#cursor');

let beatmap: Beatmap | null = null;
let processedBeatmap = null;
let audioCtx = new AudioContext();
let files: File[] | null = null;
let audioStartTime;

export const playfieldDimensions = {
    width: 512,
    height: 384
};
const screenDimensions = {
    width: 640,
    height: 480
};

let beatmapFileName = 'nonet - Now On Stage!! (Fycho) [Extra].osu';
// 'nonet - Now On Stage!! (Fycho) [Extra].osu'
// 'xi - Akasha (Jemmmmy) [Extreme].osu'
// "Knife Party - Centipede (Sugoi-_-Desu) [This isn't a map, just a simple visualisation].osu"
// "Halozy - Kikoku Doukoku Jigokuraku (Hollow Wings) [Notch Hell].osu"
// IAHN - Transform (Original Mix) (Monstrata) [Aspire].osu

beatmapFileSelect.addEventListener('change', (e) => {
    let fileArr = [...beatmapFileSelect.files!];
    files = fileArr;

    let beatmapNames: any[] = [];
    for (let file of fileArr) {
        if (file.name.endsWith('.osu')) {
            beatmapNames.push(file.name);
        }

        /*
        if (file.name === beatmapFileName) {
            new Beatmap(file, (map) => {
                console.log("Beatmap parsed.", map);
                beatmap = map;
            });
        }*/
    }

    let promptStr = 'Select a beatmap by entering the number:\n';
    beatmapNames.forEach((value, index) => {
        promptStr += index + ': ' + value + '\n';
    });
    let id = Number(prompt(promptStr));

    new Beatmap(fileArr.find((file) => file.name === beatmapNames[id])!, (map) => {
        console.log("Beatmap parsed.", map);
        beatmap = map;
        startPlay();
    });
});

export let gameState = {
    currentPlay: <Play | null> null
};

class Play {
    public processedBeatmap: ProcessedBeatmap;
    public audioStartTime: number | null;
    public currentHitObjectId: number;
    public onscreenObjects: { [s: string]: any };
    public pixelRatio: number | null;
    public circleDiameter: number | null;
    public ARMs: number;
    public audioOffset: number = 0;

    constructor(beatmap: Beatmap) {
        this.processedBeatmap = new ProcessedBeatmap(beatmap);

        this.audioStartTime = null;
        this.currentHitObjectId = 0;
        this.onscreenObjects = {};

        this.pixelRatio = null;
        this.circleDiameter = null;
        this.ARMs = this.processedBeatmap.beatmap.difficulty.getApproachTime();
    }
    
    init() {
        let screenHeight = window.innerHeight * 0.95;
        let screenWidth = screenHeight * (640 / 480);
        this.pixelRatio = screenHeight / 480;

        let osuCircleDiameter = this.processedBeatmap.beatmap.difficulty.getCirclePixelSize();
        this.circleDiameter = Math.round(osuCircleDiameter * this.pixelRatio);

        console.time("Beatmap init");
        this.processedBeatmap.init();
        console.timeEnd("Beatmap init");
        console.time("Beatmap draw");
        this.processedBeatmap.draw();
        console.timeEnd("Beatmap draw");
    }

    async start() {
        let audioBuffer = await this.getSongAudioBuffer();

        let gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.05, 0);
        gainNode.connect(audioCtx.destination);
        
        let sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.playbackRate.value = playbackRate;
        sourceNode.connect(gainNode);

        this.audioStartTime = audioCtx.currentTime;
        this.audioOffset = audioOffset;
        sourceNode.start(0, audioOffset / 1000);

        this.render();
    }

    getSongAudioBuffer() {
        let songFile = files!.find((file) => file.name === this.processedBeatmap.beatmap.audioFilename);

        return new Promise<AudioBuffer>((resolve) => {
            let reader = new FileReader();
            reader.onload = (result) => {
                let arrayBuffer = reader.result as ArrayBuffer;

                audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
                    resolve(buffer);
                });
            };
            reader.readAsArrayBuffer(songFile!);
        });
    }

    render() {
        //console.time("Render");

        let currentTime = this.getCurrentSongTime();

        for (let id in this.onscreenObjects) {
            let hitObject = this.onscreenObjects[id];
    
            hitObject.update(currentTime);

            if (hitObject.constructor === DrawableCircle) {
                if (currentTime >= hitObject.hitObject.time) {
                    hitObject.remove(); 
                    delete this.onscreenObjects[id];
                }
            } else if (hitObject.constructor === DrawableSlider) {
                if (currentTime >= hitObject.endTime) {
                    hitObject.remove();
                    delete this.onscreenObjects[id];
                }
            }
    
            
        }
    
        let hitObject = this.processedBeatmap.hitObjects[this.currentHitObjectId];
        while (hitObject && currentTime >= hitObject.hitObject.time - this.ARMs) {
            this.onscreenObjects[this.currentHitObjectId] = hitObject;
            hitObject.show(currentTime);
    
            hitObject = this.processedBeatmap.hitObjects[++this.currentHitObjectId];
        }
    
        renderer.render(stage);

        requestAnimationFrame(this.render.bind(this));

       // console.timeEnd("Render");
    }

    getCurrentSongTime() {
        return (audioCtx.currentTime - this.audioStartTime!) * 1000 * playbackRate + this.audioOffset;
    }
}

let currentPlay: Play | null = null;

let screenHeight,
    screenWidth,
    pixelRatio,
    circleDiameter: number;

let playbackRate = 1;

const audioOffset = 0;

playButton.addEventListener('click', startPlay);

function startPlay() {
    audioCtx.resume();
    beatmapFileSelect.style.display = playButton.style.display = 'none';

    gameState.currentPlay = currentPlay = new Play(beatmap!);
    currentPlay.init();
    currentPlay.start();
}

export class ProcessedBeatmap {
    public beatmap: Beatmap;
    public hitObjects: any[];

    constructor(beatmap: Beatmap) {
        this.beatmap = beatmap;

        this.hitObjects = [];
    }

    init() {
        this.generateHitObjects();
    }

    generateHitObjects() {
        let hitObjectId = 0;
        let comboCount = 1;
        let nextCombo = 0;

        let currentTimingPoint = 1;
        let currentMsPerBeat = this.beatmap.timingPoints[0].msPerBeat;
        let currentMsPerBeatMultiplier = 100;
        let currentSampleSet = this.beatmap.timingPoints[0].sampleSet;
        let currentVolume = this.beatmap.timingPoints[0].volume;

        for (let i = 0; i < this.beatmap.hitObjects.length; i++) {
            let rawHitObject = this.beatmap.hitObjects[i];

            let comboInfo = null;

            if (rawHitObject.newCombo !== null) {
                if (rawHitObject.newCombo === -1) {
                    nextCombo++;
                }
                else {
                    nextCombo += rawHitObject.newCombo + 1;
                }
                comboCount = 1;
            }
            comboInfo = {
                comboNum: nextCombo,
                n: comboCount++,
                isLast: (this.beatmap.hitObjects[i + 1]) ? this.beatmap.hitObjects[i + 1].newCombo !== null : true
            };

            if (currentTimingPoint < this.beatmap.timingPoints.length) {
                while (this.beatmap.timingPoints[currentTimingPoint].offset <= rawHitObject.time) {
                    let timingPoint = this.beatmap.timingPoints[currentTimingPoint];

                    if (timingPoint.inherited) {
                        // TODO: is there a a lower limit?
                        currentMsPerBeatMultiplier = Math.min(1000, -timingPoint.msPerBeat);
                    } else {
                        currentMsPerBeatMultiplier = 100;
                        currentMsPerBeat = timingPoint.msPerBeat;
                    }

                    currentSampleSet = timingPoint.sampleSet;
                    currentVolume = timingPoint.volume;

                    currentTimingPoint++;

                    if (currentTimingPoint === this.beatmap.timingPoints.length) {
                        break;
                    }
                }
            }

            let newObject = null;

            if (rawHitObject.constructor === Circle) {
                newObject = new DrawableCircle(rawHitObject);
            } else if (rawHitObject.constructor === Slider) {
                newObject = new DrawableSlider(rawHitObject);

                let timingInfo = {
                    msPerBeat: currentMsPerBeat,
                    msPerBeatMultiplier: currentMsPerBeatMultiplier,
                    sliderVelocity: 100 * this.beatmap.difficulty.SV * (100 / currentMsPerBeatMultiplier) / (currentMsPerBeat)
                };

                newObject.endTime = rawHitObject.time + rawHitObject.repeat * rawHitObject.length / timingInfo.sliderVelocity;
                newObject.timingInfo = timingInfo;
            }

            if (newObject !== null) {
                newObject.id = hitObjectId;
                newObject.comboInfo = comboInfo;
                //if (fullCalc) {
                //    newObject.comboInfo = comboInfo;
                //    newObject.hitSoundInfo = hitSoundInfo;
                //}
                this.hitObjects.push(newObject);
            }
    
            hitObjectId++;
        }
    }

    draw() {
        for (let i = 0; i < this.hitObjects.length; i++) {
            this.hitObjects[i].draw();
        }
    }
}

let context = mainCanvas.getContext('webgl2', {
    stencil: true,
    alpha: true,
    powerPreference: 'high-performance',
    desynchronized: true
});

let renderer = new PIXI.Renderer({
    width: window.innerWidth,
    height: window.innerHeight,
    context: context
});
let stage = new PIXI.Container();

export let mainHitObjectContainer = new PIXI.Container();
export let approachCircleContainer = new PIXI.Container();

stage.addChild(mainHitObjectContainer);
stage.addChild(approachCircleContainer);

let texture = PIXI.Texture.from("./assets/img/circle.png");
export let approachCircleTexture = PIXI.Texture.from("./assets/img/approach_circle.png");

function onResize() {
    let width = window.innerWidth,
        height = window.innerHeight;

    mainCanvas.setAttribute('width', String(width));
    mainCanvas.setAttribute('height', String(height));

    renderer.resize(width, height);
}
onResize();

window.addEventListener('resize', onResize);

class DrawableCircle {
    public id: number = 0;
    public comboInfo: object = {};
    public hitObject: HitObject;
    public container: any;
    public sprite: any;
    public approachCircle: any;

    constructor(hitObject: HitObject) {
        this.hitObject = hitObject;

        this.container = new PIXI.Container();
        this.sprite = null;
        this.approachCircle = null;
    }

    draw() {
        let canvas = document.createElement('canvas');
        canvas.setAttribute('width', String(currentPlay!.circleDiameter));
        canvas.setAttribute('height', String(currentPlay!.circleDiameter));
        let ctx = canvas.getContext('2d');
        drawCircle(ctx!, 0, 0, this.comboInfo);

        this.sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
        this.sprite.width = currentPlay!.circleDiameter;
        this.sprite.height = currentPlay!.circleDiameter;

        this.approachCircle = new PIXI.Sprite(approachCircleTexture);
        this.approachCircle.width = currentPlay!.circleDiameter;
        this.approachCircle.height = currentPlay!.circleDiameter;
    }

    show(currentTime: number) {
        this.container.addChild(this.sprite);
        mainHitObjectContainer.addChildAt(this.container, 0);
        approachCircleContainer.addChild(this.approachCircle);

        this.update(currentTime);
    }

    update(currentTime: number) {
        let yes = (currentTime - (this.hitObject.time - gameState.currentPlay!.ARMs)) / gameState.currentPlay!.ARMs;
        yes = MathUtil.clamp(yes, 0, 1);
        yes = MathUtil.ease('easeOutQuad', yes);

        //let fadeInCompletion = MathUtil.clamp(1 - ((this.hitObject.time - currentPlay!.ARMs/2) - currentTime) / 300, 0, 1);
        let fadeInCompletion = yes;

        this.container.alpha = fadeInCompletion;
        this.approachCircle.alpha = fadeInCompletion;

        this.container.x = window.innerWidth / 2 + (this.hitObject.x - playfieldDimensions.width/2) * currentPlay!.pixelRatio! - currentPlay!.circleDiameter! / 2;
        this.container.y = window.innerHeight / 2 + (this.hitObject.y - playfieldDimensions.height/2) * currentPlay!.pixelRatio! - currentPlay!.circleDiameter! / 2;

        let approachCircleCompletion = MathUtil.clamp((this.hitObject.time - currentTime) / currentPlay!.ARMs, 0, 1);
        let approachCircleFactor = 3 * (approachCircleCompletion) + 1;
        let approachCircleDiameter = currentPlay!.circleDiameter! * approachCircleFactor;
        this.approachCircle.width = this.approachCircle.height = approachCircleDiameter;
        this.approachCircle.x = window.innerWidth / 2 + (this.hitObject.x - playfieldDimensions.width/2) * currentPlay!.pixelRatio! - approachCircleDiameter / 2;
        this.approachCircle.y = window.innerHeight / 2 + (this.hitObject.y - playfieldDimensions.height/2) * currentPlay!.pixelRatio! - approachCircleDiameter / 2;
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
        approachCircleContainer.removeChild(this.approachCircle);
    }
}

export const DRAWING_MODE = 0;
export const CIRCLE_BORDER_WIDTH = 1.75 / 16;
export function drawCircle(context: CanvasRenderingContext2D, x: number, y: number, comboInfo: any) { // Draws circle used for Hit Circles, Slider Heads and Repeat Tails
    let colourArray = currentPlay!.processedBeatmap.beatmap.colours;
    let colour = colourArray[comboInfo.comboNum % colourArray.length];

    //let colour = {r: 255, g: 20, b: 20};


    if (DRAWING_MODE === 0) {
        context.beginPath(); // Draw circle base (will become border)
        context.arc(x + currentPlay!.circleDiameter! / 2, y + currentPlay!.circleDiameter! / 2, currentPlay!.circleDiameter! / 2, 0, Math.PI * 2);
        context.fillStyle = "white";
        context.fill();

        let colourString = "rgb(" + Math.round(colour.r * 0.68) + "," + Math.round(colour.g * 0.68) + "," + Math.round(colour.b * 0.68) + ")";
        let darkColourString = "rgb(" + Math.round(colour.r * 0.2) + "," + Math.round(colour.g * 0.2) + "," + Math.round(colour.b * 0.2) + ")";

        let radialGradient = context.createRadialGradient(x + currentPlay!.circleDiameter! / 2, y + currentPlay!.circleDiameter! / 2, 0, x + currentPlay!.circleDiameter! / 2, y + currentPlay!.circleDiameter! / 2, currentPlay!.circleDiameter! / 2);
        radialGradient.addColorStop(0, colourString);
        radialGradient.addColorStop(1, darkColourString);

        context.beginPath(); // Draw circle body with radial gradient
        context.arc(x + currentPlay!.circleDiameter! / 2, y + currentPlay!.circleDiameter! / 2, (currentPlay!.circleDiameter! / 2) * (1 - CIRCLE_BORDER_WIDTH), 0, Math.PI * 2);
        context.fillStyle = radialGradient;
        context.fill();
        context.fillStyle = "rgba(255, 255, 255, 0.5)";
        context.globalCompositeOperation = "destination-out"; // Transparency
        context.fill();
    } else if (DRAWING_MODE === 1) {
        //context.drawImage(GAME_STATE.currentPlay.drawElements.coloredHitcircles[comboInfo.comboNum % GAME_STATE.currentBeatmap.colours.length], x, y);
    }

    context.globalCompositeOperation = "source-over";
    if (DRAWING_MODE === 0) {
        let innerType = "dot";

        if (innerType === "number") {
            //context.font = "lighter " + (GAME_STATE.currentPlay.csPixel * 0.41) + "px monospace";
            //context.textAlign = "center";
            //context.textBaseline = "middle";
            //context.fillStyle = "white";
            //context.fillText(/*comboInfo.n*/ Math.ceil(Math.random() * 9), x + circleDiameter / 2, y + circleDiameter / 2)
        } else {
            context.beginPath();
            context.arc(x + currentPlay!.circleDiameter! / 2, y + currentPlay!.circleDiameter! / 2, currentPlay!.circleDiameter! / 2 * 0.25, 0, Math.PI * 2);
            context.fillStyle = "white";
            context.fill();
        }
    } else if (DRAWING_MODE === 1) {
        //let numberWidth = 70 / 256 * GAME_STATE.currentPlay.csPixel,
        //    numberHeight = 104 / 256 * GAME_STATE.currentPlay.csPixel,
        //    numberString = comboInfo.n.toString(),
        //    hitCircleOverlap = 6;
//
        //for (let i = 0; i < numberString.length; i++) {
        //    context.drawImage(GAME_STATE.currentPlay.drawElements.numbers[numberString.charAt(i)], GAME_STATE.currentPlay.halfCsPixel - numberWidth * numberString.length / 2 + hitCircleOverlap * (numberString.length - 1) / 2 + ((numberWidth - hitCircleOverlap) * i), GAME_STATE.currentPlay.halfCsPixel - numberHeight / 2, numberWidth, numberHeight);
        //}
    }
}

export function getCoordFromCoordArray(arr: Point[], percent: number) {
    let actualIdx = percent * (arr.length - 1);
    let lowerIdx = Math.floor(actualIdx), upperIdx = Math.ceil(actualIdx);
    let lowerPos = arr[lowerIdx];
    let upperPos = arr[upperIdx];

    return { // Linear interpolation
        x: lowerPos.x * (1 - (actualIdx - lowerIdx)) + upperPos.x * (actualIdx - lowerIdx),
        y: lowerPos.y * (1 - (actualIdx - lowerIdx)) + upperPos.y * (actualIdx - lowerIdx)
    }
}