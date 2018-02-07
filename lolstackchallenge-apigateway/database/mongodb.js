const MongoClient = require('mongodb').MongoClient;
const mongoConfig = require('../config/mongodb-config.json');
const assert = require('assert');

//Connection URL
const url = mongoConfig.url;

//Database name
const dbName = mongoConfig.database_name;

//Collection name
const colName = mongoConfig.collection;

//Connection
var _client;

module.exports = {
	connect: function(callback){
		//Use connection method to connect to the database
		MongoClient.connect(url, function(err, client){
			if(err){
				assert.equal(null, err);
			}
			else{
				console.log("Connected successfully to database");
				_client = client.db(dbName);
			}

			return callback(err);
		});
	},

	client: function(){
		//Returns the connection
		return _client;
	},
}
