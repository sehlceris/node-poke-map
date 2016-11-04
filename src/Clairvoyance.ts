import {GymData} from "./model/Gym";
let pogobuf = require('pogobuf');
let geolib = require('geolib');
import bluebird = require('bluebird');

import Pokemon from './model/Pokemon';
import PluginManager from './PluginManager';
import Spawnpoint from './model/Spawnpoint';
import Worker from './model/Worker';
import WorkerPool from './model/WorkerPool';
import RequestQueue from './model/RequestQueue';
import Utils from './Utils';
import Config from './Config';
import Constants from './Constants';
import DatabaseAdapter from "./DatabaseAdapter";
import ResponseParser from "./ResponseParser";
import RestHandler from "./RequestHandler";
import Data from './Data';

import Utils from 'Utils';

const log:any = Utils.getLogger('Main');

let instance = null;

/**
 * Main application class. Starts scanning/simulating Pokemon, logging health checks, and making sure workers aren't banned.
 */
export class Clairvoyance {

    spawnpoints:Array<Spawnpoint>; //list of spawnpoints that will be scanned
    requestQueue:RequestQueue; //queue of scans to be processed
    workerPool:WorkerPool; //pool of workers that can perform scans
    pluginManager:PluginManager; //holds instances of plugins and sends spawn events to them
    healthCheckInterval:number; //ms; interval at which health checks are performed
    spawnCount:number; //number of times spawnpoints have become active (mostly just for statistics display)
    spawnsProcessed:number; //number of attempted scans for spawns (mostly just for statistics display)
    spawnsScannedSuccessfully:number; //number of successful scans for spawns (mostly just for statistics display)

    initTime:Date; //time that the scanner was started

    /**
     * Gets an instance of the Clairvoyance scanner, which should be a singleton
     * @returns {Clairvoyance} instance of the application
     */
    static getInstance():Clairvoyance {
        if (!instance) {
            instance = new Clairvoyance();
        }
        return instance;
    }

    constructor() {

        log.info(`**********************************************`);
        log.info(`CLAIRVOYANCE POKEMON GO SCANNER`);
        if (Config.simulate) {
            log.warn(`running in simulation mode with timestep ${Config.simulationTimeMultiplier}`);
        }

        this.spawnCount = 0;
        this.spawnsProcessed = 0;
        this.spawnsScannedSuccessfully = 0;
        this.initSpawnPoints();
        this.initWorkers();
        this.requestQueue = new RequestQueue();
        this.pluginManager = new PluginManager();

        RestHandler.startListening()
            .then((result) => {
                log.info(`REST listening on port ${Config.restPort}`);
            })
            .catch((err) => {
                log.error(`failed to listen for REST on port ${Config.restPort}: ${err}`);
                log.error('exiting application');
            });

        log.info(`initialized with ${this.spawnpoints.length} spawnpoints and ${this.workerPool.workers.length} workers`);

        this.initStatisticLogging();
        this.startHealthCheckInterval();
    }

    /**
     * Starts an interval to check if certain thresholds have been exceeded (e.g. too many accounts banned). If safety thresholds exceeded, exit the app
     */
    startHealthCheckInterval() {
        this.healthCheckInterval = setInterval(() => {
            let allocatedWorkers = this.workerPool.getAllocatedWorkers();
            let workersBanned = allocatedWorkers.filter((worker) => {
                return worker.isBanned();
            }).length;

            if (workersBanned > Config.globalMaximumBannedAccountsLimit) {
                log.error(`too many banned accounts (${workersBanned}) detected. exiting application`);
                process.exit(1);
            }
        }, Utils.timestepTransformDown(Config.healthCheckInterval));
    }

    /**
     * Reads spawnpoints from the JSON and starts timers to fire events when the spawnpoints activate
     */
    initSpawnPoints():void {

        if (this.spawnpoints) {
            return;
        }

        let spawns = Data.getSpawnsWithElevation();

        log.info(`Scan center: ${Config.scanCenterLat}, ${Config.scanCenterLong}`);

        //Filters spawnpoints to be within the specified scan radius
        let filteredSpawnPoints = spawns.filter((spawn) => {
            let result = geolib.isPointInCircle({
                latitude: Config.scanCenterLat,
                longitude: Config.scanCenterLong
            }, {
                latitude: spawn.lat,
                longitude: spawn.lng,
            }, Config.scanRadiusMeters);
            return result;
        });

        this.spawnpoints = filteredSpawnPoints.map((spawn) => {
            return new Spawnpoint(spawn);
        });

        this.spawnpoints.forEach((spawnpoint:Spawnpoint) => {
            spawnpoint.setSpawnListener(this.handleSpawn.bind(this));
            spawnpoint.startSpawnTimer();
        });
    }

    /**
     * Loops through all worker accounts defined in the configuration JSON, and adds them to the worker pool
     */
    initWorkers():void {
        if (this.workerPool) {
            return;
        }

        let workerLogins = Data.getWorkers();

        let workers = [];
        for (var i = 0; (i < Config.maxAccounts && i < workerLogins.length); i++) {
            let workerLogin = workerLogins[i];
            workers.push(new Worker(workerLogin));
        }

        this.workerPool = new WorkerPool(workers);
    }

    /**
     * Starts an interval to log out runtime statistics to the console or file, mostly for visual pleasure
     */
    //TODO: Refactor this into its own file
    initStatisticLogging():void {

        this.initTime = new Date();

        if (Config.statisticLoggingInterval < 1000) {
            return;
        }

        setInterval(() => {
            let minutesRunning = Math.round(((Utils.timestepTransformUp(new Date() - this.initTime) / 1000) / 60) * 10) / 10;

            let allocatedWorkers = this.workerPool.getAllocatedWorkers();

            let workersUsed = allocatedWorkers.length;
            let workersBanned = allocatedWorkers.filter((worker) => {
                return worker.isBanned();
            }).length;
            let workerAllocationFailures = this.workerPool.workerAllocationFailures;
            let workerAllocationFailuresPerMinuteStr = (workerAllocationFailures / minutesRunning).toFixed(2);

            let totalWorkerDistanceMoved = 0;
            let highestWorkerDistanceMoved = 0;
            let highestWorkerSpeedId = -1;
            let lowestWorkerDistanceMoved = Infinity;
            let lowestWorkerSpeedId = -1;
            let totalWorkerMovements = 0;
            let highestWorkerMovements = 0;
            let highestWorkerMovementsId = 0;
            let lowestWorkerMovements = Infinity;
            let lowestWorkerMovementsId = -1;
            let totalWorkerScans = 0;
            let highestWorkerScans = 0;
            let highestWorkerScansId = 0;
            let lowestWorkerScans = Infinity;
            let lowestWorkerScansId = -1;
            allocatedWorkers.forEach((worker) => {
                totalWorkerDistanceMoved += worker.totalMetersMoved;
                totalWorkerMovements += worker.totalMovements;
                totalWorkerScans += worker.totalScans;
                if (worker.totalMetersMoved > highestWorkerDistanceMoved) {
                    highestWorkerDistanceMoved = worker.totalMetersMoved;
                    highestWorkerSpeedId = worker.id;
                }
                if (worker.totalMetersMoved > 0 && worker.totalMetersMoved < lowestWorkerDistanceMoved) {
                    lowestWorkerDistanceMoved = worker.totalMetersMoved;
                    lowestWorkerSpeedId = worker.id;
                }

                if (worker.totalScans > highestWorkerScans) {
                    highestWorkerScans = worker.totalScans;
                    highestWorkerScansId = worker.id;
                }
                if (worker.totalScans > 0 && worker.totalScans < lowestWorkerScans) {
                    lowestWorkerScans = worker.totalScans;
                    lowestWorkerScansId = worker.id;
                }

                if (worker.totalMovements > highestWorkerMovements) {
                    highestWorkerMovements = worker.totalMovements;
                    highestWorkerMovementsId = worker.id;
                }
                if (worker.totalMovements > 0 && worker.totalMovements < lowestWorkerMovements) {
                    lowestWorkerMovements = worker.totalMovements;
                    lowestWorkerMovementsId = worker.id;
                }
            });

            let averageWorkerMetersMoved = (totalWorkerDistanceMoved / allocatedWorkers.length);
            let averageWorkerSpeed = ((averageWorkerMetersMoved / minutesRunning) / 60).toFixed(2);
            let highestWorkerSpeed = ((highestWorkerDistanceMoved / minutesRunning) / 60).toFixed(2);
            let lowestWorkerSpeed = ((lowestWorkerDistanceMoved / minutesRunning) / 60).toFixed(2);

            let averageWorkerScans = (totalWorkerScans / allocatedWorkers.length);
            let averageWorkerScansPerMinute = ((averageWorkerScans / minutesRunning)).toFixed(2);
            let highestWorkerScansPerMinute = ((highestWorkerScans / minutesRunning)).toFixed(2);
            let lowestWorkerScansPerMinute = ((lowestWorkerScans / minutesRunning)).toFixed(2);

            let averageWorkerMovements = (totalWorkerMovements / allocatedWorkers.length);
            let averageWorkerMovementsPerMinute = ((averageWorkerMovements / minutesRunning)).toFixed(2);
            let highestWorkerMovementsPerMinute = ((highestWorkerMovements / minutesRunning)).toFixed(2);
            let lowestWorkerMovementsPerMinute = ((lowestWorkerMovements / minutesRunning)).toFixed(2);

            let requestQueueLength = this.requestQueue.queue.length;
            let totalRequestsProcessed = this.requestQueue.totalRequestsProcessed;
            let averageRequestsProcessedPerMinuteStr = (totalRequestsProcessed / minutesRunning).toFixed(2);
            let totalRequestsDropped = this.requestQueue.totalRequestsDropped;
            let averageRequestsDroppedPerMinuteStr = (totalRequestsDropped / minutesRunning).toFixed(2);

            let averageSpawnsPerMinuteStr = (this.spawnCount / minutesRunning).toFixed(1);
            let spawnScanPercentageStr = ((this.spawnsScannedSuccessfully / this.spawnsProcessed) * 100).toFixed(1);
            let spawnMissedPercentageStr = (100 - parseFloat(spawnScanPercentageStr)).toFixed(1);

            log.info(`
            ********************************
            Stats ${Config.simulate ? '(simulation mode: time multiplier ' + Config.simulationTimeMultiplier + ')' : ''}
            time running: ${minutesRunning} minutes ${Config.pauseScanning ? '(scanning currently paused)' : ''}
            scan center: ${Config.scanCenterLat}, ${Config.scanCenterLong}; scan radius: ${Config.scanRadiusMeters} meters; spawnpoint count: ${this.spawnpoints.length}
            global scan delay: ${Config.globalScanDelayMs}; worker scan delay: ${Config.workerScanDelayMs} ms
            
            workers allocated: ${workersUsed}/${this.workerPool.workers.length} ${workersBanned ? '(' + workersBanned + ' banned)' : ''}
            worker allocation failures: ${workerAllocationFailures}
            average worker allocation failures per minute: ${workerAllocationFailuresPerMinuteStr}
            max worker travel speed: ${Config.workerMaximumMovementSpeedMetersPerSecond} m/s
            avg worker speed: ${averageWorkerSpeed} m/s; highest: ${highestWorkerSpeed} (worker ${highestWorkerSpeedId}); lowest: ${lowestWorkerSpeed} (worker ${lowestWorkerSpeedId})
            avg worker movements/minute: ${averageWorkerMovementsPerMinute}; highest: ${highestWorkerMovementsPerMinute}  (worker ${highestWorkerMovementsId}); lowest: ${lowestWorkerMovementsPerMinute} (worker ${lowestWorkerMovementsId})
            avg worker scans/minute: ${averageWorkerScansPerMinute}; highest: ${highestWorkerScansPerMinute}  (worker ${highestWorkerScansId} x${highestWorkerScans}); lowest: ${lowestWorkerScansPerMinute} (worker ${lowestWorkerScansId} x${lowestWorkerScans})
            
            request queue: ${requestQueueLength}
            total requests processed: ${totalRequestsProcessed}
            average requests processed per minute: ${averageRequestsProcessedPerMinuteStr}
            total requests dropped: ${totalRequestsDropped}
            average requests dropped per minute: ${averageRequestsDroppedPerMinuteStr}
            
            total spawns: ${this.spawnCount}
            average spawns per minute: ${averageSpawnsPerMinuteStr}
            spawns processed: ${this.spawnsProcessed}
            spawns scanned successfully: ${this.spawnsScannedSuccessfully}
            percentage of spawns scanned: ${spawnScanPercentageStr}% (${spawnMissedPercentageStr}% missed)
            ********************************
            `);

            if (Config.simulate && minutesRunning > Config.minutesSimulated && Config.minutesSimulated > 0) {
                log.info(`simulation complete, exiting application`);
                process.exit(0);
            }

        }, Utils.timestepTransformDown(Config.statisticLoggingInterval));
    }

    /**
     * Event handler for when a spawnpoint becomes active. Schedules a scan on the spawnpoint and upserts the scanned Pokemon
     * @param {Spawnpoint} spawnpoint The spawnpoint that has become active
     */
    handleSpawn(spawnpoint:Spawnpoint) {

        if (true === Config.pauseScanning) {
            return;
        }

        this.spawnCount++;

        setTimeout(() => {

            let worker = this.workerPool.getWorkerThatCanWalkTo(spawnpoint.lat, spawnpoint.long);

            if (!worker) {
                log.verbose(`no worker available to handle spawnpoint ${spawnpoint.id}, skipping this spawn`);
                this.spawnsProcessed++;
                return;
            }

            worker.reserve(); //reserve this worker, marking it unavailable for use until we finish scanning
            log.verbose(`spawnpoint ${spawnpoint.id} spawned, sending worker ${worker.id}`);

            //schedules a scan request on the spawnpoint
            let request = this.requestQueue.addWorkerScanRequest(worker, spawnpoint);
            request.completedPromise
                .then((result) => {
                    log.verbose(`request on worker ${worker.id} completed`);
                    log.debug(JSON.stringify(result));
                    worker.free(); //Free this worker back into worker pool
                    worker.incrementScanCounter();

                    //parse the pokemon out from the Niantic server API response
                    let pokemon = ResponseParser.parsePokemon(result);

                    if (!pokemon.length) {
                        worker.handleScanFailure();
                        throw new Error(`scan found no pokemon`);
                    }

                    //upsert all found pokemon to the database
                    pokemon.forEach((pkmn:Pokemon) => {
                        DatabaseAdapter.upsertPokemon(pkmn)
                            .then((result:any) => {
                                log.info('new spawns: ' + result.modifiedCount);

                                //if the pokemon is new (upserted), then trigger an event to plugins
                                if (result.modifiedCount) {
                                    this.pluginManager.handleSpawn(pkmn, spawnpoint);
                                }
                            });
                    });

                    //parse scanned gyms and upsert their current status to the database
                    let gyms = ResponseParser.parseGyms(result);
                    if (gyms.length) {
                        gyms.forEach((gym:GymData) => {
                            DatabaseAdapter.upsertGym(gym);
                        });
                    }

                    this.spawnsProcessed++;
                    this.spawnsScannedSuccessfully++;
                })
                .catch((err) => {
                    worker.free();
                    log.warn(`failed to process scan for worker ${worker.id} on spawnpoint ${spawnpoint.id}: ${err}`);
                    this.spawnsProcessed++;
                });
        }, Utils.timestepTransformDown(Config.spawnScanDelay));
    }
}

Clairvoyance.getInstance(); //Gets an instance of the main application, which starts the scanning