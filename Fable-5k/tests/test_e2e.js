process.on('uncaughtException',e=>{console.log('UNCAUGHT:',e.message);});
require('./release_e2e_run.js');
