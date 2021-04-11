const Instagram = require('instagram-web-api');
const credentials = require("./credentials/instagram.json");
const englishIndicatorWords = require("./common-english-words.json");
const client = new Instagram(credentials, {language: "en-US"});
const containsCommonEnglishWord = text => {
    for (let word of englishIndicatorWords) if (text.startsWith(word + " ") || text.indexOf(" " + word + " ") >= 0) return true;
};
const preprocessText = text => text.replace(/(\n|#[a-z]+|@[a-zA-Z\-]+|[^a-zA-Z0-9 _\-\.\\\/\(\),:+'"])/g, "");
const getUsernameForShortcode = async (client, shortcode) => (await client.getMediaByShortcode({shortcode})).owner.username;
const isFromLastXMinutes = (timestamp, minutes = 1) => timestamp > Date.now() - (minutes * 60 * 1000);
const filters = [];
let forcedTimeout = null;
let poll = null;

(async () => {

    await client.login();

    poll = setInterval(async () => {
        if (forcedTimeout !== null && Date.now() < forcedTimeout) return;
        else forcedTimeout = null;

        try {
            let media = filters.length === 0 ? await client.getMediaFeedByLocation({locationId: "212988663"}) : await client.getMediaFeedByHashtag({hashtag: filters.join(" ")});

            media = media[filters.length === 0 ? "edge_location_to_media" : "edge_hashtag_to_media"].edges;

            let latest_english_media = media.filter(edge => isFromLastXMinutes(edge.node.taken_at_timestamp * 1000) && edge.node.edge_media_to_caption.edges.length > 0 && containsCommonEnglishWord(edge.node.edge_media_to_caption.edges[0].node.text));

            let posts = await Promise.all(latest_english_media.map(async m => ({ platform: "instagram", id: m.node.id, timestamp: new Date(m.node.taken_at_timestamp * 1000).toISOString(), text: preprocessText(m.node.edge_media_to_caption.edges[0].node.text), originalText: m.node.edge_media_to_caption.edges[0].node.text, user: await getUsernameForShortcode(client, m.node.shortcode)})));

            posts.forEach(post => process.stdout.write(JSON.stringify(post)+"\n"));
        } catch (err) {
            if (err.message.indexOf("wait for a few minutes")) {
                // wait for 10 minutes
                forcedTimeout = Date.now() + 10 * 60 * 1000;
            }
        }
    }, 1000 * 30);
})();


process.stdin.on('data', messages => {
    messages.toString().split("\n").filter(line => line.trim().length > 0).forEach(async message => {
        message = JSON.parse(message);
        switch(message.type){
            case "remove":
                let i = filters.indexOf(message.value);
                if(i >= 0) filters.splice(i, 1);
                break;
            case "add":
                if(filters.indexOf(message.value) === -1) filters.push(message.value);
                break;
            case "clear":
                filters.splice(0, filters.length);
                break;
            case "set":
                filters.splice(0, filters.length);
                filters.concat(messages.values);
                break;
        }
    });
});

// clean up on exit
process.on("exit", () => { if(poll) clearInterval(poll) });
