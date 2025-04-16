// --- Imports ---
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// --- Constants ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "localhost";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest";

// --- Validation ---
if (!GOOGLE_API_KEY) {
    console.error("FATAL ERROR: GOOGLE_API_KEY environment variable is not set.");
    process.exit(1);
}

// --- Express App Initialization ---
const app = express();
app.set('trust proxy', 1)

// --- Middleware ---

const corsOptions = {
  origin: '*',
  methods: 'GET,POST,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body Parsing
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/ai-chat', limiter);

// --- Gemini Client Setup ---
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

const generationConfig = {
     temperature: 0.4,
     topK: 1,
     topP: 1,
     maxOutputTokens: 2048,
};

// Define safety settings
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Get the specific model instance
const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL_NAME,
    generationConfig,
    safetySettings
});

// Conversation History
function formatHistoryForGemini(history = []) {
  if (!Array.isArray(history)) {
      console.warn("Received non-array history, defaulting to empty.");
      return [];
  }
  return history
    .map(message => {
      if (!message || typeof message.role !== 'string' || typeof message.content !== 'string' || !message.content.trim()) {
          console.warn("Skipping invalid message in history:", message);
          return null;
      }
      const role = message.role === 'assistant' ? 'model' : 'user';
      return {
        role: role,
        parts: [{ text: message.content.trim() }]
      };
    })
    .filter(msg => msg !== null);
}

// --- API Routes ---
// Chat Endpoint (POST) - Stateless
app.post("/ai-chat", async (req, res) => {  const { prompt, history } = req.body;

  // --- Input Validation ---
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: "Bad Request: 'prompt' is required and must be a non-empty string." });
  }
  try {
    console.log(`Received prompt: "${prompt}" with history length: ${history?.length || 0}`);
    const geminiHistory = formatHistoryForGemini(history);

    const contents = [
        ...geminiHistory,
        { role: "user", parts: [{ text: prompt.trim() }] }
    ];

    // --- Call Gemini API ---
    console.log(`Calling Gemini with model ${GEMINI_MODEL_NAME}...`);
    const result = await model.generateContent({ contents });

    // --- Process Gemini Response ---
    const response = result?.response;
    const candidate = response?.candidates?.[0];
    const blockReason = response?.promptFeedback?.blockReason;
    const safetyRatings = candidate?.safetyRatings;

    if (blockReason) {
        console.error(`Gemini request blocked. Reason: ${blockReason}`, { promptFeedback: response.promptFeedback });
        return res.status(400).json({
            error: `Request blocked due to safety settings. Reason: ${blockReason}. Please modify your prompt.`,
            details: `Block Reason: ${blockReason}`
        });
    }

    if (!candidate || candidate.finishReason === 'STOP' && (!candidate.content?.parts || candidate.content.parts.length === 0)) {
        console.error("Gemini response finished but has no content or invalid structure.", { candidate });
         const finishReason = candidate?.finishReason;
         const finishMessage = candidate?.finishMessage;
         let errorMessage = "Failed to generate a response.";
         if(finishReason) errorMessage += ` Finish Reason: ${finishReason}.`;
         if(finishMessage) errorMessage += ` Message: ${finishMessage}.`;
         if(safetyRatings) errorMessage += ` Safety Ratings: ${JSON.stringify(safetyRatings)}`;

        return res.status(500).json({ error: errorMessage });
    }

    if (!candidate.content?.parts?.[0]?.text) {
         console.error("Gemini response structure unexpected or text part is missing.", { candidate });
         return res.status(500).json({ error: "Received an unexpected response format from the AI service." });
    }

    const messageContent = candidate.content.parts[0].text;
    console.log(`Gemini response received successfully.`);

    res.status(200).json({ message: messageContent });

  } catch (error) {
    console.error("--- ERROR in /ai-chat ---");
    console.error("Timestamp:", new Date().toISOString());
    console.error("Request Body:", req.body);
    console.error("Error Message:", error.message);
    console.error("Error Stack:", error.stack);
    if (error.response?.data) {
        console.error("Google API Error Details:", error.response.data);
    }
    console.error("--- END ERROR ---");

    res.status(500).json({ error: `Internal Server Error: Failed to process chat request. ${error.message || ''}`.trim() });
  }
});



// --- Static File Serving ----
const clientBuildPath = path.join(__dirname, "..", "client", "dist");

if (fs.existsSync(clientBuildPath)) {
    console.log(`Serving static files from: ${clientBuildPath}`);
    app.use(
        express.static(clientBuildPath, {
            maxAge: "1d",
        })
    );

    // SPA Fallback
    app.get("*", (req, res) => {
        const indexPath = path.join(clientBuildPath, "index.html");
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
             console.warn(`index.html not found in ${clientBuildPath}`);
             res.status(404).send('Client application entry point (index.html) not found.');
        }
    });
} else {
    console.warn(`Client build directory not found at: ${clientBuildPath}`);

    app.get("/", (req, res) => {
        res.send(`Server is running. API endpoint at /ai-chat (POST). Client build not found at ${clientBuildPath}.`);
    });
}

// --- Global Error Handler ----
app.use((err, req, res, next) => {
    console.error("--- UNHANDLED ERROR ---");
    console.error("Timestamp:", new Date().toISOString());
    console.error("Route:", req.method, req.originalUrl);
    console.error("Error:", err);
    console.error("--- END UNHANDLED ERROR ---");

    const statusCode = err.status || 500;
    const message = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;

    res.status(statusCode).json({ error: message });
});


// --- Start Server ---
app.listen(PORT, "0.0.0.0", () => {
  console.log(`------------------------------------------------------`);
  console.log(` Gemini Model: ${GEMINI_MODEL_NAME}`);
  console.log(` CORS Origin: ${corsOptions.origin}`);
  console.log(`------------------------------------------------------`);
  console.log(`DEPLOYED:`);
  console.log(`  http://${HOST}:${PORT}`);  console.log(`  https://chat.alexpariah.live`);
});
