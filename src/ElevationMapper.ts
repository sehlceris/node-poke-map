let gmaps = require('@google/maps');
let fs = require('fs');
import Config from './Config';
import Data from './Data';
import Utils from './Utils';
import Constants from './Constants';

const log:any = Utils.getLogger('ElevationMapper');

const LOCATIONS_PER_REQUEST = 128;
const DELAY_BETWEEN_REQUESTS = 3000;
const ELEVATION_JSON_KEY = 'elevation';
const MAXIMUM_LAT_DIFF_FOR_MATCH = 0.0000000000001;
const MAXIMUM_LONG_DIFF_FOR_MATCH = 0.000000000001;

export default class ElevationMapper {

    spawnsJson:any;
    gmapsApiKey:String;
    gmapsClient:any;
    segments:any;
    segmentIndex:Number;

    constructor() {
        this.gmapsApiKey = Config.googleMapsApiKey;
        this.spawnsJson = Data.getSpawns();
        this.gmapsClient = gmaps.createClient({
            key: this.gmapsApiKey
        });
    }

    execute():Promise {

        let filteredSpawns = this.spawnsJson.filter((spawn) => {
            return (typeof(spawn[ELEVATION_JSON_KEY]) !== 'number');
        });

        let segments = this.segmentLocations(filteredSpawns);
        log.info(`segmented data into ${segments.length} requests...`);

        this.segments = segments;
        this.segmentIndex = 0;
        return this.process()
            .then(() => {
                log.info(`all segments processed`);
                log.info(`writing spawns json at ${Constants.SPAWNS_WITH_ELEVATIONS_JSON_PATH}`);
                this.writeJson(this.spawnsJson);
                log.info(`write complete`);
            });

        // return new Promise((resolve, reject) => {
        //
        //     let cumulativeDelay = 0;
        //     let segmentPromises = segments.map((segment, i) => {
        //         return new Promise(
        //             (resolve, reject) => {
        //                 setTimeout(resolve, cumulativeDelay);
        //                 cumulativeDelay += DELAY_BETWEEN_REQUESTS;
        //             })
        //             .then(() => {
        //                 log.info(`populating segment ${i}`);
        //                 return this.populateSegmentData(segment, i);
        //             });
        //     });
        //
        //     return Promise.all(segmentPromises)
        //         .then(() => {
        //             log.info(`writing spawns json at ${Constants.SPAWNS_WITH_ELEVATIONS_JSON_PATH}`);
        //             this.writeJson(this.spawnsJson);
        //             log.info(`write complete`);
        //             return resolve();
        //         })
        //         .catch(reject);
        // })
    }

    process():Promise {
        log.info(`processing segment ${this.segmentIndex}`);
        return this.populateSegmentData(this.segments[this.segmentIndex], this.segmentIndex)
            .then(() => {
                return new Promise((resolve, reject) => {
                    setTimeout(resolve, DELAY_BETWEEN_REQUESTS);
                })
            })
            .then(() => {
                log.info(`processed segment ${this.segmentIndex}`);
                if (this.segmentIndex < this.segments.length - 1) {
                    this.segmentIndex++;
                    return this.process();
                }
            })
            .catch((err) => {
                log.info(`failed to process segment ${this.segmentIndex}: ${err}; continuing...`);
                if (this.segmentIndex < this.segments.length - 1) {
                    this.segmentIndex++;
                    return this.process();
                }
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
            return new Promise((resolve, reject) => {
                this.gmapsClient.elevation({
                    locations: spawnLatLongs
                }, (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    else if (result.json && result.json.results && result.json.results.length && result.json.status === 'OK') {
                        return resolve(result.json.results);
                    }
                    else {
                        return reject(`results are in an unrecognized format. ${JSON.stringify(result)}`)
                    }
                });
            })
                .then((results) => {
                    log.info(`segment ${segmentIndex} elevation service returned results. processing results, please wait... `);
                    //log.info(JSON.stringify(results));

                    results.forEach((result) => {
                        if (result.elevation && result.location) {
                            let spawn = this.spawnsJson.find((spawn) => {

                                if (typeof(spawn[ELEVATION_JSON_KEY]) === 'number') {
                                    return false;
                                }

                                let diffLat = Math.abs(result.location.lat - spawn.lat);
                                let diffLong = Math.abs(result.location.lng - spawn.lng);

                                let match = ((diffLat <= MAXIMUM_LAT_DIFF_FOR_MATCH) && (diffLong <= MAXIMUM_LONG_DIFF_FOR_MATCH));

                                //log.info(`diffLat: ${diffLat}; diffLong: ${diffLong}; match = ${match}`);

                                return match
                            });
                            if (!spawn) {
                                log.error(`segment ${segmentIndex} failed insert result for spawn at ${result.location.lat}, ${result.location.lng} - no match`);
                            }
                            else {
                                spawn[ELEVATION_JSON_KEY] = result.elevation;
                            }
                        }
                    });

                    log.info(`processed results for segment ${segmentIndex}/${this.segments.length - 1}`);
                })
                .catch((err) => {
                    log.error(`segment ${segmentIndex} elevation service returned error: ${err}`);
                });
        }
        catch (e) {
            let message = `caught exception while making request for segment ${segmentIndex}: ${e}`;
            log.error(message);
            return Promise.reject(message);
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
        setTimeout(() => {
            process.exit(1);
        }, 500);
    })