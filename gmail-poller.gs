/**
 * LibraryTracker Gmail Poller
 *
 * SETUP (one-time):
 * 1. Go to https://script.google.com → New project → paste this file
 * 2. Click the gear icon (Project Settings) → Script Properties → Add:
 *      WEBHOOK_SECRET  →  <your SENDGRID_WEBHOOK_SECRET value from Supabase>
 * 3. Run setupTrigger() once (click ▶ with that function selected)
 *    → It will ask for Gmail permission — approve it
 * 4. Done. The poller runs every 5 minutes automatically.
 *
 * To stop: Triggers (clock icon) → delete the processInboxEmails trigger.
 */

var CONFIG = {
  EDGE_URL: 'https://qnrtnhijkkjsqqbrsppd.supabase.co/functions/v1/inbound-email',
  INBOX_ADDRESS: 'u_f7iwxc43@inbound.qlogger.org',
  LABEL_NAME: 'LibraryTracker/processed',
  // Search all unread inbox messages not yet handed to LibraryTracker
  SEARCH_QUERY: 'is:unread label:inbox -label:LibraryTracker/processed'
};

function processInboxEmails() {
  var secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  var label = GmailApp.getUserLabelByName(CONFIG.LABEL_NAME)
    || GmailApp.createLabel(CONFIG.LABEL_NAME);

  var threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, 20);

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();

    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      if (!msg.isUnread()) continue;

      var payload = JSON.stringify({
        to: CONFIG.INBOX_ADDRESS,
        from: msg.getFrom(),
        subject: msg.getSubject(),
        text: msg.getPlainBody()
      });

      var options = {
        method: 'post',
        contentType: 'application/json',
        payload: payload,
        muteHttpExceptions: true
      };
      if (secret) options.headers = { 'x-webhook-secret': secret };

      try {
        var response = UrlFetchApp.fetch(CONFIG.EDGE_URL, options);
        console.log('Sent: ' + msg.getSubject() + ' → ' + response.getResponseCode());
      } catch (e) {
        console.error('Failed: ' + msg.getSubject() + ' — ' + e);
      }
    }

    label.addToThread(thread);
  }
}

// Run this ONCE to create the recurring trigger
function setupTrigger() {
  // Remove any existing triggers for this function to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processInboxEmails') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('processInboxEmails')
    .timeBased()
    .everyMinutes(5)
    .create();

  console.log('Trigger created — processInboxEmails will run every 5 minutes.');
}
