import dotenv from "dotenv";
dotenv.config();
import path from "path";
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import fs from "fs";
import ejs from "ejs";
import express from "express";
import mongodb from "mongodb";
import fetch from "node-fetch";
import axios from "axios";
import nodemailer from "nodemailer";
import cron from "node-cron";
import httpsProxyAgent from "https-proxy-agent";
import socksProxyAgent from "socks-proxy-agent";

var app = express();
const {MongoClient} = mongodb;

const tableValues = ["Rank", "Member", "Role", "Trophies", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Raw Gains", "Adjusted Gains"];
const apiURL = "https://api.brawlstars.com/v1/clubs/%23";

import clubConfig from "./clubConfig.mjs";
import orgConfig from "./orgConfig.mjs";

function adj(gains, trophies){
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

function whichWeek(){
	let now = new Date(2021, 7, 16, 8, 0, 0);
	let anchorDate = new Date(Date.UTC(2021, 6, 26, 8, 0, 0));
	return Math.floor(((now - anchorDate) % 2.419e+9)/6.048e+8);
}

function parseMember(member){
	let r;
	switch(member.role){
		case "member":
			r = "Member";
		break;
		case "senior":
			r = "Senior";
		break;
		case "vicePresident":
			r = "Vice President";
		break;
		case "president":
			r = "President";
		break;
		case "CLUB":
			r = "Club";
	}
	let ans = {
		name: member.name,
		role: r,
		start: member.start,
		trophies: member.trophies,
		stats: [],
		raw: member.trophies - member.start,
		total: member.trophies - member.start + adj(member.trophies - member.start, member.trophies),
		icon: member.icon,
		color: member.nameColor,
	};

	let last = member.start;
	for (let i = 0; i < member.stats.length; ++i){
		let v = member.stats[i];
		if (v == -1){
			ans.stats.push("TBD");
			continue;
		}

		ans.stats.push(v - last);
		last = v;
	}

	return ans;
}

const port = process.env.PORT || 3000;

var clubAPI = {};

app.use(express.static("public"));
app.set('view engine', 'ejs');

app.locals = {
	memberStat: function(c, text){
		let template = fs.readFileSync('./public/functions/memberStat.ejs', 'utf-8');
		return ejs.render(template, {c: c, text: text});
	},
	orgNav: function(org, clubs){
		let template = fs.readFileSync('./public/functions/orgNav.ejs', 'utf-8');
		return ejs.render(template, {org: org, clubs: clubs});
	}
};

app.get('/', (req, res) => {
	res.redirect(`/org/bb`);
	return;
	res.render('pages/index');
});

app.get('/about', (req, res) => {
	res.redirect(`/org/bb`);
	return;
	res.render('pages/about');
});

app.get('/club/:club', async (req, res) => {
	let {club} = req.params;
	if (club in clubConfig){
		res.render('pages/club', clubAPI[club]);
		return;
	}

	res.end(`No club with tag #${club} found`);
});

app.get('/org/:org', async (req, res) => {
	let {org} = req.params;
	org = org.toLowerCase();
	if (org in orgConfig){
		let main = orgConfig[org].main;
		let clubs = [];
		for (let i = 0; i < orgConfig[org].clubs.length; ++i){
			let c = orgConfig[org].clubs[i];
			clubs.push([c, clubAPI[c].club.name]);
		}
		
		res.render('pages/org', {org: orgConfig[org].name, clubs: clubs, club: clubAPI[main].club, members: clubAPI[main].members, history: clubAPI[main].history});
		return;
	}

	res.end(`No organization with name ${org} found`);
});

app.get('/org/:org/:club', async (req, res) => {
	let {org, club} = req.params;
	org = org.toLowerCase();
	club = club.toUpperCase();
	if (org in orgConfig){
		if (orgConfig[org].clubs.includes(club)){
			let clubs = [];
			for (let i = 0; i < orgConfig[org].clubs.length; ++i){
				let c = orgConfig[org].clubs[i];
				clubs.push([c, clubAPI[c].club.name]);
			}
			res.render('pages/org', {org: orgConfig[org].name, clubs: clubs, club: clubAPI[club].club, members: clubAPI[club].members, history: clubAPI[club].history});
		} else {
			res.redirect(`/org/${org}`);
		}
		return;
	}

	res.end(`No organization with name ${org} found`);
});


app.get('*', function(req, res) {
    res.redirect('/');
});

app.listen(port);

function createRow(index, m){
	let k = [index, m.name, m.role, m.trophies];
	let last = m.start;
	for (let x = 0; x < m.stats.length; ++x){
		if (m.stats[x] == -1){
			k.push("-")
			continue;
		}
		k.push(m.stats[x] - last);
		last = m.stats[x];
	}
	return k;
}

function appendRow(row){
	let c = "", m = `<tr style=\"border: 1px black solid;border-collapse: collapse;border-spacing: 5px;\">`;
	
	for (var i = 0; i < row.length; ++i){
		m += "<td style=\"border: 1px black solid;padding: 5px; border-collapse: collapse;border-spacing: 5px;\">" + row[i] + "</td>";
		c += row[i] + ",";
	}	

	c += "\n";
	m += `</tr>`;

	return [c, m];
}

function sendMail({club, members}){
	let c = "", m = `<table style=\"border: 1px black solid;border-collapse: collapse;border-spacing: 5px;\">`;
	
	let total = 0;
	for (let i = 0; i < members.length; ++i){
		total += members[i].trophies - members[i].start;
	}

	// Club gains
	let k = createRow("", club)
	k.push("RAW: " + club.trophies - club.start, "PUSH: " + total);
	let clubRow = appendRow(k);
	c += clubRow[0]; m += clubRow[1];
	
	// Table header
	let headerRow = appendRow(tableValues);
	c += headerRow[0]; m += headerRow[1];

	// Member Gains
	for (let i = 0; i < members.length; ++i){
		let member = members[i];
		let k = createRow(i + 1, member);
		k.push(member.trophies - member.start, member.trophies - member.start + adj(member.trophies - member.start, member.trophies));

		let memberRow = appendRow(k);
		c += memberRow[0]; m += memberRow[1];
	}

	console.log(c);
	let transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
		  user: process.env.EMAIL,
		  pass: process.env.EMAIL_PASSWORD,
		},
	});

	let mailConfig = {
		from: `Brawltrack Bot <${process.env.EMAIL}>`,
		bcc: process.env.RECIEVERS,
		subject: "Trophy Gains Results - " + club.name,
		// text: "",
		html: m
	};

	transporter.sendMail(mailConfig, function(error, info){
		if (error){
			console.log(error);
		} else {
			console.log("Email sent to " + process.env.RECIEVERS + ": " + info.response);
		}
	});
}

async function postData(club){
	const client = await MongoClient.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }).catch(err => {
		console.log(err);
	});
	if (!client) {return;}
	try {
		const db = client.db("Brawltrack");
		let collection = db.collection(club);

		let members = await collection.find({}).toArray();
		let c;
		for (let i = 0; i < members.length; ++i){
			if (members[i].role == "CLUB"){
				c = members[i];
				members.splice(i, 1);
				--i;
				continue;
			}

			members[i] = parseMember(members[i]);
		}

		members.sort((a, b) => {
			return b.total - a.total;
		});

		const hdb = client.db("BrawltrackHistory");
		let hcollection = hdb.collection(club);

		let history = await hcollection.find({}).toArray();
		for (let i = 0; i < history.length; ++i){
			if (history[i].role == "CLUB"){
				history.splice(i, 1);
				--i;
				continue;
			}

			history[i] = parseMember(history[i]);
		}

		history.sort((a, b) => {
			return b.total - a.total;
		});

		clubAPI[club] = {
			club: c,
			members: members,
			history: history
		};
	} catch(e) {
		console.log("ERROR (postData): " + e);
	} finally {
		await client.close();
		return clubAPI[club];
	}
}

(async ()=> {
	let promiseArray = [];
	for (let i in clubConfig){
		promiseArray.push(postData(clubConfig[i].tag));
	}

	try {
		await Promise.all(promiseArray);
	} finally {
		console.log("Bootstrapped ClubAPI");
	}
	
})();

async function setMembers(members, club){
	const client = await MongoClient.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }).catch(err => {
		console.log(err);
	});
	if (!client) {return;}

	// Day of the Week
	let d = whichDay();
	
	try {
		const db = client.db("Brawltrack");
		let collection = db.collection(club);

		let promiseArray = [];
		let memberExistPromise = [];

		for (let i = 0; i < members.length; ++i){
			let member = members[i];
			memberExistPromise.push(collection.countDocuments({tag: member.tag}, {limit: 1}));
		}

		let memberExist = await Promise.all(memberExistPromise);

		for (let i = 0; i < members.length; ++i){
			let member = members[i];
			let filter = {tag: member.tag};
			let isClub = member.role == "CLUB";

			if(memberExist[i]){
				// Member already set
				let obj;
				if (isClub){
					obj = {
						description: member.description,
						trophies: member.trophies,
						requiredTrophies: member.requiredTrophies,
						type: member.type,
						badgeId: member.badgeId,
						role: member.role,
					};
				} else {
					obj = {
						name: member.name,
						trophies: member.trophies,
						role: member.role,
						nameColor: member.nameColor,
						icon: member.icon,
					};
				}
				obj[`stats.${d - 1}`] = member.trophies;

				promiseArray.push(collection.updateOne(filter, { $set: obj }));
			}
			else{
				// Create Member Document
				let obj;
				if (isClub){
					obj = {
						tag: member.tag,
						name: member.name,
						description: member.description,
						start: member.trophies,
						trophies: member.trophies,
						requiredTrophies: member.requiredTrophies,
						type: member.type,
						badgeId: member.badgeId,
						role: member.role,
						stats: []
					};
				}
				else {
					obj = {
						tag: member.tag, 
						name: member.name, 
						start: member.trophies, 
						trophies: member.trophies, 
						role: member.role, 
						nameColor: member.nameColor,
						icon: member.icon,
						stats: []
					};
				}

				for (let i = 0; i < 7; ++i){
					if (i < d){
						obj.stats.push(member.trophies);
						continue;
					}
					obj.stats.push(-1);
				}

				promiseArray.push(collection.insertOne(obj));
			}
		}

		await Promise.all(promiseArray);
	} catch(e){
		console.log("ERROR (setMembers): " + e);
	} finally {
		await client.close();
	}
}

async function update(club, proxy, socks=false){
	let proxyAgent = socks ? new socksProxyAgent(proxy): new httpsProxyAgent(proxy);
	let clubUrl = apiURL + club;
	let token;

	if (club in clubConfig){
		token = clubConfig[club].token;
	}
	else {
		console.log(`ERROR (update): No club of name ${club} exists`);
		return;
	}

	fetch(clubUrl, {
		agent: proxyAgent,
		method: "GET",
		headers: {
			Authorization: "Bearer " + token,
			"Content-Type": "application/json"
		}
	}).then(res => res.json()).then(async (res) =>  {
		let clubInfo = [];
		let members = res.members;

		for (let i = 0; i < members.length; ++i){
			let x = members[i];
			clubInfo.push({
				'tag': x.tag,
				'name': x.name,
				'trophies': x.trophies,
				'role': x.role,
				'nameColor': x.nameColor,
				'icon': x.icon?.id
			});
		}

		let clubData = {
			'tag': res.tag,
			'name': res.name,
			'description': res.description,
			'trophies': res.trophies,
			'requiredTrophies': res.requiredTrophies,
			'type': res.type,
			'badgeId': res.badgeId,
			'role': "CLUB"
		};

		clubInfo.push(clubData);
		try {
	 		await setMembers(clubInfo, club);
		} finally {
			console.log("Updated members for " + club);
		}

		postData(club);
	}).catch(e => {
		console.log(e);
	});
}

async function reset(club){	
	try {
		let c = await postData(club);

		sendMail(c);
	} catch(e){
		console.log("ERROR (reset): " + e);
	} finally {
		await client.close();
	}
}

async function deleteResults(club){
	const client = await MongoClient.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }).catch(err => {
		console.log(err);
	});
	if (!client) {return;}
	
	try {
		const db = client.db("Brawltrack");
		let collection = db.collection(club);
		
		let result = await collection.find({}).toArray();

		const hdb = client.db("BrawltrackHistory");
		let hcollection = hdb.collection(club);

		await hcollection.deleteMany({});
		await hcollection.insertMany(result);
		await collection.deleteMany({});
	} catch(e){
		console.log("ERROR (deleteResults): " + e);
	} finally {
		console.log("Deleted all docs and added to history in the " + club + " MongoDB collection");
		await client.close();
	}
}

async function trophyLeagueReset(club){
	let d = new Date().getDay();
	if (d == 0){
		d = 7;
	}
	const client = await MongoClient.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }).catch(err => {
		console.log(err);
	});
	if (!client) {return;}
	
	try {
		const db = client.db("Brawltrack");
		let collection = db.collection(club);

		let result = await collection.find({}).toArray();
		let promiseArray = [];
		for (let i = 0; i < result.length; ++i){
			let member = result[i];
			if (member.trophies >= member.start || member.tag == "CLUB"){
				continue;
			}
			let filter = {tag: member.tag};
			let obj = {
				start: member.trophies,
				stats: member.stats
			};
			for (let x = 0; x < d; ++x){
				obj.stats[x] = member.trophies;
			}
			promiseArray.push(collection.updateOne(filter, { $set: obj }));
			await Promise.all(promiseArray);

		}
	} catch(e){
		console.log("ERROR (trophyLeagueReset): " + e);
	} finally {
		console.log(`Trophy league resetted members in club ` + club);
		await client.close();
	}
}

/**
 * 
(async () => {
	let club = "";
	await update(clubConfig[club].tag, clubConfig[club].proxy, clubConfig[club].proxySocks ?? false);
})();

(async () => {
	let promiseArray = [];
	for (let i in clubConfig){
		promiseArray.push(trophyLeagueReset(clubConfig[i].tag));
	}

	await Promise.all(promiseArray);
})();
**/

if (process.env.PRODUCTION === "true"){
	for (let i in clubConfig){
		cron.schedule(clubConfig[i].schedule, async ()=>{
			await update(clubConfig[i].tag, clubConfig[i].proxy, clubConfig[i].proxySocks ?? false);
		});
	}

	cron.schedule('50 23 * * SUN', async ()=>{
		let promiseArray = [];
		for (let i in clubConfig){
			promiseArray.push(update(clubConfig[i].tag, clubConfig[i].proxy, clubConfig[i].proxySocks ?? false));
		}

		await Promise.all(promiseArray);
	});

	cron.schedule('55 23 * * SUN', async ()=>{
		let promiseArray = [];
		for (let i in clubConfig){
			promiseArray.push(reset(clubConfig[i].tag));
		}

		await Promise.all(promiseArray);
	});

	cron.schedule('58 23 * * SUN', async ()=>{
		let promiseArray = [];
		for (let i in clubConfig){
			promiseArray.push(deleteResults(clubConfig[i].tag));
		}

		await Promise.all(promiseArray);
	});
}