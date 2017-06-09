function Skin(oskOrDirectory) {
    this.skinElements = {};

    if (Object.prototype.toString.call(oskOrDirectory) === '[object Array]') {
        alert('Array!');
    }
    // We're getting a skin file bois!
    else {
        zip.loadAsync(oskOrDirectory).then((function (zip) {
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
        }).bind(this));
    }
}