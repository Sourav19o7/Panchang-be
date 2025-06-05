const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
}

if (!supabaseServiceKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not found - some admin operations may not work');
}

// Client for general operations
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  }
});

// Service client for admin operations (only if service key is available)
let supabaseAdmin = null;
if (supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
} else {
  console.warn('Admin client not initialized - SUPABASE_SERVICE_ROLE_KEY missing');
}

// Test database connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      console.warn('Users table not found - database may need initialization');
      return false;
    } else if (error) {
      console.error('Database connection test failed:', error.message);
      return false;
    }
    
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection test error:', error.message);
    return false;
  }
};

// Initialize connection test
testConnection();

module.exports = {
  supabase,
  supabaseAdmin: supabaseAdmin || supabase, // Fallback to regular client
  testConnection
};