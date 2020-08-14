import { LoadingIndicator } from "../components/loading_indicator";
import { ImportBeatmapsFromDirectoriesTask } from "../../datamodel/beatmap/beatmap_library";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { addNounToNumber } from "../../util/misc_util";

export class ImportStatusDisplay {
	public container: PIXI.Container;

	private loadingText: PIXI.Text;
	private loadingIndicator: LoadingIndicator;
	public task: ImportBeatmapsFromDirectoriesTask = null;

	constructor() {
		this.container = new PIXI.Container();

		this.loadingText = new PIXI.Text("");
		this.loadingText.style = {
			fontFamily: 'Exo2-RegularItalic',
			fill: 0xffffff,
		};
		this.loadingText.alpha = 0.85;
		this.container.addChild(this.loadingText);

		this.loadingIndicator = new LoadingIndicator(100);
		this.container.addChild(this.loadingIndicator.container);
	}

	resize(scalingFactor: number) {
		this.loadingText.style.fontSize = Math.floor(10 * scalingFactor);
		
		this.loadingIndicator.resize(scalingFactor);
		this.loadingIndicator.container.pivot.x = Math.floor(this.loadingIndicator.width * scalingFactor / 2);
		this.loadingIndicator.container.y = Math.floor(25 * scalingFactor);
	}

	update(now: number) {
		let loadingTaskProgress = this.task.getProgress();
		if (loadingTaskProgress) {
			let n = loadingTaskProgress.dataCompleted;
			this.loadingText.text = `${addNounToNumber(n, "beatmap set", "beatmap sets")} found...`;
		} else {
			this.loadingText.text = "Importing...";
		}
		
		this.loadingText.pivot.x = Math.floor(this.loadingText.width / 2);
		this.loadingIndicator.update(now);
	}

	createTask(directories: VirtualDirectory[]) {
		let task = new ImportBeatmapsFromDirectoriesTask(directories);
		task.start();

		this.task = task;
		this.loadingIndicator.start();
	}

	stopTask(destroy = true) {
		if (!this.task) return;
		
		if (destroy) this.task.destroy();
		this.task = null;
	}
}