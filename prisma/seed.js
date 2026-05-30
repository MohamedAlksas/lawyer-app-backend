import bcrypt from 'bcrypt';
import { supabase } from '../src/utils/supabase.js';

async function main() {
  const adminEmail = 'admin@lawyerapp.com';
  const { data: existing } = await supabase.from('User').select('id').eq('email', adminEmail).maybeSingle();
  if (existing) {
    console.log('Admin user already exists, skipping seed');
    return;
  }

  const password = await bcrypt.hash('admin123', 10);
  const { error } = await supabase.from('User').insert({
    fullName: 'Admin',
    email: adminEmail,
    password,
    role: 'ADMIN',
    phone: '01000000000',
  });

  if (error) {
    console.error('Seed failed:', error.message);
    return;
  }
  console.log('Admin user created: admin@lawyerapp.com / admin123');
}

main().catch(console.error);
