import { PopupFrame } from "../components/popup_frame";
import { VerticalLayoutElement } from "../components/vertical_layout_element";
import { Button, ButtonPivot } from "../components/button";
import { Color, colorToHexNumber, Colors } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";
import { addUnitToBytes, addNounToNumber } from "../../util/misc_util";
import { ThumblessSlider } from "../components/thumbless_slider";
import { ScrollContainer } from "../components/scroll_container";
import { Scrollbar } from "../components/scrollbar";
import { globalState } from "../../global_state";
import { StoreBeatmapsTask } from "../../datamodel/beatmap/beatmap_library";
import { BeatmapSet } from "../../datamodel/beatmap/beatmap_set";

const CONTENT_WIDTH = 450;

export class StorageManager extends PopupFrame {
	private scrollContainer: ScrollContainer;
	private elements: VerticalLayoutElement<StorageManager>[] = [];
	private scrollbar: Scrollbar;

	constructor() {
		super({
			width: 600,
			height: 400,
			headerText: "storage manager",
			descriptionText: "",
			enableCloseButton: true,
			buttons: []
		});

		this.scrollbar = new Scrollbar();

		this.scrollContainer = new ScrollContainer(this.scrollbar);
		this.centerContainer.addChild(this.scrollContainer.container, this.scrollbar.container);
		this.interactionGroup.add(this.scrollContainer.interactionGroup);

		this.initElements();

		this.resize();
		this.hide();
	}

	private initElements() {
		this.elements.push(new SectionHeader(this, "overview"));
		this.elements.push(new StorageUsageMeter(this));
		this.elements.push(new ButtonWithDescription(this, "clear all storage", "", THEME_COLORS.JudgementMiss, async () => {
			let result = await globalState.popupManager.createPopup("clear all storage", "Are you sure you want to clear all storage? This includes beatmaps, skins, etc.", [
				{action: 'confirm', label: 'do it', color: THEME_COLORS.JudgementMiss}, {action: 'cancel', label: 'cancel', color: THEME_COLORS.SecondaryActionGray}
			], 'cancel');

			if (result !== 'confirm') return;

			for (let set of globalState.beatmapLibrary.beatmapSets.slice()) {
				if (set.stored) set.remove(false);
			}

			globalState.toastManager.showToast("Started deletion process.", THEME_COLORS.JudgementMiss);
			await globalState.database.findAndDelete('beatmapSet', () => true);
			await globalState.database.findAndDelete('directory', () => true);
			await globalState.database.findAndDelete('directoryHandle', () => true);
			globalState.toastManager.showToast("Deletion complete.", THEME_COLORS.PrimaryBlue);
		}));
		this.elements.push(new SectionHeader(this, "beatmaps"));
		this.elements.push(new BeatmapInfo(this));
		this.elements.push(new ButtonWithDescription(this, "store all beatmaps", "Store all currently loaded beatmaps that have not been stored yet, allowing you to access them without manual reimports in the future.", THEME_COLORS.PrimaryBlue, () => {
			let storing = new Set<BeatmapSet>();

			for (let task of globalState.taskManager.tasks) {
				if (task instanceof StoreBeatmapsTask) {
					let beatmapSets = task.input.beatmapSets;
					for (let i = 0; i < beatmapSets.length; i++) storing.add(beatmapSets[i]);
				}
			}

			let storeNeeded = globalState.beatmapLibrary.beatmapSets.filter(x => !x.stored && !storing.has(x));
			if (storeNeeded.length === 0) {
				globalState.toastManager.showToast("No beatmap sets to store.", THEME_COLORS.Judgement50);
				return;
			}

			let handlesToRemove: string[] = [];
			for (let set of storeNeeded) {
				if (set.directory.parent?.directoryHandleId) handlesToRemove.push(set.directory.parent.directoryHandleId);
			}

			globalState.beatmapLibrary.storeBeatmapSets(storeNeeded, true, handlesToRemove);
		}));
		this.elements.push(new ButtonWithDescription(this, "reopen imported folders", "Give the browser permission to access previously opened beatmap folders so that their beatmaps can be imported again. Note that these folders have to have been imported using the Native File System API.", THEME_COLORS.PrimaryBlue, async () => {
			let directoryHandles = await globalState.database.getAll('directoryHandle');
			if (directoryHandles.length === 0) {
				globalState.toastManager.showToast("No imported folders.", THEME_COLORS.PrimaryYellow);
				return;
			}

			for (let data of directoryHandles) data.permissionGranted = true;
			await globalState.database.putMultiple('directoryHandle', directoryHandles);

			globalState.importedFolderRequester.show();
		}));
		this.elements.push(new ButtonWithDescription(this, "delete stored beatmaps", "Delete all beatmaps that are currently stored. You’ll need to reimport these beatmaps to play them again.", THEME_COLORS.JudgementMiss, async () => {
			let result = await globalState.popupManager.createPopup("delete all stored beatmaps", "Are you sure you want to permanently delete all stored beatmaps?", [
				{action: 'confirm', label: 'yes, delete them', color: THEME_COLORS.JudgementMiss}, {action: 'cancel', label: 'cancel', color: THEME_COLORS.SecondaryActionGray}
			], 'cancel');

			if (result !== 'confirm') return;

			let beatmapIds: string[] = [];
			let directoryIds: string[] = [];
			let toDelete: BeatmapSet[] = [];

			for (let beatmapSet of globalState.beatmapLibrary.beatmapSets) {
				if (!beatmapSet.stored) continue;

				// Collect all the ids so that we can delete them in one sweep
				beatmapIds.push(beatmapSet.id);
				directoryIds.push(beatmapSet.directory.id);
				toDelete.push(beatmapSet);
			}

			for (let set of toDelete) set.remove(false);

			globalState.toastManager.showToast("Started deletion process.", THEME_COLORS.JudgementMiss);
			await globalState.database.deleteMultiple('beatmapSet', beatmapIds);
			await globalState.database.deleteMultiple('directory', directoryIds);
			globalState.toastManager.showToast("Deletion complete.", THEME_COLORS.PrimaryBlue);
		}));
		//this.elements.push(new SectionHeader(this, "skins"));

		for (let e of this.elements) {
			this.scrollContainer.contentContainer.addChild(e.container);
			this.scrollContainer.contentInteractionGroup.add(e.interactionGroup);
		}
	}

	resize() {
		super.resize();

		for (let e of this.elements) {
			e.resize();
		}

		this.scrollContainer.container.x = this.getLeftMargin();
		this.scrollContainer.container.y = this.description.y;

		this.scrollContainer.setHeight(this.centerContainerBackground.height - this.description.y);
		this.scrollContainer.setWidth(CONTENT_WIDTH * this.scalingFactor);
		this.scrollContainer.setPadding({left: 0, right: 0, top: 0, bottom: 22 * this.scalingFactor});
		this.scrollContainer.setScrollScalingFactor(this.scalingFactor);
		this.scrollContainer.setScrollbarScalingFactor(this.scalingFactor);

		this.scrollbar.setScaling(this.centerContainerBackground.height - Math.floor(82 * this.scalingFactor), this.scalingFactor);
		this.scrollbar.container.x = Math.floor(this.scrollContainer.container.x + (CONTENT_WIDTH + 26) * this.scalingFactor);
		this.scrollbar.container.y = Math.floor(50 * this.scalingFactor);
	}

	update(now: number) {
		if (!super.update(now)) return false;

		let currentY = 0;
		for (let e of this.elements) {
			e.update(now);

			if (currentY > 0) currentY += e.getTopMargin(now);
			e.container.y = Math.floor(currentY);
			currentY += e.getHeight(now) + e.getBottomMargin(now);
		}

		this.scrollContainer.update(now);

		return true;
	}
}

class SectionHeader extends VerticalLayoutElement<StorageManager> {
	private text: PIXI.Text;

	constructor(parent: StorageManager, text: string) {
		super(parent);

		this.text = new PIXI.Text(text, {
			fontFamily: 'Exo2-Bold',
			fill: 0xffffff
		});
		this.container.addChild(this.text);
	}

	getTopMargin() {
		return 10 * this.parent.scalingFactor;
	}

	getHeight() {
		return this.text.height;
	}

	getBottomMargin() {
		return 20 * this.parent.scalingFactor;
	}

	resize() {
		this.text.style.fontSize = Math.floor(13 * this.parent.scalingFactor);
	}

	update() {

	}
}

class ButtonWithDescription extends VerticalLayoutElement<StorageManager> {
	private button: Button;
	private description: PIXI.Text;

	constructor(parent: StorageManager, label: string, description: string, color: Color, onclick: () => any) {
		super(parent);

		this.button = new Button(200, 30, 13, ButtonPivot.TopLeft, label, colorToHexNumber(color));
		this.container.addChild(this.button.container);
		this.button.setupInteraction(this.interactionGroup, onclick);

		this.description = new PIXI.Text(description, {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff,
			wordWrap: true
		});
		this.description.alpha = 0.333;
		this.container.addChild(this.description);
	}

	getTopMargin() {
		return 0;
	}

	getHeight() {
		return this.description.text? this.description.y + this.description.height : this.button.container.height;
	}

	getBottomMargin() {
		return 20 * this.parent.scalingFactor;
	}

	resize() {
		this.button.resize(this.parent.scalingFactor);

		this.description.y = this.button.container.height + Math.floor(5 * this.parent.scalingFactor);
		this.description.style.fontSize = Math.floor(9 * this.parent.scalingFactor);
		this.description.style.wordWrapWidth = Math.floor(CONTENT_WIDTH * this.parent.scalingFactor);
	}

	update(now: number) {
		this.button.update(now);
	}
}

class StorageUsageMeter extends VerticalLayoutElement<StorageManager> {
	private slider: ThumblessSlider;
	private lastUpdateTime = -Infinity;

	constructor(parent: StorageManager) {
		super(parent);

		this.slider = new ThumblessSlider({width: CONTENT_WIDTH, height: 6}, false, {r: 255, g: 255, b: 255, a: 0.25}, THEME_COLORS.AccentGold, Colors.White);
		this.container.addChild(this.slider.container);
	}

	getTopMargin() {
		return 10 * this.parent.scalingFactor;
	}

	getHeight() {
		return 6 * this.parent.scalingFactor;
	}

	getBottomMargin() {
		return 20 * this.parent.scalingFactor;
	}

	resize() {
		this.slider.resize(this.parent.scalingFactor);
	}

	update(now: number) {
		this.slider.update(now);

		// Don't poll too often, who knows how much stress that is on the system
		if (now - this.lastUpdateTime > 333) this.lastUpdateTime = now;
		else return;

		navigator.storage.estimate().then(result => {
			let usage = (result as any).usageDetails?.indexedDB ?? result.usage;

			let percentage = usage / result.quota;
			this.slider.setCompletion(percentage);
			this.slider.setLabels(`${addUnitToBytes(usage)} stored`, `${addUnitToBytes(result.quota)} quota`);
		});
	}
}

/** Shows how many beatmaps there are, and how many of those are stored. */
class BeatmapInfo extends VerticalLayoutElement<StorageManager> {
	private text1: PIXI.Text;
	private text2: PIXI.Text;
	private text3: PIXI.Text; // Next to text2

	constructor(parent: StorageManager) {
		super(parent);

		this.text1 = new PIXI.Text("", {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff
		});
		this.text2 = new PIXI.Text("", {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff
		});
		this.text3 = new PIXI.Text("", {
			fontFamily: 'Exo2-Bold',
			fill: 0xffffff
		});
		this.text3.tint = colorToHexNumber(THEME_COLORS.PrimaryViolet);
		this.text1.alpha = this.text2.alpha = 0.8;
		this.container.addChild(this.text1, this.text2, this.text3);
	}

	getTopMargin() {
		return -5 * this.parent.scalingFactor;
	}

	getHeight() {
		return this.container.height;
	}

	getBottomMargin() {
		return 20 * this.parent.scalingFactor;
	}

	resize() {
		this.text1.style.fontSize = this.text2.style.fontSize = this.text3.style.fontSize = Math.floor(10 * this.parent.scalingFactor);
		this.text2.y = this.text3.y = Math.floor(12 * this.parent.scalingFactor);
	}

	update() {
		let storing = new Set<BeatmapSet>();

		for (let task of globalState.taskManager.tasks) {
			if (task instanceof StoreBeatmapsTask) {
				let beatmapSets = task.input.beatmapSets;
				for (let i = 0; i < beatmapSets.length; i++) storing.add(beatmapSets[i]);
			}
		}

		let storedBeatmaps = 0;
		let unstoredBeatmaps = 0;
		let storingBeatmaps = 0;
		let beatmaps = 0;

		for (let i = 0; i < globalState.beatmapLibrary.beatmapSets.length; i++) {
			let beatmapSet = globalState.beatmapLibrary.beatmapSets[i];
			beatmaps += beatmapSet.entries.length;

			if (beatmapSet.stored) storedBeatmaps++;
			else {
				if (storing.has(beatmapSet)) storingBeatmaps++;
				else unstoredBeatmaps++;
			}
		}

		this.text1.text = `${addNounToNumber(globalState.beatmapLibrary.beatmapSets.length, "beatmap set", "beatmap sets")} (${addNounToNumber(beatmaps, "beatmap", "beatmaps")}) currently loaded`;
		this.text2.text = `${storedBeatmaps} stored / ${unstoredBeatmaps} unstored${storingBeatmaps? ' / ' : ''}`;
		this.text3.text = storingBeatmaps? `${storingBeatmaps} storing` : '';
		this.text3.x = this.text2.width;
	}
}