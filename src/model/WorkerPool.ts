import bluebird = require('bluebird');

import Worker from './Worker';
import Constants from '../Constants';
import Utils from '../Utils';

const log = Utils.getLogger('WorkerPool');

export default class WorkerPool {

    workers:Array<Worker>;
    currentWorkerIndex:number;

    constructor(workers:Array<Worker>) {
        this.workers = workers;
        this.currentWorkerIndex = 0;
    }

    //Get a worker that can walk to the specified coordinates. Returns null if no worker is available.
    getWorkerThatCanWalkTo(lat, long) {

        let i;

        //Search to end of array
        for (i = this.currentWorkerIndex; i < this.workers.length; i++) {
            if (this.workers[i].hasSatisfiedScanDelay() && this.workers[i].canWalkTo(lat, long)) {
                this.currentWorkerIndex = i;
                return this.workers[i];
            }
        }

        //If we get here, no free worker was found, reset index to 0 and begin search again
        let lastWorkerIndex = this.currentWorkerIndex;
        for (i = 0; i < lastWorkerIndex; i++) {
            if (this.workers[i].hasSatisfiedScanDelay() && this.workers[i].canWalkTo(lat, long)) {
                this.currentWorkerIndex = i;
                return this.workers[i];
            }
        }

        //If we get here, no worker can walk to those coordinates.
        return null;
    }

}