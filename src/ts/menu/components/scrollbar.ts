import { MathUtil } from "../../util/math_util";

const SCROLLBAR_WIDTH = 2.5;
const MIN_THUMB_HEIGHT = 12;

export class Scrollbar {
	public container: PIXI.Container;

	private background: PIXI.Sprite;
	private thumb: PIXI.Sprite;

	private scaledHeight: number = 0;
	private scalingFactor = 1.0;

	private scrollHeight: number = 0;
	private pageHeight: number = 0;
	private currentPosition: number = 0; // ...from top of the total scroll height

	constructor() {
		this.container = new PIXI.Container();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.4;
		this.thumb = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.thumb.tint = 0xDDDDDD;
		this.thumb.alpha = 0.8;

		this.container.addChild(this.background, this.thumb);
	}

	setScaling(scaledHeight: number, scalingFactor: number) {
		this.scaledHeight = scaledHeight;
		this.scalingFactor = scalingFactor;

		this.background.width = this.thumb.width = Math.ceil(SCROLLBAR_WIDTH * scalingFactor);
	}

	setScrollHeight(newScrollHeight: number) {
		this.scrollHeight = newScrollHeight;
	}

	setPageHeight(newPageHeight: number) {
		this.pageHeight = newPageHeight;
	}

	setCurrentPosition(position: number) {
		this.currentPosition = position;
	}

	update() {
		this.background.height = this.scaledHeight;

		if (this.scrollHeight === 0) {
			// If there's nothing to scroll, then don't show the thumb.
			this.thumb.visible = false;
			return;
		}

		let percentThumb = this.pageHeight / (this.scrollHeight + this.pageHeight);
		let thumbHeight = percentThumb * this.scaledHeight;
		thumbHeight = Math.max(MIN_THUMB_HEIGHT * this.scalingFactor, thumbHeight);

		let completion = (this.currentPosition / this.scrollHeight) || 0;
		let thumbPosition = completion * (this.scaledHeight - thumbHeight);

		if (thumbPosition < 0) {
			// Squish the thumb based on overflow
			thumbHeight -= -thumbPosition;
			thumbPosition = 0;
		} else if (thumbPosition > this.scaledHeight) {
			thumbHeight -= thumbPosition - this.scaledHeight;
		}

		this.thumb.visible = true;
		this.thumb.height = Math.max(0, Math.ceil(thumbHeight));
		this.thumb.y = Math.floor(thumbPosition);
	}
}