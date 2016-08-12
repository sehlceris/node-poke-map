let fs = require('fs');
import Constants from 'Constants';

let gyms;
let geoGyms;
let stops;
let geoStops;
let pokemon;
let spawns;

export default class Data {

    static getGyms() {
        if (!gyms) {
            gyms = JSON.parse((fs.readFileSync(Constants.GYMS_JSON_PATH)));
        }
        return gyms;
    }

    static getGeoGyms() {
        if (!geoGyms) {
            geoGyms = JSON.parse((fs.readFileSync(Constants.GEO_GYMS_JSON_PATH)));
        }
        return geoGyms;
    }

    static getStops() {
        if (!stops) {
            stops = JSON.parse((fs.readFileSync(Constants.STOPS_JSON_PATH)));
        }
        return stops;
    }

    static getGeoStops() {
        if (!geoStops) {
            geoStops = JSON.parse((fs.readFileSync(Constants.GEO_STOPS_JSON_PATH)));
        }
        return geoStops;
    }

    static getPokemon() {
        if (!pokemon) {
            pokemon = JSON.parse((fs.readFileSync(Constants.POKEMON_JSON_PATH)));
        }
        return pokemon;
    }

    static getSpawns() {
        if (!spawns) {
            spawns = JSON.parse((fs.readFileSync(Constants.SPAWNS_JSON_PATH)));
        }
        return spawns;
    }
}