let gulp = require('gulp')
import * as tapMysql from '../src/plugin'

import * as loglevel from 'loglevel'
const log = loglevel.getLogger('gulpfile')
log.setLevel((process.env.DEBUG_LEVEL || 'warn') as loglevel.LogLevelDesc)
// if needed, you can control the plugin's logging level separately from 'gulpfile' logging above
// const pluginLog = loglevel.getLogger(PLUGIN_NAME)
// pluginLog.setLevel('debug')

const errorHandler = require('gulp-error-handle'); // handle all errors in one handler, but still stop the stream if there are errors

const pkginfo = require('pkginfo')(module); // project package.json info into module.exports
const PLUGIN_NAME = module.exports.name;

import Vinyl = require('vinyl') 


// contains secure info; store in parent folder of this project, outside of repo
let configObj = require('../../mysql-settings.json')

/* 
let configObj = 
// mysql-settings.json should look like this: 
{
  "sql": "SELECT * FROM customers LIMIT 2;",
  "connection": {
    "host"     : "example.org",
    "user"     : "bob",
    "password" : "secret",
    "database" : "schemaName"
  }
}

*/

function switchToStream(callback: any) {
  // buffer is true by default; we switch to stream mode by setting buffer to false here
  configObj.buffer = false;

  callback();
}

function runMysqlAdapter(callback: any) {
  log.info('gulp task starting for ' + PLUGIN_NAME)

  try {

  return tapMysql.src('mysqlResults',configObj)
    .pipe(errorHandler(function(err:any) {
      log.error('Error: ' + err)
      callback(err)
    }))
    .pipe(gulp.dest('../testdata/processed'))
    .on('data', function (file:Vinyl) {
      log.info('Finished processing on ' + file.basename)
    })    
    .on('end', function () {
      log.info('gulp task complete')
      callback()
    })

  }
  catch (err) {
    log.error(err)
  }

}

exports.default = gulp.series(switchToStream, runMysqlAdapter)
exports.runMysqlAdapterBuffer = runMysqlAdapter