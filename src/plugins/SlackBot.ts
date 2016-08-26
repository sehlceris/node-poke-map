let fs = require('fs');
let moment = require('moment');
let sb = require('slackbots');
import Spawnpoint from '../Model/Spawnpoint';
import Pokemon from '../Model/Pokemon';
import Utils from '../Utils';

const log:any = Utils.getLogger('SlackBot');

const CONFIG_PATH:string = 'slackbot-config.json';

export interface SlackBotConfig {
    enabled:Boolean;
    sendMessageOnInitialization:Boolean;
    configRefreshInterval:Boolean;
    token:String;
    name:String;
    channel:String;
    subscriptions:Array<Number>;
}

export default class SlackBot {

    static pluginName:String = 'slackBot';

    config:SlackBotConfig
    bot:any;

    constructor() {
        this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

        if (this.config.configRefreshInterval > 4999) {
            setTimeout(this.refreshConfig.bind(this), this.config.configRefreshInterval);
        }

        this.bot = new sb({
            token: this.config.token,
            name: this.config.name
        });

        if (true === this.config.enabled && this.config.sendMessageOnInitialization) {
            this.bot.on('start', () => {
                let message = `Clairvoyance SlackBot notifier initialized. Subscriptions: ${JSON.stringify(this.config.subscriptions)}`;
                log.info(message);
                this.bot.postMessageToChannel(this.config.channel, message);
            });
        }
    }

    getPluginName():String {
        return SlackBot.pluginName;
    }

    handleSpawn(pokemon:Pokemon, spawnpoint:Spawnpoint):void {
        if (true === this.config.enabled && this.config.subscriptions.includes(pokemon.number)) {
            let gmapsUrl = `http://maps.google.com/maps?z=12&t=m&q=loc:${pokemon.lat}+${pokemon.long}`;
            let timeLeft = pokemon.disappearTimeMs - new Date().getTime();
            let timeLeftStr = `${Math.floor(timeLeft / 60000)} minutes`;
            let disappearMinute = moment(new Date()).add(timeLeft, 'ms').get('minute');
            let message = `${pokemon.name} despawns at xx:${disappearMinute} (${timeLeftStr}) - ${gmapsUrl}`;
            this.bot.postMessageToChannel(this.config.channel, message);
        }
    }

    handleError(error:String):void {
        if (true === this.config.enabled) {
            let message = `ERROR: ${error}`;
            this.bot.postMessageToChannel(this.config.channel, message);
        }
    }

    refreshConfig():void {
        fs.readFile(CONFIG_PATH, 'utf-8', (err, data) => {
            if (err) {
                log.error(`failed to refresh config: ${err}`);
            }
            this.config = JSON.parse(data);
            log.debug(`reloaded config`);

            if (this.config.configRefreshInterval > 4999) {
                setTimeout(this.refreshConfig.bind(this), this.config.configRefreshInterval);
            }
        });
    }
}

module.exports = SlackBot;