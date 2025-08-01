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
    1. Ask the user to choose a practice scenario: (e.g., cold call, product demo, closing deal, price objection).
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

    NEVER break character unless asked by the user. Use vivid, business-context language and realistic emotional cues.
    Speak at a natural pace with appropriate pauses to allow users to think and respond.

    Begin with:
    "Welcome to your AI Sales Coach. What skill would you like to practice today? You can choose from: Cold Calling, Handling Objections, Demo Pitching, Closing, or Upselling."

    Act according to these instructions:
    `;

    const scenarioPrompt = scenarioDetails?.prompt?.trim();
    const mode = scenarioDetails?.mode?.trim();
    const systemPrompt = scenarioPrompt
      ? `${baseSystemPrompt}\n\n---\n\nScenario Instructions:\n${scenarioPrompt}\n\n---\n\nMode: ${mode}`
      : baseSystemPrompt;

    console.log("Generating LLM response...");
    
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
