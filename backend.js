require("dotenv").config();
const fetch = require("node-fetch");
const http = require("http");
const url = require("url");
const mongo = require("mongodb");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
const axios = require("axios");
const httpsProxyAgent = require("https-proxy-agent");
const socksProxyAgent = require("socks-proxy-agent");

// MongoDB Database
const mongoClient = mongo.MongoClient;

/**
	MongoDB Collection structure
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
const clubs = ["BetterBrawlers", "BestBrawlers", "BackupBrawlers", "BabyBrawlers", "BuddyBrawlers", "BrazenBrawlers"];
const tableValues = ["Rank", "Member", "Role", "Trophies", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Raw Gains", "Adjusted Gains"/**, "Ballots"**/];

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

function setMember(member, club){
	// Day of the Week
	var nd = new Date();
	var d;
	if (nd.getDay() == 0){
		d = 7;
	}
	else if (nd.getDay() == 1){
		d = nd.getDay();
	}
	else{
		nd.setHours(nd.getHours() - 1);
		d = nd.getDay();
	}
	mongoClient.connect(process.env.MONGO_URI, async function(err, db){
		if (err){
			throw err;
		}
		var dbo = db.db("BB");
		var id = member.tag;
		var filter = { tag: id };
		if(await dbo.collection(club).countDocuments(filter, {limit: 1})){
			// Member already set
			var obj = {
				name: member.name,
				trophies: member.trophies,
				role: member.role,
			};
			obj[days[d - 1]] = member.trophies;
			var newvalues = { $set: obj };
			dbo.collection(club).updateOne(filter, newvalues, function(err, res) {
				if (err){console.log(err);}
				console.log(`Updated member ${member.name} with ID ${id} in club ` + club);
			});
		}
		else{
			// Create Member Document
			var obj = { tag: id, name: member.name, start: member.trophies, trophies: member.trophies, role: member.role, monday: -1, tuesday: -1, wednesday: -1, thursday: -1, friday: -1, saturday: -1, sunday: -1 };
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
	var proxyAgent = socks ? new socksProxyAgent(proxy): new httpsProxyAgent(proxy);
	var clubTag;
	var token;
	switch(club){
		case "BetterBrawlers":
			clubTag = process.env.BETTER_BRAWLERS;
			token = process.env.TOKEN;
		break;
		case "BestBrawlers":
			clubTag = process.env.BEST_BRAWLERS;
			token = process.env.BEST_TOKEN;
		break;
		case "BackupBrawlers":
			clubTag = process.env.BACKUP_BRAWLERS;
			token = process.env.BACKUP_TOKEN;
		break;
		case "BabyBrawlers":
			clubTag = process.env.BABY_BRAWLERS;
			token = process.env.BABY_TOKEN;
		break;
		case "BuddyBrawlers":
			clubTag = process.env.BUDDY_BRAWLERS;
			token = process.env.BUDDY_TOKEN;
		break;
		case "BrazenBrawlers":
			clubTag = process.env.BRAZEN_BRAWLERS;
			token = process.env.BRAZEN_TOKEN;
		break;
		default:
			console.log("No club of name " + club + " exists.");
			return;
	}
	
	console.log(clubTag);
	console.log(token);

	fetch(clubTag, {
		agent: proxyAgent,
		method: "GET",
		headers: {
			Authorization: "Bearer " + token,
			"Content-Type": "application/json"
		}
	}).then(res => res.json()).then(async (res) => {
		console.log(res);
		console.log("Updated members for " + club);
		let clubTrophies = res.trophies;
		let clubInfo = [];
		res = res.members;
		// Transform object property names to strings for JSON
		for (i = 0; i < res.length; ++i){
			let x = res[i];
			clubInfo.push({'tag': x.tag, 'name': x.name, 'trophies': x.trophies, 'role': x.role});
		}
		// Update MongoDB Database
		for (var i = 0; i < clubInfo.length; ++i){
			setMember(clubInfo[i], club);
		}
		let clubData = {
			'tag': "CLUB",
			'name': club,
			'trophies': clubTrophies,
			'role': "CLUB"
		};
		setMember(clubData, club);
	}).catch(e => {
		console.log(e);
	});
}

function reset(club){
	mongoClient.connect(process.env.MONGO_URI, async function(err, db){
		if (err){
			throw err;
		}
		var dbo = db.db("BB");
		// Sends the email
		dbo.collection(club).find({}).toArray(function (err, result) {
	        if (err) {
	            console.log(err);
	        } else {
	        	let clubDetails;
	        	for (var i = 0; i < result.length; ++i){
					if (result[i].role == "CLUB"){
						clubDetails = result[i];
						result.splice(i, 1);
						break;
					}
				}
	        	result.sort(function (a, b){
					return (b.trophies - b.start + compensation(b.trophies - b.start, b.trophies)) - (a.trophies - a.start + compensation(a.trophies - a.start, a.trophies));
				});
				var total = 0;
				for (var i = 0; i < result.length; ++i){
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
	mongoClient.connect(process.env.MONGO_URI, async function(err, db){
		if (err){
			throw err;
		}
		var dbo = db.db("BB");

	    // Deletes all docs
		dbo.collection(club).deleteMany({});
		console.log("Deleted all docs in the " + club + " MongoDB collection");
		setTimeout(function(){
			db.close();
		}, 500);
	});
}

var port = process.env.PORT || 3000;

var better;
mongoClient.connect(process.env.MONGO_URI, async function(err, db){
	var dbo = db.db("BB");
	dbo.collection("BetterBrawlers").find({}).toArray(function (err, result) {
        if (err) {
            console.log(err);
        } else {
            better = JSON.stringify(result);
        }
    });
	setTimeout(function(){
		db.close();
	}, 500);
});

var best;
mongoClient.connect(process.env.MONGO_URI, async function(err, db){
	var dbo = db.db("BB");
	dbo.collection("BestBrawlers").find({}).toArray(function (err, result) {
        if (err) {
            console.log(err);
        } else {
            best = JSON.stringify(result);
        }
    });
	setTimeout(function(){
		db.close();
	}, 500);
});

var backup;
mongoClient.connect(process.env.MONGO_URI, async function(err, db){
	var dbo = db.db("BB");
	dbo.collection("BackupBrawlers").find({}).toArray(function (err, result) {
        if (err) {
            console.log(err);
        } else {
            backup = JSON.stringify(result);
        }
    });
	setTimeout(function(){
		db.close();
	}, 500);
});

var baby;
mongoClient.connect(process.env.MONGO_URI, async function(err, db){
	var dbo = db.db("BB");
	dbo.collection("BabyBrawlers").find({}).toArray(function (err, result) {
        if (err) {
            console.log(err);
        } else {
            baby = JSON.stringify(result);
        }
    });
	setTimeout(function(){
		db.close();
	}, 500);
});

var buddy;
mongoClient.connect(process.env.MONGO_URI, async function(err, db){
	var dbo = db.db("BB");
	dbo.collection("BuddyBrawlers").find({}).toArray(function (err, result) {
        if (err) {
            console.log(err);
        } else {
            buddy = JSON.stringify(result);
        }
    });
	setTimeout(function(){
		db.close();
	}, 500);
});
var brazen;
mongoClient.connect(process.env.MONGO_URI, async function(err, db){
	var dbo = db.db("BB");
	dbo.collection("BrazenBrawlers").find({}).toArray(function (err, result) {
        if (err) {
            console.log(err);
        } else {
            brazen = JSON.stringify(result);
        }
    });
	setTimeout(function(){
		db.close();
	}, 500);
});

http.createServer(function(req, res){
	res.setHeader('Access-Control-Allow-Origin', 'https://1e9end.github.io');
	//res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Request-Method', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
	res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');
    
    var pathname = url.parse(req.url).pathname;

    if (req.method === "POST") {
    	switch(pathname){
    		case "/BuddyBrawlers":
    			buddy = "";
		    	console.log("Recieved POST at " + pathname);
		    	req.on('data', (chunk) => {
				    buddy += chunk.toString();
				    // DDoS Protection
				    if (buddy.length > 1e6){
				    	console.log("Recieved giant data POST... Might be attack");
		                req.connection.destroy();
				    }
				});
				req.on('end', () => {
					if (buddy[0] != '[' || buddy[buddy.length - 1] != ']'){
						console.log("ERROR: Clipped POST data:\n");
						console.log(buddy);
					}
					res.end(buddy);
				});
			break;
    		case "/BabyBrawlers":
    			baby = "";
		    	console.log("Recieved POST at " + pathname);
		    	req.on('data', (chunk) => {
				    baby += chunk.toString();
				    // DDoS Protection
				    if (baby.length > 1e6){
				    	console.log("Recieved giant data POST... Might be attack");
		                req.connection.destroy();
				    }
				});
				req.on('end', () => {
					if (baby[0] != '[' || baby[baby.length - 1] != ']'){
						console.log("ERROR: Clipped POST data:\n");
						console.log(baby);
					}
					res.end(baby);
				});
			break;
			case "/BestBrawlers":
    			best = "";
		    	console.log("Recieved POST at " + pathname);
		    	req.on('data', (chunk) => {
				    best += chunk.toString();
				    // DDoS Protection
				    if (best.length > 1e6){
				    	console.log("Recieved giant data POST... Might be attack");
		                req.connection.destroy();
				    }
				});
				req.on('end', () => {
					if (best[0] != '[' || best[best.length - 1] != ']'){
						console.log("ERROR: Clipped POST data:\n");
						console.log(best);
					}
					res.end(best);
				});
			break;
    		case "/BackupBrawlers":
    			backup = "";
		    	console.log("Recieved POST at " + pathname);
		    	req.on('data', (chunk) => {
				    backup += chunk.toString();
				    // DDoS Protection
				    if (backup.length > 1e6){
				    	console.log("Recieved giant data POST... Might be attack");
		                req.connection.destroy();
				    }
				});
				req.on('end', () => {
					if (backup[0] != '[' || backup[backup.length - 1] != ']'){
						console.log("ERROR: Clipped POST data:\n");
						console.log(backup);
					}
					res.end(backup);
				});
			break;
			case "/BrazenBrawlers":
    			brazen = "";
		    	console.log("Recieved POST at " + pathname);
		    	req.on('data', (chunk) => {
				    brazen += chunk.toString();
				    // DDoS Protection
				    if (brazen.length > 1e6){
				    	console.log("Recieved giant data POST... Might be attack");
		                req.connection.destroy();
				    }
				});
				req.on('end', () => {
					if (brazen[0] != '[' || brazen[brazen.length - 1] != ']'){
						console.log("ERROR: Clipped POST data:\n");
						console.log(brazen);
					}
					res.end(brazen);
				});
			break;
    		case "/BetterBrawlers":
    		default:
		    	better = "";
		    	console.log("Recieved POST at " + pathname);
		    	req.on('data', (chunk) => {
				    better += chunk.toString();
				    // DoS Protection
				    if (better.length > 1e6){
				    	console.log("Recieved giant data POST... Might be attack");
		                req.connection.destroy();
				    }
				});
				req.on('end', () => {
					if (better[0] != '[' || better[better.length - 1] != ']'){
						console.log("ERROR: Clipped POST data:\n");
						console.log(better);
					}
					res.end(better);
				});
		}
    }
    else{
    	switch (pathname){
    		case "/BabyBrawlers":
    			res.end(baby);
    		break;
    		case "/BestBrawlers":
    			res.end(best);
    		break;
    		case "/BackupBrawlers":
    			res.end(backup);
    		break;
    		case "/BuddyBrawlers":
				res.end(buddy);
			break;
			case "/BrazenBrawlers":
				res.end(brazen);
			break;
    		case "/BetterBrawlers":
    		default:
    			res.end(better);
    	}
	}
    console.log("Successfully updated HTTP server on path " + pathname + " at port " + port);
}).listen(port);

async function postData(club){
	var x;
	mongoClient.connect(process.env.MONGO_URI, async function(err, db){
		var dbo = db.db("BB");
		dbo.collection(club).find({}).toArray(function (err, result) {
			if (err) {
				console.log(err);
			} else {
				x = JSON.stringify(result);
			}
			axios.post("https://bb-trophytracker.herokuapp.com/" + club, x)
			.then(res => {
				console.log(`POSTed updated data at /` + club);
				//console.log(res);
			})
			.catch(error => {
				console.error(error);
			});
			/**
			const options = {
				hostname: 'localhost',
				port: process.env.PORT || 3000,
				path: "/",
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': x.length
				}
			};

			const req = http.request(options, res => {
				//let data = '';
				console.log(`POST Status Code: ${res.statusCode}`);

			}).on('error', error => {
				console.error(error);
			});

			req.write(x);
			req.end();
			**/
		});
		setTimeout(function(){
			db.close();
		}, 500);
	}).catch(e => {
		console.log(e);
	});
}

// Manual trophy league reset every 4 weeks
function trophyLeagueReset(club){
	var d = new Date().getDay();
	if (d == 0){
		d = 7;
	}
	mongoClient.connect(process.env.MONGO_URI, async function(err, db){
		if (err){
			throw err;
		}
		var dbo = db.db("BB");
		// Sends the email
		dbo.collection(club).find({}).toArray(function (err, result) {
	        if (err) {
	            console.log(err);
	        } else {
	        	for (var i = 0; i < result.length; ++i){
					let member = result[i];
					if (member.trophies >= member.start || member.tag == "CLUB"){
						continue;
					}
					var filter = {tag: member.tag};
					var obj = {
						start: member.trophies
					};
					for (var x = 0; x < d; ++x){
						obj[days[x]] = member.trophies;
					}
					var newvalues = { $set: obj };
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
cron.schedule('0 */3 * * *', ()=>{
	update("BetterBrawlers", process.env.QUOTAGUARDSTATIC_URL);
});
cron.schedule('1 */6 * * *', ()=>{
	update("BestBrawlers", process.env.FIXIE_URL);
});
cron.schedule('2 */6 * * *', ()=>{
	update("BackupBrawlers", process.env.FIXIE_URL);
});
cron.schedule('3 */6 * * *', ()=>{
	update("BabyBrawlers", process.env.FIXIE_URL);
});
cron.schedule('4 */6 * * *', ()=>{
	update("BuddyBrawlers", process.env.FIXIE_URL);
});
cron.schedule('5 */8 * * *', ()=>{
	update("BrazenBrawlers", process.env.FIXIE_SOCKS_HOST, true);
});

// Update http server every hr at :06
cron.schedule('6 */1 * * *', ()=>{
	postData("BetterBrawlers");
	postData("BestBrawlers");
	postData("BackupBrawlers");
	postData("BabyBrawlers");
	postData("BuddyBrawlers");
	postData("BrazenBrawlers");
});

/** End of week updates **/
cron.schedule('50 23 * * SUN', ()=>{
	update("BetterBrawlers", process.env.QUOTAGUARDSTATIC_URL);
	update("BestBrawlers", process.env.FIXIE_URL);
	update("BackupBrawlers", process.env.FIXIE_URL);
	update("BabyBrawlers", process.env.FIXIE_URL);
	update("BuddyBrawlers", process.env.FIXIE_URL);
	update("BrazenBrawlers", process.env.FIXIE_SOCKS_HOST, true);
});

cron.schedule('55 23 * * SUN', ()=>{
	reset("BetterBrawlers");
	reset("BestBrawlers");
	reset("BackupBrawlers");
	reset("BabyBrawlers");
	reset("BuddyBrawlers");
	reset("BrazenBrawlers");
});

cron.schedule('58 23 * * SUN', ()=>{
	deleteResults("BetterBrawlers");
	deleteResults("BestBrawlers");
	deleteResults("BackupBrawlers");
	deleteResults("BabyBrawlers");
	deleteResults("BuddyBrawlers");
	deleteResults("BrazenBrawlers");
});