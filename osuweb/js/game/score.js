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

Score.prototype.addScore = function(amount, comboIndependant, supressComboIncrease, pos) {
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
    
    this.accuracy = (this.totalNumberOfHits) ? this.totalValueOfHits / (this.totalNumberOfHits * 300) : 1;
    this.updateDisplay();
    if (pos) {
        this.createScorePopup(pos, amount);
    }
};

Score.prototype.createScorePopup = function(pos, score) {
    var popupElement = document.createElement("div");
    popupElement.className = "scorePopup";
    popupElement.style.left = (pos.x + currentPlay.marginWidth) * pixelRatio + "px";
    popupElement.style.top = (pos.y + currentPlay.marginHeight) * pixelRatio + "px";
    popupElement.style.fontSize = csPixel * 0.32 + "px";
    popupElement.style.animation = "1s scorePopup linear forwards";
    var color = (function() {
        if (score == 300) {
            return "#38b8e8";
        } else if (score == 100) {
            return "#57e11a";
        } else if (score == 50) {
            return "#d6ac52";
        }
        return "red";
    })();
    popupElement.innerHTML = (function() {
        if (score == 0) {
            return "miss";
        }
        return score;
    })();
    popupElement.style.color = color;
    popupElement.style.textShadow = "0px 0px 20px " + color;

    playareaDiv.appendChild(popupElement);
};

Score.prototype.break = function() {
    this.combo = 0;
};

Score.prototype.updateDisplay = function() {
    if (this.score != this.prevScore) {
        GraphicUtil.interpolate(this.prevScore, this.score, 150, "easeOut", function(x) {
            currentScene.scoreDisplay.innerHTML = ("00000000" + Math.floor(x)).slice(-8);
        }, "scoreIncreaseAnimation");
    }
    if (this.accuracy != this.prevAccuracy) {
        GraphicUtil.interpolate(this.prevAccuracy, this.accuracy, 150, "easeOut", function(x) {
            currentScene.accuracyDisplay.innerHTML = (Math.floor(x * 10000) / 100).toFixed(2) + "%";
        }, "accuracyChangeAnimation");
    }
    if (this.combo != this.prevCombo) {
        currentScene.comboDisplay.innerHTML = this.combo + "x";
        currentScene.comboDisplay.style.animation = "none";
        currentScene.comboDisplay.offsetWidth;
        currentScene.comboDisplay.style.animation = "0.5s pulseCombo ease-out forwards";
    }
    
    this.prevScore = this.score;
    this.prevAccuracy = this.accuracy;
    this.prevCombo = this.combo;
};