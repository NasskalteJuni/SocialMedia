const Client = require("./Client.js");
const client = new Client();
const filters = [];
const matchesFilter = text => {
    text = text.toLowerCase();
    for(let filter of filters){
        if(text.indexOf(filter.toLowerCase().trim()) >= 0) return true;
    }
    return false;
};

client.start();
client.on("post", post => {
    if(filters.length >= 0 && !matchesFilter(post.originalText)) return;
    process.stdout.write(JSON.stringify(post)+"\n")
});

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

process.on("exit", () => client.stop());
