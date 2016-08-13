let fs = require('fs');
import Constants from './Constants';

export interface Config {
    workerScanDelayMs:number;
    globalScanDelayMs:number;
    spawnScanDelay:number;
    workerMaximumMovementSpeedMetersPerSecond:number;
    maximumRequestQueueLength:number;
    topLeftOfScanArea:string;
    bottomRightOfScanArea:string;
    workerLogins:Array<any>;
    googleMapsApiKey:string;
    enableGreedyWorkerAllocation:boolean;
    randomWorkerDelayFudgeFactor:number;
    randomGlobalScanDelayFudgeFactor:number
    consoleLogLevel:String
    fileLogLevel:String
    logFilePath:String
    statisticLoggingInterval:number
    simulate:boolean
    simulationTimestep:number
}

let config = JSON.parse(fs.readFileSync(Constants.CONFIG_JSON_PATH, 'utf-8'));

export default config;