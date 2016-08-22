import fs = require('fs');
import bluebird = require('bluebird');
import Constants from '../Constants';
import Utils from '../Utils';
import Spawnpoint from "./Spawnpoint";

const log:any = Utils.getLogger('Pokemon');

let pokedex = JSON.parse(fs.readFileSync(Constants.POKEDEX_JSON_PATH, 'utf8'));

export interface PokemonData {
    encounterId:String;
    number:Number;
    name:String;
    spawnpointId:Spawnpoint;
    disappearTime:Date;
    disappearTimeMs:Number;
    lat:Number;
    long:Number;
    lastModifiedTime:Number;
    timeUntilHidden:Number;
}

export default class Pokemon {

    encounterId:String;
    number:Number;
    name:String;
    spawnpointId:Spawnpoint;
    disappearTime:Date;
    disappearTimeMs:Number;
    lat:Number;
    long:Number;
    lastModifiedTime:Number;
    timeUntilHidden:Number;

    constructor(data:any) {
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

    static getNameByPokedexNumber(number:number):String {
        return pokedex.find((x) => x.number === number).name;
    }

    toString():String {
        let str = `PKMN ${this.number} ${this.name} | eid=${this.encounterId} sid=${this.spawnpointId} | ${this.lat}, ${this.long} | dis=${this.disappearTime}`;
        return str;
    }
}