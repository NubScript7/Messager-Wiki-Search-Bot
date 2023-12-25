/*
environment variables
* FB_PAGE_ACCESS_TOKEN
*/

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
  `
  callSendAPI(sender_psid, response);
}

/* autokill feature */

let messagesCount = 0;

let cmdList = {
  "!help": help
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
  res.json(messageHistory);
})

app.get('/',(req,res)=>{
  res.send("=}");
})


app.get('/msg-hook',(req,res) => {
	res.json(message);
})

asyncRouter.post("/webhook", async (req,res) => {

	if(req.body.object === 'page'){
	
	for (const entry of req.body.entry) {
	// const entry = body.entry[0];
	const user = entry.messaging[0];
	const psid = user.sender.id;
	const message = user.message?.text;
	const history = msgHistory[psid];
	if ( !message )return;
      
	if ( message[0] == "!" ) {
		typeof cmdList[message] == 'function' ? cmdList[message](psid): callSendAPI(psid, "I dont think that is a valid command...\nto see the list of commands type !help");
	} else {

		if (!history || history?.gate != 1) {
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
			//gate 2, get user message and previous suggestion to get the final search use
			const searchIndex = parseInt(message);
			if (isNaN(searchIndex))return callSendAPI(psid, "Sorry! Invalid number, cancelling search...");
			const selectedTitle = history.suggestions[searchIndex - 1];
        	if (!selectedTitle)return callSendAPI(psid, "Sorry no content was found, please try again!");
        	
        	const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&titles=${encodeURIComponent(selectedTitle)}`;
        	try {
        		const response = await requestSync(apiUrl);
				const page = Object.values(response.data.query.pages)[0];

        		const introWithoutTags = removeTags(page.extract);

        		return callSendAPI(psid, `${page.title}\n\n${introWithoutTags.trim()}`);
        	} catch (error) {
        		return callSendAPI(psid, "INTERNAL: Error fetching article content.");
        	}
        	
        	delete msgHistory[psid];
		
		}
        
	}
        

	res.send("EVENT_RECEIVED");
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
	if (messagesCount >= 10)return;
	messagesCount += 1;
	
	let request_body = {
		recipient: {
			id: sender_psid
		},
		message: {
			text: res
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
        
