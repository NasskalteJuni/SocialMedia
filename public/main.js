let canvas = document.getElementById("canvas");
let muteButton = document.getElementById("muteButton");
let history = document.getElementById("post-list");
let synth = new Tone.PolySynth(Tone.Synth);
let filter = new Tone.AutoFilter(4).start();
let reverb = new Tone.Reverb(1);
let chorus = new Tone.Chorus(4, 2.5, 0.5);
let es = new EventSource("/events");
let muted = true;
let stats = {positive: 0, negative: 0, neutral: 0, keywords: {}};
synth.chain(filter.chain(reverb.chain(chorus.toDestination())));


es.addEventListener("message", e => {
    let post = JSON.parse(e.data);

    post.emotion = standardizeEmotionValue(post.emotion);
    post.text = post.text.replace(/</g,"&lt;").replace(/>/g,"&gt;");
    createPost(post, 5);
    addToHistory(post);
    addToStats(post);
    playNote(post.emotion);
});

muteButton.addEventListener("click", () => {
    muted = !muted;
    muteButton.dataset.muted = muted;
    muteButton.setAttribute("aria-label",muted ? "currently muted, click to unmute" : "currently playing sounds, click to mute");
    muteButton.children[0].classList.remove("fa-volume-off");
    muteButton.children[0].classList.remove("fa-volume-up");
    muteButton.children[0].classList.add(muted ? "fa-volume-off" : "fa-volume-up");
});

function playNote(emotion){
    if(muted) return;

    let emotionsToTones = {
        "positive": ["C5","E5","G5"],
        "negative": ["D3","F3","A3"],
        "neutral": ["Bb3","E4","C4"]
    };
    const pickRandom = arr => arr[Math.floor(arr.length * Math.random())];

    synth.triggerAttackRelease(pickRandom(emotionsToTones[emotion]), "8n");
    synth.triggerAttackRelease(pickRandom(emotionsToTones[emotion]), "8n");

}

function createPost(data, showForSeconds=5){
    let postElement = document.createElement("article");
    postElement.classList.add("post");
    postElement.classList.add(data.emotion);
    postElement.style.left = (window.innerWidth-80) * Math.random() + "px";
    postElement.style.top = (window.innerHeight-20) * Math.random() + "px";
    postElement.innerHTML = `
    <div class="background wrapper">
        <span class="ripple"></span>
        <span class="point"></span>
    </div>
    <div class="content wrapper">
        <header>
            <div class="platform">${data.platform}</div>
            <div class="username">${data.username.replace(/[^a-zA-Z0-9_ -]/g,"")}</div>
        </header>
        <main>
            <p>${data.text}</p>
        </main>
        <footer>
            <ul class="keywords">${data.keywords.map(k => '<li class="tag">'+k+'</li>')}</ul>
            <div class="emotion">${data.emotion}</div>
            <time class="time">${new Date(data.timestamp).toLocaleTimeString()}</time>
        </footer>
    </div>`;
    postElement.seconds = 0;
    postElement.active = false;
    postElement.addEventListener("mouseleave", () => postElement.active = false);
    postElement.addEventListener("mouseenter", () => {
        postElement.active = true;
        postElement.seconds = 0;
    });
    postElement.timer = setInterval(() => {
        if(postElement.seconds === 0){
            postElement.classList.add("fresh");
        }

        if(postElement.seconds > (showForSeconds * (1/5))){
            postElement.classList.remove("fresh");
            postElement.classList.add("mature");
        }

        if(postElement.seconds >= (showForSeconds * (4/5))){
            postElement.classList.remove("mature");
            postElement.classList.add("dying");
        }

        if(postElement.seconds >= showForSeconds){
            clearInterval(postElement.timer);
            postElement.parentNode.removeChild(postElement);
        }

        if(!postElement.active){
            postElement.seconds+=1;
        }
    }, 1000);
    canvas.appendChild(postElement);
}

function standardizeEmotionValue(emotion){
    emotion = emotion.toLowerCase();
    switch (emotion) {
        case "pos":
        case "positive":
            return "positive";
        case "neg":
        case "negative":
            return "negative";
        case "neu":
        case "neutral":
            return "neutral"
    }
}

function addToHistory(post){
    let li = document.createElement("li");
    li.innerHTML = `
        <div class="history-entry">
            <div class="content">
                ${post.text}
            </div>
            <div class="meta">
                ${post.username} on ${post.platform} at ${new Date(post.timestamp).toLocaleString()}
            </div>
        </div>
    `;
    history.appendChild(li);
}

function addToStats(post){
    stats[post.emotion]+=1;
    post.keywords.forEach(k => {
        if(!stats.keywords[k]) stats.keywords[k] = {count: 0, score: 0};
        stats.keywords[k].count+=1;
        stats.keywords[k].score+=post.score;
    });
    stats.trending = Object.keys(stats.keywords).reduce((most, k) => {
        if(most.count < stats.keywords[k].count){
            most.value = k; most.count = stats.keywords[k].count; most.score = stats.keywords[k].score;
        }
        return most;
    }, {value: "", count: 0, score: 0});
    if(stats.negative > stats.positive && stats.negative > stats.neutral) stats.emotion = "negative";
    else if(stats.positive > stats.negative && stats.positive > stats.neutral) stats.emotion = "positive";
    else stats.emotion = "neutral";
    updateStats();
}

function updateStats(){
    if(stats.trending.count >= 3) document.getElementById("keyword").innerText = stats.trending.value + " (" + stats.trending.count + " times with an average score of " + (stats.trending.score / stats.trending.count).toFixed(2) + ")";
    document.getElementById("emotion").innerText = stats.emotion;
}