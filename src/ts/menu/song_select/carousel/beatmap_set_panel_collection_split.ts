import { BeatmapSetPanelCollection } from "./beatmap_set_panel_collection";
import { BeatmapCarousel } from "./beatmap_carousel";
import { BeatmapSetPanel } from "./beatmap_set_panel";
import { BeatmapEntry } from "../../../datamodel/beatmap/beatmap_entry";
import { BeatmapSet } from "../../../datamodel/beatmap/beatmap_set";
import { removeItem } from "../../../util/misc_util";

/** "Split" means that every beatmap entry has its own panel. This comes in handy for things like sorting maps by difficulty, where sorting entire beatmap sets would make no sense. */
export class BeatmapSetPanelCollectionSplit extends BeatmapSetPanelCollection {
	private beatmapEntryToPanel: Map<BeatmapEntry, BeatmapSetPanel>; // For faster lookup

	constructor(carousel: BeatmapCarousel) {
		super(carousel);

		this.beatmapEntryToPanel = new Map();
	}

	onChange(beatmapSets: BeatmapSet[]) {
		let changedPanels: BeatmapSetPanel[] = [];

		for (let i = 0; i < beatmapSets.length; i++) {
			let beatmapSet = beatmapSets[i];

			for (let entry of beatmapSet.entries) {
				// For every entry, create a panel if possible

				let panel = this.beatmapEntryToPanel.get(entry);
				if (panel) {
					panel.refresh();
					changedPanels.push(panel);

					continue;
				}

				let newPanel = new BeatmapSetPanel(this, beatmapSet);
				newPanel.setBeatmapEntries([entry]); // Just this one entry
				newPanel.refresh();
				changedPanels.push(newPanel);
				this.beatmapEntryToPanel.set(entry, newPanel);
			}
		}

		this.displayPanels(changedPanels);
	}

	remove(beatmapSet: BeatmapSet) {
		let panels = beatmapSet.entries.map(x => this.beatmapEntryToPanel.get(x)).filter(x => x); // Filter to get rid of undefineds

		for (let panel of panels) {
			this.removePanel(panel);
			this.beatmapEntryToPanel.delete(panel.beatmapEntries[0]);
		}
	}

	removeEntry(entry: BeatmapEntry) {
		let panel = this.beatmapEntryToPanel.get(entry);
		if (!panel) return;

		this.removePanel(panel);
		this.beatmapEntryToPanel.delete(entry);
	}
}