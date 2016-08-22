let fs = require('fs');
import Constants from './Constants';

export interface Config {
	//End user will probably want to configure these
	workerScanDelayMs:number; // delay each individual worker must wait before scanning again
	globalScanDelayMs:number; // delay between sending scan requests globally (includes all workers)
	spawnScanDelay:number; // delay between a spawn occurring and the scanner trying to pick it up
	spawnpointLookbackMinutes:number; // when starting up the scanner, should it scan points that occurred in the past? if so, how many minutes back?
	workerMaximumMovementSpeedMetersPerSecond:number; //maximum speed a worker may move in order to reach a spawn
	maximumRequestQueueLength:number; // maximum number of requests that can be queued before dropping
	scanCenterLat:number; // lat number describing scan center
	scanCenterLong:number; // long number describing scan center
	scanRadiusMeters:number; // radius of scan. spawnpoints outside this radius will not be scanned
	googleMapsApiKey:string; // your google maps API key

	//MongoDB
	mongoDbUsername:string;
	mongoDbPassword:string;
	mongoDbHost:string;
	mongoDbPort:number;
	mongoDbDatabaseName:string;

	//End user probably should not touch
	enableGreedyWorkerAllocation:boolean; // will use all provided workers equally instead of trying to maximize each worker's usage
	enableParallelRequests:boolean; // if false, will wait for previous scan request to finish before allowing start of next. probably best to set it to true unless you want to throttle this way
	randomWorkerDelayFuzzFactor:number; // random worker delay added to the regular scan delay. between 0 and this number, in milliseconds
	randomGlobalScanDelayFuzzFactor:number; // random global scan delay added to the regular scan delay. between 0 and this number, in milliseconds
	randomLatFuzzFactor:number; // random latitude fuzz. between 0 and this number
	randomLongFuzzFactor:number; // random longitude fuzz. between 0 and this number
	randomElevationFuzzFactor:number; // random elevation fuzz. between 0 and this number
	latLongDecimalPlaces:number; // how many decimal places remain at the end of lat/longs when submitting to the server
	elevDecimalPlaces:number; // how many decimal places remain at the end of elevations when submitting to the server

	//Logging, statistics, and debugging
	consoleLogLevel:String; // 'debug', 'verbose', 'info', 'warn', 'error'
	fileLogLevel:String; // 'debug', 'verbose', 'info', 'warn', 'error'
	logFilePath:String; // path you want the file log to be output to
	statisticLoggingInterval:number; // interval, in milliseconds, to print statistics. you probably should set it to at least 60000

	//Simulation
	simulate:boolean; // if true, requests will NOT be made to the API and instead a simulation will occur. useful for determining proper settings for workers/scan delay
	simulationTimeMultiplier:number; // while simulating, the program speed will be multiplied by this number. '5' will run the scans/spawns 5 times faster than real life. if set too high, will not be accurate and may screw up your computer
	simulationRequestDuration:number; // how long do you think the servers will take to respond, in milliseconds?
	minutesSimulated:number; // how many minutes of runtime do you want to simulate?

	//Plugins
	plugins:Plugins;
}

export interface Plugins {
	slackBot:SlackBotConfig;
}

export interface SlackBotConfig {
	enabled:Boolean;
	sendMessageOnInitialization:Boolean;
	token:String;
	name:String;
	channel:String;
	subscriptions:Array<Number>;
}

let config = JSON.parse(fs.readFileSync(Constants.CONFIG_JSON_PATH, 'utf-8'));

export default config;