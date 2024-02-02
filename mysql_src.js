const mysql = require('gulp-etl-mysql-adapter')

module.exports = function (RED) {
    function MysqlSrcNode(config) {
        RED.nodes.createNode(this, config);
        this.path = config.path;
        this.config = config.config;
        this.sql = config.sql;

        let node = this;
        // console.log("config", config)

        node.on('input', function (msg, send, done) {
            let configObj;
            try{
                configObj = JSON.parse(this.config);
                if (this.sql) 
                    configObj.sql = this.sql;
            }
            catch(err) {
                done("Unable to parse mysql.config: " + err);
                return;
            }    

            configObj = mysql.extractConfig(configObj, msg?.config);

            // msg = RED.util.cloneMessage(msg);

            /** 
             * plugins will be an array of objects where obj.init is a function that returns a stream. This clones well for
             * when msg is cloned by Node-RED (for passing down multiple wires), unlike arrays of streams or other such options
             */
            msg.plugins = [];

            // set the payload to give info on the gulp stream we're creating
            msg.payload = "mysql.src: " + node.path;
            msg.topic = "gulp-initialize";

            msg.plugins.push({
                name: config.type,
                // init:() => mysql.src(node.path, configObj)
                init: () => {
                    return mysql.src(node.path, configObj)
                        .on("data", () => {
                            this.status({ fill: "green", shape: "dot", text: "active" });
                        })
                        .on("end", () => {
                            this.status({ fill: "green", shape: "ring", text: "ready" });
                        })
                        .on("error", (err) => {
                            console.error(err)
                        })

                }
            })

            send(msg);
        });

    }
    RED.nodes.registerType("mysql.src", MysqlSrcNode);
}