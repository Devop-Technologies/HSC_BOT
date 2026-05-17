require('dotenv').config();
const express = require('express');
const { PORT } = require('./config');
const { connectDB } = require('./db');
const webhookRoute        = require('./routes/webhook');
const bookingWebhookRoute = require('./routes/bookingWebhook');
const adminWebhookRoute   = require('./routes/adminWebhook');
const adminDeliveryZonesRoute = require("./routes/adminDeliveryZones");
const adminFaqRoute = require("./routes/adminFaq");
const adminHealthRecsRoute = require("./routes/adminHealthRecommendations");
const adminBusinessSettingsRoute = require("./routes/adminBusinessSettings");
const adminGreetingRoute    = require('./routes/adminGreeting');
const adminSystemPromptRoute = require('./routes/adminSystemPrompt');
const adminBotMessagesRoute  = require('./routes/adminBotMessages');
const { startDriverScheduler, startTherapistScheduler } = require('./services/driverService');
const { startWorkerReminderScheduler } = require('./services/workerReminderService');

const app = express();
app.use(express.json());

app.use('/webhook',         webhookRoute);
app.use('/booking-webhook', bookingWebhookRoute);
app.use('/admin-webhook/booking-status', adminWebhookRoute); // Using original admin script handler
app.use('/admin-webhook/greeting', adminGreetingRoute);
app.use('/admin-webhook/system-prompt', adminSystemPromptRoute);
app.use('/admin-webhook/bot-messages', adminBotMessagesRoute);
app.use("/admin-webhook/business-settings", adminBusinessSettingsRoute);
app.use("/admin-webhook/health-recommendations", adminHealthRecsRoute);
app.use("/admin-webhook/faq", adminFaqRoute);
app.use("/admin-webhook/delivery-zones", adminDeliveryZonesRoute);

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectDB();
  startDriverScheduler();
  startTherapistScheduler();
  await startWorkerReminderScheduler();
});
