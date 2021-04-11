const https = require("https");

/**
 * @function request
 * @param {String} url the url to request
 * @param {Object} config a few configurations for the request
 * @param {Object} [headers] the request headers
 * @param {String} [method="get"] the request method
 * @param {Boolean} [receiveJson=true] if the response is json and should be parsed automatically (failure of parsing will return the raw data)
 * @param {Boolean} [sendJson=true] if the request data is json and should be parsed automatically (if no data is given, nothing will be prepared)
 * @param {*} [data] http request body content to be sent
 * @returns {Promise} will yield the received data or rejects with an error
 * */
module.exports = async function request(url, {headers = {}, method="get", receiveJson=true, sendJson=true}={}, data){
    return new Promise((resolve, reject) => {
        let req = https.request(url, {method, headers});
        req.once("response", response => {
            if (response.statusCode >= 300 || response.statusCode < 200) reject("request [POST] "+url+" (headers "+JSON.stringify(headers)+", data "+JSON.stringify(data)+") failed with status "+response.statusCode+" "+response.statusMessage+"");
            let chunks = "";
            response.on("data", data => chunks+=data.toString());
            response.on("end", () => {
                try {
                    if(receiveJson) chunks = JSON.parse(chunks);
                } catch (err) { }
                resolve(chunks);
            })
        });
        if(data) req.write(sendJson ? JSON.stringify(data) : data.toString());
        req.end();
        req.on("error", err => reject(err));
        req.on("timeout", () => reject("request timeout"));
    });
};