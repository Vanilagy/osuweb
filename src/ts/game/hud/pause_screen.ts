import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT, uiEventEmitter } from "../../visuals/ui";
import { Interactivity, InteractionGroup } from "../../input/interactivity";
import { gameState } from "../game_state";
import { createPolygonTexture } from "../../util/pixi_util";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { colorToHexNumber } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";

const ACTION_PANEL_WIDTH = 336;
const ACTION_PANEL_HEIGHT = 52;

export function getPauseScreenScalingFactor() {
	return currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;
}

export class PauseScreen {
	public container: PIXI.Container;
	private background: PIXI.Sprite;
	private centerContainer: PIXI.Container;
	private heading: PIXI.Text;
	private actionPanels: PauseScreenActionPanel[];
	private interactionGroup: InteractionGroup;
	private fadeInterpolator: Interpolator;

    constructor() {
		this.container = new PIXI.Container();
		this.container.alpha = 0; // kinda temp? hack? cheap hack?
		
		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.9;
		this.container.addChild(this.background);

		this.centerContainer = new PIXI.Container();
		this.container.addChild(this.centerContainer);

		this.heading = new PIXI.Text("paused");
		this.centerContainer.addChild(this.heading);

		let resumePanel = new PauseScreenActionPanel("resume", colorToHexNumber(THEME_COLORS.PrimaryBlue));
		let restartPanel = new PauseScreenActionPanel("restart", colorToHexNumber(THEME_COLORS.PrimaryYellow));
		let quitPanel = new PauseScreenActionPanel("quit", colorToHexNumber(THEME_COLORS.PrimaryPink));
		this.actionPanels = [resumePanel, restartPanel, quitPanel];
		for (let panel of this.actionPanels) this.centerContainer.addChild(panel.container);

		this.interactionGroup = Interactivity.createGroup();
		this.interactionGroup.disable();
		resumePanel.setupInteraction(this.interactionGroup, () => {
			gameState.currentPlay.unpause();
		});
		restartPanel.setupInteraction(this.interactionGroup, () => {
			gameState.currentPlay.restart();
			this.hide();
		});
		quitPanel.setupInteraction(this.interactionGroup, () => {
			console.log("Not yet implemented!");
		});

		this.fadeInterpolator = new Interpolator({
			duration: 220,
			reverseDuration: 100,
			ease: EaseType.EaseOutCubic,
			beginReversed: true,
			defaultToFinished: true
		});

		uiEventEmitter.addListener('resize', () => this.resize()); // TODO make sure to destroy and remove dis somehow then when its due
		this.resize();
	}

    show() {
		this.fadeInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.enable();
    }

    hide() {
		this.fadeInterpolator.setReversedState(true, performance.now());
		this.interactionGroup.disable();
	}
	
	resize() {
		let scalingFactor = getPauseScreenScalingFactor();

		this.background.width = currentWindowDimensions.width;
		this.background.height = currentWindowDimensions.height;

		this.centerContainer.x = Math.floor(currentWindowDimensions.width / 2);
		this.centerContainer.y = Math.floor(currentWindowDimensions.height / 2);

		this.heading.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontSize: Math.floor(36 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.heading.y = Math.floor(-170 * scalingFactor);
		this.heading.pivot.x = Math.floor(this.heading.width / 2);

		for (let i = 0; i < this.actionPanels.length; i++) {
			let panel = this.actionPanels[i];
			panel.resize();
		}
	}

	update(now: number) {
		let scalingFactor = getPauseScreenScalingFactor();

		let fadeCompletion = this.fadeInterpolator.getCurrentValue(now);
		this.container.alpha = fadeCompletion;
		this.heading.x = -7 * (1 - fadeCompletion) * scalingFactor;
		if (fadeCompletion === 1) this.heading.x = Math.floor(this.heading.x);

		for (let i = 0; i < this.actionPanels.length; i++) {
			let panel = this.actionPanels[i];

			panel.update(now);
			panel.container.y = (-32 + 80 * i - MathUtil.lerp(10 + 15*i, 0, fadeCompletion)) * scalingFactor;
			if (fadeCompletion === 1) panel.container.y = Math.floor(panel.container.y);
		}
	}
}

class PauseScreenActionPanel {
	public container: PIXI.Container;
	private mask: PIXI.Sprite;
	private background: PIXI.Sprite;
	private topHighlight: PIXI.Sprite;
	private text: PIXI.Text;
	private hoverInterpolator: Interpolator;
	private pressdownInterpolator: Interpolator;

	constructor(description: string, color: number) {
		this.container = new PIXI.Container();

		this.mask = new PIXI.Sprite();
		this.container.addChild(this.mask);

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.alpha = 0.9;
		this.background.mask = this.mask;
		this.container.addChild(this.background);

		this.topHighlight = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.topHighlight.tint = color;
		this.topHighlight.mask = this.mask;
		this.container.addChild(this.topHighlight);

		this.text = new PIXI.Text(description);
		this.container.addChild(this.text);

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
	}

	resize() {
		let scalingFactor = getPauseScreenScalingFactor();
		let slantWidth = ACTION_PANEL_HEIGHT/5;

		this.mask.texture = createPolygonTexture(ACTION_PANEL_WIDTH + slantWidth, ACTION_PANEL_HEIGHT, [
			new PIXI.Point(0, 0), new PIXI.Point(ACTION_PANEL_WIDTH, 0), new PIXI.Point(ACTION_PANEL_WIDTH + slantWidth, ACTION_PANEL_HEIGHT), new PIXI.Point(slantWidth, ACTION_PANEL_HEIGHT)
		], scalingFactor);
		this.mask.x = -Math.floor((ACTION_PANEL_WIDTH + slantWidth)/2 * scalingFactor);

		this.background.width = Math.floor((ACTION_PANEL_WIDTH + slantWidth) * scalingFactor);
		this.background.height = Math.floor(ACTION_PANEL_HEIGHT * scalingFactor);
		this.background.x = this.mask.x;

		this.topHighlight.width = this.background.width;
		this.topHighlight.height = Math.floor(2 * scalingFactor);
		this.topHighlight.x = this.background.x;

		this.text.style = {
			fontFamily: 'Exo2-Light',
			fontStyle: 'italic',
			fill: 0xffffff,
			fontSize: Math.floor(17 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.text.pivot.x = Math.floor(this.text.width / 2);
		this.text.pivot.y = Math.floor(this.text.height / 2);
		this.text.y = Math.floor(ACTION_PANEL_HEIGHT/2 * scalingFactor);
	}

	update(now: number) {
		let scalingFactor = getPauseScreenScalingFactor();
		let hoverCompletion = this.hoverInterpolator.getCurrentValue(now);

		this.text.alpha = MathUtil.lerp(0.75, 1.0, hoverCompletion);

		this.container.pivot.x = 2 * scalingFactor * hoverCompletion;
		if (hoverCompletion === 1) this.container.pivot.x = Math.ceil(this.container.pivot.x);
		this.container.pivot.y = this.container.pivot.x;

		let pressdownCompletion = this.pressdownInterpolator.getCurrentValue(now);
		this.background.tint = Math.floor(MathUtil.lerp(15, 6, pressdownCompletion)) * 0x10101;
	}

	setupInteraction(group: InteractionGroup, onclick: () => any) {
		let registration = Interactivity.registerDisplayObject(this.container);
		group.add(registration);

		registration.addButtonHandlers(
			onclick,
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.pressdownInterpolator.setReversedState(false, performance.now()),
			() => this.pressdownInterpolator.setReversedState(true, performance.now())
		);
	}
}