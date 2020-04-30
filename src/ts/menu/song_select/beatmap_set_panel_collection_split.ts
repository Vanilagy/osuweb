import { BeatmapSetPanelCollection } from "./beatmap_set_panel_collection";
import { BeatmapCarousel } from "./beatmap_carousel";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { BeatmapSetPanel } from "./beatmap_set_panel";
import { BeatmapEntry } from "../../datamodel/beatmap_entry";

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

				let newPanel = new BeatmapSetPanel(this.carousel, beatmapSet);
				newPanel.setBeatmapEntries([entry]); // Just this one entry
				newPanel.refresh();
				changedPanels.push(newPanel);
				this.beatmapEntryToPanel.set(entry, newPanel);
			}
		}

		this.displayPanels(changedPanels);
	}
}