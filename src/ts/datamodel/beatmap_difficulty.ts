export class BeatmapDifficulty {
    public SL: number = 0.95; // Stack leniency
    public SV: number = 1.4; // Slider velocity
    public TR: number = 1; // Slider tick rate
    public AR: number = 5; // Approach rate
    public HP: number = 5; // Hit Points
    public OD: number = 5; // Overall difficulty
    public CS: number = 5; // Circle size

    constructor() {}

    // AR
    static getApproachTime(AR: number) : number {
        if (AR <= 5) {
            return 1800 - 120 * AR;
        } else {
            return 1950 - 150 * AR;
        }
    }

    getApproachTime() : number {
        return BeatmapDifficulty.getApproachTime(this.AR);
    }

    // OD
    static getHitDeltaForRating(OD: number, rating: number) : number {
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

    getHitDeltaForRating(rating: number) : number {
        return BeatmapDifficulty.getHitDeltaForRating(this.OD, rating);
    }

    static getRatingForHitDelta(OD: number, hitDelta: number) : number {
        if(BeatmapDifficulty.getHitDeltaForRating(OD, 300) >= hitDelta) return 300;
        if(BeatmapDifficulty.getHitDeltaForRating(OD, 100) >= hitDelta) return 100;
        if(BeatmapDifficulty.getHitDeltaForRating(OD, 50) >= hitDelta) return 50;
        return 0;
    }

    getRatingForHitDelta(hitDelta: number) : number {
        return BeatmapDifficulty.getRatingForHitDelta(this.OD, hitDelta);
    }

    // CS
    static getCirclePixelSize(CS: number) : number {
        return 64 * (1.0 - 0.7 * (CS - 5) / 5);
    }

    getCirclePixelSize() : number {
        return BeatmapDifficulty.getCirclePixelSize(this.CS);
    }
}