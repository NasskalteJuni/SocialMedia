const Twitter = require("./Twitter.js");
const client = new Twitter();

client.on("tweet", tweet => process.stdout.write(JSON.stringify(tweet)+"\n"));

client.on("error", error => process.stderr.write(JSON.stringify(error)+"\n"));

process.on('beforeExit', () => client.stop());

process.stdin.on('data', messages => {
    messages.toString().split("\n").filter(line => line.trim().length > 0).forEach(async message => {
        message = JSON.parse(message);
        switch(message.type){
            case "remove":
                await client.removeFilter(message.value);
                break;
            case "add":
                await client.addFilter(message.value);
                break;
            case "clear":
                await client.clearFilters(message.value);
                break;
            case "set":
                await client.setFilters(message.value);
                break;
        }
    });
});

(async () => {
    await client.loadFilters();
    await client.clearFilters();
    await client.start();
})();