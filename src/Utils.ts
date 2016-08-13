import winston = require('winston');
import Logger = winston.Logger;

import Config from './Config';

export default class Utils {

    static getLogger(logTag:string):Logger {

        let logFormatter = function (options) {
            // Return string will be passed to logger.
            return options.timestamp() + ' [' + logTag + '] ' + options.level.toUpperCase() + ' ' + (undefined !== options.message ? options.message : '') +
                (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '' );
        };

        var logger = new (winston.Logger)({
            transports: [
                new (winston.transports.Console)({
                    level: Config.consoleLogLevel,
                    timestamp: function () {
                        return Date.now();
                    },
                    formatter: logFormatter
                }),
                new (winston.transports.File)({
                    level: Config.fileLogLevel,
                    filename: Config.logFilePath,
                    timestamp: function () {
                        return Date.now();
                    },
                    json: false,
                    formatter: logFormatter
                })
            ]
        });
        return logger;
    }

    static getRandomFloat(min:Number, max:Number) {
        return Math.random() * (max - min) + min;
    }

    static getRandomInt(min:Number, max:Number):Number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}