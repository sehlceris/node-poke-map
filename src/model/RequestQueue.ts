import bluebird = require('bluebird');
import moment = require('moment');

import Constants from '../Constants';
import Config from '../Config';
import Utils from '../Utils';
import Spawnpoint from "./Spawnpoint";

const log:any = Utils.getLogger('RequestQueue');

/**
 * A queue of spawnpoint scan requests. Throttles scans to prevent getting IP banned by the Niantic server - may drop scanning of some spawns if deemed necessary
 */
export default class ScanRequestQueue {

    isProcessing:boolean; //whether the request queue is currently processing
    queue:Array<ScanRequest>; //queue of scan requests
    lastRequestTime:Date; //last time that an API request was made to the Niantic server
    processingPromise:Promise; //promise that will return once the scan request queue is empty
    backOffFactor:number; //not currently used, but may be used in the future to slow down requests if too many fail in a row
    totalRequestsProcessed:number; //total scan requests processed by this queue (not necessarily successful)
    totalRequestsDropped:number; //total scan requests dropped by this queue due to being too full

    constructor() {
        this.queue = [];
        this.lastRequestTime = new Date();
        this.isProcessing = false;
        this.totalRequestsProcessed = 0;
        this.totalRequestsDropped = 0;
    }

    backOff() {
        this.backOffFactor++;
    }

    /**
     * Given a spawnpoint, creates a request to scan that spawnpoint. If the scanner is too far backed up, the request will be dropped. Else, it will be added to the queue
     * @param {Worker} worker Worker instance to use to scan the spawnpoint
     * @param {Spawnpoint} spawnpoint Spawnpoint to scan for Pokemon
     * @returns {ScanRequest} Scan request
     */
    addWorkerScanRequest(worker, spawnpoint):ScanRequest {

        let request = new ScanRequest({
            spawnpoint: spawnpoint,
            worker: worker,
            scheduledTime: new Date()
        });

        //if too many scans in the queue, drop this request
        if (this.queue.length >= Config.maximumRequestQueueLength) {
            this.totalRequestsDropped++;
            let errorMessage = `exceeded maximum request queue size; dropping request`;
            //log.error(errorMessage);
            setTimeout(() => {
                request.setProcessed(errorMessage);
            }, 0);
            return request;
        }

        this.queue.unshift(request);

        //if not already processing the queue, start processing it
        if (!this.isProcessing) {
            this.isProcessing = true;
            setTimeout(() => {
                this.startProcessing();
            }, 0);
        }

        return request;
    }

    //Starts processing the scan queue until it is empty
    startProcessing():Promise {
        this.isProcessing = true;
        this.processingPromise = this.process(this.queue.pop());
        return this.processingPromise;
    }

    /**
     * Processes a scan request, and then continues to recursively loop through the queued scan requests until the queue is empty
     * @param {ScanRequest} Initial scan request to process
     * @returns {Promise} Will return when the request queue is empty
     */
    process(request:ScanRequest) {

        log.debug(`processing new request on worker ${request.worker.id}`);

        return new Promise(
            (resolve, reject) => {
                //delay to respect global scan delay
                let extraDelay = Utils.getRandomInt(0, Config.randomGlobalScanDelayFuzzFactor); //Fuzz our delay a bit to avoid detection
                let totalDelayTime = (Config.globalScanDelayMs + extraDelay);
                log.debug(`waiting ${totalDelayTime} until next request is processed`);
                setTimeout(() => {
                    resolve();
                }, Utils.timestepTransformDown(totalDelayTime));
            })
            .then(() => {
                //execute the scan request - if parallel requests are enabled, go directly to the next step, else wait for the scan to finish before moving on
                if (Config.enableParallelRequests === true) {
                    this.executeScanRequest(request);
                    return Promise.resolve();
                }
                else {
                    return this.executeScanRequest(request);
                }
            })
            .then(() => {
                //subtract from the backoff factor since we successfully made a request
                this.backOffFactor--;
                if (this.backOffFactor < 0) {
                    this.backOffFactor = 0;
                }

                //process the next request, or if the queue is empty, return
                let nextRequest = this.queue.pop();
                if (nextRequest) {
                    return this.process(nextRequest);
                }
                else {
                    this.isProcessing = false;
                    return 'scan queue emptied';
                }
            })
            .catch((err) => {
                this.backOff();
                log.warn(`error while handling scan request: ${err}`);

                //move on to the next request
                let nextRequest = this.queue.pop();
                if (nextRequest) {
                    return this.process(nextRequest);
                }
                else {
                    return 'all scan requests processed';
                }
            });
    }

    /**
     * Executes a given scan request
     * @param {ScanRequest} request Scan request to execute
     * @returns {Promise} Result of scan
     */
    executeScanRequest(request:ScanRequest):Promise {

        log.debug(`executing scan request for spawnpoint ${request.spawnpoint.id} with worker ${request.worker.id}`);

        request.setProcessed();
        this.totalRequestsProcessed++;

        let worker = request.worker;

        return worker.scan(request.spawnpoint)
            .then((result) => {
                request.setCompleted(result);
                return result;
            })
            .catch((err) => {
                request.setCompleted(err, err);
                throw err;
            });
    }
}

/**
 * A queued scan request. Contains all the data required to execute the scan and fire handlers for its success/failure
 */
export class ScanRequest {

    worker:Worker; //worker to execute scan with
    scheduledTime:Date; //time the scan request was scheduled (used to calculate delta between time scan was queued and actually executed)
    spawnpoint:Spawnpoint; //spawnpoint to scan

    processedTime:Date; //time scan was processed
    completedTime:Date; //time scan was completed

    processedPromise:Promise; //promise resolving when scan has been processed (but perhaps not yet completed)
    completedPromise:Promise; //promise resolving when scan has been completed (with data, or an error)

    processedPromiseResolver:Function; //internal; function to resolve the processed promise
    processedPromiseRejecter:Function; //internal; function to reject the processed promise
    completedPromiseResolver:Function; //internal; function to resolve the completed promise
    completedPromiseRejecter:Function; //internal; function to reject the completed promise

    result;

    constructor(params) {
        this.worker = params.worker;
        this.spawnpoint = params.spawnpoint;
        this.scheduledTime = params.scheduledTime;

        this.processedPromise = new Promise((resolve, reject) => {
            this.processedPromiseResolver = resolve; //need to save the resolve/reject functions since we need to wait a while for the scan to execute...
            this.processedPromiseRejecter = reject;
        });

        this.completedPromise = new Promise((resolve, reject) => {
            this.completedPromiseResolver = resolve;
            this.completedPromiseRejecter = reject;
        });
    }

    isProcessed():Boolean {
        return !!this.processedTime;
    }

    isCompleted():Boolean {
        return !!this.completedTime;
    }

    getCompletedPromise():Promise<any> {
        return this.completedPromise;
    }

    getCompletedPromise():Promise<Date> {
        return this.completedPromise;
    }

    getResult():any {
        return this.result;
    }

    /**
     * Fires event handlers for this request being processed. A request is processed when the scan queue has looked at the scan request and attempted to run a scan against the Niantic server
     * @param {String} [err] if present, signals that there was an error processing this request
     */
    setProcessed(err?:String) {
        if (!this.processedTime) {
            this.processedTime = new Date();

            if (err) {
                setTimeout(() => {
                    this.setCompleted(err, null);
                }, 0);
                return this.processedPromiseRejecter(err);
            }
            else {
                return this.processedPromiseResolver(this.processedTime);
            }
        }
    }

    /**
     * Fires event handlers for this request being completed. A request is completed when the scan has executed and has either a result or error
     * @param {String} [err] if present, signals that there was an error completing this request
     */
    setCompleted(result:any, err?:String) {
        if (!this.completedTime) {
            this.completedTime = new Date();
            this.result = result;

            if (err) {
                this.result = err;
                return this.completedPromiseRejecter(err);
            }
            else {
                return this.completedPromiseResolver(this.result);
            }
        }
    }
}