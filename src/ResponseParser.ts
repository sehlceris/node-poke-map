let moment = require('moment');
import fs = require('fs');
import bluebird = require('bluebird');
import Constants from './Constants';
import Utils from './Utils';
import Spawnpoint from "model/Spawnpoint";
import Pokemon from "model/Pokemon";

import TestData from "./TestData";

const log:any = Utils.getLogger('ResponseParser');

export default class ResponseParser {

	static parsePokemon(pogobufMapResponse):Array<Pokemon> {
		let wilds = pogobufMapResponse.wild_pokemons;
		let pokes = wilds.map((wild) => {
			let combinedEncounterId = String(wild.encounter_id.high) + String(wild.encounter_id.low);
			let encodedEncounterId = Utils.btoa(combinedEncounterId);
			log.info(`encounter id: ${encodedEncounterId}  ${combinedEncounterId}`);

			let disappearTimeMs;
			if (wild.time_till_hidden_ms > 0 && wild.time_till_hidden_ms < 3600000) {
				let disappearTimeMs = wild.last_modified_timestamp_ms + wild.time_till_hidden_ms;
			}
			else {
				let disappearTimeMs = wild.last_modified_timestamp_ms + 900000;
			}
			let disappearTime = moment.fromUtc(disappearTimeMs);

			let pkmn = new Pokemon({
				encounterId: encodedEncounterId,
				spawnpointId: wild.spawn_point_id,
				number: wild.pokemon_data.pokemon_id,
				disappearTime: disappearTime,
				lat: wild.latitude,
				long: wild.longitude,
				lastModifiedTime: wild.last_modified_timestamp_ms,
				timeUntilHidden: wild.time_till_hidden_ms
			});
		});

		return pokes;
	}
}