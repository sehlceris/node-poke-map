let fs = require('fs');
import Constants from './Constants';

export interface Config {
    workerScanDelayMs:number; //
    globalScanDelayMs:number; //
    spawnScanDelay:number; //
    workerMaximumMovementSpeedMetersPerSecond:number; //
    maximumRequestQueueLength:number; //
    topLeftOfScanArea:string; //
    bottomRightOfScanArea:string; //
    googleMapsApiKey:string; //
    enableGreedyWorkerAllocation:boolean; //
    enableParallelRequests:boolean; //
    randomWorkerDelayFudgeFactor:number; //
    randomGlobalScanDelayFudgeFactor:number //

    //Logging, statistics, and debugging
    consoleLogLevel:String //
    fileLogLevel:String //
    logFilePath:String //
    statisticLoggingInterval:number //

    //Simulation
    simulate:boolean //
    simulationTimestep:number //
    simulationRequestDuration:number //
    minutesSimulated:number //
}

let config = JSON.parse(fs.readFileSync(Constants.CONFIG_JSON_PATH, 'utf-8'));

export default config;