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

    initTime:Date;

    static getInstance():Clairvoyance {
        if (!instance) {
            instance = new Clairvoyance();
        }
        return instance;
    }

    constructor() {

        this.initStatisticLogging();

        this.initSpawnPoints();
        this.initWorkers();
        this.requestQueue = new RequestQueue();

        log.info(`**********************************************`);
        log.info(`CLAIRVOYANCE POKEMON GO SCANNER`);
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

        let workerLogins = Config.workerLogins;
        let workers = workerLogins.map((workerLogin) => {
            return new Worker(workerLogin);
        });

        this.workerPool = new WorkerPool(workers);
    }

    initStatisticLogging():void {

        this.initTime = new Date();

        if (Config.statisticLoggingInterval < 1000) {
            return false;
        }

        setInterval(() => {

            let workersUsed = this.workerPool.workers.filter((worker) => {
                return worker.hasBeenUsedAtLeastOnceDuringProgramExecution();
            }).length;

            let timeRunning = Math.round((new Date() - this.initTime) / 1000) / 60;
            let requestQueueLength = this.requestQueue.queue.length;
            let totalRequestsProcessed = this.requestQueue.totalRequestsProcessed;
            let averageRequestsProcessedPerMinute = (Math.round((totalRequestsProcessed / timeRunning) * 100) / 100);
            let totalRequestsDropped = this.requestQueue.totalRequestsDropped;
            let averageRequestsDroppedPerMinute = (Math.round((totalRequestsDropped / timeRunning) * 100) / 100);

            log.info(`
            ********************************
            Stats
            
            workers used: ${workersUsed}/${this.workerPool.workers.length}
            time running: ${timeRunning} minutes
            request queue: ${requestQueueLength} requests
            
            total requests processed: ${totalRequestsProcessed}
            average requests processed per minute: ${averageRequestsProcessedPerMinute}
            
            total requests dropped: ${averageRequestsProcessedPerMinute}
            average requests dropped per minute: ${averageRequestsDroppedPerMinute}
            ********************************
            `);

        }, Config.statisticLoggingInterval);
    }

    handleSpawn(spawnpoint:Spawnpoint) {
        let worker = this.workerPool.getWorkerThatCanWalkTo(spawnpoint.lat, spawnpoint.long);

        if (!worker) {
            log.error(`no worker available to handle spawnpoint ${spawnpoint.id}, skipping this spawn`);
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
                        log.verbose(`request on worker ${worker.id} completed: ${result}`);
                        worker.free();
                    })
                })
                .catch((err) => {
                    worker.free();
                    log.warn(`failed to process scan for worker ${worker.id} on spawnpoint ${spawnpoint.id}: ${err}`);
                });
        }, Config.spawnScanDelay);
    }
}

Clairvoyance.getInstance();