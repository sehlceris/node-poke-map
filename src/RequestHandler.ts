import Mongo = require('mongodb');
import express = require('express');
import Application = express.Application;
import bluebird = require('bluebird');
import Constants from './Constants';
import Config from './Config';
import Data from './Data';
import DatabaseAdapter from './DatabaseAdapter';
import Utils from './Utils';
import {PokemonData} from "./model/Pokemon";
import {GymData} from "./model/Gym";

const log:any = Utils.getLogger('RequestHandler');

export class RequestHandler {

    app:express.Application; //instance of express
    pogoMapGymData:any;
    pogoMapStopData:any; //array of pokestops, read from JSON

    constructor() {
        this.app = express();

        //set up API endpoints
        this.app.get('/raw_data', this.handlePogoMapRawDataRequest.bind(this));
        this.app.get('/search_control', this.handlePogoMapSearchControlGetRequest.bind(this));
        this.app.post('/search_control', this.handlePogoMapSearchControlPostRequest.bind(this));
    }

    /**
     * Starts listening for API requests, and starts serving static www data
     * @returns {Promise}
     */
    startListening():Promise {
        return new Promise((resolve, reject) => {
            this.app.listen(Config.restPort, (err) => {
                try {
                    if (err) {
                        return reject(err);
                    }
                    this.app.use(express.static('www'));
                    return resolve();
                }
                catch (e) {
                    return reject(e);
                }
            });
        });
    }

    /**
     * Event handler for API endpoint to get status of Pokemon scanning (whether it is paused or not)
     * @param {Request} req express request object
     * @param {Response} res express response object
     */
    handlePogoMapSearchControlGetRequest(req, res) {
        res.json({"status": (!Config.pauseScanning)});
    }

    /**
     * Event handler for API endpoint to pause/resume Pokemon scanning
     * @param {Request} req express request object
     * @param {Response} res express response object
     */
    handlePogoMapSearchControlPostRequest(req, res) {
        if (req.query.action === 'off') {
            Config.pauseScanning = true;
            log.info('scanning paused');
        }
        else if (req.query.action === 'on') {
            Config.pauseScanning = false;
            log.info('scanning started');
        }
        res.json(!!Config.pauseScanning);
    }

    /**
     * Event handler for API endpoint to get data for active Pokemon/Gyms/Pokestops
     * @param {Request} req express request object
     * @param {Response} res express response object
     */
    handlePogoMapRawDataRequest(req, res) {

        let pokemonPromise = DatabaseAdapter.getActivePokemon();
        let gymsPromise = DatabaseAdapter.getGyms();

        Promise.all([pokemonPromise, gymsPromise])
            .then((values) => {
                var [pokemonResults, gymResults] = values;

                let response:any = {};
                response.scanned = [];
                response.pokestops = this.getPogoMapStops();

                response.pokemons = pokemonResults.map((pkmnData:PokemonData) => {

                    let disappearTime = pkmnData.disappearTimeMs;

                    //if simulating, make the pokemon appear to despawn faster (depending on simulation timestep)
                    if (Config.simulate) {
                        let now = new Date().getTime();
                        let diff = disappearTime - now;
                        diff = Utils.timestepTransformDown(diff);
                        disappearTime = now + diff;
                    }

                    //because the UI is lifted from another open-source project, we transform our database results to conform to the UI's expectations for JSON format
                    return {
                        "disappear_time": disappearTime,
                        "disappear_time": disappearTime,
                        "encounter_id": pkmnData.encounterId,
                        "latitude": pkmnData.lat,
                        "longitude": pkmnData.long,
                        "pokemon_id": pkmnData.number,
                        "pokemon_name": pkmnData.name,
                        "pokemon_rarity": "Common",
                        "pokemon_types": [{
                            "color": "#8a8a59",
                            "type": "Normal"
                        }],
                        "spawnpoint_id": pkmnData.spawnpointId
                    };
                });

                response.gyms = gymResults.map((gymData:GymData) => {
                    // var sample = {
                    //     "enabled": true,
                    //     "guard_pokemon_id": 144,
                    //     "gym_id": dat.id,
                    //     "gym_points": 1337,
                    //     "last_modified": new Date().getTime(),
                    //     "latitude": dat.lat,
                    //     "longitude": dat.lng,
                    //     "team_id": 1
                    // }

                    //because the UI is lifted from another open-source project, we transform our database results to conform to the UI's expectations for JSON format
                    return {
                        "gym_id": gymData.id,
                        "enabled": true,
                        "guard_pokemon_id": gymData.guard_pokemon_id,
                        "guard_pokemon_cp": gymData.guard_pokemon_cp,
                        "gym_points": gymData.gym_points,
                        "last_modified": gymData.last_modified_timestamp_ms,
                        "latitude": gymData.latitude,
                        "longitude": gymData.longitude,
                        "team_id": gymData.owned_by_team
                    }
                });

                res.json(response);

            });
    }

    getPogoMapGyms():Promise<Array<GymData>> {
        if (typeof this.pogoMapGymData === 'undefined') {
            this.pogoMapGymData = [];
            let data = Data.getGyms();
            this.pogoMapGymData = data.map((dat) => {
                return {
                    "enabled": true,
                    "guard_pokemon_id": 144,
                    "gym_id": dat.id,
                    "gym_points": 1337,
                    "last_modified": new Date().getTime(),
                    "latitude": dat.lat,
                    "longitude": dat.lng,
                    "team_id": 1
                };
            });
        }
        return this.pogoMapGymData;
    }

    /**
     * Gets a list of Pokestops, formatted for the UI's JSON structure expectations
     * @returns {Array} List of pokestops
     */
    getPogoMapStops() {
        if (typeof this.pogoMapStopData === 'undefined') {
            this.pogoMapStopData = [];
            let data = Data.getStops();
            this.pogoMapStopData = data.map((dat) => {
                return {
                    "pokestop_id": dat.id,
                    "lure_expiration": false,
                    "latitude": dat.lat,
                    "longitude": dat.lng,
                };
            });
        }
        return this.pogoMapStopData;
    }
}

let instance = new RequestHandler();
export default instance;