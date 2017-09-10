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
 * Environment Variable for MySQL Password
 *
 * @const
 * @type {string}
 */
const MYSQL_PASSWORD = process.env.mysqlPassword;

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
    var bounceType = '';
    var email      = '';
    if (snsMessage.notificationType) {
        if (snsMessage.notificationType === 'Bounce') {
            bounceType = snsMessage.bounce.bounceType;
            email      = cleanEmail(snsMessage.bounce.bouncedRecipients[0].emailAddress);
        } else if (snsMessage.notificationType === 'Complaint') {
            // set to 'Permanent' so that the complaint email is always removed.
            bounceType = 'Permanent';
            email      = cleanEmail(snsMessage.complaint.complainedRecipient[0].emailAddress);
        }
    }

    if (bounceType === 'Permanent' && email.length > 0) {
        handleBounce(email, context, callback);
    }
}

/**
 * Clean Email method.
 *
 * @param {object}   dirty_email
 * @param {object}   context
 */
function cleanEmail(dirty_email, context) {
    var clean_email = dirty_email.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);

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

    var query = connection.query('DELETE FROM `' + MYSQL_TABLE + '` WHERE `' + MYSQL_EMAIL_FIELD + '` = \'' + email + '\' LIMIT 1', (err, result) => {
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
    console.log('Email Bounce Processor - Protreat');
    processBounceRequest(event, context, callback);
};
