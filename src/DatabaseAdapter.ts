let Mongo = require('mongodb');
let MongoClient = Mongo.MongoClient;
import bluebird = require('bluebird');
import Constants from './Constants';
import Config from './Config';
import Utils from './Utils';
import Pokemon from "model/Pokemon";

const log:any = Utils.getLogger('DatabaseAdapter');

let username = Config.mongoDbUsername;
let password = Config.mongoDbPassword;
let host = Config.mongoDbHost;
let port = Config.mongoDbPort;
let databaseName = Config.mongoDbDatabaseName;

let url = `mongodb://${username}:${password}@${host}:${port}/?authMechanism=DEFAULT&authSource=${databaseName}`;

log.info(`Connecting to MongoDB: ${host}:${port}/${databaseName}`);
let dbConnectionPromise = new Promise((resolve, reject) => {
	MongoClient.connect(url, (err, db) => {
		if (err) {
			return reject(err);
		}
		return resolve(db);
	});
});

dbConnectionPromise
	.then((db) => {
		log.info(`connected to MongoDB`);
	})
	.catch((err) => {
		log.error(`Failed to connect to DB: ${err}. Exiting application.`);
		process.exit(1);
	});

export default class DatabaseAdapter {

	constructor() {

	}

	static getActivePokemon():Promise {
		return dbConnectionPromise
			.then(() => {

			});
	}

	static upsertPokemon(pkmn:Pokemon):Promise {
		return dbConnectionPromise
			.then(() => {

			});
	}
}