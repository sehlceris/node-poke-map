import Mongo = require('mongodb');
import express = require('express');
import Application = express.Application;
import bluebird = require('bluebird');
import Constants from './Constants';
import Config from './Config';
import DatabaseAdapter from './DatabaseAdapter';
import Utils from './Utils';
import {PokemonData} from "./model/Pokemon";

const log:any = Utils.getLogger('RestHandler');

export class RestHandler {

    app:express.Application;

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
                response.gyms = [];
                response.scanned = [];
                response.pokestops = [];
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
}

let instance = new RestHandler();
export default instance;