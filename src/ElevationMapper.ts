let gmaps = require('@google/maps');
let fs = require('fs');
import Config from './Config';
import Data from './Data';
import Utils from './Utils';
import Constants from './Constants';

const log:any = Utils.getLogger('ElevationMapper');

const LOCATIONS_PER_REQUEST = 500;
const DELAY_BETWEEN_REQUESTS = 2000;
const ELEVATION_JSON_KEY = 'elevation';

export default class ElevationMapper {

    spawnsJson:any;
    gmapsApiKey:String;
    gmapsClient:any;

    constructor() {
        this.gmapsApiKey = Config.googleMapsApiKey;
        this.spawnsJson = Data.getSpawns();
        this.gmapsClient = gmaps.createClient({
            key: this.gmapsApiKey
        });
    }

    execute():Promise {
        return new Promise((resolve, reject) => {
            let filteredSpawns = this.spawnsJson.filter((spawn) => {
                return (typeof(spawn[ELEVATION_JSON_KEY]) !== 'number');
            });
            let segments = this.segmentLocations(filteredSpawns);
            log.info(`segmented data into ${segments.length} requests...`);

            let cumulativeDelay = 0;
            let segmentPromises = segments.map((segment, i) => {
                return new Promise(
                    (resolve, reject) => {
                        setTimeout(resolve, cumulativeDelay);
                        cumulativeDelay += DELAY_BETWEEN_REQUESTS;
                    })
                    .then(() => {
                        log.info(`populating segment ${i}`);
                        return this.populateSegmentData(segment, i);
                    });
            });

            Promise.all(segmentPromises)
                .then(() => {
                    log.info(`writing spawns json at ${Config.SPAWNS_WITH_ELEVATIONS_JSON_PATH}`);
                    this.writeJson(this.spawnsJson);
                    log.info(`write complete`);
                })
        })
    }

    segmentLocations(spawns:Array):Array<Array> {

        let segments = [];

        let i;
        let j;
        let tempArray;
        for (i = 0, j = spawns.length; i < j; i += LOCATIONS_PER_REQUEST) {
            tempArray = spawns.slice(i, i + LOCATIONS_PER_REQUEST);
            segments.push(tempArray);
        }

        return segments;
    }

    populateSegmentData(segment, segmentIndex):Promise {
        let spawnLatLongs = segment.map((spawn) => {
            return {
                lat: spawn.lat,
                lng: spawn.lng
            };
        });

        log.info(`making request for segment ${segmentIndex}`);
        try {
            return this.gmapsClient.elevation({
                locations: spawnLatLongs
            })
                .asPromise()
                .then((results) => {
                    log.info(`segment ${segmentIndex} elevation service returned results`);
                    log.info(JSON.stringify(results));

                    results.forEach((result) => {
                        if (result.elevation && result.location) {
                            let spawn = this.spawnsJson.find((spawn) => {
                                return (spawn.lat === result.location.lat && spawn.lng === result.location.lng);
                            });
                            if (!spawn) {
                                log.error(`segment ${segmentIndex} failed insert result for spawn at ${result.location.lat}, ${result.location.lng} - no match`);
                            }
                            else {
                                spawn[ELEVATION_JSON_KEY] = result.elevation;
                            }
                        }
                    });
                })
                .catch((err) => {
                    log.error(`segment ${segmentIndex} elevation service returned error: ${err}`);
                });
        }
        catch (e) {
            log.error(`caught exception while making request for segment ${segmentIndex}: ${e}`);
        }
    }

    writeJson(data):void {
        fs.writeFileSync(Constants.SPAWNS_WITH_ELEVATIONS_JSON_PATH, JSON.stringify(data));
    }
}

let mapper = new ElevationMapper();
log.info(`mapping elevations...`);
mapper.execute()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        log.error(`failed to write data: ${err}`);
        process.exit(1);
    })