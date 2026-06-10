require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");
const axios = require("axios");

const app = express();
app.use(express.json());

const ai = new OpenAI({
  apiKey: process.env.AICREDITS_API_KEY,
  baseURL: "https://api.aicredits.in/v1",
});

const conversations = {};
const userState = {};
const MAX_HISTORY = 20;
const CLINIC_NUMBER = "919526271338";

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the AI Assistant for ABCD Beauty Clinic & Salon.

LANGUAGE DETECTION — THIS IS THE MOST IMPORTANT RULE
Look at the user's CURRENT message language and reply in THAT language:

- If the user writes in English → reply in English
- If the user writes in Malayalam script (like: നമസ്കാരം, എന്താണ്, ഉണ്ടോ) → reply in Malayalam script
- If the user writes in Manglish (Malayalam words in English letters like: "enthanu", "undoo", "venam", "cheyyano", "paranjaal", "enikk", "njan") → reply in Manglish ONLY

MANGLISH RULES — VERY IMPORTANT
Manglish means Malayalam words written using English/Latin letters. Examples:
- "Enikk hair spa venam" → reply: "Hair spa undoo! Ladies nu Rs.1200 muthal starting aanu 😊 Evideyaanu branch?"
- "Booking cheyyano?" → reply: "Athe, booking cheyyaam! Peru paranjaal mathi 😊"
- "Enthanu charge?" → reply: "Hair cut nu Rs.300 muthal starting aanu, hair length anusar vary cheyyum 😊"
Use only common everyday Manglish words. Do NOT invent strange words. Keep it natural like how a Kerala person actually texts.

NEVER switch languages mid-reply. If user wrote in Manglish, entire reply must be in Manglish. If user wrote in Malayalam script, entire reply in Malayalam script. If user wrote in English, entire reply in English.

PERSONALITY
- Warm, friendly, like a helpful receptionist
- Short replies — 2 to 4 sentences max unless listing services
- No bullet points or long paragraphs — this is WhatsApp
- Maximum 1–2 emojis per reply

LOCATIONS — MEMORIZE THESE EXACTLY
1. ചേർക്കള, കാഞ്ഞങ്ങാട്, കാസർഗോഡ് — GENTS ONLY (Cherkala branch)
2. കാഞ്ഞങ്ങാട്, കാസർഗോഡ് — GENTS AND LADIES (Kanhangad main branch)

CORRECT SPELLINGS ONLY:
- ചേർക്കള (NOT ചേർത്തല — that is WRONG, never use it)
- കാഞ്ഞങ്ങാട്

CONTACT & HOURS
Phone: 7012121125
Ladies Section: 10:00 AM – 10:00 PM (all days)
Gents Section: 10:00 AM – 12:00 AM midnight (all days)
Open all 7 days including Sundays and public holidays.
24-hour service: pre-booked appointments only.

WHEN SOMEONE ASKS TO CALL OR SPEAK TO TEAM
Reply: "Our team will call you back shortly! You can also reach us directly at 7012121125 😊"
(Adjust language based on user's language)

WHEN BOT IS CONFUSED OR DOESN'T KNOW
Always say: "For this, please contact our team directly at 7012121125 😊"
Never make up information.

SERVICE KNOWLEDGE
When users ask "what is this", "benefits", "how does it work" — use your own general knowledge about beauty treatments to explain naturally. Then relate it to ABCD's service and pricing.

BOOKING FLOW
Collect these one by one, naturally in conversation:
1. Full name
2. Location — Cherkala (Gents only) or Kanhangad (Gents & Ladies)
3. Service(s) they want
4. Preferred date (today is provided below — use it to resolve "tomorrow", "today" etc)
5. Preferred time
6. Ladies or Gents section (only ask if they chose Kanhangad)

Once all details collected, reply with:
"Thank you [Name]! ✅ Booking request received. Our team will contact you shortly to confirm. For urgent bookings call 7012121125 😊"
(In the user's language)

Never confirm or guarantee a slot yourself.

PRICING RULES
- Prices marked with "+" → always say "starting from"
- Hair-length dependent services → say price depends on hair length
- Special packages → direct to 7012121125

KNOWLEDGE BASE
================================================================
LADIES SERVICES
================================================================
HAIRCUT: U Cut Rs.400, V Cut Rs.400, Straight Cut Rs.300, Layer Cut Rs.600, Step Cut Rs.600, Feathered Cut Rs.700, Bob Cut Rs.700, Blend Cut Rs.600, Pixie Cut Rs.800, Inverted Bob Rs.800, Graduated Bob Rs.800

HAIR COLOUR: Global Rs.2200, Route Touch Up Rs.1500, Highlights per strip Rs.300, Highlights With Pre Light Rs.400, Fashion Global Rs.3000+, Balayage Rs.4000+, Ombre Rs.3500+

HAIR TREATMENTS: Hair Ironing Rs.1000+, Tong Ironing Curls Rs.1500+, Hair Spa Nourishing Rs.1200+, Protein Rs.2000, Moroccan Rs.2500, Anti Dandruff Basic Rs.2000, Premium Rs.2500, Smoothening Rs.4000, Keratin Rs.6000, Botox Rs.7000, Kera Smooth Rs.10000, Crown Smoothening Rs.3000

KIDS HAIRCUT: Layer Cut Rs.600, Bob Cut Rs.500, Butterfly Rs.700, Feather Cut Rs.700, U/V/Straight Rs.400+, Baby Cut Rs.200-300, Hair Wash Rs.200+

MANICURE & PEDICURE: Ordinary Pedicure Rs.900/Manicure Rs.500, Classic Pedicure Rs.1300/Manicure Rs.700, Premium Pedicure Rs.2000/Manicure Rs.1500, Leg Massage 30min Rs.900+

WAXING: Half Arm Rs.500, Half Leg Rs.700, Full Arm Rs.800, Full Leg Rs.1200, Full Body Rs.4000, Upper Lip Rs.150, Full Face Rs.500, Under Arms Rs.500

FACE TREATMENT: Cleanup Basic Rs.600, Premium Rs.1000, De Tan Basic Rs.500, Premium Rs.1000, Glow Cleanup Rs.1500, Bleach Rs.400, Face Massage Rs.800+

SKIN TREATMENT: Basic Facial Rs.1500, Premium Rs.2500, Luxury Rs.4000, Hydra Facial Rs.4000, Hydra Treatment Rs.5000, Hydra Premium Rs.8000

AESTHETIC CLINICAL: Hydra Facial Rs.3500, Carbon Laser Rs.6000, IPL Photolaser Rs.5500, IPL Hair Removal Rs.1500, Micro Needling Face Rs.6000, Micro Needling Hair Rs.6000, Mesotherapy Rs.4000, BB Glow Rs.6000, Chemical Peel Rs.2000+, Oxygeno Rs.6000, Skin Tightening Rs.3000, Tattoo Removal Rs.2500, Micro Blading Rs.10000/8000/4000 (3 sittings), Lip Neutralizing Rs.4000, Lip Colouring Rs.6000, Eye Brow Shading Rs.4000

BRIDAL PACKAGES: Silver Rs.5999, Platinum Rs.9999, Diamond Rs.14999
MAKEOVER: Bridal, Party, Reception — price on request

================================================================
GENTS SERVICES
================================================================
HAIRCUT: Classic Cut Rs.200, Beard Rs.200, Cut+Shave Rs.350, Luxury Cut Rs.300, Luxury Cut+Shave+Wash Rs.500

HAIR STYLING: Wash Rs.100, Setting Rs.150, Blow Dry+Setting Rs.200, Blow Dry+Powder Rs.400, Blow Dry+Fiber Rs.500

HAIR SPA: Basic Rs.1200+, Premium Rs.1500+, Moroccan Rs.2000+

DANDRUFF: Basic Rs.1500+, Premium Rs.2500+

SMOOTHENING & KERATIN: Smoothing Rs.1500+, Keratin Rs.4000+, Botox Rs.5000+, Kera Smooth Rs.6000+, Curling Rs.4500+

COLOUR: Gray Coverage Rs.800+, Ammonia Free Rs.1000+, Beard Rs.300+, Fashion Rs.1500+, Cap Highlights Rs.2000+

HEAD MASSAGE: Oil+Wash Rs.500, Normal Rs.300

MANICURE & PEDICURE: Same as ladies pricing above

FACE & SKIN TREATMENT: Same as ladies pricing above

GROOM PACKAGES: Glow Groom Rs.3700, Gold Glow Up Rs.5000, Booster Glow Up — price on request
MAKEOVER: Groom, Night Reception, Nikkah — price on request

ABCD SPECIAL PACKAGE: Full event package (salon+makeover+costume+photography+videography) — call 7012121125`;

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
async function sendWhatsAppMessage(to, message) {
  try {
    await axios.post(
      "https://backend.chatmitra.com/developer/api/send_message",
      {
        recipient_mobile_number: to,
        messages: [{ kind: "raw", payload: { type: "text", text: { body: message } } }],
        customer_name: ""
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.CHATMITRA_API_KEY}`
        }
      }
    );
    console.log(`Sent to ${to}: ${message.substring(0, 80)}`);
  } catch (err) {
    console.error("Failed to send:", err?.response?.data || err.message);
  }
}

// ─── SEND BOOKING NOTIFICATION ────────────────────────────────────────────────
async function sendBookingNotification(details) {
  const msg = `New Booking Request!\n\nName: ${details.name}\nPhone: ${details.phone}\nLocation: ${details.location}\nService: ${details.service}\nDate: ${details.date}\nTime: ${details.time}\nSection: ${details.section}`;
  await sendWhatsAppMessage(CLINIC_NUMBER, msg);
}
// ─── SERVICE MENU ─────────────────────────────────────────────────────────────
function getServiceMenu() {
  return `എന്ത് സർവീസ് ആണ് വേണ്ടത്? Type the number to select 😊\n\n1️⃣ Hair Services\n2️⃣ Skin & Facial\n3️⃣ Manicure & Pedicure\n4️⃣ Waxing\n5️⃣ Bridal / Groom Package\n6️⃣ Aesthetic Clinical Treatment\n7️⃣ Book an Appointment\n8️⃣ Other / General Question`;
}

function getLanguageMenu() {
  return `hi, ABCD Beauty Clinic & Salon-ലേക്ക് സ്വാഗതം! 🙏\n\nPlease select your language / ഭാഷ തിരഞ്ഞെടുക്കൂ\nType the number / നമ്പർ type ചെയ്യൂ:\n\n1️⃣ English\n2️⃣ മലയാളം\n3️⃣ Manglish`;
}

const serviceCategoryMap = {
  "1": "Hair Services",
  "2": "Skin & Facial",
  "3": "Manicure & Pedicure",
  "4": "Waxing",
  "5": "Bridal / Groom Package",
  "6": "Aesthetic Clinical Treatment",
  "7": "BOOKING",
  "8": "General"
};

// ─── AI REPLY ─────────────────────────────────────────────────────────────────
async function getAIReply(userPhone, userMessage, currentDate, serviceContext) {
  if (!conversations[userPhone]) conversations[userPhone] = [];

  conversations[userPhone].push({ role: "user", content: userMessage });

  if (conversations[userPhone].length > MAX_HISTORY) {
    conversations[userPhone] = conversations[userPhone].slice(-MAX_HISTORY);
  }

  const contextNote = serviceContext && serviceContext !== "General"
    ? `The user selected "${serviceContext}" from the service menu. Focus on this category.`
    : "";

  try {
    const response = await ai.chat.completions.create({
      model: "google/gemini-2.0-flash",
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nTODAY'S DATE: ${currentDate} (IST). Use this to resolve "today", "tomorrow", "this evening" etc.\n\n${contextNote}`
        },
        ...conversations[userPhone],
      ],
    });

    const reply = response.choices[0].message.content;
    conversations[userPhone].push({ role: "assistant", content: reply });
    return reply;

  } catch (err) {
    console.error("AI error:", err?.message || err);
    return "Sorry, ippol help cheyyaan pattunilla. Please contact: 7012121125 😊";
  }
}

// ─── DETECT BOOKING COMPLETE ──────────────────────────────────────────────────
function isBookingComplete(message) {
  return message.includes("booking request received") ||
    message.includes("Booking request received") ||
    message.includes("ബുക്കിംഗ്") ||
    message.includes("7012121125") && message.includes("confirm");
}

// ─── EXTRACT BOOKING DETAILS ──────────────────────────────────────────────────
async function extractBookingDetails(userPhone, customerPhone) {
  const history = (conversations[userPhone] || []).map(m => `${m.role}: ${m.content}`).join("\n");
  try {
    const response = await ai.chat.completions.create({
      model: "google/gemini-2.0-flash",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Extract booking details from this conversation. Return ONLY a JSON object with fields: name, location, service, date, time, section. Use "Not specified" for missing fields.\n\nConversation:\n${history}\n\nReturn only valid JSON.`
      }]
    });
    const raw = response.choices[0].message.content.replace(/```json|```/g, "").trim();
    const details = JSON.parse(raw);
    details.phone = customerPhone;
    return details;
  } catch {
    return { name: "Unknown", phone: customerPhone, location: "Not specified", service: "Not specified", date: "Not specified", time: "Not specified", section: "Not specified" };
  }
}

// ─── WEBHOOK ──────────────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;
    const from = body.from || body.sender || body.phone;
    const messageText = body.message?.text || body.message || body.text || body.body;
    const messageType = body.message?.type || body.type || "text";

    if (!from) return;

    // Voice message
    if (messageType === "audio") {
      await sendWhatsAppMessage(from, "Sorry, voice messages process cheyyaan pattilla 😊 Please type cheyyoo, help cheyyaam! Or call us: 7012121125");
      return;
    }

    // Image/document
    if (messageType === "image" || messageType === "document") {
      await sendWhatsAppMessage(from, "Images/files support cheyyunilla 😊 Type aayi message cheyyoo!");
      return;
    }

    if (!messageText || messageType !== "text") return;

    const trimmed = messageText.trim();
    console.log(`Message from ${from}: ${trimmed}`);

    // Init user state
    if (!userState[from]) {
      userState[from] = { stage: "language_select", serviceContext: null };
    }

    const state = userState[from];
    const currentDate = new Date().toLocaleDateString("en-IN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata"
    });

    // ── Stage: Language selection ──
    if (state.stage === "language_select") {
      if (trimmed === "1" || trimmed === "2" || trimmed === "3") {
        state.stage = "service_select";
        await sendWhatsAppMessage(from, getServiceMenu());
      } else {
        await sendWhatsAppMessage(from, getLanguageMenu());
      }
      return;
    }

    // ── Stage: Service selection ──
    if (state.stage === "service_select") {
      if (serviceCategoryMap[trimmed]) {
        state.serviceContext = serviceCategoryMap[trimmed];
        state.stage = "chat";

        if (trimmed === "7") {
          const reply = await getAIReply(from, "I want to book an appointment", currentDate, "BOOKING");
          await sendWhatsAppMessage(from, reply);
        } else {
          const reply = await getAIReply(from, `Tell me about ${serviceCategoryMap[trimmed]} services and pricing at ABCD`, currentDate, serviceCategoryMap[trimmed]);
          await sendWhatsAppMessage(from, reply);
        }
      } else {
        // Didn't pick a valid number — treat as chat directly
        state.stage = "chat";
        state.serviceContext = "General";
        const reply = await getAIReply(from, trimmed, currentDate, "General");
        await sendWhatsAppMessage(from, reply);
      }
      return;
    }

    // ── Stage: Normal chat (language auto-detected per message) ──
    if (state.stage === "chat") {
      const reply = await getAIReply(from, trimmed, currentDate, state.serviceContext);
      await sendWhatsAppMessage(from, reply);

      // Check booking complete → notify clinic
      console.log("Checking booking complete. Reply was:", reply.substring(0, 100));
      console.log("isBookingComplete result:", isBookingComplete(reply));
      if (isBookingComplete(reply)) {
        console.log("Booking detected! Extracting details...");
        const details = await extractBookingDetails(from, from);
        console.log("Booking details:", JSON.stringify(details));
        await sendBookingNotification(details);
        console.log("Booking notification sent to clinic!");
      }
    }

  } catch (err) {
    console.error("Webhook error:", err.message);
  }
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "ABCD Bot running 🟢" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ABCD WhatsApp Bot running on port ${PORT}`));
