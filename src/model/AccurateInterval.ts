let moment = require('moment');
import Utils from '../Utils';

const log:any = Utils.getLogger('AccurateInterval');

export default class AccurateInterval {

    _handler:Function;
    _interval:Number;
    _timeout:Number;
    _startTime:any;
    _nextExecutionTime:any;

    constructor(handler:Function, interval:Number, fireFirstExecutionImmediately?:Boolean) {
        this._handler = handler;
        this._interval = interval;
        this.start(fireFirstExecutionImmediately);
    }

    clear() {
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
            this._startTime = null;
            this._nextExecutionTime = null;
        }
    }

    start(fireFirstExecutionImmediately:Boolean):void {
        this.clear();
        this._startTime = moment(new Date());
        this._nextExecutionTime = this._startTime.clone();

        let startDelay;
        if (true === fireFirstExecutionImmediately) {

            startDelay = 0;
        }
        else {
            startDelay = this.calculateNextStartDelay(this._nextExecutionTime, this._interval);
            this._nextExecutionTime.add(this._interval, 'milliseconds');
        }

        setTimeout(() => {
            this.process();
        }, startDelay);
    }

    process():void {

        //fire handler
        try {
            this._handler();
        }
        catch (e) {
            log.warn(`timer handler threw: ${e}`);
        }

        //calculate next start delay, accounting for timer drift
        let nextStartDelay = this.calculateNextStartDelay(this._nextExecutionTime, this._interval);
        this._nextExecutionTime.add(this._interval, 'milliseconds');
        if (nextStartDelay < 0) {
            //bollocks, we're late and will have to skip the next execution
            let timeLate = Math.abs(nextStartDelay);
            let iterationsToSkip = Math.ceil(timeLate / this._interval);
            this._nextExecutionTime.add(this._interval * iterationsToSkip, 'milliseconds');
            log.warn(`timer overrun, skipping next ${iterationsToSkip} iterations`);
        }

        //set timeout to process next interval
        setTimeout(() => {
            this.process();
        }, nextStartDelay);
    }

    calculateNextStartDelay(expectedExecutionTime:any, interval:Number):Number {
        let currentTime = moment(new Date());
        let expectedExecutionMoment = moment(expectedExecutionTime);
        expectedExecutionMoment.add(interval, 'milliseconds');
        let nextStartDelay = expectedExecutionMoment.diff(currentTime);
        return nextStartDelay;
    }
}