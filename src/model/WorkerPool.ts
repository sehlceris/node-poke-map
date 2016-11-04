import bluebird = require('bluebird');

import Worker from './Worker';
import Constants from '../Constants';
import Config from '../Config';
import Utils from '../Utils';

const log = Utils.getLogger('WorkerPool');

/**
 * A pool of Workers that can perform scans
 */
export default class WorkerPool {

    workers:Array<Worker>;
    currentWorkerIndex:number; //current worker ID, used to keep track of workers when assigning them in a round-robin fashion
    workerAllocationFailures:number; //total number of times we didn't have enough workers to permit a scan

    constructor(workers:Array<Worker>) {
        this.workers = workers;
        this.currentWorkerIndex = 0;
        this.workerAllocationFailures = 0;
    }

    /**
     * Gets a list of all workers that have scanned at least once while this app was running
     * @returns {Array<Worker>}
     */
    getAllocatedWorkers():Array<Worker> {
        return this.workers.filter((worker:Worker) => {
            return worker.hasBeenUsedAtLeastOnceDuringProgramExecution();
        });
    }

    /**
     * Get a worker that can walk to the specified coordinates. Returns null if no worker is available.
     * @param lat
     * @param long
     * @returns {Worker|null}
     */
    getWorkerThatCanWalkTo(lat, long) {

        let i;
        let lastWorkerIndex;
        let searchLoop;

        //greedy worker allocation means that the pool will assign workers in a round-robin fashion, distributing work evenly
        if (true === Config.enableGreedyWorkerAllocation) {
            i = this.currentWorkerIndex;
            lastWorkerIndex = this.currentWorkerIndex;
            searchLoop = true;
        }
        //conservative worker allocation means that the pool will only assign additional workers if all available workers are busy - else the unneeded workers won't ever log in
        else {
            i = 0;
            lastWorkerIndex = this.workers.length - 1;
            searchLoop = false;
        }

        //loop through workers, returning the first that can walk to the specified location
        for (i = i; i < this.workers.length; i++) {
            if (this.workers[i].isFree() && this.workers[i].hasSatisfiedScanDelay() && this.workers[i].canMoveTo(lat, long)) {
                this.currentWorkerIndex = i;
                return this.workers[i];
            }
        }

        //in greedy worker allocation, we started searching for workers in the middle of the array. in this case, it makes sense to restart the search from the beginning of the worker array
        if (true === searchLoop) {
            //If we get here, no free worker was found, reset index to 0 and begin search again
            for (i = 0; i < lastWorkerIndex; i++) {
                if (this.workers[i].isFree() && this.workers[i].hasSatisfiedScanDelay() && this.workers[i].canMoveTo(lat, long)) {
                    this.currentWorkerIndex = i;
                    return this.workers[i];
                }
            }
        }

        //if we get here, no worker can walk to those coordinates
        this.workerAllocationFailures++;
        return null;
    }

}