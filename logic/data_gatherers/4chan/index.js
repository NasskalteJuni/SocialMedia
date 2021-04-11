const https = require("https");
// we are only allowed to make 1 request per second
const requestTimeLimit = 1000;
const boards = require("./boards.json");
const minutesForPostBeingAcceptableAsNew = 1;
const filters = ["vaccines"];

const get = url => {
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            response.body = "";

            response.ok = response.statusCode >= 200 && response.statusCode < 300;

            response.on("data", d => response.body += d);
            response.on("error", reject);
            response.on("end", () => {
                // wait for at least one second to not spam the api
                let minWait = setTimeout(() => {
                    resolve(response);
                    clearTimeout(minWait);
                }, requestTimeLimit);
            });
        });
    });
};

/** take a 4chan timestamp (UNIX-Timestamp in s, not ms like JS Date.now) and check if it is younger than a given time */
const isFresh = timestamp => timestamp * 1000 > Date.now() - 1000 * 60 * minutesForPostBeingAcceptableAsNew;

const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];

const getRandomBoard = () => Promise.resolve(randomItem(boards));

/**
 * get a random threads id that has been edited recently (= less than 1 Minute)
 * @returns {String} a threads id
 * */
const getRandomCurrentlyUpdatedThreadId = async board => {

    let response = await get(`https://a.4cdn.org/${board}/threads.json`, {headers: {"content-type": "application/json"}});

    if (!response.ok) return Promise.reject(response.statusText);

    let threads = JSON.parse(response.body);
    threads = threads
        .map(page => page.threads)
        .reduce((all, current) => all.concat(current), []);

    let latestThread = threads.reduce((latest, thread) => {
        if (latest === null || +thread.last_modified > +latest.last_modified) {
            return thread;
        }

        return latest;
    }, null);


    return isFresh(latestThread.last_modified) ? latestThread.no : null;
};

const matchesFilter = (text="") => {
    if(filters.length){
        return filters.reduce((matches, filter) => text.toLowerCase().indexOf(filter.toLowerCase()) >= 0 || matches, false);
    }

    return true;
};

const getLatestComments = async (board, threadId) => {
    let response = await get(`https://a.4cdn.org/${board}/thread/${threadId}.json`);

    if (!response.ok) return Promise.reject(response.statusText);

    let posts = JSON.parse(response.body).posts;

    return posts.filter(post => isFresh(post.time)).filter(post => matchesFilter(post.com));
};

const processAndFormatPostText = text => {
    if(!text) return text;

    // remove html tags
    text = text.replace(/<\/?[^\/>]+\/?>/g, "");

    // replace html escape values
    text = text.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&#039;/g,"'");

    // replace 4chan links
    text = text.replace(/>>\d+/g,"");

    // no line breaks
    text = text.replace(/\n/g, "");

    return text.trim();
};

const writeLatestCommentsOfBoardToStdout = async () => {
    try {
        const board = await getRandomBoard();

        const threadId = await getRandomCurrentlyUpdatedThreadId(board);
        if (threadId === null) return;

        const updates = await getLatestComments(board, threadId);

        updates.forEach(comment => {
            const output = {
                platform: "4chan",
                id: comment.no,
                timestamp: new Date(comment.time * 1000).toISOString(),
                username: comment.name,
                text: processAndFormatPostText(comment.com),
                originalText: comment.com
            };

            if(output.text){
                process.stdout.write(JSON.stringify(output) + "\n");
            }
        });
    }catch (err) {
        // log and ignore errors, for this app there is no need to retry the request or do similar recovery tactics
        process.stderr.write(err + "\n");
    }
};

// we are doing 2 requests, so we need 2 times the request time limit
let poll = setInterval(writeLatestCommentsOfBoardToStdout, requestTimeLimit * 2);

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
process.on("exit", () => clearInterval(poll));
