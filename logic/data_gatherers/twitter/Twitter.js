const RandomSampleTwitterClient = require("./RandomSampleTwitterClient.js");
const FilteredTwitterClient = require("./FilteredTwitterClient.js");
const Listenable = require("../../utils/Listenable.js");

/**
 * @class Twitter
 * */
class Twitter extends Listenable(){

    /**
     * creates a new filtered twitter client
     * @param config
     * @param {String} [config.syncMode = "manual"] how to synchronize the server filters with this client. Allowed: "auto" or "manual", with auto basically asking the server every time something filter related happens (probably more often than necessary)
     * @param {String} [config.language="en"] which language you are using / which language you expect to receive ("en" for example ignores german tweets). Always a two letter language code
     * @param {RegExp} [config.allowedCharacters=ASCII] which characters should a tweet be allowed to contain (can be used to filter out tweets marked with a given language but containing letters of another alphabet)
     * @param {String} [config.accessToken] the token to access the twitter API, defaults to the one in ./credentials/twitter.json (if the file exists)
     * */
    constructor({language, allowedCharacters, accessToken, syncMode} = {}) {
        super();
        this.random = new RandomSampleTwitterClient({language, allowedCharacters, accessToken});
        this.filtered = new FilteredTwitterClient({language, allowedCharacters, accessToken, syncMode});
        this.random.on("tweet", tweet => { if(this.isRunning && this.mode === "random") this.trigger("tweet", tweet)});
        this.random.on("error", err => this.trigger("error", err));
        this.random.on("stop", () => { if(this.isRunning) this.random.start()});
        this.filtered.on("tweet", tweet => {this.trigger("tweet", tweet)});
        this.filtered.on("error", err => this.trigger("error", err));
        this.filtered.on("stop", () => { if(this.isRunning) this.filtered.start()});
        this.mode = "random";
        this.isRunning = false;
    }

    async start(){
        await this.filtered.loadFilters();
        this.filtered.start();
        this.random.start();
        this.isRunning = true;
    }

    async stop(){
        this.isRunning = false;
        return Promise.all([this.random.stop(), this.filtered.stop()]);
    }

    async hasFilter(filter){
        return this.filtered.hasFilter(filter);
    }

    async loadFilters(){
        return this.filtered.loadFilters();
    }

    async addFilter(filter){
        if(!(await this.filtered.hasFilter(filter))){
            this.mode = "filtered";
            return this.filtered.addFilter(filter);
        }
    }

    async removeFilter(filter){
        await this.filtered.removeFilter(filter);
        this.mode = this.filtered.filters.length === 0 ? "random" : "filtered";
    }

    async clearFilters(){
        await this.filtered.clearFilters();
        this.mode = "random";
    }

    async setFilters(filters){
        if(!filters || filters.length === 0) return;
        await this.filtered.setFilters(filters);
        this.mode = "filtered";
    }

}

module.exports = Twitter;