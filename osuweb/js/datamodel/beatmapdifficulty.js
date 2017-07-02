"use strict";

export class BeatmapDifficulty {
    constructor() {
        // Stack leniency
        this.SL = 0.5;
        // Slider velocity
        this.SV = 1.4;
        // Slider tick rate
        this.TR = 1;

        // Approach rate
        this.AR = 5;
        // Hit Points
        this.HP = 5;
        // Overall difficulty
        this.OD = 5;
        // Circle size
        this.CS = 5;
    }

    // AR
    static getApproachTime(AR) {
        if (this.AR <= 5) {
            return 1800 - 120 * AR;
        } else {
            return 1950 - 150 * AR;
        }
    }

    getApproachTime() {
        if (this.AR <= 5) {
            return 1800 - 120 * this.AR;
        } else {
            return 1950 - 150 * this.AR;
        }
    }

    // OD
    static getHitDeltaForRating(OD, rating, mode = "osu") {
        if(mode === "osu") {
            switch(rating) {
                case 300:
                    return Math.ceil(79.5 - 6 * OD);
                case 100:
                    return Math.ceil(139.5 - 8 * OD);
                case 50:
                    return Math.ceil(199.5 - 10 * OD);
                default:
                    return -1
            }
        }
    }

    getHitDeltaForRating(rating, mode = "osu") {
        if(mode === "osu") {
            switch(rating) {
                case 300:
                    return Math.ceil(79.5 - 6 * this.OD);
                case 100:
                    return Math.ceil(139.5 - 8 * this.OD);
                case 50:
                    return Math.ceil(199.5 - 10 * this.OD);
                default:
                    return -1
            }
        }
    }

    static getRatingForHitDelta(OD, hitDelta, mode = "osu") {
        if(mode === "osu") {
            if(BeatmapDifficulty.getHitDeltaForRating(OD, 300) >= hitDelta) return 300;
            if(BeatmapDifficulty.getHitDeltaForRating(OD, 100) >= hitDelta) return 100;
            if(BeatmapDifficulty.getHitDeltaForRating(OD, 50) >= hitDelta) return 50;
            return 0;
        }
    }

    getRatingForHitDelta(hitDelta, mode = "osu") {
        if(mode === "osu") {
            if(this.getHitDeltaForRating(300) >= hitDelta) return 300;
            if(this.getHitDeltaForRating(100) >= hitDelta) return 100;
            if(this.getHitDeltaForRating(50) >= hitDelta) return 50;
            return 0;
        }
    }

    // CS
    static getCirclePixelSize(CS) {
        return 64 * (1.0 - 0.7 * (CS - 5) / 5);
    }

    getCirclePixelSize() {
        return 64 * (1.0 - 0.7 * (this.CS - 5) / 5);
    }
}