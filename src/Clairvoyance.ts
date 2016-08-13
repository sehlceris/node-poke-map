let pogobuf = require('pogobuf');
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

        this.spawnpoints = spawns.map((spawn) => {
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

            let workersUsed = this.workerPool.workers.filter((worker) => {
                return worker.hasBeenUsedAtLeastOnceDuringProgramExecution();
            }).length;
            let workerAllocationFailures = this.workerPool.workerAllocationFailures;
            let workerAllocationFailuresPerMinute = (Math.round((workerAllocationFailures / timeRunning) * 100) / 100);

            let requestQueueLength = this.requestQueue.queue.length;
            let totalRequestsProcessed = this.requestQueue.totalRequestsProcessed;
            let averageRequestsProcessedPerMinute = (Math.round((totalRequestsProcessed / timeRunning) * 100) / 100);
            let totalRequestsDropped = this.requestQueue.totalRequestsDropped;
            let averageRequestsDroppedPerMinute = (Math.round((totalRequestsDropped / timeRunning) * 100) / 100);

            let spawnScanPercentage = ((this.spawnsScannedSuccessfully / this.spawnsProcessed) * 100).toFixed(1);
            let spawnMissedPercentage = (100 - spawnScanPercentage).toFixed(1);

            log.info(`
            ********************************
            Stats ${Config.simulate ? 'WARNING: SIMULATION ONLY MODE WITH TIMESTEP ' + Config.simulationTimestep + ' AND REQUEST DURATION ' + Config.simulationRequestDuration : ''}
            
            time running: ${timeRunning} minutes
            
            workers allocated: ${workersUsed}/${this.workerPool.workers.length}
            worker allocation failures: ${workerAllocationFailures}
            average worker allocation failures per minute: ${workerAllocationFailuresPerMinute}
            
            request queue: ${requestQueueLength}
            
            total requests processed: ${totalRequestsProcessed}
            average requests processed per minute: ${averageRequestsProcessedPerMinute}
            
            total requests dropped: ${totalRequestsDropped}
            average requests dropped per minute: ${averageRequestsDroppedPerMinute}
            
            spawns: ${this.spawnCount}
            spawns processed: ${this.spawnsProcessed}
            spawns scanned successfully: ${this.spawnsScannedSuccessfully}
            percentage of spawns scanned: ${spawnScanPercentage}% (${spawnMissedPercentage}% missed)
            ********************************
            `);

            if (timeRunning > Config.minutesSimulated) {
                log.info(`simulation complete`)
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