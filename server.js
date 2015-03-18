var path = require('path');
var MEMCACHED_HOST = process.env.MEMCACHED_HOST || '127.0.0.1:11211';
var PORT = process.env.PORT || 3000;
var isDev = process.env.NODE_ENV !== 'development';

var express = require('express');
var app = express();

// Favicon
var favicon = require('serve-favicon');
app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.png')));

isDev = false

// Serving public files
if(isDev) {
  app.use(express.static(__dirname + '/public'));
} else {
  var gzipStatic = require('connect-gzip-static');
  app.use(gzipStatic(__dirname + '/public', { maxAge: 86400000 * 365 }));
}

// Jade views
app.set('view engine', 'jade');

// Basic logger
var logger = require('morgan');
app.use(logger('dev'));

// Understanding JSON requests (POST)
var bodyParser = require('body-parser');
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded());


// Cookies sessions
var session = require('cookie-session');
app.use(session({
  keys: ['lapin']
}));

// Routes
var routes = {};
require('fs').readdirSync('./routes').forEach(function(file) {
  var routeName = file.replace('.js', '');
  routes[routeName] = require('./routes/' + file)[routeName];
});

app.get('/', routes.index);
app.post('/p/:url', routes.proxy);

// Errors handling
if (isDev) {
  // var errorhandler = require('errorhandler');
  // app.use(errorhandler());
  var PrettyError = require('pretty-error');
  pe = new PrettyError();
  app.use(function(err, req, res, next){
    if(err) console.log(pe.render(err));
  });
  pe.skipNodeFiles(); 
}

// App startup
app.listen(PORT);
console.log('Express listening on port ' + PORT);

