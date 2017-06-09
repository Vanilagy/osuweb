var FileUtil = {
	loadFileAsDataUrl: function(file, onLoad) {
		var reader = new FileReader();

		reader.onload = onLoad;

		reader.readAsDataURL(file);
	},
    loadFileAsString: function(file, onLoad) {
        var reader = new FileReader();

        reader.onload = onLoad;

        reader.readAsText(file);
    },
	loadAudioFromFile: function(file, onFileLoad, onAudioLoad, isMusic) {
        // This is a zip entry
        if(typeof file == "string") {
            zip.file(file).async("arraybuffer").then((function(result) {
                onFileLoad(new Audio(result, onAudioLoad));
            }));
        }
        else {
            var reader = new FileReader();
            reader.onload = (function(e) {
                onFileLoad(new Audio(e.target.result, onAudioLoad));
            });
            reader.readAsArrayBuffer(file);
        }
    },
    loadAudioFromURL: function(url, onFileLoad, onAudioLoad, isMusic) {
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        request.onload = (function(e) {
            onFileLoad(new Audio(e.target.response, onAudioLoad, isMusic));
        });
        request.send();
    }
}