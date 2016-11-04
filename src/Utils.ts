let moment = require('moment');
import winston = require('winston');
import Logger = winston.Logger;

import Config from './Config';

export interface Coordinates {
    lat:Number;
    long:Number;
    elev:Number;
}

/**
 * Various utilities used throughout the application
 */
export default class Utils {

    /**
     * Gets an instance of a Winston logger
     * @param {String} logTag Name of the log tag to use
     * @returns {LoggerInstance} Winston logger instance
     */
    static getLogger(logTag:string):Logger {

        let logFormatter = function (options) {
            // Return string will be passed to logger.
            return options.timestamp() + ' [' + logTag + '] ' + options.level.toUpperCase() + ' ' + (undefined !== options.message ? options.message : '') +
                (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '' );
        };

        let consoleTransport = new (winston.transports.Console)({
            level: Config.consoleLogLevel,
            timestamp: function () {
                return Date.now();
            },
            formatter: logFormatter
        });

        let fileTransport = new (winston.transports.File)({
            level: Config.fileLogLevel,
            filename: Config.logFilePath,
            timestamp: function () {
                return Date.now();
            },
            json: false,
            formatter: logFormatter
        });

        let transports = [consoleTransport];

        if (!Config.simulate) {
            transports.push(fileTransport)
        }

        var logger = new (winston.Logger)({
            transports: transports
        });

        return logger;
    }

    /**
     * Used in simulation mode, multiplies the given time by the simulation time multiplier
     * @param time The time to transform (it will be increased)
     * @returns {number} Transformed time
     */
    static timestepTransformUp(time:number) {
        if (Config.simulate === true) {
            return time * Config.simulationTimeMultiplier;
        }
        else {
            return time;
        }
    }

    /**
     * Used in simulation mode, divides the given time by the simulation time multiplier
     * @param {Number} time The time to transform (it will be decreased)
     * @returns {Number} Transformed time
     */
    static timestepTransformDown(time:number) {
        if (Config.simulate === true) {
            return time / Config.simulationTimeMultiplier;
        }
        else {
            return time;
        }
    }

    /**
     * Gets a random boolean
     * @param {Number} chanceOfSuccess The chance of the boolean turning out to be true (0-1)
     * @returns {boolean} It's a boolean
     */
    static getRandomBoolean(chanceOfSuccess = 0.5):Boolean {
        let random = Math.random();
        return random <= chanceOfSuccess;
    }

    /**
     * Gets a random float
     * @param {Number} min Minimum value
     * @param {Number} max Maximum value
     * @param {Number} decimalPlaces Maximum number of decimal places that the random will have
     * @returns {number} Random float
     */
    static getRandomFloat(min:Number, max:Number, decimalPlaces?:Number):Number {
        let random = Math.random() * (max - min) + min;
        if (typeof decimalPlaces === 'number') {
            random = parseFloat(random.toFixed(decimalPlaces));
        }
        return random;
    }

    /**
     * Gets a random integer
     * @param {Number} min Minimum value
     * @param {Number} max Maximum value
     * @returns {number} Random integer
     */
    static getRandomInt(min:Number, max:Number):Number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Given a set of coordinates (lat/long/ele), adds a random bit of fuzz to them (useful to avoid detection - we don't send the same coordinates to the Niantic server over and over)
     * @param {Object} coords Coordinates to fuzz
     * @returns {{lat: number, long: number, elev: number}} Fuzzed coordinates
     */
    static fuzzGPSCoordinates(coords:Coordinates):Coordinates {
        let transformedLat = coords.lat + this.getRandomFloat(-Config.randomLatFuzzFactor, Config.randomLatFuzzFactor);
        let transformedLong = coords.long + this.getRandomFloat(-Config.randomLongFuzzFactor, Config.randomLongFuzzFactor);
        let transformedElev = coords.elev + this.getRandomFloat(-Config.randomElevationFuzzFactor, Config.randomElevationFuzzFactor);

        transformedLat = parseFloat(transformedLat.toFixed(Config.latLongDecimalPlaces));
        transformedLong = parseFloat(transformedLong.toFixed(Config.latLongDecimalPlaces));
        transformedElev = parseFloat(transformedElev.toFixed(Config.elevDecimalPlaces));

        return {
            lat: transformedLat,
            long: transformedLong,
            elev: transformedElev,
        };
    }

    /**
     * Implementation of atob (transform b64 to string)
     * @param {String} str Input
     * @returns {String} atob'd string
     */
    static atob(str) {
        return new Buffer(str, 'base64').toString('binary');
    }

    /**
     * Implementation of btoa (transform string to b64)
     * @param {String} str Input
     * @returns {string} btoa'd string
     */
    static btoa(str) {
        var buffer;

        if (str instanceof Buffer) {
            buffer = str;
        } else {
            buffer = new Buffer(str.toString(), 'binary');
        }

        return buffer.toString('base64');
    }
}