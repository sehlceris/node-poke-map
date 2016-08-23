import DriftlessInterval from "./DriftlessInterval";
let moment = require('moment');
import bluebird = require('bluebird');

import Constants from '../Constants';
import Utils from '../Utils';
import Config from '../Config';

const log:any = Utils.getLogger('Spawnpoint');

export default class Spawnpoint {
    id:String;
    lat:number;
    long:number;
    elev:number;
    cell:number;
    time:number;
    spawnListener:Function;
    driftlessInterval:DriftlessInterval;
    timerStartTimeout:Number;

    constructor(params) {
        this.lat = params.lat;
        this.long = params.lng;
        this.elev = params.elevation;
        this.cell = params.cell;
        this.id = params.sid;
        this.time = params.time;
    }

    startSpawnTimer():void {

        this.stopSpawnTimer();

        let startTime = moment(new Date()).startOf('hour').add(this.time, 'seconds');
        let firstFireDelay = startTime - new Date(); //timeout for when the first spawn will be fired and the hour timer started

        //If the spawn is in the past...
        if (firstFireDelay <= 0) {

            //If the spawn occurred less than N minutes ago, fire the spawn immediately...
            if (firstFireDelay < 0 && firstFireDelay >= (0 - (Config.spawnpointLookbackMinutes * Constants.MINUTE))) {
                setTimeout(() => {
                    log.debug(`${this.id} fired ${(60 - Math.abs(firstFireDelay / Constants.MINUTE)).toFixed(1)} min in the past, firing spawn immediately`);
                    this.fireSpawn();
                }, 0);
            }

            //...and then add an hour to the delay
            firstFireDelay += Constants.HOUR;
        }

        log.debug(`${this.id} first fire in ${(firstFireDelay / Constants.MINUTE).toFixed(1)} min`);

        //Timeout to trigger spawn for the first time
        this.timerStartTimeout = setTimeout(() => {
            //Start an interval timer to trigger spawn each hour (and also trigger it for the first time)
            this.driftlessInterval = new DriftlessInterval(() => {
                this.fireSpawn();
            }, Utils.timestepTransformDown(Constants.HOUR), true);
        }, Utils.timestepTransformDown(firstFireDelay));
    }

    stopSpawnTimer():void {
        if (this.timerStartTimeout) {
            clearTimeout(this.timerStartTimeout);
            this.timerStartTimeout = null;
        }
        if (this.driftlessInterval) {
            this.driftlessInterval.clear();
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

    setSpawnListener(listener:Function):void {
        this.spawnListener = listener;
    }

}