require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");
const axios = require("axios");

const app = express();
app.use(express.json());

// ─── AICREDITS CLIENT ─────────────────────────────────────────────────────────
const ai = new OpenAI({
  apiKey: process.env.AICREDITS_API_KEY,
  baseURL: "https://api.aicredits.in/v1",
});

// In-memory state per user
const conversations = {};
const userState = {}; // tracks language, location, booking step

const MAX_HISTORY = 20;
const CLINIC_NUMBER = "917012121125";

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the AI Assistant for ABCD Beauty Clinic & Salon.

CORE PERSONALITY
- Warm, friendly, helpful — like a knowledgeable receptionist who genuinely cares
- Never robotic or scripted — talk like a real person
- Short replies — 2 to 4 sentences max unless listing services
- No bullet points or long paragraphs — this is WhatsApp
- Use 1–2 emojis maximum per reply, only where natural

LANGUAGE RULES
- Always reply in the language the user has selected
- English: reply in clean simple English
- Malayalam: reply in proper Malayalam script
- Manglish: reply in Malayalam words written in English letters ONLY (e.g. "enthanu charge", "booking cheyyano", "hair spa undoo") — NEVER use Malayalam script for Manglish
- Never mix scripts unless user does first

LOCATIONS
There are TWO branches:
1. ചേർക്കള, കാഞ്ഞങ്ങാട്, കാസർഗോഡ് — GENTS ONLY
2. കാഞ്ഞങ്ങാട്, കാസർഗോഡ് — GENTS AND LADIES (main branch)
Always spell correctly: ചേർക്കള and കാഞ്ഞങ്ങാട്
Never say ചേർത്തല — that is WRONG.

CONTACT
Phone: 7012121125
Instagram: @abcdbeautyclinic
Email: abcdbeautyclinic@gmail.com
Website: https://abcd-beauty-clinic-website.vercel.app/

WORKING HOURS
Ladies Section: 10:00 AM to 10:00 PM (Open All Days)
Gents Section: 10:00 AM to 12:00 AM (Open All Days)
24-Hour Service: Available ONLY for pre-booked appointments.
Open all 7 days including Sundays and public holidays.

SERVICE KNOWLEDGE
When users ask about benefits, details, or "what is this service" — use your own general knowledge about beauty treatments to explain naturally. Don't just say "check with our team." Give real helpful answers about what keratin does, what hydra facial feels like, what smoothening involves etc. Then relate it back to ABCD's offering.

BOOKING FLOW
Collect these one by one naturally:
1. Full name
2. Location (Cherkala or Kanhangad)
3. Service(s) they want
4. Preferred date (use current date context to resolve "tomorrow", "today" etc)
5. Preferred time
6. Ladies or Gents section (only for Kanhangad)

Once all collected, confirm with:
"Thank you [Name]! ✅ Booking request received. Our team will contact you shortly to confirm. For urgent bookings call 7012121125 😊"

Never confirm or guarantee slots yourself.

BEHAVIOUR RULES
1. Prices with "+" — always say "starting from"
2. Hair-length dependent — say price depends on hair length
3. Special packages — direct to 7012121125
4. Never promise slots — team confirms
5. Unknown questions — direct to 7012121125
6. Never mention competitors
7. Never make up information

KNOWLEDGE BASE
================================================================
LADIES SERVICES & PRICING
================================================================

LADIES HAIRCUT
Classic: U Cut Rs.400, V Cut Rs.400, Straight Cut Rs.300
Advanced (with Hairwash): Layer Cut Rs.600, Step Cut Rs.600, Feathered Cut Rs.700
Premium (with Hairwash & Hairsetting): Bob Cut Rs.700, Blend Cut Rs.600, Pixie Cut Rs.800, Inverted Bob Rs.800, Graduated Bob Rs.800

LADIES HAIR COLOUR
Standard: Hair Colour Global Rs.2200, Route Touch Up Rs.1500, Highlights per strip Rs.300, Highlights With Pre Light Rs.400
Fashion Shade: Global Rs.3000+, Balayage Rs.4000+, Ombre Rs.3500+

LADIES HAIR TREATMENTS
Styling: Hair Ironing Rs.1000+, Tong Ironing Curls Rs.1500+
Hair Spa: Nourishing Rs.1200+, Protein Rs.2000, Moroccan Rs.2500
Dandruff: Anti Dandruff Basic Rs.2000, Premium Rs.2500, Hair Wash Dryer Set Rs.500
Smoothening & Keratin: Smoothening Rs.4000, Keratin Rs.6000, Botox Rs.7000, Kera Smooth Rs.10000, Crown Portion Smoothening Rs.3000, Route Touch Up Rs.3500

KIDS HAIRCUT
Layer Cut Rs.600, Bob Cut Rs.500, Butterfly Rs.700, Feather Cut Rs.700, U/V/Straight Cut Rs.400+, Baby Cut Rs.200-300, Only Hair Wash Rs.200+

LADIES MANICURE & PEDICURE
Ordinary: Pedicure Rs.900, Manicure Rs.500
Classic: Pedicure Rs.1300, Manicure Rs.700
Premium: Pedicure Rs.2000, Manicure Rs.1500
Other: Only Cutting Falling Rs.200+, Leg Massage 30 mins Rs.900+

WAXING
Reca Wax: Half Arm Rs.500, Half Leg Rs.700, Full Arm Rs.800, Full Leg Rs.1200, Full Body Rs.4000, Back And Front Rs.800
Brazilian Wax: Upper Lip Rs.150, Fore Head Rs.150, Side Lock Rs.150, Chin Rs.150, Full Face Rs.500, Under Arms Rs.500

LADIES FACE TREATMENT
Cleanup Basic Rs.600, Cleanup Premium Rs.1000, De Tan Basic Rs.500, De Tan Premium Rs.1000, Glow Cleanup Rs.1500, Bleach Rs.400, Full Arm De Tan/Bleach Rs.800, Full Leg De Tan/Bleach Rs.1000, Face Massage Rs.800+

LADIES SKIN TREATMENT
Basic Facial Rs.1500, Premium Facial Rs.2500, Luxury Facial Rs.4000, Groom Official Rs.4000, Hydra Facial Rs.4000, Hydra Treatment Rs.5000, Hydra Premium with Hair Spa Rs.8000

LADIES AESTHETIC CLINICAL TREATMENT
Hydra Facial Rs.3500, Hydra Treatment Basic Rs.5000, Hydra Treatment Premium Rs.8000, Medi Facial Tan Rs.2000, Carbon Laser Toning Rs.6000, IPL Photolaser Rs.5500, IPL Hair Removal Laser Rs.1500, Micro Needling For Face Rs.6000, Micro Needling For Hair Rs.6000, Mesotherapy Treatment Rs.4000, B.B Glow Treatment Rs.6000, L.L.L Therapy Rs.1500, Chemical Peel from Rs.2000, Oxygeno Treatment Rs.6000, Medi Cleanup Facial Rs.1500, Saggy Skin Tightening Rs.3000, Tattoo Removal Rs.2500, Micro Blading Rs.10000/Rs.8000/Rs.4000 (3 sittings), Lip Neutralizing Rs.4000, Lip Colouring Rs.6000, Lip Contouring Rs.2000, Eye Brow Shading Rs.4000, Beauty Spot Rs.500

LADIES BRIDAL PACKAGES
Silver Rs.5999: O3 Facial, Classic Pedicure/Manicure, Face & Neck D-Tan, Hair Spa
Platinum Rs.9999: Radiation Facial, Luxury Pedicure, Luxury Spa, Full Arm/Full Leg/Under Arm, D-Tan Back/Face & Neck
Diamond Rs.14999: Microderm Facial, Luxury Pedi/Mani, Full Body D-Tan, Back Polishing, Advanced Hair Cut, Full Face Threading

LADIES MAKEOVER
Bridal, Party, Reception Make-Up — Price depending on client

================================================================
GENTS SERVICES & PRICING
================================================================

GENTS HAIRCUT
Classic: Haircut Rs.200, Beard Rs.200, Cutting + Shaving Rs.350
Luxury: Cutting Rs.300, Beard Rs.300, Cutting + Shaving with hairwash Rs.500

GENTS HAIR STYLING
Hair Wash Rs.100, Hair Setting Rs.150, Blow Dry With Hair Setting Rs.200, Blow Dry With Hair Powder Rs.400, Blow Dry With Hair Fiber Rs.500

GENTS HAIR SPA
Spa Basic Rs.1200+, Spa Premium Rs.1500+, Moroccan Spa Rs.2000+

GENTS DANDRUFF
Anti Dandruff Basic Rs.1500+, Anti Dandruff Premium Rs.2500+

GENTS SMOOTHENING & KERATIN
Smoothing Rs.1500+, Keratin Rs.4000+, Botox Rs.5000+, Kera Smooth Rs.6000+, Curling Rs.4500+

GENTS COLOUR
Hair Colour Gray Coverage Rs.800+, Ammonia Free Rs.1000+, Beard Colour Rs.300+, Fashion Colour Rs.1500+, Cap Highlights Rs.2000+, Colour Basic Hair Gel Rs.400+, Beard Basic Gel Rs.250+

GENTS HEAD MASSAGE
Oil Massage With Wash Rs.500, Normal Massage Rs.300

GENTS MANICURE & PEDICURE
Ordinary: Pedicure Rs.900, Manicure Rs.500
Classic: Pedicure Rs.1300, Manicure Rs.700
Premium: Pedicure Rs.2000, Manicure Rs.1500

GENTS FACE TREATMENT
Cleanup Basic Rs.600, Cleanup Premium Rs.1000, De Tan Basic Rs.500, De Tan Premium Rs.1000, Glow Cleanup Rs.1500, Bleach Rs.400, Full Arm De Tan/Bleach Rs.800, Full Leg De Tan/Bleach Rs.1000, Face Massage Rs.800+

GENTS SKIN TREATMENT
Basic Facial Rs.1500, Premium Facial Rs.2500, Luxury Facial Rs.4000, Groom Official Rs.4000, Hydra Facial Rs.4000, Hydra Treatment Rs.5000, Hydra Premium with Hair Spa Rs.8000

GENTS AESTHETIC CLINICAL TREATMENT
Hydra Facial Rs.3500, Hydra Treatment Basic Rs.5000, Hydra Treatment Premium Rs.8000, Medi Facial Tan Rs.2000, Carbon Laser Toning Rs.6000, IPL Photolaser Rs.5500, IPL Hair Removal Laser Rs.1500, Micro Needling For Face Rs.6000, Micro Needling For Hair Rs.6000, Mesotherapy Treatment Rs.4000, B.B Glow Treatment Rs.6000, L.L.L Therapy Rs.1500, Chemical Peel from Rs.2000, Oxygeno Treatment Rs.6000, Medi Cleanup Facial Rs.1500, Saggy Skin Tightening Rs.3000, Tattoo Removal Rs.2500, Micro Blading Rs.10000/Rs.8000/Rs.4000 (3 sittings), Lip Neutralizing Rs.4000, Lip Colouring Rs.6000, Lip Contouring Rs.2000, Eye Brow Shading Rs.4000, Beauty Spot Rs.500

GENTS GROOM PACKAGES
Glow Groom Rs.3700: Hair Spa, Facial, Cutting and Shaving complimentary
Gold Glow Up Rs.5000: Hair Spa, Facial, Cutting and Shaving complimentary
Booster Glow Up: Price on request

GENTS MAKEOVER
Groom, Night Reception, Nikkah Makeup — Price depending on client

ABCD SPECIAL PACKAGE (BOTH)
Includes: Package + Makeover + Costume + Event + Photography + Videography
Price: Depending on requirements. Call 7012121125.`;

// ─── SEND MESSAGE VIA CHATMITRA ──────────────────────────────────────────────
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
    console.log(`Sent to ${to}: ${message.substring(0, 80)}...`);
  } catch (err) {
    console.error("Failed to send message:", err?.response?.data || err.message);
  }
}

// ─── SEND BOOKING NOTIFICATION TO CLINIC ─────────────────────────────────────
async function sendBookingNotification(bookingDetails) {
  const msg = `🔔 *New Booking Request!*\n\n👤 Name: ${bookingDetails.name}\n📱 Phone: ${bookingDetails.phone}\n📍 Location: ${bookingDetails.location}\n💆 Service: ${bookingDetails.service}\n📅 Date: ${bookingDetails.date}\n⏰ Time: ${bookingDetails.time}\n👥 Section: ${bookingDetails.section}`;
  await sendWhatsAppMessage(CLINIC_NUMBER, msg);
}

// ─── LANGUAGE SELECTION MESSAGE ───────────────────────────────────────────────
function getLanguageMenu() {
  return `hi, ABCD Beauty Clinic & Salon-ലേക്ക് സ്വാഗതം! 🙏\n\nPlease select your language / ഭാഷ തിരഞ്ഞെടുക്കൂ:\n\n1️⃣ English\n2️⃣ മലയാളം\n3️⃣ Manglish`;
}

// ─── SERVICE MENU ─────────────────────────────────────────────────────────────
function getServiceMenu(lang) {
  if (lang === "malayalam") {
    return `ഏത് സർവീസ് ആണ് വേണ്ടത്? 😊\n\n1️⃣ Hair Services\n2️⃣ Skin & Facial\n3️⃣ Manicure & Pedicure\n4️⃣ Waxing\n5️⃣ Bridal / Groom Package\n6️⃣ Aesthetic Clinical Treatment\n7️⃣ Booking\n8️⃣ മറ്റുള്ളവ / Other`;
  } else if (lang === "manglish") {
    return `Enthu service aano vendum? 😊\n\n1️⃣ Hair Services\n2️⃣ Skin & Facial\n3️⃣ Manicure & Pedicure\n4️⃣ Waxing\n5️⃣ Bridal / Groom Package\n6️⃣ Aesthetic Clinical Treatment\n7️⃣ Booking\n8️⃣ Mattullava / Other`;
  } else {
    return `What service are you looking for? 😊\n\n1️⃣ Hair Services\n2️⃣ Skin & Facial\n3️⃣ Manicure & Pedicure\n4️⃣ Waxing\n5️⃣ Bridal / Groom Package\n6️⃣ Aesthetic Clinical Treatment\n7️⃣ Booking\n8️⃣ Other`;
  }
}

// ─── SERVICE CATEGORY MAP ─────────────────────────────────────────────────────
const serviceCategoryMap = {
  "1": "Hair Services",
  "2": "Skin & Facial",
  "3": "Manicure & Pedicure",
  "4": "Waxing",
  "5": "Bridal / Groom Package",
  "6": "Aesthetic Clinical Treatment",
  "7": "BOOKING",
  "8": "Other"
};

// ─── GET AI REPLY ─────────────────────────────────────────────────────────────
async function getAIReply(userPhone, userMessage, currentDate, language, serviceContext) {
  if (!conversations[userPhone]) {
    conversations[userPhone] = [];
  }

  conversations[userPhone].push({ role: "user", content: userMessage });

  if (conversations[userPhone].length > MAX_HISTORY) {
    conversations[userPhone] = conversations[userPhone].slice(-MAX_HISTORY);
  }

  const langInstruction = language === "malayalam"
    ? "IMPORTANT: Reply ONLY in Malayalam script."
    : language === "manglish"
    ? "IMPORTANT: Reply ONLY in Manglish — Malayalam words written in English letters. NEVER use Malayalam script."
    : "IMPORTANT: Reply ONLY in English.";

  const serviceInstruction = serviceContext
    ? `The user has selected the "${serviceContext}" category. Focus your response on this service category.`
    : "";

  try {
    const response = await ai.chat.completions.create({
      model: "google/gemini-2.0-flash",
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT + `\n\nCURRENT DATE & TIME: ${currentDate} (IST). Use this to understand "tomorrow", "today", "this evening" etc.\n\n${langInstruction}\n\n${serviceInstruction}`
        },
        ...conversations[userPhone],
      ],
    });

    const reply = response.choices[0].message.content;
    conversations[userPhone].push({ role: "assistant", content: reply });
    return reply;

  } catch (err) {
    console.error("AI API error:", err?.message || err);
    return language === "malayalam"
      ? "ക്ഷമിക്കണം, ഇപ്പോൾ സഹായിക്കാൻ കഴിയുന്നില്ല. നേരിട്ട് വിളിക്കൂ: 7012121125 😊"
      : language === "manglish"
      ? "Sorry, ippo help cheyyaan pattunilla. Directly call cheyyoo: 7012121125 😊"
      : "Sorry, our assistant is temporarily unavailable. Please call: 7012121125 😊";
  }
}

// ─── DETECT BOOKING COMPLETE ──────────────────────────────────────────────────
function detectBookingComplete(message) {
  return message.includes("booking request has been received") ||
    message.includes("Booking request received") ||
    message.includes("ബുക്കിംഗ് request received") ||
    message.includes("booking request received");
}

// ─── EXTRACT BOOKING DETAILS FROM CONVERSATION ───────────────────────────────
async function extractBookingDetails(userPhone, customerPhone) {
  const history = conversations[userPhone] || [];
  const historyText = history.map(m => `${m.role}: ${m.content}`).join("\n");

  try {
    const response = await ai.chat.completions.create({
      model: "google/gemini-2.0-flash",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Extract booking details from this conversation and return ONLY a JSON object with these fields: name, location, service, date, time, section. If any field is missing use "Not specified".\n\nConversation:\n${historyText}\n\nReturn only valid JSON, nothing else.`
      }]
    });

    const raw = response.choices[0].message.content.replace(/```json|```/g, "").trim();
    const details = JSON.parse(raw);
    details.phone = customerPhone;
    return details;
  } catch (err) {
    return {
      name: "Unknown",
      phone: customerPhone,
      location: "Not specified",
      service: "Not specified",
      date: "Not specified",
      time: "Not specified",
      section: "Not specified"
    };
  }
}

// ─── WEBHOOK ──────────────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;
    console.log("Incoming webhook:", JSON.stringify(body, null, 2));

    const from = body.from || body.sender || body.phone;
    const messageText = body.message?.text || body.message || body.text || body.body;
    const messageType = body.message?.type || body.type || "text";

    if (!from) return;

    // Handle voice messages
    if (messageType === "audio") {
      await sendWhatsAppMessage(from, "Sorry, voice messages process cheyyaan pattilla 😊 Please type cheyyoo, help cheyyaam!");
      return;
    }

    // Handle image/document
    if (messageType === "image" || messageType === "document") {
      await sendWhatsAppMessage(from, "Images/files process cheyyaan pattilla 😊 Text aayi type cheyyoo!");
      return;
    }

    if (!messageText || messageType !== "text") return;

    console.log(`Message from ${from}: ${messageText}`);

    // ── Init user state ──
    if (!userState[from]) {
      userState[from] = { stage: "language_select", language: null, serviceContext: null };
    }

    const state = userState[from];
    const trimmed = messageText.trim();

    // ── STAGE 1: Language selection ──
    if (state.stage === "language_select") {
      if (trimmed === "1") {
        state.language = "english";
        state.stage = "service_select";
        await sendWhatsAppMessage(from, getServiceMenu("english"));
      } else if (trimmed === "2") {
        state.language = "malayalam";
        state.stage = "service_select";
        await sendWhatsAppMessage(from, getServiceMenu("malayalam"));
      } else if (trimmed === "3") {
        state.language = "manglish";
        state.stage = "service_select";
        await sendWhatsAppMessage(from, getServiceMenu("manglish"));
      } else {
        // First message — show greeting + language menu
        await sendWhatsAppMessage(from, getLanguageMenu());
      }
      return;
    }

    // ── STAGE 2: Service selection ──
    if (state.stage === "service_select") {
      if (serviceCategoryMap[trimmed]) {
        state.serviceContext = serviceCategoryMap[trimmed];
        state.stage = "chat";

        if (trimmed === "7") {
          // Directly start booking flow
          const currentDate = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata" });
          const reply = await getAIReply(from, "I want to book an appointment", currentDate, state.language, "BOOKING");
          await sendWhatsAppMessage(from, reply);
        } else {
          // Show AI response for selected category
          const currentDate = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata" });
          const reply = await getAIReply(from, `Tell me about ${serviceCategoryMap[trimmed]} services and pricing`, currentDate, state.language, serviceCategoryMap[trimmed]);
          await sendWhatsAppMessage(from, reply);
        }
      } else {
        // Didn't pick a number — show menu again
        await sendWhatsAppMessage(from, getServiceMenu(state.language));
      }
      return;
    }

    // ── STAGE 3: Normal chat ──
    if (state.stage === "chat") {
      const currentDate = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata" });
      const reply = await getAIReply(from, trimmed, currentDate, state.language, state.serviceContext);
      await sendWhatsAppMessage(from, reply);

      // Check if booking just completed
      if (detectBookingComplete(reply)) {
        const details = await extractBookingDetails(from, from);
        await sendBookingNotification(details);
        console.log("Booking notification sent to clinic!");
      }
    }

  } catch (err) {
    console.error("Webhook error:", err.message);
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ABCD WhatsApp Bot is running 🟢" });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ABCD WhatsApp Bot running on port ${PORT}`);
});
