import fs = require('fs');
import path = require('path');
import Pokemon from 'model/Pokemon';
import Constants from './Constants';
import Config from './Config';
import Utils from './Utils';
import Spawnpoint from "./model/Spawnpoint";

const log:any = Utils.getLogger('PluginManager');

export interface Plugin {
    handleSpawn(pokemon:Pokemon, spawnpoint:Spawnpoint):void;
    handleError(error:String):void;
    getPluginName():String;
}

export default class PluginManager {

    plugins:Array<Plugin>

    constructor() {

        this.plugins = [];

        fs.readdir(Constants.PLUGINS_STAT_PATH, (err, files:Array<String>) => {
            if (err) {
                log.error(`failed to read plugins: ${err}`);
                return;
            }
            else {
                files
                    .filter((file) => {
                        file = path.join(Constants.PLUGINS_STAT_PATH, file);
                        return fs.statSync(file).isFile();
                    })
                    .forEach((file) => {
                        if (file.endsWith('.js')) {
                            try {
                                let Plugin = require(Constants.PLUGINS_REQUIRE_PATH + file.slice(0, file.length - 3));
                                let pluginName = Plugin.pluginName;
                                let plugin = new Plugin();
                                log.info(`loaded plugin: ${plugin.getPluginName()}`);
                                this.plugins.push(plugin);
                            }
                            catch (e) {
                                log.error(`failed to load plugin ${file}: ${e}`);
                            }
                        }
                    });
            }
        });
    }

    handleSpawn(pokemon:Pokemon, spawnpoint:Spawnpoint):void {
        this.plugins.forEach((plugin) => {
            try {
                plugin.handleSpawn(pokemon, spawnpoint);
            }
            catch (e) {
                log.error(`failed to handle spawn for plugin ${plugin.getPluginName()}: ${e}`);
            }
        });
    }
}