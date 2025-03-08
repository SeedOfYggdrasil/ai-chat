require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const https = require("https");
const OpenAI = require('openai');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "localhost";
const conversation = [];

const app = express();

app.set('trust proxy', 1);

// Middleware
const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json());

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});
app.use(limiter);

const apiURL = process.env.API_URL;
const apiKEY = process.env.
const openai = new OpenAI({
  baseURL: apiURL,
  apiKey: 'ollama',
})

// Chat API
app.post("/ai-chat", async (req, res) => {
  try {
    const { prompt, model, history } = req.body;
    const messages = [...history, { role: "user", content: prompt }];

    const completion = await openai.chat.completions.create({
      model: model || process.env.MODEL,
      messages: messages,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const messageContent = completion.choices[0]?.message?.content;
    conversation.push(messageContent);

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ message: messageContent });

  } catch (error) {
    console.error("Error:", error.completion?.data || error.message);

    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: "Server Error" });
  }
});

// Conversation History API
app.get("/ai-chat", (req, res) => {
  res.status(200).json({ messages: conversation });
});

// Serve Client Build Files
app.use(
  express.static(path.join(__dirname, "..", "client", "dist"), {
    maxAge: "1d",
  })
);

// Fallback for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "dist", "index.html"), {
    cacheControl: true,
  });
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server Status: LIVE ( http://${HOST}:${PORT} )`);
});
