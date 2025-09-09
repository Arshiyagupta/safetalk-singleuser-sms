// Demonstration of the enhanced SafeTalk features

function formatFilteredMessageForSMS(
  originalMessage, 
  filteredMessage, 
  responseOptions,
  userName,
  exPartnerName
) {
  // Create personalized greeting
  const greeting = userName ? `Hey ${userName}` : 'Hi';
  const sender = exPartnerName || 'your co-parent';
  
  // Create a brief summary of what the ex is requesting/saying
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
  } else if (message.includes('health') || message.includes('medical')) {
    return 'shared health/medical information';
  } else if (message.includes('schedule') || message.includes('calendar')) {
    return 'wants to discuss scheduling';
  } else if (message.includes('need') || message.includes('want')) {
    return 'has a request';
  } else {
    return 'sent a message';
  }
}

function basicFilterUserResponse(response) {
  let filtered = response;
  
  // Remove common profanity and hostile words
  const hostileWords = [
    'stupid', 'idiot', 'hate', 'terrible', 'awful', 'worst', 'useless',
    'damn', 'hell', 'crazy', 'ridiculous', 'pathetic', 'loser', 'jerk'
  ];
  
  hostileWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '[removed]');
  });

  // Remove excessive punctuation and caps
  filtered = filtered.replace(/[!]{2,}/g, '.');
  filtered = filtered.replace(/[?]{2,}/g, '?');
  filtered = filtered.replace(/[A-Z]{3,}/g, (match) => 
    match.charAt(0) + match.slice(1).toLowerCase()
  );

  // Limit length
  if (filtered.length > 150) {
    filtered = filtered.substring(0, 147) + '...';
  }

  return filtered.trim() || "I'd like to discuss this matter regarding our child.";
}

console.log('🚀 SafeTalk Enhanced Features Demo\n');

console.log('=== 1. Personalized Greeting System ===\n');

const mockResponseOptions = [
  "I can adjust my schedule to drop off 1 hour earlier going forward",
  "Let's set up a consistent weekly schedule with specific drop-off times", 
  "I understand timing is important. What drop-off window works best for the children?"
];

const originalHostileMessage = "you are always late! why do you keep hoggin the time with our child?? drop them off 1 hour earlier!";
const filteredMessage = "Request to adjust drop-off time by 1 hour earlier due to timing concerns";

console.log('✅ With Personalized Names (Sarah & Michael):');
console.log(formatFilteredMessageForSMS(
  originalHostileMessage,
  filteredMessage,
  mockResponseOptions,
  "Sarah",
  "Michael"
));

console.log('\n' + '='.repeat(70) + '\n');

console.log('📱 Without Names (Fallback):');
console.log(formatFilteredMessageForSMS(
  originalHostileMessage,
  filteredMessage,
  mockResponseOptions
));

console.log('\n' + '='.repeat(70) + '\n');

console.log('=== 2. Custom Response Filtering System ===\n');

const testResponses = [
  "That's ridiculous, he's being unreasonable again!",
  "I can't do that time, sorry.",
  "He's such an idiot, I hate dealing with him!",
  "Fine, I'll adjust the schedule.",
  "You're CRAZY if you think I'm doing that!!!"
];

testResponses.forEach((response, index) => {
  console.log(`${index + 1}. Original: "${response}"`);
  const filtered = basicFilterUserResponse(response);
  console.log(`   Filtered: "${filtered}"`);
  console.log(`   Was changed: ${filtered !== response.trim()}\n`);
});

console.log('=== 3. Message Summary Examples ===\n');

const testMessages = [
  "Request to adjust pickup time by 30 minutes",
  "Information about school parent-teacher conference next week", 
  "Need to discuss vacation schedule for summer",
  "Child has medical appointment on Tuesday",
  "General message about co-parenting matters"
];

testMessages.forEach((msg, index) => {
  console.log(`${index + 1}. "${msg}"`);
  console.log(`   Summary: "Your co-parent ${createMessageSummary(msg)}"\n`);
});

console.log('✨ Key Enhancements:');
console.log('• Personalized greetings using actual names');
console.log('• Conversational message summaries'); 
console.log('• 3 distinct solution strategies (not just paraphrases)');
console.log('• Advanced custom response filtering with profanity detection');
console.log('• BIFF method applied (Brief, Informative, Friendly, Firm)');
console.log('• Research-based conflict resolution techniques');
console.log('• Protection against hostile/inappropriate user responses');

console.log('\n🎯 This creates a much more natural, supportive experience for co-parents!');