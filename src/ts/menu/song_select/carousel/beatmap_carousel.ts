import { REFERENCE_SCREEN_HEIGHT, currentWindowDimensions } from "../../../visuals/ui";
import { BeatmapSetPanelDrawable } from "./beatmap_set_panel_drawable";
import { updateDarkeningOverlay, updateBeatmapDifficultyPanelMasks, updateBeatmapSetPanelMasks, updateDifficultyColorBar } from "./beatmap_panel_components";
import { NormalizedWheelEvent, last, binarySearchLessOrEqual } from "../../../util/misc_util";
import { calculateRatioBasedScalingFactor } from "../../../util/graphics_util";
import { EaseType, MathUtil } from "../../../util/math_util";
import { InteractionGroup, InteractionRegistration } from "../../../input/interactivity";
import { BeatmapDifficultyPanel } from "./beatmap_difficulty_panel";
import { SongSelect } from "../song_select";
import { Interpolator } from "../../../util/interpolation";
import { globalState } from "../../../global_state";
import { BeatmapSetPanel, BEATMAP_SET_PANEL_HEIGHT } from "./beatmap_set_panel";
import { BeatmapSetPanelCollection, beatmapCarouselSortingTypeFunctions, BeatmapCarouselSortingType } from "./beatmap_set_panel_collection";
import { BeatmapSetPanelCollectionGrouped } from "./beatmap_set_panel_collection_grouped";
import { BeatmapSetPanelCollectionSplit } from "./beatmap_set_panel_collection_split";

export const BEATMAP_CAROUSEL_RIGHT_MARGIN = 600;
export const BEATMAP_CAROUSEL_RADIUS_FACTOR = 3.0;
export const BEATMAP_SET_PANEL_SNAP_TARGET = 225;
export const BEATMAP_DIFFICULTY_PANEL_SNAP_TARGET = 300;
const CAROUSEL_END_THRESHOLD = REFERENCE_SCREEN_HEIGHT/2 - BEATMAP_SET_PANEL_HEIGHT/2; // When either the top or bottom panel of the carousel cross this line, the carousel should snap back.
const SCROLL_VELOCITY_DECAY_FACTOR = 0.04; // Per second. After one second, the scroll velocity will have fallen off by this much.
const MAX_JUMP_DISTANCE = 2500; // See usage for meaning.
const DRAWABLE_POOL_SIZE = 25; // 25 drawables is usually more than enough!

type CollectionName = 'grouped' | 'split';

export class BeatmapCarousel {
	public songSelect: SongSelect;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number = 1.0;

	/** The currently selected beatmap set panel. Doesn't need to be the reference panel! */
	public selectedPanel: BeatmapSetPanel = null;
	/** The currently selected difficulty panel. */
	public selectedDifficultyPanel: BeatmapDifficultyPanel = null;

	/** The panel all positions will be relative to. This panel's position is "locked" at referenceY. */
	private reference: BeatmapSetPanel | BeatmapDifficultyPanel;
	/** The y-position of the current reference panel. */
	private referenceY = 0;
	private scrollVelocity = 0; // In normalized pixels per second
	/** If this is true, the reference panel will move according to the output the interpolator below, and not according to scrolling/dragging. */
	private snapToSelected = false;
	private snapToSelectionInterpolator = new Interpolator({
		duration: 750,
		ease: EaseType.EaseOutElastic,
		p: 0.9,
		defaultToFinished: true
	});
	
	/** All collections of beatmap set panels */
	private collections: {[name in CollectionName]?: BeatmapSetPanelCollection} = {};
	private currentCollection: CollectionName;
	
	/** For performance's sake, there are only very few beatmap set drawables in the carousel. These drawables are then continuously and seamlessly reassigned which panel they representing, creating the illusion of many panels. This array stores all these drawables. */
	private drawablePool: BeatmapSetPanelDrawable[] = [];
	/** The drawables that currently have no panel assigned. */
	private unassignedDrawables: BeatmapSetPanelDrawable[] = [];
	/** The drawables that currently have a panel assigned. */
	private assignedDrawables: BeatmapSetPanelDrawable[] = [];

	private interactionTarget: PIXI.Container;
	/** If the users moves too much while holding down the mouse, we release all presses. */
	private pressDownStopped = true;

	constructor(songSelect: SongSelect) {
		this.songSelect = songSelect;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.collections["grouped"] = new BeatmapSetPanelCollectionGrouped(this);
		this.collections["split"] = new BeatmapSetPanelCollectionSplit(this);
		this.currentCollection = "grouped";

		// Populate the drawable pool
		for (let i = 0; i < DRAWABLE_POOL_SIZE; i++) {
			let panel = new BeatmapSetPanelDrawable(this);
			this.container.addChild(panel.container);
			this.drawablePool.push(panel);
		}
		this.unassignedDrawables.push(...this.drawablePool);

		this.initInteraction();

		globalState.beatmapLibrary.addListener('add', (beatmapSets) => {
			for (let key in this.collections) {
				this.collections[key as CollectionName].onChange(beatmapSets);
			}
		});
		globalState.beatmapLibrary.addListener('change', (beatmapSet) => {
			for (let key in this.collections) {
				this.collections[key as CollectionName].onChange([beatmapSet]);
			}
		});

		this.setSortingAndSearchQuery(BeatmapCarouselSortingType.Title, "");
	}

	private getPanels() {
		return this.collections[this.currentCollection].displayedPanels;
	}

	private initInteraction() {
		// Will be used to listen to drag and wheel inputs
		this.interactionTarget = new PIXI.Container();
		this.songSelect.container.addChild(this.interactionTarget);

		let registration = new InteractionRegistration(this.interactionTarget);
		registration.setZIndex(1); // Above the panels
		registration.passThrough = true;
		this.interactionGroup.add(registration);

		registration.makeDraggable(() => {
			this.snapToSelected = false;
			this.scrollVelocity = 0;
			this.pressDownStopped = false;
		}, (e) => {
			if (!this.reference) return;
			this.referenceY += e.movement.y / this.scalingFactor;
		
			// Release all presses if the user moved a bit too much while pressing down
			if (Math.abs(e.distanceFromStart.y) > 7 && !this.pressDownStopped) {
				this.pressDownStopped = true;
				this.interactionGroup.releaseAllPresses();
			}
		}, (e) => {
			this.scrollVelocity -= e.velocity.y / this.scalingFactor;
		});

		registration.addListener('wheel', (e) => {
			this.onWheel(e, performance.now());
		});
	}

	private onWheel(data: NormalizedWheelEvent, now: number) {
		let panels = this.getPanels();
		if (panels.length === 0) return;

		let wheelEvent = data as NormalizedWheelEvent;
		let effectiveness = 1.0; // How much the scroll "counts"	
	
		// Determine scroll dampening if the user is on the top/bottom of the carousel
		let firstPanel = panels[0];
		let lastPanel = last(panels);
		let diff: number;
	
		// Top edge
		diff = firstPanel.currentNormalizedY - CAROUSEL_END_THRESHOLD;
		effectiveness = Math.pow(0.9, Math.max(0, diff/30));
	
		// Bottom edge
		diff = CAROUSEL_END_THRESHOLD - (lastPanel.currentNormalizedY + lastPanel.getAdditionalExpansionHeight(now));
		effectiveness = Math.min(effectiveness, Math.pow(0.9, Math.max(0, diff/30)));
	
		this.scrollVelocity += wheelEvent.dy * 4 * effectiveness;
		this.snapToSelected = false;
	}

	async setSortingAndSearchQuery(sortingType: BeatmapCarouselSortingType, query: string) {
		let newCollection: CollectionName;
		if (sortingType === BeatmapCarouselSortingType.Difficulty) {
			// Display all beatmap difficulties individually when showing difficulty.
			newCollection = 'split';
		} else {
			newCollection = 'grouped';
		}

		let isNewCollection = newCollection !== this.currentCollection;
		this.currentCollection = newCollection;

		let collection = this.collections[this.currentCollection];

		collection.setSortingFunction(beatmapCarouselSortingTypeFunctions.get(sortingType));
		collection.setSearchQuery(query);
		
		if (sortingType === BeatmapCarouselSortingType.Length) {
			// Make sure that metadata is loaded (otherwise we don't know the length!)
			collection.setFilter(x => x.beatmapSet.metadataLoaded);
		} else if (sortingType === BeatmapCarouselSortingType.Mapper) {
			// Make sure we know the mapper.
			collection.setFilter(x => !!x.beatmapSet.creator);
		} else if (sortingType === BeatmapCarouselSortingType.Difficulty) {
			collection.setFilter(x => {
				x.showStarRating = true; // Slight hack to set this here: Configure the beatmap set panels to show the difficulty.
				return x.beatmapSet.metadataLoaded; // Metadata has to be loaded for difficulty info to be available
			});
		} else {
			// Otherwise, show all beatmap sets!
			collection.setFilter(x => true);
		}

		collection.redetermineDisplayedPanels();

		if (isNewCollection && this.selectedDifficultyPanel) {
			// If we switched collection, but had a panel selected, we'll try to reselect the corresponding panel in the new collection.

			let panels = this.collections[this.currentCollection].getPanelsByBeatmapSet(this.selectedPanel.beatmapSet);
			// Remember these values for a while
			let referenceY = this.referenceY;
			let snapToSelected = this.snapToSelected;
			
			for (let panel of panels) {
				let index = panel.getSortedEntries().indexOf(this.selectedDifficultyPanel.entry);

				if (index !== -1) {
					await panel.select(index, this.selectedPanel.expandInterpolator.getStartTime(), false);

					// Restore old positioning
					this.referenceY = referenceY;
					this.snapToSelected = snapToSelected;

					break;
				}
			}
		}
	}

	update(now: number, dt: number) {
		let panels = this.getPanels();
		let referencePanel = (this.reference instanceof BeatmapSetPanel)? this.reference : this.reference?.parentPanel;

		if (!this.reference || panels.indexOf(referencePanel) === -1) {
			if (panels.length === 0) {
				// There are no panels currently. Hide them all.

				this.unassignedDrawables.push(...this.assignedDrawables);
				this.assignedDrawables.length = 0;

				for (let drawable of this.drawablePool) {
					drawable.bindPanel(null);
					drawable.update(now);
				}

				return;
			}

			// If there is no current reference, just set it to the first panel.
			referencePanel = panels[0];
			this.reference = referencePanel;			

			this.referenceY = 300;
			this.scrollVelocity = 100; // For sick effect hehe
			this.snapToSelected = false;
		}

		if (this.snapToSelected) {
			this.referenceY = this.snapToSelectionInterpolator.getCurrentValue(now);
		}

		/*
		The function describing scrollVelocity over time is
		f(t) = v0 * d^t,
		where v0 is the starting velocity, d is the decay and t is passed time in seconds.

		Therefore, the distance traveled is that function's antiderivative,
		F(t) = v0 * d^t / ln(d).
		The distance traveled in a given interval of time [0, x] is therefore
		F(x) - F(0) = v0 * d^x / ln(d) - v0 / ln(d) = v0 * (d^x - 1) / ln(d).
		*/

		let distanceScrolled = this.scrollVelocity * (Math.pow(SCROLL_VELOCITY_DECAY_FACTOR, dt/1000) - 1) / Math.log(SCROLL_VELOCITY_DECAY_FACTOR);
		this.scrollVelocity = this.scrollVelocity * Math.pow(SCROLL_VELOCITY_DECAY_FACTOR, dt/1000);
		this.referenceY -= distanceScrolled;

		// Velocity has taped off so much, just set it to 0.
		if (Math.abs(this.scrollVelocity) < 1) this.scrollVelocity = 0;

		// Get the position of the reference beatmap set panel
		let referencePanelY: number;
		if (this.reference instanceof BeatmapSetPanel) referencePanelY = this.referenceY;
		else referencePanelY = this.referenceY - this.reference.currentNormalizedY;
		let referenceIndex = panels.indexOf(referencePanel);

		referencePanel.currentNormalizedY = referencePanelY;

		// Working upwards from the reference panel, set the positions
		let currentY = referencePanelY;
		for (let i = referenceIndex-1; i >= 0; i--) {
			let panel = panels[i];
			let height = panel.getTotalHeight(now);

			currentY -= height;
			panel.currentNormalizedY = currentY;
		}

		// Working downwards from the reference panel, set the positions
		currentY = referencePanelY;
		for (let i = referenceIndex+1; i < panels.length; i++) {
			let prevPanel = panels[i-1];
			let panel = panels[i];
			let height = prevPanel.getTotalHeight(now);

			currentY += height;
			panel.currentNormalizedY = currentY;
		}

		// Calculate snapback when user scrolls off one of the carousel edges
		let firstPanel = panels[0];
		let lastPanel = last(panels);
		let snapbackNudge: number = 0;
		let diff: number;

		// Top edge snapback
		diff = firstPanel.currentNormalizedY - CAROUSEL_END_THRESHOLD;
		if (diff > 0) snapbackNudge += diff * (Math.pow(0.0015, dt/1000) - 1);

		// Bottom edge snapback
		diff = CAROUSEL_END_THRESHOLD - (lastPanel.currentNormalizedY + lastPanel.getAdditionalExpansionHeight(now));
		if (diff > 0) snapbackNudge -= diff * (Math.pow(0.0015, dt/1000) - 1);

		// Apply snapback nudge and update panels
		this.referenceY += snapbackNudge;
		for (let i = 0; i < panels.length; i++) {
			let panel = panels[i];

			panel.currentNormalizedY += snapbackNudge;
			panel.update(now);
		}

		for (let i = 0; i < this.assignedDrawables.length; i++) {
			let drawable = this.assignedDrawables[i];
			let panel = drawable.panel;
			let currentColletion = this.collections[this.currentCollection];

			// If the panel isn't in view or not part of the currently displayed panels, go clear it
			if (!panel.isInView(now) || !currentColletion.displayedPanelsSet.has(panel)) {
				this.assignedDrawables.splice(i--, 1);
				this.unassignedDrawables.push(drawable);
				drawable.bindPanel(null);
			}
		}
		
		// Find the index of a panel that's about in the middle of the screen. Then, assign drawables from there.
		let index = binarySearchLessOrEqual(panels, REFERENCE_SCREEN_HEIGHT/2, (x) => x.currentNormalizedY);
		index = Math.max(index, 0);
		// Go back until we reach a panel that isn't in view anymore (off the top)
		while (index > 0 && panels[index-1].isInView(now)) {
			index--;
		}
		while (index < panels.length && this.unassignedDrawables.length > 0) {
			let panel = panels[index];
			if (!panel.isInView(now)) break;

			if (!this.assignedDrawables.find(x => x.panel === panel)) {
				// If there isn't a drawable displaying this panel right now, assign one.

				let drawable = this.unassignedDrawables.pop();
				this.assignedDrawables.push(drawable);
				drawable.bindPanel(panel);
			}

			index++;
		}

		for (let drawable of this.drawablePool) drawable.update(now);

		// Update scrollbar
		let totalHeight = (lastPanel.currentNormalizedY + lastPanel.getAdditionalExpansionHeight(now)) - firstPanel.currentNormalizedY;
		this.songSelect.scrollbar.setScrollHeight(totalHeight + REFERENCE_SCREEN_HEIGHT);
		this.songSelect.scrollbar.setPageHeight(REFERENCE_SCREEN_HEIGHT);
		this.songSelect.scrollbar.setCurrentPosition(-firstPanel.currentNormalizedY + CAROUSEL_END_THRESHOLD);
	}

	resize() {
		this.scalingFactor = calculateRatioBasedScalingFactor(currentWindowDimensions.width, currentWindowDimensions.height, 16/9, REFERENCE_SCREEN_HEIGHT);	
		this.container.x = Math.floor(currentWindowDimensions.width - BEATMAP_CAROUSEL_RIGHT_MARGIN * this.scalingFactor);
	
		updateDarkeningOverlay(this.scalingFactor);
		updateBeatmapSetPanelMasks(this.scalingFactor);
		updateBeatmapDifficultyPanelMasks(this.scalingFactor);
		updateDifficultyColorBar(this.scalingFactor);
		
		this.interactionTarget.hitArea = new PIXI.Rectangle(0, 0, currentWindowDimensions.width, currentWindowDimensions.height);
	
		for (let drawable of this.drawablePool) drawable.resize();
	}

	setSelectedPanel(panel: BeatmapSetPanel, setAsReference: boolean) {
		if (panel === this.selectedPanel) return;

		this.selectedPanel?.collapse();
		this.selectedPanel = panel;
		this.selectedDifficultyPanel = null;

		if (!setAsReference) return;

		this.reference = panel;
		this.referenceY = panel.currentNormalizedY;
		this.snapToSelected = false;
	}

	setDifficultyPanel(panel: BeatmapDifficultyPanel, setAsReference = true) {
		this.selectedDifficultyPanel?.deselect(); // Deselect the currently selected difficulty panel
		this.selectedDifficultyPanel = panel;

		if (!setAsReference) return;

		this.reference = panel;
		this.referenceY = panel.currentNormalizedY + panel.parentPanel.currentNormalizedY;
		this.snapToSelected = false;
	}

	snapReferencePanelPosition(from: number, to: number) {
		let now = performance.now();
	
		// It could be that we snap to a position that's off the end of the carousel, where the carousel would normally snap back. Here, we catch this case and only snap as far as we should.
		let lastPanel = last(this.getPanels());
		if (lastPanel.currentNormalizedY === 0) {
			// If the value is zero, there's a high chance that this is a new panel that hasn't been assigned a proper position yet. To be sure, we run an update tick:
			this.update(now, 0);
		}

		let projectedY = lastPanel.currentNormalizedY - (from - to);
		let diff = CAROUSEL_END_THRESHOLD - (projectedY + lastPanel.getAdditionalExpansionHeight(now));
		if (diff > 0) to += diff;

		if (Math.abs(from - to) > MAX_JUMP_DISTANCE) {
			let delta = from - to;
			from = to + MAX_JUMP_DISTANCE * Math.sign(delta); // Cap jump distance here
		}
	
		this.snapToSelectionInterpolator.setValueRange(from, to);
		this.snapToSelectionInterpolator.start(now);
		this.snapToSelected = true;
		this.scrollVelocity = 0;
	}

	/** Moves one set forward/backward */
	skipSet(forward: boolean, selectLastDifficulty: boolean) {
		let panels = this.getPanels();
		if (panels.length === 0) return;

		let nextIndex: number;
		let index = panels.indexOf(this.selectedPanel);
		if (index === -1) {
			nextIndex = forward? 0 : panels.length-1;
		} else {
			nextIndex = MathUtil.adjustedMod(index + (forward? 1 : -1), panels.length);
			if (index === nextIndex) return;
		}

		panels[nextIndex].select(selectLastDifficulty? Infinity : 0);
	}

	/** Moves one difficulty forward/backward */
	skipDifficulty(forward: boolean) {
		let panels = this.getPanels();
		if (panels.length === 0) return;

		if (!panels.includes(this.selectedPanel)) {
			this.skipSet(forward, false);
			return;
		}

		let success = this.selectedPanel.skip(forward);
		if (!success) {
			this.skipSet(forward, !forward);
		}
	}

	selectRandom() {
		let panels = this.getPanels();
		if (panels.length === 0) return;

		let panel: BeatmapSetPanel;

		if (panels.length === 1) {
			// If there's only one beatmap, and that one isn't selected, just select that one.
			if (!panels.includes(this.selectedPanel)) panel = panels[0];
		} else {
			let selectedIndex = panels.indexOf(this.selectedPanel);
			let randomIndex: number;

			do {
				randomIndex = Math.floor(Math.random() * panels.length);
			} while (randomIndex === selectedIndex);

			panel = panels[randomIndex];
		}

		if (panel) panel.select('random'); // Select a random difficulty
	}

	/** Get the current carousel movement velocity in pixels per second. */
	getCurrentSignedVelocity(now: number) {
		if (this.snapToSelected) {
			// Approximate the derivative of the interpolation by looking at two values close to each other.
			let dt = 0.1;
			let val1 = this.snapToSelectionInterpolator.getCurrentValue(now);
			let val2 = this.snapToSelectionInterpolator.getCurrentValue(now + dt);

			return (val2 - val1) / dt * 1000;
		} else {
			return this.scrollVelocity;
		}
	}

	getCurrentAbsoluteVelocity(now: number) {
		return Math.abs(this.getCurrentSignedVelocity(now));
	}
}

export function getNormalizedOffsetOnCarousel(yPosition: number) {
	// -1.0 for top of the screen, 0.0 for middle, 1.0 for bottom
	let normalizedDistanceToCenter = (yPosition - currentWindowDimensions.height/2) / (currentWindowDimensions.height/2);
	let circleHeight = MathUtil.unitCircleContour(normalizedDistanceToCenter / BEATMAP_CAROUSEL_RADIUS_FACTOR);
	if (isNaN(circleHeight)) circleHeight = 1.0;

	return circleHeight * (REFERENCE_SCREEN_HEIGHT/2 * BEATMAP_CAROUSEL_RADIUS_FACTOR);
}