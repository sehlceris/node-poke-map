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

/**
 * A Worker is a single account, with a username. The worker moves throughout the world and executes scans for map data
 */
export default class Worker {

    id:number;
    username:String;
    password:String;
    client:any; //pogobuf API client
    consecutiveLoginFailures:number;
    consecutiveScanFailures:number;
    isFreeBool:Boolean; //whether this worker is free to reserve for a scan
    isLoggedInBool:Boolean; //whether this worker is logged in
    lastLoggedInTime:Date;
    randomMaximumLoggedInTimeFuzzFactor:number; //ms; a random time to wait until logging this user out and logging back in
    isWaitingUntilReloginBool:Boolean; //signals that this worker is "logged out" and is in the process of logging back in - it is unavailable for use
    isBannedBool:Boolean; //flag, if true, this worker is regarded as banned and can't be used
    currentLat:number; //current latitude that this worker is at
    currentLong:number;
    currentElev:number;
    lastTimeMoved:Date;
    lastTimeFreed:Date;
    lastTimeReserved:Date;
    currentRandomExtraDelay:Number; //random extra delay to wait until next map scan
    totalMetersMoved:Number; //total meters moved while walking through the world
    totalMovements:Number;
    totalScans:Number;

    /**
     * Creates the worker
     * @param {LoginData} params Username/password
     */
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

    /**
     * Ensures that the worker is logged in and ready to scan
     * @returns {Promise} Promise that this user is logged in
     */
    ensureLoggedIn():Promise {

        //If worker has been logged in for too long, relogin
        if (this.lastLoggedInTime) {
            let loginDiff = Utils.timestepTransformUp(new Date() - this.lastLoggedInTime);
            let maxLoggedInTime = Config.workerMaximumLoggedInTime - this.randomMaximumLoggedInTimeFuzzFactor;
            if (loginDiff > maxLoggedInTime) {
                log.debug(`worker ${this.id}:${this.username} has been logged in for ${loginDiff} ms, logging in again`);
                this.isLoggedInBool = false;
            }
        }

        if (this.isLoggedIn()) {
            return Promise.resolve();
        }
        else {
            if (true !== this.isWaitingUntilRelogin()) {
                return new Promise((resolve, reject) => {
                    let waitTime = Utils.getRandomInt(0, Utils.timestepTransformDown(Config.randomWorkerLoginFuzzFactor));
                    log.debug(`waiting ${waitTime} to log in worker ${this.id}:${this.username}`);
                    setTimeout(resolve, waitTime);
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

    /**
     * Logs this worker out, creates a new pogobuf client, and logs the worker back in (needs to be done periodically)
     * @returns {Promise} Promise that the worker is logged in
     */
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
            log.debug(`logging in account ${this.username} with PTC...`);
            loginPromise = ptc.login(this.username, this.password).then((token) => {
                this.client.setAuthInfo('ptc', token);
                return this.client.init();
            });
        }

        return loginPromise.then((res) => {
            this.consecutiveLoginFailures = 0;
            this.isLoggedInBool = true;
            this.isWaitingUntilReloginBool = false;
            this.lastLoggedInTime = new Date();
            this.randomMaximumLoggedInTimeFuzzFactor = Utils.getRandomInt(0, Config.randomMaximumLoggedInTimeFuzzFactor);
            log.verbose(`worker ${this.id}:'${this.username}' logged in successfully`);
            return res;
        })
            .catch((err) => {
                this.consecutiveLoginFailures++;

                if (this.consecutiveLoginFailures >= Config.workerConsecutiveLoginFailureLimit) {
                    log.error(`worker ${this.id}:'${this.username}' seems to be banned (can't login) - removing from worker pool`);
                    this.isBannedBool = true;
                }
                else {
                    log.verbose(`worker ${this.id}:'${this.username}' failed to log in - will try again`);
                    this.isLoggedInBool = false;
                    this.isWaitingUntilReloginBool = true;
                    setTimeout(() => {
                        this.refreshLogin();
                    }, Utils.timestepTransformDown(Config.workerReloginDelayMs));
                }

                throw err;
            });
    }

    /**
     * Moves a worker to a spawnpoint and scans it for map data
     * @param {Spawnpoint} spawnpoint Spawnpoint to scan
     * @returns {Promise} Scan result from Niantic API
     */
    scan(spawnpoint:Spawnpoint):Promise {
        return this.ensureLoggedIn()
            .then(() => {
                this.moveTo(spawnpoint.lat, spawnpoint.long, spawnpoint.elev);
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
                        log.debug(`executing scan at ${this.currentLat}, ${this.currentLong}`);
                        let cellIds = pogobuf.Utils.getCellIDs(this.currentLat, this.currentLong, 1);
                        this.client.getMapObjects(cellIds, Array(cellIds.length).fill(0))
                            .then((mapObjects) => {
                                this.handleScanSuccess();
                                this.incrementScanCounter();
                                return mapObjects.map_cells[0];
                            })
                            .then(resolve)
                            .catch((err) => {
                                this.handleScanFailure();
                                reject(err)
                            });
                    }
                });
            })
    }

    /**
     * If a scan failed, do some stuff, if scan failures happen too often, assume the worker is banned
     */
    handleScanFailure():void {

        this.consecutiveScanFailures++;

        if (this.consecutiveScanFailures >= Config.workerConsecutiveScanFailureLimit) {
            log.error(`worker ${this.id}:'${this.username}' seems to be banned (can't scan) - removing from worker pool`);
            this.isBannedBool = true;
        }
        else {
            log.verbose(`worker ${this.id}:'${this.username}' failed to scan - will try to log in again`);
            this.isLoggedInBool = false;
            this.isWaitingUntilReloginBool = true;
            setTimeout(() => {
                this.refreshLogin();
            }, Utils.timestepTransformDown(Config.workerReloginDelayMs));
        }
    }

    /**
     * If scan is successful, reset the consecutive scan failure count
     */
    handleScanSuccess():void {
        this.consecutiveScanFailures = 0;
    }

    /**
     * Returns true if this worker has been used for a scan before
     * @returns {Boolean} true if this worker has been used for a scan before
     */
    hasBeenUsedAtLeastOnceDuringProgramExecution():boolean {
        return (!!this.lastTimeReserved || !!this.lastTimeFreed || !!this.lastTimeMoved);
    }

    /**
     * Gets time since this worker has last been freed (i.e. time since worker became idle)
     * @returns {Number}
     */
    getTimeSinceLastFree():number {
        if (!this.lastTimeFreed) {
            return Infinity;
        }
        else {
            return Utils.timestepTransformUp(new Date() - this.lastTimeFreed);
        }
    }

    /**
     * Niantic enforces a delay between map scans for each worker. Returns true if worker has waited long enough since its last scan
     * @returns {boolean} true if worker has waited long enough since its last scan
     */
    hasSatisfiedScanDelay():boolean {
        let satisfied = ((this.getTimeSinceLastFree() + this.currentRandomExtraDelay) > Config.workerScanDelayMs);
        log.debug(`worker ${this.id} has${satisfied ? "" : " not"} satisfied scan delay (has waited ${(this.getTimeSinceLastFree() + this.currentRandomExtraDelay)} out of ${Config.workerScanDelayMs + this.currentRandomExtraDelay})`);
        return satisfied;
    }

    /**
     * Moves the worker to the specified location, fuzzing its GPS coordinates a little bit
     * @param lat
     * @param long
     * @param elev
     */
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

    /**
     * Calculates whether it is feasible that this worker has walked from its current position to the specified lat/long, based on its last idle time
     * @param lat
     * @param long
     * @returns {boolean} true if worker could have feasibly moved to the specified lat/long, false if it would have been moving too quickly
     */
    canMoveTo(lat, long):Boolean {

        //if worker has never been moved before, then it can move anywhere
        if (!this.lastTimeMoved) {
            return true;
        }

        //calculate distance between worker's current position and the specified coordinates
        let meters = geolib.getDistance(
            {
                latitude: lat,
                longitude: long
            },
            {
                latitude: this.currentLat,
                longitude: this.currentLong
            }, 1, 1);

        //calculate the speed at which the worker would need to move to get to the specified coordinates
        let timeDiff = Utils.timestepTransformUp(new Date() - this.lastTimeMoved);
        let speed = meters / (timeDiff / 1000);

        let timeSeconds = Math.round(timeDiff / 1000);
        let roundedSpeed = Math.round((speed * 10) / 10);

        log.debug(`worker ${this.id} would move from ${this.currentLat}, ${this.currentLong} to ${lat}, ${long}, a distance of ${meters}m over ${timeSeconds}s, a speed of ${roundedSpeed} m/s`);

        if (speed <= Config.workerMaximumMovementSpeedMetersPerSecond) {
            //if the worker's required speed is lower than the cap, allow the move
            log.debug(`worker ${this.id} can move to ${lat}, ${long} because ${roundedSpeed}m/s <= ${Config.workerMaximumMovementSpeedMetersPerSecond}m/s`);
            return true;
        }
        else {
            //if the speed required to make the worker move to the specified coordinates is too high, don't allow the worker to be moved
            log.debug(`worker ${this.id} is unable to move to ${lat}, ${long} because it would move at ${roundedSpeed} vs the maximum of ${Config.workerMaximumMovementSpeedMetersPerSecond}`);
            return false;
        }
    }

    incrementScanCounter():void {
        this.totalScans++;
    }

    /**
     * Reserves the worker, marking it unavailable for scans
     */
    reserve():void {
        this.isFreeBool = false;
        this.lastTimeReserved = new Date();
        log.debug(`worker ${this.id} reserved`);
    }

    /**
     * Frees the worker, marking it available for scans
     */
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

    /**
     * A worker is free if it is not reserved, not banned, and not re-logging in
     * @returns {Boolean}
     */
    isFree():boolean {
        return this.isFreeBool && !this.isBanned() && !this.isWaitingUntilRelogin();
    }
}