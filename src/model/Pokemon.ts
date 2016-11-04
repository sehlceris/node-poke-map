import fs = require('fs');
import bluebird = require('bluebird');
import Constants from '../Constants';
import Utils from '../Utils';
import Spawnpoint from "./Spawnpoint";

const log:any = Utils.getLogger('Pokemon');

let pokedex = JSON.parse(fs.readFileSync(Constants.POKEDEX_JSON_PATH, 'utf8'));

/**
 * Represents a Pokemon
 */
export interface PokemonData {
    encounterId:String;
    number:Number;
    name:String;
    spawnpointId:String;
    disappearTime:Date;
    disappearTimeMs:Number;
    lat:Number;
    long:Number;
    lastModifiedTime:Number;
    timeUntilHidden:Number;
}

/**
 * A Pokemon
 */
export default class Pokemon {

    encounterId:String;
    number:Number;
    name:String;
    spawnpointId:String;
    disappearTime:Date;
    disappearTimeMs:Number;
    lat:Number;
    long:Number;
    lastModifiedTime:Number;
    timeUntilHidden:Number;

    constructor(data:PokemonData) {
        this.encounterId = data.encounterId;
        this.spawnpointId = data.spawnpointId;
        this.disappearTime = data.disappearTime;
        this.disappearTimeMs = data.disappearTimeMs;
        this.lat = data.lat;
        this.long = data.long;
        this.lastModifiedTime = data.lastModifiedTime;
        this.timeUntilHidden = data.timeUntilHidden;
        this.number = data.number;

        this.name = Pokemon.getNameByPokedexNumber(this.number);
    }

    /**
     * Given a Pokedex number, returns the name of the Pokemon
     * @param {Number} number Pokedex number
     * @returns {String} name of Pokemon
     */
    static getNameByPokedexNumber(number:number):String {
        return pokedex.find((x) => x.number === number).name;
    }

    /**
     * Turns this Pokemon instance into a regular serializable object
     * @returns {PokemonData} Pokemon data
     */
    toObject():PokemonData {
        return {
            encounterId: this.encounterId,
            number: this.number,
            name: this.name,
            spawnpointId: this.spawnpointId,
            disappearTime: this.disappearTime,
            disappearTimeMs: this.disappearTimeMs,
            lat: this.lat,
            long: this.long,
            lastModifiedTime: this.lastModifiedTime,
            timeUntilHidden: this.timeUntilHidden,
        }
    }

    /**
     * Generates a String representing this Pokemon
     * @returns {string} String representation of this Pokemon
     */
    toString():String {
        let str = `PKMN ${this.number} ${this.name} | eid=${this.encounterId} sid=${this.spawnpointId} | ${this.lat}, ${this.long} | dis=${this.disappearTime}`;
        return str;
    }
}