let pogobuf = require('pogobuf');
import bluebird = require('bluebird');

import Pokemon from './model/Pokemon';
import Spawnpoint from './model/Spawnpoint';
import Worker from './model/Worker';
import WorkerPool from './model/WorkerPool';
import RequestQueue from './model/RequestQueue';
import Utils from './Utils';
import Config from './Config';
import Data from './Data';

import Utils from 'Utils';

const log:any = Utils.getLogger('JoltMap');

export class JoltMap {

    spawnpoints:Array<Spawnpoint>;
    requestQueue:RequestQueue;
    workerPool:WorkerPool;

    constructor() {
        this.initSpawnPoints();
        this.initWorkers();
        this.requestQueue = new RequestQueue();
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

    handleSpawn(spawnpoint:Spawnpoint) {
        log.info(`Spawnpoint ${spawnpoint.id} has spawned, adding scan request`);

    }
}