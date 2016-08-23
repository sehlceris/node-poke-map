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

		this.app.get('/', (req, res) => {
			res.send('Hello World!');
		});

		this.app.get('/raw_data', this.handlePogoMapRequest.bind(this));
	}

	startListening():Promise {
		return new Promise((resolve, reject) => {
			this.app.listen(Config.restPort, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
	}

	handlePogoMapRequest(req, res) {
		DatabaseAdapter.getActivePokemon()
			.then((results) => {
				let response = {};
				response.gyms = [];
				response.scanned = [];
				response.pokemons = results.map((pkmnData:PokemonData) => {
					return {
						"disappear_time": pkmnData.disappearTimeMs,
						"encounter_id": pkmnData.encounterId,
						"latitude": pkmnData.lat,
						"longitude": pkmnData.long,
						"pokemon_id": pkmnData.number,
						"pokemon_name": pkmnData.name,
						"pokemon_rarity": "",
						"pokemon_types": [],
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