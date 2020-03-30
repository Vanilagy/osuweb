import { OsuTexture } from "../game/skin/texture";
import { EaseType, MathUtil } from "../util/math_util";
import { Point, Vector2, rotatePoint, addPoints, lerpPoints } from "../util/point";
import { randomInArray } from "../util/misc_util";

interface Particle {
	sprite: PIXI.Sprite,
	startPosition: Point,
	endPosition: Point,
	spawnTime: number,
	longevity: number,
	osuTexture: OsuTexture
}

export enum DistanceDistribution {
	Normal,
	UniformInCircle // Creates uniformly distributed points in the circle
}

export class ParticleEmitter {
	public container: PIXI.Container;
	private textures: OsuTexture[];
	private currentParticles: Particle[];
	private scale: number = 1.0;
	private spriteBlendMode: PIXI.BLEND_MODES = PIXI.BLEND_MODES.NORMAL;

	private alphaStart: number = 1.0;
	private alphaEnd: number = 0.0;
	private alphaEase: EaseType = EaseType.Linear;

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
	private particleDistanceDistribution: DistanceDistribution = DistanceDistribution.Normal;

	private currentStartTime: number = null;
	private currentDuration: number = null;
	private currentParticlesPerSecond: number = null;
	private lastEmitTime: number = null;

	constructor(textures: OsuTexture[]) {
		this.container = new PIXI.Container();
		this.textures = textures;
		this.currentParticles = [];
	}

	setAlphaBehavior(start: number, end: number, ease: EaseType = EaseType.Linear) {
		this.alphaStart = start;
		this.alphaEnd = end;
		this.alphaEase = ease;
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

	setTravelBehavior(distanceLow: number, distanceHigh: number, ease: EaseType, distanceDistribution: DistanceDistribution) {
		this.particleDistanceLow = distanceLow;
		this.particleDistanceHigh = distanceHigh;
		this.particleTravelEase = ease;
		this.particleDistanceDistribution = distanceDistribution;
	}

	setScale(scale: number) {
		if (scale === this.scale) return;
		this.scale = scale;

		for (let i = 0; i < this.currentParticles.length; i++) {
			let particle = this.currentParticles[i];
			particle.osuTexture.applyToSprite(particle.sprite, this.scale);
		}
	}

	setBlendMode(mode: PIXI.BLEND_MODES) {
		this.spriteBlendMode = mode;
	}

	start(currentTime: number, particlesPerSecond: number, duration: number = Infinity) {
		this.currentStartTime = currentTime;
		this.currentDuration = duration;
		this.currentParticlesPerSecond = particlesPerSecond;
		this.lastEmitTime = currentTime;
	}

	stop() {
		this.currentParticlesPerSecond = null;
	}

	emitOne(currentTime: number) {
		let longevity = MathUtil.randomInRange(this.particleLongevityLow, this.particleLongevityHigh);

		let origin: Point = {
			x: Math.random() * this.emitterWidth - this.emitterWidth/2,
			y: Math.random() * this.emitterHeight - this.emitterHeight/2
		};
		rotatePoint(origin, this.emitterOrientation);

		let directionAngle = this.emissionDirection + (Math.random() - 0.5) * this.emissionSpreadAngle;
		let weightedRandom: number;
		if (this.particleDistanceDistribution === DistanceDistribution.Normal) weightedRandom = Math.random();
		else if (this.particleDistanceDistribution === DistanceDistribution.UniformInCircle) weightedRandom = Math.sqrt(Math.random());
		let directionDistance = MathUtil.lerp(this.particleDistanceLow, this.particleDistanceHigh, weightedRandom);MathUtil.randomInRange(this.particleDistanceLow, this.particleDistanceHigh);
		let direction: Vector2 = {
			x: Math.cos(directionAngle) * directionDistance,
			y: Math.sin(directionAngle) * directionDistance
		};
		let endPosition = addPoints(origin, direction);

		let osuTexture = randomInArray(this.textures);
		let sprite = new PIXI.Sprite();
		osuTexture.applyToSprite(sprite, this.scale);

		sprite.anchor.set(0.5, 0.5);
		sprite.blendMode = this.spriteBlendMode;
		this.container.addChild(sprite);

		let particle: Particle = {
			sprite: sprite,
			startPosition: origin,
			endPosition: endPosition,
			spawnTime: currentTime,
			longevity: longevity,
			osuTexture: osuTexture
		};
		this.currentParticles.push(particle);
	}

	emit(currentTime: number, countMin: number, countMax: number) {
		let count = MathUtil.randomInRange(countMin, countMax);
		let integerCount = Math.floor(count);
		if (Math.random() < count % 1) integerCount++; // Account for the decimal part of the count. So, if count is 0.25, this will run about 1/4 of the time.

		for (let i = 0; i < integerCount; i++) this.emitOne(currentTime);
	}

	update(currentTime: number) {
		if (this.currentParticlesPerSecond !== null) {
			let msPerParticle = 1000/this.currentParticlesPerSecond;
			let latestAllowedTime = this.currentStartTime + this.currentDuration;
			let elapsedTime = Math.min(currentTime, latestAllowedTime) - this.lastEmitTime;
			let particleCount = Math.floor(elapsedTime / msPerParticle);

			this.lastEmitTime += msPerParticle * particleCount;

			for (let i = 0; i < particleCount; i++) this.emitOne(currentTime);

			if ((currentTime - this.currentStartTime) >= this.currentDuration) {
				this.stop();
			}
		}

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