let moment = require('moment');
let Int64 = require('node-int64')
import fs = require('fs');
import bluebird = require('bluebird');
import Constants from './Constants';
import Utils from './Utils';
import Spawnpoint from "./model/Spawnpoint";
import Pokemon from "./model/Pokemon";

import TestData from "./TestData";

const log:any = Utils.getLogger('ResponseParser');

export default class ResponseParser {

	static parsePokemon(pogobufMapResponse):Array<Pokemon> {
		let wilds = pogobufMapResponse.wild_pokemons;
		let pokes = wilds.map((wild) => {
			let encounterIdInt64 = new Int64(wild.encounter_id.high, wild.encounter_id.low);
			let encodedEncounterId = Utils.btoa(encounterIdInt64.toString());
			log.info(`encounter id: ${encodedEncounterId}  ${encounterIdInt64}`);

			let lastModifiedTimestampMsInt64 = new Int64(wild.last_modified_timestamp_ms.high, wild.last_modified_timestamp_ms.low);

			let disappearTimeMs;
			if (wild.time_till_hidden_ms > 0 && wild.time_till_hidden_ms < 3600000) {
				disappearTimeMs = lastModifiedTimestampMsInt64 + wild.time_till_hidden_ms;
			}
			else {
				disappearTimeMs = lastModifiedTimestampMsInt64 + 900000;
			}
			let disappearTime = moment(disappearTimeMs);
			log.info(`disappear time: ${disappearTime} | ${disappearTimeMs}`);

			let pkmnData = {
				encounterId: encodedEncounterId,
				spawnpointId: wild.spawn_point_id,
				number: wild.pokemon_data.pokemon_id,
				disappearTime: disappearTime,
				lat: wild.latitude,
				long: wild.longitude,
				lastModifiedTime: wild.last_modified_timestamp_ms,
				timeUntilHidden: wild.time_till_hidden_ms
			};
			log.info(JSON.stringify(pkmnData));

			let pkmn = new Pokemon(pkmnData);

			return pkmn;
		});

		return pokes;
	}
}