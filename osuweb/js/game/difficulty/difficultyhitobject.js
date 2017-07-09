"use strict";

const NORMALIZED_RADIUS = 52;

export class DifficultyHitObject {
    /// Initializes the object calculating extra data required for difficulty calculation.
    /// </summary>
    constructor(triangle) {
        this.triangle = triangle;

        this.baseObject = triangle[0];

        this.setDistances();
        this.setTimingValues();
        // Calculate angle here
    }

    setDistances() {
        let radius = this.baseObject.beatmap.difficulty.getCirclePixelSize() / 2;

        // We will scale distances by this factor, so we can assume a uniform CircleSize among beatmaps.
        let scalingFactor = NORMALIZED_RADIUS / radius;
        if (radius < 30)
        {
            let smallCircleBonus = Math.min(30 - radius, 5) / 50;
            scalingFactor *= 1 + smallCircleBonus;
        }

        this.distance = Math.hypot(this.triangle[0].x - this.triangle[1].x, this.triangle[0].y - this.triangle[1].y) * scalingFactor;
    }

    setTimingValues() {
        // Every timing inverval is hard capped at the equivalent of 375 BPM streaming speed as a safety measure.
        this.deltaTime = Math.max(40, this.triangle[0].startTime - this.triangle[1].startTime);
        this.timeUntilHit = 450; // BaseObject.PreEmpt;
    }
}