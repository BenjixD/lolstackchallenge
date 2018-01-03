//Webserver
var express = require('express');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
//Filesystem
var path = require('path');


//Startup webserver
var app = express();
//Load favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'img', 'favicon.ico')));
//Body Parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
//Serve from public
app.use(express.static(path.join(__dirname, 'public')));

//Serve page
app.get('/', function(req, res, err){
	res.send("hello world!");
});

//routes
const leaderboard = require('./routes/leaderboard');
app.use('/leaderboard', leaderboard);

app.listen(3000, function() {
	console.log('Server running on localhost:3000');
});

module.exports = app;