import fs = require('fs');
import bluebird = require('bluebird');
import moment = require('moment');

import Constants from '../Constants';
import Worker from 'Worker';
import Utils from '../Utils';

const log:any = Utils.getLogger('Spawnpoint');

export default class Spawnpoint {
    lat:number;
    long:number;
    cell:number;
    id:number;
    time:number;

    timerStartTimeout:number;
    timerInterval:number;
    lastScanTime:Date;
    spawnListener:Function;

    constructor(params) {
        this.lat = params.lat;
        this.long = params.lng;
        this.cell = params.cell;
        this.id = params.sid;
        this.time = params.time;
    }

    startSpawnTimer():void {

        log.debug(`spawn ${this.id} timer starting...`);

        this.stopSpawnTimer();
        this.timerStartTimeout = setTimeout(() => {

            //Timer to trigger spawn handler
            this.timerInterval = setInterval(() => {
                this.fireSpawn();
            }, 3000);

            //Fire spawn handler for the first time
            this.fireSpawn();
        }, 2000);
    }

    stopSpawnTimer():void {
        if (this.timerStartTimeout) {
            clearInterval(this.timerStartTimeout);
            this.timerStartTimeout = null;
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    fireSpawn():void {
        if (typeof(this.spawnListener) === 'function') {
            try {
                this.spawnListener(this);
            }
            catch (e) {
                log.error(`Spawnpoint handler for spawn ${this.id} threw error: ${e}`);
            }
        }
    }

    handleScan():void {
        let newScanTime = new Date();
        if (this.lastScanTime) {
            let diff = newScanTime - this.lastScanTime;
        }
        this.lastScanTime = newScanTime;
    }

    registerSpawnListener(listener:Function):void {
        this.spawnListener = listener;
    }

}