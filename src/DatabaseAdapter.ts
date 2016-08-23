let Mongo = require('mongodb');
let MongoClient = Mongo.MongoClient;
import bluebird = require('bluebird');
import Constants from './Constants';
import Config from './Config';
import Utils from './Utils';
import Pokemon from "model/Pokemon";

const log:any = Utils.getLogger('DatabaseAdapter');

const REAL_POKEMON_COLLECTION_NAME = 'Pokemon';
const SIMULATED_POKEMON_COLLECTION_NAME = 'SimulatedPokemon';

const POKEMON_COLLECTION_NAME = Config.simulate ? SIMULATED_POKEMON_COLLECTION_NAME : REAL_POKEMON_COLLECTION_NAME;

export class DatabaseAdapter {

	dbConnectionPromise:Promise<any>;

	constructor() {

		let username = Config.mongoDbUsername;
		let password = Config.mongoDbPassword;
		let host = Config.mongoDbHost;
		let port = Config.mongoDbPort;
		let databaseName = Config.mongoDbDatabaseName;

		let url = `mongodb://${username}:${password}@${host}:${port}/${databaseName}?authMechanism=DEFAULT&authSource=${databaseName}`;

		log.info(`Connecting to MongoDB: ${host}:${port}/${databaseName}`);
		this.dbConnectionPromise = new Promise((resolve, reject) => {
			MongoClient.connect(url, (err, db) => {
				if (err) {
					return reject(err);
				}
				return resolve(db);
			});
		});

		this.dbConnectionPromise
			.then((db) => {
				log.info(`connected to MongoDB`);
			})
			.catch((err) => {
				log.error(`Failed to connect to DB: ${err}. Exiting application.`);
				process.exit(1);
			});
	}

	getActivePokemon():Promise {
		return dbConnectionPromise
			.then((db) => {
				return db.collection(POKEMON_COLLECTION_NAME).find({
					disappearTime: {
						$gte: new Date()
					}
				}).toArray();
			});
	}

	upsertPokemon(pkmn:Pokemon):Promise {
		return this.dbConnectionPromise
			.then((db) => {
				log.debug(`upserting ${pkmn.toString()}`);
				return db.collection(POKEMON_COLLECTION_NAME).updateOne({
					$and: [
						{spawnpointId: pkmn.spawnpointId},
						{encounterId: pkmn.encounterId},
					]
				}, {
					$set: pkmn.toObject()
				}, {
					upsert: true
				});
			})
			.then((result) => {
				log.debug(`successfully upserted ${result}`);
			})
			.catch((err) => {
				log.error(`error upserting pokemon: ${err}`);
			})
	}
}

let adapterInstance = new DatabaseAdapter();
export default adapterInstance;