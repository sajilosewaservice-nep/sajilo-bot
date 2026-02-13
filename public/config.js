/** * =============================================================================

 * TITAN ENTERPRISE CRM v4.0.0 (ULTIMATE RPA EDITION)

 * =============================================================================

 */

const SYSTEM_CONFIG = {

    SUPABASE_URL: "https://ratgpvubjrcoipardzdp.supabase.co",

    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk",

    RPA_SERVER_URL: localStorage.getItem('rpa_url') || "http://localhost:5000",

    PAGE_SIZE: 15

};

let supabaseClient;

let STATE = {

    currentUser: null,

    allData: [],

    filteredData: [],

    currentPage: 1,

    isLoading: false

};