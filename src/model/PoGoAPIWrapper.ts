import fs = require('fs');
import bluebird = require('bluebird');
import Constants from '../Constants';
import Utils from '../Utils';

const log = Utils.getLogger('Pokemon');

let pokedex = JSON.parse(fs.readFileSync(Constants.POKEDEX_JSON_PATH, 'utf8'));

export default class Pokemon {

    number:number;
    name:string;
    spawnpointId:string;
    encounterId:string;

    constructor(number, name) {
        this.number = number;
        this.name = name;
    }

    static getPokedex(number:number):Pokemon {
        return pokedex.find((x) => x.number === number);
    }
}