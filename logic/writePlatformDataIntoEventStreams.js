const fs = require("fs");
const {spawn} = require("child_process");
const PLATFORM_DIR = "/data_gatherers";

let platforms = fs.readdirSync(__dirname + PLATFORM_DIR);

module.exports = function writeDataToEventStreams(eventStreams){
    platforms.forEach(platform => {
        let workingDirectory = `${__dirname}/data_gatherers/${platform}/`;
        let startTxtPath =  `${workingDirectory}start.txt`;

        //let sentimentAnalyzer = spawn("python", [`${__dirname}/sentiment/textBlobPy/sentiment_analysis.py`]);
        let sentimentAnalyzer = spawn("node", [`${__dirname}/sentiment/mlSentimentJs/sentiment_analysis.js`]);

        if(fs.existsSync(startTxtPath)){
            let startCommand = fs.readFileSync(startTxtPath, {encoding: "utf8", flag: "r"});

            if(startCommand){
                let parts = startCommand.split(" ").filter(p => p.trim().length > 0);
                let platformLiveData = spawn(parts[0], parts.slice(1), {cwd: workingDirectory});

                platformLiveData.stdout.pipe(sentimentAnalyzer.stdin);
                sentimentAnalyzer.stdout.pipe(eventStreams);

                platformLiveData.stderr.on("data", d => console.error(d.toString()));
                sentimentAnalyzer.stderr.on("data", d => console.error(d.toString()));
            }
        }else{
            console.warn(`starting without ${platform}, since no start.txt is present`);
        }
    });
};