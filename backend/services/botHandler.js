const { getOrCreateCustomer, updateCustomerName } = require('./customerService');
const { sendMessage, sendLocation } = require('./wahaService');
const { getOrCreateSession, updateSession, resetSession } = require('./sessionService');
const greetingService = require('./greetingService');
const { getAllServices, getServiceByIndex, getServiceById, getAllPackages, getBusinessHours, getTherapistById, isProviderPhone, getTherapistByPhone, getActiveHumanAgents } = require('./dataService');
const { saveLocation, getDefaultLocation, createBooking, confirmBookingAtomic, saveCalendarEventId, cancelBooking, getExistingBookingOnDate, getCustomerBookings, tryParseDate, tryParseTime, findAndCompleteActiveBooking, saveBookingRating, saveBookingFeedback, getReschedulableBookings, getBookingById, updateBookingDateTime, updateBookingLocation } = require('./bookingService');

const { logMessage, getRecentMessages } = require('./logService');
const { saveIncomingMediaArtifact } = require('./mediaArtifactService');
const { getOllamaReply } = require('./ollamaService');
const { getAzureReply } = require('./azureOpenAIService');
const { getActiveSystemPrompt } = require('./systemPromptService');
const { getSystemPrompt } = require('../data/planText');
const templates = require('./messageTemplates');
const botMessagesService = require('./botMessagesService');
const faqService = require('./faqService');
const healthRecService = require('./healthRecommendationService');
const businessSettingsService = require('./businessSettingsService');
const catalogService = require('./catalogService');
const { estimateDeliveryQuote } = require('./deliveryQuoteService');
const { getEligibleCustomerPackages, purchasePackage } = require('./packageWalletService');
const { getReferralStatus, recordReferralCodeUse, claimLoyaltyRewardForSelection, normalizeReferralCode } = require('./referralService');
const LINE = `─────────────────`;
const SERVICE_MATCH_STOPWORDS = new Set([
  'massage', 'massages', 'service', 'services', 'package', 'packages', 'therapy', 'therapeutic',
  'session', 'sessions', 'center', 'home', 'book', 'booking', 'appointment',
  'مساج', 'تدليك', 'جلسة', 'جلسات', 'خدمة', 'خدمات', 'باقة', 'باقات', 'حجز', 'موعد', 'علاج', 'علاجي'
]);
// Default templates object for internal non-request utilities (like AI prompt building)
let t = templates;
const { reverseGeocode, geocode, normalizeToWaId } = require('../utils/helpers');
const { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = require('./googleCalendarService');
const { assignDriver, notifyDriverSameDayBooking } = require('./driverService');
const {
  releaseExpiredHolds,
  findNextAvailableDay,
  getAvailableProvider,
  getAvailableSlotsForDay,
  lockDistrict,
  formatTime12h,
  formatDateDisplay,
  checkDateAvailabilityDetails,
  holdSlot,
  releaseHold,
} = require('./availabilityService');



// ─── Nested service catalog helpers ─────────────────────────────────────────
function isBackCommand(lower) {
  return ['0', 'back', 'go back', 'رجوع', 'رجع', 'وراء', 'القائمة', 'main menu', 'menu'].includes(lower);
}

function catalogName(node, lang) {
  return (lang === 'ar' && node.name_ar) ? node.name_ar : node.name;
}

function sortedPriceOptions(service) {
  return [...(service?.price_options || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function defaultCommercialOption(service) {
  const firstOption = sortedPriceOptions(service).find((po) => po.price !== null || po.duration_minutes !== null);
  return {
    id: firstOption?.id || null,
    label: firstOption?.label || null,
    price: firstOption?.price ?? service.price ?? null,
    duration_minutes: firstOption?.duration_minutes ?? service.duration_minutes ?? null,
    delivery_fee: firstOption?.delivery_fee ?? service.delivery_fee ?? null,
  };
}

function markServiceInstructionForward(msgData, service, trigger, lang, option = null) {
  if (msgData && typeof msgData === 'object' && service) {
    const selected = option ? serviceSelectionPayload(service, option) : {};
    msgData.service_instruction_forward = {
      service: { ...service, ...selected },
      trigger,
      lang,
    };
  }
}

function serviceSelectionPayload(service, option = null) {
  const chosen = option || defaultCommercialOption(service);
  return {
    selected_service_id: service.id,
    selected_service_name: service.name,
    selected_service_name_ar: service.name_ar || null,
    selected_service_price: chosen.price,
    selected_service_duration: chosen.duration_minutes,
    selected_service_delivery_fee: chosen.delivery_fee,
    selected_service_price_option_id: chosen.id || null,
    selected_service_price_option_label: chosen.label || null,
  };
}

function packagePriceLabel(pkg, lang = 'en') {
  const name = String(pkg.name || '').toLowerCase();
  if (name.includes('loyalty')) {
    return lang === 'ar' ? 'جلسة مجانية بعد تحقق الإحالات' : 'free after referral validation';
  }
  if (pkg.total_price === null || pkg.total_price === undefined || Number(pkg.total_price) === 0) {
    return lang === 'ar' ? 'السعر حسب الخدمة المختارة' : 'priced by selected service';
  }
  return `${Number(pkg.total_price || 0).toLocaleString()} ${lang === 'ar' ? 'ريال' : 'SAR'}`;
}

function packageLine(pkg, i, lang = 'en') {
  const sessions = pkg.total_sessions || 0;
  const days = pkg.validity_days || 0;
  const validity = days > 0 ? ` — ${days} ${lang === 'ar' ? 'يوم' : 'days'}` : '';
  return `${i + 1}. ${pkg.name} — ${sessions} ${lang === 'ar' ? 'جلسات' : 'sessions'} — ${packagePriceLabel(pkg, lang)}${validity}`;
}

function estimatePackageRequestPrice(pkg, sessionData = {}) {
  const unit = Number(sessionData.selected_service_price || 0);
  const name = String(pkg.name || '').toLowerCase();
  if (!Number.isFinite(unit) || unit <= 0) return null;
  if (name.includes('pure bliss')) return Math.round(unit * 3 * 0.85 * 100) / 100;
  if (name.includes('wellness')) return Math.round(unit * 5 * 100) / 100;
  if (name.includes('loyalty')) return 0;
  return pkg.total_price === null || pkg.total_price === undefined ? null : Number(pkg.total_price || 0);
}

function packageChoiceMenuText({ eligibleWallets = [], packages = [], lang = 'en' }) {
  const hasWallet = eligibleWallets.length > 0;
  const packageLines = packages.slice(0, 5).map((pkg, i) => packageLine(pkg, i, lang));
  if (lang === 'ar') {
    return `*طريقة الدفع/الباقة*\n─────────────────\n\n` +
      `1. حجز جلسة مفردة\n` +
      `2. استخدام باقة فعّالة${hasWallet ? ` (${eligibleWallets.length} متاحة)` : ' (لا توجد باقة فعّالة مناسبة)'}\n` +
      `3. شراء/طلب باقة جديدة\n\n` +
      (packageLines.length ? `*الباقات المتاحة:*\n${packageLines.join('\n')}\n\n` : '') +
      `اردي برقم الخيار، أو *0* للإلغاء.`;
  }
  return `*Payment / Package*\n─────────────────\n\n` +
    `1. Book a single session\n` +
    `2. Use an active package${hasWallet ? ` (${eligibleWallets.length} eligible)` : ' (no eligible active package)'}\n` +
    `3. Buy/request a new package\n\n` +
    (packageLines.length ? `*Available packages:*\n${packageLines.join('\n')}\n\n` : '') +
    `Reply with an option number, or *0* to cancel.`;
}

function packageWalletSelectText(wallets, lang = 'en') {
  const lines = wallets.map((w, i) => `${i + 1}. ${w.name || 'Package'} — ${w.remaining_sessions}/${w.total_sessions} ${lang === 'ar' ? 'جلسات متبقية' : 'sessions left'}${w.service_unit_price ? ` — ${Number(w.service_unit_price).toLocaleString()} SAR` : ''}${w.service_duration_minutes ? ` — ${w.service_duration_minutes} min` : ''}${w.expires_at ? ` — ${String(w.expires_at).slice(0, 10)}` : ''}`);
  return lang === 'ar'
    ? `اختاري الباقة للاستخدام:\n\n${lines.join('\n')}\n\nارسلي رقم الباقة، أو *0* للإلغاء.`
    : `Choose the package to use:\n\n${lines.join('\n')}\n\nReply with the package number, or *0* to cancel.`;
}

function packagePurchaseSelectText(packages, lang = 'en', sessionData = {}) {
  const lines = packages.map((pkg, i) => {
    const estimated = estimatePackageRequestPrice(pkg, sessionData);
    const estimateText = estimated === null
      ? packagePriceLabel(pkg, lang)
      : `${Number(estimated).toLocaleString()} ${lang === 'ar' ? 'ريال' : 'SAR'}`;
    return `${packageLine(pkg, i, lang)} — ${lang === 'ar' ? 'تقدير طلبك' : 'your estimate'}: ${estimateText}`;
  });
  return lang === 'ar'
    ? `اختاري الباقة المطلوبة:\n\n${lines.join('\n')}\n\nسيؤكد الفريق الدفع/الأهلية ويفعّل الباقة قبل استخدامها. ارسلي رقم الباقة، أو *0* للإلغاء.`
    : `Choose the package to request:\n\n${lines.join('\n')}\n\nThe team will confirm payment/eligibility and activate it before use. Reply with a package number, or *0* to cancel.`;
}


function extractReferralEntry(text = '', lower = '') {
  const raw = String(text || '').trim();
  const normalizedLower = String(lower || '').trim();
  const explicit = /\b(ref|referral|code)\b/i.test(raw) || /(كود|احالة|الإحالة|الاحالة)/.test(normalizedLower);
  if (!explicit) return null;
  const match = raw.toUpperCase().match(/\b(HSC[A-Z0-9]{3,13})\b/);
  if (!match) return null;
  return normalizeReferralCode(match[1]);
}

function wantsReferralStatus(text = '', lower = '') {
  const raw = String(text || '').toLowerCase();
  const normalizedLower = String(lower || '').trim();
  return /\b(my referral|referral status|referral code|my code|invite code)\b/.test(raw)
    || /(كود الاحالة|كود الإحالة|احالاتي|إحالاتي|رمز الاحالة|رمز الإحالة)/.test(normalizedLower);
}

function referralStatusText(status, lang = 'en') {
  if (lang === 'ar') {
    return `*كود الإحالة الخاص بك:* ${status.code}\n\n` +
      `الإحالات المؤهلة من عملاء جدد: ${status.qualifiedCount}/${status.threshold}\n` +
      `قيد الانتظار: ${status.pendingCount}\n` +
      (status.remainingToNextReward > 0
        ? `المتبقي للجلسة المجانية التالية: ${status.remainingToNextReward}`
        : `لديك مكافأة جلسة مجانية متاحة 🎁`);
  }
  return `*Your referral code:* ${status.code}\n\n` +
    `Qualified new-client referrals: ${status.qualifiedCount}/${status.threshold}\n` +
    `Pending referrals: ${status.pendingCount}\n` +
    (status.remainingToNextReward > 0
      ? `Remaining for next free session: ${status.remainingToNextReward}`
      : `You have a free-session reward available 🎁`);
}

function referralRecordedText(result, lang = 'en') {
  if (lang === 'ar') {
    if (result.reason === 'self_referral') return 'هذا كودك أنت، لا يمكن استخدامه كإحالة لنفس الحساب.';
    if (result.reason === 'code_not_found') return 'لم أجد كود الإحالة. تأكدي من كتابته كما هو.';
    if (result.reason === 'returning_client') return 'كود الإحالة يُحتسب للعملاء الجدد فقط. لأن لديك حجزاً مكتملاً سابقاً، لن تُحسب هذه الإحالة.';
    if (result.reason === 'already_attributed') return 'تم تسجيل إحالتك مسبقاً. لا يمكن تغيير كود الإحالة بعد التسجيل.';
    return 'تم تسجيل كود الإحالة ✅ سيتم احتسابه بعد أول حجز مكتمل إذا كان العميل جديداً.';
  }
  if (result.reason === 'self_referral') return 'That is your own referral code, so it cannot be used on the same account.';
  if (result.reason === 'code_not_found') return 'I could not find that referral code. Please check and send it again.';
  if (result.reason === 'returning_client') return 'Referral codes count for new clients only. Since you already have a completed booking, this referral cannot be counted.';
  if (result.reason === 'already_attributed') return 'Your referral was already recorded. Referral codes cannot be changed after registration.';
  return 'Referral code recorded ✅ It will qualify after your first completed booking if you are a new client.';
}


function isGiftSkip(text) {
  const value = String(text || '').trim().toLowerCase();
  return ['0', 'skip', 'no', 'n', 'not gift', 'not a gift', 'لا', 'تخطي', 'تجاوز'].includes(value);
}

function isGiftAffirmationOnly(text) {
  const value = String(text || '').trim().toLowerCase();
  return ['yes', 'y', 'gift', 'it is a gift', 'نعم', 'هدية', 'اي', 'ايوه'].includes(value);
}

function selectedServicePromptPayload(sessionData = {}) {
  return {
    id: sessionData.selected_service_id,
    name: sessionData.selected_service_name,
    price: sessionData.selected_service_price,
    duration_minutes: sessionData.selected_service_duration,
    delivery_fee: sessionData.selected_service_delivery_fee,
  };
}

function parseGiftBookingDetails(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, ' ').trim();
  const details = {};
  const recipientMatch = compact.match(/(?:recipient|for|to|المستلمة|لـ|إلى|الى)\s*[:\-]?\s*([^.;،]+)(?=\s+(?:voucher|code|instructions|message|from|كود|تعليمات|رسالة|من)\b|[.;،]|$)/i);
  const voucherMatch = compact.match(/(?:voucher|coupon|code|قسيمة|كود)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9_-]{2,31})/i);
  const instructionMatch = compact.match(/(?:instructions?|message|note|تعليمات|رسالة|ملاحظة)\s*[:\-]?\s*(.+)$/i);
  const phoneMatch = compact.match(/(?:phone|mobile|جوال|رقم)\s*[:\-]?\s*(\+?\d[\d\s-]{6,20})/i);

  if (recipientMatch) details.recipient_name = recipientMatch[1].trim();
  if (phoneMatch) details.recipient_phone = phoneMatch[1].replace(/\s+/g, ' ').trim();
  if (instructionMatch) details.instructions = instructionMatch[1].trim();
  if (voucherMatch) details.voucher_code = voucherMatch[1].toUpperCase();

  if (!details.recipient_name && !details.instructions && !details.voucher_code && !details.recipient_phone) {
    details.instructions = compact;
  }
  return { is_gift: true, ...details };
}

async function askPackageChoice(customerId, servicePayload, lang) {
  const [eligibleWallets, packages] = await Promise.all([
    getEligibleCustomerPackages({
      customerId,
      serviceId: servicePayload.selected_service_id,
      servicePriceOptionId: servicePayload.selected_service_price_option_id || null,
    }),
    getAllPackages(),
  ]);
  await updateSession(customerId, 'package_choice', {
    ...servicePayload,
    eligible_package_customer_ids: eligibleWallets.map((w) => w.id),
    available_package_ids: packages.map((pkg) => pkg.id),
  });
  return packageChoiceMenuText({ eligibleWallets, packages, lang });
}

function flattenCatalogLeaves(nodes) {
  const leaves = [];
  const walk = (node) => {
    if (node.children?.length) node.children.forEach(walk);
    if (node.service_category === 'service') leaves.push(node);
  };
  (nodes || []).forEach(walk);
  return leaves;
}

function findCatalogNode(nodes, id) {
  for (const node of nodes || []) {
    if (node.id === id) return node;
    const found = findCatalogNode(node.children || [], id);
    if (found) return found;
  }
  return null;
}

async function getCatalogContext(parentId = null) {
  const tree = await catalogService.getCatalogTree({ activeOnly: true });
  const parent = parentId ? findCatalogNode(tree, parentId) : null;
  const nodes = parent ? (parent.children || []) : tree;
  return { tree, parent, nodes, leaves: flattenCatalogLeaves(tree) };
}

function catalogMenuText(nodes, mode, lang, parent = null) {
  if (!nodes.length) {
    return lang === 'ar'
      ? 'لا توجد عناصر فعالة هنا حالياً. ارسلي *0* للرجوع.'
      : 'There are no active items here yet. Reply *0* to go back.';
  }
  const title = mode === 'book'
    ? (lang === 'ar' ? 'اختاري الخدمة للحجز:' : 'Choose a service to book:')
    : (lang === 'ar' ? 'اختاري خدمة لعرض التفاصيل:' : 'Choose a service to view details:');
  const lines = nodes.map((node, i) => {
    const icon = node.service_category === 'category' ? '▸' : '•';
    const option = defaultCommercialOption(node);
    const commercial = node.service_category === 'service' && option.price !== null
      ? ` — ${option.duration_minutes || '—'} ${lang === 'ar' ? 'دقيقة' : 'min'} — ${option.price} ${lang === 'ar' ? 'ريال' : 'SAR'}`
      : '';
    return `${i + 1}. ${icon} *${catalogName(node, lang)}*${commercial}`;
  });
  // Add packages option (option 99) for subcategories or categories
  const packageOption = parent
    ? (lang === 'ar'
      ? `${lines.length + 1}. 🎁 *عرض الباقات المتاحة*`
      : `${lines.length + 1}. 🎁 *Available Packages*`)
    : null;
  const fullLines = packageOption ? [...lines, packageOption] : lines;
  const footer = parent
    ? (lang === 'ar' ? '\n\nارسلي رقم للاختيار، أو *0* للرجوع.' : '\n\nReply with a number, or *0* to go back.')
    : (lang === 'ar' ? '\n\nارسلي رقم للاختيار، أو *0* للقائمة الرئيسية.' : '\n\nReply with a number, or *0* for the main menu.');
  return `${title}\n\n${fullLines.join('\n')}${footer}`;
}

function serviceOptionMenuText(service, lang) {
  const options = sortedPriceOptions(service);
  if (!options.length) return null;
  const lines = options.map((option, i) => {
    const label = option.label ? `${option.label} — ` : '';
    return `${i + 1}. ${label}${option.duration_minutes || '—'} ${lang === 'ar' ? 'دقيقة' : 'min'} — ${option.price ?? service.price ?? '—'} ${lang === 'ar' ? 'ريال' : 'SAR'}`;
  });
  return (lang === 'ar'
    ? `اختاري مدة/سعر *${catalogName(service, lang)}*:\n\n${lines.join('\n')}\n\nارسلي رقم الخيار، أو *0* للرجوع.`
    : `Choose duration/price for *${catalogName(service, lang)}*:\n\n${lines.join('\n')}\n\nReply with an option number, or *0* to go back.`);
}

async function showCatalogForSession(customerId, mode, lang, parentId = null, extra = {}) {
  const ctx = await getCatalogContext(parentId);
  const step = mode === 'book' ? 'select_service' : 'services_list';
  await updateSession(customerId, step, {
    ...extra,
    catalog_mode: mode,
    catalog_parent_id: parentId,
    catalog_node_ids: ctx.nodes.map((n) => n.id),
  });
  return catalogMenuText(ctx.nodes, mode, lang, ctx.parent);
}

async function handleCatalogSelection({ customerId, text, lower, lang, mode, sessionData, t, aiFallback, onLeaf }) {
  if (isBackCommand(lower)) {
    if (sessionData.catalog_parent_id) {
      const tree = await catalogService.getCatalogTree({ activeOnly: true });
      const current = findCatalogNode(tree, sessionData.catalog_parent_id);
      return await showCatalogForSession(customerId, mode, lang, current?.parent_id || null, sessionData);
    }
    await resetSession(customerId);
    return await getMainMenuReply(lang, t);
  }

  const ctx = await getCatalogContext(sessionData.catalog_parent_id || null);
  const num = parseInt((text.match(/\b\d+\b/) || [])[0], 10);
  let chosen = (!isNaN(num) && num >= 1 && num <= ctx.nodes.length) ? ctx.nodes[num - 1] : null;
  if (!chosen) {
    chosen = findServiceInText(lower, ctx.leaves);
  }
  if (!chosen) return await aiFallback();

  if (chosen.service_category === 'category') {
    return await showCatalogForSession(customerId, mode, lang, chosen.id, sessionData);
  }
  return await onLeaf(chosen);
}

// ─── Phone normalizer for human agents ───────────────────────────────────────
// Converts any stored format to plain international digits (no + or spaces).
// Handles Saudi local, Pakistani local, and already-correct international numbers.
function normalizeAgentPhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, ''); // strip all non-digits

  // Already has full country code (10+ digits, not starting with 0)
  if (d.length >= 10 && !d.startsWith('0')) return d;

  // Saudi: 00966XXXXXXXX or 0966XXXXXXXX
  if (d.startsWith('00966')) return d.slice(2);   // 00966X → 966X
  if (d.startsWith('0966'))  return d.slice(1);   // 0966X  → 966X

  // Pakistani local: 03XXXXXXXXX (11 digits, starts with 03)
  if (d.length === 11 && d.startsWith('0')) return '92' + d.slice(1);

  // Saudi local: 05XXXXXXXX (10 digits, starts with 05)
  if (d.length === 10 && d.startsWith('0')) return '966' + d.slice(1);

  // Bare Saudi mobile: 5XXXXXXXX (9 digits)
  if (d.length === 9 && d.startsWith('5')) return '966' + d;

  return d || null; // return as-is if nothing matched
}

async function getWelcomeNewReply(lang, t) {
  const activeGreeting = await greetingService.getActiveGreeting();
  if (activeGreeting) {
    return (lang === 'ar' && activeGreeting.message_ar) 
      ? `${activeGreeting.message_ar}\n─────────────────\nما اسمك الكريم للبدء؟` 
      : `${activeGreeting.message_en}\n─────────────────\nMay I have your name to get started?`;
  }
  const dynamic = await getDynamicMessage('welcome_new', lang);
  return dynamic || t.welcomeNew();
}

async function getWelcomeBackReply(name, lang, t) {
  const dynamic = await getDynamicMessage('welcome_back', lang, { name: name || '' });
  const activeGreeting = await greetingService.getActiveGreeting();
  if (activeGreeting) {
    const greetText = (lang === 'ar' && activeGreeting.message_ar) ? activeGreeting.message_ar : activeGreeting.message_en;
    const welcomeBackPrefix = lang === 'ar' ? `*أهلاً وسهلاً، ${name}!*` : `*Welcome back, ${name}!*`;
    return `${welcomeBackPrefix}\n─────────────────\n\n${greetText}\n\n${await getMainMenuReply(lang, t)}`;
  }
  return dynamic || t.welcomeBack(name);
}

async function getGreetingWithMenuReply(name, lang, t) {
  // Omit the long admin greeting here so it doesn't repeat right after they provide their name.
  return t.greetingWithMenu(name);
}

async function getDynamicMessage(key, lang, placeholders = {}) {
  const msg = await botMessagesService.getMessage(key, lang, placeholders);
  return msg || null;
}

async function getDidNotUnderstandReply(lang, t, extra = '') {
  const base = await getDynamicMessage('did_not_understand', lang);
  const fallback = t.didNotUnderstand();
  return extra ? `${base || fallback}\n\n${extra}` : (base || fallback);
}

async function getMainMenuReply(lang, t) {
  const base = await getDynamicMessage('main_menu', lang);
  return base || t.mainMenu();
}

async function getNoAvailabilityReply(lang, t) {
  const base = await getDynamicMessage('no_availability', lang);
  return base || t.noAvailability();
}

async function getBookingCancelledReply(lang, t) {
  const base = await getDynamicMessage('booking_cancelled', lang);
  return base || t.bookingCancelled();
}

async function getBookingConfirmedReply(lang, t, name) {
  const base = await getDynamicMessage('booking_confirmed', lang, { name: name || 'dear customer' });
  return base || t.bookingConfirmed(name || 'dear customer');
}

// ─── Keywords ────────────────────────────────────────────────────────────────

const MENU_KEYWORDS = [
  '0', 'menu', 'main menu', 'back',
  'hi', 'hello', 'hey', 'مرحبا', 'هاي', 'السلام عليكم', 'اهلا', 'سلام',
  // Common transliterated Arabic greetings
  'salam', 'salaam', 'salam alaikum', 'salam allaikum', 'salamu alaikum',
  'assalam', 'assalamu alaikum', 'as-salam', 'alsalam',
  'ahlan', 'ahlan wa sahlan', 'marhaba', 'marhab',
];

// ─── My Bookings keywords ─────────────────────────────────────────────────────

const MY_BOOKINGS_KEYWORDS = [
  'my booking', 'my bookings', 'booking details', 'show booking', 'show my booking',
  'view booking', 'check booking', 'booking status', 'my appointment', 'my appointments',
  'booking history', 'my history', 'all booking', 'past booking', 'previous booking',
  'review booking', 'show details', 'review details', 'booking list', 'my sessions',
  'حجوزاتي', 'حجزي', 'تفاصيل الحجز',
];

// Returns true if message broadly asks about bookings (e.g. "review details of these bookings")
function isBookingHistoryRequest(lower) {
  // Don't intercept if this is a manage-booking request (reschedule / cancel / update)
  if (isRescheduleRequest(lower) || isCancelBookingRequest(lower) || isUpdateBookingRequest(lower)) return false;
  if (MY_BOOKINGS_KEYWORDS.some(kw => lower.includes(kw))) return true;
  const hasBooking = lower.includes('booking') || lower.includes('appointment') || lower.includes('session');
  const hasAction  = ['detail', 'review', 'show', 'list', 'view', 'check', 'see', 'tell', 'what'].some(w => lower.includes(w));
  return hasBooking && hasAction;
}

// ─── Manage Booking keywords ──────────────────────────────────────────────────

// Reschedule + update are the same flow: pick a booking, change what you want, update in-place
const UPDATE_BOOKING_KEYWORDS = [
  'reschedule', 'rebook', 'move my booking', 'change my booking', 'move appointment',
  'update booking', 'update my booking', 'change location', 'change address',
  'update address', 'update location', 'change time', 'change date',
  'edit booking', 'modify booking', 'change my appointment', 'change appointment',
  'new date', 'new time', 'different date', 'different time',
  'جدولة', 'تغيير الحجز', 'تعديل الحجز', 'تعديل', 'تغيير الموقع', 'تغيير الوقت',
];

function isRescheduleRequest(lower) {
  return isUpdateBookingRequest(lower);
}

// Cancel detection: message contains a cancel word AND a booking-related word,
// OR a standalone "i want to cancel / i want cancel" intent.
// This handles any variation: "cancel a booking", "i want cancel it", "delete my appointment", etc.
function isCancelBookingRequest(lower) {
  const cancelWords  = ['cancel', 'delete', 'remove', 'الغاء', 'إلغاء', 'ألغ', 'الغ'];
  const bookingWords = ['booking', 'appointment', 'session', 'reservation', 'slot', 'حجز', 'موعد'];
  const hasCancelWord  = cancelWords.some(w => lower.includes(w));
  const hasBookingWord = bookingWords.some(w => lower.includes(w));
  if (hasCancelWord && hasBookingWord) return true;
  // Standalone cancel intent without explicit booking word: "i want to cancel", "i want cancel"
  if (/i (want|need|would like) (to )?cancel/.test(lower)) return true;
  return false;
}

function isUpdateBookingRequest(lower) {
  return UPDATE_BOOKING_KEYWORDS.some(kw => lower.includes(kw));
}

// Format a booking row into a display item for manageBookingList
function normBookingItem(b, i) {
  const rawDate = b.booking_date;
  const isoDate = rawDate instanceof Date
    ? `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, '0')}-${String(rawDate.getDate()).padStart(2, '0')}`
    : String(rawDate).substring(0, 10);
  return {
    num:     i + 1,
    service: b.service_name || 'N/A',
    date:    isoDate ? formatDateDisplay(isoDate) : 'TBD',
    time:    b.start_time ? formatTime12h(String(b.start_time).substring(0, 5)) : 'TBD',
    type:    b.location_type,
  };
}

// ─── Human agent contact ──────────────────────────────────────────────────────

// Exact phrases — always trigger regardless of other words
const HUMAN_AGENT_EXACT = [
  'customer service', 'customer support', 'human support',
  'get in touch', 'reach out', 'real person', 'real human', 'live agent', 'live person', 'agent',
  // Arabic exact
  'شخص حقيقي', 'تواصل مع موظف', 'أريد موظف', 'اريد موظف', 'ابغى موظف', 'ابي موظف', 'احتاج موظف', 'دعم بشري', 'تكلم موظف', 'موظف',
];

// Combination logic: message must contain one ACTION word + one TARGET word.
// Catches any phrasing/typo combo: "connect s person", "talk wit staff", "reach an agent", etc.
const HUMAN_AGENT_ACTION_WORDS = [
  'talk', 'speak', 'connect', 'contact', 'reach', 'call', 'chat',
  'transfer', 'forward', 'get', 'want', 'need', 'help', 'support',
  // Arabic
  'تكلم', 'تواصل', 'اتصل', 'ابغى', 'ابي', 'أريد', 'اريد', 'محتاج', 'احتاج', 'وصلني',
];

const HUMAN_AGENT_TARGET_WORDS = [
  'person', 'people', 'human', 'someone', 'somebody',
  'staff', 'agent', 'team', 'representative', 'rep',
  'operator', 'advisor', 'assistant', 'receptionist',
  // Arabic
  'موظف', 'موظفة', 'شخص', 'وكيل', 'فريق', 'مساعد',
];

const DONE_KEYWORDS = [
  'done', 'complete', 'completed', 'finished', 'finished!', 'all done',
  'خلصت', 'انتهيت', 'تم', 'تم الانتهاء', 'خلصنا', 'انتهى'
];

// Shared logic: notify all active human agents and return an acknowledgement reply.
// Called both from the global interceptor (keyword detection) and from menu option 5.
async function contactHumanAgent(phone, name, customer, lang) {
  const customerName = name || 'Unknown';
  const agentNotification =
    `*Customer Contact Request*\n` +
    `─────────────────\n` +
    `Name  : ${customerName}\n` +
    `Phone : ${phone}\n` +
    `─────────────────\n` +
    `This customer wants to speak with a human agent.`;
  try {
    const agents = await getActiveHumanAgents();
    if (agents.length === 0) {
      console.warn('[AGENT] No active human agents configured in DB.');
    }
    for (const agent of agents) {
      const waId = normalizeAgentPhone(agent.phone_number);
      if (!waId) {
        console.warn(`[AGENT] Skipping ${agent.name} — unrecognized phone format: "${agent.phone_number}"`);
        continue;
      }
      const chatId = `${waId}@c.us`;
      try {
        await sendMessage(chatId, agentNotification);
        console.log(`[AGENT] Notified ${agent.name} (${waId}) about contact request from ${phone}`);
      } catch (err) {
        console.error(`[AGENT] Failed to notify ${agent.name} (${waId}):`, err.message);
      }
    }
  } catch (err) {
    console.error('[AGENT] Failed to fetch human agents:', err.message);
  }
  return lang === 'ar'
    ? pick([
        `بالطبع${name ? '، ' + name : ''}! لقد أبلغنا فريقنا وسيتواصلون معك على الواتساب قريباً.`,
        `تمام${name ? '، ' + name : ''}! تم إرسال تفاصيلك لفريقنا — ستسمعين منا قريباً جداً.`,
        `حسناً${name ? '، ' + name : ''}! تم إبلاغ فريقنا وسيتواصلون معك على الواتساب.`,
      ])
    : pick([
        `Of course${name ? ', ' + name : ''}! I have notified our team and someone will reach out to you on WhatsApp shortly.`,
        `Sure${name ? ', ' + name : ''}! I have passed your details to our team — you will hear from us very soon.`,
        `Got it${name ? ', ' + name : ''}! Our team has been notified and will contact you shortly on WhatsApp.`,
      ]);
}

function wantsHumanAgent(lower) {
  // 1. Check exact phrases first
  if (HUMAN_AGENT_EXACT.some(k => lower.includes(k))) return true;

  // 2. Combination: any action word + any target word anywhere in message
  const hasAction = HUMAN_AGENT_ACTION_WORDS.some(w => lower.includes(w));
  const hasTarget = HUMAN_AGENT_TARGET_WORDS.some(w => lower.includes(w));
  return hasAction && hasTarget;
}


// Detect what part of booking customer wants to correct
function detectCorrection(lower) {
  const dateWords    = ['date', 'تاريخ', 'بكره', 'بعد بكره', 'اليوم', 'امس', 'بغیر', 'wrong date', 'change date', 'date change', 'date wrong', 'date galat', 'reschedule', 'different date', 'تغيير التاريخ', 'تعديل التاريخ', 'تاريخ اخر'];
  const timeWords    = ['time', 'وقت', 'ساعة', 'ساعه', 'ميعاد', 'موعد', 'wrong time', 'change time', 'time change', 'time wrong', 'different time', 'waqt', 'تغيير الوقت', 'تعديل الوقت', 'وقت اخر'];
  const addressWords = ['address', 'location', 'موقع', 'عنوان', 'بيت', 'منزل', 'لوكيشن', 'wrong address', 'change address', 'address change', 'location change', 'jagah', 'pata', 'change location', 'تغيير الموقع', 'تعديل الموقع', 'تغيير العنوان', 'تعديل العنوان'];
  const serviceWords = ['service', 'massage', 'مساج', 'جلسة', 'جلسه', 'خدمة', 'خدمه', 'wrong service', 'change service', 'service change', 'different service', 'different massage', 'تغيير الخدمة', 'تعديل الخدمة', 'خدمة اخرى', 'مساج اخر'];

  if (dateWords.some(w => lower.includes(w)))    return 'date';
  if (timeWords.some(w => lower.includes(w)))    return 'time';
  if (addressWords.some(w => lower.includes(w))) return 'address';
  if (serviceWords.some(w => lower.includes(w))) return 'service';
  return null;
}

// Pick a random item from an array (for varied responses)
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Step hints shown after Ollama reply to guide user back to flow
const STEP_HINTS = {
  asking_name:         `May I have your name to get started?`,
  main_menu:           `Reply with a number 1 to 5 to continue.`,
  services_list:       `Type a number to learn more, or *0* for main menu.`,
  select_service:      `Type a number to select a service for booking, or *0* for main menu.`,
  service_detail:      `Reply *Yes* to book this service, or *No* to go back.`,
  package_choice:      `Reply *1* for single session, *2* to use an active package, *3* to request a package, or *0* to cancel.`,
  package_wallet_select:`Reply with the package number, or *0* to cancel.`,
  package_purchase_select:`Reply with the package number to request it, or *0* to cancel.`,
  booking_type:        `Reply *1* for center, *2* for home visit, or *0* to cancel.`,
  booking_location:    `Please share your *location pin* directly via WhatsApp (📎 → Location). Links and typed addresses are not accepted.`,
  booking_date:        `What date would you like? (e.g. 25 Feb)`,
  booking_date_duplicate_confirm: `Reply *Yes* to book at a different time, or *No* to choose another date.`,
  booking_time:        `What time works for you? (e.g. 3:00 PM)`,
  recommendation_select: `Reply with a number to book that service, or *0* to see all services.`,
  booking_day_confirm: `You can reply *Yes* to confirm, *Next* for another day, say a specific date (e.g. "28 Feb"), or *0* to cancel.`,
  booking_time_select: `Reply with a slot number to choose your time, or *0* to cancel.`,
  booking_summary:              `Reply *Yes* to confirm, *No* to cancel, or say what to change (e.g. "change date").`,
  booking_duplicate_confirm:    `Reply *Yes* to add this booking, or *No* to cancel.`,
  booking_rating:               `Please reply with a number from *1* to *5* to rate your session (1—Poor, 5—Excellent).`,
};

// Arabic step hints — shown after AI fallback reply when user is in Arabic mode
const STEP_HINTS_AR = {
  asking_name:         `ما اسمك الكريم للبدء؟`,
  main_menu:           `اردي برقم من 1 إلى 5 للمتابعة.`,
  services_list:       `اكتبي رقماً لمعرفة التفاصيل، أو *0* للقائمة الرئيسية.`,
  select_service:      `اكتبي رقم الخدمة للحجز، أو *0* للقائمة الرئيسية.`,
  service_detail:      `اردي *نعم* لحجز هذه الخدمة، أو *لا* للرجوع.`,
  package_choice:      `اردي *1* لجلسة مفردة، *2* لاستخدام باقة فعّالة، *3* لطلب باقة، أو *0* للإلغاء.`,
  package_wallet_select:`ارسلي رقم الباقة، أو *0* للإلغاء.`,
  package_purchase_select:`ارسلي رقم الباقة المطلوبة، أو *0* للإلغاء.`,
  booking_type:        `اردي *1* للمركز، *2* للزيارة المنزلية، أو *0* للإلغاء.`,
  booking_location:    `من فضلك شاركي *دبوس موقعك* مباشرة عبر الواتساب (📎 ← الموقع). العناوين المكتوبة والروابط غير مقبولة.`,
  booking_date:        `ما التاريخ المناسب؟ (مثال: 25 فبراير)`,
  booking_date_duplicate_confirm: `اردي *نعم* للحجز في وقت مختلف، أو *لا* لاختيار تاريخ آخر.`,
  booking_time:        `ما الوقت المناسب لك؟ (مثال: 3:00 م)`,
  recommendation_select: `اردي برقم لحجز تلك الخدمة، أو *0* لعرض كل الخدمات.`,
  booking_day_confirm: `يمكنك الرد بـ *نعم* للتأكيد، *التالي* ليوم آخر، أو اكتبي تاريخاً محدداً، أو *0* للإلغاء.`,
  booking_time_select: `اردي برقم الوقت المناسب، أو *0* للإلغاء.`,
  booking_summary:              `اردي *نعم* للتأكيد، *لا* للإلغاء، أو قولي ما تريدين تغييره.`,
  booking_duplicate_confirm:    `اردي *نعم* لإضافة هذا الحجز، أو *لا* للإلغاء.`,
  booking_rating:               `من فضلك اردي برقم من *1* إلى *5* لتقييم جلستك (1—ضعيف، 5—ممتاز).`,
};

// Use Ollama to generate a human-like response for unrecognized inputs
async function aiReply(userMessage, step, customerName = '', customerId = null, lang = 'en') {
  const localT = templates.forLang(lang);
  const isAr = lang === 'ar';
  const hintMap = isAr ? STEP_HINTS_AR : STEP_HINTS;
  const hint = hintMap[step] || '';

  // Skip Ollama if no real text (emoji-only, stickers, symbols)
  const hasText = /[a-zA-Z0-9\u0600-\u06FF]/.test(userMessage);
  if (!hasText) {
    const didNotUnderstand = await getDidNotUnderstandReply(lang, localT);
    const mainMenu = await getMainMenuReply(lang, localT);
    return step === 'main_menu'
      ? `${didNotUnderstand}\n\n${mainMenu}`
      : hint ? `${didNotUnderstand}\n\n${hint}` : didNotUnderstand;
  }

  // Build conversation history (last 5 messages only to save tokens)
  let historyBlock = '';
  if (customerId) {
    const history = await getRecentMessages(customerId, 5);
    if (history.length > 0) {
      historyBlock = history
        .map(m => m.direction === 'incoming' ? `Client: ${m.message}` : `Sarah: ${m.message}`)
        .join('\n') + '\n';
    }
  }

  // Build system prompt — use DB-backed prompt with fallback
  const basePrompt = await getActiveSystemPrompt();

  // If DB prompt is the base personality prompt, enrich it with services/packages/hours
  // If it is a full custom prompt from admin, use it as-is
  let sysPrompt = basePrompt;
  const isCustomPrompt = basePrompt && !basePrompt.startsWith("You are Sarah");
  if (!isCustomPrompt) {
    const allSvcs = await getAllServices();
    const allPkgs = await getAllPackages();
    const allHrs  = await getBusinessHours();
    sysPrompt = getSystemPrompt(allSvcs, allPkgs, allHrs);
  }

  const nameCtx    = customerName ? `Client name: ${customerName}.
` : '';
  const langCtx    = isAr ? `IMPORTANT: Reply in Arabic only.
` : '';
  const hintCtx    = hint ? `(After your reply, the system will show: "${hint}" — do NOT repeat it.)
` : '';

  // For Azure OpenAI: use Chat Completions format (system + user messages)
  const azureSystemPrompt =
    `${sysPrompt}
` +
    `${nameCtx}${langCtx}${hintCtx}` +
    (hint ? `After your reply, the system will automatically show the user: "${hint}" — do NOT include it in your reply.
` : '') +
    `Keep your reply short (1–3 sentences max). Do NOT use markdown like ** or bullet points.`;

  const azureUserMessage = historyBlock
    ? `${historyBlock}Client: ${userMessage}`
    : userMessage;

  // Legacy Ollama prompt (used as primary)
  const ollamaPrompt =
    `${sysPrompt}
` +
    `${nameCtx}${langCtx}${hintCtx}
` +
    `${historyBlock}` +
    `Client: ${userMessage}
` +
    `Sarah:`;

  // Try Ollama first (primary LLM), fall back to Azure OpenAI
  try {
    const reply = await getOllamaReply(ollamaPrompt);
    const finalReply = (reply || '').trim();
    if (!finalReply) throw new Error("empty response");
    return hint ? `${finalReply}

${hint}` : finalReply;
  } catch (ollamaErr) {
    console.error("Ollama error (falling back to Azure OpenAI):", ollamaErr.message);
    // Fall through to Azure OpenAI below
  }

  // Fallback: Azure OpenAI
  try {
    const reply = await getAzureReply(azureSystemPrompt, azureUserMessage);
    const finalReply = (reply || '').trim();
    if (!finalReply) throw new Error("empty response from Azure");
    return hint ? `${finalReply}

${hint}` : finalReply;
  } catch (azureErr) {
    console.error("Azure OpenAI error:", azureErr.message);

    // Both AI services failed — return generic fallback
    const isTimeout = azureErr.name === "AbortError" || (azureErr.message && azureErr.message.includes("fetch"));
    if (!hint) {
      return isAr
        ? "يسعدني مساعدتك في ذلك! إليك التفاصيل:"
        : "I would be happy to help you with that! Here are the details:";
    }
    if (step === "main_menu") {
      const didNotUnderstand = await getDidNotUnderstandReply(lang, localT);
      const mainMenu = await getMainMenuReply(lang, localT);
      return didNotUnderstand + "\n\n" + mainMenu;
    }
    if (isTimeout) {
      return isAr
        ? "عذراً، هنالك ضغط بسيط على الخادم حالياً. أرجوك أعيدي الإرسال.\n\nللتحدث مع موظف مباشرةً، أرسلي *موظف*"
        : "I apologize, I am experiencing a slight delay. Please send your message again.\n\nTo talk to a human agent, please type *agent*";
    }
    const didNotUnderstand = await getDidNotUnderstandReply(lang, localT);
    return hint
      ? didNotUnderstand + "\n\n" + hint
      : didNotUnderstand;
  }
}
// Fuzzy match: find a service by its DISTINCTIVE word(s) in user text
// e.g. "bamboo" → Bamboo Massage ✓  |  "massage" alone → no match ✗
function findServiceInText(lower, services) {
  return services.find(s => {
    const words = s.name.toLowerCase().split(' ');
    const hasEng = words.some(word => word.length > 3 && !SERVICE_MATCH_STOPWORDS.has(word) && lower.includes(word));
    if (hasEng) return true;

    if (s.name_ar) {
      const arWords = s.name_ar.toLowerCase().replace(/مساج|جلسة|علاج/g, '').trim().split(' ').map(w => w.replace(/^ال/, ''));
      const hasAr = arWords.some(word => word.length >= 3 && !SERVICE_MATCH_STOPWORDS.has(word) && lower.includes(word));
      if (hasAr) return true;
    }
    return false;
  }) || null;
}

// ─── Name validator ───────────────────────────────────────────────────────────

// Returns false if text looks like a question or sentence, not a person's name
const QUESTION_STARTERS = [
  'who', 'what', 'where', 'when', 'why', 'how', 'is', 'are', 'do', 'can',
  'could', 'would', 'will', 'should', 'did', 'have', 'has', 'was', 'were',
  'i want', 'i need', 'i am', 'i have', 'i would', 'i like', 'i don',
  'tell me', 'show me', 'give me', 'please', 'help', 'which',
  'this is', 'it is', 'this', 'it', 'yes', 'no', 'hi', 'hello', 'hey',
  'انا', 'اريد', 'أريد', 'ممكن', 'هل'
];

function looksLikeAName(text) {
  if (!text) return false;
  // Contains a question mark → definitely not a name
  if (text.includes('?')) return false;
  const lower = text.toLowerCase().trim();
  // Starts with a question/sentence word → not a name
  if (QUESTION_STARTERS.some(q => lower === q || lower.startsWith(q + ' '))) return false;
  
  // Reject if it contains common business/service words
  const notNames = ['massage', 'center', 'spa', 'healing', 'booking', 'appointment', 'service', 'there', 'clinic'];
  if (notNames.some(w => lower.includes(w))) return false;
  
  // Too long to be a name (more than 3 words)
  if (lower.split(/\s+/).length > 3) return false;
  return true;
}

// Extract the actual name from introduction sentences:
// "My name is Saqib" → "Saqib"
// "I am Sara"        → "Sara"
// "I'm Nour"         → "Nour"
// "Call me Reem"     → "Reem"
function extractNameFromIntro(text) {
  // Reject if it's a question asking for confirmation (e.g. "this is massage center?")
  if (text.includes('?')) {
    if (/(?:this is|it's|it is|is this|are you)/i.test(text)) {
      return null;
    }
  }

  // Reject if it contains common business/service words that shouldn't be extracted as names
  const lText = text.toLowerCase();
  const notNames = ['massage', 'center', 'spa', 'healing', 'booking', 'appointment', 'service', 'there', 'clinic'];
  if (notNames.some(w => lText.includes(w))) {
    return null;
  }

  const patterns = [
    /my name(?:'s| is)\s+([A-Za-z\u0600-\u06FF]+(?:\s+[A-Za-z\u0600-\u06FF]+)?)/i,
    /اسمي\s+([A-Za-z\u0600-\u06FF]+(?:\s+[A-Za-z\u0600-\u06FF]+)?)/i,
    /i(?:'m| am)\s+([A-Za-z\u0600-\u06FF]+(?:\s+[A-Za-z\u0600-\u06FF]+)?)/i,
    /أنا\s+([A-Za-z\u0600-\u06FF]+(?:\s+[A-Za-z\u0600-\u06FF]+)?)/i,
    /call me\s+([A-Za-z\u0600-\u06FF]+)/i,
    /نادي(?:ني|ني باسم)\s+([A-Za-z\u0600-\u06FF]+)/i,
    /(?:this is|it's|it is)\s+([A-Za-z\u0600-\u06FF]+)/i,
    /معك\s+([A-Za-z\u0600-\u06FF]+)/i,
    /name[:\s]+([A-Za-z\u0600-\u06FF]+(?:\s+[A-Za-z\u0600-\u06FF]+)?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

// ─── Health condition → service recommendation ────────────────────────────────

const CONDITIONS = [
  {
    keywords: [
      'back pain', 'backache', 'back ache', 'lower back', 'back hurts', 'aching back',
      'spine pain', 'spine problem', 'back injury', 'back injured', 'injured back',
      'back problem', 'back issue', 'back condition', 'back stiff', 'stiff back',
      'back sore', 'sore back', 'back tension', 'my back', 'upper back',
      'ألم في الظهر', 'الم الظهر', 'وجع ظهر', 'ظهري', 'العمود الفقري', 'الم في الظهر', 'الم اسفل الظهر', 'الم في العمود الفقري', 'كسر'
    ],
    services: [
      { name: 'Deep Tissue Massage',   duration: 60, price: 250 },
      { name: 'Trigger Point Therapy', duration: 60, price: 220 },
      { name: 'Hot Stone Massage',     duration: 90, price: 300 },
    ],
    why: 'These are our most effective treatments for releasing deep muscle tension and chronic back pain.',
    why_ar: 'تخفيف التوتر العضلي العميق وآلام الظهر المزمنة بفعالية عالية.',
  },
  {
    keywords: [
      'neck pain', 'shoulder pain', 'neck stiff', 'stiff neck', 'shoulder tension',
      'neck tension', 'neck hurts', 'shoulder hurts', 'neck ache', 'neck injury',
      'shoulder injury', 'shoulder stiff', 'stiff shoulder', 'trapped nerve',
      'neck problem', 'shoulder problem', 'neck and shoulder',
      'ألم الرقبة', 'الم الرقبة', 'الم الاكتف', 'الم الكتف', 'رقبتي', 'اكتفي', 'كتفي', 'شد في الرقبة', 'شد في الكتف', 'الم بالكتف والرقبة'
    ],
    services: [
      { name: 'Deep Tissue Massage',   duration: 60, price: 250 },
      { name: 'Trigger Point Therapy', duration: 60, price: 220 },
    ],
    why: 'Both work deeply on the neck and shoulder muscles to release knots and relieve tension.',
    why_ar: 'تستهدف هذه الجلسات عضلات الرقبة والكتفين بعمق لفك العقد العضلية وتخفيف التوتر.',
  },
  {
    keywords: [
      'stress', 'anxiety', 'anxious', 'overwhelmed', 'stressed out', 'burnout',
      'mental fatigue', 'tense', 'mental exhaustion', 'nervous', 'panic',
      'under pressure', 'too much pressure', 'mentally drained', 'mind tired',
      'قلق', 'توتر', 'ضغوط', 'تعب نفسي', 'إرهاق', 'مرهقة', 'متوترة', 'نفسيتي', 'تعبانة نفسيا', 'ضغوط العمل'
    ],
    services: [
      { name: 'Swedish Massage',  duration: 60, price: 200 },
      { name: 'Hot Stone Massage',duration: 90, price: 300 },
      { name: 'Herbal Massage',   duration: 75, price: 250 },
    ],
    why: 'These sessions are designed specifically for deep relaxation and calming the nervous system.',
    why_ar: 'مصممة خصيصاً للاسترخاء العميق وتهدئة الجهاز العصبي.',
  },
  {
    keywords: [
      'tired', 'fatigue', 'exhausted', 'exhaustion', 'no energy', 'body tired',
      'body ache', 'whole body', 'full body pain', 'low energy', 'drained',
      'run down', 'worn out', 'weak', 'physically tired', 'always tired',
      'متعب', 'متعبة', 'تعبان', 'تعبانه', 'ارهاق', 'مجهدة', 'مجهد', 'جهد', 'تعب جسمي'
    ],
    services: [
      { name: 'Swedish Massage', duration: 60, price: 200 },
      { name: 'Bamboo Massage',  duration: 90, price: 320 },
      { name: 'Herbal Massage',  duration: 75, price: 250 },
    ],
    why: 'Perfect for restoring energy and relieving overall body fatigue.',
    why_ar: 'مثالي لاستعادة الطاقة وتخفيف التعب العام للجسم.',
  },
  {
    keywords: [
      'muscle pain', 'sore muscles', 'muscle soreness', 'gym', 'workout',
      'sports injury', 'sports recovery', 'muscle stiff', 'after exercise',
      'after workout', 'after gym', 'athlete', 'training', 'exercise pain',
      'muscle cramp', 'cramps', 'physical activity',
      'الم عضلات', 'عضلاتي', 'جيم', 'تمرين', 'رياضة', 'شد عضلي', 'اصابة رياضية'
    ],
    services: [
      { name: 'Sports Massage',       duration: 60, price: 250 },
      { name: 'Deep Tissue Massage',  duration: 60, price: 250 },
    ],
    why: 'Ideal for active women — speeds up muscle recovery and reduces soreness after exercise.',
    why_ar: 'مثالي للنساء النشيطات — يسرع تعافي العضلات ويقلل الشعور بالألم بعد ممارسة الرياضة.',
  },
  {
    keywords: [
      'circulation', 'cold hands', 'cold feet', 'poor circulation', 'numbness',
      'tingling', 'blood flow', 'bad circulation', 'hands cold', 'feet cold',
      'دورة دموية', 'برودة', 'يدين باردة', 'قدمين باردة', 'تدفق الدم'
    ],
    services: [
      { name: 'Hot Stone Massage',          duration: 90, price: 300 },
      { name: 'Lymphatic Drainage Massage', duration: 60, price: 320 },
    ],
    why: 'Proven to boost circulation, warm the body, and improve blood flow.',
    why_ar: 'مثبت علمياً قدرته على تنشيط الدورة الدموية، تدفئة الجسم، وتحسين تدفق الدم.',
  },
  {
    keywords: [
      'swelling', 'water retention', 'puffy', 'bloated', 'lymph', 'detox',
      'drainage', 'edema', 'fluid retention', 'puffiness', 'swollen legs',
      'swollen feet', 'swollen hands',
      'تورم', 'انتفاخ', 'احتباس سوائل', 'سموم', 'تصريف لمفاوي', 'رجول متنفخة'
    ],
    services: [
      { name: 'Lymphatic Drainage Massage', duration: 60, price: 320 },
    ],
    why: 'Specifically designed to reduce swelling, flush toxins, and improve lymphatic flow.',
    why_ar: 'مصمم خصيصاً لتقليل التورم، طرد السموم، وتحسين التدفق اللمفاوي.',
  },
  {
    keywords: [
      'cellulite', 'skin texture', 'orange peel', 'dimples skin', 'bumpy skin',
      'skin bumps', 'thighs dimples',
    ],
    services: [
      { name: 'Cellulite Massage', duration: 60, price: 300 },
    ],
    why: 'Our targeted cellulite treatment visibly improves skin texture and tone.',
  },
  {
    keywords: [
      'pregnant', 'pregnancy', 'prenatal', 'expecting', 'first trimester',
      'second trimester', 'third trimester', 'with baby', 'baby bump',
      'expectant mother', 'expecting a baby',
      'حامل', 'فترة الحمل', 'حمال', 'حملي', 'بيبي', 'جنين'
    ],
    services: [
      { name: 'Prenatal Massage', duration: 60, price: 280 },
    ],
    why: 'Safe after the first trimester — specifically designed to ease pregnancy discomforts.',
    why_ar: 'آمنة تماماً بعد المرحلة الأولى من الحمل — ومصممة خصيصاً لتخفيف آلام الحمل.',
    warning: 'Please note this is suitable after the first trimester only.',
    warning_ar: 'يرجى العلم أن هذه الجلسة مناسبة فقط بعد انتهاء الثلاثة أشهر الأولى من الحمل.',
  },
  {
    keywords: [
      'postnatal', 'postpartum', 'after birth', 'after delivery', 'gave birth',
      'new mom', 'new mother', 'just delivered', 'recently gave birth',
      'after baby', 'recovering from birth', 'after c-section',
      'بعد الولادة', 'ولدت', 'نفاس', 'والدة جديدة', 'تعافي من الولادة'
    ],
    services: [
      { name: 'Postnatal Massage', duration: 60, price: 280 },
    ],
    why: 'Specifically formulated to support recovery and restore energy after childbirth.',
    why_ar: 'معد خصيصاً لدعم التعافي واستعادة الطاقة بعد الولادة.',
  },
  {
    keywords: [
      'stiff', 'stiffness', 'flexibility', 'stretching', 'stretch', 'tight muscles',
      'range of motion', 'inflexible', 'can\'t bend', 'body tight', 'joints stiff',
      'stiff joints', 'morning stiffness',
      'تصلب', 'مرونة', 'تمدد', 'شد عضلات', 'مفاصل', 'غير مرن'
    ],
    services: [
      { name: 'Thai Floor Massage', duration: 90, price: 280 },
    ],
    why: 'A floor-based technique combining massage with assisted stretching — great for improving flexibility.',
    why_ar: 'تقنية تعتمد على التمدد — رائعة لتحسين المرونة وفك العضلات المتصلبة.',
  },
  {
    keywords: [
      'knee pain', 'knee injury', 'leg pain', 'leg injury', 'hip pain',
      'hip injury', 'foot pain', 'ankle pain', 'arm pain', 'wrist pain',
      'elbow pain', 'body injury', 'injured', 'joint pain', 'chronic pain',
      'pain all over', 'body in pain', 'pain relief', 'ache all over',
      'الم ركبة', 'الم رجل', 'الم ورك', 'الم قدم', 'الم مفاصل', 'الم في كل جسمي', 'مسكن الام'
    ],
    services: [
      { name: 'Deep Tissue Massage',   duration: 60, price: 250 },
      { name: 'Trigger Point Therapy', duration: 60, price: 220 },
      { name: 'Sports Massage',        duration: 60, price: 250 },
    ],
    why: 'These treatments work deeply on the affected area to relieve pain, reduce tension, and support recovery.',
    why_ar: 'تعمل هذه العلاجات بعمق على المناطق المصابة لتخفيف الألم وتقليل التوتر ودعم التعافي.',
  },
  {
    keywords: [
      'relax', 'relaxation', 'pamper', 'pampering', 'self care', 'self-care',
      'treat myself', 'unwind', 'de-stress', 'destress', 'wind down',
      'feel good', 'me time', 'spoil myself', 'chill', 'calm down',
    ],
    services: [
      { name: 'Swedish Massage', duration: 60, price: 200 },
      { name: 'Herbal Massage',  duration: 75, price: 250 },
      { name: 'Bamboo Massage',  duration: 90, price: 320 },
    ],
    why: 'These are our most popular relaxation treatments — a perfect way to pamper yourself.',
  },
];

// Check if text mentions a health condition.
// Returns { reply: string, serviceNames: string[] } or null.
async function getConditionRecommendation(lower, name, services, lang = 'en') {
  // Try DB-driven health recommendations first
  try {
    const dbRec = await healthRecService.matchRecommendation(lower, lang);
    if (dbRec) {
      return await buildDbRecommendationReply(dbRec, name, services, lang);
    }
  } catch (err) {
    console.error('[REC] DB recommendation lookup failed:', err.message);
  }
  // Fallback to hardcoded CONDITIONS
  const match = CONDITIONS.find(c => c.keywords.some(k => lower.includes(k)));
  if (!match) return null;

  const isAr = lang === 'ar';
  const greeting = name ? (isAr ? `${name}، ` : `${name}, `) : '';
  const opener = isAr
    ? pick([
        `${greeting}يسعدني أنك ذكرت ذلك — دعني أساعدك في اختيار الجلسة المناسبة.`,
        `${greeting}أفهمك — إليك ما أوصي به لك.`,
        `${greeting}رائع أنك شاركت ذلك — لدينا بالضبط ما تحتاجين إليه.`,
      ])
    : pick([
        `${greeting}I'm glad you mentioned that — let me help you find the right treatment.`,
        `${greeting}I understand — here's what I recommend for you.`,
        `${greeting}Great that you shared that — we have exactly what you need.`,
      ]);

  let msg = `${opener}\n\n`;

  // Filter and enrich matched services with real data
  if (!match.services) {
    console.error(`ERROR: Condition matched but missing services array: ${JSON.stringify(match.keywords)}`);
    return null;
  }
  const matchedServices = match.services.map(ms => services.find(s => s.name === ms.name)).filter(Boolean);

  if (matchedServices.length === 0) return null;

  if (matchedServices.length === 1) {
    const s = matchedServices[0];
    const sName = isAr ? (s.name_ar || s.name) : s.name;
    msg += `*${sName}* — ${s.duration_minutes} ${isAr ? 'دقيقة' : 'min'} — ${s.price} ${isAr ? 'ريال' : 'SAR'}\n\n`;
    msg += isAr ? `هذه الجلسة فعالة جداً لـ ${match.why_ar || match.why}` : `${match.why}`;
    if (match.warning) msg += `\n\n${isAr ? (match.warning_ar || match.warning) : match.warning}`;
    msg += `\n\n${isAr ? 'اردي بـ *1* للحجز، أو *0* لمشاهدة جميع الخدمات.' : 'Reply *1* to book this, or *0* to see all services.'}`;
  } else {
    msg += isAr ? `أفضل الخيارات لك:\n` : `Top picks for you:\n`;
    matchedServices.forEach((s, i) => {
      const sName = isAr ? (s.name_ar || s.name) : s.name;
      msg += `${i + 1}. *${sName}* — ${s.duration_minutes} ${isAr ? 'دقيقة' : 'min'} — ${s.price} ${isAr ? 'ريال' : 'SAR'}\n`;
    });
    msg += `\n${isAr ? `هذه الجلسات مصممة لـ ${match.why_ar || match.why}` : `${match.why}`}`;
    if (match.warning) msg += `\n\n${isAr ? (match.warning_ar || match.warning) : match.warning}`;
    msg += `\n\n${isAr ? `اردي بـ *1*، *2*${matchedServices.length >= 3 ? ' أو *3*' : ' أو *2*'} للحجز، أو *0* لمشاهدة جميع الخدمات.` : `Reply *1*, *2*${matchedServices.length >= 3 ? ', or *3*' : ' or *2*'} to book, or *0* to see all services.`}`;
  }

  return { reply: msg, serviceIds: matchedServices.map(s => s.id) };
}

// ─── Build recommendation reply from DB record ──────────────────────────────

async function buildDbRecommendationReply(dbRec, name, services, lang = 'en') {
  const isAr = lang === 'ar';
  const greeting = name ? (isAr ? `${name}، ` : `${name}, `) : '';
  
  const opener = isAr
    ? pick([`${greeting}يسعدني أنك ذكرت ذلك — دعني أساعدك في اختيار الجلسة المناسبة.`,
            `${greeting}أفهمك — إليك ما أوصي به لك.`,
            `${greeting}رائع أنك شاركت ذلك — لدينا بالضبط ما تحتاجين إليه.`])
    : pick([`${greeting}I'm glad you mentioned that — let me help you find the right treatment.`,
            `${greeting}I understand — here's what I recommend for you.`,
            `${greeting}Great that you shared that — we have exactly what you need.`]);

  let msg = `${opener}

`;

  const matchedServices = (dbRec.services || []).filter(Boolean);
  if (matchedServices.length === 0) return null;

  if (matchedServices.length === 1) {
    const s = matchedServices[0];
    const sName = isAr ? (s.name_ar || s.name) : s.name;
    msg += `*${sName}* — ${s.duration_minutes} ${isAr ? 'دقيقة' : 'min'} — ${s.price} ${isAr ? 'ريال' : 'SAR'}

`;
    msg += isAr ? (dbRec.why_ar || dbRec.why_en) : dbRec.why_en;
    if (dbRec.warning_en) msg += `

${isAr ? (dbRec.warning_ar || dbRec.warning_en) : dbRec.warning_en}`;
    msg += `

${isAr ? 'اردي بـ *1* للحجز، أو *0* لمشاهدة جميع الخدمات.' : 'Reply *1* to book this, or *0* to see all services.'}`;
  } else {
    msg += isAr ? 'أفضل الخيارات لك:\
' : 'Top picks for you:\
';
    matchedServices.forEach((s, i) => {
      const sName = isAr ? (s.name_ar || s.name) : s.name;
      msg += `${i + 1}. *${sName}* — ${s.duration_minutes} ${isAr ? 'دقيقة' : 'min'} — ${s.price} ${isAr ? 'ريال' : 'SAR'}
`;
    });
    msg += `
${isAr ? (dbRec.why_ar || dbRec.why_en) : dbRec.why_en}`;
    if (dbRec.warning_en) msg += `

${isAr ? (dbRec.warning_ar || dbRec.warning_en) : dbRec.warning_en}`;
    msg += `

${isAr ? 'اردي بـ *1*، *2* أو *3* للحجز، أو *0* لمشاهدة جميع الخدمات.' : 'Reply *1*, *2*, or *3* to book, or *0* to see all services.'}`;
  }

  return { reply: msg, serviceIds: matchedServices.map(s => s.id) };
}

// ─── "Best service" / general recommendation request ─────────────────────────

const BEST_SERVICE_PHRASES = [
  'best service', 'best massage', 'best one', 'the best one',
  'which service', 'which massage',
  'what service', 'what massage', 'recommend a service', 'recommend a massage',
  'what do you recommend', 'what would you recommend', 'what should i book',
  'what should i get', 'help me choose', 'not sure what', "don't know what",
  'not sure which', 'which one', 'which one to pick', 'which one should',
  'suggest a service', 'suggest a massage', 'suggest the best', 'suggest best',
  'do you suggest', 'can you suggest', 'any suggestion', 'any recommendation',
  'what is good', "what's good", 'which one is good', 'which is best',
  'what is the best', 'not sure which to pick', 'not sure which one', 'unsure which',
  'good one', 'right one', 'right service',
];

function isBestServiceQuestion(lower) {
  return BEST_SERVICE_PHRASES.some(p => lower.includes(p));
}

function getBestServiceGuide(name, services, lang = 'en') {
  const isAr = lang === 'ar';
  const greeting = name ? (isAr ? `${name}، ت` : `${name}, t`) : (isAr ? 'ت' : 'T');

  const getSvc = (name) => {
    const s = services.find(sv => sv.name === name);
    if (!s) return name;
    const sName = isAr ? (s.name_ar || s.name) : s.name;
    return `${sName} (${s.price} ${isAr ? 'ريال' : 'SAR'})`;
  };

  if (isAr) {
    return (
      `${greeting}عتمد الخدمة الأفضل حقاً على ما تحتاجين إليه.\n\n` +
      `إليك دليل سريع:\n\n` +
      `*الاسترخاء وتخفيف التوتر*\n` +
      `← ${getSvc('Swedish Massage')}, ${getSvc('Herbal Massage')}, ${getSvc('Hot Stone Massage')}\n\n` +
      `*تخفيف الألم — الظهر، الرقبة، الأكتاف*\n` +
      `← ${getSvc('Deep Tissue Massage')}, ${getSvc('Trigger Point Therapy')}\n\n` +
      `*تعب الجسم وتجديد النشاط*\n` +
      `← ${getSvc('Bamboo Massage')}, ${getSvc('Herbal Massage')}\n\n` +
      `*التعافي الرياضي وآلام العضلات*\n` +
      `← ${getSvc('Sports Massage')}, ${getSvc('Deep Tissue Massage')}\n\n` +
      `*التخلص من السموم والدورة الدموية*\n` +
      `← ${getSvc('Lymphatic Drainage Massage')}, ${getSvc('Hot Stone Massage')}\n\n` +
      `فقط أخبريني بما تشعرين به أو ما تبحثين عنه — وسأوجهك إلى الجلسة المناسبة تماماً.\n\n` +
      `أو أرسلي *1* لمشاهدة جميع الخدمات مع كامل التفاصيل.`
    );
  }

  return (
    `${greeting}he best service really depends on what you need.\n\n` +
    `Here's a quick guide:\n\n` +
    `*Relaxation & stress relief*\n` +
    `→ ${getSvc('Swedish Massage')}, ${getSvc('Herbal Massage')}, ${getSvc('Hot Stone Massage')}\n\n` +
    `*Pain relief — back, neck, shoulders*\n` +
    `→ ${getSvc('Deep Tissue Massage')}, ${getSvc('Trigger Point Therapy')}\n\n` +
    `*Body fatigue & full-body refresh*\n` +
    `→ ${getSvc('Bamboo Massage')}, ${getSvc('Herbal Massage')}\n\n` +
    `*Sports recovery & muscle soreness*\n` +
    `→ ${getSvc('Sports Massage')}, ${getSvc('Deep Tissue Massage')}\n\n` +
    `*Detox & circulation*\n` +
    `→ ${getSvc('Lymphatic Drainage Massage')}, ${getSvc('Hot Stone Massage')}\n\n` +
    `Just tell me what you are feeling or what you are after — and I will point you to exactly the right one.\n\n` +
    `Or reply *1* to see all services with full details.`
  );
}

// Steps where we should NOT intercept with health recommendations
// (user is mid-booking — don't pull them out of the flow)
const BOOKING_IN_PROGRESS_STEPS = new Set([
  'gift_details', 'booking_type', 'booking_location',
  'booking_day_confirm', 'booking_time_select',
  'booking_summary', 'booking_date', 'booking_date_duplicate_confirm', 'booking_time',
  'booking_duplicate_confirm',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns tomorrow's date as YYYY-MM-DD (UTC)
function getTomorrow() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

// Returns today's date as YYYY-MM-DD (local)
function getToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Scan free-text for a time mention (e.g. "11 pm", "3:30 am", "4 م")
// Returns HH:MM:00 string or null
function extractTimeFromTextPattern(text) {
  if (!text) return null;
  const tmRegex = /\b(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm|a\.m\.|p\.m\.|ص|م)\b/i;
  const matchTime = text.match(tmRegex);
  if (matchTime) {
    let h = parseInt(matchTime[1], 10);
    let m = matchTime[2] || '00';
    let p = matchTime[3].toLowerCase().replace(/\./g, '');
    if (p === 'pm' || p === 'م') {
      if (h < 12) h += 12;
    } else if (p === 'am' || p === 'ص') {
      if (h === 12) h = 0;
    }
    return `${String(h).padStart(2,'0')}:${m}:00`;
  }
  return null;
}

// Scan free-text for a date mention (e.g. "I want 28 feb" → "2026-02-28")
// Also handles relative keywords: today, tomorrow, آج, کل
// Returns YYYY-MM-DD string or null
function extractDateFromText(text) {
  const lower = text.toLowerCase();

  // Relative keywords
  if (/\btoday\b|\baaj\b|آج/.test(lower))     return getToday();
  if (/\btomorrow\b|\bkal\b|\bkl\b|کل/.test(lower)) return getTomorrow();

  // Pattern 1: "28 feb", "28th february", "28feb", "8 أبريل"
  const dayFirst = /(\d{1,2})(?:st|nd|rd|th)?\s*([a-zA-Z]{3,}|[\u0600-\u06FF]{3,})/g;
  // Pattern 2: "feb 28", "february 28th", "أبريل 8"
  const monthFirst = /([a-zA-Z]{3,}|[\u0600-\u06FF]{3,})\s+(\d{1,2})(?:st|nd|rd|th)?/g;

  let m;
  while ((m = dayFirst.exec(text)) !== null) {
    const candidate = `${m[1]} ${m[2]}`;
    const parsed = tryParseDate(candidate);
    if (parsed) return parsed;
  }
  while ((m = monthFirst.exec(text)) !== null) {
    const candidate = `${m[1]} ${m[2]}`;
    const parsed = tryParseDate(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function extractTimeFromTextPattern(text) {
  if (!text) return null;
  // Match patterns like "11 pm", "11:30 PM", "3 pm", "11 م", "3:30 ص"
  const timePattern = /\b(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm|a\.m\.|p\.m\.|ص|م)\b/i;
  const match = text.match(timePattern);
  if (!match) return null;

  let hour = parseInt(match[1]);
  const minute = match[2] || "00";
  const ampm = match[3].toLowerCase();

  if ((ampm.includes('p') || ampm === 'م') && hour < 12) hour += 12;
  if ((ampm.includes('a') || ampm === 'ص') && hour === 12) hour = 0;

  return `${String(hour).padStart(2, '0')}:${minute}:00`;
}

function extractLocationTypeFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes('home') || lower.includes('منزل') || lower.includes('house') || lower.includes('زيارة')) return 'home';
  if (lower.includes('center') || lower.includes('مركز') || lower.includes('branch')) return 'center';
  return null;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

// Strip Arabic diacritics (tashkeel/harakat) and normalize alef variants so
// that e.g. "أهلاً" matches the keyword "اهلا" regardless of hamza or tanwin.
function normalizeArabic(str) {
  return str
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel + superscript alef
    .replace(/[أإآٱ]/g, 'ا');              // normalize alef variants → bare alef
}

async function handleMessage(phone, msgData) {
  // Normalize: accept plain string (tests) or object (webhook)
  const isLocation = typeof msgData === 'object' && msgData.type === 'location';
  const text  = isLocation ? '' : (typeof msgData === 'string' ? msgData : (msgData.text || '')).trim();
  const lower = normalizeArabic(text.toLowerCase());

  const locationPin = isLocation ? {
    latitude:  msgData.latitude,
    longitude: msgData.longitude,
    name:      msgData.name    || '',
    address:   msgData.address || '',
    maps_url:  msgData.latitude
      ? `https://maps.google.com/maps?q=${msgData.latitude},${msgData.longitude}&z=15&t=h`
      : null,
  } : null;

  // ── 0. Provider check — process therapist status updates ────────────────
  const fromProvider = await isProviderPhone(phone);
  if (fromProvider) {
    // If provider says "done" etc, mark their current booking as complete
    if (DONE_KEYWORDS.some(k => lower.includes(k))) {
      const therapist = await getTherapistByPhone(phone);
      if (therapist) {
        const completedBooking = await findAndCompleteActiveBooking(therapist.id);
        if (completedBooking) {
          console.log(`[STATUS] Provider ${therapist.full_name} completed booking for ${completedBooking.customer_name}`);
          // Trigger rating request directly (don't rely on webhook for this path)
          if (completedBooking.customer_phone && completedBooking.customer_id) {
            const customerChatId = `${normalizeToWaId(completedBooking.customer_phone)}@c.us`;
            const providerTemplates = templates.forLang('en');
            sendMessage(customerChatId, providerTemplates.askRating(completedBooking.customer_name, {
              serviceName: completedBooking.service_name,
              date:        completedBooking.booking_date,
              time:        completedBooking.start_time,
            })).catch(() => {});
            updateSession(completedBooking.customer_id, 'booking_rating', {
              rating_booking_id:   completedBooking.id,
              rating_therapist_id: completedBooking.therapist_id,
            }).catch(() => {});
          }
          return `Thank you, ${therapist.full_name}! The booking for *${completedBooking.customer_name}* (${completedBooking.service_name}) has been marked as *completed*.`;
        }
      }
    }
    console.log(`[SKIP] ${phone} is a registered provider — ignoring message: "${text}"`);
    return null;
  }


  // ── 0b. Release any expired slot holds ──────────────────────────────────
  await releaseExpiredHolds();

  // ── 1. Customer ──────────────────────────────────────────────────────────
  const { customer } = await getOrCreateCustomer(phone);
  const name = customer.full_name || '';

  // ── 2. Log incoming (Handled in webhook) ──────────────────────────────────

  // ── 3. Session ───────────────────────────────────────────────────────────
  const session     = await getOrCreateSession(customer.id);
  const step        = session.current_step;
  const sessionData = session.session_data || {};

  // ── 3a. Door/location image capture ──────────────────────────────────────
  // Stage 2: preserve the original WhatsApp message id for door/location images.
  // The full door-photo workflow is wired in a later stage; this gate only stores
  // the provider-forwardable messageId when the session is explicitly expecting it.
  const isIncomingImage = typeof msgData === 'object' && msgData.has_media && msgData.media_type === 'image' && msgData.whatsapp_message_id;
  const expectsDoorImage = Boolean(sessionData.awaiting_door_photo) || step === 'booking_door_photo';
  if (isIncomingImage) {
    if (!expectsDoorImage) {
      return `I'm sorry, I'm unable to view images at this time. Could you please *type* your request or question instead?`;
    }

    const artifact = await saveIncomingMediaArtifact({
      customerId: customer.id,
      bookingId: sessionData.booking_id || sessionData.confirmed_booking_id || sessionData.updating_booking_id || null,
      locationId: sessionData.location_id || null,
      messageId: msgData.whatsapp_message_id,
      chatId: msgData.chat_id || null,
      mediaType: msgData.media_type,
      purpose: 'door_image',
      caption: msgData.caption || null,
      metadata: {
        source: 'whatsapp_webhook',
        step,
        location_type: sessionData.location_type || null,
      },
    });

    await updateSession(customer.id, step, {
      latest_door_image_artifact_id: artifact.id,
      latest_door_image_message_id: artifact.message_id,
      latest_door_image_chat_id: artifact.chat_id,
      latest_door_image_captured_at: artifact.created_at,
      awaiting_door_photo: false,
    });

    return `Thank you — I saved the door photo for this booking.`;
  }

  // ── 3b. Language detection ───────────────────────────────────────────────
  // Detect Arabic from current message; persist choice in session so all
  // subsequent replies stay in the same language even for number-only input.
  const hasArabicChars = /[\u0600-\u06FF]/.test(text);
  let lang = sessionData.lang || 'en';
  if (!isLocation && hasArabicChars && lang !== 'ar') {
    lang = 'ar';
    // Persist language without clearing other session data
    await updateSession(customer.id, step, { ...sessionData, lang: 'ar' });
  } else if (!isLocation && !hasArabicChars && text.length > 1 && /[a-zA-Z]/.test(text) && lang !== 'en') {
    // User switched back to English
    lang = 'en';
    await updateSession(customer.id, step, { ...sessionData, lang: 'en' });
  }
  // Set the request-scoped template object
  const t = templates.forLang(lang);

  // ── 3c. Referral code/status handler ───────────────────────────────────────
  if (!isLocation) {
    const enteredReferralCode = extractReferralEntry(text, lower);
    if (enteredReferralCode) {
      const referralResult = await recordReferralCodeUse({ referredCustomerId: customer.id, code: enteredReferralCode });
      const referralReply = referralRecordedText(referralResult, lang);
      await logMessage(phone, referralReply, 'outgoing', customer.id);
      return referralReply;
    }
    if (wantsReferralStatus(text, lower)) {
      const referralStatus = await getReferralStatus(customer.id);
      const referralReply = referralStatusText(referralStatus, lang);
      await logMessage(phone, referralReply, 'outgoing', customer.id);
      return referralReply;
    }
  }

  // ── 4. Global Greetings Detection ──────────────────────────────────────────
  const SALAM_KEYWORDS = [
    'سلام', 'السلام عليكم', 'اهلا',
    'salam', 'salaam', 'salam alaikum', 'salam allaikum', 'salamu alaikum',
    'assalam', 'assalamu alaikum', 'as-salam', 'alsalam',
  ];
  const containsSalam = SALAM_KEYWORDS.some(k => lower.includes(k));
  const salamPrefix = containsSalam
    ? (lang === 'ar' ? `وعليكم السلام \n\n` : `Wa Alaikum Assalam \n\n`)
    : '';

  // ── 5. Global Intent Matching (Resilience for AI Timeouts) ─────────────────
  // These keywords trigger the booking flow from ANY state if the user hasn't 
  // explicitly provided their name yet, or if they are in the Main Menu.
  const isBookingIntent = ['حجز', 'احجز', 'book', 'appointment', 'booking', 'available', 'availability', 'empty', 'free', 'متاح', 'متوفر', 'فاضي', 'وقت'].some(kw => lower.includes(kw));
  const isServicesIntent = ['خدمة', 'خدمات', 'عرض', 'service', 'browse'].some(kw => lower.includes(kw));

  // ── 6. Menu keywords handler (Priority 1) ──────────────────────────────────
  if (!isLocation && MENU_KEYWORDS.includes(lower)) {
    let reply;
    if (!name) {
      await updateSession(customer.id, 'asking_name');
      reply = salamPrefix + await getWelcomeNewReply(lang, t);
    } else {
      await resetSession(customer.id);
      const isGreetingOnly = [
        'hi','hello','hey','مرحبا','هاي','السلام عليكم','اهلا','سلام',
        'salam','salaam','salam alaikum','salam allaikum','salamu alaikum',
        'assalam','assalamu alaikum','as-salam','alsalam',
        'ahlan','ahlan wa sahlan','marhaba','marhab',
      ].includes(lower);
      const baseReply = isGreetingOnly ? await getWelcomeBackReply(name, lang, t) : await getMainMenuReply(lang, t);
      reply = salamPrefix + baseReply;
    }
    await logMessage(phone, reply, 'outgoing', customer.id);
    return reply;
  }

  // ── 4b. Language preference acknowledgement ──────────────────────────────────
  // If user explicitly says they want to speak Arabic (and language is now set to ar),
  // respond with a warm Arabic confirmation instead of sending to Ollama.
  if (!isLocation && lang === 'ar' && hasArabicChars && step === 'main_menu') {
    const langAckKeywords = ['اتحدث بالعربي', 'تكلم عربي', 'بالعربي', 'عربي', 'عربية'];
    if (langAckKeywords.some(k => lower.includes(k))) {
      const menuReply = await getMainMenuReply(lang, t);
      const reply = name
        ? `بالطبع ${name}! يسعدني مساعدتك بالعربي \n\n${menuReply}`
        : `بالطبع! يسعدني مساعدتك بالعربي \n\n${menuReply}`;
      await logMessage(phone, reply, 'outgoing', customer.id);
      return reply;
    }
  }

  // ── 5. Human agent request ───────────────────────────────────────────────────
  if (!isLocation && wantsHumanAgent(lower)) {
    const agentReply = await contactHumanAgent(phone, name, customer, lang);
    await logMessage(phone, agentReply, 'outgoing', customer.id);
    return agentReply;
  }

  // ── 6. Health condition / best-service check (before step handler, not mid-booking) ──
  if (!isLocation && !BOOKING_IN_PROGRESS_STEPS.has(step)) {
    const allServicesRec = await getAllServices();

    // Specific condition → targeted recommendation + save services to session
    const recResult = await getConditionRecommendation(lower, name, allServicesRec, lang);
    if (recResult) {
      // Use the found services for the next step picker
      const recServices = recResult.serviceIds
        .map(id => allServicesRec.find(s => s.id === id))
        .filter(Boolean)
        .map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration_minutes }));

      await updateSession(customer.id, 'recommendation_select', {
        recommended_service_ids: recResult.serviceIds,
        last_rec_reply:          recResult.reply
      });
      await logMessage(phone, recResult.reply, 'outgoing', customer.id);
      return recResult.reply;
    }
    // Generic "what's best / recommend" → show category guide (no step change — user needs to describe more)
    if (isBestServiceQuestion(lower)) {
      const guide = getBestServiceGuide(name, allServicesRec, lang);
      await logMessage(phone, guide, 'outgoing', customer.id);
      return guide;
    }
  }

  // ── 7. My bookings — global, works from any step ─────────────────────────
  let reply;

  if (!isLocation && isBookingHistoryRequest(lower)) {
    const bookings = await getCustomerBookings(customer.id);
    if (!bookings.length) {
      reply = t.noBookings();
    } else {
      const histLines = bookings.map((b, i) => {
        const rawDate = b.booking_date;
        const isoDate = rawDate
          ? (rawDate instanceof Date
              ? `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, '0')}-${String(rawDate.getDate()).padStart(2, '0')}`
              : String(rawDate).substring(0, 10))
          : null;
        const dateStr   = isoDate ? formatDateDisplay(isoDate) : 'TBD';
        const timeStr   = b.start_time ? formatTime12h(String(b.start_time).substring(0, 5)) : 'TBD';
        const type      = b.location_type;
        const address   = b.address || (b.location_type === 'center' ? (lang === 'ar' ? 'المركز (حي الخليج)' : 'Center (Khaleej District)') : null);
        
        return t.bookingHistoryItem({
          num:      i + 1,
          status:   b.status,
          service:  b.service_name,
          date:     dateStr,
          time:     timeStr,
          type,
          address:  address ? address.split(',').slice(0, 2).join(',').trim() : null,
          therapist: b.therapist_name,
          rating:   b.rating,
        });
      });
      reply = t.bookingHistoryHeader(name) +
              `${LINE}\n` +
              histLines.join('\n─────────────────\n') +
              t.bookingHistoryFooter();
    }
    await logMessage(phone, reply, 'outgoing', customer.id);
    return reply;
  }

  // ── 7a. Google Maps URL Interceptor ───────────────────────────────────────
  // Some WhatsApp clients send a text URL alongside a location pin.
  // Others (manual users) send JUST the URL. We only accept the PIN.
  if (!isLocation && msgData.type === 'text') {
    const t_link = lower.trim();
    if (
      t_link.startsWith('https://maps.google.com') ||
      t_link.startsWith('https://www.google.com/maps') ||
      t_link.startsWith('https://goo.gl/maps') ||
      t_link.startsWith('https://maps.app.goo.gl')
    ) {
      // If we are at a location-awaiting step, send the explicit warning.
      if (step === 'booking_location' || step === 'update_location_confirm') {
        const warning = t.linkNotAccepted();
        await logMessage(phone, warning, 'outgoing', customer.id);
        return warning;
      }
      // For any other step, just ignore it. Redundant links from Desktop/Web clients 
      // are common after a pin and would lead to weird AI replies.
      console.log(`[SKIP] Redundant Maps URL ignored at step: ${step}`);
      return null;
    }
  }

  // ── 8. Manage booking — reschedule / cancel / update ─────────────────────
  // Skip this interceptor when the customer is already mid-booking flow —
  // "change date", "change time" etc. are in-flow corrections handled by the step itself.
  const IN_FLOW_STEPS = new Set([
    'gift_details', 'booking_type', 'booking_location', 'booking_day_confirm',
    'booking_time_select', 'booking_summary', 'booking_duplicate_confirm',
    'booking_date', 'booking_time', 'booking_date_duplicate_confirm',
    'update_field_select', 'update_location_confirm',
  ]);

  if (!isLocation && !reply && !IN_FLOW_STEPS.has(step) && (isUpdateBookingRequest(lower) || isCancelBookingRequest(lower))) {
    const mode = isCancelBookingRequest(lower) ? 'cancel' : 'update';

    const bookings = await getReschedulableBookings(customer.id);
    if (!bookings.length) {
      reply = t.noReschedulableBookings(mode);
    } else {
      const items = bookings.map((b, i) => normBookingItem(b, i));
      await updateSession(customer.id, 'manage_booking_select', {
        manage_mode:       mode,
        manage_booking_ids: bookings.map(b => b.id),
      });
      reply = t.manageBookingList(items, mode);
    }
    await logMessage(phone, reply, 'outgoing', customer.id);
    return reply;
  }

  // ── 8b. Global shortcut: "5" → human agent from any non-numbered step ───────
  // Allows customers who see the timeout message hint ("send 5 for human") to reach
  // an agent regardless of which step they are currently on.
  // Excluded: steps where 5 is a valid numbered choice (service/slot/rating pickers).
  const NUMBERED_STEPS = new Set([
    'services_list', 'select_service', 'booking_rating',
    'booking_time_select', 'manage_booking_select', 'recommendation_select',
  ]);
  if (!isLocation && text === '5' && !NUMBERED_STEPS.has(step)) {
    const agentReply = await contactHumanAgent(phone, name, customer, lang);
    await logMessage(phone, salamPrefix + agentReply, 'outgoing', customer.id);
    return salamPrefix + agentReply;
  }

  // ── 8c. Intent Catch-all (Priority 2) ──────────────────────────────────
  // If the AI is down or the user sends a booking intent, we jump to booking logic regardless of current step.
  // (Exceptions: during very specific feedback or location sharing steps where we want to stick to the task)
  const IGNORE_GLOBAL_INTENTS = new Set(['booking_location', 'booking_rating', 'booking_feedback']);
  if (!isLocation && (isBookingIntent || isServicesIntent) && !IGNORE_GLOBAL_INTENTS.has(step)) {
    let reply;
    if (!name) {
      const welcomeMsg = await getWelcomeNewReply(lang, t);
      reply = (lang === 'ar' 
        ? `أهلاً بك! يسعدني مساعدتك في الحجز. ما هو اسمك الكريم لنبدأ؟ ✨` 
        : `Welcome! I'd love to help you with your booking. May I have your name first to get started? ✨`) + `\n\n${LINE}\n` + welcomeMsg;
    } else {
      // User has a name but we were stuck in asking_name? Move to main menu logic.
      await updateSession(customer.id, 'main_menu');
      // Fall through to switch(step) will now happen with step=main_menu... 
      // Actually, it's easier to just handle it here.
      reply = await showCatalogForSession(customer.id, 'book', lang);
    }
    await logMessage(phone, salamPrefix + reply, 'outgoing', customer.id);
    return salamPrefix + reply;
  }

  // ── 9. Step handler ──────────────────────────────────────────────────────
  switch (step) {

    // ── welcome ──────────────────────────────────────────────────────────────
    case 'welcome': {
      if (!name) {
        // Check if they introduced themselves on first message: "my name is X"
        const introName = text ? extractNameFromIntro(text) : null;
        if (introName) {
          await updateCustomerName(customer.id, introName);
          await updateSession(customer.id, 'main_menu');
          reply = await getGreetingWithMenuReply(introName, lang, t);
        } else {
          await updateSession(customer.id, 'asking_name');
          // If they sent a question, answer it first then ask for name
          if (text && !looksLikeAName(text)) {
            reply = await aiReply(text, 'asking_name', '', customer.id, lang);
          } else {
            reply = await getWelcomeNewReply(lang, t);
          }
        }
      } else {
        await resetSession(customer.id);
        reply = await getWelcomeBackReply(name, lang, t);
      }
      break;
    }

    // ── asking_name ──────────────────────────────────────────────────────────
    case 'asking_name': {
      // Try to extract name from introductions: "my name is X", "I am X", "I'm X"
      const extracted = extractNameFromIntro(text);
      if (extracted) {
        await updateCustomerName(customer.id, extracted);
        await updateSession(customer.id, 'main_menu');
        reply = await getGreetingWithMenuReply(extracted, lang, t);
        break;
      }
      // Accept plain name (not a question or long sentence)
      if (!text || text.length < 2 || !looksLikeAName(text)) {
        reply = await aiReply(text, 'asking_name', '', customer.id, lang);
        break;
      }
      await updateCustomerName(customer.id, text);
      await updateSession(customer.id, 'main_menu');
      reply = await getGreetingWithMenuReply(text, lang, t);
      break;
    }

    // ── main_menu ─────────────────────────────────────────────────────────────
    case 'main_menu': {
      switch (text) {
        case '1': {
          reply = await showCatalogForSession(customer.id, 'browse', lang);
          break;
        }
        case '2': {
          reply = await showCatalogForSession(customer.id, 'book', lang);
          break;
        }
        case '3': {
          const hours = await getBusinessHours();
          reply = t.businessHours(hours);
          break;
        }
        case '4': {
          // Try DB-backed FAQ first, fall back to hardcoded
          const dbFaq = await faqService.buildFaqMessage(lang);
          if (dbFaq) {
            reply = dbFaq;
          } else {
            reply = t.faq();
          }
          break;
        }
        case '5': {
          reply = await contactHumanAgent(phone, name, customer, lang);
          break;
        }
        default: {
          // If the user mentions a specific service name, jump straight to it.
          const allServicesExt = await getAllServices();
          const specificService = findServiceInText(lower, allServicesExt);
          if (specificService) {
             const prefilledDate = extractDateFromText(text);
             const prefilledTime = extractTimeFromTextPattern(text);
             const prefilledLoc  = extractLocationTypeFromText(text);

             await updateSession(customer.id, 'gift_details', {
                selected_service_id:       specificService.id,
                selected_service_name:     specificService.name,
                selected_service_price:    specificService.price,
                selected_service_duration: specificService.duration_minutes,
                prefilled_date:            prefilledDate,
                prefilled_time:            prefilledTime,
                prefilled_location_type:   prefilledLoc
             });
             const intro = await aiReply(text, '', name, customer.id, lang);
             
             if (prefilledLoc === 'home') {
               await updateSession(customer.id, 'booking_location', { location_type: 'home' });
               const savedLocation = await getDefaultLocation(customer.id);
               reply = intro + '\n\n' + t.connectorSure() + t.askLocation(savedLocation ? savedLocation.address : null);
               break;
             } else if (prefilledLoc === 'center') {
                const availability = await findNextAvailableDay(specificService.id, 'Khaleej', 'center', prefilledDate || getToday(), 14);
                if (availability) {
                   await updateSession(customer.id, 'booking_day_confirm', {
                     location_type: 'center', district: 'Khaleej', address: 'Center (Riyadh)',
                     suggested_date: availability.date, suggested_date_display: availability.dateDisplay,
                     therapist_id: availability.therapistId, therapist_name: availability.therapistName, available_slots: availability.slots,
                   });
                   reply = intro + '\n\n' + t.connectorSure() + t.askDayConfirm(availability.dateDisplay);
                   break;
                }
             }

             reply = intro + '\n\n' + t.askGiftDetails();
             break;
          }

          // Intent matching for common keywords (Arabic/English) skipped AI if broad enough
          if (['خدمة', 'خدمات', 'عرض', 'service', 'browse'].some(kw => lower.includes(kw))) {
            const prefilledDate = extractDateFromText(text);
            const prefilledTime = extractTimeFromTextPattern(text);
            const listText = await showCatalogForSession(customer.id, 'browse', lang, null, {
               prefilled_date: prefilledDate,
               prefilled_time: prefilledTime
            });
            if (text.split(' ').length > 2) {
              const intro = await aiReply(text, '', name, customer.id, lang);
              reply = intro + '\n\n' + listText;
            } else {
              reply = listText;
            }
          } else if (['حجز', 'احجز', 'book', 'appointment', 'booking', 'available', 'availability', 'empty', 'free', 'متاح', 'متوفر', 'فاضي', 'وقت'].some(kw => lower.includes(kw))) {
            const prefilledDate = extractDateFromText(text);
            const prefilledTime = extractTimeFromTextPattern(text);
            const listText = await showCatalogForSession(customer.id, 'book', lang, null, {
              prefilled_date: prefilledDate || null,
              prefilled_time: prefilledTime || null,
            });
            if (text.split(' ').length > 2) {
              const intro = await aiReply(text, '', name, customer.id, lang);
              reply = intro + '\n\n' + listText;
            } else {
              reply = listText;
            }
          } else if (['باقة', 'باقات', 'package'].some(kw => lower.includes(kw))) {
            const packages = await getAllPackages();
            const listText = t.packagesList(packages);
            if (text.split(' ').length > 2) {
              const intro = await aiReply(text, '', name, customer.id, lang);
              reply = intro + '\n\n' + listText;
            } else {
              reply = listText;
            }
          } else if (['ساعة', 'ساعات', 'وقت عمل', 'business hour', 'hours', 'opening'].some(kw => lower.includes(kw))) {
            const hours = await getBusinessHours();
            const listText = t.businessHours(hours);
            if (text.split(' ').length > 2) {
              const intro = await aiReply(text, '', name, customer.id, lang);
              reply = intro + '\n\n' + listText;
            } else {
              reply = listText;
            }
          } else if (['سؤال', 'اسئلة', 'shae', 'faq', 'question'].some(kw => lower.includes(kw))) {
            const listText = t.faq();
            if (text.split(' ').length > 2) {
              const intro = await aiReply(text, '', name, customer.id, lang);
              reply = intro + '\n\n' + listText;
            } else {
              reply = listText;
            }
          } else {
            // Check for health condition mentions (e.g., "back pain", "ألم في الظهر")
            const allServices = await getAllServices();
            const rec = await getConditionRecommendation(lower, name, allServices, lang);
            if (rec) {
              await updateSession(customer.id, 'recommendation_select', { 
                recommended_service_ids: rec.serviceIds,
                last_rec_reply:          rec.reply 
              });
              reply = rec.reply;
            } else {
              reply = await aiReply(text, 'main_menu', name, customer.id, lang);
            }
          }
        }
      }
      break;
    }

    // ── recommendation_select ────────────────────────────────────────────────
    case 'recommendation_select': {
      if (text === '0' || lower.includes('main menu') || lower.includes('قائمة')) {
        await resetSession(customer.id);
        reply = await getMainMenuReply(lang, t);
        break;
      }
      const recIds = sessionData.recommended_service_ids || [];
      const match = text.match(/\d+/);
      const num = match ? parseInt(match[0]) : NaN;

      if (!isNaN(num) && num >= 1 && num <= recIds.length) {
        const chosenId = recIds[num - 1];
        const service  = await getServiceById(chosenId);
        if (service) {
          await updateSession(customer.id, 'gift_details', {
            selected_service_id:       service.id,
            selected_service_name:     service.name,
            selected_service_price:    service.price,
            selected_service_duration: service.duration_minutes,
          });
          reply = t.connectorSure() + t.askGiftDetails();
          break;
        }
      }

      // If invalid number, re-show the recommendation list (cached in session)
      if (sessionData.last_rec_reply) {
        reply = (lang === 'ar' ? 'عذراً، الخيار غير صحيح. يرجى اختيار رقم من القائمة أو *0* للرجوع:\n\n' : `Invalid choice. Please pick a number from the list or *0* to go back:\n\n`) + sessionData.last_rec_reply;
      } else {
        // Fallback to general recommendation check if cache missing
        const allServices = await getAllServices();
        const rec = await getConditionRecommendation(lower, name, allServices, lang);
        if (rec) {
          await updateSession(customer.id, 'recommendation_select', { recommended_service_ids: rec.serviceIds, last_rec_reply: rec.reply });
          reply = rec.reply;
        } else {
          reply = await aiReply(text, 'recommendation_select', name, customer.id, lang);
        }
      }
      break;
    }

    // ── services_list ─────────────────────────────────────────────────────────
    case 'services_list': {
      reply = await handleCatalogSelection({
        customerId: customer.id,
        text,
        lower,
        lang,
        mode: 'browse',
        sessionData,
        t,
        aiFallback: () => aiReply(text, 'services_list', name, customer.id, lang),
        onLeaf: async (service) => {
          await updateSession(customer.id, 'service_detail', { viewing_service_id: service.id, from: 'browse' });
          markServiceInstructionForward(msgData, service, 'service_detail', lang);
          return t.serviceDetail({ ...service, ...defaultCommercialOption(service) });
        },
      });
      break;
    }

    // ── select_service ────────────────────────────────────────────────────────
    case 'select_service': {
      reply = await handleCatalogSelection({
        customerId: customer.id,
        text,
        lower,
        lang,
        mode: 'book',
        sessionData,
        t,
        aiFallback: () => aiReply(text, 'select_service', name, customer.id, lang),
        onLeaf: async (service) => {
          const options = sortedPriceOptions(service);
          if (options.length > 1) {
            await updateSession(customer.id, 'select_service_option', {
              ...sessionData,
              pending_service_id: service.id,
              pending_service_name: service.name,
            });
            return serviceOptionMenuText(service, lang);
          }
          markServiceInstructionForward(msgData, service, 'service_selected', lang, options[0] || null);
          return await askPackageChoice(customer.id, serviceSelectionPayload(service, options[0] || null), lang);
        },
      });
      break;
    }

    // ── select_service_option ─────────────────────────────────────────────────
    case 'select_service_option': {
      if (isBackCommand(lower)) {
        reply = await showCatalogForSession(customer.id, 'book', lang, sessionData.catalog_parent_id || null, sessionData);
        break;
      }
      const service = await catalogService.getCatalogNode(sessionData.pending_service_id);
      if (!service) {
        reply = await showCatalogForSession(customer.id, 'book', lang);
        break;
      }
      const options = sortedPriceOptions(service);
      const num = parseInt((text.match(/\b\d+\b/) || [])[0], 10);
      if (isNaN(num) || num < 1 || num > options.length) {
        reply = serviceOptionMenuText(service, lang) || t.invalidOption();
        break;
      }
      const option = options[num - 1];
      markServiceInstructionForward(msgData, service, 'service_selected', lang, option);
      reply = await askPackageChoice(customer.id, serviceSelectionPayload(service, option), lang);
      break;
    }

    // ── service_detail ────────────────────────────────────────────────────────
    case 'service_detail': {
      if (['yes', 'y', 'نعم', 'ايوه', 'اي', 'sure', 'ok', 'okay', 'book', 'book it', 'تمام', 'اوكي', 'اوك', 'طيب', 'موافق'].includes(lower)) {
        const service = await catalogService.getCatalogNode(sessionData.viewing_service_id);
        if (!service) { reply = t.invalidOption(); break; }
        const options = sortedPriceOptions(service);
        if (options.length > 1) {
          await updateSession(customer.id, 'select_service_option', {
            ...sessionData,
            pending_service_id: service.id,
            pending_service_name: service.name,
          });
          reply = serviceOptionMenuText(service, lang);
          break;
        }
        markServiceInstructionForward(msgData, service, 'service_selected', lang, options[0] || null);
        reply = await askPackageChoice(customer.id, serviceSelectionPayload(service, options[0] || null), lang);
      } else if (['no', 'n', 'لا', 'nope', 'back', 'go back', 'الغاء', 'إلغاء'].includes(lower)) {
        reply = await showCatalogForSession(customer.id, 'browse', lang, sessionData.catalog_parent_id || null, sessionData);
      } else {
        reply = await aiReply(text, 'service_detail', name, customer.id, lang);
      }
      break;
    }

    // ── gift_details ───────────────────────────────────────────────────────────
    case 'gift_details': {
      if (isBackCommand(lower) || ['cancel', 'الغاء', 'إلغاء'].includes(lower)) {
        await resetSession(customer.id);
        reply = await getBookingCancelledReply(lang, t);
        break;
      }

      const servicePrompt = selectedServicePromptPayload(sessionData);
      if (isGiftSkip(text)) {
        await updateSession(customer.id, 'booking_type', { gift_details: null });
        reply = t.connectorOk() + t.askBookingType(servicePrompt);
        break;
      }
      if (isGiftAffirmationOnly(text)) {
        reply = t.askGiftDetails();
        break;
      }

      const giftDetails = parseGiftBookingDetails(text);
      await updateSession(customer.id, 'booking_type', { gift_details: giftDetails });
      reply = (lang === 'ar' ? 'تم حفظ تفاصيل الهدية. ' : 'Gift details saved. ') + t.askBookingType(servicePrompt);
      break;
    }

    // ── package_choice ─────────────────────────────────────────────────────────
    case 'package_choice': {
      if (isBackCommand(lower) || ['cancel', 'الغاء', 'إلغاء'].includes(lower)) {
        await resetSession(customer.id);
        reply = await getBookingCancelledReply(lang, t);
        break;
      }

      if (text === '1' || lower.includes('single') || lower.includes('مفرد')) {
        await updateSession(customer.id, 'gift_details', {
          package_customer_id: null,
          package_redemption_status: null,
          package_pricing_source: 'standard',
          discount_percent: 0,
        });
        reply = t.connectorSure() + t.askGiftDetails();
        break;
      }

      if (text === '2' || lower.includes('package') || lower.includes('باقة')) {
        const wallets = await getEligibleCustomerPackages({
          customerId: customer.id,
          serviceId: sessionData.selected_service_id,
          servicePriceOptionId: sessionData.selected_service_price_option_id || null,
        });
        if (!wallets.length) {
          const packages = await getAllPackages();
          reply = (lang === 'ar'
            ? 'لا توجد باقة فعّالة مناسبة لهذه الخدمة حالياً. يمكنك حجز جلسة مفردة أو طلب باقة جديدة.\n\n'
            : 'There is no eligible active package for this service yet. You can book a single session or request a new package.\n\n') + packageChoiceMenuText({ eligibleWallets: [], packages, lang });
          break;
        }
        if (wallets.length === 1) {
          const wallet = wallets[0];
          await updateSession(customer.id, 'gift_details', {
            package_customer_id: wallet.id,
            package_redemption_status: 'reserved',
            package_pricing_source: 'package',
            discount_percent: Number(wallet.effective_discount_percent || 100),
          });
          reply = (lang === 'ar' ? 'تم اختيار الباقة. ' : 'Package selected. ') + t.askGiftDetails();
          break;
        }
        await updateSession(customer.id, 'package_wallet_select', {
          eligible_package_customer_ids: wallets.map((w) => w.id),
        });
        reply = packageWalletSelectText(wallets, lang);
        break;
      }

      if (text === '3' || lower.includes('buy') || lower.includes('شراء') || lower.includes('طلب')) {
        const packages = await getAllPackages();
        await updateSession(customer.id, 'package_purchase_select', {
          available_package_ids: packages.map((pkg) => pkg.id),
        });
        reply = packagePurchaseSelectText(packages, lang, sessionData);
        break;
      }

      reply = await aiReply(text, 'package_choice', name, customer.id, lang);
      break;
    }

    // ── package_wallet_select ─────────────────────────────────────────────────
    case 'package_wallet_select': {
      if (isBackCommand(lower)) {
        const packages = await getAllPackages();
        const wallets = await getEligibleCustomerPackages({ customerId: customer.id, serviceId: sessionData.selected_service_id, servicePriceOptionId: sessionData.selected_service_price_option_id || null });
        await updateSession(customer.id, 'package_choice', { eligible_package_customer_ids: wallets.map((w) => w.id), available_package_ids: packages.map((pkg) => pkg.id) });
        reply = packageChoiceMenuText({ eligibleWallets: wallets, packages, lang });
        break;
      }
      const wallets = await getEligibleCustomerPackages({ customerId: customer.id, serviceId: sessionData.selected_service_id, servicePriceOptionId: sessionData.selected_service_price_option_id || null });
      const num = parseInt((text.match(/\d+/) || [])[0], 10);
      if (isNaN(num) || num < 1 || num > wallets.length) {
        reply = packageWalletSelectText(wallets, lang);
        break;
      }
      const wallet = wallets[num - 1];
      await updateSession(customer.id, 'gift_details', {
        package_customer_id: wallet.id,
        package_redemption_status: 'reserved',
        package_pricing_source: 'package',
        discount_percent: Number(wallet.effective_discount_percent || 100),
      });
      reply = (lang === 'ar' ? 'تم اختيار الباقة. ' : 'Package selected. ') + t.askGiftDetails();
      break;
    }

    // ── package_purchase_select ────────────────────────────────────────────────
    case 'package_purchase_select': {
      if (isBackCommand(lower)) {
        const packages = await getAllPackages();
        const wallets = await getEligibleCustomerPackages({ customerId: customer.id, serviceId: sessionData.selected_service_id, servicePriceOptionId: sessionData.selected_service_price_option_id || null });
        await updateSession(customer.id, 'package_choice', { eligible_package_customer_ids: wallets.map((w) => w.id), available_package_ids: packages.map((pkg) => pkg.id) });
        reply = packageChoiceMenuText({ eligibleWallets: wallets, packages, lang });
        break;
      }
      const packages = await getAllPackages();
      const num = Number.parseInt(String(text).trim(), 10);
      if (!Number.isInteger(num) || num < 1 || num > packages.length) {
        reply = packagePurchaseSelectText(packages, lang, sessionData);
        break;
      }
      const pkg = packages[num - 1];
      const isLoyaltyPackage = String(pkg.name || '').toLowerCase().includes('loyalty');
      if (isLoyaltyPackage) {
        const claim = await claimLoyaltyRewardForSelection({
          customerId: customer.id,
          servicePriceOptionId: sessionData.selected_service_price_option_id || null,
          serviceDurationMinutes: sessionData.selected_service_duration || null,
          serviceUnitPrice: sessionData.selected_service_price || null,
        });
        const status = claim.status || await getReferralStatus(customer.id);
        await updateSession(customer.id, 'package_choice');
        reply = claim.ok
          ? (lang === 'ar'
            ? `تم تفعيل مكافأة الولاء الخاصة بك ✅ يمكنك استخدامها الآن كجلسة مجانية.

`
            : `Your loyalty reward has been activated ✅ You can use it now as a free session.

`)
          : (lang === 'ar'
            ? `باقة الولاء تعمل الآن بكود الإحالة. شاركي الكود التالي، وبعد ${status.threshold} إحالات مؤهلة من عملاء جدد يتم تفعيل جلسة مجانية تلقائياً.

${referralStatusText(status, lang)}

`
            : `The Loyalty Package now works through your referral code. Share the code below; after ${status.threshold} qualified new-client referrals, a free session is activated automatically.

${referralStatusText(status, lang)}

`);
        reply += packageChoiceMenuText({ eligibleWallets: claim.ok ? [claim.wallet] : [], packages, lang });
        break;
      }
      await purchasePackage({
        customerId: customer.id,
        packageId: pkg.id,
        source: 'bot_request',
        status: 'pending_payment',
        purchasePrice: estimatePackageRequestPrice(pkg, sessionData),
        discountPercent: 100,
        servicePriceOptionId: sessionData.selected_service_price_option_id || null,
        serviceDurationMinutes: sessionData.selected_service_duration || null,
        serviceUnitPrice: sessionData.selected_service_price || null,
      });
      await updateSession(customer.id, 'package_choice');
      reply = (lang === 'ar'
        ? `تم تسجيل طلب باقة *${pkg.name}*. سيؤكد الفريق الدفع ويفعّل الباقة قبل استخدامها.

يمكنك الآن حجز جلسة مفردة، أو الرجوع لاحقاً بعد التفعيل.

`
        : `Your request for *${pkg.name}* has been recorded. The team will confirm payment and activate it before use.

You can book a single session now, or come back after activation.

`) + packageChoiceMenuText({ eligibleWallets: [], packages, lang });
      break;
    }

    // ── booking_type ──────────────────────────────────────────────────────────
    case 'booking_type': {
      if (text === '1' || lower.includes('center') || lower.includes('مركز')) {
        // Center booking — district is always Khaleej
        const availability = await findNextAvailableDay(
          sessionData.selected_service_id,
          'Khaleej',
          'center',
          getToday()
        );
        if (!availability) {
          // Run diagnostic to understand why center has no availability
          await checkDateAvailabilityDetails(
            sessionData.selected_service_id,
            'Khaleej',
            getToday(),
            'center'
          );
          await resetSession(customer.id);
          reply = await getNoAvailabilityReply(lang, t);
          break;
        }
        // Check if availability matches user's prefilled date
        if (availability.date === getToday() || (sessionData.prefilled_date && availability.date === sessionData.prefilled_date)) {
           const preTime = sessionData.prefilled_time ? sessionData.prefilled_time.substring(0, 5) : null;
           // If time matches, skip to summary
           if (preTime && availability.slots.includes(preTime)) {
              await updateSession(customer.id, 'booking_summary', {
                 location_type:          'center',
                 district:               'Khaleej',
                 address:                'Center (Riyadh — Khaleej District)',
                 selected_date:          availability.date,
                 selected_slot:          preTime,
                 selected_therapist_id:  availability.therapistId,
                 selected_therapist_name:availability.therapistName,
                 suggested_date:         availability.date,
                 suggested_date_display: availability.dateDisplay,
              });
              const locTypeDisp = lang === 'ar' ? 'في المركز' : 'Center';
              reply = t.connectorOk() + t.bookingSummary({
                 serviceName:   sessionData.selected_service_name,
                 duration:      sessionData.selected_service_duration,
                 price:         sessionData.selected_service_price,
                 locationType:  'center',
                 address:       'Khaleej District',
                 date:          availability.dateDisplay,
                 time:          formatTime12h(preTime),
                 therapistName: availability.therapistName,
                 discountPercent: sessionData.discount_percent || 0,
                 giftDetails: sessionData.gift_details || null,
              });
           } else {
              // Time doesn't match or not provided — go to time selection
              await updateSession(customer.id, 'booking_time_select', {
                 location_type:          'center',
                 district:               'Khaleej',
                 address:                'Center (Riyadh — Khaleej District)',
                 suggested_date:         availability.date,
                 suggested_date_display: availability.dateDisplay,
                 therapist_id:           availability.therapistId,
                 therapist_name:         availability.therapistName,
                 available_slots:        availability.slots,
              });
              let prefix = t.connectorOk();
              if (preTime) {
                 const tDisp = formatTime12h(preTime);
                 prefix = (lang === 'ar' 
                   ? `عذراً، الوقت الذي طلبتِه (${tDisp}) غير متاح في المركز حالياً. يرجى اختيار وقت آخر:\n\n` 
                   : `Sorry, the time you requested (${tDisp}) is not available at the center right now. Please choose another time:\n\n`);
              }
              reply = prefix + t.askTimeSlots(availability.dateDisplay, availability.slots, 'center');
           }
        } else {
           // Suggest a different date
           await updateSession(customer.id, 'booking_day_confirm', {
             location_type:          'center',
             district:               'Khaleej',
             address:                'Center (Riyadh — Khaleej District)',
             suggested_date:         availability.date,
             suggested_date_display: availability.dateDisplay,
             therapist_id:           availability.therapistId,
             therapist_name:         availability.therapistName,
             available_slots:        availability.slots,
           });
           reply = t.askDayConfirm(availability.dateDisplay);
        }

      } else if (text === '2' || lower.includes('home') || lower.includes('منزل') || lower.includes('house')) {
        const savedLocation = await getDefaultLocation(customer.id);
        await updateSession(customer.id, 'booking_location', { location_type: 'home' });
        reply = t.askLocation(savedLocation ? savedLocation.address : null);
      } else {
        reply = await aiReply(text, 'booking_type', name, customer.id, lang);
      }
      break;
    }

    // ── booking_location ──────────────────────────────────────────────────────
    case 'booking_location': {
      let locationId, address;
      let district = null;   // hoisted so availability engine can use it below
      let savedLat = null, savedLng = null;

      if (isLocation && locationPin) {
        // WhatsApp's description/name is often a landmark, not the real address.
        // Use reverse geocoding with the exact coordinates to get the correct street address.
        let displayName = null;
        let city        = null;
        if (locationPin.latitude && locationPin.longitude) {
          const geoResult = await reverseGeocode(locationPin.latitude, locationPin.longitude);
          displayName = geoResult.displayName;
          city        = geoResult.city;
          district = geoResult.district || null;
          if (displayName) {
            console.log(`[GEO]  Resolved address: ${displayName}`);
            console.log(`[GEO]  Country: ${geoResult.country || 'unknown'} — city: ${city || 'none'} — district: ${district || 'none'}`);
          } else {
            console.log(`[GEO]  Reverse geocode failed, falling back to WhatsApp label`);
          }
          // Riyadh-only check — check city, district, and full address string
          // displayName covers outskirts/suburbs where city field may be empty or a sub-district name
          if (displayName || city) {
            const riyadhVariants = ['riyadh', 'ar riyad', 'ar riyadh', 'riyad', 'الرياض','karachi'];
            const checkStr = [displayName, city, district].filter(Boolean).join(' ').toLowerCase();
            const isRiyadh = riyadhVariants.some(v => checkStr.includes(v));
            if (!isRiyadh) {
              const cityLabel = city || district || 'your area';
              console.log(`[GEO]  Location "${cityLabel}" is outside Riyadh — rejecting booking`);
              reply = t.notInServiceArea(cityLabel);
              break;
            }
          }
        }
        // Fall back to whatever WhatsApp sent if geocoding failed
        if (!displayName) {
          displayName = locationPin.name || locationPin.address || 'Shared location';
        }

        const loc = await saveLocation(customer.id, {
          district,
          city,
          latitude:  locationPin.latitude,
          longitude: locationPin.longitude,
          maps_url:  locationPin.maps_url,
        });
        locationId = loc.id;
        address    = displayName;

      } else if (lower === 'same') {
        const saved = await getDefaultLocation(customer.id);
        if (saved) {
          locationId = saved.id;
          address    = saved.address;
          district   = saved.district || null;
          savedLat   = saved.latitude || null;
          savedLng   = saved.longitude || null;
        } else {
          reply = (lang === 'ar' ? 'ليس لدي عنوان محفوظ لك حتى الآن.\n\nمن فضلك اضغطي على أيقونة المرفقات 📎 ← *الموقع* وشاركي موقعك.' : `I don't have a saved location for you yet.\n\nPlease tap the attach icon 📎 → *Location* and share your pin.`);
          break;
        }
      } else {
        // Text message instead of pin — use AI to explain why we need the pin
        reply = await aiReply(text, 'booking_location', name, customer.id, lang);
        break;
      }

      // Re-read session — geocoding can take a few seconds and concurrent events
      // might have changed the session (e.g. a second WhatsApp auto-message).
      // If selected_service_id is gone, the booking context was lost; restart.
      const freshSession   = await getOrCreateSession(customer.id);
      console.log("🚀 ~ handleMessage ~ freshSession:", freshSession)
      const freshData      = freshSession.session_data || {};
      const activeServiceId = freshData.selected_service_id || sessionData.selected_service_id;
      if (!activeServiceId) {
        reply = (lang === 'ar' ? 'يبدو أن جلسة الحجز قد انقطعت.\n\nمن فضلك اكتبي *2* لبدء حجز جديد.' : `It looks like your booking session was interrupted.\n\nPlease type *2* to start a new booking.`);
        break;
      }

      // Find next available day for this service + district
      // Pass customer coordinates so nearest-district logic can rank therapists
      const locDistrict  = district || freshData.district || null;
      const custLat      = locationPin?.latitude  || savedLat || freshData.customer_lat || null;
      const custLng      = locationPin?.longitude || savedLng || freshData.customer_lng || null;
      const deliveryQuote = await estimateDeliveryQuote({ lat: custLat, lng: custLng, district: locDistrict });
      if (deliveryQuote.fee === null || deliveryQuote.fee === undefined) {
        const kmText = deliveryQuote.route_km ? ` (${deliveryQuote.route_km} km)` : '';
        reply = lang === 'ar'
          ? `*الخدمة غير متاحة لهذا الموقع*
${LINE}
الموقع خارج نطاق تسعيرة التوصيل الحالية${kmText}.

من فضلك اختاري موقعاً أقرب أو تواصلي معنا للمساعدة.
${LINE}
اكتبي *0* للقائمة الرئيسية.`
          : `*Service Not Available for This Location*
${LINE}
This location is outside the current delivery tariff range${kmText}.

Please choose a closer location or contact us for help.
${LINE}
Type *0* for main menu.`;
        break;
      }
      // Per-provider district lock — provider is matched to customer's district
      // If user pre-specified a date, start availability search from that date (not today)
      const searchFromDate = freshData.prefilled_date || getToday();
      let availability = await findNextAvailableDay(
        activeServiceId,
        locDistrict,
        'home',
        searchFromDate,
        14,
        custLat,
        custLng
      );
      if (!availability) {
        // Run diagnostic to understand why no availability for home booking
        await checkDateAvailabilityDetails(
          activeServiceId,
          locDistrict,
          getToday(),
          'home'
        );
        await resetSession(customer.id);
        reply = await getNoAvailabilityReply(lang, t);
        break;
      }
      // ── Update mode: location-only → confirm address; 'both' → proceed to day selection ──
      if (freshData.is_update_mode && freshData.update_field === 'location') {
        await updateSession(customer.id, 'update_location_confirm', {
          location_id: locationId,
          address,
          district:    locDistrict,
          customer_lat: custLat,
          customer_lng: custLng,
          delivery_fee: deliveryQuote.fee,
          delivery_km: deliveryQuote.route_km,
          delivery_zone: deliveryQuote.zone,
          delivery_quote_method: deliveryQuote.method,
          delivery_tariff_band_id: deliveryQuote.tariff_band_id || null,
          delivery_tariff_basis: deliveryQuote.tariff_basis || null,
        });
        const existingDate = freshData.booking_date ? formatDateDisplay(freshData.booking_date) : 'TBD';
        const existingTime = freshData.booking_time ? formatTime12h(freshData.booking_time.substring(0, 5)) : 'TBD';
        reply = t.updateLocationConfirm(address, existingDate, existingTime, deliveryQuote.fee, deliveryQuote.route_km);
      } else if (availability.date === getToday() || availability.date === freshData.prefilled_date) {
          // Skip day confirmation: either it's today, or availability landed on exactly the date user requested.
          // Also check prefilled_time — if the requested slot is available, jump straight to summary.
          const preTime = freshData.prefilled_time ? freshData.prefilled_time.substring(0, 5) : null;
          if (preTime && availability.slots.includes(preTime)) {
            const hold = await holdSlot(availability.therapistId, activeServiceId, availability.date, preTime, customer.id, 10);
            if (hold.ok) {
              await updateSession(customer.id, 'booking_summary', {
                location_id:             locationId,
                address,
                district:                locDistrict,
                customer_lat:            custLat,
                customer_lng:            custLng,
                delivery_fee:            deliveryQuote.fee,
                delivery_km:             deliveryQuote.route_km,
                delivery_zone:           deliveryQuote.zone,
                delivery_quote_method:   deliveryQuote.method,
                delivery_tariff_band_id: deliveryQuote.tariff_band_id || null,
                delivery_tariff_basis:   deliveryQuote.tariff_basis || null,
                suggested_date:          availability.date,
                suggested_date_display:  availability.dateDisplay,
                therapist_id:            availability.therapistId,
                therapist_name:          availability.therapistName,
                selected_date:           availability.date,
                selected_slot:           preTime,
                selected_therapist_id:   availability.therapistId,
                selected_therapist_name: availability.therapistName,
                update_field:            freshData.update_field || null,
              });
              reply = t.connectorOk() + t.bookingSummary({
                serviceName:   freshData.selected_service_name,
                duration:      freshData.selected_service_duration,
                price:         freshData.selected_service_price,
                locationType:  'home',
                address,
                date:          availability.dateDisplay,
                time:          formatTime12h(preTime),
                therapistName: availability.therapistName,
                deliveryFee:   deliveryQuote.fee,
                deliveryKm:    deliveryQuote.route_km,
                discountPercent: freshData.discount_percent || 0,
              });
              break;
            }
            // Hold failed — fall through to show time slots
          }
          await updateSession(customer.id, 'booking_time_select', {
            location_id:            locationId,
            address,
            district:               locDistrict,
            customer_lat:           custLat,
            customer_lng:           custLng,
            delivery_fee:          deliveryQuote.fee,
            delivery_km:           deliveryQuote.route_km,
            delivery_zone:         deliveryQuote.zone,
            delivery_quote_method: deliveryQuote.method,
            delivery_tariff_band_id: deliveryQuote.tariff_band_id || null,
            delivery_tariff_basis: deliveryQuote.tariff_basis || null,
            suggested_date:         availability.date,
            suggested_date_display: availability.dateDisplay,
            therapist_id:           availability.therapistId,
            therapist_name:         availability.therapistName,
            available_slots:        availability.slots,
            update_field:           freshData.update_field || null,
          });
          let prefix = t.connectorOk();
          if (preTime) {
             const tDisp = formatTime12h(preTime);
             prefix = (lang === 'ar' 
               ? `عذراً، الوقت الذي طلبتِه (${tDisp}) غير متاح حالياً. يرجى اختيار وقت آخر من القائمة:\n\n` 
               : `Sorry, the time you requested (${tDisp}) is not available right now. Please choose another time from the list:\n\n`);
          }

          reply = prefix + t.askTimeSlots(availability.dateDisplay, availability.slots, 'home');
      } else {
        await updateSession(customer.id, 'booking_day_confirm', {
          location_id:            locationId,
          address,
          district:               locDistrict,
          customer_lat:           custLat,
          customer_lng:           custLng,
            delivery_fee:          deliveryQuote.fee,
            delivery_km:           deliveryQuote.route_km,
            delivery_zone:         deliveryQuote.zone,
            delivery_quote_method: deliveryQuote.method,
            delivery_tariff_band_id: deliveryQuote.tariff_band_id || null,
            delivery_tariff_basis: deliveryQuote.tariff_basis || null,
          suggested_date:         availability.date,
          suggested_date_display: availability.dateDisplay,
          therapist_id:           availability.therapistId,
          therapist_name:         availability.therapistName,
          available_slots:        availability.slots,
          update_field:           freshData.update_field || null,
        });
        reply = t.connectorOk() + t.askDayConfirm(availability.dateDisplay);
      }
      break;
    }

    // ── booking_day_confirm ───────────────────────────────────────────────────
    case 'booking_day_confirm': {

      // ── Confirm current suggestion ──
      if (['yes', 'y', 'نعم', 'ايوه', 'اي', 'sure', 'ok', 'okay', 'تمام', 'أبشري', 'طيب', 'ايه'].includes(lower)) {
        // Re-fetch fresh slots at confirm time — session slots may be stale if time passed
        // Slots are filtered by location_type (center/home) using business_hours table
        const freshSlots = await getAvailableSlotsForDay(
          sessionData.therapist_id,
          sessionData.selected_service_id,
          sessionData.suggested_date,
          sessionData.location_type
        );

        if (!freshSlots.length) {
          // All slots taken since suggestion — find next available day with district matching
          const nextAvail = await findNextAvailableDay(
            sessionData.selected_service_id,
            sessionData.district || null,
            sessionData.location_type,
            sessionData.suggested_date,
            14,
            sessionData.customer_lat || null,
            sessionData.customer_lng || null
          );
          if (!nextAvail) {
            await resetSession(customer.id);
            reply = await getNoAvailabilityReply(lang, t);
            break;
          }
          await updateSession(customer.id, 'booking_day_confirm', {
            suggested_date:         nextAvail.date,
            suggested_date_display: nextAvail.dateDisplay,
            therapist_id:           nextAvail.therapistId,
            therapist_name:         nextAvail.therapistName,
            available_slots:        nextAvail.slots,
          });
          reply = (lang === 'ar' ? `هذا اليوم أصبح محجوزاً بالكامل للتو. أقرب يوم متاح هو *${nextAvail.dateDisplay}*.\n\nاردي بـ *نعم* للتأكيد، *التالي* ليوم آخر، أو *0* للإلغاء.` : `That day just got fully booked. The next available day is *${nextAvail.dateDisplay}*.\n\nReply *Yes* to confirm, *Next* for another, or *0* to cancel.`);
          break;
        }

        // ── FAST-FORWARD: Skip time slot picking if user already provided a time initially ──
        let prefilledUnavailableMsg = "";
        if (sessionData.prefilled_time) {
           const timePrefix = sessionData.prefilled_time.substring(0, 5); // "23:00"
           if (freshSlots.includes(timePrefix)) {
              const hold = await holdSlot(sessionData.therapist_id, sessionData.selected_service_id, sessionData.suggested_date, timePrefix, customer.id, 10);
              if (hold.ok) {
                 await updateSession(customer.id, 'booking_summary', {
                    ...sessionData,
                    selected_date:          sessionData.suggested_date,
                    selected_slot:          timePrefix,
                    selected_therapist_id:  sessionData.therapist_id,
                    selected_therapist_name:sessionData.therapist_name,
                 });
                 let locTypeDisp = sessionData.location_type === 'center' ? 'Center' : 'Home Visit';
                 if (lang === 'ar') locTypeDisp = sessionData.location_type === 'center' ? 'في المركز' : 'زيارة منزلية';
                 let feeMsgContext = '';
                 
                 reply = t.connectorOk() + t.bookingSummary({
                    serviceName:   sessionData.selected_service_name,
                    duration:      sessionData.selected_service_duration,
                    price:         sessionData.selected_service_price,
                    locationType:  sessionData.location_type,
                    address:       sessionData.address,
                    date:          sessionData.suggested_date_display,
                    time:          formatTime12h(timePrefix),
                    therapistName: sessionData.therapist_name,
                    deliveryFee:   sessionData.delivery_fee,
                    deliveryKm:    sessionData.delivery_km,
                    discountPercent: sessionData.discount_percent || 0,
                 });
                 if (sessionData.delivery_fee !== undefined && sessionData.location_type === 'home') {
                    feeMsgContext = t.deliveryFeeInfo(sessionData.delivery_km, sessionData.delivery_fee) + '\n\n';
                 }
                 reply = feeMsgContext + reply;
                 break;
              }
           } else {
              const tDisp = formatTime12h(timePrefix);
              prefilledUnavailableMsg = (lang === 'ar' 
                ? `عذراً، الوقت الذي طلبتِه (${tDisp}) غير متاح حالياً. يرجى اختيار وقت آخر من القائمة:\n\n` 
                : `Sorry, the time you requested (${tDisp}) is not available right now. Please choose another time from the list:\n\n`);
           }
        }

        // Save fresh slots then show time selection
        await updateSession(customer.id, 'booking_time_select', { available_slots: freshSlots });
        reply = prefilledUnavailableMsg + t.askTimeSlots(sessionData.suggested_date_display, freshSlots, sessionData.location_type);

      // ── Cancel ──
      } else if (text === '0' || lower === 'cancel' || lower === 'no') {
        await resetSession(customer.id);
        reply = await getBookingCancelledReply(lang, t);

      // ── Next available day ──
      } else if (['next', 'التالي', 'بعده', 'يوم اخر', 'تغییر', 'another', 'different', 'next day', 'show next'].includes(lower)) {
        const nextStart = new Date(`${sessionData.suggested_date}T00:00:00Z`);
        nextStart.setUTCDate(nextStart.getUTCDate() + 1);
        const nextFromDate = nextStart.toISOString().split('T')[0];

        // Enforce 14-day window — compute remaining days from today
        const MAX_BOOKING_DAYS = 14;
        const todayForNext = getToday();
        const todayMsNext  = new Date(todayForNext + 'T00:00:00Z').getTime();
        const nextFromMs   = new Date(nextFromDate  + 'T00:00:00Z').getTime();
        const daysFromToday = Math.round((nextFromMs - todayMsNext) / (1000 * 60 * 60 * 24));
        const remainingDays = MAX_BOOKING_DAYS - daysFromToday;

        if (remainingDays <= 0) {
          reply = t.advanceBookingLimit(MAX_BOOKING_DAYS, sessionData.suggested_date_display);
          break;
        }

        // Per-provider district matching — search only within remaining days
        const avail = await findNextAvailableDay(
          sessionData.selected_service_id,
          sessionData.district || null,
          sessionData.location_type,
          nextFromDate,
          remainingDays,
          sessionData.customer_lat || null,
          sessionData.customer_lng || null
        );
        if (!avail) {
          await resetSession(customer.id);
          reply = await getNoAvailabilityReply(lang, t);
          break;
        }
        await updateSession(customer.id, 'booking_day_confirm', {
          suggested_date:         avail.date,
          suggested_date_display: avail.dateDisplay,
          therapist_id:           avail.therapistId,
          therapist_name:         avail.therapistName,
          available_slots:        avail.slots,
        });
        reply = t.daySuggestionFollowup(avail.dateDisplay);

      // ── User requests a specific date ──
      } else if (extractDateFromText(text)) {
        const reqDate    = extractDateFromText(text);
        const reqDisplay = formatDateDisplay(reqDate);

        // Enforce 14-day booking window — reject dates too far in the future
        const MAX_BOOKING_DAYS = 14;
        const todayMs  = new Date(getToday() + 'T00:00:00Z').getTime();
        const reqMs    = new Date(reqDate  + 'T00:00:00Z').getTime();
        const diffDays = Math.round((reqMs - todayMs) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          // Past date
          reply = t.pastDateReject(reqDisplay);
          break;
        }

        if (diffDays >= MAX_BOOKING_DAYS) {
          const limitDate = new Date(todayMs + (MAX_BOOKING_DAYS - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          reply = t.advanceBookingLimit(MAX_BOOKING_DAYS, formatDateDisplay(limitDate));
          break;
        }

        // Check if that exact date is available (maxDays=1) — with district matching
        const exactAvail = await findNextAvailableDay(
          sessionData.selected_service_id,
          sessionData.district || null,
          sessionData.location_type,
          reqDate,
          1,
          sessionData.customer_lat || null,
          sessionData.customer_lng || null
        );

        if (exactAvail && exactAvail.date === reqDate) {
          // Requested date has open slots
          await updateSession(customer.id, 'booking_day_confirm', {
            suggested_date:         exactAvail.date,
            suggested_date_display: exactAvail.dateDisplay,
            therapist_id:           exactAvail.therapistId,
            therapist_name:         exactAvail.therapistName,
            available_slots:        exactAvail.slots,
          });
          reply = t.connectorGreatNews() + `*${reqDisplay}* is available.\n\nReply *Yes* to confirm, *Next* for a different day, or *0* to cancel.`;

        } else {
          // Requested date is full — find next available from that date onwards with district matching
          // Cap search to remaining days within the 14-day window from today
          const MAX_BOOKING_DAYS = 14;
          const todayMsFb  = new Date(getToday() + 'T00:00:00Z').getTime();
          const reqMsFb    = new Date(reqDate    + 'T00:00:00Z').getTime();
          const daysUsedFb = Math.round((reqMsFb - todayMsFb) / (1000 * 60 * 60 * 24));
          const remainFb   = MAX_BOOKING_DAYS - daysUsedFb;

          const nearestAvail = remainFb > 0 ? await findNextAvailableDay(
            sessionData.selected_service_id,
            sessionData.district || null,
            sessionData.location_type,
            reqDate,
            remainFb,
            sessionData.customer_lat || null,
            sessionData.customer_lng || null
          ) : null;
          if (nearestAvail) {
            await updateSession(customer.id, 'booking_day_confirm', {
              suggested_date:         nearestAvail.date,
              suggested_date_display: nearestAvail.dateDisplay,
              therapist_id:           nearestAvail.therapistId,
              therapist_name:         nearestAvail.therapistName,
              available_slots:        nearestAvail.slots,
            });
            reply = t.connectorSorryAllBooked(reqDisplay) +
              (lang === 'ar' ? `أقرب يوم متاح هو *${nearestAvail.dateDisplay}*.\n\n` : `The nearest available day is *${nearestAvail.dateDisplay}*.\n\n`) +
              (lang === 'ar' ? 'اردي بـ *نعم* للتأكيد، *التالي* ليوم آخر، أو *0* للإلغاء.' : 'Reply *Yes* to confirm, *Next* for another day, or *0* to cancel.');
          } else {
            await resetSession(customer.id);
            reply = t.connectorNoAppointmentsLeft(reqDisplay) +
              (lang === 'ar' ? 'يرجى التواصل معنا مباشرة على الرقم +966 55 190 4178 لترتيب حجز.' : 'Please contact us directly at +966 55 190 4178 to arrange a booking.');
          }
        }

      // ── Correction request (e.g. "change location", "wrong service") ──
      } else {
        const corr = detectCorrection(lower);
        if (corr === 'address') {
          const savedLocation = await getDefaultLocation(customer.id);
          await updateSession(customer.id, 'booking_location');
          reply = t.connectorNoProb() + (lang === 'ar' ? 'دعينا نحدد عنوانك.\n\n' : `Let's update your address.\n\n`) + t.askLocation(savedLocation ? savedLocation.address : null);
        } else if (corr === 'service') {
          const services = await getAllServices();
          await updateSession(customer.id, 'select_service', { services_count: services.length });
          reply = t.connectorSure() + (lang === 'ar' ? 'دعينا نختار خدمة أخرى.\n\n' : `Let's pick a different service!\n\n`) + t.servicesListForBooking(services);
        } else {
          reply = await aiReply(text, 'booking_day_confirm', name, customer.id, lang);
        }
      }
      break;
    }

    // ── booking_time_select ───────────────────────────────────────────────────
    case 'booking_time_select': {
      if (text === '0' || lower.includes('cancel')) {
        await resetSession(customer.id);
        reply = await getBookingCancelledReply(lang, t);
        break;
      }

      const slots  = sessionData.available_slots || [];
      const num    = parseInt(text);
      if (!isNaN(num) && num >= 1 && num <= slots.length) {
        const slot        = slots[num - 1];          // "13:00"
        const slotDisplay = formatTime12h(slot);     // "1:00 PM"

        // Try to atomically hold this slot — skip for center (no therapist assigned)
        if (sessionData.therapist_id) {
          const held = await holdSlot(
            sessionData.therapist_id,
            sessionData.selected_service_id,
            sessionData.suggested_date,
            slot,
            customer.id
          );
          if (!held.ok) {
            const conflict = await redirectAfterSlotConflict(
              customer.id,
              { ...sessionData, booking_date: sessionData.suggested_date, booking_date_display: sessionData.suggested_date_display },
              t.slotNoLongerAvailable()
            );
            reply = conflict.reply;
            break;
          }
        }

        await updateSession(customer.id, 'booking_summary', {
          booking_date:         sessionData.suggested_date,
          booking_date_display: sessionData.suggested_date_display,
          booking_time:         slot,
          booking_time_display: slotDisplay,
        });

        const fresh = await getOrCreateSession(customer.id);
        const d     = fresh.session_data || {};

        reply = t.bookingSummary({
          serviceName:   d.selected_service_name,
          duration:      d.selected_service_duration,
          price:         d.selected_service_price,
          locationType:  d.location_type,
          address:       d.address || (lang === 'ar' ? 'المركز (حي الخليج)' : 'Center (Khaleej District)'),
          date:          d.booking_date_display || d.booking_date,
          time:          slotDisplay,
          therapistName: d.therapist_name,
          deliveryFee:   d.delivery_fee,
          deliveryKm:    d.delivery_km,
          discountPercent: d.discount_percent || 0,
          giftDetails: d.gift_details || null,
        });
      } else if (extractTimeFromTextPattern(text) && sessionData.available_slots?.includes(extractTimeFromTextPattern(text).substring(0, 5))) {
        // Natural language time was provided (e.g. "3 pm") and it perfectly matches an available slot!
        const slot = extractTimeFromTextPattern(text).substring(0, 5);
        const slotDisplay = formatTime12h(slot);
        
        if (sessionData.therapist_id) {
          const held = await holdSlot(
            sessionData.therapist_id, sessionData.selected_service_id, sessionData.suggested_date, slot, customer.id
          );
          if (!held.ok) {
            const conflict = await redirectAfterSlotConflict(
              customer.id,
              { ...sessionData, booking_date: sessionData.suggested_date, booking_date_display: sessionData.suggested_date_display },
              t.slotNoLongerAvailable()
            );
            reply = conflict.reply;
            break;
          }
        }

        await updateSession(customer.id, 'booking_summary', {
          booking_date:         sessionData.suggested_date,
          booking_date_display: sessionData.suggested_date_display,
          booking_time:         slot,
          booking_time_display: slotDisplay,
        });
        const fresh = await getOrCreateSession(customer.id);
        const d     = fresh.session_data || {};
        reply = t.bookingSummary({
          serviceName:   d.selected_service_name, duration: d.selected_service_duration, price: d.selected_service_price,
          locationType:  d.location_type,
          address:       d.address || (lang === 'ar' ? 'المركز (حي الخليج)' : 'Center (Khaleej District)'),
          date:          d.booking_date_display || d.booking_date,
          time:          slotDisplay,
          therapistName: d.therapist_name,
          deliveryFee:   d.delivery_fee,
          deliveryKm:    d.delivery_km,
          discountPercent: d.discount_percent || 0,
          giftDetails: d.gift_details || null,
        });
      } else if (extractTimeFromTextPattern(text)) {
        // A time was provided but it DOES NOT match any available slot
        const tReq = formatTime12h(extractTimeFromTextPattern(text).substring(0, 5));
        reply = t.connectorSorryAllBooked(tReq) + 
                (lang === 'ar' ? 'هذا الوقت غير متاح. يرجى اختيار رقم من القائمة أعلاه.' : 'That specific time is not available. Please pick a number from the list above.');
      } else {
        // Correction request (e.g. "change date", "change location")
        const corr2 = detectCorrection(lower);
        if (corr2 === 'date') {
          await updateSession(customer.id, 'booking_day_confirm');
          reply = t.connectorNoProb() + (lang === 'ar' ? 'دعينا نختار تاريخًا آخر.\n\n' : `Let's pick a different date.\n\n`) + t.askDayConfirm(sessionData.suggested_date_display);
        } else if (corr2 === 'address') {
          const savedLocation = await getDefaultLocation(customer.id);
          await updateSession(customer.id, 'booking_location');
          reply = t.connectorNoProb() + (lang === 'ar' ? 'دعينا نحدد عنوانك.\n\n' : `Let's update your address.\n\n`) + t.askLocation(savedLocation ? savedLocation.address : null);
        } else if (corr2 === 'service') {
          const services = await getAllServices();
          await updateSession(customer.id, 'select_service', { services_count: services.length });
          reply = t.connectorSure() + (lang === 'ar' ? 'دعينا نختار خدمة أخرى.\n\n' : `Let's pick a different service!\n\n`) + t.servicesListForBooking(services);
        } else {
          // Unrecognized input — use AI fallback
          reply = await aiReply(text, 'booking_time_select', name, customer.id, lang);
        }
      }
      break;
    }

    // ── booking_date ──────────────────────────────────────────────────────────
    case 'booking_date': {
      if (!text || text.length < 2) {
        reply = await aiReply(text, 'booking_date', name, customer.id, lang);
        break;
      }
      // If user mentions service/address/time correction while in date step
      const dateStepCorrection = detectCorrection(lower);
      if (dateStepCorrection === 'service') {
        const services = await getAllServices();
        await updateSession(customer.id, 'select_service');
        reply = t.connectorSure() + (lang === 'ar' ? 'دعينا نختار خدمة أخرى.\n\n' : `Let's pick a different service!\n\n`) + t.servicesListForBooking(services);
        break;
      }
      if (dateStepCorrection === 'address' && sessionData.location_type === 'home') {
        const savedLocation = await getDefaultLocation(customer.id);
        await updateSession(customer.id, 'booking_location');
        reply = t.connectorOfCourse() + (lang === 'ar' ? 'دعينا نحدد عنوانك.\n\n' : `Let's update your address.\n\n`) + t.askLocation(savedLocation ? savedLocation.address : null);
        break;
      }
      // Validate it's actually a recognizable date before accepting
      if (!tryParseDate(text)) {
        reply = await aiReply(text, 'booking_date', name, customer.id, lang);
        break;
      }
      // Check if customer already has an active booking on this date
      const existing = await getExistingBookingOnDate(customer.id, text);
      if (existing) {
        // Ask for confirmation to book at a different time
        await updateSession(customer.id, 'booking_date_duplicate_confirm', {
          pending_date: text,
          existing_booking_service: existing.service_name,
          existing_booking_time: existing.start_time,
        });
        reply = t.askDuplicateDateConfirm(text, existing.service_name, existing.start_time);
        break;
      }

      await updateSession(customer.id, 'booking_time', { booking_date: text });
      reply = pick([`Got it — *${text}* ✓\n\n`, `*${text}* noted!\n\n`]) + t.askTime();
      break;
    }

    // ── booking_date_duplicate_confirm ────────────────────────────────────────
    case 'booking_date_duplicate_confirm': {
      // ── User says YES to book at different time ──
      if (['yes', 'y', 'نعم', 'ايوه', 'اي', 'sure', 'ok', 'okay', 'تمام', 'ايه', 'ابشري', 'ابشر'].includes(lower)) {
        // Store the date that has duplicate and proceed to time selection
        await updateSession(customer.id, 'booking_time', { booking_date: sessionData.pending_date });
        reply = pick([`Got it — *${sessionData.pending_date}* ✓\n\n`, `*${sessionData.pending_date}* noted!\n\n`]) + t.askTime();
        break;
      }

      // ── User says NO - ask to choose different date ──
      if (['no', 'n', 'لا', 'nope'].includes(lower)) {
        await updateSession(customer.id, 'booking_date');
        reply = t.connectorNoProb() + (lang === 'ar' ? 'دعينا نختار تاريخًا آخر.\n\n' : `Let's choose a different date.\n\n`) + t.askDate();
        break;
      }

      // ── Unrecognized response ──
      reply = await aiReply(text, 'booking_date_duplicate_confirm', name, customer.id, lang);
      break;
    }

    // ── booking_time ──────────────────────────────────────────────────────────
    case 'booking_time': {
      if (!text || text.length < 2) {
        reply = await aiReply(text, 'booking_time', name, customer.id, lang);
        break;
      }
      // Correction keywords in time step
      const timeStepCorrection = detectCorrection(lower);
      if (timeStepCorrection === 'date') {
        await updateSession(customer.id, 'booking_date');
        reply = t.connectorSure() + t.connectorUpdateDate() + t.askDate();
        break;
      }
      if (timeStepCorrection === 'time') {
        reply = t.connectorOfCourse() + t.askTime();
        break;
      }
      if (timeStepCorrection === 'service') {
        const services = await getAllServices();
        await updateSession(customer.id, 'select_service');
        reply = t.connectorNoProb() + t.connectorPickService() + t.servicesListForBooking(services);
        break;
      }
      // Validate it's actually a recognizable time before accepting
      if (!tryParseTime(text)) {
        reply = await aiReply(text, 'booking_time', name, customer.id, lang);
        break;
      }
      await updateSession(customer.id, 'booking_summary', { booking_time: text });

      const fresh = await getOrCreateSession(customer.id);
      const d     = fresh.session_data || {};

      reply = t.bookingSummary({
        serviceName:  d.selected_service_name,
        duration:     d.selected_service_duration,
        price:        d.selected_service_price,
        locationType: d.location_type,
        address:      d.address || 'Center (Khaleej District)',
        date:         d.booking_date,
        time:         text,
        deliveryFee:  d.delivery_fee,
        deliveryKm:   d.delivery_km,
        discountPercent: d.discount_percent || 0,
        giftDetails: d.gift_details || null,
      });
      break;
    }

    // ── booking_summary ───────────────────────────────────────────────────────
    case 'booking_summary': {

      // ── Confirm ──
      if (['yes', 'y', 'نعم', 'ايوه', 'اي', 'sure', 'confirm', 'ok', 'okay', 'done', 'تمام', 'موافق', 'ابشر', 'ابشري'].includes(lower)) {
        // Final guard: re-check for duplicate booking before writing to DB
        const duplicate = await getExistingBookingOnDate(customer.id, sessionData.booking_date);
        if (duplicate) {
          const dupTime = duplicate.start_time
            ? formatTime12h(duplicate.start_time.substring(0, 5))
            : 'a time already scheduled';
          await updateSession(customer.id, 'booking_duplicate_confirm');
          reply =
            `⚠️ ${lang === 'ar' ? (`لديك حجز نشط بالفعل في *${sessionData.booking_date_display || sessionData.booking_date}*:`) : (`You already have an active booking on *${sessionData.booking_date_display || sessionData.booking_date}*:`) }\n\n` +
            `${lang === 'ar' ? 'الخدمة' : 'Service'} : ${duplicate.service_name || (lang === 'ar' ? 'خدمتك' : 'your service')}\n` +
            `${lang === 'ar' ? 'الوقت' : 'Time'}    : ${dupTime}\n\n` +
            `${lang === 'ar' ? (`هل تودين إضافة *حجز آخر* في نفس اليوم في تمام الساعة *${sessionData.booking_time_display || sessionData.booking_time}*؟`) : (`Would you like to add *another booking* on the same date at *${sessionData.booking_time_display || sessionData.booking_time}*?`) }\n\n` +
            `${lang === 'ar' ? 'اردي *نعم* للتأكيد أو *لا* للإلغاء.' : 'Reply *Yes* to confirm or *No* to cancel.'}`;
          break;
        }

        // Re-validate therapist is still free before writing to DB
        const reval = await revalidateTherapist(sessionData);
        if (!reval.ok) {
          if (reval.newTherapistId) {
            // Replace with available provider — update session and re-show summary
            await updateSession(customer.id, 'booking_summary', {
              therapist_id:   reval.newTherapistId,
              therapist_name: reval.newTherapistName,
            });
            reply =
              (lang === 'ar' ? `⚠️ المعالجة المختارة لم تعد متاحة حالياً لهذا الموعد.\n\n` : `⚠️ Your previously assigned therapist is no longer available for that slot.\n\n`) +
              (lang === 'ar' ? `لقد قمنا بتعيين *${reval.newTherapistName}* بدلاً منها.\n\n` : `We've assigned *${reval.newTherapistName}* instead.\n\n`) +
              (lang === 'ar' ? `اردي *نعم* للتأكيد، أو *لا* للإلغاء.` : `Reply *Yes* to confirm, or *No* to cancel.`);
          } else {
            // No therapist free at this time — check same day first
            const conflict = await redirectAfterSlotConflict(
              customer.id, sessionData,
              `⚠️ Sorry, that slot is no longer available.`
            );
            reply = conflict.reply;
          }
          break;
        }

        // ── Update mode: patch existing booking instead of creating new ──
        if (sessionData.is_update_mode) {
          const updId  = sessionData.updating_booking_id;
          const updCal = sessionData.updating_cal_event_id;
          await updateBookingDateTime(updId, {
            date:        sessionData.booking_date,
            time:        sessionData.booking_time,
            therapistId: sessionData.therapist_id || null,
          });
          if (sessionData.update_field === 'both') {
            await updateBookingLocation(updId, {
              locationId:  sessionData.location_id,
              locationType: sessionData.location_type,
              pricingSnapshot: {
                serviceName:           sessionData.selected_service_name || null,
                servicePriceOptionId:  sessionData.selected_service_price_option_id || null,
                serviceOptionLabel:    sessionData.selected_service_price_option_label || null,
                serviceUnitPrice:      sessionData.selected_service_price || 0,
                serviceTotal:          sessionData.selected_service_price || 0,
                deliveryFee:           sessionData.delivery_fee || 0,
                deliveryKm:            sessionData.delivery_km || null,
                deliveryQuoteMethod:   sessionData.delivery_quote_method || null,
                deliveryTariffBasis:   sessionData.delivery_tariff_basis || {
                  zone:   sessionData.delivery_zone || null,
                  method: sessionData.delivery_quote_method || null,
                  tariff_band_id: sessionData.delivery_tariff_band_id || null,
                },
                discountPercent:       sessionData.discount_percent || 0,
                packageCustomerId:     sessionData.package_customer_id || null,
                packageRedemptionStatus: sessionData.package_customer_id ? (sessionData.package_redemption_status || 'reserved') : null,
                packagePricingSource:  sessionData.package_customer_id ? 'package' : 'standard',
              },
            });
          }
          // Re-lock district for the new therapist/date so same-day district constraint holds
          if (sessionData.therapist_id && sessionData.district && sessionData.booking_date) {
            await lockDistrict(sessionData.therapist_id, sessionData.booking_date, sessionData.district);
          }
          if (updCal) {
            updateCalendarEvent(updCal, {
              serviceId:     sessionData.selected_service_id,
              therapistId:   sessionData.therapist_id || null,
              date:          sessionData.booking_date,
              time:          sessionData.booking_time,
              locationType:  sessionData.location_type,
              // address:       sessionData.address || null,
              customerName:  name || 'Client',
              customerPhone: phone || 'N/A',
              therapistName: sessionData.therapist_name || 'Therapist',
              latitude:      sessionData.customer_lat || null,
              longitude:     sessionData.customer_lng || null,
            }).catch(err => console.error('[GCAL] Calendar update failed:', err.message));
          }
          await resetSession(customer.id);
          reply = t.bookingUpdated(name);
          break;
        }

        let booking;
        try {
          booking = await confirmBookingAtomic({
            customerId:   customer.id,
            serviceId:    sessionData.selected_service_id,
            locationType: sessionData.location_type,
            rawDate:      sessionData.booking_date,
            rawTime:      sessionData.booking_time,
            locationId:   sessionData.location_id || null,
            therapistId:  sessionData.therapist_id || null,
            district:     sessionData.district || null,
            pricingSnapshot: {
              serviceName:           sessionData.selected_service_name || null,
              servicePriceOptionId:  sessionData.selected_service_price_option_id || null,
              serviceOptionLabel:    sessionData.selected_service_price_option_label || null,
              serviceUnitPrice:      sessionData.selected_service_price || 0,
              serviceTotal:          sessionData.selected_service_price || 0,
              deliveryFee:           sessionData.delivery_fee || 0,
              deliveryKm:            sessionData.delivery_km || null,
              deliveryQuoteMethod:   sessionData.delivery_quote_method || null,
              deliveryTariffBasis:   sessionData.delivery_tariff_basis || {
                zone:   sessionData.delivery_zone || null,
                method: sessionData.delivery_quote_method || null,
                tariff_band_id: sessionData.delivery_tariff_band_id || null,
              },
              discountPercent:       sessionData.discount_percent || 0,
              packageCustomerId:     sessionData.package_customer_id || null,
              packageRedemptionStatus: sessionData.package_customer_id ? 'reserved' : null,
              packagePricingSource:  sessionData.package_customer_id ? 'package' : 'standard',
            },
            giftDetails: sessionData.gift_details || null,
          });
        } catch (bookingErr) {
          // Slot or district was taken between revalidate and the actual write
          console.warn('[BOOKING] Atomic conflict on confirm:', bookingErr.code, bookingErr.message);
          const conflict = await redirectAfterSlotConflict(
            customer.id, sessionData,
            `⚠️ Sorry, that slot was just taken by another customer.`
          );
          reply = conflict.reply;
          break;
        }
        // Release the slot hold now that the booking is committed
        releaseHold(customer.id, sessionData.therapist_id, sessionData.booking_date).catch(() => {});
        // Assign driver then notify provider (driver name included in provider message)
        if (sessionData.therapist_id && sessionData.booking_date) {
          const riyadhToday = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
          assignDriver(sessionData.therapist_id, sessionData.booking_date, sessionData.district || null)
            .then(driver => {
              notifyProvider(sessionData, name, phone, driver?.name || null)
                .catch(err => console.error('[NOTIFY] Provider notification failed:', err.message));
              if (driver && sessionData.booking_date === riyadhToday) {
                notifyDriverSameDayBooking(sessionData.therapist_id, sessionData.booking_date, booking.id)
                  .catch(err => console.error('[DRIVER] Same-day notify failed:', err.message));
              }
            })
            .catch(err => console.error('[DRIVER] Assignment failed:', err.message));
        }
        // Create Google Calendar event — save event ID to booking for future update/delete
        createCalendarEvent({
          therapistId:   sessionData.therapist_id || null,
          serviceId:     sessionData.selected_service_id,
          date:          sessionData.booking_date,
          time:          sessionData.booking_time,
          locationType:  sessionData.location_type,
          // address:       sessionData.address || null,
          customerName:  name || 'Client',
          customerPhone: phone || 'N/A',
          therapistName: sessionData.therapist_name || 'Therapist',
          latitude:      sessionData.customer_lat || null,
          longitude:     sessionData.customer_lng || null,
        }).then(event => {
          if (event?.id && booking?.id) {
            saveCalendarEventId(booking.id, event.id).catch(() => {});
          }
        }).catch(err => console.error('[GCAL] Calendar event failed:', err.message, '| code:', err.code, '| cause:', err.cause?.message || '', err.response?.data || err.errors || ''));
        await resetSession(customer.id);
        reply = await getBookingConfirmedReply(lang, t, name || 'dear customer');
        if (sessionData.location_type === 'center') {
          const customerChatId = `${normalizeToWaId(phone)}@c.us`;
          sendLocation(customerChatId, 24.7840495, 46.8013636, 'Healing Space Center, Khaleej District, Riyadh').catch(() => {});
        }
        break;
      }

      // ── Cancel ──
      if (['no', 'n', 'لا', 'nope', 'cancel'].includes(lower)) {
        await resetSession(customer.id);
        reply = await getBookingCancelledReply(lang, t);
        break;
      }

      // ── Correction detection ──
      const correction = detectCorrection(lower);

      if (correction === 'date') {
        if (sessionData.available_slots) {
          // Availability-engine path: go back to day selection
          await updateSession(customer.id, 'booking_day_confirm');
          reply = t.connectorNoProb() + (lang === 'ar' ? 'دعينا نختار تاريخًا آخر.\n\n' : `Let's pick a different date.\n\n`) + t.askDayConfirm(sessionData.suggested_date_display);
        } else {
          await updateSession(customer.id, 'booking_date');
          reply = t.connectorNoProb() + (lang === 'ar' ? 'دعينا نحدث التاريخ.\n\n' : `Let's update the date.\n\n`) + t.askDate();
        }

      } else if (correction === 'time') {
        if (sessionData.available_slots) {
          // Availability-engine path: go back to time slot selection
          await updateSession(customer.id, 'booking_time_select');
          reply = t.connectorOfCourse() + (lang === 'ar' ? 'دعينا نختار وقتًا آخر.\n\n' : `Let's pick a different time.\n\n`) + t.askTimeSlots(sessionData.suggested_date_display, sessionData.available_slots, sessionData.location_type);
        } else {
          await updateSession(customer.id, 'booking_time');
          reply = t.connectorSure() + (lang === 'ar' ? 'دعينا نغير الوقت.\n\n' : `Let's change the time.\n\n`) + t.askTime();
        }

      } else if (correction === 'address') {
        const savedLocation = await getDefaultLocation(customer.id);
        await updateSession(customer.id, 'booking_location');
        reply = t.connectorOfCourse() + (lang === 'ar' ? 'دعينا نحدد عنوانك.\n\n' : `Let's update your address.\n\n`) + t.askLocation(savedLocation ? savedLocation.address : null);

      } else if (correction === 'service') {
        const services = await getAllServices();
        await updateSession(customer.id, 'select_service');
        reply = t.connectorSure() + (lang === 'ar' ? 'دعينا نختار خدمة أخرى.\n\n' : `Let's pick a different service!\n\n`) + t.servicesListForBooking(services);

      } else {
        // Truly unrecognized — give a helpful nudge
        reply = await aiReply(text, 'booking_summary', name, customer.id, lang);
      }
      break;
    }

    // ── booking_duplicate_confirm ─────────────────────────────────────────────
    case 'booking_duplicate_confirm': {
      if (['yes', 'y', 'نعم', 'ايوه', 'اي', 'sure', 'confirm', 'ok', 'okay', 'done'].includes(lower)) {
        // Re-validate therapist is still free before writing to DB
        const revalDup = await revalidateTherapist(sessionData);
        if (!revalDup.ok) {
          if (revalDup.newTherapistId) {
            await updateSession(customer.id, 'booking_summary', {
              therapist_id:   revalDup.newTherapistId,
              therapist_name: revalDup.newTherapistName,
            });
            reply =
              `⚠️ Your previously assigned therapist is no longer available for that slot.\n\n` +
              `We've assigned *${revalDup.newTherapistName}* instead.\n\n` +
              `Reply *Yes* to confirm, or *No* to cancel.`;
          } else {
            const conflict = await redirectAfterSlotConflict(
              customer.id, sessionData,
              `⚠️ Sorry, that slot is no longer available.`
            );
            reply = conflict.reply;
          }
          break;
        }

        let booking;
        try {
          booking = await confirmBookingAtomic({
            customerId:   customer.id,
            serviceId:    sessionData.selected_service_id,
            locationType: sessionData.location_type,
            rawDate:      sessionData.booking_date,
            rawTime:      sessionData.booking_time,
            locationId:   sessionData.location_id || null,
            therapistId:  sessionData.therapist_id || null,
            district:     sessionData.district || null,
            pricingSnapshot: {
              serviceName:           sessionData.selected_service_name || null,
              servicePriceOptionId:  sessionData.selected_service_price_option_id || null,
              serviceOptionLabel:    sessionData.selected_service_price_option_label || null,
              serviceUnitPrice:      sessionData.selected_service_price || 0,
              serviceTotal:          sessionData.selected_service_price || 0,
              deliveryFee:           sessionData.delivery_fee || 0,
              deliveryKm:            sessionData.delivery_km || null,
              deliveryQuoteMethod:   sessionData.delivery_quote_method || null,
              deliveryTariffBasis:   sessionData.delivery_tariff_basis || {
                zone:   sessionData.delivery_zone || null,
                method: sessionData.delivery_quote_method || null,
                tariff_band_id: sessionData.delivery_tariff_band_id || null,
              },
              discountPercent:       sessionData.discount_percent || 0,
              packageCustomerId:     sessionData.package_customer_id || null,
              packageRedemptionStatus: sessionData.package_customer_id ? 'reserved' : null,
              packagePricingSource:  sessionData.package_customer_id ? 'package' : 'standard',
            },
            giftDetails: sessionData.gift_details || null,
          });
        } catch (bookingErr) {
          console.warn('[BOOKING] Atomic conflict on duplicate-confirm:', bookingErr.code, bookingErr.message);
          const conflict = await redirectAfterSlotConflict(
            customer.id, sessionData,
            `⚠️ Sorry, that slot was just taken by another customer.`
          );
          reply = conflict.reply;
          break;
        }
        releaseHold(customer.id, sessionData.therapist_id, sessionData.booking_date).catch(() => {});
        // Notify assigned provider via WhatsApp
        // Assign driver then notify provider (driver name included in provider message)
        if (sessionData.therapist_id && sessionData.booking_date) {
          const riyadhToday = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
          assignDriver(sessionData.therapist_id, sessionData.booking_date, sessionData.district || null)
            .then(driver => {
              notifyProvider(sessionData, name, phone, driver?.name || null)
                .catch(err => console.error('[NOTIFY] Provider notification failed:', err.message));
              if (driver && sessionData.booking_date === riyadhToday) {
                notifyDriverSameDayBooking(sessionData.therapist_id, sessionData.booking_date, booking.id)
                  .catch(err => console.error('[DRIVER] Same-day notify failed:', err.message));
              }
            })
            .catch(err => console.error('[DRIVER] Assignment failed:', err.message));
        }
        // Create Google Calendar event — save event ID to booking for future update/delete
        createCalendarEvent({
          therapistId:   sessionData.therapist_id || null,
          serviceId:     sessionData.selected_service_id,
          date:          sessionData.booking_date,
          time:          sessionData.booking_time,
          locationType:  sessionData.location_type,
          // address:       sessionData.address || null,
          customerName:  name || 'Client',
          customerPhone: phone || 'N/A',
          therapistName: sessionData.therapist_name || 'Therapist',
          latitude:      sessionData.customer_lat || null,
          longitude:     sessionData.customer_lng || null,
        }).then(event => {
          if (event?.id && booking?.id) {
            saveCalendarEventId(booking.id, event.id).catch(() => {});
          }
        }).catch(err => console.error('[GCAL] Calendar event failed:', err.message, '| code:', err.code, '| cause:', err.cause?.message || '', err.response?.data || err.errors || ''));
        await resetSession(customer.id);
        reply = await getBookingConfirmedReply(lang, t, name || 'dear customer');
        if (sessionData.location_type === 'center') {
          const customerChatId = `${normalizeToWaId(phone)}@c.us`;
          sendLocation(customerChatId, 24.7840495, 46.8013636, 'Healing Space Center, Khaleej District, Riyadh').catch(() => {});
        }
      } else if (['no', 'n', 'لا', 'nope', 'cancel'].includes(lower)) {
        await resetSession(customer.id);
        reply = await getBookingCancelledReply(lang, t);
      } else {
        reply = await aiReply(text, 'booking_duplicate_confirm', name, customer.id, lang);
      }
      break;
    }

    // ── manage_booking_select ─────────────────────────────────────────────────
    // Unified handler for reschedule / cancel / update booking selection
    case 'manage_booking_select': {
      const mode       = sessionData.manage_mode;
      const bookingIds = sessionData.manage_booking_ids || [];

      if (text === '0' || lower === 'cancel' || lower === 'back') {
        await resetSession(customer.id);
        reply = await getBookingCancelledReply(lang, t);
        break;
      }

      // Accept "6", "Booking 6", "booking 6", "#6", etc.
      const numMatch = text.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0]) : NaN;
      if (isNaN(num) || num < 1 || num > bookingIds.length) {
        const fresh = await getReschedulableBookings(customer.id);
        if (!fresh.length) {
          await resetSession(customer.id);
          reply = t.noReschedulableBookings(mode);
        } else {
          reply = t.manageBookingList(fresh.map((b, i) => normBookingItem(b, i)), mode);
        }
        break;
      }

      const booking = await getBookingById(bookingIds[num - 1]);
      if (!booking || !['pending', 'confirmed'].includes(booking.status)) {
        await resetSession(customer.id);
        reply = t.bookingNotFound();
        break;
      }

      // Normalise date / time for session storage
      const rawDate = booking.booking_date;
      const isoDate = rawDate instanceof Date
        ? `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, '0')}-${String(rawDate.getDate()).padStart(2, '0')}`
        : String(rawDate).substring(0, 10);
      const timeStr = booking.start_time ? String(booking.start_time).substring(0, 5) : null;

      if (mode === 'cancel') {
        // Store details then ask confirmation
        await updateSession(customer.id, 'cancel_confirm', {
          cancelling_booking_id:   booking.id,
          cancelling_cal_event_id: booking.calendar_event_id || null,
          cancelling_service_name: booking.service_name,
          cancelling_date:         isoDate,
          cancelling_time:         timeStr,
        });
        reply = t.cancelConfirm(
          booking.service_name,
          isoDate ? formatDateDisplay(isoDate) : 'TBD',
          timeStr ? formatTime12h(timeStr) : 'TBD'
        );

      } else {
        // update — store full booking context then ask what to change
        await updateSession(customer.id, 'update_field_select', {
          is_update_mode:            true,
          updating_booking_id:       booking.id,
          updating_cal_event_id:     booking.calendar_event_id || null,
          selected_service_id:       booking.service_id,
          selected_service_name:     booking.service_name,
          selected_service_price:    Number(booking.service_total || booking.service_unit_price || booking.price || 0),
          selected_service_duration: booking.duration_minutes,
          selected_service_price_option_id: booking.service_price_option_id || null,
          selected_service_price_option_label: booking.service_option_label || null,
          discount_percent:          Number(booking.discount_percent || 0),
          package_customer_id:       booking.package_customer_id || null,
          package_redemption_status: booking.package_redemption_status || null,
          package_pricing_source:    booking.package_pricing_source || 'standard',
          location_type:             booking.location_type,
          location_id:               booking.location_id,
          booking_date:              isoDate,
          booking_time:              timeStr,
          therapist_id:              booking.therapist_id,
          therapist_name:            booking.therapist_name,
          // address:                   booking.address,
          district:                  booking.district,
        });
        reply = t.updateFieldSelect();
      }
      break;
    }

    // ── cancel_confirm ────────────────────────────────────────────────────────
    case 'cancel_confirm': {
      if (['yes', 'y', 'نعم', 'ايوه', 'اي', 'sure', 'ok', 'okay', 'confirm'].includes(lower)) {
        const calEventId = sessionData.cancelling_cal_event_id;
        await cancelBooking(sessionData.cancelling_booking_id);
        if (calEventId) {
          deleteCalendarEvent(calEventId).catch(err => console.error('[GCAL] Delete failed:', err.message));
        }
        await resetSession(customer.id);
        reply = t.existingBookingCancelled(sessionData.cancelling_service_name);
      } else if (['no', 'n', 'لا', 'nope'].includes(lower)) {
        await resetSession(customer.id);
        reply = lang === 'ar' ? 'لا مشكلة! تم الحفاظ على حجزك.\n\nاكتبي *0* للقائمة الرئيسية.' : `No problem! Your booking has been kept.\n\nType *0* for the main menu.`;
      } else {
        reply = await aiReply(text, 'cancel_confirm', name, customer.id, lang);
      }
      break;
    }

    // ── update_field_select ───────────────────────────────────────────────────
    case 'update_field_select': {
      if (text === '0' || lower === 'cancel') {
        await resetSession(customer.id);
        reply = await getBookingCancelledReply(lang, t);
        break;
      }

      const wantsDateTime = text === '1' || ['date', 'time', 'schedule', 'slot'].some(w => lower.includes(w));
      const wantsLocation = text === '2' || ['location', 'address', 'place'].some(w => lower.includes(w));
      const wantsBoth     = text === '3' || lower.includes('both') || lower.includes('all');

      if (wantsBoth || (wantsDateTime && wantsLocation)) {
        // Change location first, then date/time
        const saved = await getDefaultLocation(customer.id);
        await updateSession(customer.id, 'booking_location', { update_field: 'both' });
        reply = (lang === 'ar' ? 'دعينا نبدأ بعنوانك الجديد.\n\n' : `Let's start with your new address.\n\n`) + t.askLocation(saved?.address || null);

      } else if (wantsDateTime) {
        // Run availability engine for new slot
        const avail = await findNextAvailableDay(
          sessionData.selected_service_id,
          sessionData.district || null,
          sessionData.location_type,
          getToday()
        );
        if (!avail) {
          await resetSession(customer.id);
          reply = await getNoAvailabilityReply(lang, t);
          break;
        }
        await updateSession(customer.id, 'booking_day_confirm', {
          suggested_date:         avail.date,
          suggested_date_display: avail.dateDisplay,
          therapist_id:           avail.therapistId,
          therapist_name:         avail.therapistName,
          available_slots:        avail.slots,
          update_field:           'datetime',
        });
        reply = (lang === 'ar' ? `دعينا نختار تاريخًا جديدًا لـ *${sessionData.selected_service_name}*.\n\n` : `Let's pick a new date for your *${sessionData.selected_service_name}*.\n\n`) + t.askDayConfirm(avail.dateDisplay);

      } else if (wantsLocation) {
        const saved = await getDefaultLocation(customer.id);
        await updateSession(customer.id, 'booking_location', { update_field: 'location' });
        reply = (lang === 'ar' ? 'دعينا نحدد عنوانك.\n\n' : `Let's update your address.\n\n`) + t.askLocation(saved?.address || null);

      } else {
        reply = t.updateFieldSelect();
      }
      break;
    }

    // ── update_location_confirm ───────────────────────────────────────────────
    case 'update_location_confirm': {
      if (['yes', 'y', 'نعم', 'ايوه', 'اي', 'sure', 'ok', 'okay'].includes(lower)) {
        await updateBookingLocation(sessionData.updating_booking_id, {
          locationId:  sessionData.location_id,
          locationType: 'home',
          pricingSnapshot: {
            serviceName:           sessionData.selected_service_name || null,
            servicePriceOptionId:  sessionData.selected_service_price_option_id || null,
            serviceOptionLabel:    sessionData.selected_service_price_option_label || null,
            serviceUnitPrice:      sessionData.selected_service_price || 0,
            serviceTotal:          sessionData.selected_service_price || 0,
            deliveryFee:           sessionData.delivery_fee || 0,
            deliveryKm:            sessionData.delivery_km || null,
            deliveryQuoteMethod:   sessionData.delivery_quote_method || null,
            deliveryTariffBasis:   sessionData.delivery_tariff_basis || {
              zone:   sessionData.delivery_zone || null,
              method: sessionData.delivery_quote_method || null,
              tariff_band_id: sessionData.delivery_tariff_band_id || null,
            },
            discountPercent:       sessionData.discount_percent || 0,
            packageCustomerId:     sessionData.package_customer_id || null,
            packageRedemptionStatus: sessionData.package_customer_id ? (sessionData.package_redemption_status || 'reserved') : null,
            packagePricingSource:  sessionData.package_customer_id ? 'package' : 'standard',
          },
        });
        const calEventId = sessionData.updating_cal_event_id;
        if (calEventId) {
          updateCalendarEvent(calEventId, {
            serviceId:     sessionData.selected_service_id,
            therapistId:   sessionData.therapist_id || null,
            date:          sessionData.booking_date,
            time:          sessionData.booking_time,
            locationType:  'home',
            // address:       sessionData.address || null,
            customerName:  name || 'Client',
            customerPhone: phone || 'N/A',
            therapistName: sessionData.therapist_name || 'Therapist',
            latitude:      sessionData.customer_lat || null,
            longitude:     sessionData.customer_lng || null,
          }).catch(err => console.error('[GCAL] Calendar update failed:', err.message));
        }
        await resetSession(customer.id);
        reply = t.bookingUpdated(name);
      } else if (['no', 'n', 'لا', 'nope', 'cancel'].includes(lower)) {
        await resetSession(customer.id);
        reply = t.connectorNoChanges();
      } else {
        reply = await aiReply(text, 'update_location_confirm', name, customer.id, lang);
      }
      break;
    }

    // ── booking_rating ────────────────────────────────────────────────────────
    case 'booking_rating': {
      const rating = parseInt(text.trim(), 10);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        reply = await aiReply(text, 'booking_rating', name, customer.id, lang);
        break;
      }
      const bookingId   = sessionData.rating_booking_id;
      const therapistId = sessionData.rating_therapist_id;
      await saveBookingRating(bookingId, rating, therapistId);
      await updateSession(customer.id, 'booking_feedback', {
        rating_booking_id: bookingId,
        last_rating: rating,
      });
      reply = t.askFeedback(rating);
      break;
    }

    // ── booking_feedback ──────────────────────────────────────────────────────
    case 'booking_feedback': {
      const bookingId = sessionData.rating_booking_id;
      if (!['skip', 'تخطى', 'no', 'لا'].includes(lower)) {
        await saveBookingFeedback(bookingId, text.trim());
      }
      await resetSession(customer.id);
      reply = t.thankForFeedback();
      break;
    }

    // ── fallback ──────────────────────────────────────────────────────────────
    default: {
      if (!name) {
        await updateSession(customer.id, 'asking_name');
        reply = await getWelcomeNewReply(lang, t);
      } else {
        await resetSession(customer.id);
        reply = await getWelcomeBackReply(name, lang, t);
      }
    }
  }

  // Prepends "Wa Alaikum Assalam" only if a salam was detected and it's not already there.
  const finalReply = (salamPrefix && !reply.startsWith(salamPrefix)) ? (salamPrefix + reply) : reply;
  return finalReply;
}

// ─── redirectAfterSlotConflict ────────────────────────────────────────────────
// Called when a slot is no longer available.
// 1. Check if the SAME day still has other open slots → show time picker again.
// 2. If day is fully booked → find next available day.
// Returns { reply, broke: true } so caller can `break` after applying the update.
async function redirectAfterSlotConflict(customerId, sessionData, warningPrefix) {
  const sameDaySlots = await getAvailableSlotsForDay(
    sessionData.therapist_id,
    sessionData.selected_service_id,
    sessionData.booking_date,
    sessionData.location_type
  );

  if (sameDaySlots.length > 0) {
    await updateSession(customerId, 'booking_time_select', {
      available_slots:        sameDaySlots,
      suggested_date:         sessionData.booking_date,
      suggested_date_display: sessionData.booking_date_display || sessionData.booking_date,
    });
    return {
      reply: `${warningPrefix}\n\n` +
             t.askTimeSlots(
               sessionData.booking_date_display || sessionData.booking_date,
               sameDaySlots,
               sessionData.location_type
             ),
    };
  }

  // Same day fully booked — find next available day
  const nextAvail = await findNextAvailableDay(
    sessionData.selected_service_id,
    sessionData.district || null,
    sessionData.location_type,
    sessionData.booking_date
  );
  if (nextAvail) {
    await updateSession(customerId, 'booking_day_confirm', {
      suggested_date:         nextAvail.date,
      suggested_date_display: nextAvail.dateDisplay,
      available_slots:        nextAvail.slots,
      therapist_id:           nextAvail.therapistId,
      therapist_name:         nextAvail.therapistName,
    });
    return {
      reply: `${warningPrefix} The day is now fully booked.\n\n` +
             `The next available day is *${nextAvail.dateDisplay}*.\n\n` +
             `Reply *Yes* to confirm this day, *Next* for another, or *0* to cancel.`,
    };
  }

  await resetSession(customerId);
  const t = templates.forLang(sessionData.lang || 'en');
  return {
    reply: `${warningPrefix} ` + (sessionData.lang === 'ar' ? 'لا توجد مواعيد متاحة خلال 14 يوماً القادمة. يرجى التواصل معنا على +966 55 190 4178.' : 'No slots are available in the next 14 days. Please contact us at +966 55 190 4178.'),
  };
}

// ─── revalidateTherapist ──────────────────────────────────────────────────────
// Re-checks that the session therapist is still free at the chosen slot.
// Returns: { ok: true } if still available
//          { ok: false, newTherapistId, newTherapistName } if replaced by another provider
//          { ok: false, newTherapistId: null }             if no provider available at all
//
// NOTE: skipHolds=true here intentionally — customers who already hold a slot should
// not be blocked by other customers' overlapping holds (different services can have
// overlapping slot windows). The final race is resolved atomically in confirmBookingAtomic.
async function revalidateTherapist(sessionData) {
  if (!sessionData.therapist_id || !sessionData.booking_date || !sessionData.booking_time) {
    return { ok: true }; // no therapist assigned — nothing to check
  }

  // Step 1: Check district compatibility — get all providers valid for this district/date
  // This catches: district lock conflict, center-booking cross-district conflict, etc.
  const compatibleProviders = await getAvailableProvider(
    sessionData.selected_service_id,
    sessionData.district || null,
    sessionData.booking_date,
    sessionData.location_type
  );
  const isDistrictCompatible = compatibleProviders.some(p => p.id === sessionData.therapist_id);

  // Step 2: If district-compatible, also check the specific time slot is still free.
  // Skip holds — only confirmed bookings matter at this stage.
  if (isDistrictCompatible) {
    const slots = await getAvailableSlotsForDay(
      sessionData.therapist_id,
      sessionData.selected_service_id,
      sessionData.booking_date,
      sessionData.location_type,
      { skipHolds: true }
    );
    if (slots.includes(sessionData.booking_time)) return { ok: true };
  }

  // Therapist failed (district lock or slot taken by a confirmed booking) — find another
  for (const p of compatibleProviders) {
    if (p.id === sessionData.therapist_id) continue;
    const pSlots = await getAvailableSlotsForDay(
      p.id, sessionData.selected_service_id, sessionData.booking_date, sessionData.location_type,
      { skipHolds: true }
    );
    if (pSlots.includes(sessionData.booking_time)) {
      return { ok: false, newTherapistId: p.id, newTherapistName: p.name };
    }
  }
  return { ok: false, newTherapistId: null };
}

// ─── notifyProvider ───────────────────────────────────────────────────────────
// Sends a WhatsApp notification to the assigned provider after a booking is confirmed.
// Runs fire-and-forget (caller .catch()es errors so booking flow is never blocked).

async function notifyProvider(sessionData, customerName, customerPhone, driverName) {
  const therapist = await getTherapistById(sessionData.therapist_id);
  if (!therapist?.whatsapp_number) {
    console.log(`[NOTIFY] Therapist ${sessionData.therapist_id} has no whatsapp_number — skipping`);
    return;
  }

  const waId = normalizeToWaId(therapist.whatsapp_number);
  if (!waId) {
    console.warn(`[NOTIFY] Therapist ${sessionData.therapist_id} whatsapp_number "${therapist.whatsapp_number}" could not be normalized — skipping`);
    return;
  }
  const chatId = `${waId}@c.us`;
  const msg = t.providerBookingNotification({
    serviceName:   sessionData.selected_service_name || 'N/A',
    customerName:  customerName || 'Customer',
    customerPhone: normalizeToWaId(customerPhone),
    date:          sessionData.booking_date_display || sessionData.booking_date,
    time:          sessionData.booking_time_display || sessionData.booking_time,
    locationType:  sessionData.location_type,
    district:      sessionData.district || null,
    driverName:    driverName || null,
    giftDetails:   sessionData.gift_details || null,
    // price:         sessionData.selected_service_price || null,
  });

  await sendMessage(chatId, msg);
  console.log(`[NOTIFY] Sent booking notification to provider ${therapist.full_name} (${therapist.whatsapp_number})`);

  // Send location pin
  const isCenter = sessionData.location_type === 'center';
  const lat = sessionData.customer_lat ? parseFloat(sessionData.customer_lat) : null;
  const lng = sessionData.customer_lng ? parseFloat(sessionData.customer_lng) : null;

  if (lat && lng) {
    const pinLabel = isCenter ? 'Healing Space Center, Khaleej' : (sessionData.district || 'Customer Location');
    await sendLocation(chatId, lat, lng, pinLabel);
    console.log(`[NOTIFY] Location pin sent to provider ${therapist.full_name}`);
  } else if (isCenter) {
    await sendLocation(chatId, 24.7840495, 46.8013636, 'Healing Space Center, Khaleej District, Riyadh');
    console.log(`[NOTIFY] Location pin sent to provider ${therapist.full_name}`);
  } else {
    console.warn(`[NOTIFY] No coordinates for home booking — location pin skipped`);
  }
}

module.exports = { handleMessage };
