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

const log:any = Utils.getLogger('RequestHandler');

export class RequestHandler {

    app:express.Application;
    pogoMapGymData:any;
    pogoMapStopData:any;

    constructor() {
        this.app = express();

        this.app.get('/raw_data', this.handlePogoMapRawDataRequest.bind(this));
        this.app.get('/search_control', this.handlePogoMapSearchControlGetRequest.bind(this));
        this.app.post('/search_control', this.handlePogoMapSearchControlPostRequest.bind(this));
    }

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

    handlePogoMapSearchControlGetRequest(req, res) {
        res.json({"status": (!Config.pauseScanning)});
    }

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

    handlePogoMapRawDataRequest(req, res) {
        DatabaseAdapter.getActivePokemon()
            .then((results) => {
                let response = {};
                response.gyms = this.getPogoMapGyms();
                response.scanned = [];
                response.pokestops = this.getPogoMapStops();
                response.pokemons = results.map((pkmnData:PokemonData) => {

                    let disappearTime = pkmnData.disappearTimeMs;
                    if (Config.simulate) {
                        let now = new Date().getTime();
                        let diff = disappearTime - now;
                        diff = Utils.timestepTransformDown(diff);
                        disappearTime = now + diff;
                    }

                    return {
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
                res.json(response);
            })
            .catch((err) => {
                log.error(err);
                res.status(500).json({
                    error: err
                });
            })
    }

    getPogoMapGyms() {
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