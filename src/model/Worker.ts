import bluebird = require('bluebird');
let geolib = require('geolib');

import Constants from '../Constants';
import Config from '../Config';
import Utils from '../Utils';

const log:any = Utils.getLogger('Worker');

let nextUsableId = 1;

export interface LoginData {
    username:String;
    password:String;
}

export default class Worker {

    id:number;
    username:String;
    password:String;
    isFree:Boolean;
    currentLat:String;
    currentLong:String;
    lastTimeMoved:Date;
    lastTimeFreed:Date;
    lastTimeReserved:Date;

    constructor(params:LoginData) {
        this.isFree = true;
        this.id = nextUsableId;
        nextUsableId++;

        this.username = params.username;
        this.password = params.password;
    }

    hasBeenUsedAtLeastOnceDuringProgramExecution():boolean {
        return (!!this.lastTimeReserved || !!this.lastTimeFreed || !!this.lastTimeMoved);
    }

    getTimeSinceLastFree():number {
        if (!this.lastTimeFreed) {
            return Infinity;
        }
        else {
            return new Date() - this.lastTimeFreed;
        }
    }

    hasSatisfiedScanDelay():boolean {
        let satisfied = this.getTimeSinceLastFree() > Config.workerScanDelayMs;
        log.info(`worker ${this.id} has ${satisfied ? "" : "not "} satisfied scan delay (has waited ${this.getTimeSinceLastFree()} out of ${Config.workerScanDelayMs})`);
        return satisfied;
    }

    walkTo(lat, long):void {
        this.currentLat = lat;
        this.currentLong = long;
        this.lastTimeMoved = new Date();
    }

    canWalkTo(lat, long):Boolean {
        if (!this.lastTimeMoved) {
            return true;
        }

        let meters = geolib.getDistance(
            {
                latitude: lat,
                longitude: long
            },
            {
                latitude: this.currentLat,
                longitude: this.currentLong
            }
            , 1, 1
        );

        let timeDiff = (new Date() - this.lastTimeMoved);
        let speed = meters / (timeDiff / 1000);

        let timeSeconds = Math.round(timeDiff / 1000);
        let roundedSpeed = Math.round((speed * 10) / 10);

        log.info(`worker ${this.id} would move from ${this.currentLat}, ${this.currentLong} to ${lat}, ${long}, a distance of ${meters}m over ${timeSeconds}s, a speed of ${roundedSpeed} m/s`);
        if (speed <= Config.workerMaximumMovementSpeedMetersPerSecond) {
            log.info(`worker ${this.id} can move to ${lat}, ${long} because ${roundedSpeed}m/s <= ${Config.workerMaximumMovementSpeedMetersPerSecond}m/s`);
            return true;
        }
        else {
            log.info(`worker ${this.id} is unable to move to ${lat}, ${long} because it would move at ${roundedSpeed} vs the maximum of ${Config.workerMaximumMovementSpeedMetersPerSecond}`);
            return false;
        }
    }

    reserve():void {
        this.isFree = false;
        this.lastTimeReserved = new Date();
    }

    free():void {
        this.isFree = true;
        this.lastTimeFreed = new Date();
    }

    isFree():void {
        return this.isFree;
    }
}