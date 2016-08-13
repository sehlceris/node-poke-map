import bluebird = require('bluebird');
import moment = require('moment');

import Constants from '../Constants';
import Config from '../Config';
import Utils from '../Utils';

const log:any = Utils.getLogger('RequestQueue');

export class ScanRequest {

    worker:Worker;
    scheduledTime:Date;

    processedTime:Date;
    completedTime:Date;

    processedPromise:Promise;
    completedPromise:Promise;

    processedPromiseResolver:Function;
    completedPromiseResolver:Function;

    result;

    constructor(params) {
        this.worker = params.worker;
        this.scheduledTime = params.scheduledTime;

        this.processedPromise = new Promise((resolve, reject) => {
            this.processedPromiseResolver = resolve;
        });

        this.completedPromise = new Promise((resolve, reject) => {
            this.completedPromiseResolver = resolve;
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

    setProcessed() {
        if (!this.processedTime) {
            this.processedTime = new Date();
            this.processedPromiseResolver(this.processedTime);
        }
    }

    setCompleted(result) {
        if (!this.completedTime) {
            this.completedTime = new Date();
            this.result = result;
            this.completedPromiseResolver(this.result);
        }
    }
}

export default class ScanRequestQueue {

    isProcessing:boolean;
    queue:Array<ScanRequest>;
    lastRequestTime:Date;
    processingPromise:Promise;
    backOffFactor:number;

    constructor() {
        this.queue = [];
        this.lastRequestTime = new Date();
        this.isProcessing = false;
    }

    backOff() {
        this.backOffFactor++;
    }

    addWorkerScanRequest(worker):ScanRequest {

        let request = new ScanRequest({
            worker: worker,
            scheduledTime: new Date()
        });

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
        if (!this.isProcessing) {
            this.isProcessing = true;
            this.processingPromise = this.process(this.queue.pop());
        }
        return this.processingPromise;
    }

    process(request) {

        return new Promise(
            (resolve, reject) => {
                //Delay to respect global scan delay
                setTimeout(() => {
                    resolve();
                }, Config.globalScanDelayMs);
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
                    return 'all scan requests processed';
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

            let worker = request.worker;

            //TODO
            setTimeout(() => {
                request.setCompleted(`fake completion on worker id ${worker.id}`);
                resolve();
            }, 1000);
        });
    }
}