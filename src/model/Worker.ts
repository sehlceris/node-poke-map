import Spawnpoint from "./Spawnpoint";
let geolib = require('geolib');
let pogobuf = require('pogobuf');
import bluebird = require('bluebird');

import Constants from '../Constants';
import Config from '../Config';
import Utils from '../Utils';
import FakeData from '../FakeData';

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
    client:any;
    consecutiveLoginFailures:number;
    consecutiveScanFailures:number;
    isFreeBool:Boolean;
    isLoggedInBool:Boolean;
    isWaitingUntilReloginBool:Boolean;
    isBannedBool:Boolean;
    currentLat:number;
    currentLong:number;
    currentElev:number;
    lastTimeMoved:Date;
    lastTimeFreed:Date;
    lastTimeReserved:Date;
    currentRandomExtraDelay:Number;
    totalMetersMoved:Number;
    totalMovements:Number;
    totalScans:Number;

    constructor(params:LoginData) {
        this.isFreeBool = true;
        this.isLoggedInBool = false;
        this.isWaitingUntilReloginBool = false;
        this.consecutiveLoginFailures = 0;
        this.consecutiveScanFailures = 0;
        this.id = nextUsableId;
        nextUsableId++;

        this.username = params.username;
        this.password = params.password;
        this.totalMetersMoved = 0;
        this.totalMovements = 0;
        this.totalScans = 0;

        this.currentRandomExtraDelay = Utils.getRandomInt(0, Utils.timestepTransformDown(Config.randomWorkerDelayFuzzFactor));
    }

    ensureLoggedIn():Promise {
        if (this.isLoggedIn()) {
            return Promise.resolve();
        }
        else {
            if (true !== this.isWaitingUntilRelogin()) {
                return new Promise((resolve, reject) => {
                    setTimeout(resolve, Utils.getRandomInt(0, Utils.timestepTransformDown(Config.randomWorkerLoginFuzzFactor)));
                })
                    .then(() => {
                        return this.refreshLogin();
                    });
            }
            else {
                return Promise.reject(`worker ${this.id} waiting until relogin`);
            }
        }
    }

    refreshLogin():Promise {
        this.client = new pogobuf.Client();
        let ptc = new pogobuf.PTCLogin();

        let loginPromise:Promise;

        if (true === Config.simulate) {
            loginPromise = new Promise((resolve, reject) => {
                let roll = Utils.getRandomFloat(0, 1);
                if (roll < Config.workerLoginFailureProbability) {
                    return reject('randomly failed to log in');
                }
                return resolve();
            });
        }
        else {
            log.info(`logging in account ${this.username} with PTC...`);
            loginPromise = ptc.login(this.username, this.password).then((token) => {
                this.client.setAuthInfo('ptc', token);
                return this.client.init();
            });
        }

        return loginPromise.then((res) => {
            this.consecutiveLoginFailures = 0;
            this.isLoggedInBool = true;
            this.isWaitingUntilReloginBool = false;
            log.debug(`worker ${this.id}:'${this.username}' logged in successfully`);
            return res;
        })
            .catch((err) => {
                this.consecutiveLoginFailures++;

                if (this.consecutiveLoginFailures >= Config.workerConsecutiveLoginFailureLimit) {
                    log.error(`worker ${this.id}:'${this.username}' seems to be banned (can't login) - removing from worker pool`);
                    this.isBannedBool = true;
                }
                else {
                    log.debug(`worker ${this.id}:'${this.username}' failed to log in - will try again`);
                    this.isLoggedInBool = false;
                    this.isWaitingUntilReloginBool = true;
                    setTimeout(() => {
                        this.refreshLogin();
                    }, Utils.timestepTransformDown(Config.workerReloginDelayMs));
                }

                throw err;
            });
    }

    scan(spawnpoint:Spawnpoint):Promise {
        this.moveTo(spawnpoint.lat, spawnpoint.long, spawnpoint.elev);
        return this.ensureLoggedIn()
            .then(() => {
                return new Promise((resolve, reject) => {
                    if (true === Config.simulate) {
                        setTimeout(() => {
                            let roll = Utils.getRandomFloat(0, 1);
                            if (roll < Config.workerScanFailureProbability) {
                                this.handleScanFailure();
                                return reject('randomly failed to scan');
                            }
                            let result = FakeData.getFakePogobufMapResponseWithSpawn(spawnpoint.id, spawnpoint.lat, spawnpoint.long);
                            this.handleScanSuccess();
                            this.incrementScanCounter();
                            return resolve(result);
                        }, Utils.timestepTransformDown(Config.simulationRequestDuration));
                    }
                    else {
                        //TODO
                        let cellIds = pogobuf.Utils.getCellIDs(this.currentLat, this.currentLong, 1);
                        this.client.getMapObjects(cellIds, Array(cellIds.length).fill(0))
                            .then((mapObjects) => {
                                return mapObjects.map_cells[0];
                            });
                    }
                });
            })
    }

    handleScanFailure():void {

        this.consecutiveScanFailures++;

        if (this.consecutiveScanFailures >= Config.workerConsecutiveScanFailureLimit) {
            log.error(`worker ${this.id}:'${this.username}' seems to be banned (can't scan) - removing from worker pool`);
            this.isBannedBool = true;
        }
        else {
            log.debug(`worker ${this.id}:'${this.username}' failed to scan - will try to log in again`);
            this.isLoggedInBool = false;
            this.isWaitingUntilReloginBool = true;
            setTimeout(() => {
                this.refreshLogin();
            }, Utils.timestepTransformDown(Config.workerReloginDelayMs));
        }
    }

    handleScanSuccess():void {
        this.consecutiveScanFailures = 0;
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

    moveTo(lat:number, long:number, elev:number):void {

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

        let fuzzedCoords = Utils.fuzzGPSCoordinates({
            lat: lat,
            long: long,
            elev: elev,
        });

        this.currentLat = fuzzedCoords.lat;
        this.currentLong = fuzzedCoords.long;
        this.currentElev = fuzzedCoords.elev;
        this.lastTimeMoved = new Date();
        this.totalMovements++;

        if (!Config.simulate) {
            this.client.setPosition(this.currentLat, this.currentLong, this.currentElev);
        }

        log.debug(`worker ${this.id} moved to ${this.currentLat}, ${this.currentLong} | ${this.currentElev}`);
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
            }, 1, 1);

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

    incrementScanCounter():void {
        this.totalScans++;
    }

    reserve():void {
        this.isFreeBool = false;
        this.lastTimeReserved = new Date();
        log.debug(`worker ${this.id} reserved`);
    }

    free():void {
        this.isFreeBool = true;
        this.lastTimeFreed = new Date();
        this.currentRandomExtraDelay = Utils.timestepTransformDown(Utils.getRandomInt(0, Config.randomWorkerDelayFuzzFactor));
        log.debug(`worker ${this.id} freed`);
    }

    isLoggedIn():boolean {
        return this.isLoggedInBool;
    }

    isBanned():boolean {
        return this.isBannedBool;
    }

    isWaitingUntilRelogin():boolean {
        return this.isWaitingUntilReloginBool;
    }

    isFree():boolean {
        return this.isFreeBool && !this.isBanned() && !this.isWaitingUntilRelogin();
    }
}