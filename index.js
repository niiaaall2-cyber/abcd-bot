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

// ─── SEND TEXT ────────────────────────────────────────────────────────────────
async function sendText(to, message) {
  try {
    await axios.post(
      "https://backend.chatmitra.com/developer/api/send_message",
      { recipient_mobile_number: to, messages: [{ kind: "raw", payload: { type: "text", text: { body: message } } }], customer_name: "" },
      { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.CHATMITRA_API_KEY}` } }
    );
    console.log(`Text → ${to}: ${message.substring(0, 60)}`);
  } catch (err) { console.error("sendText failed:", err?.response?.data || err.message); }
}

// ─── SEND BUTTONS (max 3) ─────────────────────────────────────────────────────
async function sendButtons(to, bodyText, buttons) {
  try {
    await axios.post(
      "https://backend.chatmitra.com/developer/api/send_message",
      {
        recipient_mobile_number: to,
        messages: [{ kind: "raw", payload: { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text: bodyText }, action: { buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } })) } } } }],
        customer_name: ""
      },
      { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.CHATMITRA_API_KEY}` } }
    );
    console.log(`Buttons → ${to}`);
  } catch (err) { console.error("sendButtons failed:", err?.response?.data || err.message); }
}

// ─── SEND LIST (max 10 items) ─────────────────────────────────────────────────
async function sendList(to, bodyText, buttonLabel, rows) {
  try {
    const limitedRows = rows.slice(0, 10);
    await axios.post(
      "https://backend.chatmitra.com/developer/api/send_message",
      {
        recipient_mobile_number: to,
        messages: [{ kind: "raw", payload: { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "list", body: { text: bodyText }, action: { button: buttonLabel, sections: [{ title: "Options", rows: limitedRows }] } } } }],
        customer_name: ""
      },
      { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.CHATMITRA_API_KEY}` } }
    );
    console.log(`List → ${to}`);
  } catch (err) { console.error("sendList failed:", err?.response?.data || err.message); }
}

// ─── BOOKING NOTIFICATION ─────────────────────────────────────────────────────
async function sendBookingNotification(details) {
  const msg = `New Booking!\n\nName: ${details.name}\nPhone: ${details.phone}\nLocation: ${details.location}\nSection: ${details.section}\nService: ${details.service}\nDate: ${details.date}\nTime: ${details.time}`;
  await sendText(CLINIC_NUMBER, msg);
}

// ─── SERVICE KNOWLEDGE BASE ───────────────────────────────────────────────────
const SERVICE_INFO = {
  'SVC_L_SMOOTHENING': { name: 'Smoothening', price: 'Rs.4000+ (depending on hair length)', benefits: 'Get permanently straight, frizz-free hair that lasts 4–6 months. No more daily styling — wake up with salon-smooth hair every single day. Takes 3–4 hours and uses premium products that keep your hair healthy and shiny.' },
  'SVC_L_KERATIN': { name: 'Keratin Treatment', price: 'Rs.6000+ (depending on hair length)', benefits: 'Eliminates frizz by up to 95% and makes your hair incredibly smooth, shiny, and easy to manage. Results last 3–5 months. Your blow-dry time literally cuts in half. Perfect for damaged, processed, or naturally frizzy hair.' },
  'SVC_L_BOTOX': { name: 'Hair Botox', price: 'Rs.7000+ (depending on hair length)', benefits: 'Deeply repairs damaged hair using proteins, vitamins, and collagen — without any chemicals. Restores shine, softness, and elasticity to over-processed or dull hair. Zero damage, maximum nourishment. Results last 2–4 months.' },
  'SVC_L_KERASMOOTH': { name: 'Kera Smooth', price: 'Rs.10000+ (depending on hair length)', benefits: 'The most advanced and longest-lasting hair straightening treatment available — results last up to 6–8 months. Best for very curly, coarse, or thick hair that other treatments can not fully tame. Salon-smooth hair for half the year.' },
  'SVC_L_CROWN': { name: 'Crown Portion Smoothening', price: 'Rs.3000', benefits: 'Targets only the frizzy top section of your hair — affordable, quick, and very effective. Perfect if your roots are puffy but your lengths are fine. Great for touch-ups between full treatments without spending on the entire head.' },
  'SVC_L_ROUTETOUCHUP': { name: 'Route Touch Up', price: 'Rs.3500+ (depending on hair length)', benefits: 'Keeps your previously smoothened or keratin-treated hair uniform from root to tip. Treats new growth at the roots without the cost of a full treatment. Recommended every 3–4 months — your hair stays perfectly straight all year.' },
  'SVC_L_NANOPLASTY': { name: 'Nanoplasty', price: 'Rs.8000+ (depending on hair length)', benefits: 'Organic straightening with zero formaldehyde — completely safe even for sensitive scalps. Uses natural amino acids and nanotechnology to deeply nourish while straightening. Leaves hair silkier and healthier than before. Lasts 4–6 months.' },
  'SVC_L_SHINEINFUSION': { name: 'Shine Infusion Treatment', price: 'Rs.5000', benefits: 'Wraps every strand in a reflective coating for mirror-like shine and smoothness. No chemicals, no straightening — pure gloss and frizz control. Your hair looks like a shampoo ad for up to 6–8 weeks. Perfect before events or weddings.' },
  'SVC_L_HAIRIRONING': { name: 'Hair Ironing', price: 'Rs.1000+ (depending on hair length)', benefits: 'Instant sleek, straight hair for the day using a professional flat iron with heat protection. Perfect for parties, interviews, or any occasion where you want a polished look without a permanent treatment.' },
  'SVC_L_TONGCURLS': { name: 'Tong Ironing Curls', price: 'Rs.1500+ (depending on hair length)', benefits: 'Gorgeous bouncy curls or waves styled by professionals using a curling tong. Choose loose waves, tight ringlets, or anything in between. Lasts the full day — perfect for events and occasions.' },
  'SVC_L_DANDRUFF_BASIC': { name: 'Anti Dandruff Basic', price: 'Rs.2000', benefits: 'Deeply cleanses the scalp, removes flakes, and controls excess oil using medicated anti-dandruff products. Includes a relaxing scalp massage. You will notice a significant reduction in dandruff after 2–3 sessions.' },
  'SVC_L_DANDRUFF_PREMIUM': { name: 'Anti Dandruff Premium', price: 'Rs.2500', benefits: 'Advanced treatment combining medicated scalp care, anti-fungal application, nourishing serum, and steam therapy. Targets stubborn dandruff, scalp inflammation, and itchiness. More intensive than the basic — recommended for persistent dandruff problems.' },
  'SVC_L_HAIRWASH': { name: 'Hair Wash Dryer Set', price: 'Rs.500', benefits: 'Professional wash with salon-grade shampoo and conditioner, followed by blow-dry and styling. Quick, affordable, and leaves your hair fresh, clean, and beautifully styled. Perfect before any event.' },
  'SVC_L_SPA_NOURISHING': { name: 'Hair Spa Nourishing', price: 'Rs.1200+ (depending on hair length)', benefits: 'Restores moisture and reduces breakage with protein-rich masks and serums. Includes a relaxing head massage, steaming, and finishing serum. Hair feels soft, smooth, and healthy immediately after. Best done monthly for consistently beautiful hair.' },
  'SVC_L_SPA_PROTEIN': { name: 'Hair Spa Protein', price: 'Rs.2000', benefits: 'Rebuilds damaged hair from the inside using concentrated protein molecules. Reduces hair breakage by up to 70%. Includes scalp massage, protein mask with steam, and serum finish. Best for hair that snaps easily or feels weak and brittle.' },
  'SVC_L_SPA_MOROCCAN': { name: 'Hair Spa Moroccan', price: 'Rs.2500', benefits: 'Pure Argan oil spa — liquid gold for dull, dry, or frizzy hair. Rich in Vitamin E and fatty acids, it transforms brittle hair into glossy, lustrous locks. Includes massage, Argan mask, and steam. Your hair will shine like never before.' },
  'SVC_L_UCUT': { name: 'U Cut', price: 'Rs.400', benefits: 'A classic soft U-shape at the back — longer in the center, shorter at the sides. Suits all face types, looks great on medium to long hair, and is very easy to maintain at home.' },
  'SVC_L_VCUT': { name: 'V Cut', price: 'Rs.400', benefits: 'A sharp V-shape at the back that adds natural movement and dimension to straight hair. Makes hair look thicker and more dynamic. Perfect for long, straight hair that needs more life and flow.' },
  'SVC_L_STRAIGHTCUT': { name: 'Straight Cut', price: 'Rs.300', benefits: 'A clean blunt cut where all hair is trimmed to one length. Classic, timeless, and makes fine hair look thicker. The most affordable cut — removes split ends and keeps your length looking fresh and healthy.' },
  'SVC_L_LAYERCUT': { name: 'Layer Cut', price: 'Rs.600 (with hairwash)', benefits: 'Layers add movement, volume, and texture to your hair. Perfect for thick hair to reduce bulk, or fine hair to add volume. Includes a professional hairwash. Results in a flowing, dimensional look that styles beautifully.' },
  'SVC_L_STEPCUT': { name: 'Step Cut', price: 'Rs.600 (with hairwash)', benefits: 'Bold, defined layers that frame your face beautifully and give your hair a structured, fashion-forward look. Very popular for medium-length hair. Adds great movement and shape — looks amazing both straight and wavy.' },
  'SVC_L_FEATHEREDCUT': { name: 'Feathered Cut', price: 'Rs.700 (with hairwash)', benefits: 'Soft, wispy ends that look light and airy — like feathers. Frames the face gently and flatters most face shapes. Works beautifully with both straight and wavy hair. Feminine, classic, and very flattering.' },
  'SVC_L_BOBCUT': { name: 'Bob Cut', price: 'Rs.700 (with hairwash & hairsetting)', benefits: 'The timeless bob — chic, low-maintenance, and flattering on every face shape. Our stylists customize the angle and length to suit your face perfectly. Includes professional wash and hairsetting. You will love how polished it looks.' },
  'SVC_L_BLENDCUT': { name: 'Blend Cut', price: 'Rs.600 (with hairwash & hairsetting)', benefits: 'Seamlessly transitions between lengths for a smooth, natural, polished look. Great for those who want a styled look without dramatic layers. Versatile, suits most hair types, and looks great every day.' },
  'SVC_L_PIXIECUT': { name: 'Pixie Cut', price: 'Rs.800 (with hairwash & hairsetting)', benefits: 'Bold, confident, and incredibly low-maintenance. A short style that highlights your facial features — especially eyes and cheekbones. Our stylists shape it specifically for your face structure. You will turn heads every single day.' },
  'SVC_L_INVERTEDBOB': { name: 'Inverted Bob', price: 'Rs.800 (with hairwash & hairsetting)', benefits: 'Shorter at the back, longer at the front — a dramatic angular silhouette that looks modern and sleek. Adds volume at the crown and frames the face beautifully. Very flattering on most face types.' },
  'SVC_L_GRADUATEDBOB': { name: 'Graduated Bob', price: 'Rs.800 (with hairwash & hairsetting)', benefits: 'A stacked back that creates volume and height, with longer front pieces framing your face. Sophisticated, structured, and looks great both straight and slightly wavy. Perfect for adding fullness to fine or flat hair.' },
  'SVC_L_KIDS_LAYER': { name: 'Kids Layer Cut', price: 'Rs.600 (with hairwash)', benefits: 'A gentle, professional layer cut for children that reduces bulk and adds movement. Our stylists are experienced with kids and make the whole experience comfortable, quick, and fun.' },
  'SVC_L_KIDS_BOB': { name: 'Kids Bob Cut', price: 'Rs.500 (with hairwash)', benefits: 'Sweet, neat, and easy to manage at home. Looks adorable and is perfect for school. Our stylists ensure a comfortable and speedy experience — no fuss, great results.' },
  'SVC_L_KIDS_BUTTERFLY': { name: 'Kids Butterfly Cut', price: 'Rs.700 (with hairwash)', benefits: 'A playful, wing-like cut that looks charming and unique on kids. Stylish yet easy to maintain — your child will love how it looks and flows.' },
  'SVC_L_KIDS_FEATHER': { name: 'Kids Feather Cut', price: 'Rs.700 (with hairwash)', benefits: 'Soft feathery ends that look lovely on children. Easy to manage at home and looks beautiful for both school and special occasions.' },
  'SVC_L_KIDS_BABYCUT': { name: 'Baby Cut', price: 'Rs.200-300 (with hairwash)', benefits: 'A gentle first trim for babies and toddlers. Our stylists are specifically experienced with very young children — quick, safe, and stress-free for both the child and parents.' },
  'SVC_L_COLOUR_GLOBAL': { name: 'Hair Colour Global', price: 'Rs.2200 (depending on hair length)', benefits: 'Complete grey coverage using Loreal Schoff — one of the best professional colour brands available. Covers even stubborn greys for a rich, even, natural-looking result that lasts 6–8 weeks. Looks fresh and youthful every time.' },
  'SVC_L_COLOUR_TOUCHUP': { name: 'Route Touch Up', price: 'Rs.1500', benefits: 'Covers grey regrowth at the roots only — cost-effective and quick. No need for a full colour every time. Recommended every 4–6 weeks using Loreal Schoff for a perfect colour match every single time.' },
  'SVC_L_HIGHLIGHTS': { name: 'Highlights', price: 'Rs.300 per strip', benefits: 'Add dimension, brightness, and a sun-kissed look to your hair. Subtle or bold — your choice. Highlights instantly make hair look more alive and multidimensional. One of the most transformative colour services available.' },
  'SVC_L_HIGHLIGHTS_PRELIGHT': { name: 'Highlights With Pre Light', price: 'Rs.400 per strip', benefits: 'Pre-lightening before highlights gives dramatically brighter, more vivid results — perfect for dark hair. The extra step ensures your highlights actually show up bright and true rather than looking muddy or dull.' },
  'SVC_L_FASHION_GLOBAL': { name: 'Fashion Colour Global', price: 'Rs.3000+', benefits: 'Complete colour transformation in any shade you want — from rich chocolates to vibrant reds, purples, or any creative colour. Our colourists customize the formula for your hair type. Walk in one person, walk out completely transformed.' },
  'SVC_L_BALAYAGE': { name: 'Balayage', price: 'Rs.4000+', benefits: 'Freehand painted colour that creates the most natural, sun-kissed gradient effect. Grows out beautifully with no harsh lines — very low maintenance. One of the most sought-after colour techniques in the world, done by trained specialists at ABCD.' },
  'SVC_L_OMBRE': { name: 'Ombre', price: 'Rs.3500+', benefits: 'A beautiful gradient from dark roots to lighter ends — dramatic, eye-catching, and incredibly stylish. Grows out naturally with no awkward regrowth lines. Available in natural shades or bold fashion colours. Makes a serious statement.' },
  'SVC_L_FACIAL_BASIC': { name: 'Basic Facial', price: 'Rs.1500', benefits: 'A complete skin refresh — cleansing, toning, steam, extraction, massage, and mask, all customized for your skin type. Removes impurities, unclogs pores, and leaves skin visibly fresh, hydrated, and glowing. Perfect monthly maintenance.' },
  'SVC_L_FACIAL_PREMIUM': { name: 'Premium Facial', price: 'Rs.2500', benefits: 'An upgraded facial with advanced serums targeting your specific skin concerns — pigmentation, dullness, or uneven texture. More concentrated active ingredients for results you can actually see and feel. Worth every rupee.' },
  'SVC_L_FACIAL_LUXURY': { name: 'Luxury Facial', price: 'Rs.4000', benefits: 'A full luxury experience using high-end products and advanced techniques. After just one session, you will notice a visible difference in brightness, firmness, and skin texture. The most pampering facial treatment we offer.' },
  'SVC_L_FACIAL_GROOMOFFICIAL': { name: 'Groom Official Facial', price: 'Rs.4000', benefits: 'Designed specifically for event-ready skin. Combines brightening, de-tanning, deep hydration, and finishing steps for maximum glow. Perfect before weddings, receptions, or any occasion where you need to look absolutely your best.' },
  'SVC_L_HYDRAFACIAL': { name: 'Hydra Facial', price: 'Rs.4000', benefits: 'Cleanses, exfoliates, extracts, and hydrates all in one session using advanced Vortex-Fusion technology. Zero downtime — skin looks instantly plumper, clearer, and more radiant right after. Suitable for all skin types including sensitive skin.' },
  'SVC_L_HYDRA_TREATMENT': { name: 'Hydra Treatment', price: 'Rs.5000', benefits: 'Advanced multi-step hydration that goes deeper than a standard Hydra Facial. Includes targeted boosters for pigmentation, fine lines, or acne. The ultimate treatment for visibly dehydrated or stressed skin that needs serious restoration.' },
  'SVC_L_HYDRA_PREMIUM': { name: 'Hydra Premium with Hair Spa', price: 'Rs.8000', benefits: 'The ultimate combination — a full Hydra Treatment for your skin PLUS a premium Hair Spa for your hair, all in one visit. Total head-to-toe rejuvenation. Best value package if you want to treat both skin and hair at once.' },
  'SVC_L_CLEANUP_BASIC': { name: 'Cleanup Basic', price: 'Rs.600', benefits: 'A quick, effective cleanup that removes blackheads and whiteheads, deep cleanses, tones, and moisturizes. Leaves skin noticeably cleaner and brighter in 30–40 minutes. Perfect for a regular skin refresh between full facials.' },
  'SVC_L_CLEANUP_PREMIUM': { name: 'Cleanup Premium', price: 'Rs.1000', benefits: 'Enhanced cleanup with professional scrub exfoliation, deeper extraction, a soothing pack, and premium moisturizer. More thorough than the basic, with longer-lasting results. Your skin will feel genuinely transformed, not just cleaned.' },
  'SVC_L_DETAN_BASIC': { name: 'De Tan Basic', price: 'Rs.500', benefits: 'Removes sun tan from the face and restores your natural skin tone using a targeted brightening solution. One session gives a visibly lighter, more even complexion. Perfect before events or after too much sun exposure.' },
  'SVC_L_DETAN_PREMIUM': { name: 'De Tan Premium', price: 'Rs.1000', benefits: 'Advanced de-tanning using stronger brightening agents and multiple application layers. Targets deep, stubborn tan from prolonged sun exposure. Includes brightening mask and soothing serum for noticeably even, glowing skin.' },
  'SVC_L_GLOW_CLEANUP': { name: 'Glow Cleanup', price: 'Rs.1500 (including De Tan)', benefits: 'The ultimate skin brightening package — de-tanning plus a premium cleanup in one session. Removes tan, deeply cleans pores, and brightens your complexion all at once. Skin looks visibly glowing and even-toned right after.' },
  'SVC_L_BLEACH': { name: 'Bleach', price: 'Rs.400', benefits: 'Lightens facial hair, brightens skin tone, and reduces the appearance of dark spots and blemishes. Uses professional-grade bleach cream formulated for sensitive facial skin. Quick, affordable, and leaves your face looking noticeably brighter.' },
  'SVC_L_FULLARM_DETAN': { name: 'Full Arm De Tan / Bleach', price: 'Rs.800', benefits: 'Removes sun tan and brightens skin tone from shoulders to wrists. Great before sleeveless occasions, weddings, or after a sunny vacation. Your arms will look even, bright, and smooth.' },
  'SVC_L_FULLLEG_DETAN': { name: 'Full Leg De Tan / Bleach', price: 'Rs.1000', benefits: 'Removes tan lines and brightens skin from thighs to ankles. Perfect before sarees, beach trips, or any occasion your legs will be visible. Even, bright, smooth legs guaranteed.' },
  'SVC_L_FACEMASSAGE': { name: 'Face Massage', price: 'Rs.800+ (20 minutes)', benefits: 'A 20-minute face massage that improves circulation, reduces puffiness, relaxes facial muscles, and gives an instant natural glow. Regular face massages slow visible aging and keep skin firm. One of the most relaxing treatments on our menu.' },
  'SVC_HYDRAFACIAL_CLINIC': { name: 'Hydra Facial (Clinical)', price: 'Rs.3500', benefits: 'Clinical-grade Hydra Facial using medical-level equipment and pharmaceutical serums. More intensive than the standard version — delivers actives at higher concentrations for superior results in one session. Zero downtime, immediate visible glow.' },
  'SVC_HYDRA_BASIC': { name: 'Hydra Treatment Basic', price: 'Rs.5000', benefits: 'Medical-grade hydration using pharmaceutical hyaluronic acid and peptide infusions that plump skin from within. Results are immediate — skin appears visibly fuller, plumper, and radiant right after. Lasts 4–6 weeks.' },
  'SVC_HYDRA_PREMIUM_CLINIC': { name: 'Hydra Treatment Premium', price: 'Rs.8000', benefits: 'The most advanced hydration treatment available — multiple serums, boosters, and clinical techniques for a complete skin transformation. Perfect for mature skin, severely dehydrated skin, or high-stakes event preparation. Lasts 6–8 weeks.' },
  'SVC_MEDIFACIAL': { name: 'Medi Facial Tan', price: 'Rs.2000', benefits: 'Medically formulated to target sun damage and hyperpigmentation at a cellular level. Breaks down melanin, fades dark spots, and evens skin tone using clinical-grade brightening actives. Visible improvement after just 2–3 sessions.' },
  'SVC_CARBON_LASER': { name: 'Carbon Laser Toning', price: 'Rs.6000', benefits: 'The famous Hollywood Peel — reduces pores, controls oil, removes dead cells, and boosts collagen, all in one session. Zero downtime, skin looks immediately brighter and smoother. Loved by celebrities worldwide for its instant glow effect.' },
  'SVC_IPL_PHOTO': { name: 'IPL Photolaser', price: 'Rs.5500', benefits: 'Targets sun damage, pigmentation, redness, and early aging signs simultaneously using intense light pulses. Breaks down melanin and stimulates collagen. Very effective for uneven skin tone, sunspots, and redness. Long-lasting results.' },
  'SVC_IPL_HAIRREMOVAL': { name: 'IPL Hair Removal Laser', price: 'Rs.1500', benefits: 'Permanently reduces hair growth over multiple sessions using pulses of light targeting follicles. Much gentler than traditional laser — suitable for sensitive skin. After 6–8 sessions, most people see 80–90% permanent hair reduction.' },
  'SVC_MICRONEEDLING_FACE': { name: 'Micro Needling For Face', price: 'Rs.6000', benefits: 'Creates thousands of micro-channels that trigger your skin natural healing and collagen production. Dramatically improves scars, enlarged pores, fine lines, and skin texture over 4–6 weeks. One of the most effective anti-aging treatments available.' },
  'SVC_MICRONEEDLING_HAIR': { name: 'Micro Needling For Hair', price: 'Rs.6000', benefits: 'Stimulates dormant hair follicles and increases scalp blood flow to promote hair regrowth. When combined with growth serums, significantly improves hair density and thickness. Results visible after 3–4 sessions. Highly effective for early hair thinning.' },
  'SVC_MESOTHERAPY': { name: 'Mesotherapy Treatment', price: 'Rs.4000', benefits: 'Injects a customized cocktail of vitamins, minerals, and hyaluronic acid directly into the skin for deep nourishment from within. Improves dullness, fine lines, and skin laxity in a way topical products never can. Also available for scalp hair rejuvenation.' },
  'SVC_BBGLOW': { name: 'B.B Glow Treatment', price: 'Rs.6000', benefits: 'Semi-permanent foundation effect using micro needling to infuse BB serum into the skin — covers imperfections, brightens, and adds a healthy glow that lasts 4–6 months. No daily foundation needed. One of the most innovative treatments we offer.' },
  'SVC_LLL_THERAPY': { name: 'L.L.L Therapy', price: 'Rs.1500', benefits: 'Painless low-level light therapy that stimulates cellular repair, reduces inflammation, and promotes healing. Used for skin rejuvenation, acne reduction, and scalp health. Zero side effects, zero downtime, and completely safe for all skin types.' },
  'SVC_CHEMICAL_PEEL': { name: 'Chemical Peel', price: 'Rs.2000+', benefits: 'Removes the outer layers of skin to reveal fresher, younger skin underneath. Targets acne scars, pigmentation, uneven texture, and dullness. Mild peels have zero downtime — stronger peels give more dramatic, lasting results.' },
  'SVC_OXYGENO': { name: 'Oxygeno Treatment', price: 'Rs.6000', benefits: 'A 3-in-1 super facial that simultaneously exfoliates, infuses nutrients, and oxygenates the skin from within. Creates a natural CO2 effect that sends oxygen-rich blood to the skin. Instantly plumper, brighter, more youthful skin with zero downtime.' },
  'SVC_MEDI_CLEANUP': { name: 'Medi Cleanup Facial', price: 'Rs.1500', benefits: 'Medical-grade cleanup using pharmaceutical cleansing agents for congested, acne-prone, or oily skin. Includes enzyme exfoliation, targeted extraction, and antibacterial treatment. More effective than regular cleanup for problematic skin.' },
  'SVC_SKIN_TIGHTENING': { name: 'Saggy Skin Tightening', price: 'Rs.3000', benefits: 'Non-invasive treatment that firms and lifts sagging skin by stimulating collagen in deeper skin layers. Improves jawline definition, neck firmness, and reduces nasolabial folds — without surgery or injections. Results improve over 4–6 weeks.' },
  'SVC_TATTOO_REMOVAL': { name: 'Tattoo Removal', price: 'Rs.2500', benefits: 'Laser breaks down tattoo ink into tiny particles that your body naturally eliminates over time. Safe, effective, and performed by trained professionals. Number of sessions depends on size, colour, and age of the tattoo. Black ink responds fastest.' },
  'SVC_MICROBLADING': { name: 'Micro Blading', price: 'Rs.10000 (1st sitting), Rs.8000 (2nd), Rs.4000 (3rd)', benefits: 'Semi-permanent eyebrow tattooing that creates natural-looking hair strokes to fill, define, and shape your brows. Perfect for sparse or uneven brows. Looks completely real — not drawn on. Lasts 1–3 years and is completely customized to your face shape.' },
  'SVC_LIP_NEUTRALIZING': { name: 'Lip Neutralizing Treatment', price: 'Rs.4000', benefits: 'Corrects dark or uneven lip pigmentation by applying a neutralizing pigment that creates a natural pink tone. Perfect for smokers lips or naturally dark lips. Results last 1–2 years — wake up with naturally beautiful lips every morning.' },
  'SVC_LIP_COLOURING': { name: 'Lip Colouring Treatment', price: 'Rs.6000', benefits: 'Semi-permanent lip colour tattooing — naturally tinted lips 24/7 with zero lipstick needed. Choose from natural pinks, berry, coral, or any custom shade. Lasts 1–2 years and is fully customized to your features and preferences.' },
  'SVC_LIP_CONTOURING': { name: 'Lip Contouring Treatment', price: 'Rs.2000', benefits: 'Semi-permanent lip liner that defines the lip border and makes lips appear fuller and more symmetrical. Adds structure without filler. Makes a huge difference to thin or undefined lips. Can be combined with lip colouring for a total lip transformation.' },
  'SVC_EYEBROW_SHADING': { name: 'Eye Brow Shading', price: 'Rs.4000', benefits: 'Semi-permanent ombre brows that give a soft, powdered effect — like perfectly filled-in brows all day every day. Fuller, more defined brows with zero daily effort. Lasts 1–2 years and is completely customized to your face and preferences.' },
  'SVC_BEAUTY_SPOT': { name: 'Beauty Spot', price: 'Rs.500', benefits: 'A classic, timeless semi-permanent beauty spot tattooed exactly where you want it. Elegant, charming, and unique to you. Our technicians help you choose the perfect placement and size for your face.' },
  'SVC_WAX_HALFARM': { name: 'Half Arm Wax (Reca)', price: 'Rs.500', benefits: 'Removes hair from wrist to elbow using gentle Reca wax — less painful than regular wax and suitable for sensitive skin. Silky smooth arms for 3–4 weeks. Much longer lasting than shaving with zero cuts or irritation.' },
  'SVC_WAX_HALFLEG': { name: 'Half Leg Wax (Reca)', price: 'Rs.700', benefits: 'Smooth, hair-free legs from ankles to knees for 3–4 weeks using gentle Reca wax. Professional waxing removes from the root so regrowth is finer and softer over time — unlike shaving which gets rougher.' },
  'SVC_WAX_FULLARM': { name: 'Full Arm Wax (Reca)', price: 'Rs.800', benefits: 'Complete arm waxing from wrist to shoulder. Perfectly smooth for 3–4 weeks. Great before sleeveless occasions, weddings, or as part of a regular grooming routine. Reca wax makes it gentler than traditional waxing.' },
  'SVC_WAX_FULLLEG': { name: 'Full Leg Wax (Reca)', price: 'Rs.1200', benefits: 'Completely smooth legs from ankles to thighs for 3–4 weeks. Removes from the root so regrowth is progressively finer each time. Our professionals ensure a thorough, comfortable experience with minimal discomfort.' },
  'SVC_WAX_FULLBODY': { name: 'Full Body Wax', price: 'Rs.4000', benefits: 'Complete body waxing — arms, legs, underarms, and back or front. Smooth all over for 3–4 weeks. Perfect before holidays, beach trips, or events. Our professionals ensure a comfortable, thorough experience from start to finish.' },
  'SVC_WAX_BACKFRONT': { name: 'Back and Front Wax', price: 'Rs.800', benefits: 'Removes unwanted hair from chest, stomach, and back for clean, smooth results lasting 3–4 weeks. Popular before beach vacations or any occasion where you want a groomed, confident look.' },
  'SVC_WAX_UPPERLIP': { name: 'Upper Lip Wax', price: 'Rs.150', benefits: 'Quick, precise upper lip hair removal using Brazilian wax. Gentler than threading for sensitive skin and removes even the finest hair. Results last 3–4 weeks — far longer than threading which only snaps at the surface.' },
  'SVC_WAX_FOREHEAD': { name: 'Forehead Wax', price: 'Rs.150', benefits: 'Removes fine forehead and hairline hair that makes skin look dull. After waxing, foundation applies more smoothly and your face looks visibly brighter, more polished, and more refined.' },
  'SVC_WAX_FULLFACE': { name: 'Full Face Wax', price: 'Rs.500', benefits: 'Complete facial hair removal — upper lip, chin, sideburns, forehead, and neck. Skin becomes incredibly smooth, makeup applies flawlessly, and your face looks visibly brighter and more refined right after.' },
  'SVC_WAX_UNDERARMS': { name: 'Under Arms Wax', price: 'Rs.500', benefits: 'Underarm waxing that removes from the root for 3–4 weeks of complete smoothness. Much longer-lasting than shaving. Regular waxing leads to progressively finer regrowth — eventually you need it less and less.' },
  'SVC_L_MANI_ORDINARY': { name: 'Ordinary Manicure', price: 'Rs.500', benefits: 'Nail cutting, shaping, filing, cuticle care, and a 5-minute hand massage. Leaves hands neat, groomed, and refreshed. Quick and affordable — perfect for regular monthly nail maintenance.' },
  'SVC_L_PEDI_ORDINARY': { name: 'Ordinary Pedicure', price: 'Rs.900', benefits: 'Nail cutting, shaping, filing, cuticle care, and a 5-minute foot massage. Removes dead skin and leaves feet clean and refreshed. Essential monthly foot care for healthy, well-groomed feet.' },
  'SVC_L_MANI_CLASSIC': { name: 'Classic Manicure', price: 'Rs.700', benefits: 'A 45-minute manicure with professional scrub, deep cuticle care, and a nourishing massage pack. Noticeably softer hands and perfectly shaped nails. A real step up from the ordinary — your hands will feel pampered.' },
  'SVC_L_PEDI_CLASSIC': { name: 'Classic Pedicure', price: 'Rs.1300', benefits: 'A thorough 45-minute pedicure targeting rough heels and dry skin with professional scrub and massage pack. Your feet will feel genuinely transformed — soft, smooth, and salon-perfect after one session.' },
  'SVC_L_MANI_PREMIUM': { name: 'Premium Manicure', price: 'Rs.1500', benefits: 'A full 1-hour luxury hand treatment with deep conditioning and professional massage pack. The most pampering hand care available — perfect before weddings, events, or whenever you want to feel completely taken care of.' },
  'SVC_L_PEDI_PREMIUM': { name: 'Premium Pedicure', price: 'Rs.2000', benefits: 'The ultimate 1-hour foot treatment — heel clearing, scrub, intensive massage pack, and deep moisturizing. Transforms even the most neglected feet into salon-perfect, silky-smooth feet. Highly recommended before any special occasion.' },
  'SVC_BRIDAL_SILVER': { name: 'Silver Bridal Package', price: 'Rs.5999', benefits: 'Complete pre-wedding package: O3 Facial + Classic Pedicure/Manicure + Face & Neck D-Tan + Hair Spa. Everything you need to look and feel radiant on your special day — all in one affordable package. Individual services worth Rs.10,100+.' },
  'SVC_BRIDAL_PLATINUM': { name: 'Platinum Bridal Package', price: 'Rs.9999', benefits: 'Premium bridal prep: Radiation Facial + Luxury Pedicure + Luxury Spa + Full Arm/Leg/Under Arm Wax + D-Tan for Back/Face & Neck. Head-to-toe bridal preparation — skin, hair, and body all covered. Individual services worth Rs.15,000+.' },
  'SVC_BRIDAL_DIAMOND': { name: 'Diamond Bridal Package', price: 'Rs.14999', benefits: 'The most complete bridal experience: Microderm Facial + Luxury Pedi/Mani + Full Body D-Tan + Back Polishing + Advanced Haircut + Full Face Threading. Absolutely everything covered for your most important day. Individual services worth Rs.20,000+.' },
  'SVC_G_CLASSIC_CUT': { name: 'Classic Haircut', price: 'Rs.200', benefits: 'A clean, precise professional haircut — fade, taper, crew cut, side part, or any style you prefer. Our barbers are skilled in all classic men cuts. Quick, sharp, and exactly how you want it.' },
  'SVC_G_CLASSIC_BEARD': { name: 'Classic Beard Trim', price: 'Rs.200', benefits: 'Precise beard shaping, trimming, and lining using professional clippers and razor. Shaped to complement your face structure — whether sharp fade, rounded shape, or designer stubble. Sharp, clean, and well-defined.' },
  'SVC_G_CLASSIC_CUTSHAVE': { name: 'Classic Cut + Shave', price: 'Rs.350', benefits: 'A professional haircut plus a clean hot towel shave with shaving cream and straight razor. The classic barbershop experience that leaves you looking sharp and completely polished from head to face.' },
  'SVC_G_LUXURY_CUT': { name: 'Luxury Haircut', price: 'Rs.300', benefits: 'An elevated haircut with extra precision, detailed finishing, and a professional blow-dry and styling. For those who want a premium result — not just a trim, but a proper styled look.' },
  'SVC_G_LUXURY_BEARD': { name: 'Luxury Beard', price: 'Rs.300', benefits: 'Premium beard grooming with detailed shaping, hot towel treatment, beard oil conditioning, and precision lining. Leaves your beard looking sharp, healthy, soft, and perfectly styled.' },
  'SVC_G_LUXURY_CUTSHAVE': { name: 'Luxury Cut + Shave + Wash', price: 'Rs.500', benefits: 'The complete luxury grooming session — precision haircut, professional wash, blow-dry, and a hot towel straight razor shave. Walk out looking and feeling like a completely different, sharper version of yourself.' },
  'SVC_G_HAIRWASH': { name: 'Hair Wash', price: 'Rs.100', benefits: 'Professional salon wash using premium shampoo and conditioner selected for your hair type, with a relaxing scalp massage. Quick, affordable, and leaves hair clean, healthy-smelling, and refreshed.' },
  'SVC_G_HAIRSETTING': { name: 'Hair Setting', price: 'Rs.150', benefits: 'Professional styling using the right products for your hair type. Our stylists shape and set your hair to your preferred style — neat, polished, and exactly how you want it for important occasions.' },
  'SVC_G_BLOWDRY_SETTING': { name: 'Blow Dry With Hair Setting', price: 'Rs.200', benefits: 'Blow-dry plus professional styling for a polished, well-groomed finish. Hair looks neat, shaped, and styled. Great before meetings, events, or any time you need to make a strong impression.' },
  'SVC_G_BLOWDRY_POWDER': { name: 'Blow Dry With Hair Powder', price: 'Rs.400', benefits: 'Blow-dry with professional hair powder for maximum volume, texture, and hold. Adds thickness and a stylish matte finish. Perfect for fine hair or anyone who wants a fuller, more textured, high-fashion look.' },
  'SVC_G_BLOWDRY_FIBER': { name: 'Blow Dry With Hair Fiber', price: 'Rs.500', benefits: 'Blow-dry with hair fiber that bonds to existing hair and makes it appear dramatically thicker and fuller. Ideal for thinning hair or for creating impressive volume and texture. Looks completely natural.' },
  'SVC_G_SMOOTHENING': { name: 'Smoothening (Gents)', price: 'Rs.1500+ (depending on hair length)', benefits: 'Get permanently straight, frizz-free hair lasting 4–6 months at a fraction of the ladies price. Perfect for men with curly, wavy, or unruly hair who want low-maintenance, clean, straight hair every day without daily effort.' },
  'SVC_G_KERATIN': { name: 'Keratin Treatment (Gents)', price: 'Rs.4000+ (depending on hair length)', benefits: 'Eliminates frizz and makes hair smooth, shiny, and easy to manage for 3–5 months. Reduces blow-dry time significantly. Great for men with thick, frizzy, or chemically treated hair who want consistently healthy-looking hair.' },
  'SVC_G_BOTOX': { name: 'Hair Botox (Gents)', price: 'Rs.5000+ (depending on hair length)', benefits: 'Deep conditioning using proteins and collagen that repairs damaged hair without any chemical alteration. Purely nourishes and restores. Perfect for over-processed or heat-damaged hair that needs serious repair and shine restoration.' },
  'SVC_G_KERASMOOTH': { name: 'Kera Smooth (Gents)', price: 'Rs.6000+ (depending on hair length)', benefits: 'The most advanced and longest-lasting hair straightening system — results last up to 6–8 months. Best for very curly, coarse, or thick hair that regular treatments struggle to fully manage. Maximum results, minimum maintenance.' },
  'SVC_G_CURLING': { name: 'Curling (Gents)', price: 'Rs.4500+ (depending on hair length)', benefits: 'Creates permanent curls or waves on straight hair using professional waving solution. Choose from loose waves to tight curls. Lasts 3–6 months. A great way to add texture, personality, and style to straight or fine hair.' },
  'SVC_G_NANOPLASTY': { name: 'Nanoplasty (Gents)', price: 'Rs.8000+ (depending on hair length)', benefits: 'Organic straightening with zero formaldehyde — completely safe and deeply nourishing while straightening. Uses nanotechnology for incredible shine and silkiness. Lasts 4–6 months. The cleanest straightening treatment available.' },
  'SVC_G_SHINEINFUSION': { name: 'Shine Infusion (Gents)', price: 'Rs.5000', benefits: 'Adds mirror-like gloss and smoothness to dull or dry hair without any chemicals. Dramatically reduces frizz and makes hair look noticeably healthier and more vibrant for 6–8 weeks. Low effort, high impact.' },
  'SVC_G_DANDRUFF_BASIC': { name: 'Anti Dandruff Basic (Gents)', price: 'Rs.1500+', benefits: 'Targeted medicated scalp treatment that removes flakes, controls excess sebum, and reduces scalp inflammation. Includes a relaxing scalp massage. Significant, noticeable improvement in dandruff after 2–3 sessions.' },
  'SVC_G_DANDRUFF_PREMIUM': { name: 'Anti Dandruff Premium (Gents)', price: 'Rs.2500+', benefits: 'Advanced anti-dandruff protocol combining medicated treatment, anti-fungal application, nourishing serum, and steam therapy. For stubborn dandruff with scalp inflammation or persistent itchiness that basic treatment does not fully resolve.' },
  'SVC_G_SPA_BASIC': { name: 'Hair Spa Basic (Gents)', price: 'Rs.1200+', benefits: 'Nourishing spa treatment that restores moisture, reduces breakage, and adds shine. Includes head massage, steaming, and mask. Hair feels soft, hydrated, and completely refreshed immediately after. A must for healthy hair maintenance.' },
  'SVC_G_SPA_PREMIUM': { name: 'Hair Spa Premium (Gents)', price: 'Rs.1500+', benefits: 'Protein-concentrated spa that rebuilds damaged hair structure and reduces breakage significantly. Includes scalp massage, protein mask with steam, and finishing serum. Best for hair that snaps, feels weak, or is heavily styled with heat.' },
  'SVC_G_SPA_MOROCCAN': { name: 'Moroccan Spa (Gents)', price: 'Rs.2000+', benefits: 'Pure Argan oil spa that transforms dull, dry hair into lustrous, shiny, healthy-looking locks. Rich in Vitamin E and fatty acids. Includes massage, Argan oil mask, and steam for deep penetration. Your hair will look and feel completely different after.' },
  'SVC_G_COLOUR_GRAY': { name: 'Hair Colour Gray Coverage', price: 'Rs.800+ (Loreal Schoff)', benefits: 'Complete grey coverage using Loreal Schoff — one of the best professional colour brands. Covers even the most stubborn greys for a natural, youthful look that lasts 6–8 weeks. Available in all natural shades to perfectly match your hair.' },
  'SVC_G_COLOUR_AMMONIAFREE': { name: 'Hair Colour Ammonia Free', price: 'Rs.1000+ (Loreal Schoff)', benefits: 'Gentler grey coverage with zero ammonia — less scalp irritation, no strong smell, and maintains hair health better than regular colour. Still gives excellent coverage using premium Loreal Schoff. Perfect for sensitive scalps.' },
  'SVC_G_BEARD_COLOUR': { name: 'Beard Colour', price: 'Rs.300+', benefits: 'Professional beard colour that covers grey hairs for a fuller, younger, more defined appearance. Matched precisely to your hair colour or customized to your preference. Quick, precise, and very effective.' },
  'SVC_G_FASHION_COLOUR': { name: 'Fashion Colour (Gents)', price: 'Rs.1500+', benefits: 'Bold, creative colour for men who want to stand out — ash grey, platinum, burgundy, blue, or any fashion shade. Our colourists specialize in modern men colour trends. Make a statement that is completely your own.' },
  'SVC_G_CAP_HIGHLIGHTS': { name: 'Cap Highlights', price: 'Rs.2000+', benefits: 'Classic cap highlighting creates natural-looking lighter streaks through the hair. Adds dimension, depth, and a sun-kissed effect to darker hair. Low maintenance as it grows out naturally — always looks intentional and stylish.' },
  'SVC_G_COLOUR_GEL': { name: 'Colour Hair Gel', price: 'Rs.400+', benefits: 'Colour-enhanced styling gel that adds a subtle tint while styling your hair. Covers light greys and adds shine. Great for men who want minimal, natural-looking coverage as part of their daily styling routine — no extra effort needed.' },
  'SVC_G_BEARD_GEL': { name: 'Beard Basic Gel', price: 'Rs.250+', benefits: 'Colour-tinted beard gel that covers light grey beard hairs while giving your beard shape and hold. A quick, easy way to keep your beard looking groomed, defined, and youthful every single day.' },
  'SVC_G_MASSAGE_OIL': { name: 'Oil Massage With Wash', price: 'Rs.500', benefits: 'A deeply relaxing scalp massage using warm nourishing oil, followed by a professional wash. Improves blood circulation, reduces stress, nourishes the scalp, and promotes hair health. One of the most relaxing treatments at ABCD — you will not want it to end.' },
  'SVC_G_MASSAGE_NORMAL': { name: 'Normal Head Massage', price: 'Rs.300', benefits: 'A relaxing dry head massage that relieves tension, reduces stress, and promotes calm. Quick, affordable, and genuinely effective for de-stressing after a long day. One of the simplest treatments with an immediate feel-good result.' },
  'SVC_G_MANI_ORDINARY': { name: 'Ordinary Manicure (Gents)', price: 'Rs.500', benefits: 'Nail cutting, shaping, filing, cuticle care, and hand massage. Well-groomed hands make a strong impression in professional and personal settings. More men are discovering that regular manicures are essential, not optional.' },
  'SVC_G_PEDI_ORDINARY': { name: 'Ordinary Pedicure (Gents)', price: 'Rs.900', benefits: 'Nail trimming, filing, cuticle care, and foot massage. Essential for foot health — prevents ingrown nails, removes calluses, and keeps feet comfortable. Your feet work hard every day and deserve proper care.' },
  'SVC_G_MANI_CLASSIC': { name: 'Classic Manicure (Gents)', price: 'Rs.700', benefits: 'Enhanced 45-minute manicure with professional scrub and nourishing massage pack. More thorough nail and hand care for men who understand that groomed hands are part of a complete, polished appearance.' },
  'SVC_G_PEDI_CLASSIC': { name: 'Classic Pedicure (Gents)', price: 'Rs.1300', benefits: 'Thorough 45-minute pedicure with heel clearing, scrub, and massage pack. Targets rough heels and dry skin — essential for men who stand or walk a lot. Feet feel genuinely comfortable and healthy after every session.' },
  'SVC_G_MANI_PREMIUM': { name: 'Premium Manicure (Gents)', price: 'Rs.1500', benefits: 'Luxurious 1-hour hand treatment with deep conditioning massage pack. Professional men know that groomed, healthy hands communicate attention to detail and self-care. The most comprehensive hand treatment we offer.' },
  'SVC_G_PEDI_PREMIUM': { name: 'Premium Pedicure (Gents)', price: 'Rs.2000', benefits: 'The ultimate 1-hour foot treatment — completely removes rough skin, heals cracked heels, and deeply moisturizes. Transforms the most neglected feet into healthy, comfortable, salon-quality feet. Highly recommended before any important occasion.' },
  'SVC_GROOM_GLOW': { name: 'Glow Groom Package', price: 'Rs.3700 (was Rs.4500)', benefits: 'Complete groom package with Hair Spa + Facial + Cutting & Shaving complimentary. Hair spa gives you healthy, shiny hair. Facial gives event-ready glowing skin. Fresh cut finishes the look. Save Rs.800 — the most popular groom package at ABCD.' },
  'SVC_GROOM_GOLD': { name: 'Gold Glow Up Package', price: 'Rs.5000 (was Rs.5500)', benefits: 'Premium groom preparation with Luxury Hair Spa + Premium Facial + Cutting & Shaving complimentary. Upgraded products and techniques for men who want the absolute best for their most important day. Save Rs.500 vs individual pricing.' },
  'SVC_GROOM_BOOSTER': { name: 'Booster Glow Up Package', price: 'Price on request — fully customizable', benefits: 'The most comprehensive groom package — Facial Gold Glow Up + Cutting & Shaving complimentary + your choice of Keratin/Botox, Manicure/Pedicure, Smoothening, or Hair Spa. Build the perfect grooming package for your specific needs. Call 7012121125 for a custom quote tailored to you.' },
};

// ─── MENU DEFINITIONS ─────────────────────────────────────────────────────────
const MENUS = {
  // LADIES MAIN
  "LADIES_MAIN": { title: "Ladies services:", btn: "View Services", rows: [
    { id: "LADIES_HAIRTREAT", title: "Hair Treatments", description: "Smoothening, Keratin, Spa..." },
    { id: "LADIES_HAIRCUT", title: "Haircut & Styling", description: "All haircut styles..." },
    { id: "LADIES_COLOUR", title: "Hair Colour", description: "Colour, Highlights, Balayage..." },
    { id: "LADIES_SKIN", title: "Skin Treatment", description: "Facials, Hydra, Cleanup..." },
    { id: "LADIES_FACETREAT", title: "Face Treatment", description: "Cleanup, De-Tan, Bleach..." },
    { id: "LADIES_KOREAN", title: "Korean Clinical", description: "Laser, IPL, BB Glow..." },
    { id: "LADIES_WAXING", title: "Waxing", description: "Reca Wax, Brazilian Wax..." },
    { id: "LADIES_MANIPEDI", title: "Manicure & Pedicure", description: "Ordinary, Classic, Premium" },
    { id: "LADIES_BRIDAL", title: "Bridal Package", description: "Silver, Platinum, Diamond" },
    { id: "CAT_BOOK", title: "Book Appointment", description: "Schedule a visit" },
  ]},
  // GENTS MAIN
  "GENTS_MAIN": { title: "Gents services:", btn: "View Services", rows: [
    { id: "GENTS_HAIRCUT", title: "Haircut & Beard", description: "Classic, Luxury styles..." },
    { id: "GENTS_STYLING", title: "Hair Styling", description: "Blow dry, Setting..." },
    { id: "GENTS_HAIRTREAT", title: "Hair Treatments", description: "Keratin, Smoothening, Spa..." },
    { id: "GENTS_COLOUR", title: "Hair Colour", description: "Grey coverage, Fashion..." },
    { id: "GENTS_MASSAGE", title: "Head Massage", description: "Oil massage, Normal..." },
    { id: "GENTS_SKIN", title: "Skin Treatment", description: "Facials, Hydra..." },
    { id: "GENTS_FACETREAT", title: "Face Treatment", description: "Cleanup, De-Tan, Bleach..." },
    { id: "GENTS_KOREAN", title: "Korean Clinical", description: "Laser, IPL, BB Glow..." },
    { id: "GENTS_MANIPEDI", title: "Manicure & Pedicure", description: "Ordinary, Classic, Premium" },
    { id: "GENTS_GROOM", title: "Groom Package", description: "Glow Groom, Gold Glow Up..." },
  ]},
  // LADIES HAIR TREATMENTS
  "LADIES_HAIRTREAT": { title: "Hair Treatments:", btn: "Select", rows: [
    { id: "SVC_L_SMOOTHENING", title: "Smoothening", description: "Rs.4000+" },
    { id: "SVC_L_KERATIN", title: "Keratin Treatment", description: "Rs.6000+" },
    { id: "SVC_L_BOTOX", title: "Hair Botox", description: "Rs.7000+" },
    { id: "SVC_L_KERASMOOTH", title: "Kera Smooth", description: "Rs.10000+" },
    { id: "SVC_L_CROWN", title: "Crown Smoothening", description: "Rs.3000" },
    { id: "SVC_L_ROUTETOUCHUP", title: "Route Touch Up", description: "Rs.3500+" },
    { id: "SVC_L_NANOPLASTY", title: "Nanoplasty", description: "Rs.8000+" },
    { id: "SVC_L_SHINEINFUSION", title: "Shine Infusion", description: "Rs.5000" },
    { id: "LADIES_HAIRTREAT2", title: "More Treatments →", description: "Ironing, Dandruff, Hair Spa" },
  ]},
  "LADIES_HAIRTREAT2": { title: "More Hair Treatments:", btn: "Select", rows: [
    { id: "SVC_L_HAIRIRONING", title: "Hair Ironing", description: "Rs.1000+" },
    { id: "SVC_L_TONGCURLS", title: "Tong Curls", description: "Rs.1500+" },
    { id: "SVC_L_HAIRWASH", title: "Hair Wash Dryer Set", description: "Rs.500" },
    { id: "LADIES_DANDRUFF", title: "Dandruff Treatment →", description: "Basic, Premium" },
    { id: "LADIES_HAIRSPA", title: "Hair Spa →", description: "Nourishing, Protein, Moroccan" },
  ]},
  "LADIES_DANDRUFF": { title: "Dandruff Treatment:", btn: "Select", rows: [
    { id: "SVC_L_DANDRUFF_BASIC", title: "Anti Dandruff Basic", description: "Rs.2000" },
    { id: "SVC_L_DANDRUFF_PREMIUM", title: "Anti Dandruff Premium", description: "Rs.2500" },
  ]},
  "LADIES_HAIRSPA": { title: "Hair Spa:", btn: "Select", rows: [
    { id: "SVC_L_SPA_NOURISHING", title: "Nourishing Spa", description: "Rs.1200+" },
    { id: "SVC_L_SPA_PROTEIN", title: "Protein Spa", description: "Rs.2000" },
    { id: "SVC_L_SPA_MOROCCAN", title: "Moroccan Spa", description: "Rs.2500" },
  ]},
  // LADIES HAIRCUT
  "LADIES_HAIRCUT": { title: "Haircut styles:", btn: "Select", rows: [
    { id: "SVC_L_UCUT", title: "U Cut", description: "Rs.400" },
    { id: "SVC_L_VCUT", title: "V Cut", description: "Rs.400" },
    { id: "SVC_L_STRAIGHTCUT", title: "Straight Cut", description: "Rs.300" },
    { id: "SVC_L_LAYERCUT", title: "Layer Cut", description: "Rs.600 (with wash)" },
    { id: "SVC_L_STEPCUT", title: "Step Cut", description: "Rs.600 (with wash)" },
    { id: "SVC_L_FEATHEREDCUT", title: "Feathered Cut", description: "Rs.700 (with wash)" },
    { id: "SVC_L_BOBCUT", title: "Bob Cut", description: "Rs.700 (with wash+set)" },
    { id: "SVC_L_BLENDCUT", title: "Blend Cut", description: "Rs.600 (with wash+set)" },
    { id: "LADIES_HAIRCUT2", title: "More Cuts →", description: "Pixie, Inverted Bob, Kids..." },
  ]},
  "LADIES_HAIRCUT2": { title: "More Haircut Styles:", btn: "Select", rows: [
    { id: "SVC_L_PIXIECUT", title: "Pixie Cut", description: "Rs.800 (with wash+set)" },
    { id: "SVC_L_INVERTEDBOB", title: "Inverted Bob", description: "Rs.800 (with wash+set)" },
    { id: "SVC_L_GRADUATEDBOB", title: "Graduated Bob", description: "Rs.800 (with wash+set)" },
    { id: "LADIES_KIDS", title: "Kids Cuts →", description: "All kids styles..." },
  ]},
  "LADIES_KIDS": { title: "Kids Cuts:", btn: "Select", rows: [
    { id: "SVC_L_KIDS_LAYER", title: "Kids Layer Cut", description: "Rs.600 (with wash)" },
    { id: "SVC_L_KIDS_BOB", title: "Kids Bob Cut", description: "Rs.500 (with wash)" },
    { id: "SVC_L_KIDS_BUTTERFLY", title: "Butterfly Cut", description: "Rs.700 (with wash)" },
    { id: "SVC_L_KIDS_FEATHER", title: "Feather Cut", description: "Rs.700 (with wash)" },
    { id: "SVC_L_KIDS_BABYCUT", title: "Baby Cut", description: "Rs.200-300 (with wash)" },
  ]},
  // LADIES COLOUR
  "LADIES_COLOUR": { title: "Hair Colour:", btn: "Select", rows: [
    { id: "SVC_L_COLOUR_GLOBAL", title: "Hair Colour Global", description: "Rs.2200" },
    { id: "SVC_L_COLOUR_TOUCHUP", title: "Route Touch Up", description: "Rs.1500" },
    { id: "SVC_L_HIGHLIGHTS", title: "Highlights", description: "Rs.300/strip" },
    { id: "SVC_L_HIGHLIGHTS_PRELIGHT", title: "Highlights + Pre Light", description: "Rs.400/strip" },
    { id: "SVC_L_FASHION_GLOBAL", title: "Fashion Global", description: "Rs.3000+" },
    { id: "SVC_L_BALAYAGE", title: "Balayage", description: "Rs.4000+" },
    { id: "SVC_L_OMBRE", title: "Ombre", description: "Rs.3500+" },
  ]},
  // LADIES SKIN
  "LADIES_SKIN": { title: "Skin Treatment:", btn: "Select", rows: [
    { id: "SVC_L_FACIAL_BASIC", title: "Basic Facial", description: "Rs.1500" },
    { id: "SVC_L_FACIAL_PREMIUM", title: "Premium Facial", description: "Rs.2500" },
    { id: "SVC_L_FACIAL_LUXURY", title: "Luxury Facial", description: "Rs.4000" },
    { id: "SVC_L_FACIAL_GROOMOFFICIAL", title: "Groom Official Facial", description: "Rs.4000" },
    { id: "SVC_L_HYDRAFACIAL", title: "Hydra Facial", description: "Rs.4000" },
    { id: "SVC_L_HYDRA_TREATMENT", title: "Hydra Treatment", description: "Rs.5000" },
    { id: "SVC_L_HYDRA_PREMIUM", title: "Hydra Premium + Hair Spa", description: "Rs.8000" },
  ]},
  // LADIES FACE TREATMENT
  "LADIES_FACETREAT": { title: "Face Treatment:", btn: "Select", rows: [
    { id: "SVC_L_CLEANUP_BASIC", title: "Cleanup Basic", description: "Rs.600" },
    { id: "SVC_L_CLEANUP_PREMIUM", title: "Cleanup Premium", description: "Rs.1000" },
    { id: "SVC_L_DETAN_BASIC", title: "De Tan Basic", description: "Rs.500" },
    { id: "SVC_L_DETAN_PREMIUM", title: "De Tan Premium", description: "Rs.1000" },
    { id: "SVC_L_GLOW_CLEANUP", title: "Glow Cleanup", description: "Rs.1500 (incl De Tan)" },
    { id: "SVC_L_BLEACH", title: "Bleach", description: "Rs.400" },
    { id: "SVC_L_FULLARM_DETAN", title: "Full Arm De Tan/Bleach", description: "Rs.800" },
    { id: "SVC_L_FULLLEG_DETAN", title: "Full Leg De Tan/Bleach", description: "Rs.1000" },
    { id: "SVC_L_FACEMASSAGE", title: "Face Massage", description: "Rs.800+ (20 mins)" },
  ]},
  // LADIES KOREAN
  "LADIES_KOREAN": { title: "Korean Clinical Treatments:", btn: "Select", rows: [
    { id: "SVC_HYDRAFACIAL_CLINIC", title: "Hydra Facial", description: "Rs.3500" },
    { id: "SVC_HYDRA_BASIC", title: "Hydra Treatment Basic", description: "Rs.5000" },
    { id: "SVC_HYDRA_PREMIUM_CLINIC", title: "Hydra Treatment Premium", description: "Rs.8000" },
    { id: "SVC_MEDIFACIAL", title: "Medi Facial Tan", description: "Rs.2000" },
    { id: "SVC_CARBON_LASER", title: "Carbon Laser Toning", description: "Rs.6000" },
    { id: "SVC_IPL_PHOTO", title: "IPL Photolaser", description: "Rs.5500" },
    { id: "SVC_IPL_HAIRREMOVAL", title: "IPL Hair Removal", description: "Rs.1500" },
    { id: "SVC_MICRONEEDLING_FACE", title: "Micro Needling Face", description: "Rs.6000" },
    { id: "SVC_MICRONEEDLING_HAIR", title: "Micro Needling Hair", description: "Rs.6000" },
    { id: "LADIES_KOREAN2", title: "More Treatments →", description: "BB Glow, Tattoo, Lips..." },
  ]},
  "LADIES_KOREAN2": { title: "More Korean Treatments:", btn: "Select", rows: [
    { id: "SVC_MESOTHERAPY", title: "Mesotherapy", description: "Rs.4000" },
    { id: "SVC_BBGLOW", title: "B.B Glow Treatment", description: "Rs.6000" },
    { id: "SVC_LLL_THERAPY", title: "L.L.L Therapy", description: "Rs.1500" },
    { id: "SVC_CHEMICAL_PEEL", title: "Chemical Peel", description: "Rs.2000+" },
    { id: "SVC_OXYGENO", title: "Oxygeno Treatment", description: "Rs.6000" },
    { id: "SVC_MEDI_CLEANUP", title: "Medi Cleanup Facial", description: "Rs.1500" },
    { id: "SVC_SKIN_TIGHTENING", title: "Saggy Skin Tightening", description: "Rs.3000" },
    { id: "SVC_TATTOO_REMOVAL", title: "Tattoo Removal", description: "Rs.2500" },
    { id: "SVC_MICROBLADING", title: "Micro Blading", description: "Rs.10000/8000/4000" },
    { id: "LADIES_KOREAN3", title: "More →", description: "Lip treatments, Brows..." },
  ]},
  "LADIES_KOREAN3": { title: "Lip & Brow Treatments:", btn: "Select", rows: [
    { id: "SVC_LIP_NEUTRALIZING", title: "Lip Neutralizing", description: "Rs.4000" },
    { id: "SVC_LIP_COLOURING", title: "Lip Colouring", description: "Rs.6000" },
    { id: "SVC_LIP_CONTOURING", title: "Lip Contouring", description: "Rs.2000" },
    { id: "SVC_EYEBROW_SHADING", title: "Eye Brow Shading", description: "Rs.4000" },
    { id: "SVC_BEAUTY_SPOT", title: "Beauty Spot", description: "Rs.500" },
  ]},
  // LADIES WAXING
  "LADIES_WAXING": { title: "Waxing:", btn: "Select", rows: [
    { id: "LADIES_RECA_WAX", title: "Reca Wax →", description: "Arms, Legs, Full Body..." },
    { id: "LADIES_BRAZILIAN_WAX", title: "Brazilian Wax →", description: "Face, Underarms..." },
  ]},
  "LADIES_RECA_WAX": { title: "Reca Wax:", btn: "Select", rows: [
    { id: "SVC_WAX_HALFARM", title: "Half Arm", description: "Rs.500" },
    { id: "SVC_WAX_HALFLEG", title: "Half Leg", description: "Rs.700" },
    { id: "SVC_WAX_FULLARM", title: "Full Arm", description: "Rs.800" },
    { id: "SVC_WAX_FULLLEG", title: "Full Leg", description: "Rs.1200" },
    { id: "SVC_WAX_FULLBODY", title: "Full Body", description: "Rs.4000" },
    { id: "SVC_WAX_BACKFRONT", title: "Back And Front", description: "Rs.800" },
  ]},
  "LADIES_BRAZILIAN_WAX": { title: "Brazilian Wax:", btn: "Select", rows: [
    { id: "SVC_WAX_UPPERLIP", title: "Upper Lip", description: "Rs.150" },
    { id: "SVC_WAX_FOREHEAD", title: "Fore Head", description: "Rs.150" },
    { id: "SVC_WAX_FULLFACE", title: "Full Face", description: "Rs.500" },
    { id: "SVC_WAX_UNDERARMS", title: "Under Arms", description: "Rs.500" },
  ]},
  // LADIES MANI PEDI
  "LADIES_MANIPEDI": { title: "Manicure & Pedicure:", btn: "Select", rows: [
    { id: "SVC_L_MANI_ORDINARY", title: "Ordinary Manicure", description: "Rs.500" },
    { id: "SVC_L_PEDI_ORDINARY", title: "Ordinary Pedicure", description: "Rs.900" },
    { id: "SVC_L_MANI_CLASSIC", title: "Classic Manicure", description: "Rs.700" },
    { id: "SVC_L_PEDI_CLASSIC", title: "Classic Pedicure", description: "Rs.1300" },
    { id: "SVC_L_MANI_PREMIUM", title: "Premium Manicure", description: "Rs.1500" },
    { id: "SVC_L_PEDI_PREMIUM", title: "Premium Pedicure", description: "Rs.2000" },
  ]},
  // BRIDAL
  "LADIES_BRIDAL": { title: "Bridal Packages:", btn: "Select", rows: [
    { id: "SVC_BRIDAL_SILVER", title: "Silver Package", description: "Rs.5999" },
    { id: "SVC_BRIDAL_PLATINUM", title: "Platinum Package", description: "Rs.9999" },
    { id: "SVC_BRIDAL_DIAMOND", title: "Diamond Package", description: "Rs.14999" },
  ]},
  // GENTS HAIRCUT
  "GENTS_HAIRCUT": { title: "Haircut & Beard:", btn: "Select", rows: [
    { id: "GENTS_CLASSIC", title: "Classic →", description: "Cut Rs.200, Beard Rs.200..." },
    { id: "GENTS_LUXURY", title: "Luxury →", description: "Cut Rs.300, Beard Rs.300..." },
  ]},
  "GENTS_CLASSIC": { title: "Classic:", btn: "Select", rows: [
    { id: "SVC_G_CLASSIC_CUT", title: "Haircut", description: "Rs.200" },
    { id: "SVC_G_CLASSIC_BEARD", title: "Beard", description: "Rs.200" },
    { id: "SVC_G_CLASSIC_CUTSHAVE", title: "Cutting + Shaving", description: "Rs.350" },
  ]},
  "GENTS_LUXURY": { title: "Luxury:", btn: "Select", rows: [
    { id: "SVC_G_LUXURY_CUT", title: "Cutting", description: "Rs.300" },
    { id: "SVC_G_LUXURY_BEARD", title: "Beard", description: "Rs.300" },
    { id: "SVC_G_LUXURY_CUTSHAVE", title: "Cutting + Shaving + Wash", description: "Rs.500" },
  ]},
  // GENTS STYLING
  "GENTS_STYLING": { title: "Hair Styling:", btn: "Select", rows: [
    { id: "SVC_G_HAIRWASH", title: "Hair Wash", description: "Rs.100" },
    { id: "SVC_G_HAIRSETTING", title: "Hair Setting", description: "Rs.150" },
    { id: "SVC_G_BLOWDRY_SETTING", title: "Blow Dry + Setting", description: "Rs.200" },
    { id: "SVC_G_BLOWDRY_POWDER", title: "Blow Dry + Powder", description: "Rs.400" },
    { id: "SVC_G_BLOWDRY_FIBER", title: "Blow Dry + Fiber", description: "Rs.500" },
  ]},
  // GENTS HAIR TREATMENTS
  "GENTS_HAIRTREAT": { title: "Hair Treatments:", btn: "Select", rows: [
    { id: "SVC_G_SMOOTHENING", title: "Smoothening", description: "Rs.1500+" },
    { id: "SVC_G_KERATIN", title: "Keratin", description: "Rs.4000+" },
    { id: "SVC_G_BOTOX", title: "Hair Botox", description: "Rs.5000+" },
    { id: "SVC_G_KERASMOOTH", title: "Kera Smooth", description: "Rs.6000+" },
    { id: "SVC_G_CURLING", title: "Curling", description: "Rs.4500+" },
    { id: "SVC_G_NANOPLASTY", title: "Nanoplasty", description: "Rs.8000+" },
    { id: "SVC_G_SHINEINFUSION", title: "Shine Infusion", description: "Rs.5000" },
    { id: "GENTS_DANDRUFF", title: "Dandruff Treatment →", description: "Basic, Premium" },
    { id: "GENTS_HAIRSPA", title: "Hair Spa →", description: "Basic, Premium, Moroccan" },
  ]},
  "GENTS_DANDRUFF": { title: "Dandruff Treatment:", btn: "Select", rows: [
    { id: "SVC_G_DANDRUFF_BASIC", title: "Anti Dandruff Basic", description: "Rs.1500+" },
    { id: "SVC_G_DANDRUFF_PREMIUM", title: "Anti Dandruff Premium", description: "Rs.2500+" },
  ]},
  "GENTS_HAIRSPA": { title: "Hair Spa:", btn: "Select", rows: [
    { id: "SVC_G_SPA_BASIC", title: "Spa Basic", description: "Rs.1200+" },
    { id: "SVC_G_SPA_PREMIUM", title: "Spa Premium", description: "Rs.1500+" },
    { id: "SVC_G_SPA_MOROCCAN", title: "Moroccan Spa", description: "Rs.2000+" },
  ]},
  // GENTS COLOUR
  "GENTS_COLOUR": { title: "Hair Colour:", btn: "Select", rows: [
    { id: "SVC_G_COLOUR_GRAY", title: "Gray Coverage (Loreal)", description: "Rs.800+" },
    { id: "SVC_G_COLOUR_AMMONIAFREE", title: "Ammonia Free (Loreal)", description: "Rs.1000+" },
    { id: "SVC_G_BEARD_COLOUR", title: "Beard Colour", description: "Rs.300+" },
    { id: "SVC_G_FASHION_COLOUR", title: "Fashion Colour", description: "Rs.1500+" },
    { id: "SVC_G_CAP_HIGHLIGHTS", title: "Cap Highlights", description: "Rs.2000+" },
    { id: "SVC_G_COLOUR_GEL", title: "Colour Hair Gel", description: "Rs.400+" },
    { id: "SVC_G_BEARD_GEL", title: "Beard Basic Gel", description: "Rs.250+" },
  ]},
  // GENTS MASSAGE
  "GENTS_MASSAGE": { title: "Head Massage:", btn: "Select", rows: [
    { id: "SVC_G_MASSAGE_OIL", title: "Oil Massage + Wash", description: "Rs.500" },
    { id: "SVC_G_MASSAGE_NORMAL", title: "Normal Massage", description: "Rs.300" },
  ]},
  // GENTS SKIN (same as ladies)
  "GENTS_SKIN": { title: "Skin Treatment:", btn: "Select", rows: [
    { id: "SVC_L_FACIAL_BASIC", title: "Basic Facial", description: "Rs.1500" },
    { id: "SVC_L_FACIAL_PREMIUM", title: "Premium Facial", description: "Rs.2500" },
    { id: "SVC_L_FACIAL_LUXURY", title: "Luxury Facial", description: "Rs.4000" },
    { id: "SVC_L_FACIAL_GROOMOFFICIAL", title: "Groom Official Facial", description: "Rs.4000" },
    { id: "SVC_L_HYDRAFACIAL", title: "Hydra Facial", description: "Rs.4000" },
    { id: "SVC_L_HYDRA_TREATMENT", title: "Hydra Treatment", description: "Rs.5000" },
    { id: "SVC_L_HYDRA_PREMIUM", title: "Hydra Premium + Hair Spa", description: "Rs.8000" },
  ]},
  // GENTS FACE (same as ladies)
  "GENTS_FACETREAT": { title: "Face Treatment:", btn: "Select", rows: [
    { id: "SVC_L_CLEANUP_BASIC", title: "Cleanup Basic", description: "Rs.600" },
    { id: "SVC_L_CLEANUP_PREMIUM", title: "Cleanup Premium", description: "Rs.1000" },
    { id: "SVC_L_DETAN_BASIC", title: "De Tan Basic", description: "Rs.500" },
    { id: "SVC_L_DETAN_PREMIUM", title: "De Tan Premium", description: "Rs.1000" },
    { id: "SVC_L_GLOW_CLEANUP", title: "Glow Cleanup", description: "Rs.1500 (incl De Tan)" },
    { id: "SVC_L_BLEACH", title: "Bleach", description: "Rs.400" },
    { id: "SVC_L_FULLARM_DETAN", title: "Full Arm De Tan/Bleach", description: "Rs.800" },
    { id: "SVC_L_FULLLEG_DETAN", title: "Full Leg De Tan/Bleach", description: "Rs.1000" },
    { id: "SVC_L_FACEMASSAGE", title: "Face Massage", description: "Rs.800+ (20 mins)" },
  ]},
  // GENTS KOREAN (same as ladies)
  "GENTS_KOREAN": { title: "Korean Clinical:", btn: "Select", rows: [
    { id: "SVC_HYDRAFACIAL_CLINIC", title: "Hydra Facial", description: "Rs.3500" },
    { id: "SVC_HYDRA_BASIC", title: "Hydra Treatment Basic", description: "Rs.5000" },
    { id: "SVC_HYDRA_PREMIUM_CLINIC", title: "Hydra Treatment Premium", description: "Rs.8000" },
    { id: "SVC_MEDIFACIAL", title: "Medi Facial Tan", description: "Rs.2000" },
    { id: "SVC_CARBON_LASER", title: "Carbon Laser Toning", description: "Rs.6000" },
    { id: "SVC_IPL_PHOTO", title: "IPL Photolaser", description: "Rs.5500" },
    { id: "SVC_IPL_HAIRREMOVAL", title: "IPL Hair Removal", description: "Rs.1500" },
    { id: "SVC_MICRONEEDLING_FACE", title: "Micro Needling Face", description: "Rs.6000" },
    { id: "SVC_MICRONEEDLING_HAIR", title: "Micro Needling Hair", description: "Rs.6000" },
    { id: "GENTS_KOREAN2", title: "More →", description: "BB Glow, Tattoo, Peel..." },
  ]},
  "GENTS_KOREAN2": { title: "More Korean Treatments:", btn: "Select", rows: [
    { id: "SVC_MESOTHERAPY", title: "Mesotherapy", description: "Rs.4000" },
    { id: "SVC_BBGLOW", title: "B.B Glow Treatment", description: "Rs.6000" },
    { id: "SVC_LLL_THERAPY", title: "L.L.L Therapy", description: "Rs.1500" },
    { id: "SVC_CHEMICAL_PEEL", title: "Chemical Peel", description: "Rs.2000+" },
    { id: "SVC_OXYGENO", title: "Oxygeno Treatment", description: "Rs.6000" },
    { id: "SVC_MEDI_CLEANUP", title: "Medi Cleanup Facial", description: "Rs.1500" },
    { id: "SVC_SKIN_TIGHTENING", title: "Skin Tightening", description: "Rs.3000" },
    { id: "SVC_TATTOO_REMOVAL", title: "Tattoo Removal", description: "Rs.2500" },
    { id: "SVC_MICROBLADING", title: "Micro Blading", description: "Rs.10000/8000/4000" },
    { id: "SVC_EYEBROW_SHADING", title: "Eye Brow Shading", description: "Rs.4000" },
  ]},
  // GENTS MANI PEDI
  "GENTS_MANIPEDI": { title: "Manicure & Pedicure:", btn: "Select", rows: [
    { id: "SVC_G_MANI_ORDINARY", title: "Ordinary Manicure", description: "Rs.500" },
    { id: "SVC_G_PEDI_ORDINARY", title: "Ordinary Pedicure", description: "Rs.900" },
    { id: "SVC_G_MANI_CLASSIC", title: "Classic Manicure", description: "Rs.700" },
    { id: "SVC_G_PEDI_CLASSIC", title: "Classic Pedicure", description: "Rs.1300" },
    { id: "SVC_G_MANI_PREMIUM", title: "Premium Manicure", description: "Rs.1500" },
    { id: "SVC_G_PEDI_PREMIUM", title: "Premium Pedicure", description: "Rs.2000" },
  ]},
  // GROOM
  "GENTS_GROOM": { title: "Groom Packages:", btn: "Select", rows: [
    { id: "SVC_GROOM_GLOW", title: "Glow Groom", description: "Rs.3700 (was Rs.4500)" },
    { id: "SVC_GROOM_GOLD", title: "Gold Glow Up", description: "Rs.5000 (was Rs.5500)" },
    { id: "SVC_GROOM_BOOSTER", title: "Booster Glow Up", description: "Custom - call us" },
  ]},
};

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
function getSystemPrompt(lang) {
  const langRule = lang === "ML"
    ? `LANGUAGE RULE: Reply ONLY in Malayalam script. Every single word must be in Malayalam. ZERO English or Manglish unless it is a brand name (ABCD, Keratin, Rs.) or proper noun. Never break this rule.`
    : lang === "MG"
    ? `LANGUAGE RULE: Reply ONLY in Manglish — Malayalam words in English/Roman letters ONLY. Examples: "aanu", "undoo", "venam", "cheyyam", "mathi", "alle", "kitto", "ningalkku", "enthanu". ZERO Malayalam Unicode script. If unsure of a word use English instead.`
    : `LANGUAGE RULE: Reply ONLY in English.`;

  return `You are the AI assistant for ABCD Beauty Clinic & Salon, Kasaragod, Kerala.

${langRule}

LANGUAGE SWITCHING: If the user asks to switch language (e.g. "switch to English", "Malayalam il mathi", "change to Manglish", "English il paranjaal mathi"), switch to that language immediately for all future replies and confirm the switch.

PERSONALITY: Warm, friendly, specific. Max 3 sentences for simple questions. No bullet points. Answer ONLY what the user asked — nothing extra.

STRICT REPLY RULE: Only answer what the user actually asked. If they ask about keratin price, give only keratin price. If they ask about haircut, give only haircut info. Never give unrelated information in the same reply.

LOCATIONS:
- Cherkala (Cherkkala), Kanhangad — GENTS ONLY
- Kanhangad (main branch) — GENTS AND LADIES
Malayalam spellings: ചേർക്കള and കാഞ്ഞങ്ങാഡ് only. NEVER ചേർത്തല.

CONTACT: 7012121125 | Hours: Ladies 10AM-10PM, Gents 10AM-12AM | Open all 7 days

PRICE QUERIES:
- Specific service price asked: give that service price only, clearly and directly.
- Full category price list asked: give the complete list for that category only.
- Never make up prices.

BOOKING FLOW — HIGHEST PRIORITY:
When user says yes to booking, or wants to book, or confirms they want an appointment — IMMEDIATELY start collecting details. Do not ask any other questions first.
Collect one by one:
1. Full name
2. Location — Cherkala (Gents only) or Kanhangad (Gents and Ladies)
3. Service
4. Preferred date (use today date context to resolve tomorrow, today, this evening)
5. Preferred time
6. Section — Ladies or Gents (only if Kanhangad)
Confirm with: "Thank you [Name]! Booking request received. Our team will contact you shortly to confirm. For urgent bookings call 7012121125."
Never confirm or guarantee a slot yourself.

CALLBACK FLOW:
When user asks to speak to team, get a call, or contact someone:
- Ask for their phone number first in their language so team can call them back
- When they give their number, confirm team will call back shortly
- Then the system sends a notification to clinic automatically

PRICES KNOWLEDGE:
LADIES HAIRCUTS: U Cut Rs.400, V Cut Rs.400, Straight Cut Rs.300, Layer Cut Rs.600, Step Cut Rs.600, Feathered Cut Rs.700, Bob Cut Rs.700, Blend Cut Rs.600, Pixie Cut Rs.800, Inverted Bob Rs.800, Graduated Bob Rs.800
KIDS: Layer Rs.600, Bob Rs.500, Butterfly Rs.700, Feather Rs.700, Baby Cut Rs.200-300
LADIES COLOUR: Global Rs.2200, Touch Up Rs.1500, Highlights Rs.300/strip, Fashion Global Rs.3000+, Balayage Rs.4000+, Ombre Rs.3500+
LADIES HAIR TREATMENTS: Smoothening Rs.4000, Keratin Rs.6000, Botox Rs.7000, Kera Smooth Rs.10000, Crown Smoothening Rs.3000, Route Touch Up Rs.3500, Nanoplasty Rs.8000+, Shine Infusion Rs.5000, Hair Ironing Rs.1000+, Tong Curls Rs.1500+
LADIES HAIR SPA: Nourishing Rs.1200+, Protein Rs.2000, Moroccan Rs.2500
LADIES DANDRUFF: Basic Rs.2000, Premium Rs.2500
LADIES SKIN: Basic Facial Rs.1500, Premium Rs.2500, Luxury Rs.4000, Hydra Facial Rs.4000, Hydra Treatment Rs.5000, Hydra Premium Rs.8000
LADIES FACE: Cleanup Basic Rs.600, Premium Rs.1000, De Tan Basic Rs.500, Premium Rs.1000, Glow Cleanup Rs.1500, Bleach Rs.400, Face Massage Rs.800+
LADIES WAXING: Half Arm Rs.500, Half Leg Rs.700, Full Arm Rs.800, Full Leg Rs.1200, Full Body Rs.4000, Upper Lip Rs.150, Full Face Rs.500, Under Arms Rs.500
LADIES MANI/PEDI: Ordinary Mani Rs.500/Pedi Rs.900, Classic Mani Rs.700/Pedi Rs.1300, Premium Mani Rs.1500/Pedi Rs.2000
LADIES BRIDAL: Silver Rs.5999, Platinum Rs.9999, Diamond Rs.14999
KOREAN/CLINICAL: Hydra Facial Rs.3500, Hydra Basic Rs.5000, Hydra Premium Rs.8000, Carbon Laser Rs.6000, IPL Rs.5500, IPL Hair Removal Rs.1500, Micro Needling Face/Hair Rs.6000, Mesotherapy Rs.4000, BB Glow Rs.6000, Chemical Peel Rs.2000+, Oxygeno Rs.6000, Skin Tightening Rs.3000, Tattoo Removal Rs.2500, Micro Blading Rs.10000/8000/4000, Lip Neutralizing Rs.4000, Lip Colouring Rs.6000, Eye Brow Shading Rs.4000
GENTS HAIRCUT CLASSIC: Cut Rs.200, Beard Rs.200, Cut+Shave Rs.350
GENTS HAIRCUT LUXURY: Cut Rs.300, Beard Rs.300, Cut+Shave+Wash Rs.500
GENTS STYLING: Wash Rs.100, Setting Rs.150, Blow Dry+Setting Rs.200, Blow Dry+Powder Rs.400, Blow Dry+Fiber Rs.500
GENTS HAIR TREATMENTS: Smoothening Rs.1500+, Keratin Rs.4000+, Botox Rs.5000+, Kera Smooth Rs.6000+, Curling Rs.4500+, Nanoplasty Rs.8000+, Shine Infusion Rs.5000
GENTS HAIR SPA: Basic Rs.1200+, Premium Rs.1500+, Moroccan Rs.2000+
GENTS DANDRUFF: Basic Rs.1500+, Premium Rs.2500+
GENTS COLOUR: Gray Coverage Rs.800+, Ammonia Free Rs.1000+, Beard Rs.300+, Fashion Rs.1500+, Cap Highlights Rs.2000+
GENTS MASSAGE: Oil+Wash Rs.500, Normal Rs.300
GENTS MANI/PEDI: Same as ladies
GROOM PACKAGES: Glow Groom Rs.3700, Gold Glow Up Rs.5000, Booster custom price`;
}
// ─── GET AI REPLY ─────────────────────────────────────────────────────────────
async function getAIReply(userPhone, userMessage, currentDate, lang) {
  if (!conversations[userPhone]) conversations[userPhone] = [];
  conversations[userPhone].push({ role: "user", content: userMessage });
  if (conversations[userPhone].length > MAX_HISTORY) conversations[userPhone] = conversations[userPhone].slice(-MAX_HISTORY);

  try {
    const response = await ai.chat.completions.create({
      model: "google/gemini-2.0-flash",
      max_tokens: 500,
      messages: [
        { role: "system", content: getSystemPrompt(lang) + `\n\nTODAY: ${currentDate} (IST)` },
        ...conversations[userPhone],
      ],
    });
    const reply = response.choices[0].message.content;
    conversations[userPhone].push({ role: "assistant", content: reply });
    return reply;
  } catch (err) {
    console.error("AI error:", err?.message);
    return lang === "ML" ? "ക്ഷമിക്കണം, ഇപ്പോൾ സഹായിക്കാൻ കഴിയുന്നില്ല. വിളിക്കൂ: 7012121125"
      : lang === "MG" ? "Sorry, ippo help cheyyaan pattunilla. Call cheyyoo: 7012121125"
      : "Sorry, temporarily unavailable. Please call: 7012121125";
  }
}

// ─── SERVICE INFO REPLY ───────────────────────────────────────────────────────
function getBookingPrompt(lang, serviceName) {
  if (lang === "ML") return `\n\nഈ സർവീസ് ബുക്ക് ചെയ്യണോ? 😊`;
  if (lang === "MG") return `\n\nEe service book cheyyano? 😊`;
  return `\n\nWould you like to book an appointment for this? 😊`;
}

async function sendServiceInfo(to, svcId, lang) {
  const svc = SERVICE_INFO[svcId];
  if (!svc) return false;

  const nl = "\n";
  const priceLabel = lang === "ML" ? "നിരക്ക്" : lang === "MG" ? "Rate" : "Price";
  const bookingQ = lang === "ML" ? "ഈ സർവീസ് ബുക്ക് ചെയ്യണോ? 😊"
    : lang === "MG" ? "Ee service book cheyyano? 😊"
    : "Would you like to book an appointment? 😊";

  const msg = svc.name + nl + nl + priceLabel + ": " + svc.price + nl + nl + svc.benefits + nl + nl + bookingQ;

  const MAX_LEN = 1500;
  if (msg.length <= MAX_LEN) {
    await sendText(to, msg);
  } else {
    const half = msg.lastIndexOf(nl, MAX_LEN);
    const part1 = half > 0 ? msg.substring(0, half) : msg.substring(0, MAX_LEN);
    const part2 = msg.substring(part1.length).trim();
    await sendText(to, part1);
    await new Promise(r => setTimeout(r, 800));
    await sendText(to, part2);
  }
  return true;
}

async function extractBookingDetails(userPhone, customerPhone) {
  const history = (conversations[userPhone] || []).map(m => `${m.role}: ${m.content}`).join("\n");
  try {
    const response = await ai.chat.completions.create({
      model: "google/gemini-2.0-flash", max_tokens: 200,
      messages: [{ role: "user", content: `Extract booking from conversation. Return ONLY JSON: {name, location, service, date, time, section}. Use "Not specified" for missing.\n\n${history}` }]
    });
    const raw = response.choices[0].message.content.replace(/```json|```/g, "").trim();
    const d = JSON.parse(raw);
    d.phone = customerPhone;
    return d;
  } catch {
    return { name: "Unknown", phone: customerPhone, location: "?", service: "?", date: "?", time: "?", section: "?" };
  }
}

// ─── SEND MENU ────────────────────────────────────────────────────────────────
async function sendMenu(to, menuId) {
  const menu = MENUS[menuId];
  if (!menu) return false;
  await sendList(to, menu.title, menu.btn, menu.rows);
  return true;
}

// ─── DETECT LANGUAGE SWITCH ──────────────────────────────────────────────────
function detectLanguageSwitch(msg) {
  const m = msg.toLowerCase();
  if (m.includes('switch to english') || m.includes('english il') || m.includes('in english') || m.includes('english mathi') || m.includes('english paranjaal')) return 'EN';
  if (m.includes('malayalam il') || m.includes('in malayalam') || m.includes('malayalam mathi') || m.includes('switch to malayalam')) return 'ML';
  if (m.includes('manglish il') || m.includes('in manglish') || m.includes('manglish mathi') || m.includes('switch to manglish')) return 'MG';
  return null;
}

// ─── DETECT CALLBACK REQUEST ──────────────────────────────────────────────────
function isCallbackRequest(userMsg) {
  const m = userMsg.toLowerCase();
  const hasPhone = /[6-9]\d{9}/.test(userMsg);
  const askedCall = m.includes('call') || m.includes('contact') || m.includes('speak') ||
    m.includes('\u0d35\u0d3f\u0d33\u0d3f') || m.includes('nmber') || m.includes('number');
  return hasPhone || askedCall;
}

// ─── SEND POST-SERVICE BUTTONS ────────────────────────────────────────────────
async function sendPostServiceButtons(to, lang) {
  const texts = {
    EN: "What would you like to do next?",
    ML: "\u0d07\u0d28\u0d3f \u0d0e\u0d28\u0d4d\u0d24\u0d4d \u0d35\u0d47\u0d23\u0d02?",
    MG: "Pinne enthu cheyyano?"
  };
  const btn1 = { EN: "Book Now", ML: "\u0d2c\u0d41\u0d15\u0d4d\u0d15\u0d4d \u0d1a\u0d46\u0d2f\u0d4d\u0d2f\u0d42", MG: "Book Cheyyam" };
  const btn2 = { EN: "More Services", ML: "\u0d2e\u0d31\u0d4d\u0d31\u0d4d \u0d38\u0d47\u0d35\u0d28\u0d19\u0d4d\u0d19\u0d7e", MG: "More Services" };
  const btn3 = { EN: "Talk to Team", ML: "\u0d1f\u0d40\u0d2e\u0d3f\u0d28\u0d4b\u0d1f\u0d4d \u0d38\u0d02\u0d38\u0d3e\u0d30\u0d3f\u0d15\u0d4d\u0d15\u0d3e\u0d02", MG: "Team-nod Saari" };
  const l = lang || 'EN';
  await sendButtons(to, texts[l] || texts.EN, [
    { id: "PSB_BOOK", title: btn1[l] || btn1.EN },
    { id: "PSB_MORE", title: btn2[l] || btn2.EN },
    { id: "PSB_TEAM", title: btn3[l] || btn3.EN }
  ]);
}

// ─── WEBHOOK ──────────────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    const from = body.from || body.sender || body.phone;
    if (!from) return;

    const messageType = body.message?.type || body.type || "text";
    let buttonId = body.replyId || null;
    const messageText = buttonId || body.message?.text || body.message || body.text || body.body;

    if (messageType === "audio") {
      await sendText(from, "Sorry, voice messages support cheyyunilla. Please type cheyyoo! Or call: 7012121125");
      return;
    }
    if (!messageText || (messageType !== "text" && messageType !== "interactive")) return;

    console.log(`From ${from} [${messageType}]: ${messageText}`);

    // ── FIX 1: Never reset existing session — only init if truly new ──
    if (!userState[from]) {
      userState[from] = { stage: "language", lang: null, section: null };
    }

    const state = userState[from];
    const currentDate = new Date().toLocaleDateString("en-IN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata"
    });

    // ── FIX 6: Language switch detection at any stage ──
    if (!buttonId && state.stage === "chat") {
      const switchLang = detectLanguageSwitch(messageText);
      if (switchLang) {
        state.lang = switchLang;
        const confirmMsg = {
          EN: "Switched to English! How can I help you? 😊",
          ML: "\u0d07\u0d28\u0d3f \u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d24\u0d4d\u0d24\u0d3f\u0d32\u0d4d \u0d2e\u0d31\u0d41\u0d2a\u0d1f\u0d3f \u0d05\u0d31\u0d3f\u0d2f\u0d3f\u0d15\u0d4d\u0d15\u0d3e\u0d02 😊",
          MG: "Manglish-il aayittundo! Enthu help cheyyano? 😊"
        };
        await sendText(from, confirmMsg[switchLang]);
        return;
      }
    }

    // ── STAGE: LANGUAGE SELECTION ──
    if (state.stage === "language") {
      if (buttonId === "LANG_EN" || buttonId === "LANG_ML" || buttonId === "LANG_MG") {
        state.lang = buttonId === "LANG_EN" ? "EN" : buttonId === "LANG_ML" ? "ML" : "MG";
        state.stage = "section";
        const texts = { EN: "Which section are you looking for?", ML: "\u0d0f\u0d24\u0d4d \u0d38\u0d46\u0d15\u0d4d\u0d37\u0d7b \u0d06\u0d23\u0d4d \u0d35\u0d47\u0d23\u0d4d\u0d1f\u0d24\u0d4d?", MG: "Enth section aano venam?" };
        await sendButtons(from, texts[state.lang], [
          { id: "SEC_LADIES", title: "Ladies" },
          { id: "SEC_GENTS", title: "Gents" },
          { id: "SEC_BOTH", title: "Both" }
        ]);
      } else {
        await sendButtons(from, "hi, ABCD Beauty Clinic & Salon-\u0d32\u0d47\u0d15\u0d4d\u0d15\u0d4d \u0d38\u0d4d\u0d35\u0d3e\u0d17\u0d24\u0d02! \ud83d\ude4f\n\nPlease select your language:", [
          { id: "LANG_EN", title: "English" },
          { id: "LANG_ML", title: "Malayalam" },
          { id: "LANG_MG", title: "Manglish" }
        ]);
      }
      return;
    }

    // ── STAGE: SECTION SELECTION ──
    if (state.stage === "section") {
      if (buttonId === "SEC_LADIES" || buttonId === "SEC_GENTS" || buttonId === "SEC_BOTH") {
        state.section = buttonId;
        state.stage = "menu";
        if (buttonId === "SEC_LADIES") await sendMenu(from, "LADIES_MAIN");
        else if (buttonId === "SEC_GENTS") await sendMenu(from, "GENTS_MAIN");
        else await sendMenu(from, "LADIES_MAIN");
      } else {
        const texts = { EN: "Which section are you looking for?", ML: "\u0d0f\u0d24\u0d4d \u0d38\u0d46\u0d15\u0d4d\u0d37\u0d7b \u0d06\u0d23\u0d4d \u0d35\u0d47\u0d23\u0d4d\u0d1f\u0d24\u0d4d?", MG: "Enth section aano venam?" };
        await sendButtons(from, texts[state.lang || "EN"], [
          { id: "SEC_LADIES", title: "Ladies" },
          { id: "SEC_GENTS", title: "Gents" },
          { id: "SEC_BOTH", title: "Both" }
        ]);
      }
      return;
    }

    // ── STAGE: MENU / CHAT ──
    if (state.stage === "menu" || state.stage === "chat") {

      // ── FIX 3: Post-service buttons ──
      if (buttonId === "PSB_BOOK") {
        state.stage = "chat";
        const reply = await getAIReply(from, "I want to book an appointment", currentDate, state.lang);
        await sendText(from, reply);
        return;
      }

      if (buttonId === "PSB_MORE") {
        // Show the service menu again
        if (state.section === "SEC_GENTS") await sendMenu(from, "GENTS_MAIN");
        else await sendMenu(from, "LADIES_MAIN");
        return;
      }

      if (buttonId === "PSB_TEAM") {
        state.stage = "chat";
        const askNum = {
          EN: "Sure! Could you share your phone number so our team can call you back? \ud83d\ude0a",
          ML: "\u0d24\u0d40\u0d7c\u0d1a\u0d4d\u0d1a\u0d2f\u0d3e\u0d2f\u0d41\u0d02! \u0d28\u0d3f\u0d19\u0d4d\u0d19\u0d33\u0d41\u0d1f\u0d46 \u0d28\u0d2e\u0d4d\u0d2a\u0d7c \u0d24\u0d30\u0d3e\u0d2e\u0d4b? \u0d1e\u0d19\u0d4d\u0d19\u0d33\u0d41\u0d1f\u0d46 \u0d1f\u0d40\u0d02 \u0d09\u0d1f\u0d7b \u0d35\u0d3f\u0d33\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d28\u0d4d\u0d28\u0d24\u0d3e\u0d23\u0d4d \ud83d\ude0a",
          MG: "Sure! Ningalude number tharamo? Njangalude team undane call cheyyum \ud83d\ude0a"
        };
        await sendText(from, askNum[state.lang] || askNum.EN);
        return;
      }

      // Book appointment
      if (buttonId === "CAT_BOOK") {
        state.stage = "chat";
        const reply = await getAIReply(from, "I want to book an appointment", currentDate, state.lang);
        await sendText(from, reply);
        return;
      }

      // Sub-menu navigation
      if (buttonId && MENUS[buttonId]) {
        await sendMenu(from, buttonId);
        return;
      }

      // ── FIX 3: Service selected — show info then post-service buttons ──
      if (buttonId && SERVICE_INFO[buttonId]) {
        state.stage = "chat";
        state.lastService = buttonId;
        await sendServiceInfo(from, buttonId, state.lang);
        await new Promise(r => setTimeout(r, 1000));
        await sendPostServiceButtons(from, state.lang);
        return;
      }

      // ── FIX 2 & 4: Free text in chat ──
      state.stage = "chat";

      // Check for phone number shared (callback) 
      const phoneMatch = messageText.match(/[6-9]\d{9}/);
      if (phoneMatch && state.waitingForPhone) {
        state.waitingForPhone = false;
        const confirmMsg = {
          EN: "Perfect! Our team will call you back shortly \ud83d\ude0a",
          ML: "\u0d28\u0d28\u0d4d\u0d28\u0d3e\u0d2f\u0d3f! \u0d1e\u0d19\u0d4d\u0d19\u0d33\u0d41\u0d1f\u0d46 \u0d1f\u0d40\u0d02 \u0d09\u0d1f\u0d7b \u0d35\u0d3f\u0d33\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d28\u0d4d\u0d28\u0d24\u0d3e\u0d23\u0d4d \ud83d\ude0a",
          MG: "Nannayyi! Team undane call cheyyum \ud83d\ude0a"
        };
        await sendText(from, confirmMsg[state.lang] || confirmMsg.EN);
        await sendText(CLINIC_NUMBER, `Callback Request!\n\nCustomer wants a call.\nWhatsApp: ${from}\nNumber given: ${phoneMatch[0]}\nPlease call them back asap.`);
        return;
      }

      const reply = await getAIReply(from, messageText, currentDate, state.lang);
      await sendText(from, reply);

      // Check if AI asked for phone number (callback flow)
      if (reply.toLowerCase().includes('number') || reply.includes('\u0d28\u0d2e\u0d4d\u0d2a\u0d7c')) {
        state.waitingForPhone = true;
      }

      // ── FIX 2: Booking complete — notify clinic ──
      if (isBookingComplete(reply)) {
        console.log("Booking complete! Notifying clinic...");
        const details = await extractBookingDetails(from, from);
        await sendBookingNotification(details);
      }
    }

  } catch (err) { console.error("Webhook error:", err.message); }
});
app.get("/", (req, res) => res.json({ status: "ABCD Bot running" }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ABCD Bot running on port ${PORT}`));
