import { hudContainer } from "../visuals/rendering";
import { BeatmapDifficulty } from "../datamodel/beatmap_difficulty";
import { gameState } from "./game_state";
import { MathUtil, EaseType } from "../util/math_util";
import { Interpolator } from "../util/graphics_util";
import { SpriteNumber, USUAL_SCORE_DIGIT_HEIGHT } from "../visuals/sprite_number";
import { currentSkin } from "./skin";

export let scoreDisplay: SpriteNumber;
export let phantomComboDisplay: SpriteNumber;
export let comboDisplay: SpriteNumber;
export let accuracyDisplay: SpriteNumber;
export let progressIndicator: ProgressIndicator;
export let accuracyMeter: AccuracyMeter;

const ACCURACY_METER_FADE_OUT_DELAY = 3000; // In ms
const ACCURACY_METER_FADE_OUT_TIME = 1000; // In ms

export async function initHud() {
    let scoreHeight = window.innerHeight * 0.06,
        accuracyHeight = window.innerHeight * 0.038,
        comboHeight = window.innerHeight * 0.08;

    scoreDisplay = new SpriteNumber({
        scaleFactor: scoreHeight / USUAL_SCORE_DIGIT_HEIGHT,
        equalWidthDigits: true,
        verticalAlign: "top",
        horizontalAlign: "right",
        overlap: currentSkin.config.fonts.scoreOverlap,
        overlapAtEnd: true,
        textures: currentSkin.scoreNumberTextures,
        leftPad: 8
    });
    scoreDisplay.container.x = window.innerWidth;

    accuracyDisplay = new SpriteNumber({
        scaleFactor: accuracyHeight / USUAL_SCORE_DIGIT_HEIGHT,
        equalWidthDigits: true,
        verticalAlign: "top",
        horizontalAlign: "right",
        overlap: currentSkin.config.fonts.scoreOverlap,
        overlapAtEnd: true,
        textures: currentSkin.scoreNumberTextures,
        fixedDecimals: 2,
        hasPercent: true
    });
    accuracyDisplay.setValue(100); // Hacky. TODO.
    accuracyDisplay.container.x = scoreDisplay.container.x;
    accuracyDisplay.container.y = Math.floor(scoreHeight + window.innerHeight * 0.008);

    phantomComboDisplay = new SpriteNumber({
        scaleFactor: comboHeight / USUAL_SCORE_DIGIT_HEIGHT,
        verticalAlign: "bottom",
        horizontalAlign: "left",
        overlap: currentSkin.config.fonts.scoreOverlap,
        textures: currentSkin.scoreNumberTextures,
        hasX: true
    });
    phantomComboDisplay.container.y = Math.floor(window.innerHeight - window.innerHeight * 0.005);
    phantomComboDisplay.container.x = Math.floor(window.innerHeight * 0.005);
    phantomComboDisplay.container.alpha = 0.5;

    comboDisplay = new SpriteNumber({
        scaleFactor: comboHeight / USUAL_SCORE_DIGIT_HEIGHT,
        verticalAlign: "bottom",
        horizontalAlign: "left",
        overlap: currentSkin.config.fonts.scoreOverlap,
        textures: currentSkin.scoreNumberTextures,
        hasX: true
    });
    comboDisplay.container.y = phantomComboDisplay.container.y;
    comboDisplay.container.x = phantomComboDisplay.container.x;

    progressIndicator = new ProgressIndicator(window.innerHeight * 0.05);
    // SO UNCLEAN OMG! TEMP! TODO!!
    progressIndicator.container.x = Math.floor(accuracyDisplay.container.x - accuracyDisplay.container.width - window.innerHeight * 0.04);
    progressIndicator.container.y = Math.floor(accuracyDisplay.container.y + accuracyDisplay.container.height/2);

    accuracyMeter = new AccuracyMeter();
    accuracyMeter.container.x = window.innerWidth / 2;
    accuracyMeter.container.y = window.innerHeight;

    hudContainer.addChild(accuracyMeter.container);
    hudContainer.addChild(scoreDisplay.container);
    hudContainer.addChild(phantomComboDisplay.container);
    hudContainer.addChild(comboDisplay.container);
    hudContainer.addChild(accuracyDisplay.container);
    hudContainer.addChild(progressIndicator.container);
}

class ProgressIndicator {
    public container: PIXI.Container;
    private ctx: CanvasRenderingContext2D;
    private diameter: number;

    constructor(diameter: number) {
        diameter = Math.floor(diameter / 2) * 2;

        let sprite = new PIXI.Sprite();
        this.diameter = diameter;

        let canvas = document.createElement('canvas');
        canvas.setAttribute('width', String(Math.ceil(diameter)));
        canvas.setAttribute('height', String(Math.ceil(diameter)));
        let ctx = canvas.getContext('2d');
        this.ctx = ctx;

        let texture = PIXI.Texture.from(canvas);
        sprite.texture = texture;

        sprite.width = diameter;
        sprite.height = diameter;
        sprite.anchor.set(0.5, 0.5);

        this.container = sprite;

        this.draw(0, false);
    }

    draw(completion: number, isPrelude: boolean) {
        let ctx = this.ctx;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        let radius = this.diameter / 2;
        let lineWidth = 2;
        let startAngle = -Math.PI / 2; // "North"
        let endAngle = startAngle + Math.PI*2 * completion;

        ctx.strokeStyle = '#9a999a';
        if (isPrelude) { // "Invert" the arc
            let temp = startAngle;
            startAngle = endAngle;
            endAngle = temp;

            ctx.strokeStyle = '#799634';
        }

        ctx.lineWidth = radius - lineWidth / 2;
        ctx.beginPath();
        ctx.arc(radius, radius, radius/2, startAngle, endAngle);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(radius, radius, radius - lineWidth/2, 0, Math.PI*2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(radius, radius, radius / 10, 0, Math.PI*2);
        ctx.fill();

        let sprite = this.container as PIXI.Sprite;
        sprite.texture.update();
    }
}

const ACCURACY_METER_HEIGHT_FACTOR = 0.02;
const ACCURACY_LINE_LIFETIME = 10000; // In ms

// TODO: Make this thing fade out automatically if there hasn't been input for a while
class AccuracyMeter {
    public container: PIXI.Container;
    private base: PIXI.Graphics;
    private overlay: PIXI.Container;
    private width: number;
    private lineWidth: number;
    private height: number;
    private accuracyLines: PIXI.Graphics[];
    private accuracyLineSpawnTimes: WeakMap<PIXI.Graphics, number>;
    private lastLineTime: number;
    private time50: number; // If you don't know what it means, just look where it's assigned.

    constructor() {
        this.container = new PIXI.Container();
        this.base = new PIXI.Graphics();
        this.overlay = new PIXI.Container();
        this.accuracyLines = [];
        this.accuracyLineSpawnTimes = new WeakMap();

        this.container.addChild(this.base);
        this.container.addChild(this.overlay);
    }

    init() {
        let { processedBeatmap } = gameState.currentPlay;

        this.lastLineTime = -Infinity;
        this.time50 = processedBeatmap.beatmap.difficulty.getHitDeltaForJudgement(50);

        this.height = Math.max(15, Math.round(window.innerHeight * ACCURACY_METER_HEIGHT_FACTOR / 5) * 5);
        let widthScale = this.height * 0.04;
        this.width = Math.round(processedBeatmap.beatmap.difficulty.getHitDeltaForJudgement(50)*2 * widthScale / 2) * 2;

        //this.lineWidth = Math.floor(this.height/5 / 2) * 2;
        this.lineWidth = 2;

        this.base.clear();

        // Black background
        this.base.beginFill(0x000000, 0.5);
        this.base.drawRect(0, 0, this.width, this.height);
        this.base.endFill();

        // Orange strip
        this.base.beginFill(0xd6ac52, 1);
        this.base.drawRect(0, this.height*2/5, this.width, this.height/5);
        this.base.endFill();

        // Green strip
        let greenStripWidth = Math.ceil(processedBeatmap.beatmap.difficulty.getHitDeltaForJudgement(100)*2 * widthScale);
        this.base.beginFill(0x57e11a, 1);
        this.base.drawRect(Math.floor(this.width/2 - greenStripWidth/2), this.height*2/5, greenStripWidth, this.height/5);
        this.base.endFill();

        // Blue strip
        let blueStripWidth = Math.ceil(processedBeatmap.beatmap.difficulty.getHitDeltaForJudgement(300)*2 * widthScale);
        this.base.beginFill(0x38b8e8, 1);
        this.base.drawRect(Math.floor(this.width/2 - blueStripWidth/2), this.height*2/5, blueStripWidth, this.height/5);
        this.base.endFill();

        // White middle line
        let lineWidth = this.lineWidth;
        this.base.beginFill(0xFFFFFF);
        this.base.drawRect(this.width/2 - lineWidth/2, 0, lineWidth, this.height);
        this.base.endFill();

        this.container.width = this.width;
        this.container.height = this.height;
        this.container.pivot.x = this.width/2;
        this.container.pivot.y = this.height; // No /2 ON PURPOSE.
    }
    
    update(currentTime: number) {
        for (let i = 0; i < this.accuracyLines.length; i++) {
            let line = this.accuracyLines[i];

            let spawnTime = this.accuracyLineSpawnTimes.get(line);
            let completion = (currentTime - spawnTime) / ACCURACY_LINE_LIFETIME;
            completion = MathUtil.clamp(completion, 0, 1);
            completion = MathUtil.ease(EaseType.EaseInQuad, completion);
            let alpha = 1 - completion;

            line.alpha = alpha;

            // Remove the line once it's invisible
            if (alpha === 0) {
                this.overlay.removeChild(line);
                this.accuracyLines.splice(i, 1);
                i--;
            }
        }

        // Make sure the whole thing fades out after a few seconds of no new accuracy lines
        let fadeOutCompletion = (currentTime - (this.lastLineTime + ACCURACY_METER_FADE_OUT_DELAY)) / ACCURACY_METER_FADE_OUT_TIME;
        fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
        this.container.alpha = 1 - fadeOutCompletion;
    }

    addAccuracyLine(inaccuracy: number, currentTime: number) {
        let { processedBeatmap } = gameState.currentPlay;

        let judgement = processedBeatmap.beatmap.difficulty.getJudgementForHitDelta(Math.abs(inaccuracy));
        if (judgement === 0) return;

        let color = (() => {
            if (judgement === 300) return 0x38b8e8;
            else if (judgement === 100) return 0x57e11a;
            return 0xd6ac52;
        })();

        let line = new PIXI.Graphics();
        line.beginFill(color, 0.65);
        line.drawRect(0, 0, this.lineWidth, this.height);
        line.endFill();
        line.blendMode = PIXI.BLEND_MODES.ADD;

        line.pivot.x = line.width/2;
        line.x = this.width/2 + (inaccuracy / this.time50) * this.width/2;

        this.overlay.addChild(line);
        this.accuracyLines.push(line);
        this.accuracyLineSpawnTimes.set(line, currentTime);
        this.lastLineTime = currentTime;
    }
}