import { hudContainer } from "../visuals/rendering";
import { gameState } from "./game_state";
import { MathUtil, EaseType } from "../util/math_util";
import { SpriteNumber, USUAL_SCORE_DIGIT_HEIGHT } from "../visuals/sprite_number";
import { baseSkin } from "./skin";

export let scoreDisplay: SpriteNumber;
export let phantomComboDisplay: SpriteNumber;
export let comboDisplay: SpriteNumber;
export let accuracyDisplay: SpriteNumber;
export let progressIndicator: ProgressIndicator;
export let accuracyMeter: AccuracyMeter;

const ACCURACY_METER_FADE_OUT_DELAY = 4000; // In ms
const ACCURACY_METER_FADE_OUT_TIME = 1000; // In ms

export function initHud() {
    let scoreHeight = window.innerHeight * 0.0575,
        accuracyHeight = window.innerHeight * 0.0345,
        comboHeight = window.innerHeight * 0.0730;

    scoreDisplay = new SpriteNumber({
        scaleFactor: scoreHeight / USUAL_SCORE_DIGIT_HEIGHT,
        equalWidthDigits: true,
        verticalAlign: "top",
        horizontalAlign: "right",
        overlap: baseSkin.config.fonts.scoreOverlap,
        overlapAtEnd: true,
        textures: baseSkin.scoreNumberTextures,
        leftPad: 8
    });
    scoreDisplay.container.x = Math.floor(window.innerWidth - scoreHeight * 0.2);
    scoreDisplay.container.y = 0;
    scoreDisplay.setValue(0);

    accuracyDisplay = new SpriteNumber({
        scaleFactor: accuracyHeight / USUAL_SCORE_DIGIT_HEIGHT,
        equalWidthDigits: true,
        verticalAlign: "top",
        horizontalAlign: "right",
        overlap: baseSkin.config.fonts.scoreOverlap,
        overlapAtEnd: true,
        textures: baseSkin.scoreNumberTextures,
        fixedDecimals: 2,
        hasPercent: true
    });
    accuracyDisplay.setValue(100);
    accuracyDisplay.container.x = Math.floor(window.innerWidth - accuracyHeight * 0.37);
    accuracyDisplay.container.y = Math.floor(scoreDisplay.container.height + window.innerHeight * 0.0075);

    progressIndicator = new ProgressIndicator(window.innerHeight * 0.043);
    progressIndicator.container.x = Math.floor(accuracyDisplay.container.x - accuracyDisplay.lastComputedWidth - window.innerHeight * 0.035 - (baseSkin.config.fonts.scoreOverlap  * accuracyHeight / USUAL_SCORE_DIGIT_HEIGHT));
    progressIndicator.container.y = Math.floor(accuracyDisplay.container.y + Math.min(accuracyHeight/2, accuracyDisplay.lastComputedHeight/2));

    phantomComboDisplay = new SpriteNumber({
        scaleFactor: comboHeight / USUAL_SCORE_DIGIT_HEIGHT,
        verticalAlign: "bottom",
        horizontalAlign: "left",
        overlap: baseSkin.config.fonts.comboOverlap,
        textures: baseSkin.scoreNumberTextures,
        hasX: true
    });
    phantomComboDisplay.container.x = Math.floor(window.innerHeight * 0.005);
    phantomComboDisplay.container.y = Math.floor(window.innerHeight);
    phantomComboDisplay.container.alpha = 0.333;
    phantomComboDisplay.setValue(0);

    comboDisplay = new SpriteNumber({
        scaleFactor: comboHeight / USUAL_SCORE_DIGIT_HEIGHT,
        verticalAlign: "bottom",
        horizontalAlign: "left",
        overlap: baseSkin.config.fonts.comboOverlap,
        textures: baseSkin.scoreNumberTextures,
        hasX: true
    });
    comboDisplay.container.x = phantomComboDisplay.container.x;
    comboDisplay.container.y = phantomComboDisplay.container.y;
    comboDisplay.setValue(0);

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

            ctx.strokeStyle = '#7ba632'; // Some green
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
    private fadeOutStart: number;
    private time50: number; // If you don't know what it means, just look where it's assigned.
    private alphaFilter: PIXI.filters.AlphaFilter; // We need to use an alpha filter here, because fading out without one looks weird due to the additive blend mode of the accuracy lines. Using the filter, everything fades out as if it were one.

    constructor() {
        this.container = new PIXI.Container();
        this.base = new PIXI.Graphics();
        this.overlay = new PIXI.Container();
        this.accuracyLines = [];
        this.accuracyLineSpawnTimes = new WeakMap();
        this.alphaFilter = new PIXI.filters.AlphaFilter();

        this.container.addChild(this.base);
        this.container.addChild(this.overlay);

        this.container.filters = [this.alphaFilter];
    }

    init() {
        let { processedBeatmap } = gameState.currentPlay;

        this.fadeOutStart = -Infinity;
        this.time50 = processedBeatmap.difficulty.getHitDeltaForJudgement(50);

        this.height = Math.max(15, Math.round(window.innerHeight * ACCURACY_METER_HEIGHT_FACTOR / 5) * 5);
        let widthScale = this.height * 0.04;
        this.width = Math.round(processedBeatmap.difficulty.getHitDeltaForJudgement(50)*2 * widthScale / 2) * 2;

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
        let greenStripWidth = Math.ceil(processedBeatmap.difficulty.getHitDeltaForJudgement(100)*2 * widthScale);
        this.base.beginFill(0x57e11a, 1);
        this.base.drawRect(Math.floor(this.width/2 - greenStripWidth/2), this.height*2/5, greenStripWidth, this.height/5);
        this.base.endFill();

        // Blue strip
        let blueStripWidth = Math.ceil(processedBeatmap.difficulty.getHitDeltaForJudgement(300)*2 * widthScale);
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
        let fadeOutCompletion = (currentTime - this.fadeOutStart) / ACCURACY_METER_FADE_OUT_TIME;
        fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
        this.alphaFilter.alpha = 1 - fadeOutCompletion;
    }

    addAccuracyLine(inaccuracy: number, currentTime: number) {
        let { processedBeatmap } = gameState.currentPlay;

        let judgement = processedBeatmap.difficulty.getJudgementForHitDelta(Math.abs(inaccuracy));
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

        this.fadeOutStart = currentTime + ACCURACY_METER_FADE_OUT_DELAY;
    }

    fadeOutNow(currentTime: number) {
        if (this.fadeOutStart > currentTime) this.fadeOutStart = currentTime;
    }
}