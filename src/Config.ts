let fs = require('fs');
import Constants from './Constants';

export interface Config {
    workerScanDelayMs:number;
    globalScanDelayMs:number;
    workerMaximumMovementSpeedMetersPerSecond:number;
    topLeftOfScanArea:string;
    bottomRightOfScanArea:string;
    workerLogins:Array<any>;
    googleMapsApiKey:string;
}

let config = JSON.parse(fs.readFileSync(Constants.CONFIG_JSON_PATH, 'utf-8'));

export default config;