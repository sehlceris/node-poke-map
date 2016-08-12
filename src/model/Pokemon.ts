import fs = require('fs');
import Constants from '../Constants';

let pokedex = JSON.parse(fs.readFileSync(Constants.POKEDEX_PATH, 'utf8'));

export default class Pokemon {

    number:number;
    name:string;

    constructor(number, name) {
        this.number = number;
        this.name = name;
    }

    static getPokedex(number:number):Pokemon {
        return pokedex.find((x) => x.number === number);
    }
}