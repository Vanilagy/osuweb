function Skin(resource, callback) {
    this.callback = callback;
    this.skinElements = {};

    if (Object.prototype.toString.call(resource) === '[object Array]') {
        alert('Array!');
        this.callback(false);
    }
    else if(Object.prototype.toString.call(resource) === '[object File]') {
        zip.loadAsync(resource).then(this.loadOSK.bind(this));
    }
    else if(Object.prototype.toString.call(resource) === '[object String]') {
        JSZipUtils.getBinaryContent(resource, (function(err, data) {
            if(err) {
                console.log(err);
            }

            zip.loadAsync(data).then(this.loadOSK.bind(this));
        }).bind(this));
    }
}

Skin.prototype.loadOSK = function(zip) {
    for(var key in zip.files) {
        // Get our keyname from filename
        let rawFileName = key.replace(/\.[^/.]+$/, "");
        // Determine how to read this entry
        var output = "string";
        if(key.endsWith(".mp3") || key.endsWith(".ogg") || key.endsWith(".wav")) output = "arraybuffer";
        if(key.endsWith(".jpg") || key.endsWith(".jpeg") || key.endsWith(".png") || key.endsWith(".gif")) output = "base64";
        zip.file(key).async(output).then((function(result) {
            if(output == "arraybuffer") {
                try {
                    if(result.byteLength > 0) {
                        this.skinElements[rawFileName] = new Audio(result, function(){}, 5);
                    }
                }
                catch(e) {
                    console.log(rawFileName);
                }
            }
            else {
                this.skinElements[rawFileName] = result;
            }
        }).bind(this), (function(fuckme) {
            console.log(fuckme);
        }).bind(this));
    }
    this.callback(true);
};