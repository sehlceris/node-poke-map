import fs = require('fs');
import bluebird = require('bluebird');
import moment = require('moment');

import Constants from '../Constants';
import Worker from 'Worker';
import Utils from '../Utils';

const log = Utils.getLogger('Spawnpoint');

export default class Spawnpoint {
    lat:number;
    long:number;
    cell:number;
    id:number;
    time:number;

    scanStartTimeout:number;
    lastScanTime:Date;
    spawnListener:Function;

    constructor(o) {
        this.lat = o.lat;
        this.long = o.lng;
        this.cell = o.cell;
        this.id = o.sid;
        this.time = o.time;
    }

    startSpawnTimer():void {
        
    }

    registerSpawnListener(listener:Function):void {
        this.spawnListener = listener;
    }

}