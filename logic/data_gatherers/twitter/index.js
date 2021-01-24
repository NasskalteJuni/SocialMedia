const https = require("https");
const host = "api.twitter.com";
const endpoint = "/2/tweets/sample/stream?expansions=author_id&tweet.fields=lang&user.fields=username";
const bearer = require("./credentials/twitter.json").bearer;
const headers = {
    "content-type": "application/json",
    "authorization": `Bearer ${bearer}`
};
const allowedCharacters = /^[a-zA-Z0-9@!?.:,;&()=+_$€"'~\-/\s]+$/g;

https.get("https://" + host + endpoint, {headers}, res => {
    res.on("end", () => process.exit());

    res.on("error", err => {
        process.stderr.write(err);
        process.stderr.write("\n");
    });

    res.on("data", received => {
        try{
            received = JSON.parse(received.toString());
        }catch(err){
            // silently ignore parsing errors - they are most likely just keep-alive messages sent by twitter
            // and we can skip these messages
            return;
        }

        // only use english tweets containing standard ASCII, ignore (for example) chinese letters or special unicode in tweets
        if (received.data.lang === "en" && allowedCharacters.test(received.data.text)){
            let tweet = {
                platform: "twitter",
                timestamp: new Date().toISOString(),
                id: received.data.id,
                username: received.includes.users[0].name,
                account: received.includes.users[0].username,
                text: preProcessTweetText(received.data.text),
                originalText: received.data.text
            };

            // only use tweets with actual words in them (not only links or retweets)
            if(tweet.text){
                process.stdout.write(JSON.stringify(tweet));
                process.stdout.write("\n");
            }
        }

    });
});

/**
 * remove everything that is not content text of a tweet (links, usernames, etc.)
 * and clean up text (remove linebreaks and unnecessary whitespace)
 * @function
 * @param {String} text the original content of a tweet, containing twitter-controls like @username or embedded media
 * @returns {String} a preprocessed text
 * */
const preProcessTweetText = text => {
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