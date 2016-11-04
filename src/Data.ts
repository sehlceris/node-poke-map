let fs = require('fs');
import Constants from './Constants';

let gyms;
let geoGyms;
let stops;
let geoStops;
let pokemon;
let spawns;
let workers;

export default class Data {

    /**
     * Synchronously gets worker login information from JSON
     * @returns {Array} Worker login information
     */
    static getWorkers():Array {
        if (!workers) {
            workers = JSON.parse((fs.readFileSync(Constants.WORKERS_JSON_PATH)));
        }
        return workers;
    }

    /**
     * Synchronously gets Pokestop data from JSON
     * @returns {Array} Pokestop data
     */
    static getStops():Array {
        if (!stops) {
            stops = JSON.parse((fs.readFileSync(Constants.STOPS_JSON_PATH)));
        }
        return stops;
    }

    /**
     * Synchronously gets Spawnpoint data from JSON
     * @returns {Array} Spawnpoint data
     */
    static getSpawns():Array {
        if (!spawns) {
            spawns = JSON.parse((fs.readFileSync(Constants.SPAWNS_JSON_PATH)));
        }
        return spawns;
    }

    /**
     * Synchronously gets Spawnpoint data (with elevations added) from JSON
     * @returns {Array} Spawnpoint data, with elevations added
     */
    static getSpawnsWithElevation():Array {
        if (!spawns) {
            spawns = JSON.parse((fs.readFileSync(Constants.SPAWNS_WITH_ELEVATIONS_JSON_PATH)));
        }
        return spawns;
    }
}