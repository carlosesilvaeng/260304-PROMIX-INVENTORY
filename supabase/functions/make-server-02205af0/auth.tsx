import { createClient } from 'jsr:@supabase/supabase-js@2';

// ============================================================================
// AUTHENTICATION SERVICE
// ============================================================================
// Maneja autenticación de usuarios con Supabase Auth y tabla users_02205af0

const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

const getSupabaseAnonClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  // Try SUPABASE_ANON_KEY first (standard), then CLIENT_ANON_KEY (fallback)
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('CLIENT_ANON_KEY');
  
  console.log('🔧 [getSupabaseAnonClient] Creating ANON client...');
  console.log('   URL:', supabaseUrl?.substring(0, 30) + '...');
  console.log('   Key length:', supabaseAnonKey?.length);
  console.log('   Key prefix:', supabaseAnonKey?.substring(0, 30) + '...');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
};

// ============================================================================
// INTERFACES
// ============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'plant_manager' | 'admin' | 'super_admin';
  assigned_plants: string[];
  is_active: boolean;
  auth_user_id?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  role: 'plant_manager' | 'admin' | 'super_admin';
  assigned_plants?: string[];
  created_by_id?: string; // ID del Super Admin que lo crea
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  access_token?: string;
  error?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  access_token?: string;
  error?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  error?: string;
  message?: string;
}

// ============================================================================
// VERIFY TOKEN - Verify JWT without expiration check
// ============================================================================

export async function verifyToken(accessToken: string): Promise<{ user: User | null; error: string | null }> {
  console.log('🔐 [verifyToken] Starting token verification...');

  try {
    // Use service role client for server-side token verification.
    // anonClient.auth.getUser(jwt) is unreliable in newer supabase-js on Deno edge functions
    // (behavior changed between package versions; service role is the correct server-side pattern).
    const serviceClient = getSupabaseClient();

    // Get user from token - this validates the token is valid
    const { data: { user: authUser }, error: authError } = await serviceClient.auth.getUser(accessToken);
    
    if (authError) {
      console.error('❌ [verifyToken] Token verification failed:', authError.message);
      
      // Check if error is due to expired token
      if (authError.message.includes('expired') || authError.message.includes('JWT')) {
        console.log('⏰ [verifyToken] Token appears to be expired');
        return { user: null, error: 'TOKEN_EXPIRED' };
      }
      
      return { user: null, error: authError.message };
    }
    
    if (!authUser) {
      console.error('❌ [verifyToken] No user found in token');
      return { user: null, error: 'Invalid token' };
    }
    
    console.log('✅ [verifyToken] Auth user found:', authUser.email);
    
    // Get full user data from our users table
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase
      .from('users_02205af0')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single();
    
    if (userError || !userData) {
      console.error('❌ [verifyToken] User not found in database');
      return { user: null, error: 'User not found' };
    }
    
    console.log('✅ [verifyToken] User verified:', userData.email);
    
    return {
      user: userData as User,
      error: null
    };
    
  } catch (error) {
    console.error('[verifyToken] Unexpected error:', error);
    return { user: null, error: error.message };
  }
}

// ============================================================================
// LOGIN - Authenticate user
// ============================================================================

export async function login({ email, password }: LoginRequest): Promise<LoginResponse> {
  console.log('🔑 [login] Login attempt for:', email);
  
  try {
    const anonClient = getSupabaseAnonClient();
    
    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    
    if (authError || !authData.user) {
      console.error('❌ [login] Authentication failed:', authError?.message);
      return { success: false, error: 'Credenciales inválidas' };
    }
    
    console.log('✅ [login] Auth successful for:', email);
    
    // Get user data from our table
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase
      .from('users_02205af0')
      .select('*')
      .eq('auth_user_id', authData.user.id)
      .single();
    
    if (userError || !userData) {
      console.error('❌ [login] User not found in database');
      return { success: false, error: 'Usuario no encontrado' };
    }
    
    if (!userData.is_active) {
      console.error('❌ [login] User is inactive');
      return { success: false, error: 'Usuario inactivo' };
    }
    
    // Update last login
    await supabase
      .from('users_02205af0')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userData.id);
    
    console.log('✅ [login] Login successful for:', email);
    
    return {
      success: true,
      user: userData as User,
      access_token: authData.session?.access_token,
    };
    
  } catch (error) {
    console.error('[login] Unexpected error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// SIGNUP - Create new user
// ============================================================================

export async function signup(data: SignupData): Promise<AuthResult> {
  console.log('👤 [signup] Creating user:', data.email);
  
  try {
    const supabase = getSupabaseClient();
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users_02205af0')
      .select('id')
      .eq('email', data.email)
      .single();
    
    if (existingUser) {
      return { success: false, error: 'El email ya está registrado' };
    }
    
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // Auto-confirm since we don't have email server
    });
    
    if (authError || !authData.user) {
      console.error('❌ [signup] Auth user creation failed:', authError?.message);
      return { success: false, error: authError?.message || 'Error creating user' };
    }
    
    // Create user in our table
    const { data: userData, error: userError } = await supabase
      .from('users_02205af0')
      .insert({
        name: data.name,
        email: data.email,
        role: data.role,
        assigned_plants: data.assigned_plants || [],
        is_active: true,
        auth_user_id: authData.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (userError || !userData) {
      console.error('❌ [signup] User table insert failed:', userError?.message);
      // Cleanup: delete auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return { success: false, error: 'Error creating user record' };
    }
    
    console.log('✅ [signup] User created successfully:', data.email);
    
    return {
      success: true,
      user: userData as User,
    };
    
  } catch (error) {
    console.error('[signup] Unexpected error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// GET ALL USERS
// ============================================================================

export async function getAllUsers(requestingUserId: string): Promise<{ success: boolean; users?: User[]; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    // Get requesting user's role
    const { data: requestingUser } = await supabase
      .from('users_02205af0')
      .select('role')
      .eq('id', requestingUserId)
      .single();
    
    if (!requestingUser || (requestingUser.role !== 'admin' && requestingUser.role !== 'super_admin')) {
      return { success: false, error: 'Unauthorized' };
    }
    
    // Get all users
    const { data: users, error } = await supabase
      .from('users_02205af0')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, users: users as User[] };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// UPDATE USER
// ============================================================================

export async function updateUser(
  userId: string,
  updates: Partial<User>,
  requestingUserId: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    // Get requesting user's role
    const { data: requestingUser } = await supabase
      .from('users_02205af0')
      .select('role')
      .eq('id', requestingUserId)
      .single();
    
    if (!requestingUser || (requestingUser.role !== 'admin' && requestingUser.role !== 'super_admin')) {
      return { success: false, error: 'Unauthorized' };
    }
    
    // Update user
    const { data: updatedUser, error } = await supabase
      .from('users_02205af0')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, user: updatedUser as User };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DELETE USER
// ============================================================================

export async function deleteUser(
  userId: string,
  requestingUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    // Get requesting user's role
    const { data: requestingUser } = await supabase
      .from('users_02205af0')
      .select('role')
      .eq('id', requestingUserId)
      .single();
    
    if (!requestingUser || (requestingUser.role !== 'admin' && requestingUser.role !== 'super_admin')) {
      return { success: false, error: 'Unauthorized' };
    }
    
    // Get user to delete
    const { data: userToDelete } = await supabase
      .from('users_02205af0')
      .select('auth_user_id')
      .eq('id', userId)
      .single();
    
    if (!userToDelete) {
      return { success: false, error: 'User not found' };
    }
    
    // Delete from our table
    const { error: deleteError } = await supabase
      .from('users_02205af0')
      .delete()
      .eq('id', userId);
    
    if (deleteError) {
      return { success: false, error: deleteError.message };
    }
    
    // Delete auth user if exists
    if (userToDelete.auth_user_id) {
      await supabase.auth.admin.deleteUser(userToDelete.auth_user_id);
    }
    
    return { success: true };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// CHANGE PASSWORD - Cambiar contraseña del usuario autenticado
// ============================================================================

export async function changePassword(
  accessToken: string,
  { currentPassword, newPassword }: ChangePasswordRequest
): Promise<ChangePasswordResponse> {
  const anonClient = getSupabaseAnonClient();
  
  console.log('🔐 [changePassword] Starting password change process');
  
  try {
    // 1. Verificar que el usuario está autenticado
    const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      console.error('❌ [changePassword] User not authenticated:', authError?.message);
      return { success: false, error: 'No autenticado' };
    }
    
    console.log('✅ [changePassword] User authenticated:', authUser.email);
    
    // 2. Verificar la contraseña actual intentando hacer login
    const { error: loginError } = await anonClient.auth.signInWithPassword({
      email: authUser.email!,
      password: currentPassword,
    });
    
    if (loginError) {
      console.error('❌ [changePassword] Current password incorrect');
      return { success: false, error: 'Contraseña actual incorrecta' };
    }
    
    console.log('✅ [changePassword] Current password verified');
    
    // 3. Actualizar la contraseña
    const { error: updateError } = await anonClient.auth.updateUser({
      password: newPassword,
    });
    
    if (updateError) {
      console.error('❌ [changePassword] Password update failed:', updateError.message);
      return { success: false, error: 'Error al actualizar la contraseña: ' + updateError.message };
    }
    
    console.log('✅ [changePassword] Password updated successfully for:', authUser.email);
    
    return {
      success: true,
      message: 'Contraseña actualizada exitosamente',
    };
    
  } catch (error) {
    console.error('[changePassword] Unexpected error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// CHECK FIRST TIME SETUP
// ============================================================================

export async function isFirstTimeSetup(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    
    const { data: users, error } = await supabase
      .from('users_02205af0')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Error checking first time setup:', error);
      return true; // Assume first time on error
    }
    
    return users.length === 0;
    
  } catch (error) {
    console.error('Unexpected error in isFirstTimeSetup:', error);
    return true;
  }
}