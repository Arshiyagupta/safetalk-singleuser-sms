// Test the enhanced SafeTalk system with personalized greetings and filtering

const { default: twilioService } = require('./dist/services/twilioService');
const { default: aiService } = require('./dist/services/aiService');

async function testPersonalizedGreeting() {
  console.log('=== Testing Personalized Greeting System ===\n');
  
  try {
    // Mock AI result
    const mockAiResult = {
      filteredMessage: "Request to adjust drop-off time by 1 hour earlier due to timing concerns",
      responseOptions: [
        "I can adjust my schedule to drop off 1 hour earlier going forward",
        "Let's set up a consistent weekly schedule with specific drop-off times", 
        "I understand timing is important. What drop-off window works best for the children?"
      ]
    };
    
    // Test with names
    console.log('With personalized names:');
    const personalizedMessage = twilioService.formatFilteredMessageForSMS(
      "you are always late! why do you keep hoggin the time with our child?? drop them off 1 hour earlier!",
      mockAiResult.filteredMessage,
      mockAiResult.responseOptions,
      "Sarah",  // userName
      "Michael" // exPartnerName
    );
    
    console.log(personalizedMessage);
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test without names (fallback)
    console.log('Without names (fallback):');
    const genericMessage = twilioService.formatFilteredMessageForSMS(
      "you are always late! why do you keep hoggin the time with our child?? drop them off 1 hour earlier!",
      mockAiResult.filteredMessage,
      mockAiResult.responseOptions
    );
    
    console.log(genericMessage);
    
  } catch (error) {
    console.error('Error testing personalized greeting:', error);
  }
}

async function testCustomResponseFiltering() {
  console.log('\n\n=== Testing Custom Response Filtering ===\n');
  
  const testResponses = [
    "That's ridiculous, he's being unreasonable again!",
    "I can't do that time, sorry.",
    "He's such an idiot, I hate dealing with him!",
    "Fine, I'll adjust the schedule.",
    "You're crazy if you think I'm doing that!"
  ];
  
  for (const response of testResponses) {
    try {
      console.log(`Original: "${response}"`);
      
      const result = await aiService.filterUserResponse(response);
      
      if (result.isAppropriate) {
        console.log(`Filtered: "${result.filteredResponse}"`);
        console.log(`Was filtered: ${result.filteredResponse !== response.trim()}`);
      } else {
        console.log('Result: MESSAGE_TOO_HOSTILE - User must select from pre-generated options');
      }
      
      console.log('-'.repeat(50));
    } catch (error) {
      console.error(`Error filtering "${response}":`, error);
    }
  }
}

async function runTests() {
  await testPersonalizedGreeting();
  await testCustomResponseFiltering();
  
  console.log('\n✅ Enhanced SafeTalk system tests completed!');
}

runTests();