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

    this.comboWorthValues = {}; // Used to determine elite beats. A value of 0 means perfect, anything above is some sort of katu, and everything below means the player hit 50s or misses.
    
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

Score.prototype.addScore = function(amount, comboIndependant, supressComboIncrease, hitObject) {
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
    if (hitObject) {
        var comboNum = hitObject.comboInfo.comboNum;
        if (this.comboWorthValues[comboNum] == undefined) {
            this.comboWorthValues[comboNum] = 0;
        }
        if (amount < 300) {
            this.comboWorthValues[comboNum] += -10e7 + 10e5 * amount + 1;
        }

        this.createScorePopup(hitObject, amount);

        if (hitObject.comboInfo.isLast) {
            delete this.comboWorthValues[comboNum];
        }
    }
};

Score.prototype.createScorePopup = function(hitObject, score) {
    var popupElement = document.createElement("div");
    popupElement.className = "scorePopup";
    popupElement.style.left = (hitObject.basePoint.x + currentPlay.marginWidth) * pixelRatio + "px";
    popupElement.style.top = (hitObject.basePoint.y + currentPlay.marginHeight) * pixelRatio + "px";
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
        if (this.comboWorthValues[hitObject.comboInfo.comboNum] >= 0 && hitObject.comboInfo.isLast) {
            if (this.comboWorthValues[hitObject.comboInfo.comboNum] == 0) {
                return "激";
            } else {
                return "喝";
            }
        }
        if (score == 0) {
            return "X";
        }
        return score;
    }).bind(this)();
    popupElement.style.color = color;
    popupElement.style.textShadow = "0px 0px 20px " + color;

    currentScene.elements["playareaDiv"].appendChild(popupElement);

    setTimeout(function() {
        currentScene.elements["playareaDiv"].removeChild(popupElement);
    }, 1000);
};

Score.prototype.break = function() {
    this.combo = 0;
};

Score.prototype.updateDisplay = function() {
    if (this.score != this.prevScore) {
        MathUtil.interpolate(this.prevScore, this.score, 150, "easeOut", function(x) {
            currentScene.elements["scoreDisplayP"].innerHTML = ("00000000" + Math.floor(x)).slice(-8);
        }, "scoreIncreaseAnimation");
    }
    if (this.accuracy != this.prevAccuracy) {
        MathUtil.interpolate(this.prevAccuracy, this.accuracy, 150, "easeOut", function(x) {
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
};