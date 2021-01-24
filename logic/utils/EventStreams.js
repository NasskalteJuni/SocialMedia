const stream = require("stream");
const uuid = () => Date.now().toString(32) + Math.random().toString(32).substring(2);

/**
 * writes stream data via http event streams to clients
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events}
 * */
class EventStreams extends stream.Writable{

    /**
     * create a collection of online-streams to client over http
     * */
    constructor(...args) {
        super(...args);
        this.httpConnections = [];
        this.keepAlives = setInterval(() => this.broadcast({type: "keep-alive", message: ""}), 15000);
    }

    /**
     * add a http response which forwards everything piped into this object,
     * handling the format of server sent event streams
     * @params {HttpResponse} response
     * */
    addHttpConnection(response){
        this.httpConnections.push(response);
        response.on("end", () => this.httpConnections = this.httpConnections.filter(c => c !== response));
        response.on("error", () => this.httpConnections = this.httpConnections.filter(c => c !== response));
        response.writeHead(200, "ok", {
            "Content-type": "text/event-stream",    // (SSE mime type)
            "Connection": "keep-alive",             // do not close the connection on inactivity, try to keep it open
            "Cache-Control":"no-cache",             // obviously, do not try to cache this, we want a live version
            "X-Accel-Buffering": "no"               // this one is for reverse proxies to disallow buffering until the response is complete
        });
    }

    /**
     * write event messages to all registered http connections
     * @param event
     * @param {String} [event.type="message"] what type of event is being sent, defaults to standard "message"-type
     * @param {String}
     * */
    broadcast({type = "message", message}){
        if(typeof message !== "string"){
            message = JSON.stringify(message);
        }

        this.httpConnections.forEach(connection => {
            try{
                connection.write(`id: ${uuid()}\nevent: ${type}\ndata: ${message}\n\n`);
            }catch(err){
                console.error(err);
                this.httpConnections = this.httpConnections.filter(c => c !== connection);
            }
        });
    }


    /**
     * @override
     * write a message to the clients
     * @param {String} chunk a chunk of data to send as separate message
     * @param {String} [type="message"] what type of event is being sent
     * @param {Function} [callback] a callback function called after the data has been sent
     * */
    write(chunk, type="message", callback){
        this.broadcast({type, message: chunk.toString()});
        if(callback && typeof callback === "function") callback();
    }

    /**
     * close and clear all existing http connections
     * */
    close(){
        clearInterval(this.keepAlives);
        this.httpConnections.forEach(response => response.end());
    }

}

module.exports = EventStreams;