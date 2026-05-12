// Reusable separator line for visual section breaks
const LINE = `─────────────────`;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─── Welcome ──────────────────────────────────────────────────────────────────

function welcomeNew() {
  return (
    `🌸 *Welcome to Healing Space Center*
` +
    `_Women-only wellness & massage — Riyadh_

` +
    `I’m Sarah, your booking assistant. I’ll help you choose the right service and time ✨

` +
    `May I have your name to start?`
  );
}

function welcomeBack(name) {
  return (
    `🌸 *Welcome back, ${name}!*

` +
    `Lovely to see you again. How can I help you today?

` +
    mainMenuText()
  );
}

function greetingWithMenu(name) {
  return (
    `🌸 Thank you, *${name}*. Welcome to *Healing Space Center*.

` +
    `Here’s what you can do next — just reply with a number:

` +
    mainMenuText()
  );
}


// ─── Main Menu ────────────────────────────────────────────────────────────────

function mainMenuText() {
  return (
    `✨ *How can I help you today?*

` +
    `*1.* 🌿 Explore services
` +
    `*2.* 📅 Book an appointment
` +
    `*3.* 🕒 View operating hours
` +
    `*4.* 💬 Frequently asked questions
` +
    `*5.* 🤝 Talk to a human agent

` +
    `${LINE}
` +
    `Reply with a number *(1–5)*`
  );
}

function mainMenu() {
  return mainMenuText();
}

// ─── Services ─────────────────────────────────────────────────────────────────

function servicesList(services) {
  let msg = `*Our Services*\n${LINE}\n\n`;
  services.forEach((s, i) => {
    msg += `*${i + 1}.* ${s.name}  —  ${s.duration_minutes} min  •  ${s.price} SAR\n`;
  });
  msg += `\n${LINE}\n`;
  msg += `Type a number to learn more, or *0* for main menu.`;
  return msg;
}

function servicesListForBooking(services) {
  let msg = `*Choose a Service to Book*\n${LINE}\n\n`;
  services.forEach((s, i) => {
    msg += `*${i + 1}.* ${s.name}  —  ${s.duration_minutes} min  •  ${s.price} SAR\n`;
  });
  msg += `\n${LINE}\n`;
  msg += `Type the number of the service you want, or *0* for main menu.`;
  return msg;
}

function serviceDetail(service) {
  const oilText = service.oil_based ? 'Yes' : 'No (oil-free)';
  return (
    `*${service.name}*\n` +
    `_${service.name_ar}_\n` +
    `${LINE}\n` +
    `Duration  :  ${service.duration_minutes} minutes\n` +
    `Price     :  ${service.price} SAR\n` +
    `Oil-based :  ${oilText}\n` +
    `${LINE}\n` +
    `${service.description}\n` +
    `${LINE}\n` +
    `Would you like to book this service?\n` +
    `Reply *Yes* to book or *No* to go back.`
  );
}

// ─── Packages ─────────────────────────────────────────────────────────────────

function packagesList(packages) {
  let msg = `🎁 *Our Special Packages* 🎁\n${LINE}\n\n`;
  packages.forEach(p => {
    const isLoyalty = String(p.name || '').toLowerCase().includes('loyalty');
    const price = isLoyalty
      ? 'Free after referral validation'
      : (p.total_price === null || p.total_price === undefined || Number(p.total_price) === 0)
        ? 'Priced by selected service'
        : `${Number(p.total_price).toLocaleString()} SAR`;
    const validity = p.validity_days ? `  •  Valid ${p.validity_days} days` : '';
    msg += `*${p.name}*\n`;
    msg += `${p.description || ''}\n`;
    msg += `${p.total_sessions || 0} sessions  •  ${price}${validity}\n\n`;
  });
  msg += `${LINE}\n`;
  
  msg += `To request a package, start a booking and choose your service.\n\n`;
  msg += `Type *0* for main menu.`;
  return msg;
}

// ─── Hours ────────────────────────────────────────────────────────────────────

function businessHours(hours = []) {
  const centerNormal = hours.find(h => h.service_type === 'center' && !h.is_ramadan);
  const centerRamadan = hours.find(h => h.service_type === 'center' && h.is_ramadan);
  const homeNormal = hours.find(h => h.service_type === 'home' && !h.is_ramadan);
  const homeRamadan = hours.find(h => h.service_type === 'home' && h.is_ramadan);

  const format = (t) => {
    if (!t) return 'N/A';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  };

  return (
    `*Operating Hours*\n` +
    `${LINE}\n` +
    `*At the Center*  _(Riyadh — Khaleej District)_\n` +
    `Normal   :  ${format(centerNormal?.open_time)} — ${format(centerNormal?.close_time)}\n\n` +
    // `Ramadan  :  ${format(centerRamadan?.open_time)} — ${format(centerRamadan?.close_time)}\n\n` +
    `*Home Service*  _(All Riyadh)_\n` +
    `Normal   :  ${format(homeNormal?.open_time)} — ${format(homeNormal?.close_time)}\n` +
    // `Ramadan  :  ${format(homeRamadan?.open_time)} — ${format(homeRamadan?.close_time)}\n` +
    `${LINE}\n` +
    `Pre-booking required to guarantee a therapist.\n\n` +
    `Type *0* for main menu.`
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function faq() {
  return (
    `*Frequently Asked Questions*\n` +
    `${LINE}\n\n` +
    `*1. Do I need to remove clothing?*\n` +
    `Depends on the massage type. Some sessions are fully clothed and oil-free.\n\n` +
    `*2. Do you serve men?*\n` +
    `No — women only, for both center and home visits.\n\n` +
    `*3. Do I need to book in advance?*\n` +
    `Yes. Pre-booking is required to guarantee a therapist.\n\n` +
    `*4. Refund or rescheduling?*\n` +
    `Allowed up to 24 hours before your appointment.\n\n` +
    `*5. What if I arrive late?*\n` +
    `15+ minutes late = session is cancelled with no refund.\n` +
    `Any lateness is deducted from your session time.\n` +
    `${LINE}\n` +
    `Type *0* for main menu.`
  );
}

// ─── Booking flow ─────────────────────────────────────────────────────────────

function askBookingType(service = null) {
  let header = '';
  if (service) {
    header = `*${service.name}*\n` +
             (service.description ? `_${service.description}_\n` : '') +
             `Duration  :  ${service.duration_minutes || service.duration} minutes\n` +
             `Price     :  ${service.price} SAR\n` +
             `${LINE}\n\n`;
  }
  return (
    header +
    `*Choose Session Type*\n` +
    `${LINE}\n\n` +
    `*1.* At the Center  _(Riyadh — Khaleej District)_\n` +
    `*2.* Home Visit  _(anywhere in Riyadh)_\n\n` +
    `${LINE}\n` +
    `Reply *1* or *2*, or *0* to cancel.`
  );
}

function askLocation(previousAddress = null) {
  let msg =
    `*Share Your Location*\n` +
    `${LINE}\n\n` +
    `Please share your *location pin* in Riyadh:\n\n` +
    `• Tap the attach icon 📎 → *Location*\n` +
    `• Then send your current or saved location\n\n` +
    `⚠️ *Important:* Please send the *WhatsApp pin* directly. \n` +
    `Typed addresses or external links (Google Maps) are not accepted.`;

  if (previousAddress) {
    msg +=
      `\n\n${LINE}\n` +
      `Saved address: _${previousAddress}_\n` +
      `Reply *same* to use it, or share a new one.`;
  }

  msg += `\n\n${LINE}\nType *0* to cancel.`;
  return msg;
}

function askDate(hours = []) {
  const centerNormal = hours.find(h => h.service_type === 'center' && !h.is_ramadan);
  const homeNormal = hours.find(h => h.service_type === 'home' && !h.is_ramadan);

  const format = (t) => {
    if (!t) return 'N/A';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const centerStr = centerNormal ? `${format(centerNormal.open_time)} — ${format(centerNormal.close_time)}` : '1:00 PM — 10:00 PM';
  const homeStr = homeNormal ? `${format(homeNormal.open_time)} — ${format(homeNormal.close_time)}` : '12:00 PM — 12:00 AM';

  return (
    `*Choose a Date*\n` +
    `${LINE}\n\n` +
    `What date would you like to book?\n` +
    `_(e.g. 25 Feb, March 5)_\n\n` +
    `Center hours  :  ${centerStr}\n` +
    `Home service  :  ${homeStr}\n` +
    `${LINE}\n` +
    `Type *0* to cancel.`
  );
}

function askTime() {
  return (
    `*Choose a Time*\n` +
    `${LINE}\n\n` +
    `What time would you prefer?\n` +
    `_(e.g. 2:00 PM, 5:30 PM)_\n` +
    `${LINE}\n` +
    `Type *0* to cancel.`
  );
}

// Ask if customer wants to book at a different time on same date
function askDuplicateDateConfirm(existingDate, existingService, existingTime) {
  const timeDisplay = existingTime
    ? existingTime.substring(0, 5)  // Convert HH:MM:SS to HH:MM
    : 'a time already scheduled';

  return (
    `*You Already Have a Booking on This Date*\n` +
    `${LINE}\n\n` +
    `Date    :  *${existingDate}*\n` +
    `Service :  ${existingService || 'your service'}\n` +
    `Time    :  ${timeDisplay}\n\n` +
    `Would you like to book a *different time* on the same date?\n\n` +
    `${LINE}\n` +
    `Reply *Yes* to continue, or *No* to choose a different date.`
  );
}

function bookingSummary({ serviceName, duration, price, locationType, address, date, time, therapistName, deliveryFee = 0, deliveryKm, discountPercent = 0 }) {
  const locationLine = locationType === 'home'
    ? `Home Visit\n   Address   :  ${address}`
    : `At the Center _(Khaleej District)_`;
  const serviceTotal = Number(price || 0);
  const hasDeliveryQuote = locationType !== 'home' || deliveryFee !== null;
  const deliveryTotal = locationType === 'home' ? (deliveryFee === null ? null : Number(deliveryFee || 0)) : 0;
  const discount = Number(discountPercent || 0);
  const serviceDiscountAmount = Math.round((serviceTotal * discount / 100) * 100) / 100;
  const finalTotal = hasDeliveryQuote ? Math.max(0, Math.round((serviceTotal + (deliveryTotal || 0) - serviceDiscountAmount) * 100) / 100) : null;

  let msg =
    `*Booking Summary*\n` +
    `${LINE}\n` +
    `Service   :  ${serviceName}\n` +
    `Duration  :  ${duration} minutes\n` +
    `Type      :  ${locationLine}\n` +
    `Date      :  ${date}\n` +
    `Time      :  ${time}\n` +
    `${LINE}\n` +
    `Service total   :  ${serviceTotal} SAR\n` +
    `Delivery total  :  ${deliveryTotal === null ? 'Pending quote' : `${deliveryTotal} SAR`}${deliveryKm ? ` (${deliveryKm} km)` : ''}\n` +
    `Service discount:  ${discount}% (-${serviceDiscountAmount} SAR)\n` +
    `Final total     :  ${finalTotal === null ? 'Pending quote' : `${finalTotal} SAR`}\n`;

  if (discount > 0 && locationType === 'home') {
    msg += `Note: package/service discount does not remove the home delivery fee.\n`;
  }

  if (therapistName) {
    msg += `Therapist :  ${therapistName}\n`;
  }

  msg +=
    `${LINE}\n` +
    `Reply *Yes* to approve this price and confirm, or *No* to cancel.\n` +
    `To change anything, just say — e.g. _"change date"_ or _"wrong time"_.`;

  return msg;
}

function deliveryFeeInfo(deliveryKm, deliveryFee) {
  if (deliveryFee === null || deliveryFee === undefined) return `Delivery fee is pending manual confirmation.`;
  const kmText = deliveryKm ? ` for approximately ${deliveryKm} km` : '';
  return `Delivery fee${kmText}: *${deliveryFee} SAR*.`;
}

// ─── Availability / Scheduling ────────────────────────────────────────────────

function askDayConfirm(dateDisplay) {
  return (
    `*Next Available Day*\n` +
    `${LINE}\n` +
    `*${dateDisplay}*\n` +
    `${LINE}\n` +
    `*Yes*   — Confirm this date\n` +
    `*Next*  — Show next available day\n` +
    `*0*     — Cancel\n\n` +
    `_Or type a specific date, e.g. "28 Feb"_`
  );
}

function askTimeSlots(dateDisplay, slots, locationType = '') {
  const typeLabel = locationType === 'center'
    ? '🏢 Center'
    : locationType === 'home'
      ? '🏠 Home Visit'
      : '';

  let msg =
    `*Available Times*\n` +
    (typeLabel ? `_${typeLabel}_  •  ` : `_`) +
    `_${dateDisplay}_\n` +
    `${LINE}\n\n`;

  slots.forEach((s, i) => {
    const [h, m] = s.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12    = h % 12 || 12;
    msg += `  *${i + 1}.*  ${h12}:${String(m).padStart(2, '0')} ${period}\n`;
  });

  msg += `\n${LINE}\n`;
  msg += `Reply with a slot number (e.g. *1*), or *0* to cancel.`;
  return msg;
}

function noAvailability() {
  return (
    `*No Appointments Available*\n` +
    `${LINE}\n` +
    `Currently, all slots are full for the next 14 days for the selected service in your area.\n\n` +
    `Please contact us directly and we will arrange a booking for you:\n` +
    `*+966 55 190 4178*\n` +
    `${LINE}\n` +
    `Type *0* for main menu.`
  );
}

function therapistDailySummary({ dateDisplay, therapistName, bookingsCount, lines }) {
  return (
    `💆‍♀️ *Schedule for tomorrow: ${dateDisplay}*\n` +
    `Provider: ${therapistName}\n` +
    `Total: ${bookingsCount} appointment(s)\n` +
    `${LINE}\n\n` +
    lines.join(`\n${LINE}\n`) +
    `\n\n${LINE}\n` +
    `Please check the location pins sent below.`
  );
}

function therapistBookingItemLine({ num, time, service, customer, phone, district, price }) {
  const amount   = price ? `${Number(price).toFixed(0)} SAR` : 'N/A';
  return (
    `*${num}. ${time}*\n` +
    `👤 *Client:* ${customer || 'N/A'}\n` +
    `💆 *Service:* ${service || 'N/A'}\n` +
    `📍 *Area:* ${district || 'N/A'}\n` +
    `💰 *Collect:* ${amount}\n` +
    `📱 *Contact:* +${phone}`
  );
}

function providerBookingNotification({ serviceName, customerName, customerPhone, date, time, locationType, district, driverName, price }) {
  const locationLabel = locationType === 'center' ? '🏢 Center (Khaleej District)' : '🏠 Home Visit';
  const areaLine = district ? `📍 *Area:* ${district}\n` : '';
  const amount   = price ? `${Number(price).toFixed(0)} SAR` : 'N/A';
  return (
    `🆕 *New Booking Assigned to You*\n` +
    `${LINE}\n` +
    `💆 *Service:* ${serviceName || 'N/A'}\n` +
    `👤 *Client:* ${customerName || 'N/A'}\n` +
    `📅 *Date:* ${date}\n` +
    `🕐 *Time:* ${time}\n` +
    `🏠 *Type:* ${locationLabel}\n` +
    areaLine +
    `🚗 *Driver:* ${driverName || 'Not assigned'}\n` +
    `💰 *Collect:* ${amount} (cash)\n` +
    `📱 *Contact:* +${customerPhone}\n` +
    `${LINE}\n` +
    `Please be on time. Contact us if you have any issues.`
  );
}

function notInServiceArea(city) {
  const cityName = city || 'your city';
  return (
    `*Service Not Available*\n` +
    `${LINE}\n` +
    `Sorry, we currently only provide services in *Riyadh*.\n\n` +
    `We don't serve *${cityName}* yet.\n\n` +
    `${LINE}\n` +
    `Type *0* for main menu.`
  );
}

function noProviderInArea() {
  return noAvailability();
}

function bookingConfirmed(name) {
  return (
    `*Booking Confirmed*\n` +
    `${LINE}\n` +
    `Thank you, *${name}*. Your booking is confirmed.\n\n` +
    `We will be in touch shortly to finalize the details.\n` +
    `${LINE}\n` +
    `_Healing Space Center_\n` +
    `_"Expert in delivering exactly what you need to feel better."_\n\n` +
    `Type *0* for main menu.`
  );
}

function bookingCancelled() {
  return (
    `*Booking Cancelled*\n` +
    `${LINE}\n` +
    `No problem at all — you can start a new booking anytime.\n\n` +
    `Type *0* for main menu.`
  );
}

// ─── Generic ──────────────────────────────────────────────────────────────────

function invalidOption() {
  return `That option is not available. Please choose from the list provided.`;
}

function errorMessage() {
  return `Something went wrong on our end. Please try again or contact us at *+966 55 190 4178*.`;
}

// ─── Manage Booking (reschedule / cancel / update) ────────────────────────────

// items: [{ num, service, date, time, type }]
// mode: 'reschedule' | 'cancel' | 'update'
function manageBookingList(items, mode) {
  const titles = {
    reschedule: 'Reschedule a Booking',
    cancel:     'Cancel a Booking',
    update:     'Update a Booking',
  };
  const notes = {
    reschedule: 'The selected booking will be cancelled and you can pick a new slot.',
    cancel:     'The selected booking will be permanently cancelled.',
    update:     'Choose a booking to modify its date, time, or location.',
  };
  let msg = `*${titles[mode]}*\n${LINE}\n_${notes[mode]}_\n\n`;
  items.forEach(item => {
    const locIcon = item.type === 'home' ? '🏠 Home' : '🏢 Center';
    msg += `*${item.num}.* ${item.service}\n`;
    msg += `     📅 ${item.date}  •  🕐 ${item.time}  •  ${locIcon}\n\n`;
  });
  msg += `${LINE}\nReply with a number, or *0* to go back.`;
  return msg;
}

function cancelConfirm(serviceName, dateStr, timeStr) {
  return (
    `*Confirm Cancellation*\n` +
    `${LINE}\n` +
    `Service : ${serviceName || 'N/A'}\n` +
    `Date    : ${dateStr}\n` +
    `Time    : ${timeStr}\n` +
    `${LINE}\n` +
    `Are you sure you want to cancel this booking?\n\n` +
    `Reply *Yes* to confirm, or *No* to keep it.`
  );
}

function updateFieldSelect() {
  return (
    `*What would you like to change?*\n` +
    `${LINE}\n\n` +
    `*1.* Date & Time\n` +
    `*2.* Location / Address\n` +
    `*3.* Both\n\n` +
    `${LINE}\n` +
    `Reply with *1*, *2*, or *3*, or *0* to cancel.`
  );
}

function updateLocationConfirm(newAddress, existingDate, existingTime, deliveryFee = null, deliveryKm = null) {
  const deliveryLine = deliveryFee === null || deliveryFee === undefined
    ? ''
    : `Delivery fee: ${deliveryFee} SAR${deliveryKm ? ` (${deliveryKm} km)` : ''}
`;
  return (
    `*Confirm New Address*
` +
    `${LINE}
` +
    `New Address : ${newAddress}
` +
    `Date        : ${existingDate}
` +
    `Time        : ${existingTime}
` +
    deliveryLine +
    `${LINE}
` +
    `Reply *Yes* to approve this updated delivery price and save the address, or *No* to cancel.`
  );
}


function bookingUpdated(name) {
  return (
    `*Booking Updated*\n` +
    `${LINE}\n` +
    `Your booking has been updated successfully, *${name || 'dear customer'}*.\n\n` +
    `We will be in touch with the updated details.\n` +
    `${LINE}\n` +
    `Type *0* for main menu.`
  );
}

function existingBookingCancelled(serviceName) {
  return (
    `*Booking Cancelled*\n` +
    `${LINE}\n` +
    `Your *${serviceName || 'booking'}* has been cancelled.\n\n` +
    `If you'd like to book again, reply *2* anytime.\n` +
    `${LINE}\n` +
    `Type *0* for main menu.`
  );
}

function noBookings() {
  return `You don't have any bookings yet.\n\nReply *2* to book a service, or *0* for the main menu.`;
}

function bookingHistoryHeader(name) {
  return `Your booking history, ${name || 'dear customer'}:\n\n${LINE}\n`;
}

function bookingHistoryFooter() {
  return `\n${LINE}\n\nReply *0* for the main menu or *2* to make a new booking.`;
}

function bookingHistoryItem({ num, status, service, date, time, type, address, therapist, rating }) {
  const typeLabel = type === 'home' ? 'Home Visit' : 'Center';
  const addrLine  = address ? `\nAddress   : ${address}` : '';
  const therapistLine = therapist ? `\nTherapist : ${therapist}` : '';
  const ratingLine = rating ? `\nRating    : ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)` : '';
  
  return (
    `*Booking ${num}*\n` +
    `Status    : ${status}\n` +
    `Service   : ${service || 'N/A'}\n` +
    `Date      : ${date || 'TBD'}\n` +
    `Time      : ${time || 'TBD'}\n` +
    `Type      : ${typeLabel}` +
    addrLine +
    therapistLine +
    ratingLine
  );
}

function noReschedulableBookings(mode) {
  return `You don't have any active bookings to ${mode}.\n\nReply *2* to make a new booking, or *0* for the main menu.`;
}

function bookingNotFound() {
  return `That booking is no longer available. Type *0* for the main menu.`;
}

function connectorNoChanges() {
  return `No changes made. Type *0* for the main menu.`;
}

function pastDateReject(reqDisplay) {
  return `⚠️ *${reqDisplay}* is in the past.\n\nPlease choose a date from today onwards, or reply *Next* to see the next available day.`;
}

function advanceBookingLimit(maxDays, latestDate) {
  return (
    `⚠️ Sorry, we only accept bookings up to *${maxDays} days* in advance.\n\n` +
    `The latest available date you can book is *${latestDate}*.\n\n` +
    `Please choose a date within this window, or reply *Next* to see the next available day.`
  );
}

function slotNoLongerAvailable() {
  return `⚠️ Sorry, that slot was just taken by another customer.`;
}

module.exports = {
  welcomeNew,
  welcomeBack,
  greetingWithMenu,
  mainMenu,
  mainMenuText,
  servicesList,
  servicesListForBooking,
  serviceDetail,
  packagesList,
  businessHours,
  faq,
  askBookingType,
  askLocation,
  askDate,
  askTime,
  askDuplicateDateConfirm,
  bookingSummary,
  deliveryFeeInfo,
  bookingConfirmed,
  bookingCancelled,
  invalidOption,
  errorMessage,
  askDayConfirm,
  askTimeSlots,
  noAvailability,
  noProviderInArea,
  notInServiceArea,
  providerBookingNotification,
  therapistDailySummary,
  therapistBookingItemLine,
  noBookings,
  bookingHistoryHeader,
  bookingHistoryItem,
  noReschedulableBookings,
  bookingNotFound,
  connectorNoChanges,
  pastDateReject,
  advanceBookingLimit,
  slotNoLongerAvailable,
  daySuggestionFollowup,
  bookingHistoryFooter,
  connectorNoProb,
  connectorSure,
  connectorOfCourse,
  connectorOk,
  connectorGreatNews,
  connectorSorryAllBooked,
  connectorNoAppointmentsLeft,
  connectorUpdateDate,
  connectorUpdateAddress,
  connectorPickService,
  askRating,
  askFeedback,
  thankForFeedback,
  manageBookingList,
  cancelConfirm,
  updateFieldSelect,
  updateLocationConfirm,
  bookingUpdated,
  existingBookingCancelled,
  linkNotAccepted,
  didNotUnderstand,
};

function didNotUnderstand() {
  const options = [
    `I'm sorry, I didn't quite catch that. Could you please try again?`,
    `I'm not sure I understood. Could you repeat that or choose an option from the menu?`,
    `My apologies, I didn't get that. Could you please rephrase or pick a number?`,
    `I didn't quite understand your message. How can I help you?`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function linkNotAccepted() {
  return (
    `⚠️ *Links are not accepted*\n` +
    `${LINE}\n\n` +
    `Please share your *location pin* directly through WhatsApp:\n\n` +
    `• Tap the attach icon 📎 → *Location*\n` +
    `• Then send your current or saved location\n\n` +
    `Typed addresses or external links (Google Maps) cannot be processed by the system.`
  );
}

function askRating(name, sessionInfo = {}) {
  const { serviceName, date, time } = sessionInfo;
  const sessionLine = serviceName
    ? `\n📋 *Session:* ${serviceName}${date ? `  |  📅 ${date}` : ''}${time ? `  |  🕐 ${time}` : ''}\n`
    : '';
  return (
    `💆‍♀️ Hi ${name || 'there'}! We hope you enjoyed your session today.${sessionLine}\n` +
    `We'd love to hear how it went — could you take a moment to rate your experience?\n\n` +
    `1 — Poor\n` +
    `2 — Fair\n` +
    `3 — Good\n` +
    `4 — Great\n` +
    `5 — Excellent ⭐\n\n` +
    `Simply reply with a number from *1* to *5*. Your feedback means a lot to us! 🙏`
  );
}

function askFeedback(rating) {
  const praise = rating >= 4
    ? `We're so glad you had a great experience! 😊`
    : rating === 3
      ? `Thank you — we'll keep working to make it even better! 💪`
      : `We're sorry it wasn't perfect — we truly appreciate your honesty.`;
  return (
    `${praise}\n\n` +
    `Would you like to share any additional comments about your session?\n\n` +
    `Feel free to write anything — or simply reply *skip* if you prefer not to.`
  );
}

function thankForFeedback() {
  return (
    `🌸 Thank you so much for your feedback!\n\n` +
    `It means a lot to us and helps us deliver the best possible experience.\n\n` +
    `We look forward to welcoming you again at *Healing Space*. See you soon! 💆‍♀️`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Arabic translations ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const AR = {
  welcomeNew() {
    return (
      `🌸 *مرحباً بك في هيلينج سبيس سنتر*
` +
      `_عناية ومساج نسائي — الرياض_

` +
      `أنا سارة، مساعدتك للحجز. أساعدك تختارين الخدمة والوقت المناسب بكل سهولة ✨

` +
      `ما اسمك الكريم لنبدأ؟`
    );
  },

  welcomeBack(name) {
    return (
      `🌸 *أهلاً بعودتك، ${name}!*

` +
      `يسعدني خدمتك مرة أخرى. كيف أقدر أساعدك اليوم؟

` +
      AR.mainMenuText()
    );
  },

  greetingWithMenu(name) {
    return (
      `🌸 شكراً لك، *${name}*. أهلاً بك في *هيلينج سبيس سنتر*.

` +
      `اختاري الخطوة التالية بالرد برقم من القائمة:

` +
      AR.mainMenuText()
    );
  },

  mainMenuText() {
    return (
      `✨ *كيف أقدر أساعدك اليوم؟*

` +
      `*1.* 🌿 تصفح الخدمات
` +
      `*2.* 📅 حجز موعد
` +
      `*3.* 🕒 أوقات العمل
` +
      `*4.* 💬 الأسئلة الشائعة
` +
      `*5.* 🤝 التحدث مع موظفة

` +
      `${LINE}
` +
      `ارسلي رقم من *(1–5)*`
    );
  },

  mainMenu() {
    return AR.mainMenuText();
  },

  servicesList(services) {
    let msg = `*خدماتنا*\n${LINE}\n\n`;
    services.forEach((s, i) => {
      msg += `*${i + 1}.* ${s.name_ar || s.name}  —  ${s.duration_minutes} دقيقة  •  ${s.price} ريال\n`;
    });
    msg += `\n${LINE}\n`;
    msg += `اكتبي رقماً للمزيد من التفاصيل، أو *0* للقائمة الرئيسية.`;
    return msg;
  },

  servicesListForBooking(services) {
    let msg = `*اختاري الخدمة للحجز*\n${LINE}\n\n`;
    services.forEach((s, i) => {
      msg += `*${i + 1}.* ${s.name_ar || s.name}  —  ${s.duration_minutes} دقيقة  •  ${s.price} ريال\n`;
    });
    msg += `\n${LINE}\n`;
    msg += `اكتبي رقم الخدمة التي تريدينها، أو *0* للقائمة الرئيسية.`;
    return msg;
  },

  serviceDetail(service) {
    const oilText = service.oil_based ? 'نعم' : 'لا (بدون زيت)';
    return (
      `*${service.name_ar || service.name}*\n` +
      `_${service.name}_\n` +
      `${LINE}\n` +
      `المدة     :  ${service.duration_minutes} دقيقة\n` +
      `السعر    :  ${service.price} ريال\n` +
      `زيت      :  ${oilText}\n` +
      `${LINE}\n` +
      `${service.description || ''}\n` +
      `${LINE}\n` +
      `هل تريدين حجز هذه الخدمة؟\n` +
      `اردي *نعم* للحجز أو *لا* للرجوع.`
    );
  },

  packagesList(packages) {
    let msg = `*باقاتنا*\n${LINE}\n\n`;
    packages.forEach(p => {
      msg += `*${p.name}*\n`;
      msg += `${p.description}\n`;
      msg += `${p.total_sessions} جلسات  •  ${Number(p.total_price).toLocaleString()} ريال  •  صالحة ${p.validity_days} يوم\n\n`;
    });
    msg += `${LINE}\n`;
    msg += `_يمكنك دمج أي نوع جلسة طالما تتطابق المدة والسعر._\n\n`;
    msg += `لحجز باقة، ابدئي حجزاً واختاري خدمتك.\n\n`;
    msg += `اكتبي *0* للقائمة الرئيسية.`;
    return msg;
  },

  businessHours(hours = []) {
    const centerNormal = hours.find(h => h.service_type === 'center' && !h.is_ramadan);
    const centerRamadan = hours.find(h => h.service_type === 'center' && h.is_ramadan);
    const homeNormal = hours.find(h => h.service_type === 'home' && !h.is_ramadan);
    const homeRamadan = hours.find(h => h.service_type === 'home' && h.is_ramadan);

    const format = (t) => {
      if (!t) return 'N/A';
      const [h, m] = t.split(':').map(Number);
      const period = h >= 12 ? 'م' : 'ص';
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, '0')} ${period}`;
    };

    return (
      `*ساعات العمل*\n` +
      `${LINE}\n` +
      `*في المركز*  _(الرياض — حي الخليج)_\n` +
      `عادي   :  ${format(centerNormal?.open_time)} — ${format(centerNormal?.close_time)}\n\n` +
      // `رمضان  :  ${format(centerRamadan?.open_time)} — ${format(centerRamadan?.close_time)}\n\n` +
      `*الخدمة المنزلية*  _(جميع أحياء الرياض)_\n` +
      `عادي   :  ${format(homeNormal?.open_time)} — ${format(homeNormal?.close_time)}\n` +
      // `رمضان  :  ${format(homeRamadan?.open_time)} — ${format(homeRamadan?.close_time)}\n` +
      `${LINE}\n` +
      `الحجز المسبق مطلوب لضمان توفر المعالجة.\n\n` +
      `اكتبي *0* للقائمة الرئيسية.`
    );
  },

  faq() {
    return (
      `*الأسئلة الشائعة*\n` +
      `${LINE}\n\n` +
      `*1. هل أحتاج لخلع ملابسي؟*\n` +
      `يعتمد على نوع المساج. بعض الجلسات تكون بالملابس الكاملة وبدون زيت.\n\n` +
      `*2. هل تقدمون خدمات للرجال؟*\n` +
      `لا — للسيدات فقط، سواء في المركز أو الزيارات المنزلية.\n\n` +
      `*3. هل أحتاج للحجز مسبقاً؟*\n` +
      `نعم. الحجز المسبق مطلوب لضمان توفر المعالجة.\n\n` +
      `*4. ما سياسة الاسترداد والتغيير؟*\n` +
      `متاح قبل 24 ساعة من الموعد.\n\n` +
      `*5. ماذا لو تأخرت؟*\n` +
      `التأخير 15 دقيقة فأكثر = إلغاء الجلسة بدون استرداد.\n` +
      `أي تأخير يُخصم من وقت جلستك.\n` +
      `${LINE}\n` +
      `اكتبي *0* للقائمة الرئيسية.`
    );
  },

  askBookingType(service = null) {
    let header = '';
    if (service) {
      header = `*${service.name_ar || service.name}*\n` +
               (service.description ? `_${service.description}_\n` : '') +
               `المدة     :  ${service.duration_minutes || service.duration} دقيقة\n` +
               `السعر    :  ${service.price} ريال\n` +
               `${LINE}\n\n`;
    }
    return (
      header +
      `*اختاري نوع الجلسة*\n` +
      `${LINE}\n\n` +
      `*1.* في المركز  _(الرياض — حي الخليج)_\n` +
      `*2.* زيارة منزلية  _(أي حي في الرياض)_\n\n` +
      `${LINE}\n` +
      `اردي *1* أو *2*، أو *0* للإلغاء.`
    );
  },

  askLocation(previousAddress = null) {
    let msg =
      `*شاركي موقعك*\n` +
      `${LINE}\n\n` +
      `من فضلك شاركي *دبوس موقعك* في الرياض:\n\n` +
      `• اضغطي على أيقونة المرفقات 📎 ← *الموقع*\n` +
      `• ثم أرسلي موقعك الحالي أو المحفوظ\n\n` +
      `⚠️ *مهم:* أرسلي *دبوس الواتساب* مباشرة.\n` +
      `العناوين المكتوبة أو روابط خرائط جوجل غير مقبولة.`;

    if (previousAddress) {
      msg +=
        `\n\n${LINE}\n` +
        `العنوان المحفوظ: _${previousAddress}_\n` +
        `اردي *same* لاستخدامه، أو شاركي موقعاً جديداً.`;
    }

    msg += `\n\n${LINE}\nاكتبي *0* للإلغاء.`;
    return msg;
  },

  askDate(hours = []) {
    const centerNormal = hours.find(h => h.service_type === 'center' && !h.is_ramadan);
    const homeNormal = hours.find(h => h.service_type === 'home' && !h.is_ramadan);

    const format = (t) => {
      if (!t) return 'N/A';
      const [h, m] = t.split(':').map(Number);
      const period = h >= 12 ? 'م' : 'ص';
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, '0')} ${period}`;
    };

    const centerStr = centerNormal ? `${format(centerNormal.open_time)} — ${format(centerNormal.close_time)}` : '1:00 م — 10:00 م';
    const homeStr = homeNormal ? `${format(homeNormal.open_time)} — ${format(homeNormal.close_time)}` : '12:00 م — 12:00 ص';

    return (
      `*اختاري التاريخ*\n` +
      `${LINE}\n\n` +
      `ما التاريخ الذي تريدين الحجز فيه؟\n` +
      `_(مثال: 25 فبراير، 5 مارس)_\n\n` +
      `ساعات المركز     :  ${centerStr}\n` +
      `الخدمة المنزلية  :  ${homeStr}\n` +
      `${LINE}\n` +
      `اكتبي *0* للإلغاء.`
    );
  },

  askTime() {
    return (
      `*اختاري الوقت*\n` +
      `${LINE}\n\n` +
      `ما الوقت المناسب لك؟\n` +
      `_(مثال: 2:00 م، 5:30 م)_\n` +
      `${LINE}\n` +
      `اكتبي *0* للإلغاء.`
    );
  },

  askDuplicateDateConfirm(existingDate, existingService, existingTime) {
    const timeDisplay = existingTime
      ? existingTime.substring(0, 5)
      : 'وقت محجوز';
    return (
      `*لديك حجز في هذا التاريخ*\n` +
      `${LINE}\n\n` +
      `التاريخ    :  *${existingDate}*\n` +
      `الخدمة    :  ${existingService || 'خدمتك'}\n` +
      `الوقت     :  ${timeDisplay}\n\n` +
      `هل تريدين حجز *وقت مختلف* في نفس اليوم؟\n\n` +
      `${LINE}\n` +
      `اردي *نعم* للمتابعة، أو *لا* لاختيار تاريخ آخر.`
    );
  },

  bookingSummary({ serviceName, duration, price, locationType, address, date, time, therapistName, deliveryFee = 0, deliveryKm, discountPercent = 0 }) {
    const locationLine = locationType === 'home'
      ? `زيارة منزلية\n   العنوان  :  ${address}`
      : `في المركز _(حي الخليج)_`;
    const serviceTotal = Number(price || 0);
    const hasDeliveryQuote = locationType !== 'home' || deliveryFee !== null;
    const deliveryTotal = locationType === 'home' ? (deliveryFee === null ? null : Number(deliveryFee || 0)) : 0;
    const discount = Number(discountPercent || 0);
    const serviceDiscountAmount = Math.round((serviceTotal * discount / 100) * 100) / 100;
    const finalTotal = hasDeliveryQuote ? Math.max(0, Math.round((serviceTotal + (deliveryTotal || 0) - serviceDiscountAmount) * 100) / 100) : null;

    let msg =
      `*ملخص الحجز*\n` +
      `${LINE}\n` +
      `الخدمة    :  ${serviceName}\n` +
      `المدة     :  ${duration} دقيقة\n` +
      `النوع    :  ${locationLine}\n` +
      `التاريخ  :  ${date}\n` +
      `الوقت   :  ${time}\n` +
      `${LINE}\n` +
      `إجمالي الخدمة   :  ${serviceTotal} ريال\n` +
      `إجمالي التوصيل :  ${deliveryTotal === null ? 'بانتظار التسعير' : `${deliveryTotal} ريال`}${deliveryKm ? ` (${deliveryKm} كم)` : ''}\n` +
      `خصم الخدمة      :  ${discount}% (-${serviceDiscountAmount} ريال)\n` +
      `الإجمالي النهائي:  ${finalTotal === null ? 'بانتظار التسعير' : `${finalTotal} ريال`}\n`;

    if (discount > 0 && locationType === 'home') {
      msg += `ملاحظة: خصم الباقة/الخدمة لا يلغي رسوم الزيارة المنزلية.\n`;
    }

    if (therapistName) {
      msg += `المعالجة  :  ${therapistName}\n`;
    }

    msg +=
      `${LINE}\n` +
      `اردي *نعم* للموافقة على السعر والتأكيد، أو *لا* للإلغاء.\n` +
      `لتغيير أي شيء، قولي — مثال: _"تغيير التاريخ"_ أو _"الوقت غلط"_.`;

    return msg;
  },


  deliveryFeeInfo(deliveryKm, deliveryFee) {
    if (deliveryFee === null || deliveryFee === undefined) return `رسوم التوصيل بانتظار التأكيد اليدوي.`;
    const kmText = deliveryKm ? ` لمسافة تقريبية ${deliveryKm} كم` : '';
    return `رسوم التوصيل${kmText}: *${deliveryFee} ريال*.`;
  },
  askDayConfirm(dateDisplay) {
    return (
      `*أقرب يوم متاح*\n` +
      `${LINE}\n` +
      `*${dateDisplay}*\n` +
      `${LINE}\n` +
      `*نعم*    — تأكيد هذا التاريخ\n` +
      `*التالي* — عرض اليوم التالي المتاح\n` +
      `*0*      — إلغاء\n\n` +
      `_أو اكتبي تاريخاً محدداً، مثل "28 فبراير"_`
    );
  },

  askTimeSlots(dateDisplay, slots, locationType = '') {
    const typeLabel = locationType === 'center'
      ? '🏢 في المركز'
      : locationType === 'home'
        ? '🏠 زيارة منزلية'
        : '';

    let msg =
      `*الأوقات المتاحة*\n` +
      (typeLabel ? `_${typeLabel}_  •  ` : `_`) +
      `_${dateDisplay}_\n` +
      `${LINE}\n\n`;

    slots.forEach((s, i) => {
      const [h, m] = s.split(':').map(Number);
      const period = h >= 12 ? 'م' : 'ص';
      const h12    = h % 12 || 12;
      msg += `  *${i + 1}.*  ${h12}:${String(m).padStart(2, '0')} ${period}\n`;
    });

    msg += `\n${LINE}\n`;
    msg += `اردي برقم الوقت المناسب (مثال: *1*)، أو *0* للإلغاء.`;
    return msg;
  },

  noAvailability() {
    return (
      `*لا توجد مواعيد متاحة حالياً*\n` +
      `${LINE}\n` +
      `نعتذر، جميع المواعيد محجوزة بالكامل للأسبوعين القادمين للخدمة المختارة في منطقتك.\n\n` +
      `يرجى التواصل معنا مباشرة وسنرتب لك حجزاً:\n` +
      `*+966 55 190 4178*\n` +
      `${LINE}\n` +
      `اكتبي *0* للقائمة الرئيسية.`
    );
  },

  noProviderInArea() {
    return AR.noAvailability();
  },

  notInServiceArea(city) {
    const cityName = city || 'مدينتك';
    return (
      `*الخدمة غير متاحة*\n` +
      `${LINE}\n` +
      `نأسف، نقدم خدماتنا حالياً في *الرياض* فقط.\n\n` +
      `لا نخدم *${cityName}* حتى الآن.\n\n` +
      `${LINE}\n` +
      `اكتبي *0* للقائمة الرئيسية.`
    );
  },

  bookingConfirmed(name) {
    return (
      `*تم تأكيد الحجز*\n` +
      `${LINE}\n` +
      `شكراً، *${name}*. تم تأكيد حجزك.\n\n` +
      `سنتواصل معك قريباً لتأكيد التفاصيل.\n` +
      `${LINE}\n` +
      `_هيلينج سبيس سنتر_\n` +
      `_"خبراء في تقديم ما تحتاجينه للشعور بتحسن."_\n\n` +
      `اكتبي *0* للقائمة الرئيسية.`
    );
  },

  bookingCancelled() {
    return (
      `*تم إلغاء الحجز*\n` +
      `${LINE}\n` +
      `لا مشكلة — يمكنك بدء حجز جديد في أي وقت.\n\n` +
      `اكتبي *0* للقائمة الرئيسية.`
    );
  },

  invalidOption() {
    return `هذا الخيار غير متاح. الرجاء الاختيار من القائمة المعروضة.`;
  },

  errorMessage() {
    return `حدث خطأ من طرفنا. يرجى المحاولة مرة أخرى أو التواصل معنا على *+966 55 190 4178*.`;
  },

  manageBookingList(items, mode) {
    const titles = {
      reschedule: 'إعادة جدولة حجز',
      cancel:     'إلغاء حجز',
      update:     'تعديل حجز',
    };
    const notes = {
      reschedule: 'سيتم إلغاء الحجز المختار ويمكنك اختيار موعد جديد.',
      cancel:     'سيتم إلغاء الحجز المختار بشكل نهائي.',
      update:     'اختاري حجزاً لتعديل تاريخه أو وقته أو موقعه.',
    };
    let msg = `*${titles[mode]}*\n${LINE}\n_${notes[mode]}_\n\n`;
    items.forEach(item => {
      const locIcon = item.type === 'home' ? '🏠 منزلي' : '🏢 مركز';
      msg += `*${item.num}.* ${item.service}\n`;
      msg += `     📅 ${item.date}  •  🕐 ${item.time}  •  ${locIcon}\n\n`;
    });
    msg += `${LINE}\nاردي برقم، أو *0* للرجوع.`;
    return msg;
  },

  cancelConfirm(serviceName, dateStr, timeStr) {
    return (
      `*تأكيد الإلغاء*\n` +
      `${LINE}\n` +
      `الخدمة  : ${serviceName || 'غير محدد'}\n` +
      `التاريخ  : ${dateStr}\n` +
      `الوقت   : ${timeStr}\n` +
      `${LINE}\n` +
      `هل أنت متأكدة من إلغاء هذا الحجز؟\n\n` +
      `اردي *نعم* للتأكيد، أو *لا* للإبقاء عليه.`
    );
  },

  updateFieldSelect() {
    return (
      `*ماذا تريدين تغييره؟*\n` +
      `${LINE}\n\n` +
      `*1.* التاريخ والوقت\n` +
      `*2.* الموقع / العنوان\n` +
      `*3.* الاثنان معاً\n\n` +
      `${LINE}\n` +
      `اردي بـ *1* أو *2* أو *3*، أو *0* للإلغاء.`
    );
  },

  updateLocationConfirm(newAddress, existingDate, existingTime, deliveryFee = null, deliveryKm = null) {
    const deliveryLine = deliveryFee === null || deliveryFee === undefined
      ? ''
      : `رسوم التوصيل     : ${deliveryFee} ريال${deliveryKm ? ` (${deliveryKm} كم)` : ''}
`;
    return (
      `*تأكيد العنوان الجديد*
` +
      `${LINE}
` +
      `العنوان الجديد  : ${newAddress}
` +
      `التاريخ          : ${existingDate}
` +
      `الوقت           : ${existingTime}
` +
      deliveryLine +
      `${LINE}
` +
      `اردي *نعم* للموافقة على سعر التوصيل المحدث وحفظ العنوان، أو *لا* للإلغاء.`
    );
  },


  bookingUpdated(name) {
    return (
      `*تم تحديث الحجز*\n` +
      `${LINE}\n` +
      `تم تحديث حجزك بنجاح، *${name || 'عزيزتي'}*.\n\n` +
      `سنتواصل معك بالتفاصيل المحدثة.\n` +
      `${LINE}\n` +
      `اكتبي *0* للقائمة الرئيسية.`
    );
  },

  existingBookingCancelled(serviceName) {
    return (
      `*تم إلغاء الحجز*\n` +
      `${LINE}\n` +
      `تم إلغاء حجز *${serviceName || 'خدمتك'}*.\n\n` +
      `إذا أردت الحجز مجدداً، اردي *2* في أي وقت.\n` +
      `${LINE}\n` +
      `اكتبي *0* للقائمة الرئيسية.`
    );
  },

  linkNotAccepted() {
    return (
      `⚠️ *الروابط غير مقبولة*\n` +
      `${LINE}\n\n` +
      `من فضلك شاركي *دبوس موقعك* مباشرة عبر الواتساب:\n\n` +
      `• اضغطي على أيقونة المرفقات 📎 ← *الموقع*\n` +
      `• ثم أرسلي موقعك الحالي أو المحفوظ\n\n` +
      `العناوين المكتوبة أو روابط خرائط جوجل لا يمكن معالجتها.`
    );
  },

  didNotUnderstand() {
    const options = [
      `عذراً، لم أفهم ذلك جيداً. هل يمكنك المحاولة مرة أخرى؟`,
      `لم أتمكن من فهم رسالتك. هل يمكنك إعادة الصياغة أو اختيار خيار من القائمة؟`,
      `آسفة، لم أستطع فهم ذلك. هل يمكنك إعادة الصياغة أو اختيار رقم؟`,
      `لم أفهم رسالتك تماماً. كيف يمكنني مساعدتك؟`,
    ];
    return options[Math.floor(Math.random() * options.length)];
  },

  askRating(name, sessionInfo = {}) {
    const { serviceName, date, time } = sessionInfo;
    const sessionLine = serviceName
      ? `\n📋 *الجلسة:* ${serviceName}${date ? `  |  📅 ${date}` : ''}${time ? `  |  🕐 ${time}` : ''}\n`
      : '';
    return (
      `💆‍♀️ مرحباً ${name || ''}! نأمل أنك استمتعت بجلستك اليوم.${sessionLine}\n` +
      `نود معرفة رأيك — هل يمكنك تقييم تجربتك؟\n\n` +
      `1 — ضعيف\n` +
      `2 — مقبول\n` +
      `3 — جيد\n` +
      `4 — جيد جداً\n` +
      `5 — ممتاز ⭐\n\n` +
      `أرسلي رقماً من *1* إلى *5*. رأيك يهمنا جداً! 🙏`
    );
  },

  askFeedback(rating) {
    const praise = rating >= 4
      ? `يسعدنا أنك استمتعت بالتجربة! 😊`
      : rating === 3
        ? `شكراً لك — سنستمر في التحسين! 💪`
        : `نأسف لأنها لم تكن مثالية — نقدر صراحتك جداً.`;
    return (
      `${praise}\n\n` +
      `هل تودين مشاركة أي تعليقات إضافية حول جلستك؟\n\n` +
      `اكتبي ما تشائين — أو اردي *skip* إذا كنت تفضلين عدم التعليق.`
    );
  },

  thankForFeedback() {
    return (
      `🌸 شكراً جزيلاً على تعليقك!\n\n` +
      `رأيك يعني لنا الكثير ويساعدنا على تقديم أفضل تجربة ممكنة.\n\n` +
      `نتطلع إلى استقبالك مجدداً في *هيلينج سبيس*. إلى اللقاء! 💆‍♀️`
    );
  },

  noBookings() {
    return `ليس لديك أي حجوزات حالياً.\n\nارردي بـ *2* لحجز خدمة، أو *0* للقائمة الرئيسية.`;
  },

  bookingHistoryHeader(name) {
    return `سجل حجوزاتك، ${name || 'عزيزتي'}:\n\n${LINE}\n`;
  },

  bookingHistoryItem({ num, status, service, date, time, type, address, therapist, rating }) {
    const statusLabelAr = {
      pending:   'قيد الانتظار',
      confirmed: 'مؤكد',
      completed: 'مكتمل',
      cancelled: 'ملغي',
      failed:    'فشل',
      no_show:   'عدم حضور',
    };
    const typeLabel = type === 'home' ? 'زيارة منزلية' : 'في المركز';
    const addrLine  = address ? `\nالعنوان  : ${address}` : '';
    const thLine    = therapist ? `\nالمعالجة : ${therapist}` : '';
    const rtLine    = rating ? `\nالتقييم  : ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)` : '';

    return (
      `*الحجز ${num}*\n` +
      `الحالة    : ${statusLabelAr[status] || status}\n` +
      `الخدمة    : ${service || 'N/A'}\n` +
      `التاريخ   : ${date || 'TBD'}\n` +
      `الوقت    : ${time || 'TBD'}\n` +
      `النوع     : ${typeLabel}` +
      addrLine +
      thLine +
      rtLine
    );
  },

  noReschedulableBookings(mode) {
    const act = mode === 'cancel' ? 'إلغائه' : 'تعديله';
    return `ليس لديك أي حجوزات نشطة يمكن ${act} حالياً.\n\nاردي بـ *2* لحجز جديد، أو *0* للقائمة الرئيسية.`;
  },

  bookingNotFound() {
    return `هذا الحجز لم يعد متاحاً. اكتبي *0* للقائمة الرئيسية.`;
  },

  connectorNoChanges() {
    return `لم يتم إجراء أي تغييرات. اكتبي *0* للقائمة الرئيسية.`;
  },

  pastDateReject(reqDisplay) {
    return `⚠️ *${reqDisplay}* في الماضي.\n\nيرجى اختيار تاريخ من اليوم فصاعداً، أو اردي بـ *التالي* لرؤية أقرب يوم متاح.`;
  },

  advanceBookingLimit(maxDays, latestDate) {
    return (
      `⚠️ نأسف، نقبل الحجوزات حتى *${maxDays} يوم* مقدماً فقط.\n\n` +
      `آخر تاريخ متاح يمكنك حجزه هو *${latestDate}*.\n\n` +
      `يرجى اختيار تاريخ ضمن هذه الفترة، أو اردي بـ *التالي* لرؤية أقرب يوم متاح.`
    );
  },

  slotNoLongerAvailable() {
    return `⚠️ عذراً، هذا الموعد تم حجزه للتو من قبل عميلة أخرى.`;
  },

  bookingHistoryFooter() {
    return `\n${LINE}\n\nاردي بـ *0* للقائمة الرئيسية أو *2* لحجز جديد.`;
  },

  connectorNoProb()   { return 'لا مشكلة! '; },
  connectorOfCourse() { return 'بالطبع! '; },
  connectorSure()     { return pick(['تمام! ', 'رائع! ', 'حسناً — ']); },
  connectorOk()       { return pick(['حسناً! ', 'ممتاز! ', 'رائع! ']); },
  connectorGreatNews() { return pick(['أبشري — ', 'نعم، ', 'بالطبع — ']); },
  connectorSorryAllBooked(reqDisplay) { return `نأسف، *${reqDisplay}* محجوز بالكامل.\n\n`; },
  connectorNoAppointmentsLeft(reqDisplay) { return `نأسف، *${reqDisplay}* محجوز بالكامل، وللأسف ليس لدينا مواعيد متاحة خلال 14 يوماً القادمة أيضاً.\n\n`; },
  connectorUpdateDate() { return `دعينا نحدث التاريخ.\n\n`; },
  connectorUpdateAddress() { return `دعينا نحدد عنوانك.\n\n`; },
  connectorPickService() { return `دعينا نختار خدمة أخرى.\n\n`; },

  daySuggestionFollowup(dateDisplay) {
    const phrase = pick(['ما رأيك في ', 'الخيار التالي هو ', 'إليك يوم متاح آخر — ']);
    return phrase + `*${dateDisplay}*.\n\nاردي بـ *نعم* للتأكيد، *التالي* ليوم آخر، أو *0* للإلغاء.`;
  },
};

// ─── Connector phrases (used inline in botHandler) ───────────────────────────

function connectorNoProb()   { return 'No problem! '; }
function connectorOfCourse() { return 'Of course! '; }
function connectorSure()     { return pick(['Sure! ', 'Great choice! ', 'Perfect — ']); }
function connectorOk()       { return pick(['Got it! ', 'Perfect! ', 'Great! ']); }
function connectorGreatNews() { return pick(['Great news — ', 'Yes, ', 'Absolutely — ']); }
function connectorSorryAllBooked(reqDisplay) { return `Sorry, *${reqDisplay}* is fully booked.\n\n`; }
function connectorNoAppointmentsLeft(reqDisplay) { return `Sorry, *${reqDisplay}* is fully booked, and unfortunately we have no availability in the 14 days after that either.\n\n`; }
function connectorUpdateDate() { return `Let's update the date.\n\n`; }
function connectorUpdateAddress() { return `Let's update your address.\n\n`; }
function connectorPickService() { return `Let's pick a different service!\n\n`; }

function daySuggestionFollowup(dateDisplay) {
  const phrase = pick(['How about ', 'The next option is ', 'Here\'s another available day — ']);
  return phrase + `*${dateDisplay}*.\n\nReply *Yes* to confirm, *Next* for another, or *0* to cancel.`;
}


// ─── Language factory ─────────────────────────────────────────────────────────
// Returns all template functions bound to the specified language.
// Usage: const t = require('./messageTemplates').forLang('ar');
function forLang(lang) {
  if (lang === 'ar') return AR;
  // Default: English — return module's own exported functions
  return module.exports;
}

module.exports.forLang = forLang;
module.exports.AR = AR;
// ─── DB-driven FAQ ────────────────────────────────────────────────────────────
// Override the static faq() by accepting a list of FAQ items from DB.
// When called with items, it builds the message dynamically.
// When called with no args, returns the static version (fallback).
function dynamicFaq(items, lang = 'en') {
  if (!items || items.length === 0) return faq();
  
  const header = lang === 'ar' 
    ? '*الأسئلة الشائعة*\n─────────────────\n\n' 
    : '*Frequently Asked Questions*\n─────────────────\n\n';
  
  const body = items
    .filter(item => item.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item, i) => {
      const q = lang === 'ar' && item.question_ar ? item.question_ar : item.question_en;
      const a = lang === 'ar' && item.answer_ar ? item.answer_ar : item.answer_en;
      return ;
    })
    .join('\n\n');
  
  return header + body +  +
    (lang === 'ar' ? 'اكتبي *0* للقائمة الرئيسية.' : 'Type *0* for main menu.');
}

module.exports.dynamicFaq = dynamicFaq;
