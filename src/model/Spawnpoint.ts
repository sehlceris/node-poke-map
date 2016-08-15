let moment = require('moment');
import bluebird = require('bluebird');

import Constants from '../Constants';
import Utils from '../Utils';
import Config from '../Config';

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

        this.stopSpawnTimer();

        let spawnMomentForThisHour = moment(new Date()).startOf('hour').add(this.time, 'seconds');
        let spawnTimeout = spawnMomentForThisHour - new Date(); //time diff from now that spawn will occur
        let firstFireDelay = spawnTimeout; //timeout for when the first spawn will be fired and the hour timer started

        //If the spawn is in the past...
        if (firstFireDelay <= 0) {

            //If the spawn occurred less than N minutes ago, fire the spawn immediately...
            if (firstFireDelay < 0 && firstFireDelay >= (0 - (Config.spawnpointLookbackMinutes * Constants.MINUTE))) {
                setTimeout(() => {
                    log.info(`${this.id} fired ${(60 - Math.abs(firstFireDelay / Constants.MINUTE)).toFixed(1)} min in the past, firing spawn immediately`);
                    this.fireSpawn();
                }, 0);
            }

            //...and then add an hour to the delay
            firstFireDelay += Constants.HOUR;
        }

        log.info(`${this.id} first fire in ${(firstFireDelay / Constants.MINUTE).toFixed(1)} min`);

        //Timeout to trigger spawn for the first time
        this.timerStartTimeout = setTimeout(() => {
            this.fireSpawn();

            //Start an interval timer to trigger spawn each hour
            this.timerInterval = setInterval(() => {
                this.fireSpawn();
            }, Utils.timestepTransformDown(Constants.HOUR));
        }, Utils.timestepTransformDown(firstFireDelay));
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
            let diff = Utils.timestepTransformDown(newScanTime - this.lastScanTime);
        }
        this.lastScanTime = newScanTime;
    }

    registerSpawnListener(listener:Function):void {
        this.spawnListener = listener;
    }

}