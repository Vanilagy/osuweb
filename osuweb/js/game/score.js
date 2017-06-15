function Score(beatmap) {
    this.score = 0;
    this.combo = 0;
    this.accuracy = 1;
    
    this.totalNumberOfHits = 0;
    this.totalValueOfHits = 0;
    
    this.difficultyMultiplier = (function() {
        var difficultyPoints = beatmap.CS + beatmap.HP + beatmap.OD;
        
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
        this.score += Math.round(amount + ((comboIndependant) ? 0 : amount * (Math.max(0, this.combo - 1) * this.difficultyMultiplier * this.modMultiplier) / 25));
    }
    
    if (!supressComboIncrease) this.combo++;
    
    if (!comboIndependant) {
        this.totalNumberOfHits++;
        this.totalValueOfHits += amount;
    }
    
    this.accuracy = (this.totalNumberOfHits) ? this.totalValueOfHits / (this.totalNumberOfHits * 300) : 1 ;
    
    this.updateDisplay();
}

Score.prototype.break = function() {
    this.combo = 0;
}

Score.prototype.updateDisplay = function() {
    currentScene.scoreDisplay.innerHTML = ("00000000" + this.score).slice(-8);
    currentScene.accuracyDisplay.innerHTML = (Math.floor(this.accuracy * 10000) / 100).toFixed(2) + "%";
    currentScene.comboDisplay.innerHTML = this.combo + "x";
}