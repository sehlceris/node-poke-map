import Mongo = require('mongodb');
import express = require('express');
import bluebird = require('bluebird');
import Constants from './Constants';
import Config from './Config';
import Utils from './Utils';

const log:any = Utils.getLogger('RestHandler');

export class RestHandler {

	constructor() {

	}
}

let instance = new RestHandler();
export default instance;