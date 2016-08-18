import fs = require('fs');
import bluebird = require('bluebird');
import Constants from './Constants';
import Utils from './Utils';
import Spawnpoint from "model/Spawnpoint";
import Pokemon from "model/Pokemon";

import TestData from "./TestData";

const log:any = Utils.getLogger('Scratch');

export default class ResponseParser {

	static parsePokemon(pogobufMapResponse):Array<Pokemon> {
		let wilds = pogobufMapResponse.wild_pokemons;
	}
}