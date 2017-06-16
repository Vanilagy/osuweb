var TimingUtil = {
	getHighResolutionContextTime: function() {
		return window.performance.now() - audioCtxTime;
	},
    getMsFromAR: function(AR) {
        if (AR <= 5) {
            return 1800 - 120 * AR;
        } else {
            return 1950 - 150 * AR;
        }
    },
    getScoreFromHitDelta: function(delta) {
        var OD = currentPlay.beatmap.OD;
        
        if (delta <= Math.ceil(79.5 - 6 * OD)) {
            return 300;
        } else if (delta <= Math.ceil(139.5 - 8 * OD)) {
            return 100;
        } else if (delta <= Math.ceil(199.5 - 10 * OD)) {
            return 50;
        }
        return 0;
    },
    getMaxHitDeltaFromScore: function(score) {
        var OD = currentPplay.beatmap.OD;
        
        if (score == 50) {
            return 199.5 - 10 * OD;
        } else if (score == 100) {
            return 139.5 - 8 * OD;
        } else if (score == 300) {
            return 79.5 - 6 * OD;
        }
        return null;
    },
    interval: function(duration, fn, baseline){
        this.baseline = baseline;

        this.run = function(){
            if(this.baseline === undefined){
                this.baseline = osuweb.util.getHighResolutionContextTime();
            }
            fn();
            var end = osuweb.util.getHighResolutionContextTime();
            this.baseline += duration;

            var nextTick = duration - (end - this.baseline);
            if(nextTick<0){
                nextTick = 0
            }
            (function(i){
                i.timer = setTimeout(function(){
                    i.run(end)
                }, nextTick)
            })(this)
        }

        this.stop = function(){
            clearTimeout(this.timer)
        }
    }
}