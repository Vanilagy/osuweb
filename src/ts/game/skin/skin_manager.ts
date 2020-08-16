import { Skin, joinSkins } from "./skin";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { settingsDescription } from "../../menu/settings/settings_description";
import { changeSettingAndUpdateSettingsPanel } from "../../menu/settings/settings";
import { globalState } from "../../global_state";
import { removeItem } from "../../util/misc_util";

export class SkinManager {
	public skins: Skin[];
	private baseSkin: Skin = null;
	public currentSkin: Skin = null;

	constructor() {
		this.skins = [];
	}

	async init() {
		let storedSkins = await globalState.database.getAll('skin');
		for (let skinDescription of storedSkins) {
			let skin = await Skin.fromDescription(skinDescription);
			this.skins.push(skin);
		}

		let baseSkin = this.skins.find(x => x.isBaseSkin);
		if (baseSkin) {
			await baseSkin.init(false);
			baseSkin.allowSliderBallExtras = true;
		} else {
			// Fetch the base skin

			let baseSkinPath = "./assets/skins/default";
			let baseSkinDirectory = new VirtualDirectory("root");
			baseSkinDirectory.networkFallbackUrl = baseSkinPath;

			baseSkin = new Skin(baseSkinDirectory);
			await baseSkin.init(false);
			baseSkin.order = -1;
			baseSkin.isBaseSkin = true;
			baseSkin.allowSliderBallExtras = true;
			await baseSkin.store();

			this.skins.push(baseSkin);
		}
		
		this.baseSkin = baseSkin;

		// Select the base skin if no skin is picked
		if (!this.skins.find(x => x.id === globalState.settings['selectedSkin'])) globalState.settings['selectedSkin'] = baseSkin.id;
		this.refreshSkinPicker();
	}

	private refreshSkinPicker() {
		let obj = {} as Record<string, string>;

		for (let skin of this.skins.slice().sort((a, b) => a.order - b.order)) {
			obj[skin.id] = skin.getDisplayName();
		}

		settingsDescription['selectedSkin'].options = obj;
		changeSettingAndUpdateSettingsPanel('selectedSkin', globalState.settings['selectedSkin']);
	}

	async importSkinDirectory(directory: VirtualDirectory) {
		let skin = new Skin(directory);
		await skin.init(false);
		await skin.store();

		this.skins.push(skin);

		this.refreshSkinPicker();
		changeSettingAndUpdateSettingsPanel('selectedSkin', skin.id);
	}

	async selectSkin(id: string) {
		if (this.currentSkin?.id === id) return;

		let skin = this.skins.find(x => x.id === id);
		if (!skin) return;

		// Skin still needs initting
		if (Object.keys(skin.textures).length === 0) await skin.init(false);

		let joinedSkin = joinSkins([this.baseSkin, skin], true, true, true);
		await joinedSkin.readyAssets();

		this.currentSkin = joinedSkin;

		changeSettingAndUpdateSettingsPanel('selectedSkin', id);
	}

	showImportPrompt() {
		// Create a temporary input element, then click it
		let inputElement = document.createElement('input');
		inputElement.setAttribute('webkitdirectory', '');
		inputElement.setAttribute('type', 'file');
		inputElement.click();

		inputElement.addEventListener('change', () => {
			let files = inputElement.files;
			let directory = VirtualDirectory.fromFileList(files);

			this.importSkinDirectory(directory);
		});
	}

	async deleteSkin(skinId: string) {
		let skin = this.skins.find(x => x.id === skinId);
		if (!skin) return;

		removeItem(this.skins, skin);
		this.refreshSkinPicker();

		if (this.currentSkin?.id === skinId) {
			this.selectSkin(this.baseSkin.id);
		}

		await globalState.database.delete('skin', skinId);
	}

	async deleteAll() {
		let promises: Promise<any>[] = [];

		for (let skin of this.skins.slice()) {
			if (!skin.isBaseSkin) promises.push(this.deleteSkin(skin.id));
		}

		await Promise.all(promises);
	}
}