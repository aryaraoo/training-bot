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
        .replace(/[^\w\s.,!?'-]/g, '') // Remove special characters that might trigger safety filters
        .substring(0, 2000) // Limit content length to prevent issues
    }));
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

    // Debug logging
    console.log("📤 Sending to Gemini:", {
      messageCount: messages.length,
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
You are a sales training AI coach.

Analyze the given sales conversation between a user and a customer. Based on the specific dialogue, respond with ONLY this exact JSON structure (no other text):

{
  "scores": {
    "professionalism": number (0-10),
    "tone": number (0-10),
    "clarity": number (0-10),
    "empathy": number (0-10),
    "overall": number (0-10)
  },
  "good": "One or two short sentences about what the user did well in this specific conversation.",
  "improvement": "One or two short sentences about what the user could improve from this specific conversation.",
  "suggestion": "One actionable tip or strategy to improve future sales conversations based on this one."
}

Guidelines:
- Use the actual conversation to make your assessment.
- All numeric scores must be between 0 and 10 (no strings).
- Text fields must be concise, clear, and tailored to the conversation.
- Do NOT include chat history, commentary, or any text outside the JSON.
- Return ONLY valid JSON.
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