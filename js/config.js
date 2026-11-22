/* ==========================================================
   IBEAU Progress Report - settings
   Edit only this file when you deploy the site.
   ========================================================== */

/* Link of the deployed Google web app (google-apps-script/Code.gs - see README.md).
   Login, batches, students, saving and e-mail all go through it. */
const BACKUP_URL = "https://script.google.com/macros/s/AKfycbxIAHZvGc8QknnRI5iprCzKOIjmJLKbGs-CBGBzuRPZW7hUqCM6l8yUYP7yJYUkalC_xg/exec";                       // e.g. "https://script.google.com/macros/s/XXXX/exec"

/* true  = staff must log in first (normal use)
   false = skip the login and open the form directly (offline / testing only, no cloud features) */
const REQUIRE_LOGIN = true;
