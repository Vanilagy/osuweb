"use strict";

import {
    DEBUG, DEBUG_PREFIX, ERROR, ERROR_PREFIX, INFO, INFO_PREFIX, VERBOSE, VERBOSE_PREFIX, WARNING,
    WARNING_PREFIX
} from "./constants";

export class Console {
    static verbose(message) {
        if(VERBOSE) console.debug(VERBOSE_PREFIX+" "+message);
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