const through2 = require('through2')
import * as Vinyl from 'vinyl';
import PluginError = require('plugin-error');
const pkginfo = require('pkginfo')(module); // project package.json info into module.exports
const PLUGIN_NAME = module.exports.name;
import * as loglevel from 'loglevel'
const log = loglevel.getLogger(PLUGIN_NAME) // get a logger instance based on the project name
log.setLevel((process.env.DEBUG_LEVEL || 'warn') as loglevel.LogLevelDesc)
import * as mysql from 'mysql2';
import merge from 'merge';

const from2 = require('from2');
import * as path from 'path'

// import * as gulpBuffer from 'gulp-buffer'
const gulpBuffer = require('gulp-buffer')

// const 

/** wrap incoming recordObject in a Singer RECORD Message object*/
function createRecord(recordObject:Object, streamName: string) : any {
  return {type:"RECORD", stream:streamName, record:recordObject}
}

// gulp vinyl adapter for mysql: loads results of mysql call and wraps it in a vinyl file, then returns vinyl file in a readable stream
export function src(this: any, pretendFilePath:string, options:any) {
  let result
  
  try {
    let conn = mysql.createConnection(options.connection)    
    let vinylFile:Vinyl
    // create a file wrapper that will pretend to gulp that it came from the path represented by pretendFilePath
    vinylFile = new Vinyl({
      base: path.dirname(pretendFilePath),    
      path:pretendFilePath,
      // contents:
    });
  
    result = from2.obj([vinylFile])
    
    let fileStream = conn.query(options.sql)
    .on('end', function() {
      log.debug('all rows have been received')
    })    
    .stream({})

    vinylFile.contents=fileStream
    log.debug('closing connection when all rows are received')
    conn.end()

    // TODO: Figure out how to deal with errors here
    // this does not trigger parent stream's error handling
    // result.emit(new PluginError(PLUGIN_NAME, 'No problem'))

    // this creates an error that can be caught if the parent stream is wrapped in a try/catch
    // throw new PluginError(PLUGIN_NAME, 'No problem')
    
    result = result.pipe(tapMysql({}))
    // buffer mode: stream through gulpBuffer to convert vinylFile to isBuffer(true)
    if (options.buffer !== false) {
      result = result.pipe(gulpBuffer())
      // gulp-buffer issues:
      // - requires data to be buffers (gulp-etl uses strings and objects)
      // - files silently upon error (such as passing strings instead of buffers)
    }
  }
  catch (err:any) {
    // emitting here causes some other error: TypeError: Cannot read property 'pipe' of undefined
    // result.emit(new PluginError(PLUGIN_NAME, err))
    
    // For now, bubble error up to calling function
    throw new PluginError(PLUGIN_NAME, err)
  }
  
  return result
}

let localDefaultConfigObj: any = {};
/**
 * Merges config information for this plugin from all potential sources
 * @param specificConfigObj A configObj set specifically for this plugin
 * @param pipelineConfigObj A "super" configObj (e.g. file.data or msg.config) for the whole pipeline which may/may not apply to this plugin; 
 * only used in absence of specificConfigObj
 * @param defaultConfigObj A default configObj whose properties are overridden by the others
 */
export function extractConfig(specificConfigObj:any, pipelineConfigObj?:any, defaultConfigObj:any = localDefaultConfigObj) : any {
  let configObj: any;
  try {
    let dataObj;
    if (specificConfigObj)
      dataObj = specificConfigObj
    else if (pipelineConfigObj) {
      // look for a property based on our plugin's name; assumes a complex object meant for multiple plugins
      dataObj = pipelineConfigObj[PLUGIN_NAME];
      // if we didn't find a config above, use the entire pipelineConfigObj object as our config
      if (!dataObj) dataObj = pipelineConfigObj;
      // merge superConfigObj config into our passed-in origConfigObj
    }

    // merge our chosen dataObj into defaultConfigObj, overriding any conflicting properties in defaultConfigObj
    // merge.recursive(defaultConfigObj, dataObj); // <-- huge bug: can't parameter objects: changing them affects subsequent plugins in the pipeline
    configObj = merge.recursive(true, defaultConfigObj, dataObj );
  }
  catch { }
  return configObj;
}

/* This is a gulp-etl plugin. It is compliant with best practices for Gulp plugins (see
https://github.com/gulpjs/gulp/blob/master/docs/writing-a-plugin/guidelines.md#what-does-a-good-plugin-look-like ),
and like all gulp-etl plugins it accepts a configObj as its first parameter */
export function tapMysql(origConfigObj: any) {

  // creating a stream through which each file will pass - a new instance will be created and invoked for each file 
  // see https://stackoverflow.com/a/52432089/5578474 for a note on the "this" param
  const strm = through2.obj(function (this: any, file: Vinyl, encoding: string, cb: Function) {

    let configObj:any = extractConfig(origConfigObj, file.data);

    const self = this
    let returnErr: any = null

    // post-process line object
    const handleLine = (lineObj: any, _streamName : string): object | null => {
      lineObj = createRecord(lineObj, _streamName)
      return lineObj
    }

    function newTransformer(streamName : string) {

      let transformer = through2.obj(); // new transform stream, in object mode
  
      // transformer is designed to follow mysql, which emits objects, so dataObj is an Object. We will finish by converting dataObj to a text line
      transformer._transform = function (dataObj: Object, encoding: string, callback: Function) {
        let returnErr: any = null
        try {
          let handledObj = handleLine(dataObj, streamName)
          if (handledObj) {
            let handledLine = JSON.stringify(handledObj)
            log.debug(handledLine)
            // has to be buffer, for now, because we're using gulp-buffer
            this.push(Buffer.from(handledLine + '\n'));
          }
        } catch (err:any) {
          returnErr = new PluginError(PLUGIN_NAME, err);
        }
  
        callback(returnErr)
      }
  
      return transformer
    }

    // set the stream name to the file name (without extension)
    let streamName : string = file.stem

    if (file.isNull()) {
      // return empty file
      return cb(returnErr, file)
    }
    else if (file.isBuffer()) {
        let linesArray = file.contents//.toArray()
        let tempLine: any
        let resultArray = [];
        // we'll call handleLine on each line
        for (let dataIdx in linesArray) {
          try {
            let lineObj = linesArray[dataIdx]
            tempLine = handleLine(lineObj, streamName)
            if (tempLine){
              let tempStr = JSON.stringify(tempLine)
              log.debug(tempStr)
              resultArray.push(tempStr);
            }
          } catch (err:any) {
            returnErr = new PluginError(PLUGIN_NAME, err);
          }
        }
        let data:string = resultArray.join('\n')

        file.contents = Buffer.from(data)
        
        // we are done with file processing. Pass the processed file along
        log.debug('calling callback')    
        cb(returnErr, file);    
    }
    else if (file.isStream()) {
      file.contents = file.contents
        // .on('data', function (data:any, err: any) {
        //   log.debug(data)
        // })
        .on('error', function (err: any) {
          log.error(err)
          self.emit('error', new PluginError(PLUGIN_NAME, err));
        })
        .pipe(newTransformer(streamName))
        // .on('end', function () {
        // })

      // set extension to match the new filetype; we are outputting a Message Stream, which is an .ndjson file
      file.extname = '.ndjson'

        // after our stream is set up (not necesarily finished) we call the callback
      log.debug('calling callback')    
      cb(returnErr, file);
    }

  })

  return strm
}

