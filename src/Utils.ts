import winston = require('winston');
import Logger = winston.Logger;

export default class Utils {

    static getLogger(logTag:string):Logger {
        var logger = new (winston.Logger)({
            transports: [
                new (winston.transports.Console)({
                    timestamp: function () {
                        return Date.now();
                    },
                    formatter: function (options) {
                        // Return string will be passed to logger.
                        return options.timestamp() + ' [' + logTag + '] ' + options.level.toUpperCase() + ' ' + (undefined !== options.message ? options.message : '') +
                            (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '' );
                    }
                })
            ]
        });
        return logger;
    }
}