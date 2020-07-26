import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { createPolygonTexture } from "../../util/pixi_util";
import { colorToHexNumber, colorToHexString, lerpColors, Colors } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";
import { MathUtil, EaseType } from "../../util/math_util";
import { EMPTY_FUNCTION } from "../../util/misc_util";
import { Interpolator } from "../../util/interpolation";
import { CustomEventEmitter } from "../../util/custom_event_emitter";

const TRACK_HEIGHT = 5;
const THUMB_WIDTH = 32;
const THUMB_HEIGHT = 11;

export interface RangeSliderOptions {
	min: number,
	max: number,
	base: number,
	/** The function that converts the actual value of the slider into a string representation to display next to the thumb. */
	tooltipFunction: (val: number) => string
}

export class RangeSlider extends CustomEventEmitter<{change: number}> {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	private width: number;
	private options: RangeSliderOptions;
	private scalingFactor: number = 1.0;

	private track: PIXI.Sprite;
	private trackCanvas: HTMLCanvasElement;
	private trackCtx: CanvasRenderingContext2D;

	private thumb: PIXI.Sprite;
	private tooltip: PIXI.Text;
	
	private currentCompletion: number;
	/** The x-position of the thumb when dragging began */
	private positionOnDragStart: number;

	private hoverInterpolator: Interpolator;
	private pressdownInterpolator: Interpolator;

	constructor(width: number, options: RangeSliderOptions) {
		super();

		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
		this.width = width;
		this.options = options;

		this.trackCanvas = document.createElement('canvas');
		this.trackCtx = this.trackCanvas.getContext('2d');
		this.track = new PIXI.Sprite(PIXI.Texture.from(this.trackCanvas));
		this.track.hitArea = new PIXI.Rectangle();
		this.container.addChild(this.track);

		this.thumb = new PIXI.Sprite();
		this.thumb.tint = colorToHexNumber(THEME_COLORS.PrimaryViolet);
		this.container.addChild(this.thumb);

		this.tooltip = new PIXI.Text('', {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff
		});
		this.tooltip.anchor.set(0.5, 0.0);
		this.container.addChild(this.tooltip);

		let thumbRegistration = new InteractionRegistration(this.thumb);
		this.interactionGroup.add(thumbRegistration);

		thumbRegistration.makeDraggable(() => {
			this.positionOnDragStart = this.thumb.position.x;
			this.pressdownInterpolator.setReversedState(false, performance.now());
		}, (e) => {
			this.updateThumbForDrag(e.distanceFromStart.x);
		}, () => {
			this.pressdownInterpolator.setReversedState(true, performance.now());
		});

		thumbRegistration.addButtonHandlers(
			EMPTY_FUNCTION,
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			EMPTY_FUNCTION,
			EMPTY_FUNCTION
		);

		this.hoverInterpolator = new Interpolator({
			duration: 150,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});
		this.pressdownInterpolator = new Interpolator({
			duration: 50,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});

		let trackRegistration = new InteractionRegistration(this.track);
		trackRegistration.setZIndex(-1);
		this.interactionGroup.add(trackRegistration);
		trackRegistration.addListener('mouseDown', (e) => {
			thumbRegistration.trigger('mouseDown', e); // Pretend like we've clicked the thumb
			this.positionOnDragStart = (e.clientX - this.track.getGlobalPosition().x) - this.thumb.width/2;
			this.updateThumbForDrag(0);
		});

		this.setValue(this.options.base);
	}

	resize(scalingFactor: number) {
		this.scalingFactor = scalingFactor;

		this.drawTrack();

		let slantWidth = THUMB_HEIGHT/5;
		this.thumb.texture = createPolygonTexture(THUMB_WIDTH + slantWidth, THUMB_HEIGHT, [
			new PIXI.Point(0, 0), new PIXI.Point(THUMB_WIDTH, 0), new PIXI.Point(THUMB_WIDTH + slantWidth, THUMB_HEIGHT), new PIXI.Point(slantWidth, THUMB_HEIGHT)
		], this.scalingFactor, 0, false, 2);
		
		this.track.y = Math.floor((THUMB_HEIGHT/2 - TRACK_HEIGHT/2) * this.scalingFactor);
		let hitRec = this.track.hitArea as PIXI.Rectangle; // The hit area of the track should be bigger than the actual drawn track, since the actual drawn track is quite thin
		hitRec.y = -this.track.y;
		hitRec.height = this.thumb.height;
		hitRec.width = this.track.width;

		this.setCompletion(this.currentCompletion);

		this.tooltip.style.fontSize = Math.floor(9 * this.scalingFactor);
		this.tooltip.y = Math.floor(-10 * this.scalingFactor);
	}

	drawTrack() {
		let width = Math.floor(this.width * this.scalingFactor);
		let height = Math.floor(4 * this.scalingFactor);

		this.trackCanvas.setAttribute('width', width.toString());
		this.trackCanvas.setAttribute('height', height.toString());

		// Draw the base of the track
		this.trackCtx.clearRect(0, 0, width, height);
		this.trackCtx.moveTo(height/2, height/2);
		this.trackCtx.lineTo(width - height/2, height/2);
		this.trackCtx.lineWidth = height;
		this.trackCtx.strokeStyle = 'rgb(64,64,64)';
		this.trackCtx.lineCap = 'round';
		this.trackCtx.stroke();

		// Highlight the part of the track from the base to the current value, to indicate how far the slider is dragged
		this.trackCtx.beginPath();
		let baseCompletion = (this.options.base - this.options.min) / (this.options.max - this.options.min);
		this.trackCtx.moveTo(height/2 + (width - height) * baseCompletion, height/2);
		this.trackCtx.lineTo(height/2 + (width - height) * this.currentCompletion, height/2);
		this.trackCtx.strokeStyle = colorToHexString(THEME_COLORS.PrimaryViolet);
		this.trackCtx.stroke();

		this.track.texture.update();
	}

	update(now: number) {
		let hoverCompletion = this.hoverInterpolator.getCurrentValue(now);
		let pressdownCompletion = this.pressdownInterpolator.getCurrentValue(now);

		let thumbBrightness = MathUtil.lerp(MathUtil.lerp(0, 0.3, hoverCompletion), 0.8, pressdownCompletion);
		this.thumb.tint = colorToHexNumber(lerpColors(THEME_COLORS.PrimaryViolet, Colors.White, thumbBrightness));

		this.tooltip.alpha = MathUtil.lerp(0, 0.85, Math.max(hoverCompletion, pressdownCompletion));
	}

	getValue() {
		return MathUtil.lerp(this.options.min, this.options.max, this.currentCompletion);
	}

	setValue(value: number) {
		let completion = (value - this.options.min) / (this.options.max - this.options.min);
		completion = MathUtil.clamp(completion, 0, 1);

		this.setCompletion(completion);
	}

	private calculateThumbPositionForCompletion(completion: number, round = false) {
		let slantWidth = THUMB_HEIGHT/5;
		let min = -slantWidth/2 * this.scalingFactor;
		let max = this.track.width - this.thumb.width + slantWidth * this.scalingFactor;
		
		let x = MathUtil.lerp(min, max, completion);

		if (round) {
			if (x === max) x = Math.ceil(x); // Ceil so that it's at the very end of the track and the track's end is surely occuluded the thumb
			else x = Math.floor(x);
		}

		return x;
	}

	private setCompletion(completion: number) {
		this.currentCompletion = completion;
		this.tooltip.text = this.options.tooltipFunction(this.getValue());
		
		let visualX = this.calculateThumbPositionForCompletion(completion, true);
		this.setThumbPosition(visualX);
		this.drawTrack();

		this.emit('change', this.getValue());
	}

	private setThumbPosition(x: number) {
		let slantWidth = THUMB_HEIGHT/5;

		this.thumb.position.x = x;
		this.tooltip.position.x = Math.ceil(x + this.thumb.width/2 - slantWidth * this.scalingFactor); // Above the middle of the thumb
	}

	private updateThumbForDrag(dragOffset: number) {
		let newX = this.positionOnDragStart + dragOffset;
		
		let slantWidth = THUMB_HEIGHT/5;
		let min = -slantWidth/2 * this.scalingFactor;
		let max = this.track.width - this.thumb.width + slantWidth * this.scalingFactor;
		
		newX = MathUtil.clamp(newX, min, max);

		let completion: number
		let baseCompletion = (this.options.base - this.options.min) / (this.options.max - this.options.min);
		let positionForBase = this.calculateThumbPositionForCompletion(baseCompletion);
		if (Math.abs(newX - positionForBase) < 1) {
			// If the thumb is really close to the position it would have to be in for the value to be 'base', then "snap" it to that position. This makes it easier to actually get the base value. Quality of life!
			newX = positionForBase;
			completion = baseCompletion;
		} else {
			completion = (newX - min) / (max - min);
		}

		this.setCompletion(completion);
	}
}