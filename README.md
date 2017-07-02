# kronosu!

This is a implementation of the popular rhythm game osu! in the browser using HTML5, CSS and JS.

THIS IS NOT A RELEASE VERSION! FEATURES MAY NOT BE DIRECTLY AVAILABLE!

## Features

### UI

#### Main Menu

- Loading Screen (to be reworked)
- Volume Control (Mouse Wheel)

### Standard osu!

_Gameplay_

- Circles, Sliders (Linear, Passthrough and Bezier) and Spinners
- Timing points, including SV, Hitsounding and Volume changes
- Hitsounding, including per-object hitsounding and sampleset usage (No custom samplesets)
- Skinning for Hitsounds supported
- Autoplay (no hitsounds

TODO:

- Skipping start, breaks and end
- HP Bar
- Keypanel (Keypress counter)
- Replays

_Interface_

- Score, accuracy and combo
- Progress Pie-Chart
- Accmeter

## Workspace Setup

This project is intended to be opened using WebStorm by JetBrains. If you can set
it up on another environment that's fine but your problem.

### 1. Import project

After importing your project into WebStorm it should look like this:

![Workspace](https://cdn.pbrd.co/images/GyZSEU9.png)

Make sure your project is set to use ECMAScript 6 (_Preferences | Languages & Frameworks | JavaScript_)

### 2. Setup File Watchers

In order to run the JS code we need to transpile it from ES6 to ES5 and bundle it together.

You require the npm package manager to get the required tools.

#### a) Get Babel

Babel is a transpiler for JavaScript helping to convert our ES6 JS code to ES5 because ES6
is not widely supported yet. Execute the following command to get the package:

> npm install --save-dev babel-cli

Navigate to your project root directory __osuweb/__ and execute this command to install the
presets for WebStorm:

> npm install --save-dev babel-preset-env

Now go to _Preferences | Tools | File watchers_ and add a Babel File Watcher. Most of the fields
should be prefilled but we want to make some changes:

- Check if the Program points to the proper executable for your system
- For the Scope, create a custom scope which reclusively includes __the osuweb/js/__ folder

![JS Folder Scope](https://cdn.pbrd.co/images/GyZZ6jy.png)

Babel will now watch if any file got changed and transpile it after saving it saving it in the __osuweb/dist/js/__ folder.

#### a) Get Browserify (Recommended, Required for some browsers)

This tool will bundle all our JS files together while resolving all imports. You install it
with this command:

> npm install -g browserify

Now we are setting up a second watcher __*after*__ the first one and configure it as follows:

![Browserify Watcher](https://cdn.pbrd.co/images/Gz01ou4.png)

Again check if these settings are correct for you:

- Check if the Program points to the proper executable for your system
- For the Scope, create a custom scope which only targets __osuweb/dist/js/main.js__

This watcher will output the file __osuweb/bundle.js__ which is already included in the index.html

Note: Make sure Babel transpiles all files so in __osuweb/dist/js/__ are the same files as in __osuweb/js/__
