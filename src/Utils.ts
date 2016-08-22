let moment = require('moment');
import winston = require('winston');
import Logger = winston.Logger;

import Config from './Config';

export interface Coordinates {
    lat:Number;
    long:Number;
    elev:Number;
}

export default class Utils {

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

    static timestepTransformUp(time:number) {
        if (Config.simulate === true) {
            return time * Config.simulationTimeMultiplier;
        }
        else {
            return time;
        }
    }

    static timestepTransformDown(time:number) {
        if (Config.simulate === true) {
            return time / Config.simulationTimeMultiplier;
        }
        else {
            return time;
        }
    }

    static getRandomFloat(min:Number, max:Number, decimalPlaces?:Number):Number {
        let random = Math.random() * (max - min) + min;
        if (typeof decimalPlaces === 'number') {
            random = parseFloat(random.toFixed(decimalPlaces));
        }
        return random;
    }

    static getRandomInt(min:Number, max:Number):Number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static fuzzGPSCoordinates(coords:Coordinates):Coordinates {
        let transformedLat = coords.lat + this.getRandomFloat(-Config.randomLatFuzzFactor, Config.randomLatFuzzFactor);
        let transformedLong = coords.long + this.getRandomFloat(-Config.randomLongFuzzFactor, Config.randomLongFuzzFactor);
        let transformedElev = coords.elev + this.getRandomFloat(-Config.randomElevationFuzzFactor, Config.randomElevationFuzzFactor);

        transformedLat = parseFloat(transformedLat.toFixed(Config.latLongDecimalPlaces));
        transformedLong = parseFloat(transformedLong.toFixed(Config.latLongDecimalPlaces));
        transformedElev = parseFloat(transformedElev.toFixed(Config.latLongDecimalPlaces));
        
        return {
            lat: transformedLat,
            long: transformedLong,
            elev: transformedElev,
        };
    }

    static atob(str) {
        return new Buffer(str, 'base64').toString('binary');
    }

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