require("dotenv").config({ path: "/home/azureuser/HSC_BOT_ADMIN/.env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, password, role, is_active")
    .eq("email", "sam@devop.com.sa")
    .single();

  if (error) {
    console.log("Supabase error:", error.message);
  } else {
    console.log("Found user:", data.email);
    console.log("Password length:", data.password.length);

    const bcrypt = require("bcryptjs");
    const valid = bcrypt.compareSync("BlackBerry23*", data.password);
    console.log("Password match:", valid);
  }
})();
