import bluebird = require('bluebird');
import moment = require('moment');

import Constants from '../Constants';
import Config from '../Config';
import Utils from '../Utils';
import Spawnpoint from "./Spawnpoint";

const log:any = Utils.getLogger('RequestQueue');

export default class ScanRequestQueue {

    isProcessing:boolean;
    queue:Array<ScanRequest>;
    lastRequestTime:Date;
    processingPromise:Promise;
    backOffFactor:number;
    totalRequestsProcessed:number;
    totalRequestsDropped:number;

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

    addWorkerScanRequest(worker, spawnpoint):ScanRequest {

        let request = new ScanRequest({
            spawnpoint: spawnpoint,
            worker: worker,
            scheduledTime: new Date()
        });

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

        if (!this.isProcessing) {
            this.isProcessing = true;
            setTimeout(() => {
                this.startProcessing();
            }, 0);
        }

        return request;
    }

    startProcessing():Promise {
        this.isProcessing = true;
        this.processingPromise = this.process(this.queue.pop());
        return this.processingPromise;
    }

    process(request) {

        log.debug(`processing new request on worker ${request.worker.id}`);

        return new Promise(
            (resolve, reject) => {
                //Delay to respect global scan delay
                let extraDelay = Utils.getRandomInt(0, Config.randomGlobalScanDelayFudgeFactor);
                let totalDelayTime = (Config.globalScanDelayMs + extraDelay);
                log.debug(`waiting ${totalDelayTime} until next request is processed`);
                setTimeout(() => {
                    resolve();
                }, Utils.timestepTransformDown(totalDelayTime));
            })
            .then(() => {
                return this.executeScanRequest(request);
            })
            .then(() => {
                this.backOffFactor--;
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
                let nextRequest = this.queue.pop();
                if (nextRequest) {
                    return this.process(nextRequest);
                }
                else {
                    return 'all scan requests processed';
                }
            });
    }

    executeScanRequest(request:ScanRequest):Promise {
        return new Promise((resolve, reject) => {
            request.setProcessed();
            this.totalRequestsProcessed++;

            let worker = request.worker;

            //TODO
            setTimeout(() => {
                let result = `fake completion on worker id ${worker.id}`;
                request.setCompleted(result);
                resolve(result);
            }, Utils.timestepTransformDown(1000));
        });
    }
}

export class ScanRequest {

    worker:Worker;
    scheduledTime:Date;
    spawnpoint:Spawnpoint;

    processedTime:Date;
    completedTime:Date;

    processedPromise:Promise;
    completedPromise:Promise;

    processedPromiseResolver:Function;
    processedPromiseRejecter:Function;
    completedPromiseResolver:Function;
    completedPromiseRejecter:Function;

    result;

    constructor(params) {
        this.worker = params.worker;
        this.spawnpoint = params.spawnpoint;
        this.scheduledTime = params.scheduledTime;

        this.processedPromise = new Promise((resolve, reject) => {
            this.processedPromiseResolver = resolve;
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