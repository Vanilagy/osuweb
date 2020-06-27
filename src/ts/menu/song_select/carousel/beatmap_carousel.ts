import { REFERENCE_SCREEN_HEIGHT, currentWindowDimensions } from "../../../visuals/ui";
import { BeatmapSetPanelDrawable } from "./beatmap_set_panel_drawable";
import { updateDarkeningOverlay, updateBeatmapDifficultyPanelMasks, updateBeatmapSetPanelMasks, updateDifficultyColorBar } from "./beatmap_panel_components";
import { NormalizedWheelEvent, last, binarySearchLessOrEqual, removeSurroundingDoubleQuotes } from "../../../util/misc_util";
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
const UPDATE_REGION_LOW = -2000; // The first panel in the update region should have about this value as its position.
const UPDATE_REGION_HIGH = 3000; // The last panel in the update region should have about this value as its position.

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
	
	/** For performance's sake, there are only very few beatmap set drawables in the carousel. These drawables are then continuously and seamlessly reassigned which panel they represent, creating the illusion of many panels. This array stores all these drawables. */
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
			this.interactionGroup.add(panel.interactionGroup);
		}
		this.unassignedDrawables.push(...this.drawablePool);

		this.initInteraction();

		globalState.beatmapLibrary.addListener('add', (beatmapSets) => {
			for (let key in this.collections) {
				this.collections[key as CollectionName].onChange(beatmapSets);
			}
		});
		globalState.beatmapLibrary.addListener('change', (beatmapSet) => {
			if (beatmapSet.defective) return; // Don't forward changes to defective beatmap sets

			for (let key in this.collections) {
				this.collections[key as CollectionName].onChange([beatmapSet]);
			}
		});
		globalState.beatmapLibrary.addListener('remove', (beatmapSet) => {
			for (let key in this.collections) {
				this.collections[key as CollectionName].remove(beatmapSet);
			}

			// Switch to a different reference panel if the removed panel was the reference panel
			let referencePanel = this.getReferencePanel();
			if (referencePanel && referencePanel.beatmapSet === beatmapSet) {
				let panels = this.getPanels();
				let index = binarySearchLessOrEqual(panels, referencePanel.order, x => x.order);

				let replacementPanel = panels[index-1]; // Try the one above
				if (!replacementPanel) replacementPanel = panels[index+1]; // ...or the one below

				if (replacementPanel && replacementPanel !== referencePanel) {
					this.setReferencePanel(replacementPanel);
				}
			}

			// Deselect the panel if it was selected
			if (this.selectedPanel && this.selectedPanel.beatmapSet === beatmapSet) {
				this.selectedPanel.collapse();
				this.songSelect.infoPanel.hide();
			}
		});

		this.setSortingAndSearchQuery(BeatmapCarouselSortingType.Title, "");
	}

	private getPanels() {
		return this.collections[this.currentCollection].displayedPanels;
	}

	private getReferencePanel() {
		if (!this.reference) return null;
		return (this.reference instanceof BeatmapSetPanel)? this.reference : this.reference?.parentPanel;
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
		diff = firstPanel.computeY() - CAROUSEL_END_THRESHOLD;
		effectiveness = Math.pow(0.9, Math.max(0, diff/30));
	
		// Bottom edge
		diff = CAROUSEL_END_THRESHOLD - (lastPanel.computeY() + lastPanel.getAdditionalExpansionHeight(now));
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
		let referencePanel = this.getReferencePanel();

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
		} else {
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
		}

		// Velocity has taped off so much, just set it to 0.
		if (Math.abs(this.scrollVelocity) < 1) this.scrollVelocity = 0;

		// Update the current collection
		this.collections[this.currentCollection].update(now);

		// Get the position of the reference beatmap set panel
		let referencePanelY: number;
		if (this.reference instanceof BeatmapSetPanel) referencePanelY = this.referenceY;
		else referencePanelY = this.referenceY - this.reference.y;
		let referenceIndex = binarySearchLessOrEqual(panels, referencePanel.order, (x) => x.order);

		let specialHeightPanels = this.collections[this.currentCollection].specialHeightPanels;
		for (let panel of specialHeightPanels) {
			// Remove the panel from the set if it has a normal height again
			if (panel.hasBaseHeight(now)) {
				specialHeightPanels.delete(panel);
			}
		}

		// Calculate snapback when user scrolls off one of the carousel edges
		let firstPanel = panels[0];
		let firstPanelY = firstPanel.computeY();
		let lastPanel = last(panels);
		let lastPanelY = lastPanel.computeY();
		let snapbackNudge: number = 0;
		let diff: number;

		// Top edge snapback
		diff = firstPanelY - CAROUSEL_END_THRESHOLD;
		if (diff > 0) snapbackNudge += diff * (Math.pow(0.0015, dt/1000) - 1);

		// Bottom edge snapback
		diff = CAROUSEL_END_THRESHOLD - (lastPanelY + lastPanel.getAdditionalExpansionHeight(now));
		if (diff > 0) snapbackNudge -= diff * (Math.pow(0.0015, dt/1000) - 1);

		// Apply snapback nudge
		this.referenceY += snapbackNudge;
		firstPanelY += snapbackNudge;
		lastPanelY += snapbackNudge;

		// Only panels close to the center of the screen (update region) will be updated and drawn. This ensures good performance for huge numbers of panels.
		// First, estimate the approximate index where the panel at the start of the update region would be, by dividing the expected distance by base height.
		let index = referenceIndex + Math.round((UPDATE_REGION_LOW - referencePanelY) / BeatmapSetPanel.BASE_HEIGHT);
		index = MathUtil.clamp(index, 0, panels.length);
		// Get the actual position of the panel at the estimated index
		let position = this.getPanelPosition(panels[index], now);

		// Now, hone in on the actual panel
		if (position > UPDATE_REGION_LOW) {
			while (index > 0) {
				let newPos = position - panels[index-1].getTotalHeight(now);

				position = newPos;
				index--;

				if (newPos <= UPDATE_REGION_LOW) break;
			}
		} else {
			while (index < panels.length-1) {
				let newPos = position + panels[index].getTotalHeight(now);
				if (newPos > UPDATE_REGION_LOW) break;

				position = newPos;
				index++;
			}
		}

		let panelsToDisplay: BeatmapSetPanel[] = [];
		let region: BeatmapSetPanel[] = [];

		// Now, we go through all panels in the update region
		while (index < panels.length) {
			let panel = panels[index];
			if (position > UPDATE_REGION_HIGH) break; // We've reached the end of the region

			index++;
			panel.storedY = position;
			region.push(panel);
			position += panel.getTotalHeight(now);;

			if (!panel.isInView(now)) continue;
			panelsToDisplay.push(panel);
		}

		// Start out in the middle of the update region
		let mid = Math.floor(region.length/2);
		// Then, move forward based on current scrolling velocity, to "predict" where the middle will be in a short amount of time
		mid += Math.floor(this.getCurrentSignedVelocity(now) / 600);

		// Update the beatmap panels inside out. This is done so that images close to the middle will load sooner than images on the edges of the region.
		for (let i = 0; true; i++) {
			let index = mid;
			index += Math.ceil(i/2) * Math.pow(-1, i);
			if (Math.abs(index - mid) > region.length) break;

			region[index]?.update(now);
		}

		// Take care of drawables that aren't visible anymore
		for (let i = 0; i < this.assignedDrawables.length; i++) {
			let drawable = this.assignedDrawables[i];
			let panel = drawable.panel;

			// If the panel isn't in view or not part of the currently displayed panels, go clear it
			if (!panelsToDisplay.includes(panel)) {
				this.assignedDrawables.splice(i--, 1);
				this.unassignedDrawables.push(drawable);
				drawable.bindPanel(null);
			}
		}

		// Assign drawables to visible panels
		for (let i = 0; i < panelsToDisplay.length; i++) {
			let panel = panelsToDisplay[i];

			if (this.unassignedDrawables.length > 0 && !this.assignedDrawables.find(x => x.panel === panel)) {
				// If there isn't a drawable displaying this panel right now, assign one.

				let drawable = this.unassignedDrawables.pop();
				this.assignedDrawables.push(drawable);
				drawable.bindPanel(panel);
			}
		}

		for (let drawable of this.drawablePool) drawable.update(now);

		// Update scrollbar
		let totalHeight = (lastPanelY + lastPanel.getAdditionalExpansionHeight(now)) - firstPanelY;
		this.songSelect.scrollbar.setScrollHeight(totalHeight);
		this.songSelect.scrollbar.setPageHeight(REFERENCE_SCREEN_HEIGHT);
		this.songSelect.scrollbar.setCurrentPosition(-firstPanelY + CAROUSEL_END_THRESHOLD);
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

	setReferencePanel(panel: BeatmapSetPanel) {
		if (panel === this.reference) return;

		let y = panel.computeY();
		this.reference = panel;
		this.referenceY = y;
		this.snapToSelected = false;
	}

	setSelectedPanel(panel: BeatmapSetPanel, setAsReference: boolean) {
		if (panel === this.selectedPanel) return;

		this.selectedPanel?.collapse();
		this.selectedPanel = panel;
		this.selectedDifficultyPanel = null;

		if (!setAsReference) return;

		let y = panel.computeY();
		this.reference = panel;
		this.referenceY = y;
		this.snapToSelected = false;
	}

	setDifficultyPanel(panel: BeatmapDifficultyPanel, setAsReference = true) {
		this.selectedDifficultyPanel?.deselect(); // Deselect the currently selected difficulty panel
		this.selectedDifficultyPanel = panel;

		if (!setAsReference) return;

		let parentPanelY = panel.parentPanel.computeY();

		this.reference = panel;
		this.referenceY = panel.y + parentPanelY;
		this.snapToSelected = false;
	}

	snapReferencePanelPosition(from: number, to: number) {
		let now = performance.now();
	
		// It could be that we snap to a position that's off the end of the carousel, where the carousel would normally snap back. Here, we catch this case and only snap as far as we should.
		let lastPanel = last(this.getPanels());
		let lastPanelY = lastPanel.computeY();

		let projectedY = lastPanelY - (from - to);

		let diff = CAROUSEL_END_THRESHOLD - (projectedY + lastPanel.getAdditionalExpansionHeight(now));
		if (diff > 0) {
			to += diff;
		}

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

	/** Compute a panel's position in the carousel. */
	getPanelPosition(panel: BeatmapSetPanel, now: number) {
		// If n is the amount of panels, then this algorithm computes the position of a panel in O(log n) average time. This is possible because at all times, most panels will have the same height, meaning there's no need to compute every panel's height. This algorithm takes advantage of that fact and only calculates height where it is necessary.

		let panels = this.getPanels();
		let referencePanel = this.getReferencePanel();
		let referencePanelY: number;
		if (this.reference instanceof BeatmapSetPanel) referencePanelY = this.referenceY;
		else referencePanelY = this.referenceY - this.reference.y;

		// If the panel is the reference panel, just return the reference panel's position.
		if (panel === referencePanel) return referencePanelY;

		// Get the indices of the panels
		let referenceIndex = binarySearchLessOrEqual(panels, referencePanel.order, (x) => x.order);
		let panelIndex = binarySearchLessOrEqual(panels, panel.order, (x) => x.order);
		if (panelIndex === -1) return null;

		/** The absolute position difference between the reference panel and the input panel. */
		let positionDifference = 0;
		/** How many panels in between the reference and input panel didn't have the regular base height. */
		let specialPanelsHandled = 0;
		for (let otherPanel of this.collections[this.currentCollection].specialHeightPanels) {
			// Search for panels in between the reference and input panel
			if (Math.min(panel.order, referencePanel.order) < otherPanel.order && otherPanel.order < Math.max(panel.order, referencePanel.order)) {
				positionDifference += otherPanel.getTotalHeight(now);
				specialPanelsHandled++;
			}
		}

		/** The amount of panels with base height in between reference and input panel. */
		let missingCount = Math.max(0, Math.abs(referenceIndex - panelIndex) - 1 - specialPanelsHandled);
		positionDifference += missingCount * BeatmapSetPanel.BASE_HEIGHT;

		if (panelIndex < referenceIndex) {
			// If the input panel comes first, add the input panel's height to the difference
			positionDifference += panel.getTotalHeight(now);
			return referencePanelY - positionDifference;
		} else {
			// If the reference panel comes first, add the reference panel's height instead
			positionDifference += referencePanel.getTotalHeight(now);
			return referencePanelY + positionDifference;
		}
	}
}

export function getNormalizedOffsetOnCarousel(yPosition: number) {
	// -1.0 for top of the screen, 0.0 for middle, 1.0 for bottom
	let normalizedDistanceToCenter = (yPosition - currentWindowDimensions.height/2) / (currentWindowDimensions.height/2);
	let circleHeight = MathUtil.unitCircleContour(normalizedDistanceToCenter / BEATMAP_CAROUSEL_RADIUS_FACTOR);
	if (isNaN(circleHeight)) circleHeight = 1.0;

	return circleHeight * (REFERENCE_SCREEN_HEIGHT/2 * BEATMAP_CAROUSEL_RADIUS_FACTOR);
}