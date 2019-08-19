export class BeatmapDifficulty {
    public SL: number = 0.7; // Stack leniency taken from McOsu
    public SV: number = 1; // Slider velocity TODO: is this the default?
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
    static getHitDeltaForJudgement(OD: number, judgement: number) : number {
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

    getHitDeltaForJudgement(judgement: number) : number {
        return BeatmapDifficulty.getHitDeltaForJudgement(this.OD, judgement);
    }

    static getJudgementForHitDelta(OD: number, hitDelta: number) : number {
        if(BeatmapDifficulty.getHitDeltaForJudgement(OD, 300) >= hitDelta) return 300;
        if(BeatmapDifficulty.getHitDeltaForJudgement(OD, 100) >= hitDelta) return 100;
        if(BeatmapDifficulty.getHitDeltaForJudgement(OD, 50) >= hitDelta) return 50;
        return 0;
    }

    getJudgementForHitDelta(hitDelta: number) : number {
        return BeatmapDifficulty.getJudgementForHitDelta(this.OD, hitDelta);
    }

    // CS
    static getCirclePixelSize(CS: number) : number {
        return 64 * (1.0 - 0.7 * (CS - 5) / 5);
    }

    getCirclePixelSize() : number {
        return BeatmapDifficulty.getCirclePixelSize(this.CS);
    }

    calculateDifficultyMultiplier() {
        // Based on: https://osu.ppy.sh/help/wiki/Score/

        /*

        Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
        It will only account for original values only.
        Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
        It will only account for original values only.
        Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
        It will only account for original values only.
        Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
        It will only account for original values only.
        Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
        It will only account for original values only.
        Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
        It will only account for original values only.

        Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
        It will only account for original values only.
        Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
        It will only account for original values only.
        Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
        It will only account for original values only.

        Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
        It will only account for original values only.
        v
        TODO
        */

        // Using the algorithm found in McOsu:
        /*
        let breakTime = this.getTotalBreakTime();
        let playableLength = this.getPlayableLength();
        let drainLength = Math.max(playableLength - Math.min(breakTime, playableLength), 1000) / 1000;
        let difficultyPoints = ((this.beatmap.difficulty.CS + this.beatmap.difficulty.HP + this.beatmap.difficulty.OD + MathUtil.clamp(this.hitObjects.length / drainLength * 8, 0, 16)) / 38.0 * 5.0);

        console.log(this.beatmap.difficulty.CS + this.beatmap.difficulty.HP + this.beatmap.difficulty.OD, difficultyPoints, MathUtil.clamp(this.hitObjects.length / drainLength * 8, 0, 16));*/

        let accumulatedDifficultyPoints = this.CS + this.HP + this.OD;
        
        // Determined emperically. These differ from what's listed on the official osu website, however these values seem to be the correct ones. UwU
        if (accumulatedDifficultyPoints <= 3) return 2;
        else if (accumulatedDifficultyPoints <= 10) return 3;
        else if (accumulatedDifficultyPoints <= 18) return 4;
        else if (accumulatedDifficultyPoints <= 25) return 5;
        return 6;

        //return difficultyPoints;
    }
}