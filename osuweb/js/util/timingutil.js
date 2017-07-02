"use strict";

import {GAME_STATE} from "../main";

export class TimingUtil {
    static getApproachTimeMSForAR(AR) {
        if (AR <= 5) {
            return 1800 - 120 * AR;
        } else {
            return 1950 - 150 * AR;
        }
    }

    static getScoreFromHitDelta(delta) {
        var OD = GAME_STATE.currentPlay.beatmap.OD;
        
        if (delta <= Math.ceil(79.5 - 6 * OD)) {
            return 300;
        } else if (delta <= Math.ceil(139.5 - 8 * OD)) {
            return 100;
        } else if (delta <= Math.ceil(199.5 - 10 * OD)) {
            return 50;
        }
        return 0;
    }

    static getMaxHitDeltaFromScore(score) {
        let OD = GAME_STATE.currentPlay.beatmap.OD;
        
        if (score === 50) {
            return 199.5 - 10 * OD;
        } else if (score === 100) {
            return 139.5 - 8 * OD;
        } else if (score === 300) {
            return 79.5 - 6 * OD;
        }
        return null;
    }
}