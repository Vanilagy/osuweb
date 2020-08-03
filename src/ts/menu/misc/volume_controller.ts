import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { createPolygonTexture } from "../../util/pixi_util";
import { colorToHexNumber, Colors, lerpColors } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";
import { InterpolatedValueChanger, Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { settingsDescription } from "../settings/settings_description";
import { globalState } from "../../global_state";
import { getCurrentMousePosition } from "../../input/input";
import { changeSettingAndUpdateSettingsPanel } from "../settings/settings";
import { EMPTY_FUNCTION } from "../../util/misc_util";

type VolumeSetting = 'masterVolume' | 'musicVolume' | 'soundEffectsVolume';

const WIDTH = 300;
const HEIGHT = 165;
const SLIDER_WIDTH = 243;
const SLIDER_HEIGHT = 20;
const MARGIN = 20;
const NUDGE_VALUE = 0.05;

export class VolumeController {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number;

	private background: PIXI.Sprite;
	private sliders: VolumeSlider[] = [];
	private fadeInInterpolator: Interpolator;
	private appearTime: number = -Infinity;
	private registration: InteractionRegistration;
	
	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.background = new PIXI.Sprite();
		this.background.tint = 0x000000;
		this.background.alpha = 0.8;
		this.container.addChild(this.background);

		let masterSlider = new VolumeSlider(this, 'masterVolume');
		let musicSlider = new VolumeSlider(this, 'musicVolume');
		let soundEffectsSlider = new VolumeSlider(this, 'soundEffectsVolume');
		this.sliders = [masterSlider, musicSlider, soundEffectsSlider];

		let backgroundRegistration = new InteractionRegistration(this.background);
		backgroundRegistration.enableEmptyListeners(['keyDown', 'keyUp']);
		this.interactionGroup.add(backgroundRegistration);
		this.registration = backgroundRegistration;

		for (let s of this.sliders) {
			this.container.addChild(s.container);
			this.interactionGroup.add(s.interactionGroup);
		}

		this.fadeInInterpolator = new Interpolator({
			duration: 400,
			reverseDuration: 300,
			ease: EaseType.EaseOutElasticHalf,
			reverseEase: EaseType.EaseInCubic,
			beginReversed: true,
			defaultToFinished: true
		});

		this.resize();
		this.hide();
	}

	resize() {
		this.scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;

		let slantWidth = HEIGHT/5;
		this.background.texture = createPolygonTexture(WIDTH + slantWidth, HEIGHT, [
			new PIXI.Point(0, 0), new PIXI.Point(WIDTH, 0), new PIXI.Point(WIDTH + slantWidth, HEIGHT), new PIXI.Point(slantWidth, HEIGHT)
		], this.scalingFactor, 0, false, 3);

		let currentY = 13 * this.scalingFactor;
		for (let s of this.sliders) {
			s.resize();
			s.container.y = Math.floor(currentY);
			s.container.x = Math.floor(43 * this.scalingFactor);

			currentY += 50 * this.scalingFactor;
		}

		this.container.pivot.x = Math.floor(this.background.width / 2);
		this.container.pivot.y = Math.floor(this.background.height / 2);
		this.container.y = currentWindowDimensions.height - Math.floor(this.background.height/2 + MARGIN * this.scalingFactor);
	}

	update(now: number) {
		let fadeInValue = this.fadeInInterpolator.getCurrentValue(now);
		this.container.scale.set(MathUtil.lerp(0.8, 1.0, fadeInValue));
		this.container.x = currentWindowDimensions.width - Math.floor(this.background.width/2 + MARGIN * this.scalingFactor) + MathUtil.lerp(100, 0, fadeInValue);
		this.container.alpha = MathUtil.clamp(fadeInValue, 0, 1);

		for (let s of this.sliders) s.update(now);

		if (this.registration.mouseInside) this.appearTime = now;
		if (now - this.appearTime > 1000) this.hide();
	}

	show() {
		let now = performance.now();

		this.fadeInInterpolator.setReversedState(false, now);
		this.interactionGroup.enable();
		this.appearTime = now;
	}

	hide() {
		this.fadeInInterpolator.setReversedState(true, performance.now());
		this.interactionGroup.disable();
	}

	/** Change the currently hovered-over slider by a small amount. If no slider is hovered, change master. */
	nudgeValue(up: boolean) {
		this.show();

		let setting: VolumeSetting = 'masterVolume';
		for (let s of this.sliders) {
			if (s.mouseInside()) setting = s.setting;
		}

		let newValue = MathUtil.clamp(globalState.settings[setting] + NUDGE_VALUE * (up? 1 : -1), 0, 1);
		changeSettingAndUpdateSettingsPanel(setting, newValue);
	}
}

class VolumeSlider {
	private parent: VolumeController;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public setting: VolumeSetting;

	private label: PIXI.Text;
	private mask: PIXI.Sprite;
	private background: PIXI.Sprite;
	private slider: PIXI.Sprite;
	private registration: InteractionRegistration;

	private valueInterpolator: InterpolatedValueChanger;
	private hoverInterpolator: Interpolator;
	private pressdownInterpolator: Interpolator;

	constructor(parent: VolumeController, setting: VolumeSetting) {
		this.parent = parent;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
		this.interactionGroup.passThrough = true;
		this.setting = setting;

		this.label = new PIXI.Text(settingsDescription[setting].displayName.toUpperCase(), {
			fontFamily: 'Exo2-Bold',
			fill: 0xffffff
		});
		this.label.alpha = 0.9;

		this.mask = new PIXI.Sprite();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.8;
		this.background.mask = this.mask;
		
		this.slider = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.slider.mask = this.mask;

		this.container.addChild(this.label, this.mask, this.background, this.slider);

		this.valueInterpolator = new InterpolatedValueChanger({
			initial: 0,
			duration: 150,
			ease: EaseType.EaseOutCubic
		});
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

		this.registration = new InteractionRegistration(this.background);
		this.interactionGroup.add(this.registration);
		
		this.registration.addButtonHandlers(
			EMPTY_FUNCTION,
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			EMPTY_FUNCTION,
			EMPTY_FUNCTION
		)
		this.registration.makeDraggable(() => {
			this.pressdownInterpolator.setReversedState(false, performance.now());
			updateSliderPosition();
		}, () => {
			updateSliderPosition();
		}, () => {
			this.pressdownInterpolator.setReversedState(true, performance.now());
		});

		const updateSliderPosition = () => {
			let mousePos = getCurrentMousePosition();
			let bounds = this.background.getBounds();

			let completion = MathUtil.clamp((mousePos.x - bounds.x) / bounds.width, 0, 1);
			changeSettingAndUpdateSettingsPanel(this.setting, completion);
		};
	}

	resize() {
		this.label.style.fontSize = Math.floor(9 * this.parent.scalingFactor);

		let slantWidth = SLIDER_HEIGHT / 5;
		this.mask.texture = createPolygonTexture(SLIDER_WIDTH + slantWidth, SLIDER_HEIGHT, [
			new PIXI.Point(0, 0), new PIXI.Point(SLIDER_WIDTH, 0), new PIXI.Point(SLIDER_WIDTH + slantWidth, SLIDER_HEIGHT), new PIXI.Point(slantWidth, SLIDER_HEIGHT)
		], this.parent.scalingFactor, 0, false, 3);

		this.background.width = this.mask.width;
		this.background.height = this.mask.height;
		this.slider.height = this.mask.height;
		this.background.y = this.slider.y = this.mask.y = Math.floor(16 * this.parent.scalingFactor);
	}

	update(now: number) {
		let settingValue = globalState.settings[this.setting];
		if (this.valueInterpolator.getCurrentGoal() !== settingValue) {
			// Smoothly interpolate to the new value
			this.valueInterpolator.setGoal(settingValue, now);
		}

		let currentValue = this.valueInterpolator.getCurrentValue(now);
		this.slider.width = currentValue * this.mask.width;

		let hoverValue = this.hoverInterpolator.getCurrentValue(now);
		let pressdownValue = this.pressdownInterpolator.getCurrentValue(now);

		this.slider.tint = colorToHexNumber(lerpColors(THEME_COLORS.PrimaryViolet, Colors.White, MathUtil.lerp(MathUtil.lerp(0.2, 0.6, hoverValue), 1.0, pressdownValue)));
	}

	mouseInside() {
		return this.registration.mouseInside;
	}
}