import fs = require('fs');
import Constants from '../Constants';

export default class Spawnpoint {
    lat:number;
    long:number;
    cell:number;
    id:number;
    time:number;

    constructor(o) {
        this.lat = o.lat;
        this.long = o.lng;
        this.cell = o.cell;
        this.id = o.sid;
        this.time = o.time;
    }
    
    
}