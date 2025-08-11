import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { processAIResponseForSpeech } from "@/utils/textProcessing";

// ⏱ Streaming timeout
export const maxDuration = 30;

// 🧠 Config
const GEMINI_MODEL = "gemini-2.0-flash";
const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GOOGLE_TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY;

// Validate API keys
if (!GOOGLE_API_KEY) {
  console.error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
}
if (!GOOGLE_TTS_API_KEY) {
  console.error("GOOGLE_TTS_API_KEY is not set");
}

// --- 🔊 Google TTS Helper ---
async function synthesizeSpeech(text: string): Promise<Uint8Array> {
  try {
    if (!GOOGLE_TTS_API_KEY) {
      throw new Error("Google TTS API key is not configured");
    }

    console.log('Starting TTS synthesis...');
    const res = await fetch(`${GOOGLE_TTS_ENDPOINT}?key=${GOOGLE_TTS_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-GB", name: "en-GB-Standard-A" },
        audioConfig: { 
          audioEncoding: "MP3",
          speakingRate: 0.9, // Slower speaking rate (0.9 = 90% of normal speed)
          pitch: 0.0, // Normal pitch
          effectsProfileId: ["headphone-class-device"] // Better audio quality
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`TTS API error: ${res.status} ${res.statusText} - ${errorText}`);
      throw new Error(`TTS API error: ${res.status} ${res.statusText} - ${errorText}`);
    }

    const data = await res.json();
    const audioContent = data.audioContent;

    if (!audioContent) {
      throw new Error("No audio content returned from Google TTS");
    }

    return Uint8Array.from(Buffer.from(audioContent, "base64"));
  } catch (err) {
    console.error("TTS synthesis failed:", err);
    throw err;
  }
}

// --- 🔁 POST Handler ---
export async function POST(req: Request) {
  try {
    console.log("POST handler started");

    // Check API keys first
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: "Google Generative AI API key is not configured",
          details: "Please set GOOGLE_GENERATIVE_AI_API_KEY environment variable"
        }), 
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!GOOGLE_TTS_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: "Google TTS API key is not configured",
          details: "Please set GOOGLE_TTS_API_KEY environment variable"
        }), 
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { messages, scenario } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userMessage = messages[messages.length - 1]?.content || "";
    if (!userMessage) {
      return new Response(JSON.stringify({ error: "No user message found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate conversation history
    if (messages.length < 1) {
      return new Response(JSON.stringify({ error: "Invalid conversation history" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Conversation validation:");
    console.log("- Total messages:", messages.length);
    console.log("- Message roles:", messages.map(m => m.role));
    console.log("- Last message role:", messages[messages.length - 1]?.role);
    console.log("- Last message content preview:", userMessage.substring(0, 100) + "...");

    // Make scenario optional with a default fallback
    const scenarioDetails = scenario || {
      prompt: "You are a helpful sales training assistant. Provide guidance and feedback to help improve sales skills.",
      mode: "training"
    };

    const baseSystemPrompt = `
    You are a Sales Training AI Agent designed to help sales professionals improve their skills through interactive simulations, personalized coaching, and microlearning.

    Your core capabilities:
    1. Simulate realistic sales conversations with different customer personas.
    2. Evaluate the user's sales responses in real time and give immediate feedback.
    3. Track performance and suggest areas of improvement.
    4. Deliver bite-sized learning content (micro-lessons and quizzes).
    5. Adapt tone, difficulty, and feedback style to match the user's experience level.

    Your behavior:
    - Stay professional, engaging, and motivational.
    - Use realistic business dialogue in roleplays.
    - Always end sessions with clear feedback: "What you did well" and "Areas to improve".
    - Keep track of user's performance history and adjust difficulty accordingly.
    - Provide scores for response quality (0–10) and explain the reasoning.
    - Use frameworks like SPIN Selling, BANT, AIDA, FAB, or Consultative Selling to guide coaching.
    - Include optional vocabulary training (e.g., persuasive words, handling objections).
    - Speak naturally with appropriate pauses and pacing.
    - Give users time to think and respond naturally.
    - Don't rush the conversation - allow for natural pauses.

    Interaction Flow:
    1. If this is the first message, ask the user to choose a practice scenario: (e.g., cold call, product demo, closing deal, price objection).
    2. Begin the scenario by role-playing a customer with a specific persona and goal.
    3. Wait for the user's response and react naturally.
    4. After the scenario or at checkpoints, provide detailed coaching feedback.
    5. Offer follow-up actions: Retry, New Scenario, Micro-lesson, Quiz, or Exit.

    Examples of personas to simulate:
    - Price-Sensitive Buyer
    - Time-Starved Executive
    - Curious but Skeptical Client
    - Silent or Uninterested Customer
    - Competitive Buyer comparing you to rivals

    CRITICAL: Maintain conversation continuity. If there's already a conversation in progress, continue naturally from where it left off. Do NOT restart or repeat the welcome message. Respond contextually to what the user just said.

    NEVER break character unless asked by the user. Use vivid, business-context language and realistic emotional cues.
    Speak at a natural pace with appropriate pauses to allow users to think and respond.

    Act according to these instructions:
    `;

    const scenarioPrompt = scenarioDetails?.prompt?.trim();
    const mode = scenarioDetails?.mode?.trim();
    
    // Enhanced scenario-specific instructions
    let scenarioInstructions = "";
    if (scenarioDetails && scenarioDetails.name) {
      // Scenario-specific conversation styles and flows
      let scenarioStyle = "";
      let conversationFlow = "";
      let personalityTraits = "";
      
      if (scenarioDetails.name.toLowerCase().includes("cold call")) {
        scenarioStyle = `
COLD CALLING SCENARIO STYLE:
- You are a busy executive who receives many sales calls
- Be initially skeptical and time-conscious
- Show resistance to unsolicited calls
- Gradually warm up if the salesperson is professional and relevant
- Ask challenging questions about value proposition
- Be concerned about wasting time
- Show interest only if the pitch is compelling and personalized
- Typical responses: "I'm busy", "Send me information", "What's in it for me?"
- Gradually engage if the salesperson demonstrates understanding of your business needs
`;
        conversationFlow = `
COLD CALL CONVERSATION FLOW:
1. Initial resistance: "I'm very busy, what is this about?"
2. Challenge the value: "Why should I care about this?"
3. Test knowledge: "What do you know about my company?"
4. Demand specifics: "Give me concrete examples of ROI"
5. Show conditional interest: "I might be interested if..."
6. Set next steps: "Send me a proposal" or "Schedule a follow-up"
`;
        personalityTraits = "BUSY EXECUTIVE PERSONA: Time-conscious, skeptical, results-oriented, values efficiency, challenges assumptions, demands proof of value.";
      } else if (scenarioDetails.name.toLowerCase().includes("demo")) {
        scenarioStyle = `
DEMO PITCH SCENARIO STYLE:
- You are a technical decision maker interested in solutions
- Show curiosity about features and capabilities
- Ask detailed technical questions
- Want to see how the solution works in practice
- Be impressed by good demonstrations, skeptical of poor ones
- Focus on integration, scalability, and technical requirements
- Ask about implementation timeline and support
- Show enthusiasm for innovative features
- Be concerned about technical risks and compatibility
`;
        conversationFlow = `
DEMO PITCH CONVERSATION FLOW:
1. Show interest: "This looks interesting, tell me more"
2. Ask technical questions: "How does it integrate with our systems?"
3. Request specific demos: "Can you show me how it handles [specific use case]?"
4. Discuss requirements: "We need it to work with [specific technology]"
5. Ask about implementation: "How long does setup take?"
6. Show enthusiasm or concerns based on demo quality
7. Discuss next steps: "I'd like to see this in action with our data"
`;
        personalityTraits = "TECHNICAL DECISION MAKER PERSONA: Detail-oriented, technically curious, focused on solutions, values innovation, concerned about implementation, wants proof of concept.";
      } else if (scenarioDetails.name.toLowerCase().includes("upsell")) {
        scenarioStyle = `
UPSELLING SCENARIO STYLE:
- You are a satisfied customer who already uses the product
- Show appreciation for current value received
- Be open to additional features but need convincing
- Ask about ROI and additional benefits
- Be budget-conscious but willing to invest if value is clear
- Want to understand how new features complement existing usage
- Show loyalty but also skepticism about "unnecessary" upgrades
- Ask about training and support for new features
`;
        conversationFlow = `
UPSELLING CONVERSATION FLOW:
1. Show satisfaction: "We're happy with what we have"
2. Express curiosity: "What additional value would this provide?"
3. Ask about ROI: "How will this improve our current results?"
4. Discuss budget: "We have limited budget for additional features"
5. Request examples: "Can you show me how other customers use this?"
6. Ask about implementation: "How easy is it to add this to our current setup?"
7. Show conditional interest: "I might be interested if the value is clear"
8. Discuss next steps: "Let me think about this and get back to you"
`;
        personalityTraits = "SATISFIED CUSTOMER PERSONA: Loyal, value-conscious, budget-aware, wants proof of additional value, concerned about complexity, appreciates current relationship.";
      }

      scenarioInstructions = `
SCENARIO CONTEXT:
- Current Scenario: ${scenarioDetails.name}
- Customer Persona: ${scenarioDetails.persona}
- Scenario Description: ${scenarioDetails.description}
- Difficulty Level: ${scenarioDetails.difficulty}

${scenarioStyle}

${conversationFlow}

${personalityTraits}

CONVERSATION GUIDELINES:
- You are role-playing as the ${scenarioDetails.persona} customer in this ${scenarioDetails.name} scenario
- Maintain the customer persona consistently throughout the conversation
- Respond naturally to the user's sales approach and techniques
- Use scenario-specific language, concerns, and objections
- Show realistic emotional progression (skeptical → curious → interested → convinced or resistant)
- Ask questions that are typical for this type of customer
- Express concerns that are relevant to this scenario
- If the user asks to switch scenarios or end the conversation, acknowledge and adapt accordingly
- Keep the conversation focused on the specific scenario requirements
- Provide realistic customer responses that match the persona and difficulty level
- If the conversation seems to be ending or the user wants feedback, offer to provide coaching insights

IMPORTANT: Continue the conversation naturally. Do not restart or repeat previous messages. Respond contextually to what the user just said while maintaining your role as the customer. Make each response feel like a natural continuation of the conversation.
`;
    }
    
    const systemPrompt = scenarioInstructions
      ? `${baseSystemPrompt}\n\n---\n\n${scenarioInstructions}\n\n---\n\nMode: ${mode || 'training'}`
      : baseSystemPrompt;

    console.log("Generating LLM response...");
    console.log("Messages received:", messages.length);
    console.log("Last user message:", userMessage);
    console.log("Scenario details:", scenarioDetails);
    console.log("System prompt length:", systemPrompt.length);
    
    // Step 1: Generate LLM response
    const result = await streamText({
      model: google(GEMINI_MODEL),
      messages,
      system: systemPrompt,
      temperature: 0.7,
      maxTokens: 1000,
    });

    // Properly consume the stream
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }
    console.log("LLM text generated, synthesizing speech...");
    console.log("AI Response preview:", fullText.substring(0, 200) + "...");
    console.log("AI Response length:", fullText.length);

    // Step 2: Process text for speech synthesis
    const processedText = processAIResponseForSpeech(fullText);
    console.log("Original text:", fullText);
    console.log("Processed text for TTS:", processedText);
    
    // Step 3: Convert processed text to speech
    const audioBytes = await synthesizeSpeech(processedText);
    const audioBase64 = Buffer.from(audioBytes).toString("base64");

    // Step 3: Return both text and base64-encoded audio
    return new Response(
      JSON.stringify({
        text: fullText,
        audio: audioBase64,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("POST handler error:", error);

    // Provide more specific error messages
    let errorMessage = "Service temporarily unavailable";
    let errorDetails = error instanceof Error ? error.message : "Unknown error";

    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        errorMessage = "API configuration error";
      } else if (error.message.includes("TTS")) {
        errorMessage = "Text-to-speech service error";
      } else if (error.message.includes("LLM")) {
        errorMessage = "Language model service error";
      }
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
