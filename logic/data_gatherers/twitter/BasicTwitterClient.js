const Listenable = require("../../utils/Listenable");
const https = require("https");
const bearer = require("./credentials/twitter.json")?.bearer;

/**
 * @class BasicTwitterClient
 * */
class BasicTwitterClient extends Listenable(){

    /**
     * create a client that receives random twitter tweets
     * @param {Object} config
     * @param {String} [config.language="en"] which language you are using / which language you expect to receive ("en" for example ignores german tweets). Always a two letter language code
     * @param {RegExp} [config.allowedCharacters=ASCII] which characters should a tweet be allowed to contain (can be used to filter out tweets marked with a given language but containing letters of another alphabet)
     * @param {String} [config.accessToken] the token to access the twitter API, defaults to the one in ./credentials/twitter.json (if the file exists)
     * @param {String} [config.twitterEndpoint"] the full twitter URL to retrieve tweets (better keep this default)
     * */
    constructor({twitterEndpoint, language= "en", allowedCharacters= /^[a-zA-Z0-9@!?\.:,;&()=+_$€"'~\-/\s#]+$/g, accessToken = bearer} = {}) {
        super();
        this._twitterEndpoint = twitterEndpoint;
        this._stream = null;
        this._headers = {
            "Authorization": `Bearer ${accessToken}`,
            "User-Agent": "NodeJS",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        };
        this.language = language;
        this.allowedCharacters = allowedCharacters;
        this._state = "initial";
    }

    /**
     * @property {String} state
     * */
    get state(){
        return this._state;
    }

    get isRunning(){
        return !(this._state === "stopped" || this._state === "initial");
    }

    /**
     * stop getting tweets from twitter
     * */
    stop(){
        if(this._state === "stopping" || !this.isRunning) return Promise.resolve();

        return new Promise((resolve) => {
            this.once("stop", resolve);
            this._changeState("stopping");
            this._handleStop({reason: "client shutdown", code: 0})
        });
    }

    /**
     * load tweets of the twitter platform in real time (every tweet triggers the 'tweet' event)
     * */
    start(){
        if(this.isRunning) return;

        this._changeState("starting");
        this.trigger("start");

        let req = https.get(this._twitterEndpoint, {headers: this._headers});
        req.once("response", res => {
            this._stream = res;

            if(res.statusCode === 429){
                this.trigger("error", "rate limit reached: "+res.statusMessage+" (total available: "+res.headers["x-rate-limit-remaining"]+" of "+res.headers["x-rate-limit-limit"]+", resets in "+Math.floor(res.headers["x-rate-limit-reset"]-(Date.now()/1000))+" seconds)");
                return this._handleStop({reason: "rate limit reached", code: 2});
            }


            this.trigger("started");
            this._changeState("started");

            this._stream.on("end", (err,res) => {
                let reason = err?.message || res?.body || "stream ended";
                this._handleStop({reason, code: 1});
            });

            this._stream.on("err", err => this.trigger("error", err));

            this._stream.on("data", received => {
                if(this._state === "started") this._changeState("active");

                let tweet = null;
                try{
                    received = JSON.parse(received);
                }catch(err){
                    received = null;
                }

                if(received && received["connection_issue"]){
                    return this._handleStop({reason: "connection failed", code: 3, received});
                }

                if(received && received["detail"]){
                    return this.trigger("error", new Error("rate limit reached: "+received.detail));
                }

                // only use tweets containing the correct language and only allowed characters (default: standard ASCII)
                if (received && received.data.lang === this.language && this.allowedCharacters.test(received.data.text)) {
                    tweet = {
                        platform: "twitter",
                        timestamp: new Date().toISOString(),
                        id: received.data.id,
                        username: received.includes["users"][0].name,
                        account: received.includes["users"][0].username,
                        text: this._preProcessTweetText(received.data.text),
                        originalText: received.data.text
                    };

                }

                // only use tweets with actual words in them (not only links or retweets)
                if (tweet && tweet.text) {
                    this.trigger("tweet", tweet);
                }

            });
            req.end();
        });

    }

    /**
     * @protected
     * internal method stop getting tweets and triggering the stop event
     * */
    _handleStop(reason = null){
        if(this._stream){
            let waitForClose = false;

            if(!this._stream.readableEnded){
                this._stream.on("close", () => {
                    this._changeState("stopped");
                    this.trigger("stop", reason)
                });
                waitForClose = true;
            }

            this._stream.destroy();
            this._stream = null;

            if(!waitForClose){
                this._changeState("stopped");
                this.trigger("stop", reason);
            }
        }
    }

    /**
     * @private
     * change state
     * */
    _changeState(newState){
        this.trigger("statechange", newState, this._state);
        this._state = newState;
    }

    /**
     * remove everything that is not content text of a tweet (links, usernames, etc.)
     * and clean up text (remove linebreaks and unnecessary whitespace)
     * @private
     * @function
     * @param {String} text the original content of a tweet, containing twitter-controls like @username or embedded media
     * @returns {String} a preprocessed text
     * */
    _preProcessTweetText(text){
        // remove twitter username handles (and Retweet marker)
        text = text.replace(/(RT )?@\w+:? ?/g,"");

        //remove twitter links
        text = text.replace(/https:\/\/t.co\/[a-zA-Z0-9]+/g, "");

        // replace html escapes for "<",">","&" with their original values
        text = text.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");

        // replace line break character with one space
        text = text.replace(/\n/g," ");

        // remove unnecessary whitespace
        text = text.trim();

        return text;
    };
}

module.exports = BasicTwitterClient;