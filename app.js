/*
environment variables
* FB_PAGE_ACCESS_TOKEN
*/

const express = require('express');
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());
app.set('view engine',"ejs");

const request = require("request");

function help(sender_psid) {
let response = {
  "text": `
      the list of commands:          
        !help - prints cmd list
  `
}
  callSendAPI(sender_psid, response);
}

const userMessages = {};

let cmdList = {
  "!help": help
}

async function requestSync(url) {
  return new Promise((resolve, reject) => {
    request(url, { json: true }, (error, response, body) => {
      if (error) {
        reject(error);
      } else {
        resolve(body);
      }
    });
  });
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
  res.json(userMessages);
})

app.get('/',(req,res)=>{
  res.send("=}");
})

app.post("/webhook",async (req,res)=>{
  let body = req.body;
  
  if(body.object === 'page'){
    
    body.entry.forEach((entry)=>{
    if(entry.messaging[0].message?.is_echo===true)return;
      let webhook_event = entry.messaging[0];
      
      let sender_psid = webhook_event.sender.id;
      
      let msg = webhook_event.message;
      
      if (!userMessages[sender_psid]) {
        userMessages[sender_psid] = {
          suggestion: [],
          main: msg.text,
          choice: -1,
          title: ""
        }
      }
      
      /*check if the webhook event is a search or command*/
            
      if (msg&&msg.text[0]==="!"){
        
        if(cmdList[msg.text]){
          cmdList[msg.text](sender_psid);
        }else{
          callSendAPI(sender_psid,{"text":"im sorry but i dont think thats a valid command..."});
        }
      } else if (msg&&msg.text[0]!=="!") {
      
        if(userMessages[sender_psid] && !userMessages[sender_psid].suggestion){
          const suggestion = await getSuggestion(msg.text);
          userMessages[sender_psid].suggestion = suggestion;
          if(suggestion.length === 0)return callSendAPI(sender_psid,"no suggestion found, please try another keyword...");
          let suggestionString = "";
          suggestion.forEach((s,i) => {
            suggestionString += `${i+1}. ${s}\n`
          });
          userMessages[sender_psid].title = msg.text;
          callSendAPI(sender_psid,suggestionString);
          callSendAPI(sender_psid,"Enter the number of the article you want to read:");
        } else if (userMessages[sender_psid]?.suggestion && !userMessages[sender_psid].title)) {
          
          const choice = parseInt(msg.text);
          if (isNaN)return callSendAPI(sender_psid,"Sorry! the number you gave was invalid, cancelling search...");
          const selectedTitle = userMessages[sender_psid].suggestions[choice - 1];
          if (!selectedTitle)return callSendAPI(sender_psid,"Sorry no content was found, please try again!");
          const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&titles=${encodeURIComponent(selectedTitle)}`;
          
          try {
            const response = await requestSync(apiUrl);
            const page = Object.values(response.data.query.pages)[0];

            const introWithoutTags = removeTags(page.extract);

            return callSendAPI(sender_psid, `${page.title}\n\n${introWithoutTags.trim()}`);
          } catch (error) {
            return callSendAPI(sender_psid,'Error fetching article content:' + error.message);
          }
          
        }
      }
    })

    res.status(200).send("EVENT_RECEIVED");
  }else{
    res.sendStatus(404);
  }
})

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
  }
});

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid
    },
    message: response
  }
  
  // Send the HTTP request to the Messenger Platform
  request({
    uri: "https://graph.facebook.com/v2.6/me/messages",
    qs: { access_token: process.env.FB_PAGE_ACCESS_TOKEN },
    method: "POST",
    json: request_body
  }, err => {
      if(!!err)return callSendAPI(sender_psid,"sorry! the message was not able to be processed, please try again!");
  });
}

app.listen(process.env.PORT || 3000,()=>console.log('service online'));
        