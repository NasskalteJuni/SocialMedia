const express = require("express");
const config = require("./config.js");
const EventStreams = require("./logic/utils/EventStreams.js");
const PORT = process.env.PORT || config["port"] || 80;
const PUBLIC_DIR = config["publicDir"] || "/public";
const fs = require("fs");
const {spawn} = require("child_process");
const PLATFORM_DIR = "/logic/data_gatherers";

let app = express();
let eventStreams = new EventStreams();
let filters = [];
let gatherers = [];

app.use(express.json());
app.use(express.static(__dirname + PUBLIC_DIR));

let platforms = fs.readdirSync(__dirname + PLATFORM_DIR);
platforms.forEach(platform => {
    let workingDirectory = `${__dirname}${PLATFORM_DIR}/${platform}/`;
    let startTxtPath =  `${workingDirectory}start.txt`;

    //let sentimentAnalyzer = spawn("python", [`${__dirname}/sentiment/textBlobPy/sentiment_analysis.py`]);
    let sentimentAnalyzer = spawn("node", [`${__dirname}/logic/sentiment/mlSentimentJs/sentiment_analysis.js`]);

    if(fs.existsSync(startTxtPath)){
        let startCommand = fs.readFileSync(startTxtPath, {encoding: "utf8", flag: "r"});

        if(startCommand){
            let parts = startCommand.split(" ").filter(p => p.trim().length > 0);
            let platformLiveData = spawn(parts[0], parts.slice(1), {cwd: workingDirectory});

            gatherers.push(platformLiveData);

            platformLiveData.on('close', code => {
                if(code !== 0) console.log(`${platform} exiting with non-zero code ${platform}`);
                gatherers = gatherers.filter(gatherer => gatherer.pid !== platformLiveData.pid);
                console.log("only "+gatherers.length+" remain after "+platform+" shut down.");
            });

            platformLiveData.stdin.write(JSON.stringify({type: "clear"})+"\n");
            platformLiveData.stdin.write(JSON.stringify({type: "set", value: filters})+"\n");
            platformLiveData.stdout.pipe(sentimentAnalyzer.stdin);
            sentimentAnalyzer.stdout.pipe(eventStreams);

            platformLiveData.stderr.on("data", d => console.error(d.toString()));
            sentimentAnalyzer.stderr.on("data", d => console.error(d.toString()));

        }
    }else{
        console.warn(`starting without ${platform}, since no start.txt is present`);
    }
});


app.get("/events", (req, res) => {
    eventStreams.addHttpConnection(res);
});

app.get("/filters", (req, res) => {
    res.json(filters);
});

app.post("/filters", (req, res) => {
    let filter = req.body?.value || req.query.value;
    if(!filter) return res.status(400).json({error:"no-filter", message:"missing filter in request"});
    if(filters.indexOf(filter) >= 0) return res.status(409).json({error:"duplicate", message:"filter already exists"});
    filters.push(filter);
    gatherers.forEach(gatherer => gatherer.stdin.write(JSON.stringify({type:"add",value: filter})+"\n"));
    res.status(201).header("Created",filter.replace(/[^a-zA-Z0-9]/g,"")).json({success: true, message:"created filter "+filter});
});

app.post("/filters/all", (req, res) => {
    let newFilters = req.body;
    if(!newFilters || !(newFilters instanceof Array)) return res.status(400).json({error:"no-filter", message:"missing filter in request"});
    filters = newFilters;
    gatherers.forEach(gatherer => {
        gatherer.stdin.write(JSON.stringify({type:"clear"})+"\n");
        filters.forEach(filter => gatherer.stdin.write(JSON.stringify({type:"add", value: filter})+"\n"));
    })
});

app.delete("/filters", (req, res) => {
    let filter = req.body?.value || req.query.value;
    if(!filter) return res.status(400).json({error:"no-filter", message:"missing filter in request"});
    if(filters.indexOf(filter) < 0) return res.status(404).json({error:"not-found", message:"there is no such filter "+filter});
    filters = filters.filter(f => f !== filter);
    gatherers.forEach(gatherer => gatherer.stdin.write(JSON.stringify({type:"remove",value: filter})+"\n"));
    res.status(200).json({success: true, message: "deleted filter "+filter});
});

app.delete("/filters/all", (req, res) => {
    gatherers.forEach(gatherer => gatherer.stdin.write(JSON.stringify({type:"clear"})+"\n"));
    res.status(200).json({success: true, message: "cleared all filters"});
});

app.listen(PORT, () => console.log("http://127.0.0.1:"+PORT+"/"));