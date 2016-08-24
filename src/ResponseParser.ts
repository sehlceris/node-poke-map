let Int64 = require('node-int64')
import fs = require('fs');
import bluebird = require('bluebird');
import Constants from './Constants';
import Utils from './Utils';
import Spawnpoint from "./model/Spawnpoint";
import Pokemon from "./model/Pokemon";

const log:any = Utils.getLogger('ResponseParser');

export default class ResponseParser {

    static parsePokemon(pogobufMapResponse):Array<Pokemon> {
        let wilds = pogobufMapResponse.wild_pokemons;
        let pokes = wilds.map((wild) => {

            // THIS IS THE OLD WAY OF PARSING WITH INT64s
            // let encounterIdInt64 = new Int64(wild.encounter_id.high, wild.encounter_id.low);
            // let encounterIdOctetString:String = encounterIdInt64.toOctetString();
            //
            // let lastModifiedTimestampMsInt64 = new Int64(wild.last_modified_timestamp_ms.high, wild.last_modified_timestamp_ms.low);
            //
            // let disappearTimeMs;
            // if (wild.time_till_hidden_ms > 0 && wild.time_till_hidden_ms < 3600000) {
            //     // If time till hidden is less than 0 or greater than an hour, it's bugged and is wrong.
            //     // However, it has been observed that Pokemon bugged like this will remain for at least 15 minutes - so we show it with a 15 minute despawn timer.
            //     disappearTimeMs = lastModifiedTimestampMsInt64 + wild.time_till_hidden_ms;
            // }
            // else {
            //     disappearTimeMs = lastModifiedTimestampMsInt64 + 900000;
            // }
            // let disappearTime = new Date(disappearTimeMs);
            //
            // let lastModifiedTimestampMsInt64 = new Int64(wild.last_modified_timestamp_ms.high, wild.last_modified_timestamp_ms.low);
            //
            // let disappearTimeMs;
            // if (wild.time_till_hidden_ms > 0 && wild.time_till_hidden_ms < 3600000) {
            //     // If time till hidden is less than 0 or greater than an hour, it's bugged and is wrong.
            //     // However, it has been observed that Pokemon bugged like this will remain for at least 15 minutes - so we show it with a 15 minute despawn timer.
            //     disappearTimeMs = lastModifiedTimestampMsInt64 + wild.time_till_hidden_ms;
            // }
            // else {
            //     disappearTimeMs = lastModifiedTimestampMsInt64 + 900000;
            // }
            // let disappearTime = new Date(disappearTimeMs);

            let encounterId = wild.encounter_id;
            let timeTillHiddenMs = wild.time_till_hidden_ms;
            let disappearTimeMs = new Date().getTime() + timeTillHiddenMs;
            let disappearTime = new Date(disappearTimeMs);

            let pkmnData = {
                encounterId: encounterId,
                spawnpointId: wild.spawn_point_id,
                number: wild.pokemon_data.pokemon_id,
                disappearTimeMs: disappearTimeMs,
                disappearTime: disappearTime,
                lat: wild.latitude,
                long: wild.longitude,
                lastModifiedTime: wild.last_modified_timestamp_ms,
                timeUntilHidden: wild.time_till_hidden_ms
            };
            log.debug(JSON.stringify(pkmnData));

            let pkmn = new Pokemon(pkmnData);

            return pkmn;
        });

        return pokes;
    }
}