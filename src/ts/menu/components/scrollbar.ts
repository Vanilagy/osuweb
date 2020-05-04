import { MathUtil } from "../../util/math_util";

const SCROLLBAR_WIDTH = 2.5;
const MIN_THUMB_HEIGHT = 15;

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
		let completion = this.currentPosition / this.scrollHeight;

		// How much the thumb overflows the top end of the scrollbar
		let topOverflow = Math.max(0, -completion);
		// How much the thumb overflows the bottom end of the scrollbar
		let bottomOverflow = Math.max(0, completion - (this.scrollHeight - this.pageHeight) / this.scrollHeight);

		// The height of the thumb before it is scaled down further
		let rawThumbHeight = this.pageHeight / this.scrollHeight * this.scaledHeight;

		let thumbHeight = rawThumbHeight;
		// Squish the thumb based on its overflow
		thumbHeight *= 1 / (1 + topOverflow * 20);
		thumbHeight *= 1 / (1 + bottomOverflow * 20);
		this.thumb.height = Math.floor(Math.max(MIN_THUMB_HEIGHT * this.scalingFactor, thumbHeight));

		let thumbPosition = completion * this.scaledHeight;
		thumbPosition = MathUtil.clamp(thumbPosition, 0, this.scaledHeight - thumbHeight);
		if (bottomOverflow > 0) thumbPosition = this.scaledHeight - thumbHeight; // Make sure the thing sticks to the bottom side
		this.thumb.y = Math.floor(thumbPosition);

		this.background.height = this.scaledHeight;
	}
}