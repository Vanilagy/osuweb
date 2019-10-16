import { OsuTexture } from "../game/skin/texture";
import { EaseType, MathUtil } from "../util/math_util";
import { Point, Vector2, rotatePoint, addPoints, lerpPoints } from "../util/point";
import { randomInArray } from "../util/misc_util";

interface Particle {
    sprite: PIXI.Sprite,
    startPosition: Point,
    endPosition: Point,
    spawnTime: number,
    longevity: number
}

export class ParticleEmitter {
    public container: PIXI.Container;
    private textures: OsuTexture[];
    private currentParticles: Particle[];
    private scale: number = 1.0;

    private alphaStart: number = 1.0;
    private alphaEnd: number = 0.0;
    private alphaEase: EaseType = EaseType.Linear;

    private countPerEmissionLow: number = 10;
    private countPerEmissionHigh: number = 10;

    private particleLongevityLow: number = 1000; // In ms
    private particleLongevityHigh: number = 1000;

    private emitterWidth: number = 0;
    private emitterHeight: number = 0;
    private emitterOrientation: number = 0;

    private emissionDirection: number = 0;
    private emissionSpreadAngle: number = Math.PI*2;

    private particleDistanceLow: number = 100;
    private particleDistanceHigh: number = 100;
    private particleTravelEase: EaseType = EaseType.Linear;

    constructor(textures: OsuTexture[]) {
        this.container = new PIXI.Container();
        this.textures = textures;
        this.currentParticles = [];
    }

    setAlphaBehavior(start: number, end: number, ease: EaseType = EaseType.Linear) {
        this.alphaStart = start;
        this.alphaEnd = end;
        this.alphaEnd = ease;
    }

    setCountBehavior(countLow: number, countHigh: number) {
        this.countPerEmissionLow = countLow;
        this.countPerEmissionHigh = countHigh;
    }

    setLongevityBehavior(low: number, high: number) {
        this.particleLongevityLow = low;
        this.particleLongevityHigh = high;
    }

    setEmitterProperties(width: number, height: number, orientation: number = 0) {
        this.emitterWidth = width;
        this.emitterHeight = height;
        this.emitterOrientation = orientation;
    }

    setEmissionAngles(direction: number, spreadAngle: number = 0) {
        this.emissionDirection = direction;
        this.emissionSpreadAngle = spreadAngle;
    }

    setTravelBehavior(distanceLow: number, distanceHigh: number, ease: EaseType) {
        this.particleDistanceLow = distanceLow;
        this.particleDistanceHigh = distanceHigh;
        this.particleTravelEase = ease;
    }

    setScale(scale: number) {
        this.scale = scale;
    }

    emit(currentTime: number) {
        let count = MathUtil.randomInRange(this.countPerEmissionLow, this.countPerEmissionHigh);
        let integerCount = Math.floor(count);
        if (Math.random() < count % 1) integerCount++; // Account for the decimal part of the count. So, if count is 0.25, this will run about 1/4 of the time.

        for (let i = 0; i < integerCount; i++) {
            let longevity = MathUtil.randomInRange(this.particleLongevityLow, this.particleLongevityHigh);

            let origin: Point = {
                x: Math.random() * this.emitterWidth - this.emitterWidth/2,
                y: Math.random() * this.emitterHeight - this.emitterHeight/2
            };
            rotatePoint(origin, this.emitterOrientation);

            let directionAngle = this.emissionDirection + (Math.random() - 0.5) * this.emissionSpreadAngle;
            let directionDistance = MathUtil.randomInRange(this.particleDistanceLow, this.particleDistanceHigh);
            let direction: Vector2 = {
                x: Math.cos(directionAngle) * directionDistance,
                y: Math.sin(directionAngle) * directionDistance
            };
            let endPosition = addPoints(origin, direction);

            let osuTexture = randomInArray(this.textures);
            let sprite = new PIXI.Sprite();
            osuTexture.applyToSprite(sprite, this.scale);

            sprite.anchor.set(0.5, 0.5);
            this.container.addChild(sprite);

            let particle: Particle = {
                sprite: sprite,
                startPosition: origin,
                endPosition: endPosition,
                spawnTime: currentTime,
                longevity: longevity
            };
            this.currentParticles.push(particle);
        }
    }

    update(currentTime: number) {
        for (let i = 0; i < this.currentParticles.length; i++) {
            let particle = this.currentParticles[i];
            
            let elapsedTime = currentTime - particle.spawnTime;
            let completion = elapsedTime / particle.longevity;
            completion = MathUtil.clamp(completion, 0, 1);

            if (completion === 1) {
                this.container.removeChild(particle.sprite);
                this.currentParticles.splice(i--, 1);
                continue;
            }

            let sprite = particle.sprite;

            let alphaCompletion = MathUtil.ease(this.alphaEase, completion);
            sprite.alpha = MathUtil.lerp(this.alphaStart, this.alphaEnd, alphaCompletion);

            let travelCompletion = MathUtil.ease(this.particleTravelEase, completion);
            let currentPosition = lerpPoints(particle.startPosition, particle.endPosition, travelCompletion * this.scale);
            sprite.position.set(currentPosition.x, currentPosition.y);
        }
    }
}