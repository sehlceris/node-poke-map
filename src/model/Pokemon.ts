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
	lat:Number;
	long:Number;
	lastModifiedTime:Number;
	timeUntilHidden:Number;

	constructor(data:any) {
		this.encounterId = data.encounterId;
		this.spawnpointId = data.spawnpointId;
		this.disappearTime = data.disappearTime;
		this.lat = data.lat;
		this.long = data.long;
		this.lastModifiedTime = data.lastModifiedTime;
		this.timeUntilHidden = data.timeUntilHidden;
		this.number = data.number;

		this.name = Pokemon.getPokedex(this.number);
	}

	static getPokedex(number:number):Pokemon {
		return pokedex.find((x) => x.number === number);
	}
}