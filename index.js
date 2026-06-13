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
  // LADIES HAIR TREATMENTS
  "SVC_L_SMOOTHENING": { name: "Smoothening", price: "Rs.4000+ (depending on hair length)", benefits: "Smoothening chemically relaxes your hair using heat, giving you frizz-free, straight, silky hair that lasts 4-6 months. It's perfect if you want low-maintenance straight hair without daily styling. The treatment takes about 3-4 hours. ABCD uses premium products ensuring minimal damage and long-lasting results." },
  "SVC_L_KERATIN": { name: "Keratin Treatment", price: "Rs.6000+ (depending on hair length)", benefits: "Keratin fills in the porous parts of your hair with keratin protein, making it smoother, shinier, and easier to manage. It reduces frizz by up to 95%, lasts 3-5 months, and makes your hair blow-dry in half the time. Great for damaged, frizzy, or chemically treated hair." },
  "SVC_L_BOTOX": { name: "Hair Botox", price: "Rs.7000+ (depending on hair length)", benefits: "Hair Botox is a deep conditioning treatment — not actual botox — that fills damaged hair fibers with proteins, vitamins, and collagen. It restores elasticity, shine, and softness to over-processed or damaged hair. Results last 2-4 months and unlike chemical straightening, it doesn't alter your hair structure." },
  "SVC_L_KERASMOOTH": { name: "Kera Smooth", price: "Rs.10000+ (depending on hair length)", benefits: "Kera Smooth is a premium advanced keratin system that delivers the most long-lasting straightening results — up to 6-8 months. It's a step above regular keratin, using concentrated protein complexes that penetrate deep into the hair shaft. Best for very curly, coarse, or resistant hair." },
  "SVC_L_CROWN": { name: "Crown Portion Smoothening", price: "Rs.3000", benefits: "Crown smoothening targets only the top/crown section of your hair — ideal if only your roots are frizzy while the lengths are manageable. Much more affordable than a full smoothening and takes less time. Perfect for touch-ups between full treatments." },
  "SVC_L_ROUTETOUCHUP": { name: "Route Touch Up", price: "Rs.3500+ (depending on hair length)", benefits: "Route Touch Up treats the new hair growth at your roots after a previous smoothening or keratin treatment. Keeps your hair uniformly straight from root to tip without the cost and time of a full treatment. Recommended every 3-4 months after a smoothening service." },
  "SVC_L_NANOPLASTY": { name: "Nanoplasty", price: "Rs.8000+ (depending on hair length)", benefits: "Nanoplasty is an organic hair straightening treatment using nanotechnology and natural amino acids. Unlike keratin, it contains no formaldehyde — completely safe for sensitive scalps and pregnant women. It deeply nourishes while straightening, leaving hair incredibly silky and healthy. Lasts 4-6 months." },
  "SVC_L_SHINEINFUSION": { name: "Shine Infusion Treatment", price: "Rs.5000", benefits: "Shine Infusion is a glossing treatment that wraps each hair strand in a reflective coating, giving your hair a mirror-like shine and smoothness. It doesn't straighten but dramatically reduces frizz and adds incredible gloss. Perfect if you want healthy, radiant-looking hair without chemical straightening. Lasts 6-8 weeks." },
  "SVC_L_HAIRIRONING": { name: "Hair Ironing", price: "Rs.1000+ (depending on hair length)", benefits: "Temporary heat styling that gives you straight, sleek hair for the day. Uses a professional flat iron with heat protection. Great for special occasions or when you want a polished look without a permanent treatment." },
  "SVC_L_TONGCURLS": { name: "Tong Ironing Curls", price: "Rs.1500+ (depending on hair length)", benefits: "Creates beautiful, bouncy curls or waves using a professional curling tong. Results last the day, perfect for parties, events, or weddings. Our stylists can create loose waves, tight ringlets, or anything in between based on your preference." },
  "SVC_L_DANDRUFF_BASIC": { name: "Anti Dandruff Basic", price: "Rs.2000", benefits: "A targeted scalp treatment using medicated anti-dandruff products that deeply cleanse the scalp, remove flakes, and control excess sebum production. Includes scalp massage and specialized shampoo application. You'll notice significant reduction after 2-3 sessions." },
  "SVC_L_DANDRUFF_PREMIUM": { name: "Anti Dandruff Premium", price: "Rs.2500", benefits: "An advanced anti-dandruff protocol combining medicated scalp treatment, anti-fungal application, nourishing scalp serum, and steam therapy. More intensive than the basic treatment — targets stubborn dandruff, scalp inflammation, and itchiness. Includes hair wash and dryer finish." },
  "SVC_L_HAIRWASH": { name: "Hair Wash Dryer Set", price: "Rs.500", benefits: "Professional hair wash with salon-grade shampoo and conditioner, followed by blow-dry and styling set. Great for a quick refresh before an event or when you want salon-quality washing and blow-dry without any treatment." },
  "SVC_L_SPA_NOURISHING": { name: "Hair Spa Nourishing", price: "Rs.1200+ (depending on hair length)", benefits: "A nourishing spa treatment using protein-rich masks and serums that penetrate deep into the hair shaft, restoring moisture and reducing breakage. Includes head massage, steaming, and mask application. Your hair feels soft, hydrated, and manageable immediately after. Recommended monthly for healthy hair maintenance." },
  "SVC_L_SPA_PROTEIN": { name: "Hair Spa Protein", price: "Rs.2000", benefits: "Protein spa rebuilds the structural integrity of damaged, over-processed or chemically treated hair. Concentrated protein molecules fill the gaps in your hair cuticle, reducing breakage by up to 70%. Includes scalp massage, protein mask with steam, and finishing serum. Best for hair that snaps or feels weak." },
  "SVC_L_SPA_MOROCCAN": { name: "Hair Spa Moroccan", price: "Rs.2500", benefits: "Moroccan spa uses pure Argan oil — liquid gold for hair — to deeply nourish and add extraordinary shine to dull, dry hair. Rich in Vitamin E and fatty acids, it transforms brittle hair into lustrous, glossy locks. The treatment includes a relaxing massage, Argan oil mask, and steam for maximum penetration." },
  // LADIES HAIRCUT
  "SVC_L_UCUT": { name: "U Cut", price: "Rs.400", benefits: "A classic U-shaped cut where the hair is longer in the center and gradually shorter at the sides, creating a soft rounded appearance at the back. Suits all face types, easy to maintain, and looks great on medium to long hair." },
  "SVC_L_VCUT": { name: "V Cut", price: "Rs.400", benefits: "A V-cut creates a sharp V shape at the back, with the center length longer than the sides. It adds natural movement and dimension to straight hair, making it look thicker and more dynamic. Perfect for long, straight hair." },
  "SVC_L_STRAIGHTCUT": { name: "Straight Cut", price: "Rs.300", benefits: "A clean, blunt cut where all hair is trimmed to the same length. Classic and timeless — adds thickness and weight to fine hair. The simplest and most affordable cut, perfect for maintaining length while removing split ends." },
  "SVC_L_LAYERCUT": { name: "Layer Cut", price: "Rs.600 (with hairwash)", benefits: "Layers add movement, volume, and texture to your hair. The stylist cuts the hair at different lengths throughout, creating a flowing, dimensional look. Ideal for thick hair to reduce bulk, or fine hair to add the appearance of volume. Includes professional hairwash." },
  "SVC_L_STEPCUT": { name: "Step Cut", price: "Rs.600 (with hairwash)", benefits: "A step cut creates defined layers or 'steps' that frame the face beautifully. It's bolder than a regular layer cut and gives a structured, fashion-forward look. Very popular for medium-length hair as it adds great movement and shape." },
  "SVC_L_FEATHEREDCUT": { name: "Feathered Cut", price: "Rs.700 (with hairwash)", benefits: "The feathered cut creates soft, wispy ends that look light and airy — like feathers. It frames the face softly and works beautifully with both straight and wavy hair. Classic, feminine, and very flattering for most face shapes." },
  "SVC_L_BOBCUT": { name: "Bob Cut", price: "Rs.700 (with hairwash & hairsetting)", benefits: "The timeless bob is a chin-length or shoulder-length cut with clean lines. It's chic, low-maintenance, and incredibly versatile — suits every face shape. ABCD's stylists customize the length and angle to perfectly suit your face structure. Includes wash and professional hairsetting." },
  "SVC_L_BLENDCUT": { name: "Blend Cut", price: "Rs.600 (with hairwash & hairsetting)", benefits: "A blend cut seamlessly transitions between different lengths, creating a smooth graduation that looks natural and polished. Great for those who want a styled look without dramatic layers. Very versatile and suits most hair types." },
  "SVC_L_PIXIECUT": { name: "Pixie Cut", price: "Rs.800 (with hairwash & hairsetting)", benefits: "The bold pixie cut is a short style that's cut close to the head with slightly longer hair on top. It's confident, edgy, and incredibly low-maintenance. Pixie cuts highlight facial features beautifully — especially the eyes and cheekbones. Our stylists will shape it to perfectly complement your face." },
  "SVC_L_INVERTEDBOB": { name: "Inverted Bob", price: "Rs.800 (with hairwash & hairsetting)", benefits: "The inverted bob is shorter at the back and gradually longer toward the front, creating a dramatic, angular silhouette. It adds volume at the crown and a modern, sleek look. Very popular for its flattering shape on most face types." },
  "SVC_L_GRADUATEDBOB": { name: "Graduated Bob", price: "Rs.800 (with hairwash & hairsetting)", benefits: "A graduated bob features a stacked back that creates volume and height, with longer front pieces framing the face. It's a structured, sophisticated cut that looks great both straight and slightly wavy. Perfect for adding fullness to fine or flat hair." },
  // LADIES KIDS CUT
  "SVC_L_KIDS_LAYER": { name: "Kids Layer Cut", price: "Rs.600 (with hairwash)", benefits: "A gentle layer cut specially designed for children — creates movement and reduces bulk in thick hair. Our stylists are experienced with kids and make the experience comfortable and fun." },
  "SVC_L_KIDS_BOB": { name: "Kids Bob Cut", price: "Rs.500 (with hairwash)", benefits: "A sweet, easy-to-manage bob for kids. Looks neat and cute, perfect for school. Our stylists ensure a comfortable and quick experience for children." },
  "SVC_L_KIDS_BUTTERFLY": { name: "Kids Butterfly Cut", price: "Rs.700 (with hairwash)", benefits: "A playful butterfly-inspired cut with layers that create a wing-like shape when the hair flows naturally. Adorable and stylish for kids who love a little flair." },
  "SVC_L_KIDS_FEATHER": { name: "Kids Feather Cut", price: "Rs.700 (with hairwash)", benefits: "Soft, feathery ends that look light and charming on kids. Easy to maintain at home and looks lovely for both school and special occasions." },
  "SVC_L_KIDS_BABYCUT": { name: "Baby Cut", price: "Rs.200-300 (with hairwash)", benefits: "A simple, gentle trim for babies and toddlers. Our stylists are experienced with very young children — quick, safe, and comfortable." },
  // LADIES COLOUR
  "SVC_L_COLOUR_GLOBAL": { name: "Hair Colour Global", price: "Rs.2200 (depending on hair length)", benefits: "Full head grey coverage using Loreal Schoff — one of the best professional colour brands. Covers even stubborn greys completely and gives rich, even colour throughout. The ammonia-based formula provides long-lasting, vibrant results that last 6-8 weeks." },
  "SVC_L_COLOUR_TOUCHUP": { name: "Route Touch Up", price: "Rs.1500", benefits: "Covers grey regrowth at the roots without colouring the full length — cost-effective and quick. Recommended every 4-6 weeks to maintain your colour between full treatments. Uses premium Loreal Schoff for perfect colour matching." },
  "SVC_L_HIGHLIGHTS": { name: "Highlights", price: "Rs.300 per strip", benefits: "Hand-painted or foil highlights that add dimension and brightness to your hair. You can choose subtle or bold placement. Highlights make hair look naturally sun-kissed and add amazing depth to flat, one-dimensional colour." },
  "SVC_L_HIGHLIGHTS_PRELIGHT": { name: "Highlights With Pre Light", price: "Rs.400 per strip", benefits: "Pre-lighting before highlights gives more dramatic lift and brighter tones — perfect if you have dark hair and want vibrant highlights. The pre-lightening step ensures the colour appears true and vivid rather than muddy on darker base colours." },
  "SVC_L_FASHION_GLOBAL": { name: "Fashion Colour Global", price: "Rs.3000+", benefits: "Full head fashion colour in any shade you desire — from chocolate browns to vibrant reds, purples, or any creative colour. Our colourists customize the formula for your hair type and desired intensity. Perfect for a complete colour transformation." },
  "SVC_L_BALAYAGE": { name: "Balayage", price: "Rs.4000+", benefits: "Balayage is a freehand colouring technique where colour is painted directly onto the hair for a natural, sun-kissed gradient effect. It grows out beautifully with no harsh lines, requires minimal maintenance, and looks incredibly natural. Our colourists are trained in advanced balayage techniques." },
  "SVC_L_OMBRE": { name: "Ombre", price: "Rs.3500+", benefits: "Ombre creates a beautiful gradient from dark roots to lighter ends — the classic dark-to-light colour transition. It's dramatic, eye-catching, and incredibly popular. Low maintenance as it grows out naturally. Can be done in natural tones or vivid fashion colours." },
  // LADIES SKIN
  "SVC_L_FACIAL_BASIC": { name: "Basic Facial", price: "Rs.1500", benefits: "A customized facial based on your skin type — includes cleansing, toning, steam, extraction, massage, and mask. Removes impurities, unclogs pores, and leaves skin fresh and hydrated. Perfect for regular monthly maintenance of all skin types." },
  "SVC_L_FACIAL_PREMIUM": { name: "Premium Facial", price: "Rs.2500", benefits: "An upgraded facial using advanced serums and techniques — includes all basic facial steps plus specialized treatments targeting your specific skin concerns like pigmentation, dullness, or uneven texture. More concentrated active ingredients for visible results." },
  "SVC_L_FACIAL_LUXURY": { name: "Luxury Facial", price: "Rs.4000", benefits: "A comprehensive luxury facial experience using high-end products and multi-step protocols. Includes advanced massage techniques, premium masks, and concentrated actives that deeply nourish and rejuvenate. You'll see a visible difference in brightness, firmness, and texture after just one session." },
  "SVC_L_FACIAL_GROOMOFFICIAL": { name: "Groom Official Facial", price: "Rs.4000", benefits: "A specially curated facial designed to give you event-ready skin — perfect before weddings, receptions, or important occasions. Combines brightening, de-tanning, hydration, and finishing steps for maximum glow on your big day." },
  "SVC_L_HYDRAFACIAL": { name: "Hydra Facial", price: "Rs.4000", benefits: "Hydra Facial uses patented Vortex-Fusion technology to simultaneously cleanse, exfoliate, extract, and hydrate the skin. It delivers antioxidants, peptides, and hyaluronic acid deep into the skin. Zero downtime — skin looks instantly plumper, clearer, and more radiant. Suitable for all skin types including sensitive skin." },
  "SVC_L_HYDRA_TREATMENT": { name: "Hydra Treatment", price: "Rs.5000", benefits: "An advanced multi-step hydration protocol that goes beyond the standard Hydra Facial. Includes additional boosters targeting specific skin concerns — pigmentation, fine lines, or acne. The most comprehensive hydration treatment for visibly dehydrated or stressed skin." },
  "SVC_L_HYDRA_PREMIUM": { name: "Hydra Premium with Hair Spa", price: "Rs.8000", benefits: "The ultimate combo — a full Hydra Treatment for your skin PLUS a premium Hair Spa for your hair. Total head-to-toe rejuvenation in one session. Best value package if you want to treat both your skin and hair on the same visit." },
  // LADIES FACE TREATMENT
  "SVC_L_CLEANUP_BASIC": { name: "Cleanup Basic", price: "Rs.600", benefits: "A quick, effective skin cleanup that deep cleanses, removes blackheads and whiteheads, tones, and moisturizes. Perfect for a quick skin refresh between facials. Takes about 30-40 minutes and leaves skin noticeably cleaner and brighter." },
  "SVC_L_CLEANUP_PREMIUM": { name: "Cleanup Premium", price: "Rs.1000", benefits: "An enhanced cleanup with additional steps — includes exfoliation with a professional scrub, deeper extraction, soothing pack, and premium moisturizer. More thorough than the basic cleanup with longer-lasting results." },
  "SVC_L_DETAN_BASIC": { name: "De Tan Basic", price: "Rs.500", benefits: "Targets and removes sun tan from the face using a brightening solution that breaks down melanin deposits. You'll notice a visibly lighter, more even skin tone after a single session. Perfect before events or after heavy sun exposure." },
  "SVC_L_DETAN_PREMIUM": { name: "De Tan Premium", price: "Rs.1000", benefits: "Advanced de-tanning treatment using stronger brightening agents and multiple application layers for deeply tanned skin. Includes a brightening mask and soothing serum. More effective for stubborn or built-up tan from prolonged sun exposure." },
  "SVC_L_GLOW_CLEANUP": { name: "Glow Cleanup", price: "Rs.1500 (including De Tan)", benefits: "A combination treatment that includes both de-tanning and a premium cleanup — the ultimate skin brightening package. You get tan removal, deep pore cleansing, and skin brightening in one session. Your skin will look visibly glowing and even-toned." },
  "SVC_L_BLEACH": { name: "Bleach", price: "Rs.400", benefits: "Face bleaching lightens facial hair, brightens skin tone, and reduces the appearance of dark spots and blemishes. Uses professional bleach cream formulated for sensitive facial skin. Quick, affordable way to achieve a brighter, more even complexion." },
  "SVC_L_FULLARM_DETAN": { name: "Full Arm De Tan / Bleach", price: "Rs.800", benefits: "De-tanning or bleaching treatment for the full arms — removes sun tan and lightens skin tone from shoulders to wrists. Great before sleeveless events, weddings, or after a sunny vacation." },
  "SVC_L_FULLLEG_DETAN": { name: "Full Leg De Tan / Bleach", price: "Rs.1000", benefits: "Full leg de-tan or bleach treatment from thighs to ankles. Removes tan lines, evens skin tone, and brightens legs. Perfect before beach trips, sarees, or any occasion where your legs will be visible." },
  "SVC_L_FACEMASSAGE": { name: "Face Massage", price: "Rs.800+ (20 minutes)", benefits: "A deeply relaxing 20-minute face massage that improves blood circulation, reduces puffiness, relaxes facial muscles, and gives an instant natural glow. Regular face massage can slow down signs of aging and keep skin firm and toned." },
  // LADIES KOREAN / CLINICAL
  "SVC_HYDRAFACIAL_CLINIC": { name: "Hydra Facial (Clinical)", price: "Rs.3500", benefits: "Clinical-grade Hydra Facial using medical-grade equipment and pharmaceutical-level serums. More intensive than the standard version — delivers actives at higher concentrations for superior results in a single session. Zero downtime, immediate glow." },
  "SVC_HYDRA_BASIC": { name: "Hydra Treatment Basic", price: "Rs.5000", benefits: "Clinical hydration protocol targeting deep skin dehydration. Uses medical-grade hyaluronic acid and peptide infusions that plump the skin from within. Results are immediate — skin appears visibly fuller, plumper, and radiant. Lasts 4-6 weeks." },
  "SVC_HYDRA_PREMIUM_CLINIC": { name: "Hydra Treatment Premium", price: "Rs.8000", benefits: "The most advanced hydration treatment available — combines multiple serums, boosters, and clinical techniques for transformative skin restoration. Ideal for mature skin, severely dehydrated skin, or pre-event preparation. Results last 6-8 weeks." },
  "SVC_MEDIFACIAL": { name: "Medi Facial Tan", price: "Rs.2000", benefits: "A medically-formulated facial specifically targeting sun damage and hyperpigmentation. Combines chemical exfoliants and brightening actives to break down melanin, fade dark spots, and even skin tone at a cellular level. Visible improvement after 2-3 sessions." },
  "SVC_CARBON_LASER": { name: "Carbon Laser Toning", price: "Rs.6000", benefits: "Carbon Laser (Hollywood Peel) is a non-invasive laser treatment that reduces pores, controls oil, removes dead skin cells, and stimulates collagen production. Zero downtime — skin appears immediately brighter and smoother. Popular with celebrities for its instant glow effect. 6-8 sessions recommended for best results." },
  "SVC_IPL_PHOTO": { name: "IPL Photolaser", price: "Rs.5500", benefits: "Intense Pulsed Light therapy targets multiple skin concerns simultaneously — sun damage, redness, pigmentation, and early signs of aging. The light pulses break down melanin and stimulate collagen. Very effective for uneven skin tone, sunspots, and mild rosacea." },
  "SVC_IPL_HAIRREMOVAL": { name: "IPL Hair Removal Laser", price: "Rs.1500", benefits: "IPL hair removal targets hair follicles with pulses of light, permanently reducing hair growth over multiple sessions. Much gentler than traditional laser, suitable for sensitive skin. Each session reduces regrowth — after 6-8 sessions most people see 80-90% permanent reduction." },
  "SVC_MICRONEEDLING_FACE": { name: "Micro Needling For Face", price: "Rs.6000", benefits: "Micro needling creates thousands of micro-channels in the skin using ultra-fine needles, triggering the skin's natural healing response and collagen production. Dramatically improves scars, enlarged pores, fine lines, and skin texture. Results improve over 4-6 weeks as collagen rebuilds. Recommended 3-6 sessions." },
  "SVC_MICRONEEDLING_HAIR": { name: "Micro Needling For Hair", price: "Rs.6000", benefits: "Scalp micro needling stimulates dormant hair follicles and increases blood flow to the scalp, promoting hair regrowth. When combined with growth serums, it significantly improves hair density and thickness. Effective for early-stage hair thinning and loss. Results visible after 3-4 sessions." },
  "SVC_MESOTHERAPY": { name: "Mesotherapy Treatment", price: "Rs.4000", benefits: "Mesotherapy injects a customized cocktail of vitamins, minerals, amino acids, and hyaluronic acid directly into the skin. It deeply nourishes, hydrates, and rejuvenates from within — improving dullness, fine lines, and skin laxity. Can also be done on the scalp for hair rejuvenation." },
  "SVC_BBGLOW": { name: "B.B Glow Treatment", price: "Rs.6000", benefits: "BB Glow is a revolutionary semi-permanent foundation treatment that uses micro needling to infuse BB serum into the skin, creating a lasting even complexion effect. It brightens, covers imperfections, and adds a healthy glow that lasts 4-6 months. No daily foundation needed!" },
  "SVC_LLL_THERAPY": { name: "L.L.L Therapy", price: "Rs.1500", benefits: "Low Level Laser (Light) Therapy is a painless treatment that uses red and near-infrared light to stimulate cellular repair, reduce inflammation, and promote healing. Used for skin rejuvenation, acne reduction, and scalp health. Zero side effects and zero downtime." },
  "SVC_CHEMICAL_PEEL": { name: "Chemical Peel", price: "Rs.2000+", benefits: "Chemical peels use acids to exfoliate the outer layers of skin, revealing fresher, younger skin underneath. Targets acne scars, pigmentation, uneven texture, and dullness. Available in different strengths — mild peels have no downtime, while deeper peels give more dramatic results." },
  "SVC_OXYGENO": { name: "Oxygeno Treatment", price: "Rs.6000", benefits: "OxyGeneo is a 3-in-1 super facial that simultaneously exfoliates, infuses nutrients, and oxygenates the skin from within. It creates a natural CO2 bubble effect that triggers the body to send oxygen-rich blood to the skin. Instantly plumper, brighter, and more youthful skin with zero downtime." },
  "SVC_MEDI_CLEANUP": { name: "Medi Cleanup Facial", price: "Rs.1500", benefits: "A medically-enhanced cleanup using pharmaceutical-grade cleansing agents and actives. More effective than a regular cleanup for congested, acne-prone, or oily skin. Includes enzyme exfoliation, targeted extraction, and anti-bacterial treatment." },
  "SVC_SKIN_TIGHTENING": { name: "Saggy Skin Tightening", price: "Rs.3000", benefits: "A non-invasive skin tightening treatment using RF (Radio Frequency) or clinical-grade actives to firm and lift sagging skin. Stimulates collagen production in deeper skin layers, improving jawline definition, neck firmness, and reducing nasolabial folds. Results improve over 4-6 weeks." },
  "SVC_TATTOO_REMOVAL": { name: "Tattoo Removal", price: "Rs.2500", benefits: "Laser tattoo removal breaks down tattoo ink into tiny particles that the body naturally eliminates. The number of sessions depends on the size, colour, and age of the tattoo. Black and dark inks respond fastest. Safe, effective, and performed by trained professionals at ABCD." },
  "SVC_MICROBLADING": { name: "Micro Blading", price: "Rs.10000 (1st sitting), Rs.8000 (2nd sitting), Rs.4000 (3rd sitting)", benefits: "Microblading is a semi-permanent eyebrow tattoo technique that creates hair-like strokes to fill, shape, and define brows. Perfect for sparse, over-plucked, or uneven brows. Results look incredibly natural — like real brow hairs. Lasts 1-3 years. ABCD's technicians are trained to create custom brow shapes that complement your face." },
  "SVC_LIP_NEUTRALIZING": { name: "Lip Neutralizing Treatment", price: "Rs.4000", benefits: "Lip neutralizing corrects dark, uneven lip pigmentation by applying a neutralizing pigment that counteracts darkness and creates a natural pink tone. Perfect for smokers' lips or naturally dark-pigmented lips. Results last 1-2 years." },
  "SVC_LIP_COLOURING": { name: "Lip Colouring Treatment", price: "Rs.6000", benefits: "Semi-permanent lip colour tattooing that gives you beautifully tinted lips 24/7 — no lipstick needed. Choose from natural pink, berry, coral, or any custom shade. Lasts 1-2 years. Our technicians customize the shape and colour to perfectly complement your features." },
  "SVC_LIP_CONTOURING": { name: "Lip Contouring Treatment", price: "Rs.2000", benefits: "Semi-permanent lip liner that defines and enhances the lip border, making lips appear fuller and more symmetrical. Great for thin or undefined lips — adds structure without filler. Can be combined with lip colouring for a complete lip transformation." },
  "SVC_EYEBROW_SHADING": { name: "Eye Brow Shading", price: "Rs.4000", benefits: "Semi-permanent eyebrow shading (ombre brows) creates a soft, powdered effect — like you always have perfectly filled-in brows. Unlike microblading strokes, shading gives a fuller, more defined look. Ideal for those who prefer a more made-up brow appearance. Lasts 1-2 years." },
  "SVC_BEAUTY_SPOT": { name: "Beauty Spot", price: "Rs.500", benefits: "A semi-permanent beauty spot tattooed in your desired location — face, shoulder, or elsewhere. Classic, elegant, and timeless. Our technicians will help you choose the perfect placement and size." },
  // LADIES WAXING
  "SVC_WAX_HALFARM": { name: "Half Arm Wax", price: "Rs.500", benefits: "Reca wax removes hair from wrist to elbow, leaving skin silky smooth for 3-4 weeks. Reca wax is gentler than regular wax, making it less painful and better for sensitive skin. Quick and effective." },
  "SVC_WAX_HALFLEG": { name: "Half Leg Wax", price: "Rs.700", benefits: "Removes hair from ankles to knees using Reca wax. Smooth, hair-free legs for 3-4 weeks. Much longer-lasting than shaving with no risk of cuts or ingrown hairs when done professionally." },
  "SVC_WAX_FULLARM": { name: "Full Arm Wax", price: "Rs.800", benefits: "Complete arm waxing from wrist to shoulder using Reca wax. Leaves arms perfectly smooth for 3-4 weeks. Great before sleeveless occasions or as part of a regular grooming routine." },
  "SVC_WAX_FULLLEG": { name: "Full Leg Wax", price: "Rs.1200", benefits: "Complete leg waxing from ankles to thighs. Smooth, stubble-free legs for 3-4 weeks. Professional waxing removes hair from the root, so regrowth is finer and softer over time." },
  "SVC_WAX_FULLBODY": { name: "Full Body Wax", price: "Rs.4000", benefits: "Complete body waxing service covering arms, legs, underarms, and back/front. Perfect before holidays, beaches, or important events. Our professionals ensure a thorough, comfortable experience with minimal discomfort." },
  "SVC_WAX_BACKFRONT": { name: "Back and Front Wax", price: "Rs.800", benefits: "Waxing for the back and front torso — removes unwanted hair from chest, stomach, and back. Smooth, clean results for 3-4 weeks. Popular before beach vacations or special occasions." },
  "SVC_WAX_UPPERLIP": { name: "Upper Lip Brazilian Wax", price: "Rs.150", benefits: "Quick and precise upper lip hair removal using Brazilian wax. More gentle than threading for sensitive skin and removes even fine hair. Results last 3-4 weeks — much longer than threading which only snaps hair at the surface." },
  "SVC_WAX_FOREHEAD": { name: "Forehead Brazilian Wax", price: "Rs.150", benefits: "Removes fine forehead hairline and peach fuzz that can make skin look dull. After waxing, foundation and powder apply much more smoothly and the face looks brighter and more polished." },
  "SVC_WAX_FULLFACE": { name: "Full Face Brazilian Wax", price: "Rs.500", benefits: "Complete facial hair removal including upper lip, chin, sideburns, forehead, and neck using Brazilian wax. Your skin becomes incredibly smooth — makeup applies flawlessly and skin looks visibly brighter and more refined." },
  "SVC_WAX_UNDERARMS": { name: "Under Arms Wax", price: "Rs.500", benefits: "Quick underarm waxing that removes hair from the root for 3-4 weeks of smoothness. Much longer-lasting than shaving. Regular waxing can also lead to finer, sparser hair regrowth over time." },
  // LADIES MANI PEDI
  "SVC_L_MANI_ORDINARY": { name: "Ordinary Manicure", price: "Rs.500", benefits: "Basic manicure including nail cutting, shaping, filing, cuticle care, and a relaxing 5-minute hand massage. Leaves hands neat, groomed, and refreshed. Perfect for regular maintenance." },
  "SVC_L_PEDI_ORDINARY": { name: "Ordinary Pedicure", price: "Rs.900", benefits: "Basic pedicure with nail cutting, shaping, filing, cuticle care, and a 5-minute foot massage. Removes dead skin and leaves feet clean and refreshed. Great for regular monthly foot care." },
  "SVC_L_MANI_CLASSIC": { name: "Classic Manicure", price: "Rs.700", benefits: "Enhanced 45-minute manicure including nail cutting, shaping, hills clearing, professional scrub, and a nourishing massage pack. Noticeably softer hands and perfectly groomed nails." },
  "SVC_L_PEDI_CLASSIC": { name: "Classic Pedicure", price: "Rs.1300", benefits: "A thorough 45-minute pedicure including nail care, heel clearing, professional scrub, and massage pack. Targets rough heels and dry skin — your feet will feel transformed and silky smooth." },
  "SVC_L_MANI_PREMIUM": { name: "Premium Manicure", price: "Rs.1500", benefits: "A luxurious 1-hour manicure experience with professional scrub, deep conditioning massage pack, and extra attention to cuticles and nail health. The most pampering hand treatment available — perfect for special occasions." },
  "SVC_L_PEDI_PREMIUM": { name: "Premium Pedicure", price: "Rs.2000", benefits: "The ultimate 1-hour pedicure — includes heel clearing, professional scrub, intensive massage pack, and deep moisturizing treatment. Transforms even the most neglected feet into smooth, beautiful, salon-perfect feet. Highly recommended before events or weddings." },
  // BRIDAL
  "SVC_BRIDAL_SILVER": { name: "Silver Bridal Package", price: "Rs.5999", benefits: "A complete pre-wedding beauty package: O3 Facial (brightening & nourishing) + Classic Pedicure/Manicure (perfectly groomed nails) + Face & Neck D-Tan (even skin tone) + Hair Spa (silky, healthy hair). Everything you need to look and feel radiant on your special day. Individual services worth Rs.10,100+ — savings of over Rs.4000." },
  "SVC_BRIDAL_PLATINUM": { name: "Platinum Bridal Package", price: "Rs.9999", benefits: "A premium bridal preparation package: Radiation Facial + Luxury Pedicure + Luxury Spa + Full Arm/Full Leg/Under Arm waxing + D-Tan for Back/Face & Neck. Comprehensive head-to-toe bridal prep covering skin, hair, and body treatments. Individual services worth Rs.15,000+ — significant savings." },
  "SVC_BRIDAL_DIAMOND": { name: "Diamond Bridal Package", price: "Rs.14999", benefits: "The most complete bridal experience: Microderm Facial + Luxury Pedi/Mani + Full Body D-Tan + Back Polishing + Advanced Hair Cut + Full Face Threading. Everything from skin to hair to nails covered in one ultimate package. Individual services worth Rs.20,000+ — the best value for a complete bridal transformation." },
  // GENTS HAIRCUT
  "SVC_G_CLASSIC_CUT": { name: "Classic Haircut", price: "Rs.200", benefits: "A clean, professional haircut using scissors and clippers. Our barbers are skilled in all classic men's cuts — fade, taper, crew cut, side part, or whatever style you prefer. Quick, sharp, and precise." },
  "SVC_G_CLASSIC_BEARD": { name: "Classic Beard Trim", price: "Rs.200", benefits: "Precise beard shaping, trimming, and lining using professional clippers and razor. Our barbers shape the beard to complement your face structure — whether you want a sharp fade, rounded shape, or designer stubble." },
  "SVC_G_CLASSIC_CUTSHAVE": { name: "Classic Cut + Shave", price: "Rs.350 (one-time apron)", benefits: "A complete grooming session — professional haircut plus a clean hot towel shave. Includes lathering with shaving cream and a smooth straight razor shave. The classic barbershop experience for a polished, well-groomed look." },
  "SVC_G_LUXURY_CUT": { name: "Luxury Haircut", price: "Rs.300", benefits: "An elevated haircut experience with extra attention to detail, precision cutting, and styling. Includes a professional blow-dry and styling finish. For those who want a premium finish with their cut." },
  "SVC_G_LUXURY_BEARD": { name: "Luxury Beard", price: "Rs.300", benefits: "Premium beard grooming with detailed shaping, hot towel treatment, beard oil application, and precision lining. Leaves your beard looking sharp, healthy, and well-conditioned." },
  "SVC_G_LUXURY_CUTSHAVE": { name: "Luxury Cut + Shave", price: "Rs.500 (with hairwash, one-time apron)", benefits: "The complete luxury grooming experience — precision haircut, professional hairwash, blow-dry, plus a hot towel straight razor shave. You walk out looking sharp from head to face." },
  // GENTS HAIR STYLING
  "SVC_G_HAIRWASH": { name: "Hair Wash", price: "Rs.100", benefits: "Professional salon wash using premium shampoo and conditioner selected for your hair type. Includes a relaxing scalp massage during the wash. Quick refresh for clean, great-smelling hair." },
  "SVC_G_HAIRSETTING": { name: "Hair Setting", price: "Rs.150", benefits: "Professional styling and setting using appropriate styling products for your hair type. Our stylists will shape and set your hair to your preferred style — perfect for events or job interviews." },
  "SVC_G_BLOWDRY_SETTING": { name: "Blow Dry With Hair Setting", price: "Rs.200", benefits: "Blow-dry combined with styling for a polished, well-groomed finish. Your hair will look neat, voluminous, and styled. Great before important meetings or events." },
  "SVC_G_BLOWDRY_POWDER": { name: "Blow Dry With Hair Powder", price: "Rs.400", benefits: "Blow-dry combined with professional hair powder for maximum volume, texture, and hold. Hair powder adds thickness and a matte finish — perfect for fine hair or those who want a fuller, more textured look." },
  "SVC_G_BLOWDRY_FIBER": { name: "Blow Dry With Hair Fiber", price: "Rs.500", benefits: "Blow-dry combined with hair fiber for incredible volume and a natural hair-thickening effect. Hair fiber bonds with existing hair to make it appear thicker and fuller. Ideal for thinning hair or for creating dramatic volume and texture." },
  // GENTS HAIR TREATMENTS (same as ladies but gents pricing)
  "SVC_G_SMOOTHENING": { name: "Smoothening (Gents)", price: "Rs.1500+ (depending on hair length)", benefits: "Chemically relaxes and straightens hair, giving frizz-free, sleek results that last 4-6 months. Much more affordable than ladies pricing for shorter hair. Great for men with curly, wavy, or unruly hair who want low-maintenance straight hair." },
  "SVC_G_KERATIN": { name: "Keratin Treatment (Gents)", price: "Rs.4000+ (depending on hair length)", benefits: "Fills hair fibers with keratin protein for smoother, shinier, frizz-free hair. Lasts 3-5 months. Great for men with thick, frizzy, or chemically treated hair who want manageable, healthy-looking hair." },
  "SVC_G_BOTOX": { name: "Hair Botox (Gents)", price: "Rs.5000+ (depending on hair length)", benefits: "Deep conditioning treatment using proteins, vitamins, and collagen that restores damaged hair. Unlike straightening, it doesn't chemically alter hair structure — purely nourishes and repairs. Perfect for over-processed or damaged hair." },
  "SVC_G_KERASMOOTH": { name: "Kera Smooth (Gents)", price: "Rs.6000+ (depending on hair length)", benefits: "Premium advanced keratin system delivering the longest-lasting straightening results — up to 6-8 months. Best for very curly, coarse, or resistant hair that doesn't respond well to regular treatments." },
  "SVC_G_CURLING": { name: "Curling (Gents)", price: "Rs.4500+ (depending on hair length)", benefits: "Creates permanent curls or waves on straight hair using chemical waving solution. Choose from loose waves to tight curls depending on your desired style. Results last 3-6 months. A great way to add texture and personality to straight, fine hair." },
  "SVC_G_NANOPLASTY": { name: "Nanoplasty (Gents)", price: "Rs.8000+ (depending on hair length)", benefits: "Organic hair straightening using nanotechnology and natural amino acids — no formaldehyde, completely safe. Deeply nourishes while straightening. Lasts 4-6 months with incredible shine and smoothness." },
  "SVC_G_SHINEINFUSION": { name: "Shine Infusion (Gents)", price: "Rs.5000", benefits: "Glossing treatment that adds mirror-like shine and smoothness to dull or dry hair. Doesn't straighten — purely adds gloss and reduces frizz. Perfect for men who want healthy, radiant-looking hair. Lasts 6-8 weeks." },
  "SVC_G_DANDRUFF_BASIC": { name: "Anti Dandruff Basic (Gents)", price: "Rs.1500+", benefits: "Targeted medicated scalp treatment that removes flakes, controls excess sebum, and reduces scalp inflammation. Includes scalp massage and anti-dandruff shampoo application. Significant improvement after 2-3 sessions." },
  "SVC_G_DANDRUFF_PREMIUM": { name: "Anti Dandruff Premium (Gents)", price: "Rs.2500+", benefits: "Advanced anti-dandruff protocol with anti-fungal treatment, nourishing scalp serum, and steam therapy. More intensive for stubborn dandruff with scalp inflammation or persistent itchiness." },
  "SVC_G_SPA_BASIC": { name: "Hair Spa Basic (Gents)", price: "Rs.1200+", benefits: "Nourishing spa treatment restoring moisture and reducing breakage. Includes head massage, steaming, and mask application. Hair feels soft, hydrated, and manageable immediately after. Recommended monthly." },
  "SVC_G_SPA_PREMIUM": { name: "Hair Spa Premium (Gents)", price: "Rs.1500+", benefits: "Premium spa using concentrated protein mask that rebuilds damaged hair structure. Includes scalp massage, protein mask with steam, and finishing serum. Best for hair that feels weak, snaps, or is heavily styled with heat or products." },
  "SVC_G_SPA_MOROCCAN": { name: "Moroccan Spa (Gents)", price: "Rs.2000+", benefits: "Argan oil spa that adds extraordinary shine and nourishment to dull, dry hair. Pure Moroccan Argan oil is rich in Vitamin E and fatty acids — transforms dry, brittle hair into lustrous, healthy-looking locks." },
  // GENTS COLOUR
  "SVC_G_COLOUR_GRAY": { name: "Hair Colour Gray Coverage", price: "Rs.800+ (Loreal Schoff)", benefits: "Professional grey coverage using Loreal Schoff — covers even the most stubborn grey hairs for a natural, youthful look. Long-lasting colour that stays vibrant for 6-8 weeks. Available in all natural shades to match your original hair colour." },
  "SVC_G_COLOUR_AMMONIAFREE": { name: "Hair Colour Ammonia Free", price: "Rs.1000+ (Loreal Schoff)", benefits: "Ammonia-free colour using Loreal Schoff — gentler on scalp and hair while still providing excellent grey coverage. Less chemical smell, less scalp irritation, and maintains hair health better than regular colour. Perfect for sensitive scalps." },
  "SVC_G_BEARD_COLOUR": { name: "Beard Colour", price: "Rs.300+", benefits: "Professional beard colour that covers grey beard hair for a fuller, younger appearance. Matched precisely to your hair colour or customized to your preference. Quick and precise application." },
  "SVC_G_FASHION_COLOUR": { name: "Fashion Colour (Gents)", price: "Rs.1500+", benefits: "Bold, creative colour for men who want to make a statement — from ash grey and platinum to burgundy, blue, or any fashion shade. Our colourists specialize in men's fashion colour trends." },
  "SVC_G_CAP_HIGHLIGHTS": { name: "Cap Highlights", price: "Rs.2000+", benefits: "Classic cap highlighting technique for men — creates natural-looking lighter streaks through the hair. Adds dimension, depth, and a sun-kissed effect to darker hair. Low maintenance as it grows out naturally." },
  "SVC_G_COLOUR_GEL": { name: "Colour Basic Hair Gel", price: "Rs.400+", benefits: "Colour-enhanced styling gel that adds a subtle tint while styling. Covers light greys and adds shine. Great for men who want minimal, natural-looking coverage with the convenience of their daily styling routine." },
  "SVC_G_BEARD_GEL": { name: "Beard Basic Gel", price: "Rs.250+", benefits: "Colour-tinted beard gel that covers light grey beard hairs while giving your beard shape and hold. A quick, easy way to keep beard looking groomed and youthful." },
  // GENTS HEAD MASSAGE
  "SVC_G_MASSAGE_OIL": { name: "Oil Massage With Wash", price: "Rs.500", benefits: "A deeply relaxing scalp massage using warm nourishing oil, followed by a professional hairwash. The oil massage improves blood circulation, reduces stress, nourishes the scalp, and can help with hair growth. One of the most relaxing treatments at ABCD — highly recommended." },
  "SVC_G_MASSAGE_NORMAL": { name: "Normal Head Massage", price: "Rs.300", benefits: "A relaxing dry head massage that relieves tension, reduces stress, improves circulation, and promotes a sense of calm. A quick and affordable way to de-stress and rejuvenate — especially after a long day." },
  // GENTS MANI PEDI (same pricing as ladies)
  "SVC_G_MANI_ORDINARY": { name: "Ordinary Manicure (Gents)", price: "Rs.500", benefits: "Basic nail cutting, shaping, filing, cuticle care, and hand massage. Well-groomed hands make a great impression. More men are discovering the benefits of regular manicures for nail health and professional appearance." },
  "SVC_G_PEDI_ORDINARY": { name: "Ordinary Pedicure (Gents)", price: "Rs.900", benefits: "Basic foot care including nail trimming, filing, cuticle care, and foot massage. Essential for foot health — prevents ingrown nails, removes calluses, and keeps feet comfortable and clean." },
  "SVC_G_MANI_CLASSIC": { name: "Classic Manicure (Gents)", price: "Rs.700", benefits: "Enhanced 45-minute manicure with scrub and massage pack. More thorough nail and hand care for men who want well-maintained hands." },
  "SVC_G_PEDI_CLASSIC": { name: "Classic Pedicure (Gents)", price: "Rs.1300", benefits: "Thorough 45-minute pedicure with heel clearing, scrub, and massage pack. Targets rough heels and dry skin — essential for foot health especially for men who stand or walk a lot." },
  "SVC_G_MANI_PREMIUM": { name: "Premium Manicure (Gents)", price: "Rs.1500", benefits: "Luxurious 1-hour hand treatment with deep conditioning. Professional men know that groomed hands matter — in business and in life." },
  "SVC_G_PEDI_PREMIUM": { name: "Premium Pedicure (Gents)", price: "Rs.2000", benefits: "The ultimate 1-hour foot treatment. Transforms neglected feet — removes dead skin, heals cracked heels, deeply moisturizes. A must before holidays, weddings, or any occasion where appearance matters." },
  // GROOM PACKAGES
  "SVC_GROOM_GLOW": { name: "Glow Groom Package", price: "Rs.3700 (was Rs.4500)", benefits: "Complete groom package: Hair Spa + Premium Facial + Cutting & Shaving (complimentary). Hair spa nourishes and adds shine, facial gives you event-ready glowing skin, and a fresh cut finishes the look. Save Rs.800 vs individual pricing — the most popular package for grooms." },
  "SVC_GROOM_GOLD": { name: "Gold Glow Up Package", price: "Rs.5000 (was Rs.5500)", benefits: "Premium groom package: Luxury Hair Spa + Premium Facial + Cutting & Shaving (complimentary). An upgraded experience with premium spa and facial products for the most important day of your life. Save Rs.500 vs individual pricing." },
  "SVC_GROOM_BOOSTER": { name: "Booster Glow Up Package", price: "Price on request (customer's choice)", benefits: "The most customizable groom package — includes Facial Gold Glow Up + Cutting & Shaving (complimentary) + your choice from: Keratin/Botox, Manicure/Pedicure, Smoothening, or Hair Spa. Build your perfect grooming package based on your specific needs. Call 7012121125 for a custom quote." },
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
    ? `LANGUAGE RULE: Reply ONLY in Malayalam script. Every word in Malayalam. ZERO English or Manglish unless it's a brand name like ABCD, Keratin, Rs.`
    : lang === "MG"
    ? `LANGUAGE RULE: Reply ONLY in Manglish — Malayalam words in English/Roman letters. Examples: "aanu", "undoo", "venam", "cheyyam", "mathi", "alle", "kitto", "ningalkku", "enthanu". ZERO Malayalam Unicode script. If unsure of Manglish word, use English word instead.`
    : `LANGUAGE RULE: Reply ONLY in English.`;

  return `You are the AI assistant for ABCD Beauty Clinic & Salon, Kasaragod, Kerala.

${langRule}

PERSONALITY: Warm, friendly, knowledgeable. Max 3 sentences for normal replies. No bullet points.

LOCATIONS:
- ചേർക്കള, കാഞ്ഞങ്ങാട് — GENTS ONLY
- കാഞ്ഞങ്ങാട് (main branch) — GENTS AND LADIES
Spellings: ചേർക്കള and കാഞ്ഞങ്ങാട് only. NEVER ചേർത്തല.

CONTACT: 7012121125 | Hours: Ladies 10AM-10PM, Gents 10AM-12AM | Open all 7 days

BOOKING FLOW — collect naturally one by one:
1. Full name
2. Location (Cherkala-Gents only / Kanhangad-Gents & Ladies)
3. Service
4. Date (use today's date to resolve "tomorrow", "today")
5. Time
6. Section (only for Kanhangad)
Confirm: "Thank you [Name]! Booking request received. Our team will contact you shortly to confirm. Call 7012121125 for urgent bookings."

When asked to call or speak to someone: "Our team will call you back shortly! You can also reach us at 7012121125 😊"
When confused or unsure: "For this please contact our team at 7012121125 😊"`;
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

async function sendServiceInfo(to, svcId, lang, userPhone, currentDate) {
  const svc = SERVICE_INFO[svcId];
  if (!svc) return false;

  const prompt = `The customer selected "${svc.name}" (Price: ${svc.price}). 
Write a warm, natural reply that includes:
1. The service name and price
2. The benefits of this service (use this info: ${svc.benefits})
3. Ask if they want to book an appointment

Keep it conversational, not like a list. Maximum 5 sentences.`;

  const reply = await getAIReply(userPhone, prompt, currentDate, lang);
  await sendText(to, reply);
  return true;
}

// ─── DETECT BOOKING COMPLETE ──────────────────────────────────────────────────
function isBookingComplete(msg) {
  return msg.includes("Booking request received") || msg.includes("booking request received") || msg.includes("ബുക്കിംഗ്");
}

// ─── EXTRACT BOOKING ──────────────────────────────────────────────────────────
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

    if (messageType === "audio") { await sendText(from, "Sorry, voice messages support cheyyunilla 😊 Please type cheyyoo! Or call: 7012121125"); return; }
    if (!messageText || (messageType !== "text" && messageType !== "interactive")) return;

    console.log(`From ${from} [${messageType}]: ${messageText}`);

    if (!userState[from]) userState[from] = { stage: "language", lang: null };
    const state = userState[from];
    const currentDate = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata" });

    // ── LANGUAGE SELECTION ──
    if (state.stage === "language") {
      if (buttonId === "LANG_EN" || buttonId === "LANG_ML" || buttonId === "LANG_MG") {
        state.lang = buttonId === "LANG_EN" ? "EN" : buttonId === "LANG_ML" ? "ML" : "MG";
        state.stage = "section";
        const texts = { EN: "Which section are you looking for?", ML: "ഏത് സെക്ഷൻ ആണ് വേണ്ടത്?", MG: "Enth section aano venam?" };
        await sendButtons(from, texts[state.lang], [{ id: "SEC_LADIES", title: "Ladies" }, { id: "SEC_GENTS", title: "Gents" }, { id: "SEC_BOTH", title: "Both" }]);
      } else {
        await sendButtons(from, "hi, ABCD Beauty Clinic & Salon-ലേക്ക് സ്വാഗതം! 🙏\n\nPlease select your language:", [{ id: "LANG_EN", title: "English" }, { id: "LANG_ML", title: "Malayalam" }, { id: "LANG_MG", title: "Manglish" }]);
      }
      return;
    }

    // ── SECTION SELECTION ──
    if (state.stage === "section") {
      if (buttonId === "SEC_LADIES" || buttonId === "SEC_GENTS" || buttonId === "SEC_BOTH") {
        state.section = buttonId;
        state.stage = "menu";
        if (buttonId === "SEC_LADIES") { await sendMenu(from, "LADIES_MAIN"); }
        else if (buttonId === "SEC_GENTS") { await sendMenu(from, "GENTS_MAIN"); }
        else {
          // Both — show ladies first then gents
          await sendMenu(from, "LADIES_MAIN");
        }
      } else {
        const texts = { EN: "Which section are you looking for?", ML: "ഏത് സെക്ഷൻ ആണ് വേണ്ടത്?", MG: "Enth section aano venam?" };
        await sendButtons(from, texts[state.lang || "EN"], [{ id: "SEC_LADIES", title: "Ladies" }, { id: "SEC_GENTS", title: "Gents" }, { id: "SEC_BOTH", title: "Both" }]);
      }
      return;
    }

    // ── MENU / CHAT STAGE ──
    if (state.stage === "menu" || state.stage === "chat") {

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

      // Service selected — show info + booking prompt
      if (buttonId && SERVICE_INFO[buttonId]) {
        state.stage = "chat";
        await sendServiceInfo(from, buttonId, state.lang, from, currentDate);
        return;
      }

      // Free text chat
      state.stage = "chat";
      const reply = await getAIReply(from, messageText, currentDate, state.lang);
      await sendText(from, reply);

      if (isBookingComplete(reply)) {
        const details = await extractBookingDetails(from, from);
        await sendBookingNotification(details);
        console.log("Booking notification sent!");
      }
    }

  } catch (err) { console.error("Webhook error:", err.message); }
});

app.get("/", (req, res) => res.json({ status: "ABCD Bot running" }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ABCD Bot running on port ${PORT}`));
