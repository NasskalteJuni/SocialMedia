const Listenable = require("../../utils/Listenable.js");
const credentials = require("./credentials/gab.json");
const puppeteer = require("puppeteer");

class Client extends Listenable(){

    constructor({username=credentials.username, password=credentials.password} = {}) {
        super();
        this.username = username;
        this.password = password;
        this.debug = false;
        this._poll = null;
        this._browser = null;
        this.checkInterval = 10;
        this._lastPosts = [];

    }

    async start(){
        this._browser = await puppeteer.launch({headless: !this.debug});
        let page = await this._browser.newPage();
        await page.goto("https://gab.com/auth/sign_in");

        await page.type("#user_email", this.username);
        await page.type("#user_password", this.password);
        await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')]);

        await this._navigateToFeed(page);
        await this._loadEntries(page);

        this._poll = setInterval(async () => {
            await this._navigateToFeed(page);
            await this._loadEntries(page);
        }, this.checkInterval * 1000);
    }

    async stop(){
        if(this._browser) this._browser.close();
        if(this._poll) clearInterval(this._poll);
        this._browser = null;
        this._poll = null;
    }

    async _navigateToFeed(page){
        await Promise.all([page.waitForSelector('main[role="main"] div[role="feed"]>article'), page.goto("https://gab.com/timeline/pro")]);
    }

    async _loadEntries(page){
        let posts = await page.evaluate(() => {
            let entries = Array.from(document.querySelectorAll('main[role="main"] div[role="feed"]>article'));
            return entries.map(entry => {
                let id = entry.getAttribute("data-id").split("-")[0];
                let username = entry.querySelector("div>div>div>div>div>div>div>div span bdi>strong")?.innerText;
                let timestamp = entry.querySelector("div>div>div>div>div>div>div>div a span>time")?.getAttribute("datetime");
                let originalText = entry.querySelector('div>div>div>div>div>div>div>div div[tabindex="0"]')?.innerHTML;
                return {id, username, timestamp, originalText, platform: "gab"}
            });
        });
        posts.forEach(post => {
            if(this._lastPosts.indexOf(post.id) >= 0) return;

            if(new Date(post.timestamp).getTime() < Date.now()-60*1000*1000) return;

            if(!post.originalText) return;

            post.text = post.originalText.replace(/<.*>/g,"").trim();

            if(post.text) this.trigger("post", post);
        });
        this._lastPosts = posts.map(p=>p.id);
    }
}

module.exports = Client;