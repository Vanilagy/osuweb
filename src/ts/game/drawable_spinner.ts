import { DrawableHitObject } from "./drawable_hit_object";
import { PlayEvent, PlayEventType } from "./play_events";
import { Spinner } from "../datamodel/spinner";
import { mainHitObjectContainer } from "../visuals/rendering";
import { gameState } from "./game_state";
import { MathUtil, EaseType } from "../util/math_util";
import { Point } from "../util/point";
import { anyGameButtonIsPressed } from "../input/input";
import { PLAYFIELD_DIMENSIONS } from "../util/constants";
import { Interpolator } from "../util/graphics_util";
import { HitSoundInfo, currentSkin } from "./skin";

const SPINNER_CENTER_CIRCLE_RADIUS = 5;
const SPINNER_SPINNY_THING_RADIUS = 30;
const SPINNER_SPINNY_THING_LINE_WIDTH = 5;
const SPINNER_FADE_IN_TIME = 200; // In ms
const SPINNER_FADE_OUT_TIME = 200; // In ms

export class DrawableSpinner extends DrawableHitObject {
    public hitObject: Spinner;
    public hitSound: HitSoundInfo;
    private componentContainer: PIXI.Container;
    private centerCircle: PIXI.Container;
    private approachCircle: PIXI.Container;
    private spinnyThing: PIXI.Container; // yesyesyes it'll be renamed
    private clearText: PIXI.Text;
    private clearTextInterpolator: Interpolator;
    private bonusSpinsElement: PIXI.Text;
    private bonusSpinsInterpolator: Interpolator;

    private duration: number;
    private lastSpinPosition: Point = null;
    private lastInputTime: number = null;
    private spinnerAngle = 0;
    private totalRadiansSpun = 0; // The sum of all absolute angles this spinner has been spun (the total "angular distance")
    private requiredSpins: number;
    private cleared: boolean;
    private bonusSpins: number;

    constructor(hitObject: Spinner) {
        super(hitObject);
    }

    init() {
        let { processedBeatmap } = gameState.currentPlay;

        this.startTime = this.hitObject.time;
        this.endTime = this.hitObject.endTime;
        this.endPoint = this.startPoint;

        this.duration = this.endTime - this.startTime;
        // 1 Spin = 1 Revolution
        this.requiredSpins = (100 + processedBeatmap.beatmap.difficulty.OD * 15) * this.duration / 60000 * 0.88; // This shit's approximate af. But I mean it's ppy.
        this.cleared = false;
        this.bonusSpins = 0;

        this.componentContainer = new PIXI.Container();
        this.clearTextInterpolator = new Interpolator({
            from: 0,
            to: 1,
            ease: EaseType.EaseOutExpo,
            duration: 500
        });
        this.bonusSpinsInterpolator = new Interpolator({
            from: 0,
            to: 1,
            ease: EaseType.Linear,
            duration: 750
        });

        this.renderStartTime = this.startTime - SPINNER_FADE_IN_TIME;
    }

    draw() {
        let { pixelRatio } = gameState.currentPlay;

        let centerCircle = new PIXI.Graphics();
        centerCircle.beginFill(0xFFFFFF);
        centerCircle.drawCircle(0, 0, SPINNER_CENTER_CIRCLE_RADIUS * pixelRatio);
        centerCircle.endFill();
        this.centerCircle = centerCircle;

        let spinnyThing = new PIXI.Graphics();
        spinnyThing.lineStyle(SPINNER_SPINNY_THING_LINE_WIDTH * pixelRatio, 0xFFFFFF);
        spinnyThing.arc(0, 0, SPINNER_SPINNY_THING_RADIUS * pixelRatio, -Math.PI * 0.75, -Math.PI * 0.25); // "arc" from north-west to north-east
        this.spinnyThing = spinnyThing;

        let approachCircle = new PIXI.Graphics();
        approachCircle.lineStyle(5 * pixelRatio, 0xFFFFFF);
        approachCircle.arc(0, 0, 200 * pixelRatio, 0, Math.PI*2);
        this.approachCircle = approachCircle;

        let clearText = new PIXI.Text("Clear!", {
            fontFamily: "Nunito",
            fontSize: 32 * pixelRatio,
            fill: "#FFFFFF"
        });
        clearText.anchor.x = 0.5;
        clearText.anchor.y = 0.5;
        clearText.y = -100 * pixelRatio;
        clearText.visible = false;
        this.clearText = clearText;

        let bonusSpinsElement = new PIXI.Text("", {
            fontFamily: "Nunito",
            fontSize: 24 * pixelRatio,
            fill: "#FFFFFF"
        });
        bonusSpinsElement.anchor.x = 0.5;
        bonusSpinsElement.anchor.y = 0.5;
        bonusSpinsElement.y = 100 * pixelRatio;
        bonusSpinsElement.visible = true;
        this.bonusSpinsElement = bonusSpinsElement;

        this.componentContainer.addChild(this.centerCircle);
        this.componentContainer.addChild(this.approachCircle);
        this.componentContainer.addChild(this.spinnyThing);
        this.componentContainer.addChild(this.clearText);
        this.componentContainer.addChild(this.bonusSpinsElement);

        this.container.addChild(this.componentContainer);
    }

    show(currentTime: number) {
        mainHitObjectContainer.addChildAt(this.container, 0);

        this.position();
        this.update(currentTime);
    }

    position() {
        // Position it in the center
        this.componentContainer.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
        this.componentContainer.y = gameState.currentPlay.toScreenCoordinatesY(this.y);
    }

    update(currentTime: number) {
        if (currentTime >= this.endTime + SPINNER_FADE_OUT_TIME) {
            this.renderFinished = true;
            return;
        }

        if (currentTime < this.startTime) {
            let fadeInCompletion = (currentTime - (this.startTime - SPINNER_FADE_IN_TIME)) / SPINNER_FADE_IN_TIME;
            fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);
            this.container.alpha = fadeInCompletion;
        } else if (currentTime >= this.endTime) {
            let fadeOutCompletion = (currentTime - this.endTime) / SPINNER_FADE_OUT_TIME;
            fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
            this.container.alpha = 1 - fadeOutCompletion;
        }
    
        let completion = (currentTime - this.startTime) / this.duration;
        completion = MathUtil.clamp(completion, 0, 1);

        this.approachCircle.scale.x = (1 - completion);
        this.approachCircle.scale.y = (1 - completion);

        this.spinnyThing.rotation = this.spinnerAngle;

        let clearTextScale = this.clearTextInterpolator.getCurrentValue(currentTime);
        this.clearText.scale.x = clearTextScale;
        this.clearText.scale.y = clearTextScale;
        this.clearText.visible = this.cleared;

       // −1.556x2+1.156x+0.9000
       // −1.222x2+1.122x+0.9000

        let bonusSpinsCompletion = this.bonusSpinsInterpolator.getCurrentValue(currentTime);
        let parab = -1.222 * bonusSpinsCompletion**2 + 1.122 * bonusSpinsCompletion + 0.900;
        this.bonusSpinsElement.scale.x = parab;
        this.bonusSpinsElement.scale.y = parab;
        this.bonusSpinsElement.alpha = 1 - MathUtil.ease(EaseType.EaseInQuad, bonusSpinsCompletion);
    }

    score() {
        let currentPlay = gameState.currentPlay;

        let spinsSpun = this.getSpinsSpun();
        if (spinsSpun < this.requiredSpins) {
            currentPlay.scoreCounter.add(0, false, true, true, this, this.endTime);
        } else {
            let judgement = (() => {
                if (spinsSpun >= this.requiredSpins + 0.5) {
                    return 300;
                } else if (spinsSpun >= this.requiredSpins + 0.25) {
                    return 100;
                } else {
                    return 50;
                }
            })();

            currentPlay.scoreCounter.add(judgement, false, true, true, this, this.endTime);
            if (judgement !== 0) currentSkin.playHitSound(this.hitSound);
        }
    }

    getSpinsSpun() {
        return this.totalRadiansSpun / (Math.PI * 2);
    }

    handleMouseMove(osuMouseCoordinates: Point, currentTime: number) {
        if (currentTime < this.startTime || currentTime >= this.endTime) return;

        let pressed = anyGameButtonIsPressed();

        if (!pressed) {
            if (this.lastSpinPosition !== null) {
                this.lastSpinPosition = null;
                this.lastInputTime = null;
            }
            
            return;
        }

        if (this.lastSpinPosition === null) {
            this.lastSpinPosition = osuMouseCoordinates;
            this.lastInputTime = currentTime;
            return;
        }

        let p1 = osuMouseCoordinates,
            p2 = this.lastSpinPosition;
        let angle1 = Math.atan2(p1.y - PLAYFIELD_DIMENSIONS.height/2, p1.x - PLAYFIELD_DIMENSIONS.width/2),
            angle2 = Math.atan2(p2.y - PLAYFIELD_DIMENSIONS.height/2, p2.x - PLAYFIELD_DIMENSIONS.width/2);
        let theta = MathUtil.getNormalizedAngleDelta(angle1, angle2);
        let timeDelta = (currentTime - this.lastInputTime) / 1000; // In seconds
        if (timeDelta <= 0) return; // WTF? TODO!
        // Ergh. current time can jump backwards. fuuuck

        /*
        // If we change direction, stop immediately
        if (Math.sign(this.lastAngularVelocity) !== Math.sign(theta)) {
            this.lastAngularVelocity = 0;
        }

        let absTheta = Math.abs(theta);
        let absThetaPerSecond = absTheta /= timeDelta;
        let lastAbs = Math.abs(this.lastAngularVelocity);

        if (false && absThetaPerSecond < lastAbs) {
            let diff = lastAbs - absThetaPerSecond;
            let newAbsoluteVelocity = lastAbs - diff / 3;
            this.lastAngularVelocity = newAbsoluteVelocity * Math.sign(theta);
            console.log("Whackass!");
        } else {
            // 20 radians per second threshold
            let dist = MathUtil.clamp(lastAbs / 40, 0, 1);
            console.log(dist);

            let newAbsoluteVelocity = Math.min(lastAbs + timeDelta * Math.PI*0.05, absThetaPerSecond);

            let weighted = (1 - dist) * newAbsoluteVelocity + dist * absThetaPerSecond;

            //newAbsoluteVelocity = absThetaPerSecond;
            this.lastAngularVelocity = weighted * Math.sign(theta);
        }
        
        this.spinnerAngle += this.lastAngularVelocity * timeDelta;
        */

        // ALL POINTLESS!

        this.spin(theta, currentTime);

        //this.spinnerAngle += theta;
        //this.totalRadiansSpun += Math.abs(theta);

        //console.log(this.lastAngularVelocity);

        this.lastSpinPosition = osuMouseCoordinates;
        //this.lastInputTime = currentTime;
    }

    spin(radians: number, currentTime: number) {
        if (currentTime < this.startTime || currentTime >= this.endTime) return;

        let currentPlay = gameState.currentPlay;

        if (this.lastInputTime === null) {
            this.lastInputTime = currentTime;
            return;
        }

        let timeDif = currentTime - this.lastInputTime;
        if (timeDif <= 0) return;
        
        let angle = Math.sign(radians) * Math.min(Math.abs(radians), 0.05 * timeDif); // MAX 0.05 radians / ms, 'cause 477 limit!
        
        let prevSpinsSpun = this.getSpinsSpun();

        this.spinnerAngle += angle;
        this.totalRadiansSpun += Math.abs(angle);

        let spinsSpunNow = this.getSpinsSpun();
        let wholeDif = Math.floor(spinsSpunNow) - Math.floor(prevSpinsSpun);
        if (wholeDif > 0) {
            // Give 100 raw score for every spin
            currentPlay.scoreCounter.add(wholeDif * 100, true, false, false, this, currentTime);
        }
        if (spinsSpunNow >= this.requiredSpins && !this.cleared) {
            this.cleared = true;
            this.clearTextInterpolator.start(currentTime);
        }
        let bonusSpins = Math.floor(spinsSpunNow - this.requiredSpins);
        if (bonusSpins > 0 && bonusSpins > this.bonusSpins) {
            let dif = bonusSpins - this.bonusSpins;
            currentPlay.scoreCounter.add(dif * 1000, true, false, false, this, currentTime)

            this.bonusSpins = bonusSpins;
            this.bonusSpinsElement.text = String(this.bonusSpins * 1000);
            this.bonusSpinsInterpolator.start(currentTime);
        }

        this.lastInputTime = currentTime;
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
    }

    addPlayEvents(playEventArray: PlayEvent[]) {
        playEventArray.push({
            type: PlayEventType.SpinnerEnd,
            hitObject: this,
            time: this.endTime
        });
    }

    handleButtonPress() {return false;}
}