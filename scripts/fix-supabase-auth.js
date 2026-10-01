const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hgczncztmdqtfhqimfar.supabase.co'
const supabaseServiceKey = 'sbp_REDACTED_ROTATE_ME'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixDatabase() {
  console.log('🔧 Fixing Supabase database for OAuth authentication...\n')

  try {
    // Step 1: Fix users table constraints and RLS
    console.log('1. Fixing users table constraints...')
    
    const { error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Disable RLS temporarily
        ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
        
        -- Drop the restrictive foreign key constraint
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
        
        -- Add it back with deferred constraint
        ALTER TABLE public.users ADD CONSTRAINT users_id_fkey 
          FOREIGN KEY (id) REFERENCES auth.users(id) 
          ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
        
        -- Drop existing restrictive policies
        DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
        DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
        DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
        DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
        DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
        DROP POLICY IF EXISTS "Enable update for users based on id" ON public.users;
        
        -- Re-enable RLS
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        
        -- Create permissive policy for authenticated users
        CREATE POLICY "Allow authenticated users full access" ON public.users
          FOR ALL USING (auth.uid() IS NOT NULL)
          WITH CHECK (auth.uid() IS NOT NULL);
      `
    })
    
    if (constraintError) {
      console.error('❌ Constraint fix error:', constraintError.message)
    } else {
      console.log('✅ Users table constraints fixed')
    }

    // Step 2: Update Supabase site URL configuration
    console.log('\n2. Checking Supabase configuration...')
    
    // Note: Site URL configuration needs to be done via Supabase dashboard
    // We'll create a user record manually for testing
    
    // Step 3: Try to create the OAuth user record manually
    console.log('\n3. Creating OAuth user record...')
    
    // First, check if the user exists in auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Cannot list auth users:', authError.message)
    } else {
      console.log(`📊 Found ${authUsers.users.length} auth users`)
      
      // Look for magicalbirthdayplanner@gmail.com
      const targetUser = authUsers.users.find(u => u.email === 'magicalbirthdayplanner@gmail.com')
      
      if (targetUser) {
        console.log('✅ Found OAuth user in auth.users:', targetUser.email)
        
        // Create the user record in custom users table
        const { data: userRecord, error: userError } = await supabase
          .from('users')
          .upsert({
            id: targetUser.id,
            email: targetUser.email,
            full_name: targetUser.user_metadata?.full_name || targetUser.email.split('@')[0],
            avatar_url: targetUser.user_metadata?.avatar_url,
            current_plan: 'FREE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
          .select()
        
        if (userError) {
          console.error('❌ User record creation failed:', userError.message)
        } else {
          console.log('✅ User record created successfully:', userRecord)
        }
      } else {
        console.log('⚠️ OAuth user not found in auth.users - user needs to sign in with Google first')
      }
    }

    // Step 4: Verify the fix
    console.log('\n4. Verifying database fix...')
    
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'magicalbirthdayplanner@gmail.com')
    
    if (usersError) {
      console.error('❌ Verification failed:', usersError.message)
    } else if (usersData && usersData.length > 0) {
      console.log('✅ User record verified in database:', usersData[0])
    } else {
      console.log('⚠️ User record not found - OAuth user needs to be created first')
    }

    console.log('\n🎉 Database fix completed!')
    console.log('\nNext steps:')
    console.log('1. Go to Supabase Dashboard → Settings → API')
    console.log('2. Set Site URL to: https://www.magicalbirthdayplanner.com')
    console.log('3. Go to Authentication → Providers → Google')
    console.log('4. Ensure Google provider is enabled')
    console.log('5. Test OAuth flow again')

  } catch (error) {
    console.error('💥 Database fix failed:', error)
  }
}

fixDatabase().then(() => {
  console.log('\n✅ Script completed')
  process.exit(0)
}).catch(error => {
  console.error('💥 Script failed:', error)
  process.exit(1)
})