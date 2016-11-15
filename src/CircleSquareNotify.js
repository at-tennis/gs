/**
 * @const 
 */
var TITLE_EVENT_MAP = {
  "event_name"          : "■イベント名",
  "event_date"          : "■日時",
  "event_place"         : "■場所",
  "event_meetingDate"   : "■集合日時",
  "event_meetingPlace"  : "■集合場所",
  "event_explanation"   : "■説明",
  "event_RSVPDeadline"  : "■出欠期限",
  "event_pageUrl"       : "■イベントページ",
  "event_facebook"      : "■Facebook",
  "event_twitter"       : "■Twitter",
  "event_blog"          : "■公式ブログ",
  "event_support"       : "■お問い合わせ"
};

/** 
 * @param {string} title Headline of Notificaion mail from Circle Square Service.
 * @return {string} Event key or "event_unknown" if no key matches title.
 */
var convertHeadlineToKey = function( title ){
  
  if( typeof title !== 'string' ){
    return "event_unknown";
  }
  
  for(var n in TITLE_EVENT_MAP){ 
    if( title.match(TITLE_EVENT_MAP[n]) ){
      return n; // matching suceess.
    }
  }
  
  return "event_unknown";
}

/** 
 * @param {string} title
 * @param {number} startPos
 * @param {number} endPos
 * @constructor 
 */
var Chapter = function( title, startPos, endPos ){
  
  this.title = title;
  this.startPos = startPos;
  this.endPos = endPos;
  
}

/** 
 * @param {string} body Mail body from Circle Square Service.
 * @return {Array.<Chapter>} 
 */
var extractChaptersFromBody = function( body ){
  
  var chapters = [];
  var headlines = body.match(/■.*[\r\n|\r|\n]/gi);
  
  if( headlines === null ){
    return null;
  }
  
  var prevTitle = null;
  var currTitle = null;
  
  for(　var n = 0 ; n < headlines.length　; n++ ){ 
    currTitle = body.match(headlines[n]);
    if( n === 0 ){
      prevTitle = currTitle;
      continue; 
    }
    
    chapters.push( new Chapter( prevTitle["0"], prevTitle.index+prevTitle["0"].length, currTitle.index-1 ));
    
    prevTitle = currTitle;
  }
  
  chapters.push( new Chapter( prevTitle["0"], prevTitle.index+prevTitle["0"].length, body.length ));
  
  return chapters;
}

/** 
 * @param {string} body Mail body from Circle Square Service.
 * @param {Array.<Chapter>} 
 * @return {Object} json.
 */
var parseBodyToJson = function( body, chapters ){

  var json = {};
  
  for(　var n = 0 ; n < chapters.length　; n++ ){ 
    var chapter = chapters[n];
    var title = convertHeadlineToKey(chapter.title);
    json[title] = body.slice( chapter.startPos, chapter.endPos);
  }
  
  return json;
}

/** 
 * @param {string} url
 * @param {Object}  json.
 */
var sendHttpPostRequest = function( url, json ){
  
  var options =
  {
     "method" : "post",
     "payload" : json
  };
  
  UrlFetchApp.fetch(url, options );
}

/**
 * 1. check unread mails with "circle_square_notify" label.
 * 2. parse mail body to json object.
 * 3. send json object by post request to user web app.
 * 4. replace label "circle_square_notify" to "processed".
 * 5. change the status "unread" to "read".
 */
function sendMailNotificationToWebApp() {
  
  var requestUrl = "https://"
  var unProcessLabelName = 'circle_square_notify';
  var processedLabelName = 'processed';
  var unProcessLabel = GmailApp.getUserLabelByName(unProcessLabelName);
  var processedLabel = GmailApp.getUserLabelByName(processedLabelName);
  
  if (!unProcessLabel){
    Logger.log("Error:Label " + unProcessLabelName + " not found.");
    return;
  }
  
  if (!processedLabel){
    Logger.log("Error:Label " + processedLabel + " not found.");
    return;
  }
  
  var threads = GmailApp.search('label:' + unProcessLabelName);
  if (threads.length == 0){
    Logger.log("process 0");
    return;
  }
  
  for(var n in threads){
    var thread = threads[n];
    var msgs = thread.getMessages();
    
    for(var i in msgs){
      var msg = msgs[i];
      
      if( !msg.isUnread() ){
        continue;
      }
      
      var mailBody = msg.getPlainBody();
     
      var chapters = extractChaptersFromBody( mailBody );
      if( chapters === null ){
        continue;
      }
      
      var jsonObj = parseBodyToJson(mailBody, chapters);
      sendHttpPostRequest(requestUrl, jsonObj);
      
      msg.markRead();
    }
    
    unProcessLabel.removeFromThread(thread);
    processedLabel.addToThread(thread);
  }
}
