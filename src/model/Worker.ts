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
    isFreeBool:Boolean;
    currentLat:number;
    currentLong:number;
    lastTimeMoved:Date;
    lastTimeFreed:Date;
    lastTimeReserved:Date;
    currentRandomExtraDelay:Number;
    totalMetersMoved:Number;

    constructor(params:LoginData) {
        this.isFreeBool = true;
        this.id = nextUsableId;
        nextUsableId++;

        this.username = params.username;
        this.password = params.password;
        this.totalMetersMoved = 0;

        this.currentRandomExtraDelay = Utils.getRandomInt(0, Config.randomWorkerDelayFudgeFactor);
    }

    hasBeenUsedAtLeastOnceDuringProgramExecution():boolean {
        return (!!this.lastTimeReserved || !!this.lastTimeFreed || !!this.lastTimeMoved);
    }

    getTimeSinceLastFree():number {
        if (!this.lastTimeFreed) {
            return Infinity;
        }
        else {
            return Utils.timestepTransformUp(new Date() - this.lastTimeFreed);
        }
    }

    hasSatisfiedScanDelay():boolean {
        let satisfied = ((this.getTimeSinceLastFree() + this.currentRandomExtraDelay) > Config.workerScanDelayMs);
        log.debug(`worker ${this.id} has${satisfied ? "" : " not"} satisfied scan delay (has waited ${(this.getTimeSinceLastFree() + this.currentRandomExtraDelay)} out of ${Config.workerScanDelayMs + this.currentRandomExtraDelay})`);
        return satisfied;
    }

    moveTo(lat, long):void {

        if (this.currentLat && this.currentLong) {
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
            this.totalMetersMoved += meters;
        }

        this.currentLat = lat;
        this.currentLong = long;
        this.lastTimeMoved = new Date();
        log.debug(`worker ${this.id} moved to ${lat}, ${long}`);
    }

    canMoveTo(lat, long):Boolean {
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

        let timeDiff = Utils.timestepTransformUp(new Date() - this.lastTimeMoved);
        let speed = meters / (timeDiff / 1000);

        let timeSeconds = Math.round(timeDiff / 1000);
        let roundedSpeed = Math.round((speed * 10) / 10);

        log.debug(`worker ${this.id} would move from ${this.currentLat}, ${this.currentLong} to ${lat}, ${long}, a distance of ${meters}m over ${timeSeconds}s, a speed of ${roundedSpeed} m/s`);
        if (speed <= Config.workerMaximumMovementSpeedMetersPerSecond) {
            log.debug(`worker ${this.id} can move to ${lat}, ${long} because ${roundedSpeed}m/s <= ${Config.workerMaximumMovementSpeedMetersPerSecond}m/s`);
            return true;
        }
        else {
            log.debug(`worker ${this.id} is unable to move to ${lat}, ${long} because it would move at ${roundedSpeed} vs the maximum of ${Config.workerMaximumMovementSpeedMetersPerSecond}`);
            return false;
        }
    }

    reserve():void {
        this.isFreeBool = false;
        this.lastTimeReserved = new Date();
        log.debug(`worker ${this.id} reserved`);
    }

    free():void {
        this.isFreeBool = true;
        this.lastTimeFreed = new Date();
        this.currentRandomExtraDelay = Utils.timestepTransformDown(Utils.getRandomInt(0, Config.randomWorkerDelayFudgeFactor));
        log.debug(`worker ${this.id} freed`);
    }

    isFree():boolean {
        return this.isFreeBool;
    }
}