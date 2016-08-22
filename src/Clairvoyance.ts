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
import ResponseParser from "./ResponseParser";
import Data from './Data';

import Utils from 'Utils';

const log:any = Utils.getLogger('Main');

let instance = null;

export class Clairvoyance {

	spawnpoints:Array<Spawnpoint>;
	requestQueue:RequestQueue;
	workerPool:WorkerPool;
	pluginManager:PluginManager;
	spawnCount:number;
	spawnsProcessed:number;
	spawnsScannedSuccessfully:number;

	initTime:Date;

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

		log.info(`initialized with ${this.spawnpoints.length} spawnpoints and ${this.workerPool.workers.length} workers`);

		this.initStatisticLogging();
	}

	initSpawnPoints():void {

		if (this.spawnpoints) {
			return;
		}

		let spawns = Data.getSpawns();

		log.info(`Scan center: ${Config.scanCenterLat}, ${Config.scanCenterLong}`);

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

	initWorkers():void {
		if (this.workerPool) {
			return;
		}

		let workerLogins = Data.getWorkers();
		let workers = workerLogins.map((workerLogin) => {
			return new Worker(workerLogin);
		});

		this.workerPool = new WorkerPool(workers);
	}

	initStatisticLogging():void {

		this.initTime = new Date();

		if (Config.statisticLoggingInterval < 1000) {
			return;
		}

		setInterval(() => {
			let minutesRunning = Math.round(((Utils.timestepTransformUp(new Date() - this.initTime) / 1000) / 60) * 10) / 10;

			let allocatedWorkers = this.workerPool.getAllocatedWorkers();

			let workersUsed = allocatedWorkers.length;
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
            Stats ${Config.simulate ? 'WARNING: SIMULATION ONLY MODE WITH TIME MULTIPLIER ' + Config.simulationTimeMultiplier + ' AND REQUEST DURATION ' + Config.simulationRequestDuration : ''}
            time running: ${minutesRunning} minutes
            scan center: ${Config.scanCenterLat}, ${Config.scanCenterLong}; scan radius: ${Config.scanRadiusMeters} meters; spawnpoint count: ${this.spawnpoints.length}
            global scan delay: ${Config.globalScanDelayMs}; worker scan delay: ${Config.workerScanDelayMs} ms
            
            workers allocated: ${workersUsed}/${this.workerPool.workers.length}
            worker allocation failures: ${workerAllocationFailures}
            average worker allocation failures per minute: ${workerAllocationFailuresPerMinuteStr}
            max worker travel speed: ${Config.workerMaximumMovementSpeedMetersPerSecond} m/s
            avg worker speed: ${averageWorkerSpeed} m/s; highest: ${highestWorkerSpeed} (worker ${highestWorkerSpeedId}); lowest: ${lowestWorkerSpeed} (worker ${lowestWorkerSpeedId})
            avg worker movements/minute: ${averageWorkerMovementsPerMinute}; highest: ${highestWorkerMovementsPerMinute}  (worker ${highestWorkerMovementsId}); lowest: ${lowestWorkerMovementsPerMinute} (worker ${lowestWorkerMovementsId})
            avg worker scans/minute: ${averageWorkerScansPerMinute}; highest: ${highestWorkerScansPerMinute}  (worker ${highestWorkerScansId}); lowest: ${lowestWorkerScansPerMinute} (worker ${lowestWorkerScansId})
            
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

			if (Config.simulate && minutesRunning > Config.minutesSimulated) {
				log.info(`simulation complete, exiting application`);
				process.exit(0);
			}

		}, Utils.timestepTransformDown(Config.statisticLoggingInterval));
	}

	handleSpawn(spawnpoint:Spawnpoint) {
		this.spawnCount++;

		setTimeout(() => {

			let worker = this.workerPool.getWorkerThatCanWalkTo(spawnpoint.lat, spawnpoint.long);

			if (!worker) {
				log.warn(`no worker available to handle spawnpoint ${spawnpoint.id}, skipping this spawn`);
				this.spawnsProcessed++;
				return;
			}

			worker.reserve();
			worker.moveTo(spawnpoint.lat, spawnpoint.long);
			log.verbose(`spawnpoint ${spawnpoint.id} spawned, sending worker ${worker.id}`);

			let request = this.requestQueue.addWorkerScanRequest(worker, spawnpoint);
			request.processedPromise
				.then((result) => {
					log.verbose(`request on worker ${worker.id} processed`);
					return request.completedPromise.then((result) => {
						worker.free();
						worker.incrementScanCounter();

						let pokemon = ResponseParser.parsePokemon(result);
						pokemon.forEach((pkmn:Pokemon) => {
							log.info(`Found Pokemon ${pkmn.toString()}`);
						});

						this.spawnsProcessed++;
						this.spawnsScannedSuccessfully++;
					})
				})
				.catch((err) => {
					worker.free();
					log.warn(`failed to process scan for worker ${worker.id} on spawnpoint ${spawnpoint.id}: ${err}`);
					this.spawnsProcessed++;
				});
		}, Utils.timestepTransformDown(Config.spawnScanDelay));
	}
}

Clairvoyance.getInstance();