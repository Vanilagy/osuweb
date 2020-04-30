import { BeatmapSetPanelDrawable } from "./beatmap_set_panel_drawable";
import { InteractionRegistration } from "../../../input/interactivity";
import { colorToHexNumber } from "../../../util/graphics_util";
import { DifficultyUtil } from "../../../datamodel/difficulty/difficulty_util";
import { getNormalizedOffsetOnCarousel } from "./beatmap_carousel";
import { getBeatmapDifficultyPanelMask, TEXTURE_MARGIN, getBeatmapDifficultyPanelGlowTexture, getDifficultyColorBar, drawStarRatingTicks } from "./beatmap_panel_components";
import { MathUtil } from "../../../util/math_util";
import { BeatmapDifficultyPanel, BEATMAP_DIFFICULTY_PANEL_WIDTH, BEATMAP_DIFFICULTY_PANEL_HEIGHT } from "./beatmap_difficulty_panel";

/** Used to draw beatmap difficulty panels. Just like for beatmap set panels, this drawable isn't bound to a specific difficulty. Instead, it is reassigned as needed to display any difficulty panel. */
export class BeatmapDifficultyPanelDrawable {
	public parent: BeatmapSetPanelDrawable;
	public container: PIXI.Container;
	public registration: InteractionRegistration;
	private panel: BeatmapDifficultyPanel;

	private infoContainer: PIXI.Container;
	private background: PIXI.Sprite;
	private mainMask: PIXI.Sprite;
	private primaryText: PIXI.Text;
	private starRatingTicksGraphics: PIXI.Graphics;
	private glowSprite: PIXI.Sprite;
	private colorBar: PIXI.Sprite;
	private lastStarRatingTicks: number; // Remember the last star rating that was drawn so that we don't draw the same thing twice

	constructor(parent: BeatmapSetPanelDrawable) {
		this.parent = parent;

		this.container = new PIXI.Container();
		this.container.sortableChildren = true;

		this.mainMask = new PIXI.Sprite();
		this.container.addChild(this.mainMask);

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.5;
		this.background.mask = this.mainMask;
		this.container.addChild(this.background);

		this.infoContainer = new PIXI.Container();
		this.primaryText = new PIXI.Text('');
		this.primaryText.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontStyle: 'italic'
		};
		this.starRatingTicksGraphics = new PIXI.Graphics();
		
		this.infoContainer.addChild(this.primaryText);
		this.infoContainer.addChild(this.starRatingTicksGraphics);
		this.container.addChild(this.infoContainer);

		this.glowSprite = new PIXI.Sprite();
		this.glowSprite.zIndex = -1;
		this.container.addChild(this.glowSprite);

		this.colorBar = new PIXI.Sprite();
		this.colorBar.mask = this.mainMask;
		this.infoContainer.addChild(this.colorBar);

		this.initInteractions();

		this.resize();
	}

	private initInteractions() {
		this.registration = new InteractionRegistration(this.container);
		this.parent.interactionGroup.add(this.registration);

		this.registration.addButtonHandlers(
			() => this.panel.select(),
			() => this.panel.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.panel.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.panel.pressDownInterpolator.setReversedState(false, performance.now()),
			() => this.panel.pressDownInterpolator.setReversedState(true, performance.now())
		);
	}

	bindPanel(panel: BeatmapDifficultyPanel) {
		this.panel = panel;
	}

	resize() {
		let scalingFactor = this.parent.carousel.scalingFactor;

		this.container.hitArea = new PIXI.Rectangle(0, 0, BEATMAP_DIFFICULTY_PANEL_WIDTH * scalingFactor, BEATMAP_DIFFICULTY_PANEL_HEIGHT * scalingFactor);

		this.background.width = BEATMAP_DIFFICULTY_PANEL_WIDTH * scalingFactor;
		this.background.height = BEATMAP_DIFFICULTY_PANEL_HEIGHT * scalingFactor;

		this.mainMask.texture = getBeatmapDifficultyPanelMask();
		this.mainMask.position.set(-TEXTURE_MARGIN * scalingFactor, -TEXTURE_MARGIN * scalingFactor);

		this.glowSprite.texture = getBeatmapDifficultyPanelGlowTexture();
		this.glowSprite.position.copyFrom(this.mainMask.position);

		this.primaryText.style.fontSize = Math.floor(16 * scalingFactor);
		this.primaryText.position.set(Math.floor(30 * scalingFactor), Math.floor(10 * scalingFactor));

		// Redraw the star rating
		if (this.lastStarRatingTicks) drawStarRatingTicks(this.starRatingTicksGraphics, this.lastStarRatingTicks, scalingFactor);
		this.starRatingTicksGraphics.y = Math.floor(35 * scalingFactor);
		this.starRatingTicksGraphics.x = Math.floor(30 * scalingFactor);

		this.colorBar.texture = getDifficultyColorBar();
	}

	update(now: number) {
		if (!this.panel) return;

		let scalingFactor = this.parent.carousel.scalingFactor;

		if (this.panel.entry?.extendedMetadata) {
			// Update text and star rating
			let newPrimaryText = this.panel.entry.extendedMetadata.version + ' ';

			if (this.primaryText.text !== newPrimaryText) this.primaryText.text = newPrimaryText;
			if (this.panel.entry.extendedMetadata.difficultyAttributes.starRating !== this.lastStarRatingTicks) {
				this.lastStarRatingTicks = this.panel.entry.extendedMetadata.difficultyAttributes.starRating;
				drawStarRatingTicks(this.starRatingTicksGraphics, this.lastStarRatingTicks, scalingFactor);
				
				this.colorBar.tint = colorToHexNumber(DifficultyUtil.getColorForStarRating(this.panel.entry.extendedMetadata.difficultyAttributes.starRating));
				this.glowSprite.tint = this.colorBar.tint;
			}
		}

		this.container.y = this.panel.currentNormalizedY * scalingFactor;

		this.infoContainer.alpha = this.panel.fadeInInterpolator.getCurrentValue(now);

		let normalizedY = this.container.getGlobalPosition().y / scalingFactor;
		this.container.x = getNormalizedOffsetOnCarousel((normalizedY + BEATMAP_DIFFICULTY_PANEL_HEIGHT/2) * scalingFactor) * scalingFactor;

		let expansionValue = this.panel.expandInterpolator.getCurrentValue(now);
		this.container.x += expansionValue * -40 * scalingFactor;

		let hoverValue = this.panel.hoverInterpolator.getCurrentValue(now) * MathUtil.lerp(1, 0.5, this.panel.expandInterpolator.getCurrentCompletion(now));
		this.container.x += hoverValue * -7 * scalingFactor;

		this.container.x = Math.floor(this.container.x);
		this.container.y = Math.floor(this.container.y);

		let bonusAlpha = this.panel.pressDownInterpolator.getCurrentValue(now) * 0.1;
		this.background.alpha = MathUtil.lerp(0.45, 0.8, expansionValue) + bonusAlpha;
		this.colorBar.alpha = 1 - expansionValue;

		if (expansionValue === 0) {
			this.glowSprite.visible = false;
		} else {
			this.glowSprite.visible = true;
			this.glowSprite.alpha = expansionValue;
		}

		if (this.parent.panel.isExpanded) {
			this.registration.enable();
		} else {
			this.registration.disable();
		}
	}
}