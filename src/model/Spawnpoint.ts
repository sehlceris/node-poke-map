import DriftlessInterval from "./DriftlessInterval";
let moment = require('moment');
import bluebird = require('bluebird');

import Constants from '../Constants';
import Utils from '../Utils';
import Config from '../Config';

const log:any = Utils.getLogger('Spawnpoint');

/**
 * A Spawnpoint becomes active (spawns a Pokemon) once per hour
 */
export default class Spawnpoint {
    id:String;
    lat:number;
    long:number;
    elev:number;
    cell:number; //google maps cell
    time:number; //seconds; time of each hour that the spawnpoint becomes active
    spawnListener:Function; //callback to fire when the spawnpoint becomes active
    driftlessInterval:DriftlessInterval; //interval that is not susceptible to time drift
    timerStartTimeout:Number;

    constructor(params) {
        this.lat = params.lat;
        this.long = params.lng;
        this.elev = params.elevation;
        this.cell = params.cell;
        this.id = params.sid;
        this.time = params.time;
    }

    /**
     * Calculates when this spawn should fire and begins the interval timer
     */
    startSpawnTimer():void {

        this.stopSpawnTimer();

        //calculate the time in this hour that this spawnpoint will fire
        let startTime = moment(new Date()).startOf('hour').add(this.time, 'seconds');
        let firstFireDelay = startTime - new Date(); //timeout for when the first spawn will be fired and the hour timer started

        //if the spawn is in the past...
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

    /**
     * Stops the interval timer, this spawnpoint will no longer emit spawn events
     */
    stopSpawnTimer():void {
        if (this.timerStartTimeout) {
            clearTimeout(this.timerStartTimeout);
            this.timerStartTimeout = null;
        }
        if (this.driftlessInterval) {
            this.driftlessInterval.clear();
        }
    }

    /**
     * Signals to the callback function that this spawnpoint has become active
     */
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

    /**
     * Sets the callback to execute when this spawnpoint becomes active
     * @param {Function} listener callback to execute when this spawnpoint becomes active
     */
    setSpawnListener(listener:Function):void {
        this.spawnListener = listener;
    }

}