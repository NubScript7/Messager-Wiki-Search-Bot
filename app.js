const express = require('express');
const asyncRouter = require("express-promise-router")();
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());
app.use(asyncRouter);
app.set('view engine',"ejs");

const axios = require("axios");

function help(sender_psid) {
let response = `
      the list of commands:          
        !help - prints cmd list
        !exit - shut down server (emergency)
  `
  callSendAPI(sender_psid, response);
}

const requests = [];

const users = [];
const administratorPassword = process.env.ADMINISTRATOR_PASSWORD || null; // if no administrator password was specified, then no sudo command can be done.
let sudoExit = 0;
const sudoExitTries = {};

async function exit(psid) {
	if(!sudoExitTries[psid]) {
		sudoExitTries[psid] = {
			tries: 0
		}
	}
	if (sudoExitTries[psid]?.tries <= 5) {
		await callSendAPI(psid, "Entering sudo mode: EXIT");
		await callSendAPI(psid, "Please enter the administrator password:");
		sudoExit = 1;
		sudoExitTries[psid].tries += 1;
	} else if(sudoExitTries[psid]?.tries > 5) {
		callSendAPI(psid, "Limited tries! forbidden.");
	}
}

/* autokill feature */

let messagesCount = 0;

let cmdList = {
  "!help": help,
  "!exit": exit
}

async function requestSync(url,method="GET",body,params) {
  if (method == "POST") {
  	const response = await axios.post(url,body,params);
  	return response.data;
  } else if (method == "GET") {
  	const response = await axios.get(url);
  	return response.data;
  } else {
  	throw new Error(`method ${method} is not a valid http method`);
  }
}

/*  wikipedia mediapedia API  */

const msgHistory = {};

function removeTags(a) {
  return output = a.replace(/<[^>]*>/g, '').replace(/\./g,'.\n');
}

// Function to fetch search suggestions from Wikipedia API
async function getSuggestion(keyword) {
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&utf8=1&srsearch=${encodeURIComponent(keyword)}`;

  try {
    const response = await requestSync(apiUrl);
    return response.query.search.map(result => result.title);
  } catch (error) {
    return [];
  }
}

app.get("/msg-log",(req,res)=>{
	res.json(msgHistory);
})

let appMode = "ACTIVE";
app.get("/toggle-mode", (req,res) => {
	appMode = appMode == "ACTIVE" ? "INACTIVE" : "ACTIVE";
	res.send(`Succesfully toggled app mode: ${appMode}`);
})

app.get('/',(req,res)=>{
	res.send("=}");
})

app.get("/users",(req,res)=>{
	res.json(users);
})

app.get("/requests",(req,res)=>{
	res.json(requests);
})

app.get("/kill",(req,res)=>{
	res.send("APP KILLED");
	process.exit(1);
})

app.get('/msg-hook',(req,res) => {
	res.json(messagesCount);
})

asyncRouter.post("/webhook", async (req,res) => {

	if(req.body.object === 'page'){
	
	for (const entry of req.body.entry) {
	res.send("EVENT_RECEIVED");
	requests.push(entry);
	const user = entry.messaging[0];
	const psid = user.sender.id;
	const message = user.message?.text;
	const history = msgHistory[psid];
	if ( !message )return;
	if (!users.includes(psid))users.push(psid);
	
    if (appMode == "INACTIVE") {
		await callSendAPI(psid, "INTERNAL: app is in inactive mode.");
		return;
	}
    
	if ( message[0] == "!" ) {
		typeof cmdList[message] == 'function' ? cmdList[message](psid): callSendAPI(psid, "I dont think that is a valid command...\nto see the list of commands type !help");
	} else {
		
		if (sudoExit == 1) {
			//for emergency exit
			sudoExit = 0;
			if(typeof administratorPassword == message && administratorPassword == message){
				for(const user of users) {
					await callSendAPI(user, "INTERNAL: ADMINISTRATOR CALLED EXIT ALL HISTORY WILL BE DELETED.");
				}
			} else {
				await callSendAPI(psid, "INVALID PASSWORD");
			}
		}else if (!history || history?.gate != 1) {
			console.log("on gate 1",psid);
			// gate 1, get user message and search for keywords related to the message
			const suggestions = await getSuggestion(message);
			if (suggestions.length === 0)return callSendAPI(psid, "No suggestion found from given keyword.");
			let responseString = 'Search Suggestions:\n1. ';
			responseString += suggestions.reduce((p,n,i) => `${p}\n${i+1}. ${n}`);
			responseString += "\n\nSelect a number to search.";
			await callSendAPI(psid, responseString);
			
			msgHistory[psid] = {
				gate: 1,
				suggestions
			}
		} else if (history?.gate == 1 && history?.suggestions.length >= 1) {
			console.log("on gate 2",psid);
			//gate 2, get user message and previous suggestion to get the final search use
			const searchIndex = parseInt(message);
			if (isNaN(searchIndex))return callSendAPI(psid, "Sorry! Invalid number, please pick another one.");
			const selectedTitle = history.suggestions[searchIndex - 1];
        	if (!selectedTitle)return callSendAPI(psid, "Sorry! no content was found, please try again.");
        	
        	const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&titles=${encodeURIComponent(selectedTitle)}`;
        	try {
        		const response = await requestSync(apiUrl);
				const page = Object.values(response.query.pages)[0];

        		const introWithoutTags = removeTags(page.extract);

        		callSendAPI(psid, `${page.title}\n\n${introWithoutTags.trim()}`);
        	} catch (error) {
        		callSendAPI(psid, "INTERNAL: Error fetching article content.");
        	}
        	
        	delete msgHistory[psid];
		
		}
        
	}
    }
    
  }else{
    res.sendStatus(404);
  }
});

app.get("/webhook", (req, res) => {
  let verifyToken = process.env.FB_PAGE_ACCESS_TOKEN;
// Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent is correct
    if (mode === "subscribe" && token === verifyToken) {
      // Respond with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(403);
  }
});

async function callSendAPI(sender_psid,res) {
	if (messagesCount >= 50)return;
	messagesCount += 1;
	
	let request_body = {
		recipient: {
			id: sender_psid
		},
		message: {
			text: res || "INTERNAL: default return, received data was empty"
		}
	}
	
	const response = await axios.post(
		"https://graph.facebook.com/v2.6/me/messages",
		request_body,
		{
			params: {
				access_token: process.env.FB_PAGE_ACCESS_TOKEN
			}/*,{
				'Content-Type': 'application/json'
			}*/
		}
	)
	
	return response.data;
}


app.listen(process.env.PORT || 3000,()=>console.log('service online'));
        
