let fs = require('fs');
import Constants from './Constants';
import Utils from './Utils';

let SAMPLE_POGOBUF_JSON_PATH = 'sampledata/map_cell.json';
let FAKE_POGOBUF_JSON_PATH = 'sampledata/map_cell_filtered.json';

let samplePogobufMapResponse;
let fakePogobufMapResponse;

export default class TestData {

    static getSamplePogobufMapResponse() {
        if (!samplePogobufMapResponse) {
            samplePogobufMapResponse = JSON.parse((fs.readFileSync(SAMPLE_POGOBUF_JSON_PATH)));
        }
        return samplePogobufMapResponse;
    }

    static getFakePogobufMapResponseWithSpawn(spawnpointId:String, lat:Number, long:Number) {
        if (!fakePogobufMapResponse) {
            fakePogobufMapResponse = JSON.parse((fs.readFileSync(FAKE_POGOBUF_JSON_PATH)));
        }

        fakePogobufMapResponse.current_timestamp_ms = new Date().getTime();

        let pkmn = fakePogobufMapResponse.wild_pokemons[0];
        if (pkmn) {
            pkmn.latitude = lat;
            pkmn.longitude = long;
            pkmn.spawn_point_id = spawnpointId;
            pkmn.pokemon_data.pokemon_id = Utils.getRandomInt(1, 150);
            pkmn.encounter_id = Utils.getRandomInt(1000000, 99999999999999);
            pkmn.last_modified_timestamp_ms = new Date().getTime();
            pkmn.time_till_hidden_ms = Utils.getRandomInt(600000, 900000);
        }

        let gym = fakePogobufMapResponse.forts[0];
        if (gym) {
            gym.owned_by_team = Utils.getRandomInt(0, 3);
            gym.gym_points = Utils.getRandomInt(0, 50000);
            gym.guard_pokemon_id = Utils.getRandomInt(0, 151);
            gym.guard_pokemon_cp = Utils.getRandomInt(10, 4000);
            gym.last_modified_timestamp_ms = new Date().getTime();
        }

        return fakePogobufMapResponse;
    }
}