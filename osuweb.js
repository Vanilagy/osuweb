var osuweb = {
	version: "2017.05.29.0000",
	versionType: "alpha",
};

class Beatmap {
	constructor(file) {
		var reader = new FileReader();
		reader.onload = function(progressEvent){
			this.events = [];
			this.timingPoints = [];
			this.hitObjects = [];
			this.colours = [];
			
		    var lines = this.result.split('\n');
			
			var section = "header";
			var eventType = "";
			
		    for(var i = 0; i < lines.length; i++){
		    	var line = lines[i].trim();
				
				if(line == "") continue;
				
		        if(line.startsWith("osu file format v") && !line.endsWith("14")) console.log("The beatmap version seems to be older than supported. We could run into issue here!");
		    	
				if(line == "[General]") {
					section = "general";
					continue;
				}
				if(line == "[Metadata]") {
					section = "metadata";
					continue;
				}
				if(line == "[Difficulty]")  {
					section = "difficulty";
					continue;
				}
				if(line == "[Events]")  {
					section = "events";
					continue;
				}
				if(line == "[TimingPoints]")  {
					section = "timing";
					continue;
				}
				if(line == "[HitObjects]")  {
					section = "hitObjects";
					continue;
				}
				if(line == "[Colours]")  {
					section = "colours";
					continue;
				}
				
				if(section != "timing" && section != "hitObjects") {
					if(line.startsWith("AudioFileName")) this.audioFile=line.split(':')[1].trim();
					if(line.startsWith("AudioLeadIn")) this.audioLeadIn=line.split(':')[1].trim();
					if(line.startsWith("PreviewTime")) this.previewTime=line.split(':')[1].trim();
					if(line.startsWith("Countdown")) this.countdown=line.split(':')[1].trim();
					if(line.startsWith("SampleSet")) this.sampleSet=line.split(':')[1].trim();
					if(line.startsWith("StackLeniency")) this.stackLeniency=line.split(':')[1].trim();
					if(line.startsWith("Mode")) this.mode=line.split(':')[1].trim();
					if(line.startsWith("LetterboxInBreaks")) this.letterBoxInBreaks=line.split(':')[1].trim();
					if(line.startsWith("WidescreenStoryboard")) this.widescreenStoryboard=line.split(':')[1].trim();
					
					if(line.startsWith("Title")) this.title=line.split(':')[1].trim();
					if(line.startsWith("TitleUnicode")) this.titleUnicode=line.split(':')[1].trim();
					if(line.startsWith("Artist")) this.artist=line.split(':')[1].trim();
					if(line.startsWith("ArtistUnicode")) this.artistUnicode=line.split(':')[1].trim();
					if(line.startsWith("Creator")) this.creator=line.split(':')[1].trim();
					if(line.startsWith("Version")) this.version=line.split(':')[1].trim();
					if(line.startsWith("Source")) this.source=line.split(':')[1].trim();
					if(line.startsWith("Tags")) this.tags=line.split(':')[1].trim();
					if(line.startsWith("BeatmapID")) this.beatmapID=line.split(':')[1].trim();
					if(line.startsWith("BeatmapSetID")) this.beatmapSetID=line.split(':')[1].trim();
					
					if(line.startsWith("HPDrainRate")) this.HP=line.split(':')[1].trim();
					if(line.startsWith("CircleSize")) this.CS=line.split(':')[1].trim();
					if(line.startsWith("OverallDifficulty")) this.OD=line.split(':')[1].trim();
					if(line.startsWith("ApproachRate")) this.AR=line.split(':')[1].trim();
					if(line.startsWith("SliderMultiplier")) this.SV=line.split(':')[1].trim();
					if(line.startsWith("SliderTickRate")) this.sliderTickRate=line.split(':')[1].trim();
				}
				if(section == "colours") {
					var col = line.split(':')[1].trim().split(',');
					
					this.colours.push({
						r: col[0],
						g: col[1],
						b: col[2],
					});
				}
				if(section == "timing") {
					var values = line.split(',');
					
					this.timingPoints.push({
						offset: values[0],
						msPerBeat: values[1],
						BPM: 60000/values[1],
						meter: values[2],
						sampleType: values[3],
						sampleSet: values[4],
						volume: values[5],
						inherited: values[6],
						kiai: values[7],
					});
				}
				if(section == "events") {
					if(line.startsWith("//")) continue;
					
					var values = line.split(',');
					
					switch(values[0]) {
						case "2":
							var type = "break";
							break;
					}
					
					this.events.push({
						type: type,
						start: values[1],
						end: values[2]
					});
				}
				if(section == "hitObjects") {
					var values = line.split(',');
					// circle
					if(values[3] == "1" || values[3] == "5") {
						var circle = {
							type: "circle",
							newCombo: values[3] == "5",
							x: parseInt(values[0], 10),
							y: parseInt(values[1], 10),
							time: parseInt(values[2], 10),
							hitSound: parseInt(values[4], 10),
						};
						
						// samplings
						var SamplingValues = values[5].split(':');
						
						circle["samplings"] = {sampleSet: parseInt(SamplingValues[0], 10), sampleSetAddition: parseInt(SamplingValues[1], 10)};
						
						this.hitObjects.push(circle);
					}
					// slider
					if(values[3] == "2" || values[3] == "6") {
						var sliderPoints = values[5].split("|");
					
						var sliderType = sliderPoints[0];
					
						var sliderSections = [];
						
						var sliderSectionPoints = [];
						
						var lastPoint = null;
						
						for(var j = 1; j < sliderPoints.length; j++) {
							var coords = sliderPoints[j].split(':');
							
							if(j == 0) {
								// add first point
								sliderSectionPoints.push({x: parseInt(values[0], 10), y: parseInt(values[1], 10)});
							}
							
							var nextPoint = {x: parseInt(coords[0], 10), y: parseInt(coords[1], 10)}; 
							
							sliderSectionPoints.push(nextPoint);
							
							// end section if same point appears twice and start a new one if end is not reached
							if(JSON.stringify(lastPoint) === JSON.stringify(nextPoint) || j + 1 == sliderPoints.length) {
								if(sliderPoints.length == 3 && sliderSectionPoints.length == 3 && sliderType == "P") {
									var sectionType = "circle";
								}
								else if(sliderSectionPoints.length == 2) {
									var sectionType = "linear";
								}
								else {
									var sectionType = "bezier";
								}
								
								sliderSections.push({type: sectionType, values: sliderSectionPoints});
								
								sliderSectionPoints = [];
								sliderSectionPoints.push(nextPoint);
							}
							
							lastPoint = nextPoint;
						}
						
						var slider = {
							type: "slider",
							newCombo: values[3] == "6",
							x: parseInt(values[0], 10),
							y: parseInt(values[1], 10),
							time: parseInt(values[2], 10),
							hitSound: parseInt(values[4], 10),
							sections: sliderSections,
							repeat: parseInt(values[6], 10),
							length: parseFloat(values[7])
						};
						
						if(values.length > 8) {
							// edgeAdditions
							var additionsValuesRaw = values[8].split('|');
							
							var additions = [];
							
							for(var j = 0; j < additionsValuesRaw; j++) {
								additions.push(parseInt(additionsValuesRaw[j], 10));
							}
							
							slider["additions"] = additions;
							
							// edge samplings
							var edgeSamplings = [];
							
							var splitEdgeSampleSetsRaw = values[9].split('|');
							
							for(var j = 0; j < splitEdgeSampleSetsRaw.length; j++) {
								var val = splitEdgeSampleSetsRaw[j].split(':');
								
								edgeSamplings.push({sampleSet: parseInt(val[0], 10), sampleSetAddition: parseInt(val[1], 10)});
							} 
							
							slider["edgeSamplings"] = edgeSamplings;
							
							// body samplings
							var sliderBodySamplingValues = values[10].split(':');
							
							slider["bodySamplings"] = {sampleSet: parseInt(sliderBodySamplingValues[0], 10), sampleSetAddition: parseInt(sliderBodySamplingValues[1], 10)};
						}
						
						this.hitObjects.push(slider);
					}
					// spinner
					if(values[3] == "8" || values[3] == "12") {
						var spinner = {
							type: "spinner",
							newCombo: values[3] == "12",
							x: parseInt(values[0], 10),
							y: parseInt(values[1], 10),
							time: parseInt(values[2], 10),
							hitSound: parseInt(values[4], 10),
							endTime: parseInt(values[5], 10),
						};
						
						// samplings
						var SamplingValues = values[6].split(':');
						
						spinner["samplings"] = {sampleSet: parseInt(SamplingValues[0], 10), sampleSetAddition: parseInt(SamplingValues[1], 10)};
						
						this.hitObjects.push(spinner);
					}
				}
		    }
			
			
			
			console.log(JSON.stringify(this));
		};
		reader.readAsText(file);
	}
}

osuweb.game = {
	// 0 - Main Menu
	// 1 - Song Select
	// 2 - In Game
	// 20 - Paused
	state: 0,
	database: {
		// The place where the database will be stored locally
		databaseFile: "",
		songDirectory: "",
		skinDirectory: "",
		mapsets: {},
		collections: {}
	}
}

osuweb.audio = {
	songBuffer: null,
	songSource: null,
	hitsound: {
		normal: {
			hit: null,
			clap: null,
			whistle: null,
			finish: null
		},
		drum: {
			hit: null,
			clap: null,
			whistle: null,
			finish: null
		},
		soft: {
			hit: null,
			clap: null,
			whistle: null,
			finish: null
		}
	}
}

osuweb.file = {
	loadDir: function(onReturn) {
		var input = $(document.createElement('input'));
        input.attr("type", "file");
        input.attr("id", "filepicker");
        input.attr("name", "filelist");
        input.attr("webkitdirectory", "true");
		$('#filepicker').change(onReturn);
        input.trigger('click');
	},
	loadFile: function(filePath, onLoad) {
		if (input.files && input.files[0]) {
			var reader = new FileReader();

			reader.onload = onLoad;

			reader.readAsDataURL(input.files[0]);
		}
	}
}

osuweb.graphics = {
	
}

osuweb.mathutil = {
	coordsOnBezier: function(pointArray, t) {
		var bx = 0, by = 0, n = pointArray.length - 1;
                
        for(var i = 0; i <= n; i++) {
            bx += this.binomialCoef(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i) * pointArray[i].x;
            by += this.binomialCoef(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i) * pointArray[i].y;
        }

        return {x: bx, y: by}
	},
	binomialCoef: function(n, k) {
		var r = 1;

        if (k > n)
            return 0;

        for (var d = 1; d <= k; d++) {
            r *= n--;
            r /= d;
        }

        return r;
	},
    circleCenterPos: function(p1, p2, p3) {
        var yDelta_a = p2.y - p1.y,
            xDelta_a = p2.x - p1.x,
            yDelta_b = p3.y - p2.y,
            xDelta_b = p3.x - p2.x,
            center = {};
        
        var aSlope = yDelta_a / xDelta_a,
            bSlope = yDelta_b / xDelta_b;
        
        center.x = (aSlope * bSlope * (p1.y - p3.y) + bSlope * (p1.x + p2.x) - aSlope * (p2.x + p3.x)) / (2 * (bSlope - aSlope));
        center.y = -1 * (center.x - (p1.x + p2.x) / 2) / aSlope + (p1.y + p2.y) / 2;
        
        return center;
    }
}

osuweb.graphics.scene = {
	sceneSwitching: false,
	scenes: {
		sceneMainMenu: "You havent edited this yet lol"
	}
}

skin = {
	name: "Default",
	// static definition of string literals
	soundFileName: {
		// welcome screen
		welcome: "welcome",
		seeya: "seeya",
		heartbeat: "heartbeat",
		
		// chat
		keyconfirm: "key-confirm",
		keydelete: "key-delete",
		keymovement: "key-movement",
		keypress1: "key-press-1",
		keypress2: "key-press-2",
		keypress3: "key-press-3",
		keypress4: "key-press-4",
		
		// click sounds
		backbuttonclick: "back-button-click",
		checkon: "check-on",
		checkoff: "check-off",
		clickclose: "click-close",
		clickshortconfirm: "click-short-confirm",
		
		menuback: "menuback",
		menuhit: "menuhit",
		menubackclick: "menu-back-click",
		menuchartsclick: "menu-charts-click",
		menudirectclick: "menu-direct-click",
		menueditclick: "menu-edit-click",
		menuexitclick: "menu-exit-click",
		menumultiplayerclick: "menu-multiplayer-click",
		menuoptionsclick: "menu-options-click",
		menuplayclick: "menu-play-click",
		pausebackclick: "pause-back-click",
		pausecontinueclick: "pause-continue-click",
		pauseretryclick: "pause-retry-click",
		selectexpand: "select-expand",
		selectdifficulty: "select-difficulty",
		shutter: "shutter",
		
		// hover sounds
		backbuttonhover: "back-button-hover",
		clickshort: "click-short",
		menuclick: "menuclick",
		menubackhover: "menu-back-hover",
		menuchartshover: "menu-charts-hover",
		menudirecthover: "menu-direct-hover",
		menuedithover: "menu-edit-hover",
		menuexithover: "menu-exit-hover",
		menumultiplayerhover: "menu-multiplayer-hover",
		menuoptionshover: "menu-options-hover",
		menuplayhover: "menu-play-hover",
		pausebackhover: "pause-back-hover",
		pausecontinuehover: "pause-continue-hover",
		pauseretryhover: "pause-retry-hover",
		
		// drag sounds
		sliderbar: "sliderbar",
		
		// gameplay sounds
		hitSound: {
			standard: {
				normal: {
					hit: "normal-hitnormal",
					clap: "normal-hitclap",
					whistle: "normal-hitwhistle",
					finish: "normal-hitfinish",
					sliderslide: "normal-sliderslide",
					slidertick: "normal-slidertick",
					sliderwhistle: "normal-sliderwhistle",
				},
				drum: {
					hit: "drum-hitnormal",
					clap: "drum-hitclap",
					whistle: "drum-hitwhistle",
					finish: "drum-hitfinish",
					sliderslide: "drum-sliderslide",
					slidertick: "drum-slidertick",
					sliderwhistle: "drum-sliderwhistle",
				},
				soft: {
					hit: "soft-hitnormal",
					clap: "soft-hitclap",
					whistle: "soft-hitwhistle",
					finish: "soft-hitfinish",
					sliderslide: "soft-sliderslide",
					slidertick: "soft-slidertick",
					sliderwhistle: "soft-sliderwhistle",
				}
			},
			taiko: {
				normal: {
					hit: "taiko-normal-hitnormal",
					clap: "taiko-normal-hitclap",
					whistle: "taiko-normal-hitwhistle",
					finish: "taiko-normal-hitfinish",
				},
				drum: {
					hit: "taiko-drum-hitnormal",
					clap: "taiko-drum-hitclap",
					whistle: "taiko-drum-hitwhistle",
					finish: "taiko-drum-hitfinish"
				},
				soft: {
					hit: "taiko-soft-hitnormal",
					clap: "taiko-soft-hitclap",
					whistle: "taiko-soft-hitwhistle",
					finish: "taiko-soft-hitfinish"
				}
			}
		},
		spinnerbonus: "spinnerbonus",
		spinnerspin: "spinnerspin",
		ready: "readys",
		count3: "count3s",
		count2: "count2s",
		count1: "count1s",
		count: "count",
		go: "gos",
		sectionpass: "sectionpass",
		sectionfail: "sectionfail",
		failsound: "failsound",
		combobreak: "combobreak",
		pauseloop: "pause-loop.wav"
	},
	soundFileSuffix: [".wav", ".ogg", ".mp3"],
	imageFileName: {
		// welcome screen
		menubackground: "menu-background",
		welcometext: "welcome_text",
		menusnow: "menu-snow",
		
		// buttons
		menuback: "menu-back",
		menubuttonbackground: "menu-button-background",
		selectionmode: "selection-mode",
		selectionmodeover: "selection-mode-over",
		selectionmods: "selection-mods",
		selectionmodsover: "selection-mods-over",
		selectionrandom: "selection-random",
		selectionrandomover: "selection-random-over",
		selectiontab: "selection-tab",
		star: "star",
		star2: "star",
		
		// mode select
		modeosu: "mode-osu",
		modetaiko: "mode-taiko",
		modefruits: "mode-fruits",
		modemania: "mode-mania",
		modeosumed: "mode-osu-med",
		modetaikomed: "mode-taiko-med",
		modefruitsmed: "mode-fruits-med",
		modemaniamed: "mode-mania-med",
		modeosusmall: "mode-osu-small",
		modetaikosmall: "mode-taiko-small",
		modefruitssmall: "mode-fruits-small",
		modemaniasmall: "mode-maniasmall",
		
		// mod icons
		selectionmodauto: "selection-mod-autoplay",
		selectionmodcinema: "selection-mod-cinema",
		selectionmoddoubletime: "selection-mod-doubletime",
		selectionmodeasy: "selection-mod-easy",
		selectionmodflashlight: "selection-mod-flashlight",
		selectionmodhalftime: "selection-mod-halftime",
		selectionmodhardrock: "selection-mod-hardrock",
		selectionmodhidden: "selection-mod-hidden",
		selectionmodnightcore: "selection-mod-nightcore",
		selectionmodnofail: "selection-mod-nofail",
		selectionmodperfect: "selection-mod-perfect",
		selectionmodrelax: "selection-mod-relax",
		selectionmodautopilot: "selection-mod-relax2",
		selectionmodeasy: "selection-mod-easy",
		selectionmodspunout: "selection-mod-spunout",
		selectionmodsuddendeath: "selection-mod-suddendeath",
		
		// scorebar
		scorebarbg: "scorebar-bg",
	}
}

/*osuweb.graphics.skin.prototype.constructor = function(filePath) {
	
}*/