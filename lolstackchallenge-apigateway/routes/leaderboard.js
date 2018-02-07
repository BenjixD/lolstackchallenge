var express = require('express');
var path = require('path');
var async = require('async');
var https = require('https');
var sanitizer = require('sanitizer');
var multer = require('multer');

//mongodb
var mongo;
//aws
var AWS;

//Config
var riotApi = require('../config/secret/riot-api.json');
var leaderboardConfig = require('../config/leaderboard-config.json');
var mongoConfig = require("../config/mongodb-config.json");

var router = express.Router();

//Set filters on multer to protect server
var uploadImage = multer({
	fileFilter: function (req, file, callback){
			var ext = path.extname(file.originalname);
			if(ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg'){
				return callback(new Error('Only images!'));
			}else{
				callback(null, true);	
			}
	},
	limits:{
		fileSize: 1024 * 1024 * 256
	}
});
//

//Get within the last 20 games, all matches in :region with :summoner playing :champion
router.get('/stack/matchlist/:region/:champion/:summoner/recent', function(req, res, next){
	var region = sanitizer.sanitize(req.params.region.toLowerCase());
	var champion = sanitizer.sanitize(req.params.champion);
	var summoner = sanitizer.sanitize(req.params.summoner);

	async.waterfall([
			//Verify Input
			function(callback){
				if(verifyRegion(region) && verifyChampion(champion)){
					callback();
				}
				else{
					callback(new Error("Unsupported Champion or Region."));
				}
			},
			//Get SummonerId
			function(callback){
				getSummonerIdByName(region, summoner, callback);
			},
			//Get Recent Match History
			function(data, callback){
				getRecentMatchHistoryBySummonerId(region, data.accountId, callback);
			},
			//Filter the Match History by Champion
			function(data, callback){
				filterMatchHistoryByChampion(parseInt(champion), data, callback);
			},
			//Filter the Match History by Queue
			function(data, callback){
				filterMatchHistoryByQueue(leaderboardConfig.stack_challenge.queue_mode, data, callback);	
			},
			//Get all the associated match data (and filter only player data)
			function(data, callback){
				async.map(data.matches, function(match, next){
					getMatchDataByMatchId(region, match.gameId, function(err, data){
						if(err){
							next(err, data);
						}
						else{
							getPlayerDataFromMatch(summoner, data, next);
						}
					});
				}, function(err, results){
					callback(err, results);
				});
			},
		//Finally
		], function(err, result){
			if(err){
				res.status(500).send(err.message);
			}
			else{
				res.send(result);
			}
	});
});

//Submit an entry to the database
router.post('/stack/:region/:champion/entry', uploadImage.single('image'), function(req, res, next){
		var region = sanitizer.sanitize(req.params.region.toLowerCase());
		var champion = sanitizer.sanitize(req.params.champion);

		//Data
		var matchId =  sanitizer.sanitize(req.body.matchId);
		var summoner = sanitizer.sanitize(req.body.summoner);
		var stacks = sanitizer.sanitize(req.body.stacks);
		var image = req.file;

		async.waterfall([
			//get the match data by matchid
			function(callback){
				getMatchDataByMatchId(region, parseInt(matchId), callback);
			},
			function(data, callback){
				getPlayerDataFromMatch(summoner, data, callback);
			},
			function(data, callback){
				if(!isNaN(stacks)){
					data.player.stacks = parseInt(stacks);
					data.player.name = summoner;
					callback(null, data);	
				}else{
					callback(new Error("Invalid stacks."), null);
				}
			},
			//Query if exists and within top
			function(data, callback){
				findGameMatch(data.seasonId, parseInt(data.gameId), leaderboardConfig.stack_challenge.champion[champion], function(err, result){
					if(err){
						callback(err, null);
					}else if(result){
						callback(new Error("Game has already been submitted!"), null);
					}
					else{
						callback(null, data);
					}
				});
			},
			//Ensure the image goes into s3
			function(data, callback){
				var object = {Key: leaderboardConfig.stack_challenge.champion[champion]+"/"+matchId, 
											ContentType: image.mimetype,
											Body: image.buffer,
											ACL: 'public-read'};
				AWS.S3().putObject(object, function(err, result){
					data.url = AWS.ClientData().s3.url+'/'+object.Key;
					callback(err,  data);
				});
			}
			//finally
			], function(err, result){
				if(err){
					res.status(500).send(err.message);
				}
				else{
					//Put the entry into DB
					insertGameMatch(leaderboardConfig.stack_challenge.champion[champion], result, function(err, data){
						if(err){
							res.status(500).send(err.message);
						}
						else{
							console.log("Document Inserted.");
							res.send(result);
						}
					});
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

function getMatchDataByMatchId(region, matchId, callback) {
	const options = {
		host: riotApi.default.host.replace("{region}", region),
		path: riotApi.api.match_v3.get_match.replace("{matchId}", matchId),
		method: 'GET',
		headers: {
			'X-Riot-Token': riotApi.default.api_key
		}
	};

	sendRequest(options, callback);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////
function verifyRegion(region){
	return (region.toUpperCase() in riotApi.region);
}

function verifyChampion(champion){
	return (champion in leaderboardConfig.stack_challenge.champion);
}

function filterMatchHistoryByChampion(champion, history, callback) {
	var filtered = { matches: [] };
	for(var match in history.matches){
		if(history.matches[match].champion === champion){
			filtered.matches.push(history.matches[match]);
		}
	}

	callback(null, filtered);
}

function filterMatchHistoryByQueue(queueModes, history, callback){
	var filtered = { matches: [] };

	for(var match in history.matches){
		if(String(history.matches[match].queue) in queueModes){
			filtered.matches.push(history.matches[match]);
		}
	}

	callback(null, filtered);
}

function getPlayerDataFromMatch(summonerName, match, callback) {
	for(var participant in match.participantIdentities){
		if(match.participantIdentities[participant].player.summonerName.toLowerCase() === summonerName.toLowerCase()){
			var data = {
				gameId: match.gameId,
				platformId: match.platformId,
				gameCreation: match.gameCreation,
				queueId: match.queueId,
				mapId: match.mapId,
				seasonId: match.seasonId,
				gameVersion: match.gameVersion,
				gameMode: match.gameMode,
				gameType: match.gameType,
				player: match.participants[match.participantIdentities[participant].participantId - 1]
			};

			callback(null, data);
			return;
		}
	}

	callback(new Error("Player Not Found"), null);
}

function sendRequest(options, callback)
{
	var req = https.request(options, function(res){
		var resData = "";

  	if(res.statusCode == 200){
  		res.on('data', function(chunk){
  			resData += chunk;
			});	

			res.on('end', function(){
  			callback(null, JSON.parse(resData));
  		});
  	}
  	else{
  		res.on('data', function(data){
  			console.log(JSON.parse(data));
				callback(new Error(res.statusCode), null);
			});	
  	}
	});

	req.on('error', function(e){
		callback(e, null);
	});

	req.end();
}

function insertGameMatch(champion, matchData, callback){
	var collectionName = mongoConfig.collection[champion];
	mongo.client().collection(collectionName).updateOne(
		{ "season" : riotApi.default.season },
		{ "$push" : { ranking: matchData } },
		{ upsert: true },
		callback);
}

function findGameMatch(season, matchId, champion, callback){
	var collectionName = mongoConfig.collection[champion];
	mongo.client().collection(collectionName).findOne({
		$and: [
			{ "season" : season },
			{ "ranking" : { $elemMatch: { "gameId" : matchId } } }
		]}, callback);
}

module.exports = function(mongodb, aws){
	mongo = mongodb;
	AWS = aws;
	return router;	
}
