import { BeatmapSetPanelCollection } from "./beatmap_set_panel_collection";
import { BeatmapSetPanel } from "./beatmap_set_panel";
import { BeatmapCarousel } from "./beatmap_carousel";
import { BeatmapSet } from "../../../datamodel/beatmap/beatmap_set";
import { removeItem } from "../../../util/misc_util";
import { BeatmapEntry } from "../../../datamodel/beatmap/beatmap_entry";

/** "Grouped" in the sense that every beatmap set has exactly one panel, and all of that set's difficulties are grouped in that one panel. */
export class BeatmapSetPanelCollectionGrouped extends BeatmapSetPanelCollection {
	private beatmapSetToPanel: Map<BeatmapSet, BeatmapSetPanel>; // For faster lookup

	constructor(carousel: BeatmapCarousel) {
		super(carousel);

		this.beatmapSetToPanel = new Map();
	}

	onChange(beatmapSets: BeatmapSet[]) {
		let changedPanels: BeatmapSetPanel[] = [];

		for (let i = 0; i < beatmapSets.length; i++) {
			let beatmapSet = beatmapSets[i];

			let panel = this.beatmapSetToPanel.get(beatmapSet);
			if (panel) {
				// The panel already exists, simply go and update it

				panel.setBeatmapEntries(beatmapSet.entries);
				panel.refresh();
				changedPanels.push(panel);
				
				continue;
			}

			let newPanel = new BeatmapSetPanel(this, beatmapSet);
			newPanel.setBeatmapEntries(beatmapSet.entries);
			newPanel.refresh();
			changedPanels.push(newPanel);
			this.beatmapSetToPanel.set(beatmapSet, newPanel);
		}

		this.displayPanels(changedPanels);
	}

	remove(beatmapSet: BeatmapSet) {
		let panel = this.beatmapSetToPanel.get(beatmapSet);
		if (!panel) return;

		this.removePanel(panel);
		this.beatmapSetToPanel.delete(beatmapSet);
	}

	removeEntry(entry: BeatmapEntry) {
		let panel = this.beatmapSetToPanel.get(entry.beatmapSet);
		if (!panel) return;

		panel.refresh();
		this.displayPanels([panel]);
	}
}