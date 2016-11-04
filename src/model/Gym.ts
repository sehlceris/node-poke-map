import fs = require('fs');
import bluebird = require('bluebird');
import Constants from '../Constants';
import Utils from '../Utils';
import Spawnpoint from "./Spawnpoint";

const log:any = Utils.getLogger('Gym');

/**
 * Represents a Gym
 */
export interface GymData {
    id:String;
    last_modified_timestamp_ms:Number;
    latitude:Number;
    longitude:Number;
    owned_by_team:Number;
    gym_points:Number;
    guard_pokemon_id:Number;
    guard_pokemon_cp:Number;
    is_in_battle:Boolean;
}