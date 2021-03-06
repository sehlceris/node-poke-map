import {GymData} from "./model/Gym";
let Int64 = require('node-int64')
import fs = require('fs');
import bluebird = require('bluebird');
import Constants from './Constants';
import Utils from './Utils';
import Spawnpoint from "./model/Spawnpoint";
import Pokemon from "./model/Pokemon";

const log:any = Utils.getLogger('ResponseParser');

/**
 * Parses data out from the Niantic map API response
 */
export default class ResponseParser {

    /**
     * Parses Pokemon spawns from the Niantic map API response
     * @param {Object} pogobufMapResponse Niantic map API response
     * @returns {Array<Pokemon>} Spawned Pokemon
     */
    static parsePokemon(pogobufMapResponse):Array<Pokemon> {
        let wilds = pogobufMapResponse.wild_pokemons;
        let pokes = wilds.map((wild) => {

            let encounterId = wild.encounter_id;
            let timeTillHiddenMs;
            if (wild.time_till_hidden_ms > 0 && wild.time_till_hidden_ms < 3600000) {
                // If time till hidden is less than 0 or greater than an hour, it's bugged and is wrong.
                // However, it has been observed that Pokemon bugged like this will remain for at least 15 minutes - so we show it with a 15 minute despawn timer.
                timeTillHiddenMs = wild.time_till_hidden_ms;
            }
            else {
                timeTillHiddenMs = 900000;
            }
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

    /**
     * Parses Gyms from a Pogobuf map API response
     * @param {Object} pogobufMapResponse map API response from Niantic server
     * @returns {Array<GymData>} list of Gyms
     */
    static parseGyms(pogobufMapResponse):Array<GymData> {
        return pogobufMapResponse.forts.filter((fort) => {
            return (fort.type === 0);
        });
    }
}