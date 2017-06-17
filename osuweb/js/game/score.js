function Score(beatmap) {
    this.score = 0;
    this.accuracy = 1;
    this.combo = 0;
    
    this.prevScore = 0;
    this.prevAccuracy = 1;
    this.prevCombo = 0;
    
    this.maxCombo = 0;
    this.hits = {
        300: 0,
        100: 0,
        50: 0,
        0: 0
    }
    
    this.totalNumberOfHits = 0;
    this.totalValueOfHits = 0;
    
    this.difficultyMultiplier = (function() {
        var difficultyPoints = Math.floor(beatmap.CS) + Math.floor(beatmap.HP) + Math.floor(beatmap.OD);
        
        if (difficultyPoints <= 5){
            return 2;
        } else if (difficultyPoints <= 12) {
            return 3;
        } else if (difficultyPoints <= 17) {
            return 4;
        } else if (difficultyPoints <= 24) {
            return 5;
        } else {
            return 6;
        }
    })();
    this.modMultiplier = 1;
}

Score.prototype.addScore = function(amount, comboIndependant, supressComboIncrease) {
    if (amount == 0) {
        this.break();
    } else {
        this.score += Math.round(amount + ((comboIndependant) ? 0 : amount) * (Math.max(0, this.combo - 1) * this.difficultyMultiplier * this.modMultiplier) / 25);
    }
    
    if (!supressComboIncrease) {
        this.combo++;
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
    }
    
    if (!comboIndependant) {
        this.totalNumberOfHits++;
        this.totalValueOfHits += amount;
        this.hits[amount]++;
    }
    
    this.accuracy = (this.totalNumberOfHits) ? this.totalValueOfHits / (this.totalNumberOfHits * 300) : 1 ;
    
    this.updateDisplay();
}

Score.prototype.break = function() {
    this.combo = 0;
}

Score.prototype.updateDisplay = function() {
    if (this.score != this.prevScore) {
        interpolate(this.prevScore, this.score, 150, "easeOut", function(x) {
            currentScene.elements["scoreDisplayP"].innerHTML = ("00000000" + Math.floor(x)).slice(-8);
        }, "scoreIncreaseAnimation");
    }
    if (this.accuracy != this.prevAccuracy) {
        interpolate(this.prevAccuracy, this.accuracy, 150, "easeOut", function(x) {
            currentScene.elements["accuracyDisplayP"].innerHTML = (Math.floor(x * 10000) / 100).toFixed(2) + "%";
        }, "accuracyChangeAnimation");
    }
    if (this.combo != this.prevCombo) {
        currentScene.elements["comboDisplayP"].innerHTML = this.combo + "x";
        currentScene.elements["comboDisplayP"].style.animation = "none";
        currentScene.elements["comboDisplayP"].offsetWidth;
        currentScene.elements["comboDisplayP"].style.animation = "0.5s pulseCombo ease-out forwards";
    }
    
    this.prevScore = this.score;
    this.prevAccuracy = this.accuracy;
    this.prevCombo = this.combo;
}