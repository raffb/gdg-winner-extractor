const fs = require('fs');
const path = require('path');
const readline = require('readline');
const google = require('googleapis');
const googleAuth = require('google-auth-library');
const http = require('http');
const ip = require('ip');
const nodemailer = require('nodemailer');
require('dotenv').config();


let transporter = nodemailer.createTransport({
	port:process.env.MAILTRAP_PORT,
	host:process.env.MAILTRAP_HOST,
	auth:{
		user:process.env.MAILTRAP_USERNAME,
		pass:process.env.MAILTRAP_PASSWORD
	},
	authMethod:process.env.MAILTRAP_AUTH
});

if(process.env.NODE_ENV!=='development'){

	transporter = nodemailer.createTransport({
		service: 'Gmail',
		auth: {
			user: process.env.GMAIL_EMAIL, // Your email id
			pass: process.env.GMAIL_PASSWORD // Your password
		}
	});
}

const app_auth_credentials={
	client_secret: process.env.AUTH_CLIENT_SECRET,
	client_id: process.env.AUTH_CLIENT_ID,
	redirect_urls: process.env.AUTH_REDIRECT_URL
};

const mailOptions = {
	from: '"'+process.env.GMAIL_NAME+'" <'+process.env.GMAIL_EMAIL+'>',
	subject: 'Complimenti, hai vinto!'
};

let estratti = [];

/*ADD NIGHT */

http.createServer(function (req, res) {

// Website you wish to allow to connect
	res.setHeader('Access-Control-Allow-Origin', '*');

	// Request methods you wish to allow
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

	// Request headers you wish to allow
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

	// Set to true if you need the website to include cookies in the requests sent
	// to the API (e.g. in case you use sessions)
	res.setHeader('Access-Control-Allow-Credentials', true);


// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
	const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
	const TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
		process.env.USERPROFILE) + '/.credentials/';
	const TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';
	authorize(app_auth_credentials, listMajors);


	/**
	 * Create an OAuth2 client with the given credentials, and then execute the
	 * given callback function.
	 *
	 * @param {Object} credentials The authorization client credentials.
	 * @param {function} callback The callback to call with the authorized client.
	 */
	function authorize(credentials, callback) {
		const clientSecret = credentials.client_secret;
		const clientId = credentials.client_id;
		const redirectUrl = credentials.redirect_urls;
		const auth = new googleAuth();
		const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

		// Check if we have previously stored a token.
		fs.readFile(TOKEN_PATH, function (err, token) {
			if (err) {
				getNewToken(oauth2Client, callback);
			} else {
				oauth2Client.credentials = JSON.parse(token);
				callback(oauth2Client);
			}
		});
	}

	/**
	 * Get and store new token after prompting for user authorization, and then
	 * execute the given callback with the authorized OAuth2 client.
	 *
	 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
	 * @param {getEventsCallback} callback The callback to call with the authorized
	 *     client.
	 */
	function getNewToken(oauth2Client, callback) {
		var authUrl = oauth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: SCOPES
		});
		console.log('Authorize this app by visiting this url: ', authUrl);
		var rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});
		rl.question('Enter the code from that page here: ', function (code) {
			rl.close();
			oauth2Client.getToken(code, function (err, token) {
				if (err) {
					console.log('Error while trying to retrieve access token', err);
					return;
				}
				oauth2Client.credentials = token;
				storeToken(token);
				callback(oauth2Client);
			});
		});
	}

	/**
	 * Store token to disk be used in later program executions.
	 *
	 * @param {Object} token The token to store to disk.
	 */
	function storeToken(token) {
		try {
			fs.mkdirSync(TOKEN_DIR);
		} catch (err) {
			if (err.code != 'EEXIST') {
				throw err;
			}
		}
		fs.writeFile(TOKEN_PATH, JSON.stringify(token));
		console.log('Token stored to ' + TOKEN_PATH);
	}

	function giapresente(mail) {
		console.log('Mail estratta: ' + mail);
		for (var i in estratti) {
			if (estratti[i] === mail) {
				console.log('Già presente, riprovo');
				return true;
			}
		}
		return false;
	}

	function extractData(rows) {
		row = rows[Math.floor(Math.random() * rows.length)];
		data = {
			'fullname': row[1],
			'mail': row[3]
		};
		return data;
	}

	function appendMail(data) {
		fs.appendFile('estratti.txt', data.mail + '\n', function (err) {
			if (err) throw err;
			console.log('Mail saved to estratti.txt!');
		});
	}

	/**
	 * Print the names and majors of students in a sample spreadsheet:
	 * https://docs.google.com/spreadsheets/d/{SHEET-ID}/edit
	 */
	function listMajors(auth) {
		//Read list extract
		fs.readFile('estratti.txt', function (err, data) {
			if (err) {
				return console.error(err);
			}
			estratti = data.toString().split('\n');
		});
		const sheets = google.sheets('v4');
		sheets.spreadsheets.values.get({
			auth: auth,
			spreadsheetId: process.env.SHEET_ID,
			range: 'A2:E',
		}, function (err, response) {
			if (err) {
				console.log('The API returned an error: ' + err);
				return;
			}
			const rows = response.values;
			if (rows === undefined || rows.length === 0) {
				console.log('No data found on spreadsheet');
				res.end('No data found on spreadsheet');
			} else if (rows.length <= (estratti.length - 1)) {
			 	console.log('Not enough people on the spreadsheet, please retry in a while');
				res.end('Not enough people on the spreadsheet, please retry in a while');
			} else {
				do {
					data = extractData(rows);
				} while (giapresente(data.mail));
				console.log('Nome estratto: ' + data.fullname);
				mailOptions.to = data.mail;
				mailOptions.html = 'Hey <b>' + data.fullname + '</b>, abbiamo il piacere di informarti che il tuo nome è stato estratto ed hai vinto un fantastico gadget firmato <b>Google</b>!<br>Ti aspettiamo al banchetto <b>GDG Italia</b> per ritirarlo, nel frattempo buon Codemotion da tutti i Google Developer Groups italiani!';
				transporter.sendMail(mailOptions, function (error, info) {
					if (error) {
						console.log(error);
						//res.json({yo: 'error'});
					} else {
						console.log('Message sent: ' + info.response);
						appendMail(data);
						//res.json({yo: info.response});
					}
				});
				res.end(JSON.stringify(data));
			}
		});
	}
}).listen(8002, 'localhost');


console.log('');
console.log(' ******************************');
console.log(' *    GDG WINNER EXTRACTOR    *');
console.log(' *                            *');
console.log(' *        Made with ♥ by      *');
console.log(' *    Ivan Mazzoli (GDG BS)   *');
console.log(' * Alessandro Maggio (GDG CT) *');
console.log(' ******************************');
console.log('');
console.log(' Server running at http://localhost:8002/');
if(process.env.NODE_ENV==='development')console.log(' Access this server from the same network at ' + ip.address() + ':8002');
console.log('');
console.log('########## SERVER LOG START ##########');
