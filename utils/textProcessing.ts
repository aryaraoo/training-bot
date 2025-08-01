// utils/textProcessing.ts

/**
 * Cleans text for text-to-speech by removing punctuation marks
 * that shouldn't be read aloud
 */
export function cleanTextForTTS(text: string): string {
  if (!text) return text;

  return text
    // Remove problematic punctuation marks that shouldn't be read
    .replace(/[*]/g, '') // Remove asterisks
    .replace(/[`]/g, '') // Remove backticks
    .replace(/[_]/g, ' ') // Replace underscores with spaces
    .replace(/[|]/g, ' ') // Replace pipes with spaces
    .replace(/[\\]/g, ' ') // Replace backslashes with spaces
    .replace(/[\/]/g, ' ') // Replace slashes with spaces
    
    // Keep natural punctuation but clean up excessive ones
    .replace(/[;]{2,}/g, ';') // Remove multiple semicolons
    .replace(/[!]{2,}/g, '!') // Remove multiple exclamation marks
    .replace(/[?]{2,}/g, '?') // Remove multiple question marks
    .replace(/[.]{2,}/g, '.') // Remove multiple periods
    
    // Add natural pauses for better speech flow
    .replace(/([.!?])\s+/g, '$1... ') // Add pause after sentences
    .replace(/([,;:])\s+/g, '$1 ') // Ensure proper spacing after punctuation
    
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim();
}

/**
 * Processes AI response text to make it more natural for speech
 */
export function processAIResponseForSpeech(text: string): string {
  if (!text) return text;

  let processed = text;

  // Remove markdown formatting
  processed = processed.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold text
  processed = processed.replace(/\*(.*?)\*/g, '$1'); // Italic text
  processed = processed.replace(/`(.*?)`/g, '$1'); // Code blocks
  processed = processed.replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Links

  // Remove common programming syntax
  processed = processed.replace(/function\s*\(/g, 'function');
  processed = processed.replace(/const\s+/g, '');
  processed = processed.replace(/let\s+/g, '');
  processed = processed.replace(/var\s+/g, '');

  // Clean punctuation
  processed = cleanTextForTTS(processed);

  return processed;
} 