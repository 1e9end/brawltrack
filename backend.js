import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";
import http from "http";
import url from "url";
import mongodb from "mongodb";
const {MongoClient: mongoClient} = mongodb;
import nodemailer from "nodemailer";
import cron from "node-cron";
import axios from "axios";
import httpsProxyAgent from "https-proxy-agent";
import socksProxyAgent from "socks-proxy-agent";

/**
	API Structure 

	BB [Database] {
		ClubName [Collection] {
			Member [BSON Document] {
				tag,
				name,
				start
				trophies,
				monday,
				tuesday,
				wednesday,
				thursday,
				friday,
				saturday,
				sunday,	
			}
			...
		}
	}
**/

const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const tableValues = ["Rank", "Member", "Role", "Trophies", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Raw Gains", "Adjusted Gains" /**, "Ballots"**/];

const clubs = ["BetterBrawlers", "BestBrawlers", "BackupBrawlers", "BabyBrawlers", "BuddyBrawlers", "BrazenBrawlers"];
const clubConfig = [
	{
		schedule: '0 */3 * * *',
		url: process.env.BETTER_BRAWLERS,
		token: process.env.BETTER_TOKEN,
		proxy: process.env.QUOTAGUARDSTATIC_URL,
		proxySocks: false,
	},
	{
		schedule: '1 */6 * * *',
		url: process.env.BEST_BRAWLERS,
		token: process.env.BEST_TOKEN,
		proxy: process.env.FIXIE_URL,
		proxySocks: false,
	},
	{
		schedule: '2 */6 * * *',
		url: process.env.BACKUP_BRAWLERS,
		token: process.env.BACKUP_TOKEN,
		proxy: process.env.FIXIE_URL,
		proxySocks: false,
	},
	{
		schedule: '3 */6 * * *',
		url: process.env.BABY_BRAWLERS,
		token: process.env.BABY_TOKEN,
		proxy: process.env.FIXIE_URL,
		proxySocks: false,
	},
	{
		schedule: '4 */6 * * *',
		url: process.env.BUDDY_BRAWLERS,
		token: process.env.BUDDY_TOKEN,
		proxy: process.env.FIXIE_URL,
		proxySocks: false,
	},
	{
		schedule: '5 */8 * * *',
		url: process.env.BRAZEN_BRAWLERS,
		token: process.env.BRAZEN_TOKEN,
		proxy: process.env.FIXIE_SOCKS_HOST,
		proxySocks: true,
	},
];

/**
	{
		schedule: ,
		url: ,
		token: ,
		proxy: ,
		proxySocks: false,
	},
 */

function compensation(gains, trophies){
	return gains > 0 ? Math.floor(trophies/1000) * 25:0;
}

function tally(gains, trophies){
	var d;
	if (trophies < 10000){
		d = 400;
	}
	else if (trophies < 20000){
		d = 300;
	}
	else if (trophies < 30000){
		d = 200;
	}
	else{
		d = 100;
	}

	return Math.max(Math.floor(gains/d), 0);
}

// Mail results to admins
async function sendMail(members, club, total, clubDetails){
	var transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
		  user: process.env.EMAIL,
		  pass: process.env.EMAIL_PASSWORD,
		},
	});

	var time = new Date();
	var mailDetails = {
		from: `BB Bot <${process.env.EMAIL}>`,
		bcc: process.env.RECIEVERS,
		subject: "Weekly Trophy Pushing Results - " + club,
		//text: "",
		html: `As of (MM/DD/YYYY) ${time.getMonth() + 1}/${time.getDate()}/${time.getFullYear()}   ${time.getHours()}:${time.getMinutes() < 10 ? "0" + time.getMinutes(): time.getMinutes()}, timezone: ${process.env.TZ ?? "UTC"}`
	};

	var consoleDetails = mailDetails.html + "\n,";
	mailDetails.html += 
	`<table style=\"border: 1px black solid;border-collapse: collapse;border-spacing: 5px;\">
	<tr style=\"border: 1px black solid;border-collapse: collapse;border-spacing: 5px;\">`;
	
	var k = ["", clubDetails.name, clubDetails.role, clubDetails.trophies, clubDetails.monday - clubDetails.start, clubDetails.tuesday - clubDetails.monday, 
		clubDetails.wednesday - clubDetails.tuesday, clubDetails.thursday - clubDetails.wednesday, clubDetails.friday - clubDetails.thursday, clubDetails.saturday - clubDetails.friday, clubDetails.sunday - clubDetails.saturday, clubDetails.trophies - clubDetails.start];

	for (let i = 0; i < k.length; ++i){
		mailDetails.html += "<td style=\"border: 1px black solid;padding: 5px; border-collapse: collapse;border-spacing: 5px;\">" + k[i] + "</td>";
		consoleDetails += k[i] + ",";
	}	
	consoleDetails += `${total}\n`;
	mailDetails.html+= `<td style=\"border: 1px black solid;padding: 5px; border-collapse: collapse;border-spacing: 5px;\">${total}</td></tr>`;
	mailDetails.html += 
	`<tr style=\"border: 1px black solid;border-collapse: collapse;border-spacing: 5px;\">`
	for (var i = 0; i < tableValues.length; ++i){
		mailDetails.html += "<td style=\"border: 1px black solid;padding: 5px; border-collapse: collapse;border-spacing: 5px;\">" + tableValues[i] + "</td>";
		consoleDetails += tableValues[i] + ",";
	}	
	consoleDetails += "\n";
	mailDetails.html+= `</tr>`;
	
	for (var i = 0; i < members.length; ++i){
		mailDetails.html += `<tr style=\"border: 1px black solid;border-collapse: collapse;border-spacing: 5px;\">`;
		var member = members[i];
		var k = [i + 1, member.name, member.role, member.trophies, member.monday - member.start, member.tuesday - member.monday, 
		member.wednesday - member.tuesday, member.thursday - member.wednesday, member.friday - member.thursday, member.saturday - member.friday, member.sunday - member.saturday, member.trophies - member.start, member.trophies - member.start + compensation(member.trophies - member.start, member.trophies)/**, tally(member.trophies - member.start, member.trophies)**/];
		for (var x = 0; x < k.length; ++x){
			consoleDetails += k[x] + ",";
			mailDetails.html += `<td style=\"border: 1px black solid;padding: 5px; border-collapse: collapse;border-spacing: 5px;\">${k[x]}</td>`;
		}
		consoleDetails += "\n";
		mailDetails.html += "</tr>"
	}

	console.log(consoleDetails);
	transporter.sendMail(mailDetails, function(error, info){
		if (error){
			console.log(error);
		} else {
			console.log("Email sent to " + process.env.RECIEVERS + ": " + info.response);
		}
	});
}

function whichDay(){
	let d = new Date();
	if (d.getDay() == 0){
		return 7;
	}
	
	if (d.getDay() == 1){
		return d.getDay();
	}

	d.setHours(d.getHours() - 1);
	return d.getDay();
}

function setMember(member, club){
	// Day of the Week
	let d = whichDay();

	mongoClient.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true}, async function(err, db){
		if (err){
			console.log(err);
		}

		let dbo = db.db("BB");
		let id = member.tag;
		let filter = { tag: id };

		if(await dbo.collection(club).countDocuments(filter, {limit: 1})){
			// Member already set
			var obj = {
				name: member.name,
				trophies: member.trophies,
				role: member.role,
			};
			obj[days[d - 1]] = member.trophies;

			dbo.collection(club).updateOne(filter, { $set: obj }, function(err, res) {
				if (err){console.log(err);}

				console.log(`Updated member ${member.name} with ID ${id} in club ` + club);
			});
		}
		else{
			// Create Member Document
			var obj = {
				tag: id, 
				name: member.name, 
				start: member.trophies, 
				trophies: member.trophies, 
				role: member.role, 
				monday: -1, tuesday: -1, wednesday: -1, thursday: -1, friday: -1, saturday: -1, sunday: -1 
			};

			for (var i = 0; i < d; ++i){
				obj[days[i]] = member.trophies;
			}

			dbo.collection(club).insertOne(obj, function(err, res) {
				if (err){console.log(err);}
				console.log(`Added member ${member.name} with ID ${id} in club ${club}`);
			});
		}
		setTimeout(function(){
			db.close();
		}, 500);
	});
}

async function update(club, proxy, socks=false){
	let proxyAgent = socks ? new socksProxyAgent(proxy): new httpsProxyAgent(proxy);
	let clubTag, token;

	let exists = false;
	for (let i = 0; i < clubs.length; ++i){
		if (club == clubs[i]){
			clubTag = clubConfig[i].url;
			token = clubConfig[i].token;
			exists = true;
			break;
		}
	}

	if (!exists){
		console.log(`ERROR (update): No club of name ${club} exists`);
		return;
	}

	fetch(clubTag, {
		agent: proxyAgent,
		method: "GET",
		headers: {
			Authorization: "Bearer " + token,
			"Content-Type": "application/json"
		}
	}).then(res => res.json()).then(res => {
		console.log("Updated members for " + club);

		let clubInfo = [];
		let members = res.members;

		// Transform object property names to strings for JSON
		for (i = 0; i < members.length; ++i){
			let x = members[i];
			clubInfo.push({'tag': x.tag, 'name': x.name, 'trophies': x.trophies, 'role': x.role});
		}

		// Update MongoDB Database
		for (var i = 0; i < clubInfo.length; ++i){
			setMember(clubInfo[i], club);
		}

		let clubData = {
			'tag': "CLUB",
			'name': club,
			'trophies': res.trophies,
			'role': "CLUB"
		};
		setMember(clubData, club);
	}).catch(e => {
		console.log(e);
	});
}

function reset(club){
	mongoClient.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true}, async function(err, db){
		if (err){
			throw err;
		}
		let dbo = db.db("BB");
		// Sends the email
		dbo.collection(club).find({}).toArray(function (err, result) {
	        if (err) {
	            console.log(err);
	        } else {
	        	let clubDetails;
	        	for (let i = 0; i < result.length; ++i){
					if (result[i].role == "CLUB"){
						clubDetails = result[i];
						result.splice(i, 1);
						break;
					}
				}
	        	result.sort(function (a, b){
					return (b.trophies - b.start + compensation(b.trophies - b.start, b.trophies)) - (a.trophies - a.start + compensation(a.trophies - a.start, a.trophies));
				});
				let total = 0;
				for (let i = 0; i < result.length; ++i){
					total += result[i].trophies - result[i].start;
				}
	            sendMail(result, club, total, clubDetails);
	        }
	    })

	    setTimeout(function(){
			db.close();
		}, 500);
	});
}

function deleteResults(club){
	mongoClient.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true}, async function(err, db){
		if (err){
			throw err;
		}
		let dbo = db.db("BB");

		dbo.collection(club).deleteMany({});
		console.log("Deleted all docs in the " + club + " MongoDB collection");
		setTimeout(function(){
			db.close();
		}, 500);
	});
}

const port = process.env.PORT || 3000;

var clubAPI = new Array(clubs.length);

/** 
async function fetchMongoData(club){
	const db = await mongoClient.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true});
	const dbo = db.db("BB");
	const result = dbo.collection(club).find({}).toArray();

	return JSON.stringify(await result);
}

(async ()=>{
	let clubDBPromise = [];
	for (let i = 0; i < clubs.length; ++i){
		clubDBPromise.push(fetchMongoData(clubs[i]));
	}
	let clubDB = await Promise.resolve(clubDBPromise);
	for (let i = 0; i < clubs.length; ++i){
		clubAPI[i] = clubDB[i];
	}
})();
*/

http.createServer(function(req, res){
	res.setHeader('Access-Control-Allow-Origin', 'https://1e9end.github.io');
	// res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Request-Method', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
	res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');
    
	const baseURL = 'http://' + req.headers.host + '/';
  	let {pathname} = new URL(req.url, baseURL);
	pathname = pathname.substring(1);

    if (req.method === "POST") {
		let data = "";
		req.on('data', (chunk) => {
			data += chunk.toString();
			// DDoS Protection
			if (data.length > 1e6){
				console.log(`WARNING: Recieved giant data POST`);
				req.socket.destroy();
			}
		});

		req.on('end', () => {
			if (data[0] != '[' || data[data.length - 1] != ']'){
				console.log("ERROR: Clipped POST data:\n");
				console.log(data);
			}

			for (let i = 0; i < clubs.length; ++i){
				if (pathname == clubs[i]){
					clubAPI[i] = data;
					break;
				}
			}

			res.end(data);
		});
    }
    else{
    	for (let i = 0; i < clubs.length; ++i){
			if (pathname == clubs[i]){
				res.end(clubAPI[i]);
				break;
			}
		}
	}

    console.log("Updated HTTP server on path /" + pathname);
}).listen(port);

async function postData(club){
	mongoClient.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true}, function(err, db){
		if (err){
			console.log(err);
		}
		let dbo = db.db("BB");
		dbo.collection(club).find({}).toArray(function (err, result) {
			if (err) {
				console.log(err);
			}

			axios.post("http://localhost:3000/" + club, JSON.stringify(result))
			.catch(e => {
				console.log(e);
			});
		});

		setTimeout(function(){
			db.close();
		}, 500);
	});
}

for (let i = 0; i < clubs.length; ++i){
	postData(clubs[i]);
}

function trophyLeagueReset(club){
	let d = new Date().getDay();
	if (d == 0){
		d = 7;
	}
	mongoClient.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true}, async function(err, db){
		if (err){
			throw err;
		}
		let dbo = db.db("BB");
		// Sends the email
		dbo.collection(club).find({}).toArray(function (err, result) {
	        if (err) {
	            console.log(err);
	        } else {
	        	for (let i = 0; i < result.length; ++i){
					let member = result[i];
					if (member.trophies >= member.start || member.tag == "CLUB"){
						continue;
					}
					let filter = {tag: member.tag};
					let obj = {
						start: member.trophies
					};
					for (let x = 0; x < d; ++x){
						obj[days[x]] = member.trophies;
					}
					let newvalues = { $set: obj };
					dbo.collection(club).updateOne(filter, newvalues, function(err, res) {
						if (err) throw err;
					});
					console.log(`Trophy league resetted member ${member.name} with ID ${member.tag} in club ` + club);
				}
	        }
	    });
	    setTimeout(function(){
			db.close();
		}, 1000);
	});
}

/**
for (var i in clubs){
	trophyLeagueReset(clubs[i]);
}
**/

/** Normal Updates **/
for (let i = 0; i < clubs.length; ++i){
	cron.schedule(clubConfig[i].schedule, ()=>{
		update(clubs[i], clubConfig[i].proxy, clubConfig[i].proxySocks);
	});
}

cron.schedule('6 */1 * * *', ()=>{
	for (let i = 0; i < clubs.length; ++i){
		postData(clubs[i]);
	}
});

cron.schedule('50 23 * * SUN', ()=>{
	for (let i = 0; i < clubs.length; ++i){
		update(clubs[i], clubConfig[i].proxy, clubConfig[i].proxySocks);
	}
});

cron.schedule('55 23 * * SUN', ()=>{
	for (let i = 0; i < clubs.length; ++i){
		reset(clubs[i]);
	}
});

cron.schedule('58 23 * * SUN', ()=>{
	for (let i = 0; i < clubs.length; ++i){
		deleteResults(clubs[i]);
	}
});