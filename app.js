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
let response = `
      the list of commands:          
        !help - prints cmd list
  `
  callSendAPI(sender_psid, response);
}

/* autokill feature */

let messagesCount = 0;

const message = [];

const messageHistory = {};

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

app.get('/msg-hook',(req,res) => {
	res.json(message);
})

app.post("/webhook",async (req,res)=>{
  let body = req.body;
  
  if(body.object === 'page'){
    
    message.push(body);
    
    for (const entry of body.entry) {
      const user = entry.messaging[0];
      const psid = user.sender.id;
      const message = user.message.text;
      const history = messageHistory[psid];
      
      if ( message[0] == "!" ) {
        typeof cmdList[message] == 'function' ? cmdList[message](): callSendAPI(psid, "I dont think that is a valid command...\nto see the list of commands type !help");
      } else {
        
        if ( history?.gate != 1 ) {
          let suggestionString = "Search Suggestion:\n\n";
          
          const suggestionArray = await getSuggestion(message);
          
           if ( suggestionArray.length == 0 )return callSendAPI(psid, "Sorry no suggestion were found, on the given keyword. Please try again...");
            suggestionArray.forEach((e,i) => {
              suggestionString += `${i + 1}. ${e}\n`
            });
            
            suggestionString += "Enter the number of the article you want to read:";
            callSendAPI(psid, suggestionString);
            
            messageHistory[psid].gate = 1;
            messageHistory[psid].suggestion = suggestionArray;
        } else if (history?.gate == 1 && history?.suggestion.length >= 1) {
          
          const choice = parseInt(message);
          if ( isNaN(choice) )return callSendAPI(psid, "Invalid Choice! that is not a number, cancelling search...");
          const selectedTitle = history.suggestion[choice - 1];
          if ( !selectedTitle )return callSendAPI(psid, "Invalid Choice! that is not in the suggestion list, cancelling search...");
          
          if ( isNaN(choice) || !selectedTitle ) {
            delete messageHistory[psid];
            return
          }
          
          /* to fix start */
          
          const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&titles=${encodeURIComponent(selectedTitle)}`;

          try {
            const response = await requestSync(apiUrl);
            const page = Object.values(response.data.query.pages)[0];

            const introWithoutTags = removeTags(page.extract);

            callSendAPI(psid, `${page.title}\n\n${introWithoutTags.trim()}`);
          } catch (error) {
            callSendAPI(psid,`Error fetching article content: ${error.message}`);
          }
          
          /* to fix end */
          
        } else {
          
          callSendAPI(psid, "How did we go here?");
          
        }
        
        
      }
      
      
    }

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
  if (messagesCount >= 10)return;
  messagesCount += 1;
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid
    },
    message: {
      text: response
   }
  }
  
  // Send the HTTP request to the Messenger Platform
  request({
    uri: "https://graph.facebook.com/v2.6/me/messages",
    qs: { access_token: process.env.FB_PAGE_ACCESS_TOKEN },
    method: "POST",
    json: request_body
  }, err => {
      if(!!err)return callSendAPI(sender_psid,{text:"sorry! the message was not able to be processed, please try again!"});
  });
}

app.listen(process.env.PORT || 3000,()=>console.log('service online'));
        
