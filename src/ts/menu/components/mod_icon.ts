import { createPolygonTexture } from "../../util/pixi_util";
import { colorToHexNumber, lerpColors, Colors } from "../../util/graphics_util";
import { Mod, modColors, modLongNames } from "../../datamodel/mods";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { CustomEventEmitter } from "../../util/custom_event_emitter";

const MOD_ICON_REFERENCE_HEIGHT = 100;

export class ModIcon extends CustomEventEmitter<{clicked: void}> {
	public container: PIXI.Container;

	private mainContainer: PIXI.Container;
	private background: PIXI.Sprite;
	private text: PIXI.Text;

	// Text underneath the icon showing the full name of the mod
	private label: PIXI.Text = null;

	private selectionCycle: Mod[];
	private currentlySelectedIndex: number = null;
	private currentMod: Mod = null;

	private lastScalingFactor: number = 1.0;
	private lastResolution: number = 1.0;
	private hoverInterpolator: Interpolator;
	private selectInterpolator: Interpolator;
	private selectTextInterpolator: Interpolator;

	constructor(mod?: Mod) {
		super();

		this.container = new PIXI.Container();

		this.mainContainer = new PIXI.Container();
		this.container.addChild(this.mainContainer);

		this.background = new PIXI.Sprite();
		this.mainContainer.addChild(this.background);

		this.text = new PIXI.Text('');
		this.text.style = {
			fontFamily: 'FredokaOne-Regular',
			fill: 0x000000 ?? colorToHexNumber({r: 55, g: 55, b: 55})
		};
		this.text.alpha = 0.75;
		this.mainContainer.addChild(this.text);

		if (mod !== undefined) this.setMod(mod);

		this.hoverInterpolator = new Interpolator({
			duration: 150,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});
		this.selectInterpolator = new Interpolator({
			duration: 400,
			ease: EaseType.EaseOutElastic,
			p: 0.3,
			reverseEase: EaseType.EaseInElastic,
			beginReversed: true,
			defaultToFinished: true
		});
		this.selectTextInterpolator = new Interpolator({
			duration: 400,
			ease: EaseType.EaseOutQuint,
			reverseEase: EaseType.EaseInCubic,
			beginReversed: true,
			defaultToFinished: true
		});
	}

	private setMod(mod: Mod) {
		this.text.text = mod;
		//this.background.tint = colorToHexNumber(modColors.get(mod));
	
		if (this.label) {
			this.label.text = modLongNames.get(mod).toLowerCase();
			this.label.pivot.x = Math.floor(this.label.width / 2);
		}

		this.currentMod = mod;
	}

	resize(height: number, resolution: number) {
		let scalingFactor = height / MOD_ICON_REFERENCE_HEIGHT;
		this.lastScalingFactor = scalingFactor;
		this.lastResolution = resolution;
		let slantWidth = height/5;

		this.mainContainer.pivot.x = Math.floor((MOD_ICON_REFERENCE_HEIGHT + slantWidth) / 2 * scalingFactor);
		this.mainContainer.pivot.y = Math.floor(MOD_ICON_REFERENCE_HEIGHT / 2 * scalingFactor);
		this.mainContainer.position.copyFrom(this.mainContainer.pivot);
		this.mainContainer.pivot.x *= resolution;
		this.mainContainer.pivot.y *= resolution;

		this.background.texture = createPolygonTexture(MOD_ICON_REFERENCE_HEIGHT + slantWidth, MOD_ICON_REFERENCE_HEIGHT, [
			new PIXI.Point(0, 0), new PIXI.Point(MOD_ICON_REFERENCE_HEIGHT, 0), new PIXI.Point(MOD_ICON_REFERENCE_HEIGHT + slantWidth, MOD_ICON_REFERENCE_HEIGHT), new PIXI.Point(slantWidth, MOD_ICON_REFERENCE_HEIGHT)
		], scalingFactor, 0, false, 20, resolution);

		this.text.style.fontSize = Math.floor(50 * scalingFactor * resolution);
		this.text.pivot.x = Math.floor(this.text.width/2 * 1.03);
		this.text.pivot.y = Math.floor(this.text.height/2);
		this.text.x = Math.floor((MOD_ICON_REFERENCE_HEIGHT + slantWidth) / 2 * scalingFactor * resolution);
		this.text.y = Math.floor(MOD_ICON_REFERENCE_HEIGHT / 2 * scalingFactor * resolution);

		if (this.label) {
			this.label.style.fontSize = Math.floor(25 * scalingFactor);
			this.label.pivot.x = Math.floor(this.label.width / 2);
			this.label.x = Math.floor((MOD_ICON_REFERENCE_HEIGHT + slantWidth) / 2 * scalingFactor);
			this.label.y = Math.floor(115 * scalingFactor);
		}
	}

	update(now: number) {
		let scalingFactor = this.lastScalingFactor;
		let hoverCompletion = this.hoverInterpolator.getCurrentValue(now);

		this.container.pivot.y = 3 * hoverCompletion * scalingFactor;
		if (hoverCompletion === 1) this.container.pivot.y = Math.ceil(this.container.pivot.y);

		let selectCompletion = this.selectInterpolator.getCurrentValue(now);
		this.mainContainer.scale.set(MathUtil.lerp(1.0, 1.15, selectCompletion) / this.lastResolution);

		if (this.label) {
			let selectTextCompletion = this.selectTextInterpolator.getCurrentValue(now);
			this.label.alpha = MathUtil.lerp(MathUtil.lerp(0.3, 0.5, hoverCompletion), 1.0, selectTextCompletion);
		}

		let rawColor = modColors.get(this.currentMod);
		this.background.tint = colorToHexNumber(lerpColors(rawColor, Colors.White, selectCompletion * 0.17));
	}
	
	enableLabel() {
		this.label = new PIXI.Text('');
		this.label.style = {
			fontFamily: 'FredokaOne-Regular',
			fill: 0xffffff
		};
		this.container.addChild(this.label);
	}

	enableInteraction(group: InteractionGroup, selectionCycle: Mod[]) {
		this.selectionCycle = selectionCycle;
		if (selectionCycle.length > 0) this.setMod(selectionCycle[0]);

		let registration = new InteractionRegistration(this.background);
		group.add(registration);

		registration.addListener('mouseEnter', () => {
			this.hoverInterpolator.setReversedState(false, performance.now());
		});
		registration.addListener('mouseLeave', () => {
			this.hoverInterpolator.setReversedState(true, performance.now());
		});
		registration.addListener('mouseDown', () => {
			this.trigger();
			this.emit('clicked');
		});
	}

	private trigger() {
		if (this.selectionCycle.length === 0) return;

		let nextIndex: number;
		if (this.currentlySelectedIndex === null) nextIndex = 0;
		else if (this.currentlySelectedIndex < this.selectionCycle.length-1) nextIndex = this.currentlySelectedIndex + 1;
		else nextIndex = null;

		let mod: Mod = this.selectionCycle[0];
		if (nextIndex !== null) mod = this.selectionCycle[nextIndex];
		this.setMod(mod);

		this.selectInterpolator.setReversedState(nextIndex === null, performance.now());
		this.selectInterpolator.start(performance.now());
		this.selectTextInterpolator.setReversedState(nextIndex === null, performance.now());

		this.currentlySelectedIndex = nextIndex;
	}

	deselect() {
		if (this.currentlySelectedIndex === null) return;

		this.currentlySelectedIndex = this.selectionCycle.length-1;
		this.trigger();
	}

	getCurrentlySelectedMod() {
		if (this.currentlySelectedIndex === null) return null;
		return this.selectionCycle[this.currentlySelectedIndex];
	}
}