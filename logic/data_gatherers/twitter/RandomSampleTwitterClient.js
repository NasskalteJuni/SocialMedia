const BasicTwitterClient = require("./BasicTwitterClient");

/**
 * @class RandomSampleTwitterClient
 * */
class RandomSampleTwitterClient extends BasicTwitterClient{

    /**
     * create a client that receives random twitter tweets
     * @param {Object} config
     * @param {String} [config.language="en"] which language you are using / which language you expect to receive ("en" for example ignores german tweets). Always a two letter language code
     * @param {RegExp} [config.allowedCharacters=ASCII] which characters should a tweet be allowed to contain (can be used to filter out tweets marked with a given language but containing letters of another alphabet)
     * @param {String} [config.accessToken] the token to access the twitter API, defaults to the one in ./credentials/twitter.json (if the file exists)
     * @param {String} [config.twitterEndpoint="https://api.twitter.com/2/tweets/sample/stream?expansions=author_id&tweet.fields=lang&user.fields=username"] the full twitter URL to retrieve tweets (better keep this default)
     * */
    constructor({language, allowedCharacters, twitterEndpoint = "https://api.twitter.com/2/tweets/sample/stream?expansions=author_id&tweet.fields=lang&user.fields=username", accessToken} = {}) {
        super({language, allowedCharacters, twitterEndpoint, accessToken});
    }

}

module.exports = RandomSampleTwitterClient;