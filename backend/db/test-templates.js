require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const t = require('../services/messageTemplates');

console.log('=== EMOJI CHECK ===');
const emojiRegex = /[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
const msgs = {
  welcomeNew:    t.welcomeNew(),
  mainMenu:      t.mainMenu(),
  askBookingType: t.askBookingType(),
  bookingConfirmed: t.bookingConfirmed('Sara'),
  businessHours: t.businessHours(),
  faq:           t.faq(),
};
let hasEmoji = false;
for (const [k, m] of Object.entries(msgs)) {
  if (emojiRegex.test(m)) {
    console.log('EMOJI FOUND in ' + k);
    hasEmoji = true;
  }
}
if (!hasEmoji) console.log('No emojis found in any template.');

console.log('\n=== WELCOME NEW ===');
console.log(t.welcomeNew());

console.log('\n=== MAIN MENU ===');
console.log(t.mainMenu());

console.log('\n=== BOOKING SUMMARY ===');
console.log(t.bookingSummary({
  serviceName: 'Swedish Massage', duration: 60, price: 200,
  locationType: 'home', address: 'Al Malaz', date: '25 Feb', time: '3:00 PM'
}));

console.log('\n=== CONFIRMED ===');
console.log(t.bookingConfirmed('Fatima'));
