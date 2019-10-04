export class BeatmapDifficulty {
    public SL: number = 0.7; // Stack leniency taken from McOsu
    public SV: number = 1; // Slider velocity TODO: is this the default?
    public TR: number = 1; // Slider tick rate
    public AR: number = 5; // Approach rate
    public HP: number = 5; // Hit Points
    public OD: number = 5; // Overall difficulty
    public CS: number = 5; // Circle size

    // AR
    static getApproachTime(AR: number) {
        if (AR <= 5) {
            return 1800 - 120 * AR;
        } else {
            return 1950 - 150 * AR;
        }
    }

    getApproachTime() {
        return BeatmapDifficulty.getApproachTime(this.AR);
    }

    // OD
    static getHitDeltaForJudgement(OD: number, judgement: number) {
        switch(judgement) {
            case 300:
                return Math.ceil(79.5 - 6 * OD);
            case 100:
                return Math.ceil(139.5 - 8 * OD);
            case 50:
                return Math.ceil(199.5 - 10 * OD);
            default:
                return Infinity; // Makes sense, right? No really, name a better value.
        }
    }

    getHitDeltaForJudgement(judgement: number) {
        return BeatmapDifficulty.getHitDeltaForJudgement(this.OD, judgement);
    }

    static getJudgementForHitDelta(OD: number, hitDelta: number) {
        if (BeatmapDifficulty.getHitDeltaForJudgement(OD, 300) >= hitDelta) return 300;
        if (BeatmapDifficulty.getHitDeltaForJudgement(OD, 100) >= hitDelta) return 100;
        if (BeatmapDifficulty.getHitDeltaForJudgement(OD, 50) >= hitDelta) return 50;
        return 0;
    }

    getJudgementForHitDelta(hitDelta: number) {
        return BeatmapDifficulty.getJudgementForHitDelta(this.OD, hitDelta);
    }

    // CS
    static getCirclePixelSize(CS: number) {
        return 64 * (1.0 - 0.7 * (CS - 5) / 5);
    }

    getCirclePixelSize()  {
        return BeatmapDifficulty.getCirclePixelSize(this.CS);
    }

    calculateDifficultyMultiplier() {
        // Should not be called from ProcessedBeatmap, but only Beatmap.
        let accumulatedDifficultyPoints = this.CS + this.HP + this.OD;
        
        // Determined emperically. These differ from what's listed on the official osu website, however these values seem to be the correct ones. UwU
        if (accumulatedDifficultyPoints <= 3.0) return 2;
        else if (accumulatedDifficultyPoints <= 10.5) return 3;
        else if (accumulatedDifficultyPoints <= 18.2) return 4;
        else if (accumulatedDifficultyPoints <= 25.7) return 5;
        return 6;
    }

    clone() {
        let newDifficulty = new BeatmapDifficulty();

        newDifficulty.SL = this.SL;
        newDifficulty.SV = this.SV;
        newDifficulty.TR = this.TR;
        newDifficulty.AR = this.AR;
        newDifficulty.HP = this.HP;
        newDifficulty.OD = this.OD;
        newDifficulty.CS = this.CS;

        return newDifficulty;
    }
}