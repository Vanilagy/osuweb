import { EaseType, MathUtil } from "../../../util/math_util";
import { getDarkeningOverlay, getBeatmapSetPanelMask, TEXTURE_MARGIN, getBeatmapSetPanelGlowTexture, drawStarRatingTicks } from "./beatmap_panel_components";
import { InteractionRegistration, InteractionGroup } from "../../../input/interactivity";
import { fitSpriteIntoContainer } from "../../../util/pixi_util";
import { shallowObjectClone, last } from "../../../util/misc_util";
import { BeatmapSetPanel, BEATMAP_SET_PANEL_WIDTH, BEATMAP_SET_PANEL_HEIGHT } from "./beatmap_set_panel";
import { BeatmapDifficultyPanelDrawable } from "./beatmap_difficulty_panel_drawable";
import { BeatmapCarousel, getNormalizedOffsetOnCarousel } from "./beatmap_carousel";
import { MouseButton } from "../../../input/input";

/** The drawable for beatmap set panels. Note that this drawable doesn't belong to a single beatmap set panel, but instead can be dynamically reassigned to display any panel that you bind to it. */
export class BeatmapSetPanelDrawable {
	public carousel: BeatmapCarousel;
	public panel: BeatmapSetPanel;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;

	private panelContainer: PIXI.Container;
	private mainMask: PIXI.Sprite;
	private darkening: PIXI.Sprite;
	private glowSprite: PIXI.Sprite;

	// In order to allow for fading text, we have two versions (A and B) for each text. B will usually be shown, but during a transition phase, A will be visible too.
	private primaryTextA: PIXI.Text;
	private primaryTextB: PIXI.Text;
	private secondaryTextA: PIXI.Text;
	private secondaryTextB: PIXI.Text;
	private starRatingGraphics: PIXI.Graphics;
	private lastStarRating: number;

	private backgroundImageSprite: PIXI.Sprite;
	private brightnessLayer: PIXI.Sprite;

	private difficultyContainer: PIXI.Container;
	private difficultyPanels: BeatmapDifficultyPanelDrawable[] = [];

	constructor(carousel: BeatmapCarousel) {
		this.carousel = carousel;
		this.container = new PIXI.Container();
		this.container.sortableChildren = true;
		this.interactionGroup = new InteractionGroup();
		this.interactionGroup.disable();

		this.difficultyContainer = new PIXI.Container();
		this.difficultyContainer.sortableChildren = true;
		this.difficultyContainer.zIndex = -2;
		this.container.addChild(this.difficultyContainer);

		this.panelContainer = new PIXI.Container();
		this.container.addChild(this.panelContainer);

		this.backgroundImageSprite = new PIXI.Sprite();
		this.backgroundImageSprite.width = 200;
		this.backgroundImageSprite.height = 200;
		this.panelContainer.addChild(this.backgroundImageSprite);

		this.brightnessLayer = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.brightnessLayer.blendMode = PIXI.BLEND_MODES.ADD;
		this.panelContainer.addChild(this.brightnessLayer);

		this.darkening = new PIXI.Sprite();
		this.darkening.y = -1;
		this.panelContainer.addChild(this.darkening);

		this.primaryTextA = new PIXI.Text('');
		this.primaryTextA.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontStyle: 'italic',
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.primaryTextB = new PIXI.Text('');
		this.primaryTextB.style = this.primaryTextA.style;

		this.secondaryTextA = new PIXI.Text('');
		this.secondaryTextA.style = shallowObjectClone(this.primaryTextA.style);
		this.secondaryTextB = new PIXI.Text('');
		this.secondaryTextB.style = this.secondaryTextA.style;

		this.starRatingGraphics = new PIXI.Graphics();

		this.panelContainer.addChild(this.primaryTextA, this.primaryTextB, this.secondaryTextA, this.secondaryTextB, this.starRatingGraphics);

		this.glowSprite = new PIXI.Sprite();
		this.glowSprite.zIndex = -1;
		this.container.addChild(this.glowSprite);

		this.mainMask = new PIXI.Sprite();
		this.panelContainer.addChildAt(this.mainMask, 0);
		this.panelContainer.mask = this.mainMask;
		
		this.initInteractions();
		this.bindPanel(null);
	}

	bindPanel(panel: BeatmapSetPanel) {
		if (panel === this.panel) return;

		this.interactionGroup.releaseAllPresses(); // We might still be holding it down, or something. Make sure it's released!
		this.panel = panel;
	}

	private initInteractions() {
		let registration = new InteractionRegistration(this.panelContainer);
		registration.setZIndex(2); // Above the difficulty panels
		registration.allowAllMouseButtons();
		this.interactionGroup.add(registration);

		registration.addButtonHandlers(
			() => this.panel.select(0),
			() => this.panel.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.panel.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.panel.mouseDownBrightnessInterpolator.setReversedState(false, performance.now()),
			() => this.panel.mouseDownBrightnessInterpolator.setReversedState(true, performance.now())
		);
		registration.addListener('mouseDown', (e) => {
			if (e.button !== MouseButton.Right) return;
			this.panel.showContextMenu();
		});
	}

	resize() {
		let scalingFactor = this.carousel.scalingFactor;

		this.panelContainer.hitArea = new PIXI.Rectangle(0, 0, BEATMAP_SET_PANEL_WIDTH * scalingFactor, BEATMAP_SET_PANEL_HEIGHT * scalingFactor);

		this.mainMask.texture = getBeatmapSetPanelMask();
		this.mainMask.pivot.set(TEXTURE_MARGIN * scalingFactor, TEXTURE_MARGIN * scalingFactor);

		this.glowSprite.texture = getBeatmapSetPanelGlowTexture();
		this.glowSprite.pivot.copyFrom(this.mainMask.pivot);

		this.difficultyContainer.x = Math.floor(50 * scalingFactor);
		
		fitSpriteIntoContainer(this.backgroundImageSprite, BEATMAP_SET_PANEL_WIDTH * scalingFactor, BEATMAP_SET_PANEL_HEIGHT * scalingFactor, new PIXI.Point(0.0, 0.25));

		this.darkening.texture = getDarkeningOverlay();

		this.brightnessLayer.y = -1;
		this.brightnessLayer.width = BEATMAP_SET_PANEL_WIDTH * scalingFactor;
		this.brightnessLayer.height = BEATMAP_SET_PANEL_HEIGHT * scalingFactor + 1;

		// Update all the text stuff
		this.primaryTextA.style.fontSize = Math.floor(22 * scalingFactor);
		this.primaryTextA.position.set(Math.floor(35 * scalingFactor), Math.floor(10 * scalingFactor));
		this.primaryTextB.position.copyFrom(this.primaryTextA.position);
		this.secondaryTextA.style.fontSize = Math.floor(14 * scalingFactor);
		this.secondaryTextA.position.set(Math.floor(35 * scalingFactor), Math.floor(35 * scalingFactor));
		this.secondaryTextB.position.copyFrom(this.secondaryTextA.position);

		this.starRatingGraphics.position.set(Math.floor(35 * scalingFactor), Math.floor(80 * scalingFactor));
		this.updateStarRatingTicks(true);

		for (let i = 0; i < this.difficultyPanels.length; i++) {
			this.difficultyPanels[i].resize();
		}
	}

	private updateStarRatingTicks(forceDraw = false) {
		if (!this.panel) return;

		if (this.panel.showStarRating && this.panel.beatmapSet.metadataLoaded) {
			// If this panel is flagged to display star rating, and the connected beatmap set has its metadata loaded, go and display the star rating of the FIRST difficulty.

			let firstEntry = this.panel.beatmapEntries[0];
			let starRating = firstEntry.extendedMetadata.difficultyAttributes.starRating;

			if (starRating === this.lastStarRating && !forceDraw) return;
			this.lastStarRating = starRating;

			drawStarRatingTicks(this.starRatingGraphics, starRating, this.panel.carousel.scalingFactor);
			this.starRatingGraphics.visible = true;
		} else {
			this.starRatingGraphics.visible = false;
		}
	}

	update(now: number) {
		if (!this.panel) {
			this.container.visible = false;
			this.interactionGroup.disable();
			return;
		} else {
			this.container.visible = true;
			this.interactionGroup.enable();
		}

		// Scale in the panel vertically
		let fadeInCompletion = this.panel.fadeInInterpolator.getCurrentValue(now);
		let fadingOut = this.panel.fadeInInterpolator.isReversed();
		this.container.scale.set(1, this.panel.getScaleInValue(now));
		this.container.alpha = MathUtil.ease(fadingOut? EaseType.EaseInQuad : EaseType.EaseOutQuint, fadeInCompletion);
		if (fadingOut) this.interactionGroup.disable();

		let scalingFactor = this.carousel.scalingFactor;

		this.container.y = this.panel.storedY * scalingFactor;

		// All these checks are to avoid drawing more text than we need to
		if (this.panel.primaryTextA !== null && this.primaryTextA.text !== this.panel.primaryTextA) this.primaryTextA.text = this.panel.primaryTextA;
		if (this.panel.primaryTextB !== null && this.primaryTextB.text !== this.panel.primaryTextB) this.primaryTextB.text = this.panel.primaryTextB;
		if (this.panel.secondaryTextA !== null && this.secondaryTextA.text !== this.panel.secondaryTextA) this.secondaryTextA.text = this.panel.secondaryTextA;
		if (this.panel.secondaryTextB !== null && this.secondaryTextB.text !== this.panel.secondaryTextB) this.secondaryTextB.text = this.panel.secondaryTextB;

		// Set the alpha to achieve a fade effect
		let primaryTextFade = this.panel.primaryTextInterpolator.getCurrentValue(now);
		let secondaryTextFade = this.panel.secondaryTextInterpolator.getCurrentValue(now);
		this.primaryTextA.alpha = 1 - primaryTextFade;
		this.primaryTextB.alpha = primaryTextFade;
		this.secondaryTextA.alpha = 1 - secondaryTextFade;
		this.secondaryTextB.alpha = secondaryTextFade;

		this.updateStarRatingTicks();

		if (this.panel.imageTexture) {
			this.backgroundImageSprite.texture = this.panel.imageTexture;
			fitSpriteIntoContainer(this.backgroundImageSprite, BEATMAP_SET_PANEL_WIDTH * scalingFactor, BEATMAP_SET_PANEL_HEIGHT * scalingFactor, new PIXI.Point(0.0, 0.25));
		}
		else this.backgroundImageSprite.texture = PIXI.Texture.EMPTY;
		this.backgroundImageSprite.alpha = this.panel.imageFadeIn.getCurrentValue(now);
		
		let expansionValue = this.panel.expandInterpolator.getCurrentValue(now);

		this.panelContainer.x = 0;
		this.panelContainer.x -= 95 * expansionValue * scalingFactor;
		this.panelContainer.x += getNormalizedOffsetOnCarousel((this.panel.storedY + BEATMAP_SET_PANEL_HEIGHT/2) * scalingFactor)  * scalingFactor;

		let hoverValue = this.panel.hoverInterpolator.getCurrentValue(now) * MathUtil.lerp(1, 0.2, this.panel.expandInterpolator.getCurrentCompletion(now));
		this.panelContainer.x += hoverValue * -15 * scalingFactor;

		this.brightnessLayer.alpha = MathUtil.lerp(0.0, 0.1, this.panel.mouseDownBrightnessInterpolator.getCurrentValue(now));

		this.container.x = Math.floor(this.container.x);
		this.container.y = Math.floor(this.container.y);

		if (expansionValue === 0) {
			this.glowSprite.visible = false;
		} else {
			this.glowSprite.visible = true;
			this.glowSprite.alpha = expansionValue;
			this.glowSprite.x = this.panelContainer.x;
		}

		// If we don't have enough difficulty drawables, add some
		while (this.difficultyPanels.length < this.panel.difficultyPanels.length) {
			let newDrawable = new BeatmapDifficultyPanelDrawable(this);
			this.difficultyContainer.addChild(newDrawable.container);
			this.difficultyPanels.push(newDrawable);
		}

		// If we have too many difficulty drawables, remove some
		while (this.difficultyPanels.length > this.panel.difficultyPanels.length) {
			let lastPanel = last(this.difficultyPanels);

			this.difficultyContainer.removeChild(lastPanel.container);
			this.difficultyPanels.pop();
			lastPanel.registration.detach();
		}

		// At this point we'll have just the right amount of difficulty drawables. Go update them.
		for (let i = 0; i < this.panel.difficultyPanels.length; i++) {
			let drawable = this.difficultyPanels[i];
			drawable.bindPanel(this.panel.difficultyPanels[i]);
			drawable.container.zIndex = -i;
		}
		
		for (let drawable of this.difficultyPanels) {
			if (!drawable.container.visible && expansionValue === 0) continue; // No need to update invisible difficulty panels

			drawable.update(now);
			if (!this.panel.isExpanded) {
				drawable.container.alpha = expansionValue;
				drawable.registration.disable();
			} else {
				drawable.container.alpha = MathUtil.lerp(0.8, 1.0, expansionValue); // Just a slight fade-in
				drawable.registration.enable();
			}

			drawable.container.visible = drawable.container.alpha > 0;
		}
	}
}