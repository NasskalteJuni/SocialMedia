const BasicTwitterClient =  require("./BasicTwitterClient.js");
const request = require("../../utils/request.js");

/**
 * A filtered twitter client is a client which allows to retrieve only tweets matching given 'search values', keywords or hashtags
 * (the twitter client alone only retrieves tweets)
 * */
class FilteredTwitterClient extends BasicTwitterClient {

    /**
     * creates a new filtered twitter client
     * @param config
     * @param {String} [config.syncMode = "manual"] how to synchronize the server filters with this client. Allowed: "auto" or "manual", with auto basically asking the server every time something filter related happens (probably more often than necessary)
     * @param {String} [config.language="en"] which language you are using / which language you expect to receive ("en" for example ignores german tweets). Always a two letter language code
     * @param {RegExp} [config.allowedCharacters=ASCII] which characters should a tweet be allowed to contain (can be used to filter out tweets marked with a given language but containing letters of another alphabet)
     * @param {String} [config.accessToken] the token to access the twitter API, defaults to the one in ./credentials/twitter.json (if the file exists)
     * @param {String} [config.ruleRoute = "https://api.twitter.com/2/tweets/search/stream/rules"] the twitter endpoint to define or delete rules for filtered streams
     * @param {String} [config.twitterEndpoint = "https://api.twitter.com/2/tweets/search/stream?expansions=author_id&tweet.fields=lang&user.fields=username"] the url to get a filtered stream
     * */
    constructor({syncMode = "manual", language, allowedCharacters, accessToken, ruleRoute = "https://api.twitter.com/2/tweets/search/stream/rules", twitterEndpoint = "https://api.twitter.com/2/tweets/search/stream?expansions=author_id&tweet.fields=lang&user.fields=username",} = {}) {
        super({twitterEndpoint, language, allowedCharacters, accessToken});
        this._ruleRoute = ruleRoute;
        this._filters = [];
        this._ruleHeaders = Object.assign({}, this._headers, {"content-type": "application/json"});
        this.syncMode = syncMode;
    }

    /**
     * get all active filters
     * */
    get filters() {
        return this._filters.map(filter => filter.tag);
    }

    /**
     * adds a filter
     * @param {String} keyword a filter to add
     * */
    async addFilter(keyword) {
        if (await this.hasFilter(keyword)) return this.filters;

        let processedKeyword = keyword.replace(/[ @#:-]/g, "").toLowerCase();

        let filter = {
            value: `("${keyword}" OR ${processedKeyword} OR #${processedKeyword}) lang:en -is:retweet -has:media`,
            tag: keyword
        };

        let added = await request(this._ruleRoute, {method: "post", headers: this._ruleHeaders}, {add: [filter]});

        if (added?.data?.length) {
            filter.id = added.data[0].id;
            this._filters.push(filter);
        }

        return this.filters;
    }

    /** removes a given filter
     * @param {String} keyword the filter value to remove
     * @returns {Array<String>} the filters after the remove operation
     * */
    async removeFilter(keyword) {
        let filter = await this._getFilter(keyword);
        if (filter) {
            await request(this._ruleRoute, {method: "post", headers: this._ruleHeaders}, {delete: {ids: [filter.id]}});

            this._filters = this._filters.filter(filter => filter.tag !== keyword);
        }
        return this.filters;
    }

    /**
     * @private
     * returns the filter for the given value or null (if none exists)
     * */
    async _getFilter(value) {
        if (this.syncMode === "auto") await this.loadFilters();
        let index = this._filters.findIndex(filter => filter.tag === value);
        return index >= 0 ? this._filters[index] : null;
    }

    /**
     * checks if the client has the given filter
     * @param {String} keyword the filter value
     * @returns {Boolean}
     * */
    async hasFilter(keyword) {
        let filter = await this._getFilter(keyword);
        return Boolean(filter);
    }

    /**
     * removes all filters
     * */
    async clearFilters() {
        if (this.syncMode === "auto") await this.loadFilters();

        if (this._filters.length) {
            let ids = this._filters.map(filter => filter.id);

            await request(this._ruleRoute, {method: "post", headers: this._ruleHeaders}, {delete: {ids}});

            this._filters = [];
        }
    }

    async setFilters(keywords) {
        keywords = await Promise.all(keywords.filter(async keyword => !(await this.hasFilter(keyword))));

        let filters = keywords.map(keyword => {
            let processedKeyword = keyword.replace(/[ @#:-]/g, "").toLowerCase();

            return {
                value: `("${keyword}" OR ${processedKeyword} OR #${processedKeyword}) lang:en -is:retweet -has:media`,
                tag: keyword
            };
        });

        if(filters.length === 0) return this.filters;

        let added = await request(this._ruleRoute, {method: "post", headers: this._ruleHeaders}, {add: filters, delete: {ids: this._filters.map(f => f.id)}});

        if (added?.data?.length) {
            filters.forEach(filter => {
                let match = added.findIndex(a => a.tag === filter.tag);
                filter.id = match.data[0].id;
            });
            this._filters.concat(filters);
        }

        return this.filters;
    }

    /**
     * get the filters on the server and set them on the client
     * @returns {Array<String>}
     * */
    async loadFilters() {
        let filters = await request(this._ruleRoute, {method: "get", headers: this._ruleHeaders});

        this._filters = filters.data || [];

        return this.filters;
    }

}



module.exports = FilteredTwitterClient;