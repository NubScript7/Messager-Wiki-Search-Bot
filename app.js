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

function removeTags(a) {
  return output = a.replace(/<[^>]*>/g, '').replace(/\./g,'.\n');
}

// Function to fetch search suggestions from Wikipedia API
async function getSuggestion(keyword) {
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&utf8=1&srsearch=${encodeURIComponent(keyword)}`;

  try {
    const response = await requestSync(apiUrl);
    return response.data.query.search.map(result => result.title);
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


const suggestionz = [];
app.get('/suggestion', (req,res) => {
  res.json(suggestionz);
})

app.get('/msg-hook',(req,res) => {
	res.json(message);
})

asyncRouter.post("/webhook", async (req,res) => {
  let body = req.body;
  
  if(body.object === 'page'){
    
      const entry = body.entry[0];
      const user = entry.messaging[0];
      const psid = user.sender.id;
      const message = user.message?.text;
      if ( !message )return;
      
      if ( message[0] == "!" ) {
        typeof cmdList[message] == 'function' ? cmdList[message](psid): callSendAPI(psid, "I dont think that is a valid command...\nto see the list of commands type !help");
      } else {
        
        
        callSendAPI(psid, "DEBUG: default return "+Date.now())
        
        
      }
        

    res.sendStatus(200).send("EVENT_RECEIVED");
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

function callSendAPI(sender_psid,response) {
	if (messagesCount >= 10)return;
	messagesCount += 1;
	
	let request_body = {
		recipient: {
			id: sender_psid
		},
		message: response
	}
	
	axios.post("https://graph.facebook.com/v2.6/me/messages",request_body,{
		params: {
			access_token: process.env.FB_PAGE_ACCESS_TOKEN
		},
		headers: {
			'Content-Type': 'application/json'
		}
	})
	
	
}


app.listen(process.env.PORT || 3000,()=>console.log('service online'));
        
