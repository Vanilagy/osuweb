function BeatmapSet(files, callback) {
    this.files = files;
    this.audioFiles = [];
    this.imageFiles = [];
    this.difficulties = {};
    this.osz = false;

    if(Object.prototype.toString.call(files) === '[object File]') {
        this.osz = true;

        zip.loadAsync(files).then((function (zip) {
            this.files = zip.files;

            for(var key in zip.files) {
                if(key.endsWith(".mp3") || key.endsWith(".wav") || key.endsWith(".ogg")) {
                    this.audioFiles.push(key);
                    continue;
                }
                if(key.endsWith(".jpg") || key.endsWith(".jpeg") || key.endsWith(".png") || key.endsWith(".gif")) {
                    this.imageFiles.push(key);
                    continue;
                }

                var regex = /\[([^\[^\]]+)]\.osu$/g;
                var str = key;
                var m;

                while ((m = regex.exec(str)) !== null) {
                    // This is necessary to avoid infinite loops with zero-width matches
                    if (m.index === regex.lastIndex) {
                        regex.lastIndex++;
                    }

                    // The result can be accessed through the `m`-variable.
                    m.forEach((function(match, groupIndex){
                        if(groupIndex == 1) {
                            this.difficulties[match] = key;
                        }
                    }).bind(this));
                }
            }

            if(callback != undefined) callback(this);
        }).bind(this));
    }
    else {
        for(var i = 0; i < files.length; i++) {
            var filename = files[i].name.toLowerCase();

            if(filename.endsWith(".mp3") || filename.endsWith(".wav") || filename.endsWith(".ogg")) {
                this.audioFiles.push(files[i]);
                continue;
            }
            if(filename.endsWith(".jpg") || filename.endsWith(".jpeg") || filename.endsWith(".png") || filename.endsWith(".gif")) {
                this.imageFiles.push(files[i]);
                continue;
            }

            var regex = /\[([^\[^\]]+)]\.osu$/g;
            var str = files[i].webkitRelativePath;
            var m;

            while ((m = regex.exec(str)) !== null) {
                // This is necessary to avoid infinite loops with zero-width matches
                if (m.index === regex.lastIndex) {
                    regex.lastIndex++;
                }

                // The result can be accessed through the `m`-variable.
                m.forEach((function(match, groupIndex){
                    if(groupIndex == 1) {
                        this.difficulties[match] = files[i];
                    }
                }).bind(this));
            }
        }
        if(callback != undefined) callback(this);
    }
}

BeatmapSet.prototype.loadDifficulty = function(difficultyFile, audioCallback) {
    currentBeatmap = new Beatmap(difficultyFile, function() {
        // find background image if it exists
        var imageFile = null;

        for(var i = 0; i < currentBeatmap.events.length; i++) {
            if(currentBeatmap.events[i].type == "image") {
                var imageFileName = currentBeatmap.events[i].file;

                for(var j = 0; j < this.imageFiles.length; j++) {
                    var imageName = typeof this.imageFiles[j] == "string" ? this.imageFiles[j] : this.imageFiles[j].name;

                    if(imageName == imageFileName) {
                        imageFile = this.imageFiles[j];
                        break;
                    }
                }

                break;
            }
        }

        if(imageFile != null) {
            if(this.osz) {
                zip.file(imageFile).async("base64").then((function(result) {
                    var div = document.getElementById("background").style.backgroundImage = 'url(data:image/png;base64,'+result+')';
                }));
            }
            else {
                FileUtil.loadFileAsDataUrl(imageFile, function(e) {
                    var div = document.getElementById("background").style.backgroundImage = 'url('+e.target.result+')';
                });
            }
        }

        // find audio file
        var audioFile = null;

        for(var i = 0; i < this.audioFiles.length; i++) {
            var audioName = typeof this.audioFiles[i] == "string" ? this.audioFiles[i] : this.audioFiles[i].name;

            if(audioName == currentBeatmap["audioFile"]) {
                audioFile = this.audioFiles[i];
                break;
            }
        }

        FileUtil.loadAudioFromFile(audioFile, (function(a) {
            currentAudio = a;
        }).bind(this), (function() {
            audioCallback();
        }).bind(this));
    }.bind(this));
}

BeatmapSet.prototype.selectDifficulty = function(difficultyFile, audioFiles, imageFiles) {
    this.loadDifficulty(difficultyFile, audioFiles, imageFiles, function() {
        currentAudio.playAudioFromOffsetWithLoop(0, currentBeatmap["previewTime"] / 1000.0, currentBeatmap["previewTime"] / 1000.0)
    });
}