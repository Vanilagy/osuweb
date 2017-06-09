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