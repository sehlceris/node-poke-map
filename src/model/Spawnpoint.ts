let fs = require('fs');
let log = require('winston');
let bluebird = require('bluebird');

import Constants from '../Constants';
import Worker from 'Worker';

export default class Spawnpoint {
    lat:number;
    long:number;
    cell:number;
    id:number;
    time:number;

    workers:Array<Worker>

    constructor(o) {
        this.lat = o.lat;
        this.long = o.lng;
        this.cell = o.cell;
        this.id = o.sid;
        this.time = o.time;

        this.workers = [];
    }

    assignWorker(worker:Worker) {
        this.workers.push(worker);
    }

}