let pogobuf = require('pogobuf');
let geolib = require('geolib');
import bluebird = require('bluebird');

import Pokemon from './model/Pokemon';
import Spawnpoint from './model/Spawnpoint';
import Worker from './model/Worker';
import WorkerPool from './model/WorkerPool';
import RequestQueue from './model/RequestQueue';
import Utils from './Utils';
import Config from './Config';
import Constants from './Constants';
import Data from './Data';

import Utils from 'Utils';

const log:any = Utils.getLogger('Main');

let instance = null;

export class Clairvoyance {

    spawnpoints:Array<Spawnpoint>;
    requestQueue:RequestQueue;
    workerPool:WorkerPool;
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

        this.initStatisticLogging();

        this.spawnCount = 0;
        this.spawnsProcessed = 0;
        this.spawnsScannedSuccessfully = 0;
        this.initSpawnPoints();
        this.initWorkers();
        this.requestQueue = new RequestQueue();

        log.info(`**********************************************`);
        log.info(`CLAIRVOYANCE POKEMON GO SCANNER`);
        if (Config.simulate) {
            log.warn(`running in simulation mode with timestep ${Config.simulationTimestep}`);
        }
        log.info(`initialized with ${this.spawnpoints.length} spawnpoints and ${this.workerPool.workers.length} workers`);
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
            spawnpoint.registerSpawnListener(this.handleSpawn.bind(this));
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
            let timeRunning = Math.round(((Utils.timestepTransformUp(new Date() - this.initTime) / 1000) / 60) * 10) / 10;

            let allocatedWorkers = this.workerPool.getAllocatedWorkers();

            let workersUsed = allocatedWorkers.length;
            let workerAllocationFailures = this.workerPool.workerAllocationFailures;
            let workerAllocationFailuresPerMinuteStr = (workerAllocationFailures / timeRunning).toFixed(2);

            let totalWorkerMovement = 0;
            let highestWorkerMovement = 0;
            let highestWorkerSpeedId = -1;
            allocatedWorkers.forEach((worker) => {
                totalWorkerMovement += worker.totalMetersMoved;
                if (worker.totalMetersMoved > highestWorkerMovement) {
                    highestWorkerMovement = worker.totalMetersMoved;
                    highestWorkerSpeedId = worker.id;
                }
            })
            let averageWorkerMetersMoved = (totalWorkerMovement / allocatedWorkers.length);
            let averageWorkerSpeed = ((averageWorkerMetersMoved / timeRunning) / 60).toFixed(2);
            let highestWorkerSpeed = ((highestWorkerMovement / timeRunning) / 60).toFixed(2);

            let requestQueueLength = this.requestQueue.queue.length;
            let totalRequestsProcessed = this.requestQueue.totalRequestsProcessed;
            let averageRequestsProcessedPerMinuteStr = (totalRequestsProcessed / timeRunning).toFixed(2);
            let totalRequestsDropped = this.requestQueue.totalRequestsDropped;
            let averageRequestsDroppedPerMinuteStr = (totalRequestsDropped / timeRunning).toFixed(2);

            let averageSpawnsPerMinuteStr = (this.spawnCount / timeRunning).toFixed(1);
            let spawnScanPercentageStr = ((this.spawnsScannedSuccessfully / this.spawnsProcessed) * 100).toFixed(1);
            let spawnMissedPercentageStr = (100 - parseFloat(spawnScanPercentageStr)).toFixed(1);

            log.info(`
            ********************************
            Stats ${Config.simulate ? 'WARNING: SIMULATION ONLY MODE WITH TIMESTEP ' + Config.simulationTimestep + ' AND REQUEST DURATION ' + Config.simulationRequestDuration : ''}
            time running: ${timeRunning} minutes
            scan center: ${Config.scanCenterLat}, ${Config.scanCenterLong}
            scan radius: ${Config.scanRadiusMeters} meters
            spawnpoint count: ${this.spawnpoints.length}
            workers allocated: ${workersUsed}/${this.workerPool.workers.length}
            worker allocation failures: ${workerAllocationFailures}
            average worker allocation failures per minute: ${workerAllocationFailuresPerMinuteStr}
            worker scan delay: ${Config.workerScanDelayMs} ms
            max worker travel speed: ${Config.workerMaximumMovementSpeedMetersPerSecond} m/s
            average worker speed: ${averageWorkerSpeed} m/s
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

            if (Config.simulate && timeRunning > Config.minutesSimulated) {
                log.info(`simulation complete, exiting application`);
                process.exit(0);
            }

        }, Utils.timestepTransformDown(Config.statisticLoggingInterval));
    }

    handleSpawn(spawnpoint:Spawnpoint) {
        this.spawnCount++;

        let worker = this.workerPool.getWorkerThatCanWalkTo(spawnpoint.lat, spawnpoint.long);

        if (!worker) {
            log.warn(`no worker available to handle spawnpoint ${spawnpoint.id}, skipping this spawn`);
            this.spawnsProcessed++;
            return;
        }

        worker.reserve();
        worker.moveTo(spawnpoint.lat, spawnpoint.long);
        log.verbose(`spawnpoint ${spawnpoint.id} spawned, sending worker ${worker.id}`);

        setTimeout(() => {
            let request = this.requestQueue.addWorkerScanRequest(worker, spawnpoint);
            request.processedPromise
                .then((result) => {
                    log.verbose(`request on worker ${worker.id} processed`);
                    return request.completedPromise.then((result) => {
                        worker.free();
                        log.verbose(`request on worker ${worker.id} completed: ${result}`);
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