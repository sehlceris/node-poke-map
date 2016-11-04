let moment = require('moment');
import Utils from '../Utils';

const log:any = Utils.getLogger('AccurateInterval');

/**
 * An interval that compensates for drift (standard setInterval is vulnerable to drifting over time)
 */
export default class AccurateInterval {

    _handler:Function; //callback to execute on each interval
    _interval:Number; //ms; interval
    _timeout:Number; //internal timeout (setTimeout), used to facilitate each interval
    _startTime:any; //time that this AccurateInterval first started, used to compensate for drift
    _nextExecutionTime:any; //next time that this interval should fire its callback

    /**
     * Create the interval
     * @param {Function} handler callback to execute
     * @param {Number} interval interval to execute the callback
     * @param {Boolean} [fireFirstExecutionImmediately] if true, fires the callback immediately on creation
     */
    constructor(handler:Function, interval:Number, fireFirstExecutionImmediately?:Boolean) {
        this._handler = handler;
        this._interval = interval;
        this.start(fireFirstExecutionImmediately);
    }

    /**
     * Stops the interval
     */
    clear() {
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
            this._startTime = null;
            this._nextExecutionTime = null;
        }
    }

    /**
     * Starts the interval (called by the constructor)
     * @param {Boolean} [fireFirstExecutionImmediately] if true, fires the callback immediately on creation
     */
    start(fireFirstExecutionImmediately?:Boolean):void {
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

    /**
     * Fires the handler, and then sets a timeout for the next execution of the interval
     */
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

    /**
     * Calculates the delay until the next execution time of this interval
     * @param {Date|Number} expectedExecutionTime The time that this interval was last expected to execute
     * @param {Number} interval Interval at which this timer is expected to fire
     * @returns {Number} Appropriate delay to wait until next execution
     */
    calculateNextStartDelay(expectedExecutionTime:any, interval:Number):Number {
        let currentTime = moment(new Date());
        let expectedExecutionMoment = moment(expectedExecutionTime);
        expectedExecutionMoment.add(interval, 'milliseconds');
        let nextStartDelay = expectedExecutionMoment.diff(currentTime);
        return nextStartDelay;
    }
}