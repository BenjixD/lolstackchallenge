var AWS = require('aws-sdk')
var awsConfig = require('../config/secret/aws-config.json');

//Set the Access Creds
AWS.config.update({ 
	accessKeyId: awsConfig.accessKeyId, 
	secretAccessKey: awsConfig.secretKeyId
});

var s3 = new AWS.S3({params: {Bucket: awsConfig.s3.bucket}});

module.exports = {
	Client: function(){
		return AWS;
	},
	S3: function(){
		return s3;
	},
	ClientData: function(){
		return {
			s3:awsConfig.s3
		};
	}

}