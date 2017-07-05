"use strict";

const VERBOSE_PREFIX = "[VERBOSE]";
const DEBUG_PREFIX = "[DEBUG]";
const WARNING_PREFIX = "[WARNING]";
const INFO_PREFIX = "[INFO]";
const ERROR_PREFIX = "[ERROR]";

const VERBOSE = true;
const DEBUG = true;
const WARNING = true;
const INFO = true;
const ERROR = true;

export class Console {
    static verbose(message) {
        if(VERBOSE) console.debug("["+window.performance.now().toFixed(0)+"ms] "+VERBOSE_PREFIX+" "+message);
    }

    static error(message) {
        if(ERROR) console.error(ERROR_PREFIX+" "+message);
    }

    static debug(message) {
        if(DEBUG) console.log(DEBUG_PREFIX+" "+message);
    }

    static warn(message) {
        if(WARNING) console.warn(WARNING_PREFIX+" "+message);
    }

    static info(message) {
        if(INFO) console.info(INFO_PREFIX+" "+message);
    }
}