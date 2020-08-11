import { InteractionGroup } from "../../input/interactivity";
import { PopupFrame } from "../components/popup_frame";
import { THEME_COLORS } from "../../util/constants";
import { Color, colorToHexNumber } from "../../util/graphics_util";
import { removeItem, jsonClone } from "../../util/misc_util";

type PopupButtonDescription = {action: string, label: string, color: Color}[];

class Popup extends PopupFrame {
	/** A red warning element below the description. Doesn't have to be used! */
	private warning: PIXI.Text;
	private warningString: string;

	private actionOnClose: string;
	private callback: (action: string) => any;

	constructor(header: string, description: string, warning: string, buttons: PopupButtonDescription, actionOnClose: string, actionCallback: (action: string) => any) {
		super({
			width: 400,
			height: 300,
			headerText: header,
			descriptionText: description,
			enableCloseButton: false,
			buttons: buttons.map(x => {
				return {
					label: x.label,
					color: x.color,
					onclick: () => actionCallback(x.action)
				};
			})
		});

		this.warning = new PIXI.Text(warning ?? '');
		this.warningString = warning;
		this.centerContainer.addChild(this.warning);

		this.actionOnClose = actionOnClose;
		this.callback = actionCallback;

		this.resize();
		this.hide();
	}

	resize() {
		super.resize();

		this.warning.style = jsonClone(this.description.style);
		this.warning.tint = colorToHexNumber(THEME_COLORS.JudgementMiss);
		this.warning.y = this.warningString? this.description.y + this.description.height + Math.floor(24 * this.scalingFactor) : 0;

		let height = Math.max(this.description.y + this.description.height, this.warning.y + this.warning.height) / this.scalingFactor + 24;
		this.options.height = height;

		super.resize();
	}

	update(now: number) {
		super.update(now);

		this.warning.x = this.description.x;
		return true;
	}

	triggerClose() {
		if (!this.actionOnClose) return;
		this.hide();
		this.callback(this.actionOnClose);
	}
}

export enum ConfirmDialogueHighlighting {
	HighlightNone,
	HighlightYes,
	HighlightNo,
	HighlightBoth
}

/** A simple utility class for showing Promise-based popups and confirmation dialogues. */
export class PopupManager {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	private popups: Popup[] = [];

	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
	}

	resize() {
		for (let p of this.popups) p.resize();
	}

	update(now: number) {
		for (let p of this.popups) p.update(now);
	}

	createPopup(header: string, description: string, buttons: PopupButtonDescription, actionOnClose: string = null, warning?: string) {
		return new Promise<string>(resolve => {
			let callback = (action: string) => {
				popup.hide();
				resolve(action);

				setTimeout(() => {
					// We can safely remove the popup
					this.container.removeChild(popup.container);
					this.interactionGroup.remove(popup.interactionGroup);
					removeItem(this.popups, popup);
				}, 1000);
			};
			let popup = new Popup(header, description, warning, buttons, actionOnClose, callback);
			this.popups.push(popup);

			this.container.addChild(popup.container);
			this.interactionGroup.add(popup.interactionGroup);

			popup.show();
		});
	}

	createConfirm(header: string, description: string, highlight: ConfirmDialogueHighlighting = ConfirmDialogueHighlighting.HighlightYes, warning?: string): Promise<'yes' | 'no'> {
		let buttons = [
			{action: 'yes', label: 'yes', color: [ConfirmDialogueHighlighting.HighlightYes, ConfirmDialogueHighlighting.HighlightBoth].includes(highlight)? THEME_COLORS.PrimaryBlue : THEME_COLORS.SecondaryActionGray},
			{action: 'no', label: 'no', color: [ConfirmDialogueHighlighting.HighlightNo, ConfirmDialogueHighlighting.HighlightBoth].includes(highlight)? THEME_COLORS.PrimaryBlue : THEME_COLORS.SecondaryActionGray}
		];
		if (highlight === ConfirmDialogueHighlighting.HighlightNo) buttons.reverse();

		return this.createPopup(header, description, buttons, 'no', warning) as any;
	}
}