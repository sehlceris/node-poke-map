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

        this.initBenchmarking();

        this.initSpawnPoints();
        this.initWorkers();
        this.requestQueue = new RequestQueue();

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

    initBenchmarking():void {

        this.initTime = new Date();

        setInterval(() => {

            let workersUsed = this.workerPool.workers.filter((worker) => {
                return worker.hasBeenUsedAtLeastOnceDuringProgramExecution();
            }).length;

            let timeRunning = Math.round((new Date() - this.initTime) / 1000) / 60;

            let requestQueueLength = this.requestQueue.queue.length;

            log.info(`
            ********************************
            Benchmarks
            
            workers used: ${workersUsed}/${this.workerPool.workers.length}
            time running: ${timeRunning} minutes
            request queue: ${requestQueueLength} requests
            ********************************
            `);

        }, Constants.MINUTE);
    }

    handleSpawn(spawnpoint:Spawnpoint) {
        let worker = this.workerPool.getWorkerThatCanWalkTo(spawnpoint.lat, spawnpoint.long);

        if (!worker) {
            log.error(`no worker available to handle spawnpoint ${spawnpoint.id}, skipping this spawn`);
            return;
        }

        worker.reserve();
        worker.moveTo(spawnpoint.lat, spawnpoint.long);
        log.info(`spawnpoint ${spawnpoint.id} spawned, using worker ${worker.id}`);

        let request = this.requestQueue.addWorkerScanRequest(worker);
        request.completedPromise
            .then((result) => {
                worker.free();
                log.debug(`request on worker ${worker.id} completed`);
                //TODO: Handle result
            })
            .catch((err) => {
                worker.free();
                log.error(`failed to process scan for worker ${worker.id}: `);
            });
    }
}

Clairvoyance.getInstance();