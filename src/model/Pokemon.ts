import fs = require('fs');
import bluebird = require('bluebird');
import Constants from '../Constants';
import Utils from '../Utils';
import Spawnpoint from "./Spawnpoint";

const log:any = Utils.getLogger('Pokemon');

let pokedex = JSON.parse(fs.readFileSync(Constants.POKEDEX_JSON_PATH, 'utf8'));

export default class Pokemon {

	number:Number;
	name:String;
	spawnpoint:Spawnpoint;
	spawnTime:Date;
	spawnDuration:Number;
	encounterId:String;

	constructor(number, name) {
		this.number = number;
		this.name = name;
	}

	static getPokedex(number:number):Pokemon {
		return pokedex.find((x) => x.number === number);
	}
}