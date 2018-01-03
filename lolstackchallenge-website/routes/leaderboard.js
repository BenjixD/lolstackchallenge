var express = require('express');
var path = require('path');
var async = require('async');
var https = require('https');
var sanitizer = require('sanitizer');
var riotApi = require('../config/riot-api.json');

var router = express.Router();

//Get within the last 20 games, all matches with :summoner playing :champion
router.get('/:region/matchlist/:champion/:summoner/recent', function(req, res, next){
	var region = sanitizer.sanitize(req.params.region.toUpperCase()) in riotApi.region ? sanitizer.sanitize(req.params.region.toLowerCase()) : "na1";
	var champion = parseInt(sanitizer.sanitize(req.params.champion));
	var summoner = sanitizer.sanitize(req.params.summoner);

	async.waterfall([
			function(callback){
				getSummonerIdByName(region, summoner, callback);
			},
			function(data, callback){
				getRecentMatchHistoryBySummonerId(region, data.accountId, callback);
			},
			function(data, callback){
				filterMatchHistoryByChampion(champion, data, callback);
			}
		], function(err, result){
			if(err){
				res.status(500).send(err.message);
			}
			else{
				res.send(result);
			}
	});
});


//ROIT-API Calls///////////////////////////////////////////////////////////////////////////////////////

function getSummonerIdByName(region, summonerName, callback) {
	const options = {
		host: riotApi.default.host.replace("{region}", region),
		path: riotApi.api.summoner_v3.by_name.replace("{summonerName}", summonerName),
		method: 'GET',
		headers: {
			'X-Riot-Token': riotApi.default.api_key
		}
	};

	sendRequest(options, callback);
}

function getRecentMatchHistoryBySummonerId(region, summonerId, callback) {
	const options = {
		host: riotApi.default.host.replace("{region}", region),
		path: riotApi.api.match_v3.by_account_recent.replace("{accountId}", summonerId),
		method: 'GET',
		headers: {
			'X-Riot-Token': riotApi.default.api_key
		}
	};

	sendRequest(options, callback);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////
function filterMatchHistoryByChampion(champion, history, callback) {
	var filtered = { matches: [] };
	for(var i = 0; i < history.matches.length; i++){
		console.log(history.matches[i]);
		if(history.matches[i].champion === champion){
			filtered.matches.push(history.matches[i]);
		}
	}
	callback(null, filtered);
}

function sendRequest(options, callback)
{
	var req = https.request(options, function(res){
  	if(res.statusCode >= 200 && res.statusCode < 400){
  		res.on('data', function(data){
				callback(null, JSON.parse(data));
			});	
  	}
  	else{
  		res.on('data', function(data){
				callback(new Error(JSON.parse(data)), null);
			});	
  	}
	});

	req.on('error', function(e){
		callback(e, null);
	});

	req.end();
}

module.exports = router;