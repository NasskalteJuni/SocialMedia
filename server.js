const express = require("express");
const config = require("./config.js");
const EventStreams = require("./logic/utils/EventStreams.js");
const writePlatformDataIntoEventStreams = require("./logic/writePlatformDataIntoEventStreams.js");
const PORT = process.env.PORT || config["port"] || 80;
const PUBLIC_DIR = config["publicDir"] || "/public";

let app = express();
let eventStreams = new EventStreams();

app.use(express.json());
app.use(express.static(__dirname + PUBLIC_DIR));

writePlatformDataIntoEventStreams(eventStreams);

app.get("/events", (req, res) => {
    eventStreams.addHttpConnection(res);
});

app.listen(PORT, () => console.log("http://127.0.0.1:"+PORT+"/"));