import bluebird = require('bluebird');

import Worker from './Worker';
import Constants from '../Constants';
import Config from '../Config';
import Utils from '../Utils';

const log = Utils.getLogger('WorkerPool');

export default class WorkerPool {

    workers:Array<Worker>;
    currentWorkerIndex:number;
    workerAllocationFailures:number;

    constructor(workers:Array<Worker>) {
        this.workers = workers;
        this.currentWorkerIndex = 0;
        this.workerAllocationFailures = 0;
    }

    getAllocatedWorkers():Array<Worker> {
        return this.workers.filter((worker:Worker) => {
            return worker.hasBeenUsedAtLeastOnceDuringProgramExecution();
        });
    }

    //Get a worker that can walk to the specified coordinates. Returns null if no worker is available.
    getWorkerThatCanWalkTo(lat, long) {

        let i;
        let lastWorkerIndex;
        let searchLoop;

        if (true === Config.enableGreedyWorkerAllocation) {
            i = this.currentWorkerIndex;
            lastWorkerIndex = this.currentWorkerIndex;
            searchLoop = true;
        }
        else {
            i = 0;
            lastWorkerIndex = this.workers.length - 1;
            searchLoop = false;
        }

        //Search to end of array
        for (i = i; i < this.workers.length; i++) {
            if (this.workers[i].isFree() && this.workers[i].hasSatisfiedScanDelay() && this.workers[i].canMoveTo(lat, long)) {
                this.currentWorkerIndex = i;
                return this.workers[i];
            }
        }

        if (true === searchLoop) {
            //If we get here, no free worker was found, reset index to 0 and begin search again
            for (i = 0; i < lastWorkerIndex; i++) {
                if (this.workers[i].isFree() && this.workers[i].hasSatisfiedScanDelay() && this.workers[i].canMoveTo(lat, long)) {
                    this.currentWorkerIndex = i;
                    return this.workers[i];
                }
            }
        }

        //If we get here, no worker can walk to those coordinates.
        this.workerAllocationFailures++;
        return null;
    }

}