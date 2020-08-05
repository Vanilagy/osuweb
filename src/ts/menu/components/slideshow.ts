import { VirtualFile } from "../../file_system/virtual_file";
import { InterpolatedValueChanger, Interpolator } from "../../util/interpolation";
import { EaseType } from "../../util/math_util";
import { fitSpriteIntoContainer } from "../../util/pixi_util";
import { hasBitmapFromImageFile, BitmapQuality, getBitmapFromImageFile } from "../../util/image_util";

/** Represents one image in the slideshow. */
interface Tile {
	wrapper: PIXI.Container,
	sprite: PIXI.Sprite,
	mask: PIXI.Sprite,
	fadeIn: Interpolator
}

export class Slideshow {
	public container: PIXI.Container;

	private width = 100;
	private height = 100;

	private currentTileTarget = 0;
	private tiles: Map<number, Tile> = new Map();
	private slidingInterpolator: InterpolatedValueChanger;
	private mask: PIXI.Sprite;

	constructor() {
		this.container = new PIXI.Container();
		this.slidingInterpolator = new InterpolatedValueChanger({
			initial: 0,
			duration: 500,
			ease: EaseType.EaseOutCubic
		});

		this.mask = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.container.mask = this.mask;
		this.container.addChild(this.mask);
	}

	resize(width: number, height: number) {
		this.width = width;
		this.height = height;

		// Remove and add, because pixi's kinda buggy with masks here? Weird.
		this.container.removeChild(this.mask);
		this.container.addChild(this.mask);
		this.mask.width = width;
		this.mask.height = height;

		this.tiles.forEach(tile => this.resizeTile(tile));
	}

	put(imageFile: VirtualFile) {
		this.slide(imageFile, 0);
	}

	slideLeft(imageFile: VirtualFile) {
		this.slide(imageFile, -1);
	}

	slideRight(imageFile: VirtualFile) {
		this.slide(imageFile, 1);
	}

	private async slide(imageFile: VirtualFile, direction: number) {
		let newTargetIndex = this.currentTileTarget + direction;

		if (!this.tiles.get(newTargetIndex)) {
			// Create a new tile

			let wrapper = new PIXI.Container();
			let sprite = new PIXI.Sprite();

			wrapper.addChild(sprite);

			let mask = new PIXI.Sprite(PIXI.Texture.WHITE);
			wrapper.mask = mask;
			wrapper.addChild(mask);

			let newTile: Tile = {
				wrapper: wrapper,
				sprite: sprite,
				mask: mask,
				fadeIn: new Interpolator({
					duration: 150,
					ease: EaseType.EaseOutQuad
				})
			};

			this.tiles.set(newTargetIndex, newTile);
			this.resizeTile(newTile);
			this.container.addChild(wrapper);
		}

		let tile = this.tiles.get(newTargetIndex);
		this.slidingInterpolator.setGoal(newTargetIndex, performance.now());
		this.currentTileTarget = newTargetIndex;

		if (imageFile) {
			if (hasBitmapFromImageFile(imageFile, BitmapQuality.Medium)) {
				// If the image bitmap already exists, load it instantly without a fade-in animation.
				let bitmap = await getBitmapFromImageFile(imageFile, BitmapQuality.Medium);
				tile.sprite.texture = PIXI.Texture.from(bitmap as any);
				tile.fadeIn.end();
			} else {
				// Otherwise, play a short fade-in animation.
				let bitmap = await getBitmapFromImageFile(imageFile, BitmapQuality.Medium);
				tile.sprite.texture = PIXI.Texture.from(bitmap as any);
				tile.fadeIn.start(performance.now());
			}
		} else {
			tile.sprite.texture = PIXI.Texture.EMPTY;
		}

		this.resizeTile(tile);
	}

	update(now: number) {
		let slidingPos = this.slidingInterpolator.getCurrentValue(now);
		let slidingOffset = -slidingPos * this.width; // Move all tiles by this amount in the x direction

		for (let [index, tile] of this.tiles) {
			let position = index * this.width + slidingOffset;
			tile.wrapper.x = position;
			tile.sprite.alpha = tile.fadeIn.getCurrentValue(now);
		}

		if (slidingPos === this.currentTileTarget && this.tiles.size > 1) {
			// Incase we've reached the target, and there is more than one tile, we can now "clean up" the slideshow, by removing all other tiles (they aren't visible anyway), and moving the focused tile into the center.

			let tile = this.tiles.get(this.currentTileTarget);
			this.container.removeChildren();
			this.tiles.clear();

			this.container.addChild(tile.wrapper);
			this.tiles.set(0, tile);
			this.currentTileTarget = 0;
			this.slidingInterpolator.reset(0);
		}

		this.resize(this.width, this.height); // Done out of frustration because of some PIXI mask bug. Isn't actually too taxing on performance, so it's fine!
	}

	private resizeTile(tile: Tile) {
		fitSpriteIntoContainer(tile.sprite, this.width, this.height);

		tile.wrapper.removeChild(tile.mask);
		tile.wrapper.addChild(tile.mask);
		tile.mask.width = this.width;
		tile.mask.height = this.height;
	}
}