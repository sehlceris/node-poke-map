import {GymData} from "./model/Gym";
let Mongo = require('mongodb');
let MongoClient = Mongo.MongoClient;
import bluebird = require('bluebird');
import Constants from './Constants';
import Config from './Config';
import Utils from './Utils';
import {PokemonData, Pokemon} from "model/Pokemon";
import {GymData} from "model/Gym";

const log:any = Utils.getLogger('DatabaseAdapter');

const REAL_POKEMON_COLLECTION_NAME = 'Pokemon';
const SIMULATED_POKEMON_COLLECTION_NAME = 'SimulatedPokemon';

const REAL_GYM_COLLECTION_NAME = 'Gym';
const SIMULATED_GYM_COLLECTION_NAME = 'SimulatedGym';

const POKEMON_COLLECTION_NAME = Config.simulate ? SIMULATED_POKEMON_COLLECTION_NAME : REAL_POKEMON_COLLECTION_NAME;
const GYM_COLLECTION_NAME = Config.simulate ? SIMULATED_GYM_COLLECTION_NAME : REAL_GYM_COLLECTION_NAME;

/**
 * Performs various tasks against the database (read/write)
 */
export class DatabaseAdapter {

    dbConnectionPromise:Promise<any>; //promise of a connection to the database

    /**
     * Connect to the database
     */
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
                log.info(`connected to MongoDB (using pokemon collection ${POKEMON_COLLECTION_NAME})`);
            })
            .catch((err) => {
                log.error(`Failed to connect to DB: ${err}. Exiting application.`);
                process.exit(1);
            });
    }

    /**
     * Gets a list of Pokemon that are active (that is, currently spawned in the world)
     * @returns {Promise<Array<PokemonData>>} List of Pokemon that are active
     */
    getActivePokemon():Promise<Array<PokemonData>> {
        let startQueryTime = new Date();
        return this.dbConnectionPromise
            .then((db) => {
                return db.collection(POKEMON_COLLECTION_NAME).find({
                    disappearTime: {
                        $gte: new Date()
                    }
                }).toArray();
            })
            .then((results) => {
                let endQueryTime = new Date();
                let queryTime = endQueryTime.getTime() - startQueryTime.getTime();
                log.silly(`active pokemon database query time: ${queryTime}`);
                return results;
            });
    }

    /**
     * Gets list of Gyms
     * @returns {Promise<Array<GymData>>} List of Gyms
     */
    getGyms():Promise<Array<GymData>> {
        let startQueryTime = new Date();
        return this.dbConnectionPromise
            .then((db) => {
                return db.collection(GYM_COLLECTION_NAME).find().toArray();
            })
            .then((results) => {
                let endQueryTime = new Date();
                let queryTime = endQueryTime.getTime() - startQueryTime.getTime();
                log.silly(`gyms database query time: ${queryTime}`);
                return results;
            });
    }

    /**
     * Upserts a scanned Pokemon into the database
     * @param {Pokemon} pkmn Pokemon
     * @returns {Promise}
     */
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
                log.debug(`successfully upserted pokemon ${result}`);
                return result;
            })
            .catch((err) => {
                log.error(`error upserting pokemon: ${err}`);
            })
    }

    /**
     * Upserts a scanned gym to the database
     * @param {GymData} gymData Gym
     * @returns {Promise}
     */
    upsertGym(gymData:GymData):Promise {
        return this.dbConnectionPromise
            .then((db) => {
                log.debug(`upserting gym ${gymData.id}`);
                return db.collection(GYM_COLLECTION_NAME).updateOne({
                    $and: [
                        {id: gymData.id},
                        {latitude: gymData.latitude},
                        {longitude: gymData.longitude}
                    ]
                }, {
                    $set: gymData
                }, {
                    upsert: true
                });
            })
            .then((result) => {
                log.debug(`successfully upserted gym ${result}`);
                return result;
            })
            .catch((err) => {
                log.error(`error upserting gym: ${err}`);
            })
    }
}

let adapterInstance = new DatabaseAdapter();
export default adapterInstance;