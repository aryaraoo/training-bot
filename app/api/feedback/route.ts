import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const maxDuration = 30;

const GEMINI_MODEL = "gemini-2.0-flash";
const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!GOOGLE_API_KEY) {
  console.error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
}

function sanitizeMessages(rawMessages: any[]): { role: "user" | "assistant"; content: string }[] {
  return rawMessages
    .filter((msg) =>
      msg &&
      (msg.role === "user" || msg.role === "assistant") &&
      typeof msg.content === "string" &&
      msg.content.trim().length > 0
    )
    .map((msg) => ({
      role: msg.role,
      content: msg.content.trim()
        .replace(/[^\w\s.,!?'"-]/g, '') // Allow quotes and apostrophes for better context
        .substring(0, 3000) // Increased limit for better analysis
    }));
}

function analyzeConversationMetrics(messages: { role: "user" | "assistant"; content: string }[]) {
  const userMessages = messages.filter(m => m.role === "user");
  const assistantMessages = messages.filter(m => m.role === "assistant");
  
  const totalUserWords = userMessages.reduce((sum, msg) => sum + msg.content.split(' ').length, 0);
  const totalAssistantWords = assistantMessages.reduce((sum, msg) => sum + msg.content.split(' ').length, 0);
  const avgUserMessageLength = userMessages.length > 0 ? totalUserWords / userMessages.length : 0;
  const avgAssistantMessageLength = assistantMessages.length > 0 ? totalAssistantWords / assistantMessages.length : 0;
  
  return {
    totalMessages: messages.length,
    userMessages: userMessages.length,
    assistantMessages: assistantMessages.length,
    totalUserWords,
    totalAssistantWords,
    avgUserMessageLength: Math.round(avgUserMessageLength * 10) / 10,
    avgAssistantMessageLength: Math.round(avgAssistantMessageLength * 10) / 10,
    conversationRatio: userMessages.length > 0 ? (assistantMessages.length / userMessages.length).toFixed(2) : "0"
  };
}

function createFallbackFeedback(reason: string = "Unable to analyze conversation") {
  return {
    scores: {
      professionalism: 7,
      tone: 7,
      clarity: 7,
      empathy: 7,
      overall: 7
    },
    good: "The conversation was conducted in a professional manner.",
    improvement: `${reason}. Please ensure the conversation contains meaningful sales interaction content.`,
    suggestion: "Focus on clear communication and understanding customer needs in future interactions."
  };
}

export async function POST(req: Request) {
  try {
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "Google Generative AI API key is not configured",
          details: "Please set GOOGLE_GENERATIVE_AI_API_KEY environment variable",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { messages: rawMessages, scenario } = body;

    if (!rawMessages || !Array.isArray(rawMessages)) {
      console.error("Invalid 'messages' input:", rawMessages);
      return new Response(
        JSON.stringify({ error: "Invalid messages format. Must be an array of messages." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const messages = sanitizeMessages(rawMessages);

    // Analyze conversation metrics for better context
    const conversationMetrics = analyzeConversationMetrics(messages);

    // Debug logging
    console.log("📤 Sending to Gemini:", {
      messageCount: messages.length,
      conversationMetrics,
      messages: messages.map(m => ({ 
        role: m.role, 
        contentLength: m.content.length,
        preview: m.content.substring(0, 50) + "..." 
      })),
      totalContentLength: messages.reduce((sum, m) => sum + m.content.length, 0)
    });

    // Check if we have meaningful content
    if (messages.length === 0) {
      console.warn("⚠️ No valid messages found after sanitization");
      return new Response(
        JSON.stringify({ 
          feedback: createFallbackFeedback("No valid messages found") 
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const scenarioDetails = scenario || {
      prompt: "You are a helpful sales training assistant. Provide coaching feedback at the end of the conversation.",
      mode: "feedback",
    };

    const scenarioPrompt = scenarioDetails?.prompt?.trim();
    const mode = scenarioDetails?.mode?.trim();

const systemPrompt = `
You are an expert sales training AI coach with deep knowledge of sales techniques, customer psychology, and conversation analysis.

Analyze the given sales conversation between a user (salesperson) and a customer. Based on the specific dialogue, conversation patterns, and scenario context, provide detailed, dynamic feedback.

CONVERSATION METRICS:
- Total Messages: ${conversationMetrics.totalMessages}
- User Messages: ${conversationMetrics.userMessages}
- Assistant Messages: ${conversationMetrics.assistantMessages}
- Total User Words: ${conversationMetrics.totalUserWords}
- Total Assistant Words: ${conversationMetrics.totalAssistantWords}
- Average User Message Length: ${conversationMetrics.avgUserMessageLength} words
- Average Assistant Message Length: ${conversationMetrics.avgAssistantMessageLength} words
- Conversation Ratio (Assistant/User): ${conversationMetrics.conversationRatio}

CONVERSATION ANALYSIS FACTORS:
- Message Length Impact: ${conversationMetrics.avgUserMessageLength < 10 ? 'Short responses may indicate lack of detail' : conversationMetrics.avgUserMessageLength > 50 ? 'Long responses may indicate thoroughness or verbosity' : 'Balanced response length'}
- Engagement Level: ${parseFloat(conversationMetrics.conversationRatio) > 1.5 ? 'High customer engagement' : parseFloat(conversationMetrics.conversationRatio) < 0.5 ? 'Low customer engagement' : 'Moderate customer engagement'}
- Conversation Depth: ${conversationMetrics.totalMessages < 4 ? 'Brief conversation' : conversationMetrics.totalMessages > 10 ? 'Detailed conversation' : 'Standard conversation length'}
- Response Quality: ${conversationMetrics.totalUserWords < 50 ? 'Minimal user input' : conversationMetrics.totalUserWords > 200 ? 'Comprehensive user input' : 'Moderate user input'}

IMPORTANT: Respond with ONLY this exact JSON structure (no other text):

{
  "scores": {
    "professionalism": number (0-10),
    "tone": number (0-10),
    "clarity": number (0-10),
    "empathy": number (0-10),
    "overall": number (0-10)
  },
  "good": "2-3 specific sentences about what the user did well, referencing specific moments from the conversation.",
  "improvement": "2-3 specific sentences about what the user could improve, with concrete examples from the conversation.",
  "suggestion": "One actionable, specific tip based on the conversation analysis and scenario requirements."
}

${scenarioDetails ? `
SCENARIO ANALYSIS CONTEXT:
- Scenario: ${scenarioDetails.name}
- Description: ${scenarioDetails.description}
- Customer Persona: ${scenarioDetails.persona}
- Difficulty: ${scenarioDetails.difficulty}

ANALYZE THESE SPECIFIC ASPECTS:
1. How well did the user adapt their approach to the ${scenarioDetails.persona} persona?
2. Did they effectively address the key challenges mentioned in "${scenarioDetails.description}"?
3. Was their approach appropriate for the ${scenarioDetails.difficulty} difficulty level?
4. How well did they handle the specific requirements of this scenario?
5. Did they demonstrate understanding of the customer's needs and pain points?
6. How effectively did they use sales techniques appropriate for this scenario?

SCORING GUIDELINES:
- Professionalism: Evaluate business etiquette, preparation, and professional conduct
- Tone: Assess communication style, friendliness, and rapport building
- Clarity: Measure how clearly the user communicated their points and understood customer responses
- Empathy: Evaluate understanding of customer needs and emotional intelligence
- Overall: Consider the complete performance in context of this specific scenario
` : ''}

CONVERSATION ANALYSIS GUIDELINES:
- Analyze the actual conversation flow and patterns
- Look for specific techniques used (open questions, active listening, objection handling, etc.)
- Identify missed opportunities and successful moments
- Consider the natural progression of the conversation
- Evaluate how well the user adapted to customer responses
- Assess the effectiveness of their closing or follow-up approach
- Consider message length patterns and conversation balance
- Analyze the depth and quality of user responses relative to the scenario requirements

DYNAMIC SCORING CRITERIA (VARY BASED ON ACTUAL PERFORMANCE):
- 9-10: Exceptional performance with clear examples from the conversation
- 7-8: Good performance with room for improvement
- 5-6: Average performance with several areas needing work
- 3-4: Below average with significant improvement needed
- 1-2: Poor performance requiring major changes
- 0: No meaningful interaction or completely inappropriate approach

SCORE VARIATION REQUIREMENTS:
- DO NOT give the same score for all categories unless the performance is truly identical
- Vary scores based on different aspects of the conversation
- Consider conversation length, quality of responses, and specific techniques used
- Factor in the scenario difficulty and customer persona complexity
- Use the conversation metrics to influence scoring (e.g., short responses might affect clarity, long responses might affect engagement)

FEEDBACK REQUIREMENTS:
- Reference specific moments from the conversation
- Provide concrete, actionable advice
- Consider the scenario context when giving suggestions
- Be constructive and encouraging while honest
- Focus on the most impactful improvements
- All numeric scores must be between 0 and 10 (no strings)
- Text fields must be specific and tailored to this conversation
- Do NOT include chat history, commentary, or any text outside the JSON
- Return ONLY valid JSON
`;


    console.log("🤖 Using system prompt length:", systemPrompt.length);

    const result = await streamText({
      model: google(GEMINI_MODEL),
      messages,
      system: systemPrompt,
      temperature: 0.3, // Lower temperature for more consistent output
      maxTokens: 800,   // Reasonable limit
      topP: 0.8,        // More focused responses
    });

    let fullText = "";
    try {
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }
    } catch (streamError) {
      console.error("❌ Error reading stream from Gemini:", streamError);
      return new Response(
        JSON.stringify({ 
          feedback: createFallbackFeedback("Error processing AI response") 
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("📥 Gemini raw response:", {
      length: fullText.length,
      preview: fullText.substring(0, 200) + "..."
    });

    if (fullText.trim() === "") {
      console.warn("⚠️ Gemini returned empty response. Using fallback.");
      return new Response(
        JSON.stringify({ 
          feedback: createFallbackFeedback("AI returned empty response") 
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Clean and extract JSON
    let feedback;
    try {
      // Remove common LLM artifacts
      let cleaned = fullText
        .replace(/```json|```/g, "") // Remove code blocks
        .replace(/^[^{]*/, "") // Remove text before first {
        .replace(/[^}]*$/, "}") // Remove text after last }
        .trim();

      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}") + 1;

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("No JSON object found in response");
      }

      const maybeJson = cleaned.slice(jsonStart, jsonEnd);
      console.log("🔍 Attempting to parse JSON:", maybeJson.substring(0, 200) + "...");

      feedback = JSON.parse(maybeJson);
    } catch (parseError) {
      console.error("❌ Failed to parse Gemini output:", parseError);
      console.error("Raw response was:", fullText);
      
      return new Response(
        JSON.stringify({ 
          feedback: createFallbackFeedback("Could not parse AI response") 
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate the structure
    const isValid =
      feedback &&
      feedback.scores &&
      typeof feedback.scores.professionalism === "number" &&
      typeof feedback.scores.tone === "number" &&
      typeof feedback.scores.clarity === "number" &&
      typeof feedback.scores.empathy === "number" &&
      typeof feedback.scores.overall === "number" &&
      typeof feedback.good === "string" &&
      typeof feedback.improvement === "string" &&
      typeof feedback.suggestion === "string" &&
      feedback.scores.professionalism >= 0 && feedback.scores.professionalism <= 10 &&
      feedback.scores.tone >= 0 && feedback.scores.tone <= 10 &&
      feedback.scores.clarity >= 0 && feedback.scores.clarity <= 10 &&
      feedback.scores.empathy >= 0 && feedback.scores.empathy <= 10 &&
      feedback.scores.overall >= 0 && feedback.scores.overall <= 10;

    if (!isValid) {
      console.warn("⚠️ AI returned invalid structure:", feedback);
      return new Response(
        JSON.stringify({ 
          feedback: createFallbackFeedback("AI response had invalid format") 
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Successfully generated feedback:", {
      scores: feedback.scores,
      textLengths: {
        good: feedback.good.length,
        improvement: feedback.improvement.length,
        suggestion: feedback.suggestion.length
      }
    });

    return new Response(
      JSON.stringify({ feedback }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("❌ POST /api/feedback error:", error);

    // Return fallback instead of 500 error to keep the app working
    return new Response(
      JSON.stringify({ 
        feedback: createFallbackFeedback("Internal server error occurred") 
      }),
      {
        status: 200, // Changed from 500 to 200 to prevent frontend errors
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}