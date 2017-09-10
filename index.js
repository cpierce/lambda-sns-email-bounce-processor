/**
 * SNS Email Bounce Processor
 *
 * @version 1.0.0
 */
'use strict';

/**
 * AWS SDK Load
 *
 * @const
 * @type  {object}
 */
const AWS = require('aws-sdk');

/**
 * KMS Encryption/Decryption Load
 *
 * @const
 * @type {AWS}
 */
const KMS = new AWS.KMS();

/**
 * MYSQL Load
 *
 * @const
 * @type  {object}
 */
const MYSQL = require('mysql');

/**
 * Environment Variable for MySQL Host
 *
 * @const
 * @type {string}
 */
const MYSQL_HOST = process.env.mysqlHost;

/**
 * Environment Variable for MySQL User
 *
 * @const
 * @type {string}
 */
const MYSQL_USER = process.env.mysqlUser;

/**
 * Environment Variable for MySQL Password [Encrypted]
 *
 * @const
 * @type {string}
 */
const MYSQL_PASSWORD_ENCRYPTED = process.env.mysqlPassword;
let MYSQL_PASSWORD;

/**
 * Environment Variable for MySQL Database
 *
 * @const
 * @type {string}
 */
const MYSQL_DATABASE = process.env.mysqlDatabase;

/**
 * Environment Variable for MySQL Table
 *
 * @const
 * @type {string}
 */
const MYSQL_TABLE = process.env.mysqlTable;

/**
 * Environment Variable for MySQL Email Field
 *
 * @const
 * @type {string}
 */
const MYSQL_EMAIL_FIELD = process.env.mysqlEmailField;

/**
 * Check Arguments method.
 *
 * @param {object}   event
 * @param {object}   context
 */
function checkArguments(event, context) {
    if (!event.Records ||
        !event.Records[0] ||
        !event.Records[0].Sns ||
        !event.Records[0].Sns.Message)
    {
        context.fail('Invalid arguments');
    }
}

/**
 * Check Bounce method.
 *
 * @param {object}   event
 * @param {object}   context
 * @param {Function} callback
 */
function checkBounce(event, context, callback) {
    var snsMessage = JSON.parse(event.Records[0].Sns.Message);
    if (snsMessage.notificationType) {
        if (snsMessage.notificationType === 'Bounce') {
            var bounceType = snsMessage.bounce.bounceType;
            var email      = cleanEmail(snsMessage.bounce.bouncedRecipients.emailAddress);
        } else if (snsnMessage.notificationType === 'Complaint') {
            // set to 'Permanent' so that the complaint email is always removed.
            var bounceType = 'Permanent';
            var email      = cleanEmail(snsMessage.complaint.complainedRecipients.emailAddress);
        }
    }

    if (email && bounceType) {
        if (bounceType === 'Permanent') {
            handleBounce(email, context, callback);
        }
    }
}

/**
 * Clean Email method.
 *
 * @param {object}   emails
 * @param {object}   context
 */
function cleanEmail(email, context) {
    var clean_email = email.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);

    if (clean_email && clean_email[0]) {
        return clean_email[0];
    } else {
        context.fail('Invalid Email Address');
    }
}

/**
 * Handle Bounce method.
 *
 * @param {string}   email
 * @param {object}   context
 * @param {Function} callback
 */
function handleBounce(email, context, callback) {
    var connection = MYSQL.createConnection({
        host     : MYSQL_HOST,
        user     : MYSQL_USER,
        password : MYSQL_PASSWORD,
        database : MYSQL_DATABASE
    });

    connection.connect();

    var data  = {MYSQL_EMAIL_FIELD: email};
    var query = connection.query('DELETE FROM `' + MYSQL_TABLE + '` WHERE ?', data, (err, result) => {
        if (err) {
            console.log('There was an error with your query', err);
        } else {
            console.log('Removing - ', email);
        }
    });

    connection.end();
}

/**
 * Process Bounce Request method.
 *
 * @param {object}   event
 * @param {object}   context
 * @param {Function} callback
 */
function processBounceRequest(event, context, callback) {
    // First check to see if we have an event with a valid record in it.
    checkArguments(event, context);
    // Arguments are there so we should check to see if the bounce was permanent.
    checkBounce(event, context, callback);
}

/**
 * Event Handler constructor invoked by cloud watch schedule.
 *
 * @param {object}   event
 * @param {object}   context
 * @param {Function} callback
 */
exports.handler = (event, context, callback) => {
    if (MYSQL_PASSWORD) {
        processBounceRequest(event, context, callback);
    } else {
        KMS.decrypt({ CiphertextBlob: new Buffer(MYSQL_PASSWORD_ENCRYPTED, 'base64') }, (err, data) => {
            if (err) {
                console.log('Decrypt error:', err);
                return callback(err);
            }
            MYSQL_PASSWORD = data.Plaintext.toString('ascii');
            processBounceRequest(event, context, callback);
        });
    }
};
