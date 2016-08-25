let moment = require('moment');
let sb = require('slackbots');
import {SlackBotConfig} from '../Config';
import Spawnpoint from '../Model/Spawnpoint';
import Pokemon from '../Model/Pokemon';
import Utils from '../Utils';

const log:any = Utils.getLogger('SlackBot');

export default class SlackBot {

    static pluginName:String = 'slackBot';

    token:String;
    name:String;
    channel:String;
    subscriptions:Array<Number>;
    bot:any;

    constructor(config:SlackBotConfig) {
        this.token = config.token;
        this.name = config.name;
        this.channel = config.channel;
        this.subscriptions = config.subscriptions;

        this.bot = new sb({
            token: this.token,
            name: this.name
        });

        if (config.sendMessageOnInitialization) {
            this.bot.on('start', () => {
                let message = `Clairvoyance SlackBot notifier initialized. Subscriptions: ${JSON.stringify(this.subscriptions)}`;
                log.info(message);
                this.bot.postMessageToChannel(this.channel, message);
            });
        }
    }

    getPluginName():String {
        return SlackBot.pluginName;
    }

    handleSpawn(pokemon:Pokemon, spawnpoint:Spawnpoint):void {
        if (this.subscriptions.includes(pokemon.number)) {
            let gmapsUrl = `http://maps.google.com/maps?z=12&t=m&q=loc:${pokemon.lat}+${pokemon.long}`;
            let timeLeft = pokemon.disappearTimeMs - new Date().getTime();
            let timeLeftStr = `${Math.floor(timeLeft / 60000)} minutes`;
            let disappearMinute = moment(new Date()).startOf('hour').add(spawnpoint.time, 'seconds').get('minute');
            let message = `${pokemon.name} despawns at xx:${disappearMinute} (${timeLeftStr}) - ${gmapsUrl}`;
            this.bot.postMessageToChannel(this.channel, message);
        }
    }

    handleError(error:String):void {
        let message = `ERROR: ${error}`;
        this.bot.postMessageToChannel(this.channel, message);
    }
}

module.exports = SlackBot;