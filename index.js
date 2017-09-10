console.log('Lambda Node Sns/Ses Email Bounce Catcher - Version 1.0.1');

var aws = require('aws-sdk');
var mysql = require('mysql');

exports.handler = function(event, context) {
    if (!event.Records
     || !event.Records[0]
     || !event.Records[0].Sns
     || !event.Records[0].Sns.Message) {
        context.fail('Invalid arguments');
        return;
    }

    function cleanEmails(emails)
    {
        return emails.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
    }

    var messageContent = JSON.parse(event.Records[0].Sns.Message);

    var bounceType = messageContent['bounce']['bounceType'];
    var bounceSubType = messageContent['bounce']['bounceSubType'];
    var sesDestination = messageContent['bounce']['bouncedRecipients'][0]['emailAddress'];
    var sesDiagnosticCode = messageContent['bounce']['bouncedRecipients'][0]['diagnosticCode'];
    //var SesMessageId = messageContent['mail']['messageId'];

    var connection = mysql.createConnection({
        host     : 'gabbartinstance.c46fnar2vrms.us-east-1.rds.amazonaws.com',
        user     : 'gabbart',
        password : 'AoKilae6neitaej4',
        database : 'sites'
    });

    connection.connect();

    if (sesDestination && bounceType) {
        var clean_email = cleanEmails(sesDestination);

        if (clean_email && clean_email[0]) {
            sesDestination = clean_email[0];
        }
        if (bounceType == 'Permanent') {
            var data  = {email: sesDestination};
            var query = connection.query('INSERT INTO `email_suppression` SET ?', data, function(err, result) {
                if (err) {
                    console.log('There was an error with your query', err);
                } else {
                    console.log('Blocking - ', sesDestination);
                }
            });
        }

        var data  = {
            email: sesDestination ? sesDestination : 'bad_destination',
            bounce_type: bounceType ? bounceType : 'bad_type',
            diagnostic_code: sesDiagnosticCode ? sesDiagnosticCode : 'bad_code',
            bounce_sub_type: bounceSubType ? bounceSubType : 'bad_sub_type'
        };
        var query = connection.query('INSERT INTO `email_bounces` SET ?', data, function(err, result) {
            if (err) {
                console.log('There was an error with your query', err);
            }
        });
    } else {
        console.log(messageContent);
    }
    connection.end();
};

