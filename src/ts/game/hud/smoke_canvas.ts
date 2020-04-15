import { GameplayController } from "../gameplay_controller";
import { Point } from "../../util/point";
import { currentWindowDimensions } from "../../visuals/ui";
import { MathUtil, EaseType } from "../../util/math_util";
import { last } from "../../util/misc_util";

const FADE_OUT_DURATION = 6000;
const SMOKE_OPACITY = 0.7;
const SMOKE_LINE_WIDTH = 6;

export class SmokeCanvas {
	public container: PIXI.Container;
	private controller: GameplayController;
	private lastMousePos: Point;
	private pressed: boolean;
	private currentSprite: PIXI.Sprite;

	private contexts: WeakMap<PIXI.Sprite, CanvasRenderingContext2D>;
	/** Stores the time (in playrate-adjusted gametime) when the smoke for that sprite was released. */
	private releaseTimes: WeakMap<PIXI.Sprite, number>;
	/** Stores all the line points for a given smoke sprite, so that it can be redrawn if necessary. */
	private storedPoints: WeakMap<PIXI.Sprite, Point[]>;

	constructor(controller: GameplayController) {
		this.controller = controller;
		this.container = new PIXI.Container();
		this.contexts = new WeakMap();
		this.releaseTimes = new WeakMap();
		this.storedPoints = new WeakMap();
	}

	reset() {
		this.release(-Infinity);

		this.container.removeChildren();
	}

	press() {
		if (this.pressed) return;

		this.pressed = true;
		this.lastMousePos = this.controller.inputState.getMousePosition();

		// Create a new canvas for this smoke
		let canvas = document.createElement('canvas');
		canvas.setAttribute("width", currentWindowDimensions.width.toString());
		canvas.setAttribute("height", currentWindowDimensions.height.toString());
		let ctx = canvas.getContext('2d');

		this.currentSprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
		this.contexts.set(this.currentSprite, ctx);
		this.storedPoints.set(this.currentSprite, []);

		this.container.addChild(this.currentSprite);
	}

	release(time: number) {
		if (!this.pressed) return;

		let adjustedTime = this.controller.currentPlay.toPlaybackRateIndependentTime(time);
		if (this.currentSprite) this.releaseTimes.set(this.currentSprite, adjustedTime);

		this.pressed = false;
		this.lastMousePos = null;
		this.currentSprite = null;
	}

	moveMouse(osuPosition: Point) {
		if (!this.pressed) return;

		let pointArr = this.storedPoints.get(this.currentSprite);
		if (last(pointArr) !== this.lastMousePos) pointArr.push(this.lastMousePos);
		pointArr.push(osuPosition);

		this.drawPath(this.currentSprite, [this.lastMousePos, osuPosition]);

		this.lastMousePos = osuPosition;
	}

	private drawPath(sprite: PIXI.Sprite, points: Point[]) {
		if (points.length === 0) return;

		let ctx = this.contexts.get(sprite);
		let play = this.controller.currentPlay;

		ctx.beginPath();
		for (let i = 0; i < points.length; i++) {
			let p = play.toScreenCoordinates(points[i]);

			if (i === 0) ctx.moveTo(p.x, p.y);
			else ctx.lineTo(p.x, p.y);
		}

		ctx.strokeStyle = 'white';
		ctx.lineWidth = play.screenPixelRatio * SMOKE_LINE_WIDTH;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.stroke();

		sprite.texture.update();
	}

	update(currentTime: number) {
		for (let child of this.container.children) {
			let sprite = child as PIXI.Sprite;
			let releaseTime = this.releaseTimes.get(sprite);

			if (releaseTime === undefined) {
				// Show the smoke at full opacity if it's still being drawn on
				sprite.alpha = SMOKE_OPACITY;
			} else {
				// Otherwise, slowly fade it out

				let fadeOutCompletion = (currentTime - releaseTime) / FADE_OUT_DURATION;
				fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
				fadeOutCompletion = MathUtil.ease(EaseType.EaseInQuad, fadeOutCompletion);
				sprite.alpha = (1 - fadeOutCompletion) * SMOKE_OPACITY;

				if (fadeOutCompletion === 1) {
					this.container.removeChild(sprite);
					// This will automatically remove everything else connected to the smoke (like the canvas), because WeakMaps are dope!
				}
			}
		}
	}

	resize() {
		// Redraw every smoke pattern for each canvas
		for (let child of this.container.children) {
			let sprite = child as PIXI.Sprite;
			let context = this.contexts.get(sprite);
			let canvas = context.canvas;
			canvas.setAttribute("width", currentWindowDimensions.width.toString());
			canvas.setAttribute("height", currentWindowDimensions.width.toString());

			context.clearRect(0, 0, canvas.width, canvas.height);
			this.drawPath(sprite, this.storedPoints.get(sprite));
		}
	}
}