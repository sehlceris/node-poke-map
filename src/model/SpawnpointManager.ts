let fs = require('fs');
let log = require('winston');
let bluebird = require('bluebird');

import Constants from '../Constants';
import Spawnpoint from 'Spawnpoint';

export default class SpawnpointManager {
    
    spawnPoints:Array<Spawnpoint>;

    constructor(o) {
        this.lat = o.lat;
        this.long = o.lng;
        this.cell = o.cell;
        this.id = o.sid;
        this.time = o.time;
    }

}