#!/usr/bin/env node
var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    port = process.argv[2] || 8443;

var isUseHTTPs = true;

    var options = {
        key: fs.readFileSync("./ssl/key.pem"),
        cert: fs.readFileSync("./ssl/cert.pem")
    };

// force auto reboot on failures
var autoRebootServerOnFailure = false;

var server = require(isUseHTTPs ? 'https' : 'http');


// The connect_me() function alerts the central server
// that I'd like to start, or join a two way conversation.
function connect_me() {

}

// The disconnect_me() function will cause the room I'm in
// to be closed. Both parties will leave the room.
function disconnect_me() {

}


function cmd_exec(cmd, args, cb_stdout, cb_end) {
        var spawn = require('child_process').spawn;
        var child = spawn(cmd, args);
        child.on('error', function(err) {
           console.log('cmd_exec. ' + err);
        });

        var me = this;

        me.exit = 0;
        me.stdout = "";
        child.stdout.on('data', function(data) {
            cb_stdout(me, data)
        });
        child.stdout.on('end', function() {
            cb_end(me)
        });
}




//http.createServer(function(request, response) {
function serverHandler(request, response) {
  var reqURL = url.parse(request.url);
  var uri = reqURL.pathname;

  if (uri == '/pistate') {
                /*foo = new cmd_exec('dig', ['+short', 'myip.opendns.com', '@resolver1.opendns.com'],
                   function(me, data) {
                      var ip = data.toString().trim();
                      response.setHeader('Content-Type', 'application/json');
                      response.setHeader('Cache-Control', 'no-cache, no-store');
                      response.end(JSON.stringify([{ip:ip}]));
                    },
                    function(me) {
                      response.setHeader('Content-Type', 'application/json');
                      response.setHeader('Cache-Control', 'no-cache, no-store');
                      response.end(JSON.stringify([]));
                  }
                );
                */
                response.setHeader('Content-Type', 'application/json');
                response.setHeader('Cache-Control', 'no-cache, no-store');
                response.end(JSON.stringify([]));
                return;
  }else if (uri == '/piset') {
                var query = queryString.parse( reqURL.query );
                response.end();
                return;
  }

  var filename = path.join(process.cwd(), uri);

  fs.exists(filename, function(exists) {
    if(!exists) {
      response.writeHead(404, {"Content-Type": "text/plain"});
      response.write("404 Not Found\n");
      response.end();
      return;
    }

    if (fs.statSync(filename).isDirectory()) filename += '/index.html';

    fs.readFile(filename, "binary", function(err, file) {
      if(err) {
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.write(err + "\n");
        response.end();
        return;
      }

      response.writeHead(200);
      response.write(file, "binary");
      response.end();
    });
  });
}

const spawn = require('child_process').spawn;

function spawn_browser(){
  browser = spawn('/usr/bin/chromium-browser', ['','',''],
    {cwd:'/home/pi/listening-trees-pi-2017',
     shell:true,
     stdio:['pipe','pipe','pipe']});

  browser.on('error', function(err) {
        console.log('spawn_browser. ' + err);
     });

  browser.on('close', (code) => {
        console.log(`browser child process exited with code ${code}`);
  });

  browser.stderr.on('data', (data) => {
        console.log(`browser stderr: ${data}`);
  });

  browser.stdio[1].on('data', (data) => {
    console.log(`browser stdout: ${data}`);
  });
}

function spawn_accel(){
  accel = spawn('/home/pi/listening-trees-pi-2017/accel_stream', ['','',''],
    {cwd:'/home/pi/listening-trees-pi-2017',
     shell:true,
     stdio:['pipe','pipe','pipe']});

  accel.on('error', function(err) {
        console.log('spawn_accel. ' + err);
     });

  accel.on('close', (code) => {
        console.log(`accel_stream child process exited with code ${code}`);
  });

  accel.stderr.on('data', (data) => {
        console.log(`accel stderr: ${data}`);
  });

  accel.stdio[1].on('data', (data) => {
    //var rows = data.split('\n');
    console.log(`accel stdout: rows`, data.length); //${data}`);
    // Likely get 4096 rows per call.
    // No need to process more than 100
    for(var i=0; i < data.length; i+=40){
      console.log(data[i]);
    }
  });
}

spawn_accel();
spawn_browser();


var app;

if (isUseHTTPs) {
    app = server.createServer(options, serverHandler);
} else {
    app = server.createServer(serverHandler);
}

function runServer() {
    app.on('error', function(e) {
        if (e.code == 'EADDRINUSE') {
            if (e.address === '0.0.0.0') {
                e.address = 'localhost';
            }

            var socketURL = (isUseHTTPs ? 'https' : 'http') + '://' + e.address + ':' + e.port + '/';

            console.log('------------------------------');
            console.log('\x1b[31m%s\x1b[0m ', 'Unable to listen on port: ' + e.port);
            console.log('\x1b[31m%s\x1b[0m ', socketURL + ' is already in use. Please kill below processes using "kill PID".');
            console.log('------------------------------');

            foo = new cmd_exec('lsof', ['-n', '-i4TCP:9001'],
                function(me, data) {
                    me.stdout += data.toString();
                },
                function(me) {
                    me.exit = 1;
                }
            );
        }
    });

    app = app.listen(port, process.env.IP || '0.0.0.0', function(error) {
        var addr = app.address();

        if (addr.address === '0.0.0.0') {
            addr.address = 'localhost';
        }

        var domainURL = (isUseHTTPs ? 'https' : 'http') + '://' + addr.address + ':' + addr.port + '/';

    });
}

if (autoRebootServerOnFailure) {
    // auto restart app on failure
    var cluster = require('cluster');
    if (cluster.isMaster) {
        cluster.fork();

        cluster.on('exit', function(worker, code, signal) {
            cluster.fork();
        });
    }

    if (cluster.isWorker) {
        runServer();
    }
} else {
    runServer();
}
