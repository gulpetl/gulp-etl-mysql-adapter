"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tapMysql = exports.src = void 0;
const through2 = require('through2');
const Vinyl = require("vinyl");
const PluginError = require("plugin-error");
const pkginfo = require('pkginfo')(module); // project package.json info into module.exports
const PLUGIN_NAME = module.exports.name;
const loglevel = require("loglevel");
const log = loglevel.getLogger(PLUGIN_NAME); // get a logger instance based on the project name
log.setLevel((process.env.DEBUG_LEVEL || 'warn'));
const mysql = require("mysql2");
const from2 = require('from2');
const path = require("path");
// import * as gulpBuffer from 'gulp-buffer'
const gulpBuffer = require('gulp-buffer');
// const 
/** wrap incoming recordObject in a Singer RECORD Message object*/
function createRecord(recordObject, streamName) {
    return { type: "RECORD", stream: streamName, record: recordObject };
}
// gulp vinyl adapter for mysql: loads results of mysql call and wraps it in a vinyl file, then returns vinyl file in a readable stream
function src(pretendFilePath, options) {
    let result;
    try {
        let conn = mysql.createConnection(options.connection);
        let vinylFile;
        // create a file wrapper that will pretend to gulp that it came from the path represented by pretendFilePath
        vinylFile = new Vinyl({
            base: path.dirname(pretendFilePath),
            path: pretendFilePath,
        });
        result = from2.obj([vinylFile]);
        let fileStream = conn.query(options.sql)
            .on('end', function () {
            log.debug('all rows have been received');
        })
            .stream({});
        vinylFile.contents = fileStream;
        log.debug('closing connection when all rows are received');
        conn.end();
        // TODO: Figure out how to deal with errors here
        // this does not trigger parent stream's error handling
        // result.emit(new PluginError(PLUGIN_NAME, 'No problem'))
        // this creates an error that can be caught if the parent stream is wrapped in a try/catch
        // throw new PluginError(PLUGIN_NAME, 'No problem')
        result = result.pipe(tapMysql({}));
        // buffer mode: stream through gulpBuffer to convert vinylFile to isBuffer(true)
        if (options.buffer !== false) {
            result = result.pipe(gulpBuffer());
            // gulp-buffer issues:
            // - requires data to be buffers (gulp-etl uses strings and objects)
            // - files silently upon error (such as passing strings instead of buffers)
        }
    }
    catch (err) {
        // emitting here causes some other error: TypeError: Cannot read property 'pipe' of undefined
        // result.emit(new PluginError(PLUGIN_NAME, err))
        // For now, bubble error up to calling function
        throw new PluginError(PLUGIN_NAME, err);
    }
    return result;
}
exports.src = src;
/* This is a gulp-etl plugin. It is compliant with best practices for Gulp plugins (see
https://github.com/gulpjs/gulp/blob/master/docs/writing-a-plugin/guidelines.md#what-does-a-good-plugin-look-like ),
and like all gulp-etl plugins it accepts a configObj as its first parameter */
function tapMysql(configObj) {
    if (!configObj)
        configObj = {};
    // creating a stream through which each file will pass - a new instance will be created and invoked for each file 
    // see https://stackoverflow.com/a/52432089/5578474 for a note on the "this" param
    const strm = through2.obj(function (file, encoding, cb) {
        const self = this;
        let returnErr = null;
        // post-process line object
        const handleLine = (lineObj, _streamName) => {
            lineObj = createRecord(lineObj, _streamName);
            return lineObj;
        };
        function newTransformer(streamName) {
            let transformer = through2.obj(); // new transform stream, in object mode
            // transformer is designed to follow mysql, which emits objects, so dataObj is an Object. We will finish by converting dataObj to a text line
            transformer._transform = function (dataObj, encoding, callback) {
                let returnErr = null;
                try {
                    let handledObj = handleLine(dataObj, streamName);
                    if (handledObj) {
                        let handledLine = JSON.stringify(handledObj);
                        log.debug(handledLine);
                        // has to be buffer, for now, because we're using gulp-buffer
                        this.push(Buffer.from(handledLine + '\n'));
                    }
                }
                catch (err) {
                    returnErr = new PluginError(PLUGIN_NAME, err);
                }
                callback(returnErr);
            };
            return transformer;
        }
        // set the stream name to the file name (without extension)
        let streamName = file.stem;
        if (file.isNull()) {
            // return empty file
            return cb(returnErr, file);
        }
        else if (file.isBuffer()) {
            let linesArray = file.contents; //.toArray()
            let tempLine;
            let resultArray = [];
            // we'll call handleLine on each line
            for (let dataIdx in linesArray) {
                try {
                    let lineObj = linesArray[dataIdx];
                    tempLine = handleLine(lineObj, streamName);
                    if (tempLine) {
                        let tempStr = JSON.stringify(tempLine);
                        log.debug(tempStr);
                        resultArray.push(tempStr);
                    }
                }
                catch (err) {
                    returnErr = new PluginError(PLUGIN_NAME, err);
                }
            }
            let data = resultArray.join('\n');
            file.contents = Buffer.from(data);
            // we are done with file processing. Pass the processed file along
            log.debug('calling callback');
            cb(returnErr, file);
        }
        else if (file.isStream()) {
            file.contents = file.contents
                // .on('data', function (data:any, err: any) {
                //   log.debug(data)
                // })
                .on('error', function (err) {
                log.error(err);
                self.emit('error', new PluginError(PLUGIN_NAME, err));
            })
                .pipe(newTransformer(streamName));
            // .on('end', function () {
            // })
            // set extension to match the new filetype; we are outputting a Message Stream, which is an .ndjson file
            file.extname = '.ndjson';
            // after our stream is set up (not necesarily finished) we call the callback
            log.debug('calling callback');
            cb(returnErr, file);
        }
    });
    return strm;
}
exports.tapMysql = tapMysql;
//# sourceMappingURL=plugin.js.map