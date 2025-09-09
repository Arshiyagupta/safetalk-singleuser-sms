// Demo of Bi-Directional SafeTalk Messaging System

// Mock AI service methods
function generateOutgoingMessageOptions(clientMessage) {
  // Simulate AI processing of client's message
  if (clientMessage.toLowerCase().includes('pickup') || clientMessage.toLowerCase().includes('schedule')) {
    return {
      messageOptions: [
        "I need to adjust this weekend's pickup time. What works for you?",
        "Could we work together to find a pickup time that works for both of us this weekend?",
        "I'd like to coordinate a pickup schedule that works best for our child this weekend."
      ],
      messageType: 'decision_making'
    };
  } else if (clientMessage.toLowerCase().includes('school') || clientMessage.toLowerCase().includes('activity')) {
    return {
      messageOptions: [
        "Here's an update about our child's school activities.",
        "I wanted to share some school information with you.",
        "This school update affects our child's routine, thought you should know."
      ],
      messageType: 'informational'
    };
  } else {
    return {
      messageOptions: [
        "I need to discuss something regarding our child.",
        "Could we coordinate on this matter for our child's benefit?", 
        "I'd like to work together on this for our child's well-being."
      ],
      messageType: 'decision_making'
    };
  }
}

function formatOutgoingMessageOptionsForSMS(originalMessage, messageOptions, userName, exPartnerName) {
  const greeting = userName ? `Hey ${userName}` : 'Hi';
  const recipient = exPartnerName || 'your co-parent';
  
  return `${greeting},

Here are 3 ways to send your message to ${recipient}:

1. ${messageOptions[0]}
2. ${messageOptions[1]}  
3. ${messageOptions[2]}

Reply with 1, 2, 3, or write your own version.`;
}

function formatIncomingFilteredMessage(originalMessage, filteredMessage, responseOptions, userName, exPartnerName) {
  const greeting = userName ? `Hey ${userName}` : 'Hi';
  const sender = exPartnerName || 'your co-parent';
  
  const messageSummary = createMessageSummary(filteredMessage);
  
  return `${greeting},

${sender} ${messageSummary}.

Would you like to send any of these responses?

1. ${responseOptions[0]}
2. ${responseOptions[1]}
3. ${responseOptions[2]}

Reply with 1, 2, 3, or write your own response.`;
}

function createMessageSummary(filteredMessage) {
  const message = filteredMessage.toLowerCase().trim();
  
  if (message.includes('request') && message.includes('time')) {
    return 'is requesting a schedule change';
  } else if (message.includes('pickup') || message.includes('drop')) {
    return 'has a pickup/drop-off request';
  } else if (message.includes('school') || message.includes('activity')) {
    return 'sent information about school/activities';
  } else {
    return 'sent a message';
  }
}

console.log('🔄 SafeTalk Bi-Directional Messaging System Demo\n');

console.log('='.repeat(80));
console.log('📤 SCENARIO 1: Client Initiating Message to Ex');
console.log('='.repeat(80));

const clientMessage1 = "I need to ask him about changing pickup time this weekend";
console.log(`Client types: "${clientMessage1}"`);
console.log('\n📱 SafeTalk AI processes and responds:\n');

const outgoingResult1 = generateOutgoingMessageOptions(clientMessage1);
const outgoingResponse1 = formatOutgoingMessageOptionsForSMS(
  clientMessage1,
  outgoingResult1.messageOptions,
  "Sarah",
  "Michael"
);

console.log(outgoingResponse1);

console.log('\n' + '='.repeat(80));
console.log('📥 SCENARIO 2: Ex Sending Message to Client (Original Flow)');
console.log('='.repeat(80));

const exMessage = "you are always changing plans last minute! can you just stick to the schedule for once??";
const filteredMessage = "Request to maintain consistent scheduling";
const responseOptions = [
  "I understand consistency is important and will work to stick to our schedule",
  "Let's set up calendar reminders to avoid any future scheduling conflicts",
  "I want to make sure our schedule works well for our child's routine"
];

console.log(`Ex sends: "${exMessage}"`);
console.log('\n📱 SafeTalk AI processes and responds:\n');

const incomingResponse = formatIncomingFilteredMessage(
  exMessage,
  filteredMessage,
  responseOptions,
  "Sarah",
  "Michael"
);

console.log(incomingResponse);

console.log('\n' + '='.repeat(80));
console.log('📤 SCENARIO 3: Client Initiating School Information');
console.log('='.repeat(80));

const clientMessage2 = "I need to tell her about the parent teacher conference next week";
console.log(`Client types: "${clientMessage2}"`);
console.log('\n📱 SafeTalk AI processes and responds:\n');

const outgoingResult2 = generateOutgoingMessageOptions(clientMessage2);
const outgoingResponse2 = formatOutgoingMessageOptionsForSMS(
  clientMessage2,
  outgoingResult2.messageOptions,
  "David",
  "Lisa"
);

console.log(outgoingResponse2);

console.log('\n' + '='.repeat(80));
console.log('🔄 HOW THE BI-DIRECTIONAL SYSTEM WORKS');
console.log('='.repeat(80));

console.log(`
🏗️ SYSTEM ARCHITECTURE:

1️⃣ MESSAGE DETECTION:
   ✅ Detects if user is RESPONDING to ex's message or INITIATING new message
   ✅ Uses pending response options to determine message state

2️⃣ INCOMING MESSAGES (Ex → Client):
   • Ex sends hostile message → AI filters it
   • Client receives: "Hey Sarah, Michael is requesting X. Send 1, 2, or 3?"
   • Client selects option → Gets sent to ex

3️⃣ OUTGOING MESSAGES (Client → Ex): 
   • Client wants to send message → AI generates 3 professional versions
   • Client receives: "Here are 3 ways to send your message: 1, 2, or 3"
   • Client selects option → Gets sent to ex

4️⃣ SMART STATE MANAGEMENT:
   • System tracks message direction: incoming, outgoing, outgoing_intent
   • Prevents confusion between responding vs initiating
   • Handles both flows seamlessly

🎯 RESULT: Complete bi-directional communication assistance!
   Both incoming AND outgoing messages get AI-powered professional filtering.
`);

console.log('\n✨ Enhanced Features:');
console.log('• Personalized greetings for both directions');
console.log('• 3 distinct strategic approaches (Direct, Diplomatic, Child-focused)');
console.log('• Professional tone enforcement using BIFF method'); 
console.log('• Custom response filtering for inappropriate content');
console.log('• Smart message state detection');
console.log('• Complete bi-directional communication support');

console.log('\n🎉 SafeTalk now helps co-parents communicate better in BOTH directions!');