const Listenable = require("./utils/Listenable");
const fs = require("fs");
const path = require("path");
const {spawn} = require("child_process");
const PLATFORM_DIR = path.join(__dirname,"data_gatherers");
const GUESS_DEFAULT_PLATFORMS = () => fs.readdirSync(PLATFORM_DIR)
    .filter(entry => entry !== "." && entry !== "..")
    .map(platform => ({startCommand: fs.existsSync(path.join(PLATFORM_DIR, platform, "start.txt")) ? fs.readFileSync(path.join(PLATFORM_DIR, platform, "start.txt"), {encoding: "utf8", flag: "r"}) : "node "+path.join(PLATFORM_DIR,platform,"index.js"), workingDirectory: path.join(PLATFORM_DIR, platform)}));
const splitStartCommandtoApplicationAndRest = cmd => {
    let parts = cmd.split(" ").filter(part => part.trim().length > 0);
    return [parts[0], parts.slice(1, parts.length)];
};

/**
 * allows you to retrieve posts from the configured social media platforms
 * and set filters for given posts.
 * Adds a sentiment field to the retrieved posts.
 * */
class Platforms extends Listenable(){

    constructor({platforms = GUESS_DEFAULT_PLATFORMS()} = {}){
        super();
        this._filters = [];
        this._postGatherers = platforms.map(platform => spawn(splitStartCommandtoApplicationAndRest(platform.startCommand)[0], splitStartCommandtoApplicationAndRest(platform.startCommand)[1], {cwd: platform.workingDirectory}));
        this._sentimentAnalyzer = spawn("node", [`${__dirname}/sentiment/mlSentimentJs/sentiment_analysis.js`]);
        this._postGatherers.forEach(gatherer => {
            gatherer.on("close", code => {
                if (code !== 0){
                    this.trigger("crash",`${gatherer.spawnargs.join(" ")} exiting with non-zero code ${code}`, code, gatherer)
                }else{
                    this.trigger("stop", `${gatherer.spawnargs.join(" ")} stopped`, gatherer);
                }
                this._postGatherers = this._postGatherers.filter(g => g.pid !== gatherer.pid);
            });

            gatherer.stdout.pipe(this._sentimentAnalyzer.stdin);
            gatherer.stderr.on("data", data => this._processGathererMessage(data).forEach(error => this.trigger("error", JSON.stringify(error), "gatherer", JSON.stringify(gatherer.spawnargs))));
            this._sentimentAnalyzer.stdout.on("data", data => this._processGathererMessage(data).forEach(post => this.trigger("post", post)));
            this._sentimentAnalyzer.stderr.on("data", data => this._processGathererMessage(data).forEach(error => this.trigger("error", JSON.stringify(error), "sentiment")));
        });
    }

    /**
     * @readonly
     * @property {Stream} out
     * a text stream of line separated json posts from all platforms (with sentiment)
     * */
    get out(){
        return this._sentimentAnalyzer.stdout;
    }

    addFilter(value){
        if(value !== undefined && this._filters.indexOf(value) === -1){
            this._filters.push(value);
            this._sendMessageToPostGatherers({type: "add", value});
            return true;
        }
        return false;
    }

    removeFilter(value){
        let i = this._filters.indexOf(value);
        if(i >= 0){
            this.filters.splice(i,1);
            return true;
        }
        return false;
    }

    clearFilters(){
        this._filters = [];
        this._sendMessageToPostGatherers({type: 'clear'})
    }

    setFilters(values){
        this._sendMessageToPostGatherers({type: 'set', value: values});
    }

    /**
     * @private
     * @param {Object} message a serializable message object, telling the gatherers to change something
     * */
    _sendMessageToPostGatherers(message){
        this._postGatherers.forEach(gatherer => gatherer.stdin.write(JSON.stringify(message)));
    }

    /**
     * @private
     * @param {String|Buffer} receivedMessageText
     * @returns {Array} received messages
     * */
    _processGathererMessage(receivedMessageText){
        receivedMessageText = receivedMessageText.toString();
        if(receivedMessageText){
            return receivedMessageText.split("\n").filter(line => line.trim()).map(json => {
                let msg;
                try{
                    msg = JSON.parse(json);
                }catch (e) {
                    msg = json;
                }
                return msg;
            });
        }

        return []
    }
}

module.exports = Platforms;

const p = new Platforms();
p.on("error", console.error);
p.on("post", console.log);
p.on("crash", console.error);
p.on("end", console.warn);
p.addFilter("corona");