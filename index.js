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
const CLINIC_NUMBER = "917012121125";

// ─── SEND PLAIN TEXT ──────────────────────────────────────────────────────────
async function sendText(to, message) {
  try {
    await axios.post(
      "https://backend.chatmitra.com/developer/api/send_message",
      {
        recipient_mobile_number: to,
        messages: [{ kind: "raw", payload: { type: "text", text: { body: message } } }],
        customer_name: ""
      },
      { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.CHATMITRA_API_KEY}` } }
    );
    console.log(`Text sent to ${to}: ${message.substring(0, 60)}`);
  } catch (err) {
    console.error("Failed to send text:", err?.response?.data || err.message);
  }
}

// ─── SEND INTERACTIVE BUTTONS (max 3) ────────────────────────────────────────
async function sendButtons(to, bodyText, buttons) {
  try {
    await axios.post(
      "https://backend.chatmitra.com/developer/api/send_message",
      {
        recipient_mobile_number: to,
        messages: [{
          kind: "raw",
          payload: {
            messaging_product: "whatsapp",
            to: to,
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: bodyText },
              action: {
                buttons: buttons.map(b => ({
                  type: "reply",
                  reply: { id: b.id, title: b.title }
                }))
              }
            }
          }
        }],
        customer_name: ""
      },
      { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.CHATMITRA_API_KEY}` } }
    );
    console.log(`Buttons sent to ${to}`);
  } catch (err) {
    console.error("Failed to send buttons:", err?.response?.data || err.message);
  }
}

// ─── SEND LIST MESSAGE (max 10 items) ────────────────────────────────────────
async function sendList(to, bodyText, buttonLabel, sections) {
  try {
    await axios.post(
      "https://backend.chatmitra.com/developer/api/send_message",
      {
        recipient_mobile_number: to,
        messages: [{
          kind: "raw",
          payload: {
            messaging_product: "whatsapp",
            to: to,
            type: "interactive",
            interactive: {
              type: "list",
              body: { text: bodyText },
              action: {
                button: buttonLabel,
                sections: sections
              }
            }
          }
        }],
        customer_name: ""
      },
      { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.CHATMITRA_API_KEY}` } }
    );
    console.log(`List sent to ${to}`);
  } catch (err) {
    console.error("Failed to send list:", err?.response?.data || err.message);
  }
}

// ─── SEND BOOKING NOTIFICATION ────────────────────────────────────────────────
async function sendBookingNotification(details) {
  const msg = `New Booking Request!\n\nName: ${details.name}\nPhone: ${details.phone}\nLocation: ${details.location}\nSection: ${details.section}\nService: ${details.service}\nDate: ${details.date}\nTime: ${details.time}`;
  await sendText(CLINIC_NUMBER, msg);
}

// ─── LANGUAGE MENU ────────────────────────────────────────────────────────────
async function sendLanguageMenu(to) {
  await sendButtons(to,
    "hi, ABCD Beauty Clinic & Salon-ലേക്ക് സ്വാഗതം! 🙏\n\nPlease select your language:",
    [
      { id: "LANG_EN", title: "English" },
      { id: "LANG_ML", title: "Malayalam" },
      { id: "LANG_MG", title: "Manglish" }
    ]
  );
}

// ─── SECTION MENU (Gents / Ladies / Both) ────────────────────────────────────
async function sendSectionMenu(to, lang) {
  const texts = {
    EN: "Which section are you looking for?",
    ML: "ഏത് സെക്ഷൻ ആണ് വേണ്ടത്?",
    MG: "Enth section aan vendath?"
  };
  await sendButtons(to, texts[lang] || texts.EN, [
    { id: "SEC_LADIES", title: "Ladies" },
    { id: "SEC_GENTS", title: "Gents" },
    { id: "SEC_BOTH", title: "Both" }
  ]);
}

// ─── SERVICE CATEGORY MENU ────────────────────────────────────────────────────
async function sendServiceMenu(to, lang, section) {
  const texts = {
    EN: "What are you looking for?",
    ML: "എന്ത് സർവീസ് ആണ് വേണ്ടത്?",
    MG: "Enthu service aano venam?"
  };

  let rows = [];

  if (section === "SEC_LADIES" || section === "SEC_BOTH") {
    rows.push({ id: "CAT_HAIR_TREAT", title: "Hair Treatments", description: "Smoothening, Keratin, Spa..." });
    rows.push({ id: "CAT_HAIRCUT", title: "Haircut & Styling", description: "Cuts, Colour, Ironing..." });
    rows.push({ id: "CAT_SKIN", title: "Skin & Facial", description: "Facials, Cleanup, De-Tan..." });
    rows.push({ id: "CAT_CLINICAL", title: "Clinical Treatment", description: "Hydra, Laser, Micro Needling..." });
    rows.push({ id: "CAT_WAXING", title: "Waxing", description: "Full body, Brazilian..." });
    rows.push({ id: "CAT_MANI_PEDI", title: "Manicure & Pedicure", description: "Ordinary, Classic, Premium" });
    rows.push({ id: "CAT_BRIDAL", title: "Bridal Package", description: "Silver, Platinum, Diamond" });
  }

  if (section === "SEC_GENTS" || section === "SEC_BOTH") {
    rows.push({ id: "CAT_GENTS_HAIR_TREAT", title: "Gents Hair Treatments", description: "Keratin, Smoothening, Spa..." });
    rows.push({ id: "CAT_GENTS_HAIRCUT", title: "Gents Haircut & Styling", description: "Cut, Beard, Colour..." });
    rows.push({ id: "CAT_GENTS_SKIN", title: "Gents Skin & Facial", description: "Facials, Cleanup, De-Tan..." });
    rows.push({ id: "CAT_GENTS_CLINICAL", title: "Gents Clinical", description: "Hydra, Laser, BB Glow..." });
    rows.push({ id: "CAT_GROOM", title: "Groom Package", description: "Glow Groom, Gold Glow..." });
  }

  rows.push({ id: "CAT_BOOK", title: "Book Appointment", description: "Schedule a visit" });
  rows.push({ id: "CAT_OTHER", title: "Other / General", description: "Any other question" });

  await sendList(to, texts[lang] || texts.EN, "View Services", [
    { title: "Services", rows: rows.slice(0, 10) }
  ]);
}

// ─── SYSTEM PROMPTS PER LANGUAGE ──────────────────────────────────────────────
function getSystemPrompt(lang, section) {

  const sectionContext = section === "SEC_LADIES" ? "The customer is interested in LADIES services."
    : section === "SEC_GENTS" ? "The customer is interested in GENTS services."
    : "The customer is interested in both Ladies and Gents services.";

  const langRule = lang === "ML"
    ? `LANGUAGE RULE: You MUST reply in Malayalam script ONLY. Every single word must be in Malayalam script. ZERO English or Manglish words unless it is a proper noun or brand name like "ABCD", "Keratin", "Rs." Never break this rule.`
    : lang === "MG"
    ? `LANGUAGE RULE: You MUST reply in Manglish ONLY. Manglish means Malayalam words written in English/Roman letters. Examples: "aanu", "undoo", "venam", "cheyyam", "mathi", "alle", "kitto", "paranjaal", "ningalkku", "enthanu", "branch-il", "available". ZERO Malayalam script characters allowed. If unsure of a Manglish word, use the English word instead. Never use Malayalam Unicode script.`
    : `LANGUAGE RULE: You MUST reply in English ONLY. Every word must be in English. No Malayalam script. No Manglish.`;

  return `You are the AI assistant for ABCD Beauty Clinic & Salon. You are a knowledgeable, warm, helpful beauty salon assistant.

${langRule}

${sectionContext}

PERSONALITY
- Warm and friendly like a real receptionist
- Short replies — 2 to 3 sentences max for simple questions
- Never dump all prices at once — ask what they need first, then give relevant info
- Never use bullet points — this is WhatsApp
- Maximum 1 emoji per reply
- Never say "I don't know" — always guide to call 7012121125

APPROACH TO SERVICE QUESTIONS
When someone asks about a service category:
- First ask a clarifying question to understand exactly what they want
- Then give the most relevant 2-3 options with prices
- Don't list everything at once
Example: If someone asks about "hair treatments" — ask "Are you looking for smoothening, keratin, or hair spa?" — not a full menu

WHEN SOMEONE ASKS BENEFITS OR "WHAT IS THIS SERVICE"
Use your general beauty knowledge to explain naturally in 2-3 sentences. Then mention ABCD has this service and give starting price.

LOCATIONS
1. ചേർക്കള, കാഞ്ഞങ്ങാട്, കാസർഗോഡ് — GENTS ONLY
2. കാഞ്ഞങ്ങാട്, കാസർഗോഡ് — GENTS AND LADIES
Correct spellings: ചേർക്കള and കാഞ്ഞങ്ങാട് — never use ചേർത്തല

CONTACT
Phone: 7012121125
Hours: Ladies 10AM-10PM, Gents 10AM-12AM, Open all 7 days
24-hour service: pre-booked only

WHEN ASKED TO SPEAK TO SOMEONE / CALL
Reply: "Our team will call you back shortly! You can also reach us at 7012121125 😊" (in user's language)

BOOKING FLOW
Collect naturally one by one:
1. Full name
2. Location — Cherkala (Gents only) or Kanhangad (Gents & Ladies)
3. Service wanted
4. Preferred date (use today's date to resolve "tomorrow", "today" etc)
5. Preferred time
6. Section (only if Kanhangad)
Confirm with: "Thank you [Name]! Booking request received. Our team will contact you shortly. For urgent bookings call 7012121125"

PRICING RULES
- "+" prices → always say "starting from"
- Hair-length dependent → say depends on hair length
- Special packages → call 7012121125

KNOWLEDGE BASE
================================================================
LADIES SERVICES
================================================================
HAIRCUTS
Classic: U Cut Rs.400, V Cut Rs.400, Straight Cut Rs.300
Advanced (with wash): Layer Cut Rs.600, Step Cut Rs.600, Feathered Cut Rs.700
Premium (with wash+set): Bob Cut Rs.700, Blend Cut Rs.600, Pixie Cut Rs.800, Inverted Bob Rs.800, Graduated Bob Rs.800
Kids: Layer Rs.600, Bob Rs.500, Butterfly Rs.700, Feather Rs.700, Baby Cut Rs.200-300

HAIR COLOUR
Global Rs.2200, Route Touch Up Rs.1500, Highlights/strip Rs.300, Highlights+PreLight Rs.400
Fashion: Global Rs.3000+, Balayage Rs.4000+, Ombre Rs.3500+

HAIR TREATMENTS
Styling: Ironing Rs.1000+, Tong Curls Rs.1500+
Hair Spa: Nourishing Rs.1200+, Protein Rs.2000, Moroccan Rs.2500
Dandruff: Basic Rs.2000, Premium Rs.2500
Smoothening Rs.4000, Keratin Rs.6000, Botox Rs.7000, Kera Smooth Rs.10000, Crown Smoothening Rs.3000

MANICURE & PEDICURE
Ordinary: Pedicure Rs.900, Manicure Rs.500
Classic: Pedicure Rs.1300, Manicure Rs.700
Premium: Pedicure Rs.2000, Manicure Rs.1500
Leg Massage 30min Rs.900+

WAXING
Reca: Half Arm Rs.500, Half Leg Rs.700, Full Arm Rs.800, Full Leg Rs.1200, Full Body Rs.4000
Brazilian: Upper Lip Rs.150, Full Face Rs.500, Under Arms Rs.500

FACE TREATMENT
Cleanup Basic Rs.600, Premium Rs.1000, De Tan Basic Rs.500, Premium Rs.1000, Glow Cleanup Rs.1500, Bleach Rs.400, Face Massage Rs.800+

SKIN TREATMENT
Basic Facial Rs.1500, Premium Rs.2500, Luxury Rs.4000, Hydra Facial Rs.4000, Hydra Treatment Rs.5000, Hydra Premium Rs.8000

AESTHETIC CLINICAL
Hydra Facial Rs.3500, Carbon Laser Rs.6000, IPL Photolaser Rs.5500, IPL Hair Removal Rs.1500, Micro Needling Face Rs.6000, Micro Needling Hair Rs.6000, Mesotherapy Rs.4000, BB Glow Rs.6000, Chemical Peel Rs.2000+, Oxygeno Rs.6000, Skin Tightening Rs.3000, Tattoo Removal Rs.2500, Micro Blading Rs.10000/8000/4000 (3 sittings), Lip Neutralizing Rs.4000, Lip Colouring Rs.6000, Eye Brow Shading Rs.4000

BRIDAL PACKAGES
Silver Rs.5999: O3 Facial, Classic Pedi/Mani, D-Tan, Hair Spa
Platinum Rs.9999: Radiation Facial, Luxury Pedicure, Luxury Spa, Full Arm/Leg/Under Arm D-Tan
Diamond Rs.14999: Microderm Facial, Luxury Pedi/Mani, Full Body D-Tan, Back Polish, Haircut, Threading
Makeover: Bridal, Party, Reception — price on request

================================================================
GENTS SERVICES
================================================================
HAIRCUT & BEARD
Classic: Cut Rs.200, Beard Rs.200, Cut+Shave Rs.350
Luxury: Cut Rs.300, Beard Rs.300, Cut+Shave+Wash Rs.500

STYLING
Wash Rs.100, Setting Rs.150, Blow Dry+Setting Rs.200, Blow Dry+Powder Rs.400, Blow Dry+Fiber Rs.500

HAIR TREATMENTS
Spa Basic Rs.1200+, Spa Premium Rs.1500+, Moroccan Spa Rs.2000+
Dandruff Basic Rs.1500+, Premium Rs.2500+
Smoothening Rs.1500+, Keratin Rs.4000+, Botox Rs.5000+, Kera Smooth Rs.6000+, Curling Rs.4500+

COLOUR
Gray Coverage Rs.800+, Ammonia Free Rs.1000+, Beard Colour Rs.300+, Fashion Colour Rs.1500+, Cap Highlights Rs.2000+

HEAD MASSAGE
Oil+Wash Rs.500, Normal Rs.300

MANICURE & PEDICURE
Same as ladies pricing

FACE & SKIN TREATMENT
Same as ladies pricing

GROOM PACKAGES
Glow Groom Rs.3700: Hair Spa + Facial + Cut/Shave
Gold Glow Up Rs.5000: Hair Spa + Facial + Cut/Shave
Booster Glow Up: Custom — price on request
Makeover: Groom, Night Reception, Nikkah — price on request

ABCD SPECIAL PACKAGE
Full event: Salon + Makeover + Costume + Photography + Videography — call 7012121125`;
}

// ─── GET AI REPLY ─────────────────────────────────────────────────────────────
async function getAIReply(userPhone, userMessage, currentDate, lang, section) {
  if (!conversations[userPhone]) conversations[userPhone] = [];

  conversations[userPhone].push({ role: "user", content: userMessage });

  if (conversations[userPhone].length > MAX_HISTORY) {
    conversations[userPhone] = conversations[userPhone].slice(-MAX_HISTORY);
  }

  try {
    const response = await ai.chat.completions.create({
      model: "google/gemini-2.0-flash",
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: getSystemPrompt(lang, section) + `\n\nTODAY: ${currentDate} (IST). Use this to resolve "tomorrow", "today", "this evening" etc.`
        },
        ...conversations[userPhone],
      ],
    });

    const reply = response.choices[0].message.content;
    conversations[userPhone].push({ role: "assistant", content: reply });
    return reply;

  } catch (err) {
    console.error("AI error:", err?.message || err);
    return lang === "ML"
      ? "ക്ഷമിക്കണം, ഇപ്പോൾ സഹായിക്കാൻ കഴിയുന്നില്ല. നേരിട്ട് വിളിക്കൂ: 7012121125"
      : lang === "MG"
      ? "Sorry, ippo help cheyyaan pattunilla. Directly call cheyyoo: 7012121125"
      : "Sorry, our assistant is temporarily unavailable. Please call: 7012121125";
  }
}

// ─── DETECT BOOKING COMPLETE ──────────────────────────────────────────────────
function isBookingComplete(message) {
  return message.includes("Booking request received") ||
    message.includes("booking request received") ||
    message.includes("ബുക്കിംഗ്") ||
    (message.includes("7012121125") && message.includes("confirm"));
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
        content: `Extract booking details from this conversation. Return ONLY a JSON object with: name, location, service, date, time, section. Use "Not specified" for missing fields.\n\nConversation:\n${history}\n\nReturn only valid JSON.`
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
    console.log("FULL BODY:", JSON.stringify(body, null, 2));
    if (!from) return;

    const messageType = body.message?.type || body.type || "text";

    // ── Handle interactive button/list replies ──
    let buttonId = null;
if (messageType === "interactive") {
  // ChatMitra sends button ID directly in body.replyId
  buttonId = body.replyId || null;
}

    // ── Handle voice ──
    if (messageType === "audio") {
      await sendText(from, "Sorry, voice messages process cheyyaan pattilla. Please type cheyyoo! Or call: 7012121125");
      return;
    }

    // ── Get text message ──
    const messageText = buttonId || body.message?.text || body.message || body.text || body.body;
    if (!messageText || (messageType !== "text" && messageType !== "interactive")) return;

    console.log(`From ${from} [${messageType}]: ${messageText}`);

    // ── Init user state ──
    if (!userState[from]) {
      userState[from] = { stage: "language", lang: null, section: null };
    }

    const state = userState[from];
    const currentDate = new Date().toLocaleDateString("en-IN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata"
    });

    // ══════════════════════════════════════════
    // STAGE: LANGUAGE SELECTION
    // ══════════════════════════════════════════
    if (state.stage === "language") {
      if (buttonId === "LANG_EN" || buttonId === "LANG_ML" || buttonId === "LANG_MG") {
        state.lang = buttonId === "LANG_EN" ? "EN" : buttonId === "LANG_ML" ? "ML" : "MG";
        state.stage = "section";
        await sendSectionMenu(from, state.lang);
      } else {
        // Any text → show language menu
        await sendLanguageMenu(from);
      }
      return;
    }

    // ══════════════════════════════════════════
    // STAGE: SECTION SELECTION (Gents/Ladies/Both)
    // ══════════════════════════════════════════
    if (state.stage === "section") {
      if (buttonId === "SEC_LADIES" || buttonId === "SEC_GENTS" || buttonId === "SEC_BOTH") {
        state.section = buttonId;
        state.stage = "service";
        await sendServiceMenu(from, state.lang, state.section);
      } else {
        await sendSectionMenu(from, state.lang);
      }
      return;
    }

    // ══════════════════════════════════════════
    // STAGE: SERVICE CATEGORY SELECTION
    // ══════════════════════════════════════════
    if (state.stage === "service") {
      if (buttonId && buttonId.startsWith("CAT_")) {
        state.serviceContext = buttonId;
        state.stage = "chat";

        if (buttonId === "CAT_BOOK") {
          const reply = await getAIReply(from, "I want to book an appointment", currentDate, state.lang, state.section);
          await sendText(from, reply);
        } else if (buttonId === "CAT_OTHER") {
          const greet = {
            EN: "Sure! What would you like to know? 😊",
            ML: "തീർച്ചയായും! എന്താണ് അറിയേണ്ടത്? 😊",
            MG: "Sure! Enthaan ariyendath? 😊"
          };
          await sendText(from, greet[state.lang] || greet.EN);
        } else {
          // Ask a clarifying question for the selected category
          const categoryPrompts = {
            CAT_HAIR_TREAT: { EN: "Are you looking for smoothening, keratin, hair spa, or dandruff treatment?", ML: "Smoothening, keratin, hair spa, അതോ dandruff treatment — ഏത് ആണ് വേണ്ടത്?", MG: "Smoothening, keratin, hair spa, ennal dandruff treatment — ethu aano venam?" },
            CAT_HAIRCUT: { EN: "Are you looking for a haircut, hair colour, or styling?", ML: "Haircut, hair colour, അതോ styling — ഏത് ആണ് വേണ്ടത്?", MG: "Haircut, hair colour, ennal styling — ethu aano venam?" },
            CAT_SKIN: { EN: "Are you looking for a facial, cleanup, or de-tan treatment?", ML: "Facial, cleanup, അതോ de-tan — ഏത് ആണ് വേണ്ടത്?", MG: "Facial, cleanup, ennal de-tan — ethu aano venam?" },
            CAT_CLINICAL: { EN: "Are you looking for Hydra Facial, Carbon Laser, or another clinical treatment?", ML: "Hydra Facial, Carbon Laser, അതോ മറ്റ് clinical treatment — ഏത് ആണ്?", MG: "Hydra Facial, Carbon Laser, ennal vere clinical treatment — ethu aano?" },
            CAT_WAXING: { EN: "Are you looking for full body waxing, Brazilian, or specific area?", ML: "Full body, Brazilian, അതോ specific area — ഏത് ആണ് വേണ്ടത്?", MG: "Full body, Brazilian, ennal specific area — ethu aano venam?" },
            CAT_MANI_PEDI: { EN: "Are you looking for manicure, pedicure, or both?", ML: "Manicure, pedicure, അതോ രണ്ടും — ഏത് ആണ് വേണ്ടത്?", MG: "Manicure, pedicure, ennal randum — ethu aano venam?" },
            CAT_BRIDAL: { EN: "Are you looking for the Silver, Platinum, or Diamond bridal package?", ML: "Silver, Platinum, അതോ Diamond package — ഏത് ആണ് നോക്കുന്നത്?", MG: "Silver, Platinum, ennal Diamond package — ethu aano nokkunath?" },
            CAT_GENTS_HAIR_TREAT: { EN: "Are you looking for keratin, smoothening, hair spa, or dandruff treatment?", ML: "Keratin, smoothening, hair spa, അതോ dandruff treatment — ഏത് ആണ്?", MG: "Keratin, smoothening, hair spa, ennal dandruff treatment — ethu aano?" },
            CAT_GENTS_HAIRCUT: { EN: "Are you looking for a haircut, beard styling, or hair colour?", ML: "Haircut, beard, അതോ colour — ഏത് ആണ് വേണ്ടത്?", MG: "Haircut, beard, ennal colour — ethu aano venam?" },
            CAT_GENTS_SKIN: { EN: "Are you looking for a facial, cleanup, or de-tan?", ML: "Facial, cleanup, അതോ de-tan — ഏത് ആണ്?", MG: "Facial, cleanup, ennal de-tan — ethu aano?" },
            CAT_GENTS_CLINICAL: { EN: "Are you looking for Hydra Facial, Carbon Laser, or BB Glow?", ML: "Hydra Facial, Carbon Laser, അതോ BB Glow — ഏത് ആണ്?", MG: "Hydra Facial, Carbon Laser, ennal BB Glow — ethu aano?" },
            CAT_GROOM: { EN: "Are you looking for the Glow Groom, Gold Glow Up, or a custom groom package?", ML: "Glow Groom, Gold Glow Up, അതോ custom package — ഏത് ആണ്?", MG: "Glow Groom, Gold Glow Up, ennal custom package — ethu aano?" },
          };

          const q = categoryPrompts[buttonId];
          if (q) {
            await sendText(from, q[state.lang] || q.EN);
          } else {
            const reply = await getAIReply(from, `Tell me about ${buttonId} services`, currentDate, state.lang, state.section);
            await sendText(from, reply);
          }
        }
      } else {
        // Free text in service stage — go to chat directly
        state.stage = "chat";
        const reply = await getAIReply(from, messageText, currentDate, state.lang, state.section);
        await sendText(from, reply);

        if (isBookingComplete(reply)) {
          const details = await extractBookingDetails(from, from);
          await sendBookingNotification(details);
        }
      }
      return;
    }

    // ══════════════════════════════════════════
    // STAGE: CHAT (normal conversation)
    // ══════════════════════════════════════════
    if (state.stage === "chat") {
      const reply = await getAIReply(from, messageText, currentDate, state.lang, state.section);
      await sendText(from, reply);

      if (isBookingComplete(reply)) {
        console.log("Booking complete! Notifying clinic...");
        const details = await extractBookingDetails(from, from);
        await sendBookingNotification(details);
      }
    }

  } catch (err) {
    console.error("Webhook error:", err.message);
  }
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "ABCD Bot running" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ABCD WhatsApp Bot running on port ${PORT}`));
