const analyzer = require("ml-sentiment")({lang: "en"});
const compromise = require("compromise");

process.stdin.on("data", input => {
    if(!input) return;
    input = input.toString();

    // input can be multiple lines of posts
    let posts = input.split("\n");

    posts.filter(post => post && post.length).forEach(async post => {
        try{
            if(!post) return;
            post = JSON.parse(post);
            let text = post.text;

            let sentiment = analyzer.classify(text);
            post.keywords = compromise(text).topics().json().map(t => t.text).filter(t => t && t.length);
            post.emotion = sentiment === 0 ? 'neutral' : (sentiment > 0 ? 'positive' : 'negative');
            post.score = (1-(1/(Math.abs(sentiment)+1))) * (sentiment < 0 ? -1 : 1);
            process.stdout.write(JSON.stringify(post)+"\n");
        }catch (err) {
            process.stderr.write(err);
        }
    });
});
