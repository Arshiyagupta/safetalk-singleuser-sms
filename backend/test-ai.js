// Quick test of the AI service functionality
const { default: aiService } = require('./dist/services/aiService');

async function testAIService() {
  console.log('Testing AI Service...');
  
  try {
    // Test message processing
    const testMessage = "You're always late picking up the kids and it's ruining their schedule! You never care about anyone but yourself!";
    
    const result = await aiService.processMessage(testMessage);
    
    console.log('\n=== AI Processing Results ===');
    console.log('Original:', testMessage);
    console.log('\nFiltered:', result.filteredMessage);
    console.log('\nMessage Type:', result.messageType);
    console.log('\n3 Response Options:');
    result.responseOptions.forEach((option, index) => {
      console.log(`${index + 1}. ${option}`);
    });
    console.log('\nConfidence:', result.confidence);
    console.log('Reasoning:', result.reasoning);
    
  } catch (error) {
    console.error('Error testing AI service:', error);
  }
}

testAIService();